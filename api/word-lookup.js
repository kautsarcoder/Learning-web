// api/word-lookup.js
// GET /api/word-lookup?word=شو&lang=id|en   (lang opsional, default "id")
//
// JARING PENGAMAN TERAKHIR buat balon "arti per kata" di frontend. Dipanggil
// CUMA kalau kata yang diklik user gak ketemu di 2 tingkat sebelumnya
// (vocab target sesi ini, dan kamus kata fungsi statis COMMON_WORD_MEANINGS
// di App.jsx) — jadi ini gak kepanggil buat SEMUA klik, cuma buat kata yang
// beneran belum ke-cover di manapun.
//
// Urutan pengecekan (poin penting: AI CUMA dipanggil kalau 2 langkah di
// bawah dua-duanya gagal UNTUK BAHASA YANG DIMINTA — bukan default pertama):
//   1. word_glossary — cache PERMANEN hasil lookup AI sebelumnya, dari
//      SIAPAPUN user (bukan per-user), utk KEDUA bahasa (arti + arti_en).
//   2. vocab_items — barangkali kata ini SEBENARNYA sudah bagian kurikulum
//      (diajarkan di topik/level LAIN). Kalau ketemu, disalin ke
//      word_glossary juga.
//   3. AI (LadizAI) — CUMA kalau field bahasa yang DIMINTA masih kosong di
//      langkah 1 & 2 (mis. sudah ada versi Indonesia dari lookup lama,
//      tapi user sekarang minta versi Inggris & belum pernah diminta —
//      di sini AI CUMA diminta nerjemahin ke bahasa yang kurang itu SAJA,
//      bukan generate ulang dari nol, biar gak boros).
//
// [BEDA GAYA RETRY dari generate-vocab-v2.mjs]: retry di sini dibikin
// singkat (maks 2x) karena user LAGI NUNGGU balon muncul secara real-time.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanJson(text) {
  return text.replace(/```json|```/g, "").trim();
}

async function callLadizQuick(prompt, maxAttempts = 2) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${process.env.LADIZ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LADIZ_API_KEY}` },
        body: JSON.stringify({
          model: "ladiz-core",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 200,
          temperature: 0.2,
        }),
      });
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) return content;
      lastErr = new Error("Respons LadizAI tidak terduga: " + JSON.stringify(json).slice(0, 200));
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 400));
  }
  throw lastErr || new Error("LadizAI tidak merespons.");
}

// Generate arti buat 1 bahasa doang (dipanggil kalau field bahasa yang
// diminta belum ada, walau field bahasa LAIN mungkin sudah ada).
async function generateMeaning(kataArab, lang) {
  const langLabel = lang === "en" ? "Bahasa Inggris" : "Bahasa Indonesia";
  const prompt = `Kata Bahasa Arab dialek Levantine berikut: "${kataArab}"
Balas HANYA JSON (tanpa teks lain), format:
{ "arti": "...(arti singkat dalam ${langLabel}, cukup 1-4 kata)...", "latin": "...(transliterasi latin/romanisasi cara bacanya)..." }
Kalau ini bukan kata Arab yang valid atau kamu gak yakin artinya, tetap kasih tebakan TERBAIK yang paling masuk akal, JANGAN kosongkan field-nya.`;
  const raw = await callLadizQuick(prompt);
  const parsed = JSON.parse(cleanJson(raw));
  if (!parsed?.arti) throw new Error("AI tidak mengembalikan arti yang valid.");
  return { arti: parsed.arti, latin: parsed.latin || null };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const { word, lang: rawLang } = req.query;
  const cleaned = (word || "").trim();
  const lang = rawLang === "en" ? "en" : "id";
  if (!cleaned) return res.status(400).json({ error: "word wajib diisi" });

  const artiField = lang === "en" ? "arti_en" : "arti";

  try {
    // 1. Cache permanen (dari lookup AI SIAPAPUN sebelumnya, bahasa manapun).
    const { data: cached } = await supabase
      .from("word_glossary")
      .select("kata_arab, arti, arti_en, latin")
      .eq("kata_arab", cleaned)
      .maybeSingle();
    if (cached && cached[artiField]) {
      return res.status(200).json({ kata_arab: cached.kata_arab, arti: cached[artiField], latin: cached.latin });
    }

    // 2. Barangkali sudah bagian kurikulum (topik/level LAIN).
    if (!cached) {
      const { data: existing } = await supabase
        .from("vocab_items")
        .select("kata_arab, arti, arti_en, latin")
        .eq("kata_arab", cleaned)
        .limit(1)
        .maybeSingle();
      if (existing && existing[artiField]) {
        await supabase.from("word_glossary").upsert({ kata_arab: existing.kata_arab, arti: existing.arti, arti_en: existing.arti_en, latin: existing.latin });
        return res.status(200).json({ kata_arab: existing.kata_arab, arti: existing[artiField], latin: existing.latin });
      }
    }

    // 3. Field bahasa yang DIMINTA masih kosong di mana pun -- tanya AI
    // CUMA buat bahasa ini (kalau `cached` sudah ada tapi field lain
    // kosong, JANGAN generate ulang bahasa yang sudah ada, cukup tambahin
    // yang kurang).
    const generated = await generateMeaning(cleaned, lang);
    const latin = cached?.latin || generated.latin;
    const upsertRow = {
      kata_arab: cleaned,
      arti: lang === "id" ? generated.arti : (cached?.arti || null),
      arti_en: lang === "en" ? generated.arti : (cached?.arti_en || null),
      latin,
    };
    await supabase.from("word_glossary").upsert(upsertRow);

    res.status(200).json({ kata_arab: cleaned, arti: generated.arti, latin });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
