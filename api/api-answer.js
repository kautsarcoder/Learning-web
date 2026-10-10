// api/answer.js
// POST /api/answer
// Body: {
//   user_id, exercise_id, exercise_type,
//   answer, response_time_ms,
//   is_correct, severity,       // fallback kalau `results` gak dikasih
//   vocab_ids: [uuid,...],
//   results?: [{ vocab_id, is_correct, severity? }]  // OPSIONAL, buat exercise multi-kata
// }
//
// File ini CUMA orkestrasi HTTP (parsing body, respons) -- logic aslinya
// (spaced repetition, mastery, stats per tipe soal) ada di
// lib/learning-enginer.mjs (poin U: pisahkan logic dari file API/script).
 
import { createClient } from "@supabase/supabase-js";
import { updateVocabProgress, updateExerciseTypeStats, logAnswer } from "../lib/learning-engine.mjs";
 
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
 
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
 
  const { user_id, exercise_id, exercise_type, answer, response_time_ms, is_correct, severity, vocab_ids, results } = req.body;
 
  if (!user_id || !exercise_id) {
    return res.status(400).json({ error: "user_id dan exercise_id wajib diisi" });
  }
 
  try {
    // Poin H: update statistik per TIPE SOAL — 1x per submit (bukan per
    // vocab_id), karena ini soal performa di tipe soalnya, bukan per kata.
    await updateExerciseTypeStats(supabase, user_id, exercise_type, is_correct);
 
    // Tentukan hasil per vocab_id: pakai `results` kalau dikasih (lebih
    // akurat buat exercise multi-kata), fallback ke is_correct/severity
    // yang sama buat semua vocab_ids.
    const perVocabResults = results && results.length > 0
      ? results
      : (vocab_ids || []).map((vid) => ({ vocab_id: vid, is_correct, severity }));
 
    for (const r of perVocabResults) {
      await logAnswer(supabase, {
        userId: user_id, exerciseId: exercise_id, vocabId: r.vocab_id,
        isCorrect: r.is_correct, answer, responseTimeMs: response_time_ms,
      });
      await updateVocabProgress(supabase, user_id, r.vocab_id, r.is_correct, r.severity);
    }
 
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
 


















