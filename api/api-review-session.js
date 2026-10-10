// api/review-session.js
// GET /api/review-session?user_id=xxx&scope=unit|bagian&scope_id=xxx&limit=20
//
// File ini CUMA orkestrasi HTTP (ambil data dari Supabase, susun respons) --
// logic Review Engine aslinya (tier overdue/weak/recently_wrong/due/
// maintenance, pemilihan exercise berbobot accuracy) ada di
// lib/review-engine.mjs (poin U: pisahkan logic dari file API).
//
// Prioritas kata (dari paling penting): overdue > weak > recently_wrong >
// due > maintenance (poin F). Soal diambil dari POOL YANG SUDAH ADA lewat
// exercise_vocab (variasi tipe otomatis), fallback translate_choice
// on-the-fly kalau 1 kata belum py exercise_vocab sama sekali.
 
import { createClient } from "@supabase/supabase-js";
import {
  rankVocabByPriority,
  buildAccuracyLookup,
  pickBestExerciseForVocab,
  buildFallbackExercise,
} from "../lib/review-engine.mjs";
 
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
 
const MAX_SAME_VOCAB_PER_SESSION = 3; // poin G: maks 2-3 kemunculan/sesi
 
async function getVocabForScope(scope, scopeId) {
  if (scope === "unit") {
    const { data: levels, error } = await supabase.from("levels").select("id").eq("topic_id", scopeId);
    if (error) throw error;
    const levelIds = (levels || []).map((l) => l.id);
    if (levelIds.length === 0) return [];
    const { data: vocab, error: vErr } = await supabase.from("vocab_items").select("*").in("level_id", levelIds);
    if (vErr) throw vErr;
    return vocab || [];
  }
  // scope === "bagian"
  const { data: topics, error: tErr } = await supabase.from("topics").select("id").eq("unit_id", scopeId);
  if (tErr) throw tErr;
  const topicIds = (topics || []).map((t) => t.id);
  if (topicIds.length === 0) return [];
  const { data: levels, error: lErr } = await supabase.from("levels").select("id").in("topic_id", topicIds);
  if (lErr) throw lErr;
  const levelIds = (levels || []).map((l) => l.id);
  if (levelIds.length === 0) return [];
  const { data: vocab, error: vErr } = await supabase.from("vocab_items").select("*").in("level_id", levelIds);
  if (vErr) throw vErr;
  return vocab || [];
}
 
export default async function handler(req, res) {
  const { user_id, scope, scope_id, limit } = req.query;
 
  if (!user_id || !scope || !scope_id) {
    return res.status(400).json({ error: "user_id, scope, dan scope_id wajib diisi" });
  }
  if (scope !== "unit" && scope !== "bagian") {
    return res.status(400).json({ error: "scope harus 'unit' atau 'bagian'" });
  }
 
  const targetWordCount = Math.min(Number(limit) || 20, 40);
 
  try {
    const vocabList = await getVocabForScope(scope, scope_id);
    if (vocabList.length === 0) return res.status(200).json([]);
 
    const vocabIds = vocabList.map((v) => v.id);
    const { data: progressRows, error: progressError } = await supabase
      .from("user_vocab_progress")
      .select("*")
      .eq("user_id", user_id)
      .in("vocab_id", vocabIds);
    if (progressError) throw progressError;
    const progressByVocabId = new Map((progressRows || []).map((p) => [p.vocab_id, p]));
 
    // Poin H: statistik akurasi per tipe soal user ini — dipakai buat milih
    // tipe soal PALING LEMAH duluan.
    const { data: typeStatsRows, error: typeStatsError } = await supabase
      .from("user_exercise_type_stats")
      .select("exercise_type, accuracy")
      .eq("user_id", user_id);
    if (typeStatsError) throw typeStatsError;
    const accuracyForType = buildAccuracyLookup(typeStatsRows);
 
    // Poin F: kategorisasi + urutkan prioritas (Review Engine).
    const nowMs = Date.now();
    const ranked = rankVocabByPriority(vocabList, progressByVocabId, nowMs);
    const selectedVocab = ranked.slice(0, targetWordCount).map((c) => c.vocab);
    if (selectedVocab.length === 0) return res.status(200).json([]);
 
    // Ambil SOAL YANG SUDAH ADA buat kata-kata ini (variasi tipe otomatis).
    const selectedVocabIds = selectedVocab.map((v) => v.id);
    const { data: linkRows, error: linkError } = await supabase
      .from("exercise_vocab")
      .select("vocab_id, exercises(id, type, prompt, content, audio_url)")
      .in("vocab_id", selectedVocabIds);
    if (linkError) throw linkError;
 
    const exercisesByVocabId = new Map();
    for (const row of linkRows || []) {
      if (!row.exercises) continue;
      if (!exercisesByVocabId.has(row.vocab_id)) exercisesByVocabId.set(row.vocab_id, []);
      exercisesByVocabId.get(row.vocab_id).push(row.exercises);
    }
 
    // Susun sesi: tiap kata (urut prioritas) diambil 1 soal, tipe LEMAH +
    // BELUM DIPAKAI baru-baru ini diprioritaskan (poin H+G).
    const usedTypesRecently = [];
    const vocabAppearanceCount = new Map();
    const session = [];
 
    for (const vocab of selectedVocab) {
      const currentCount = vocabAppearanceCount.get(vocab.id) || 0;
      if (currentCount >= MAX_SAME_VOCAB_PER_SESSION) continue;
 
      const candidates = exercisesByVocabId.get(vocab.id) || [];
      const chosen = pickBestExerciseForVocab(candidates, accuracyForType, usedTypesRecently);
 
      const exercise = chosen
        ? { id: chosen.id, type: chosen.type, prompt: chosen.prompt, content: chosen.content, audio_url: chosen.audio_url, vocab_ids: [vocab.id] }
        : buildFallbackExercise(vocab, vocabList);
 
      session.push(exercise);
      usedTypesRecently.push(exercise.type);
      vocabAppearanceCount.set(vocab.id, currentCount + 1);
    }
 
    res.status(200).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
 


















