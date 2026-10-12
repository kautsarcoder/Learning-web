// api/word-audio.js
// GET /api/word-audio?word=كتاب
//
// Dipanggil frontend tiap user KLIK 1 kata Arab di soal susun-kalimat
// ("word_order" arah to_arabic) — biar user dengar cara baca kata itu pas
// nyusun kalimatnya, bukan cuma pas selesai (ex.audioUrl yang sudah ada
// cuma buat kalimat UTUH, bukan per-kata).
//
// [SENGAJA MANDIRI] generateAudio/uploadAudio di sini SALINAN dari
// generate-vocab-v2.mjs (bukan di-import) -- endpoint API live kayak gini
// sebaiknya gak gantung ke file script 1600+ baris yang punya pengecekan
// di level atas (mis. TOPIC_HINTS) yang bisa throw gara-gara hal yang SAMA
// SEKALI gak ada hubungannya sama audio per-kata. Kalau logic TTS-nya
// berubah di generate-vocab-v2.mjs nanti, update manual juga di sini.
//
// Urutan pengecekan (AI/TTS CUMA dipanggil kalau 2 langkah di bawah
// dua-duanya kosong):
//   1. vocab_items.audio_url  — kata ini mungkin SUDAH ada audionya dari
//      backfill-vocab-audio.mjs (kata itu salah satu kosakata inti).
//   2. word_glossary.audio_url — cache PERMANEN dari lookup sebelumnya
//      (dari SIAPAPUN user, bisa dari endpoint ini atau dari lookup arti
//      kata di word-lookup.js).
//   3. ElevenLabs — CUMA kalau kata ini belum punya audio di manapun.
//      Hasilnya disimpan ke word_glossary PERMANEN, jadi klik BERIKUTNYA
//      buat kata yang sama, di level manapun, gak generate ulang.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateAudio(kataArab) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) throw new Error("ELEVENLABS_VOICE_ID belum diisi di .env");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: kataArab, model_id: "eleven_multilingual_v2" }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs gagal (${res.status}): ${errText}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function uploadAudio(audioBuffer) {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${uniqueId}.mp3`;
  const { error } = await supabase.storage.from("vocab-audio").upload(filename, audioBuffer, { contentType: "audio/mpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("vocab-audio").getPublicUrl(filename);
  return data.publicUrl;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  // Rapikan spasi; endpoint ini memanggil ElevenLabs (berbayar), jadi batasi ke teks Arab yang wajar
  // (kata atau 1 kalimat) supaya tidak bisa dipakai menghabiskan kredit dengan teks sembarang.
  const cleaned = String(req.query.word || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return res.status(400).json({ error: "word wajib diisi" });
  if (cleaned.length > 200) return res.status(400).json({ error: "teks terlalu panjang (maks 200 karakter)" });
  if (!/[\u0600-\u06FF]/.test(cleaned)) return res.status(400).json({ error: "teks harus berisi huruf Arab" });

  try {
    // 1. Barangkali kata ini salah satu vocab_items (sudah ada audionya).
    const { data: vocabRow } = await supabase
      .from("vocab_items")
      .select("audio_url")
      .eq("kata_arab", cleaned)
      .not("audio_url", "is", null)
      .limit(1)
      .maybeSingle();
    if (vocabRow?.audio_url) { res.setHeader("Cache-Control", "public, s-maxage=86400"); return res.status(200).json({ audio_url: vocabRow.audio_url }); }

    // 2. Cache permanen dari lookup/generate sebelumnya (siapapun user).
    const { data: cached } = await supabase
      .from("word_glossary")
      .select("audio_url")
      .eq("kata_arab", cleaned)
      .maybeSingle();
    if (cached?.audio_url) { res.setHeader("Cache-Control", "public, s-maxage=86400"); return res.status(200).json({ audio_url: cached.audio_url }); }

    // 3. Belum ada di manapun -- generate SEKALI, simpan permanen.
    const buf = await generateAudio(cleaned);
    const url = await uploadAudio(buf);
    await supabase.from("word_glossary").upsert({ kata_arab: cleaned, audio_url: url });

    res.setHeader("Cache-Control", "public, s-maxage=86400");
    res.status(200).json({ audio_url: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
