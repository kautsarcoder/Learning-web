// api/content.js
// GET /api/content?type=subjects
// GET /api/content?type=units&subject_id=xxx
// GET /api/content?type=topics&unit_id=xxx
// GET /api/content?type=levels&topic_id=xxx
// GET /api/content?type=vocab&level_id=xxx
// GET /api/content?type=vocab_by_topic&topic_id=xxx[&user_id=xxx]  (semua vocab di 1 Unit/topic, semua level)
// GET /api/content?type=vocab_by_unit&unit_id=xxx[&user_id=xxx]    (semua vocab di 1 Bagian/unit, semua topic+level)
//
// CATATAN PENTING soal user_id di vocab_by_topic/vocab_by_unit:
// - TANPA user_id (guest/local dev) -> perilaku PERSIS SEPERTI SEBELUMNYA,
//   semua vocab dikembalikan apa adanya, gak ada yang berubah.
// - DENGAN user_id -> vocab diurutkan berdasar SPACED REPETITION beneran:
//   kata yang jatuh tempo direview (next_review_at <= sekarang, presisi menit)
//   dan kata
//   yang paling lemah (mastery_score rendah) ditaruh paling depan. Kata
//   yang belum pernah dilihat user ini (gak ada baris di user_vocab_progress)
//   dianggap "due" juga (wajar, kan belum pernah dipelajari).
 
import { createClient } from "@supabase/supabase-js";
 
// Pakai SERVICE_ROLE (bukan ANON) karena endpoint ini sekarang bisa baca
// user_vocab_progress -- data personal per user, harus lewat privilege
// server-side, bukan anon key publik. Aman karena file ini SELALU jalan
// di server (Vercel function), key-nya gak pernah nyampe ke browser.
function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Env SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi. Cek file .env.local."
    );
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}
 
async function getVocabIdsForTopic(supabase, topicId) {
  const { data: levels, error } = await supabase.from("levels").select("id").eq("topic_id", topicId);
  if (error) throw error;
  return (levels || []).map((l) => l.id);
}
 
async function getLevelIdsForUnit(supabase, unitId) {
  const { data: topics, error: topicsError } = await supabase.from("topics").select("id").eq("unit_id", unitId);
  if (topicsError) throw topicsError;
  const topicIds = (topics || []).map((t) => t.id);
  if (topicIds.length === 0) return [];
  const { data: levels, error: levelsError } = await supabase.from("levels").select("id").in("topic_id", topicIds);
  if (levelsError) throw levelsError;
  return (levels || []).map((l) => l.id);
}
 
async function fetchVocabByLevelIds(supabase, levelIds) {
  if (levelIds.length === 0) return [];
  const { data, error } = await supabase.from("vocab_items").select("*").in("level_id", levelIds);
  if (error) throw error;
  return data || [];
}
 
// Urutkan vocab berdasar progress user: due/lemah dulu. Kalau userId gak
// dikasih, kembalikan apa adanya (urutan asli) -- TIDAK ada perubahan
// perilaku buat guest/local dev.
async function prioritizeBySpacedRepetition(supabase, vocabList, userId) {
  if (!userId || vocabList.length === 0) return vocabList;
 
  const vocabIds = vocabList.map((v) => v.id);
  const { data: progressRows, error } = await supabase
    .from("user_vocab_progress")
    .select("vocab_id, mastery_score, next_review_at")
    .eq("user_id", userId)
    .in("vocab_id", vocabIds);
  if (error) throw error; // gagal ambil progress -> biar ketauan, jangan diam-diam pakai urutan default
 
  const progressByVocabId = new Map((progressRows || []).map((p) => [p.vocab_id, p]));
  const nowIso = new Date().toISOString();
 
  const scored = vocabList.map((v) => {
    const p = progressByVocabId.get(v.id);
    if (!p) {
      // Belum pernah dipelajari user ini -- prioritas TERTINGGI (due hari ini,
      // mastery dianggap 0), sama seperti kata yang paling lemah.
      return { v, due: true, mastery: 0 };
    }
    return { v, due: p.next_review_at <= nowIso, mastery: Number(p.mastery_score) };
  });
 
  // Urutan: due dulu (true sebelum false), lalu mastery makin rendah makin depan.
  scored.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    return a.mastery - b.mastery;
  });
 
  return scored.map((s) => s.v);
}
 
export default async function handler(req, res) {
  const { type, subject_id, unit_id, topic_id, level_id, user_id, ids } = req.query;
 
  try {
    const supabase = getSupabase();
    let data, error;
 
    if (type === "subjects") {
      ({ data, error } = await supabase.from("subjects").select("*"));
    } else if (type === "units") {
      ({ data, error } = await supabase
        .from("units")
        .select("*")
        .eq("subject_id", subject_id)
        .order("order_index"));
    } else if (type === "topics") {
      ({ data, error } = await supabase
        .from("topics")
        .select("*")
        .eq("unit_id", unit_id)
        .order("order_index"));
    } else if (type === "levels") {
      ({ data, error } = await supabase
        .from("levels")
        .select("*, exercises(count)")
        .eq("topic_id", topic_id)
        .order("level_number"));
    } else if (type === "vocab") {
      ({ data, error } = await supabase
        .from("vocab_items")
        .select("*")
        .eq("level_id", level_id));
    } else if (type === "vocab_by_topic") {
      try {
        const levelIds = await getVocabIdsForTopic(supabase, topic_id);
        const vocab = await fetchVocabByLevelIds(supabase, levelIds);
        data = await prioritizeBySpacedRepetition(supabase, vocab, user_id);
      } catch (e) {
        error = e;
      }
    } else if (type === "vocab_by_unit") {
      try {
        const levelIds = await getLevelIdsForUnit(supabase, unit_id);
        const vocab = await fetchVocabByLevelIds(supabase, levelIds);
        data = await prioritizeBySpacedRepetition(supabase, vocab, user_id);
      } catch (e) {
        error = e;
      }
    } else if (type === "vocab_by_ids") {
      // Dipakai buat popup "arti per kata" — frontend kumpulin semua
      // vocab_ids yang relevan buat 1 sesi soal, ambil kata_arab+arti-nya
      // sekaligus di sini (bukan 1 request per kata).
      const idList = (ids || "").split(",").filter(Boolean);
      ({ data, error } = await supabase
        .from("vocab_items")
        .select("id, kata_arab, latin, arti, arti_en")
        .in("id", idList));
    } else {
      return res.status(400).json({ error: "type tidak valid" });
    }
 
    if (error) throw error;
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
 

























