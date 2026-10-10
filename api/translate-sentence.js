// api/translate-sentence.js
//
// Menerjemahkan kalimat Arab Levantine (Yordania/Syam) ke Indonesia atau Inggris lewat LadizAI.
// Dipakai panel "Artinya" di Levantine untuk soal yang teks & jawabannya Arab semua.
//
// POST /api/translate-sentence   body: { sentences: ["...", ...], lang: "id" | "en" }
// -> { translations: ["...", ...] }   (urutan & jumlah sama dengan sentences)
//
// Butuh env server: LADIZ_BASE_URL, LADIZ_API_KEY (sama dengan yang dipakai script generator).
// Hasil disimpan di memori server (per instance) supaya kalimat yang sama tidak diterjemahkan ulang.

const cache = new Map();
const MAX_SENTENCES = 12;
const MAX_LEN = 300;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Gunakan POST" });
  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  const lang = body.lang === "en" ? "en" : "id";
  const sentences = Array.isArray(body.sentences) ? body.sentences.map((s) => String(s || "").trim()) : [];
  if (sentences.length === 0 || sentences.length > MAX_SENTENCES || sentences.some((s) => !s || s.length > MAX_LEN)) {
    return res.status(400).json({ error: `sentences harus 1-${MAX_SENTENCES} kalimat, maks ${MAX_LEN} karakter` });
  }
  if (!process.env.LADIZ_BASE_URL || !process.env.LADIZ_API_KEY) {
    return res.status(503).json({ error: "LADIZ_BASE_URL / LADIZ_API_KEY belum diatur di server" });
  }

  const key = (s) => `${lang}|${s}`;
  const out = sentences.map((s) => cache.get(key(s)) || null);
  const missingIdx = out.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);

  if (missingIdx.length > 0) {
    const todo = missingIdx.map((i) => sentences[i]);
    const target = lang === "en" ? "natural English" : "bahasa Indonesia yang natural";
    const prompt =
      `Terjemahkan setiap kalimat bahasa Arab dialek Levantine (Yordania/Syam) berikut ke ${target}. ` +
      `Terjemahkan MAKNA kalimat utuh (bukan kata per kata), singkat dan wajar. Jangan menambah penjelasan. ` +
      `Balas HANYA berupa JSON array berisi string terjemahan, jumlah dan urutannya sama persis dengan input.\n\n` +
      `Input:\n${JSON.stringify(todo)}`;
    let raw;
    try {
      const r = await fetch(`${process.env.LADIZ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LADIZ_API_KEY}` },
        body: JSON.stringify({ model: "ladiz-core", messages: [{ role: "user", content: prompt }], max_tokens: 1200, temperature: 0.2 }),
      });
      const j = await r.json();
      raw = j?.choices?.[0]?.message?.content || "";
    } catch (e) {
      return res.status(502).json({ error: "Gagal menghubungi layanan terjemahan" });
    }
    const m = raw.match(/\[[\s\S]*\]/);
    let arr = null;
    try { arr = m ? JSON.parse(m[0]) : null; } catch (e) { arr = null; }
    if (!Array.isArray(arr) || arr.length !== todo.length || arr.some((x) => typeof x !== "string" || !x.trim())) {
      return res.status(502).json({ error: "Balasan terjemahan tidak valid" });
    }
    missingIdx.forEach((i, k) => { out[i] = arr[k].trim(); cache.set(key(sentences[i]), out[i]); });
  }
  return res.status(200).json({ translations: out });
}

function safeParse(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
