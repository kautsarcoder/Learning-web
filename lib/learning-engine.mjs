// lib/learning-enginer.mjs
//
// Domain: APA YANG TERJADI SETELAH USER MENJAWAB 1 SOAL.
// - Update mastery_score, correct/wrong streak per kata (user_vocab_progress)
// - Hitung jadwal review berikutnya — DETERMINISTIK, BUKAN AI (lihat poin E)
// - Update statistik performa per tipe soal (poin H)
//
// Semua fungsi di sini nerima `supabase` sebagai parameter (bukan bikin
// client sendiri) — modul ini gak peduli siapa yang manggil (api/answer.js
// sekarang, atau endpoint lain nanti), tinggal dikasih client yang sudah jadi.

const MINUTE = 60 * 1000;

const NEW_INTERVAL_MINUTES = 10;
const CORRECT_STREAK_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120]; // index 0 = Correct #1
const MIN_INTERVAL_MINUTES = 10;
const WRONG_MAJOR_MULTIPLIER = 0.25;
const WRONG_MINOR_MULTIPLIER = 0.6; // penalti lebih ringan buat salah "minor"

function intervalMinutesForCorrectStreak(streak) {
  const idx = Math.min(streak, CORRECT_STREAK_INTERVAL_DAYS.length) - 1;
  const days = CORRECT_STREAK_INTERVAL_DAYS[idx];
  return days * 24 * 60;
}

function computeVocabStatus(row) {
  if (row.times_seen <= 1) return "new";
  if (row.mastery_score >= 85 && row.correct_streak >= 3) return "mastered";
  if (row.mastery_score >= 40) return "review";
  return "learning";
}

// Poin E: SPACED REPETITION deterministik. Update 1 baris user_vocab_progress
// (1 kata, 1 user) berdasar benar/salah jawaban barusan.
export async function updateVocabProgress(supabase, userId, vocabId, isCorrect, severity) {
  const { data: existing } = await supabase
    .from("user_vocab_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("vocab_id", vocabId)
    .maybeSingle();

  const now = new Date();
  const row = existing || {
    times_seen: 0, times_correct: 0, times_wrong: 0,
    correct_streak: 0, wrong_streak: 0, mastery_score: 0,
    current_interval_minutes: NEW_INTERVAL_MINUTES,
  };

  const wasNeverReviewed = row.times_seen === 0;
  row.times_seen += 1;

  let newIntervalMinutes;

  if (isCorrect) {
    row.times_correct += 1;
    row.correct_streak += 1;
    row.wrong_streak = 0;
    row.last_correct_at = now.toISOString();
    row.mastery_score = Math.min(100, row.mastery_score + 12);

    newIntervalMinutes = wasNeverReviewed
      ? NEW_INTERVAL_MINUTES
      : intervalMinutesForCorrectStreak(row.correct_streak);
  } else {
    row.times_wrong += 1;
    row.wrong_streak += 1;
    row.correct_streak = 0;
    row.last_wrong_at = now.toISOString();

    const isMinor = severity === "minor";
    row.mastery_score = Math.max(0, row.mastery_score - (isMinor ? 8 : 18));

    const currentInterval = row.current_interval_minutes || NEW_INTERVAL_MINUTES;
    const multiplier = isMinor ? WRONG_MINOR_MULTIPLIER : WRONG_MAJOR_MULTIPLIER;
    newIntervalMinutes = Math.max(MIN_INTERVAL_MINUTES, currentInterval * multiplier);
  }

  row.current_interval_minutes = newIntervalMinutes;
  row.last_seen_at = now.toISOString();
  row.status = computeVocabStatus(row);
  row.next_review_at = new Date(now.getTime() + newIntervalMinutes * MINUTE).toISOString();

  const { error } = await supabase.from("user_vocab_progress").upsert({
    user_id: userId, vocab_id: vocabId, ...row,
  });
  if (error) throw error;
}

// Poin H: tracking performa PER TIPE SOAL — simpel, cuma attempts/correct/
// wrong/accuracy, gak ada logic tambahan (sesuai arahan "jangan kompleks").
export async function updateExerciseTypeStats(supabase, userId, exerciseType, isCorrect) {
  if (!exerciseType) return;
  const { data: existing } = await supabase
    .from("user_exercise_type_stats")
    .select("*")
    .eq("user_id", userId)
    .eq("exercise_type", exerciseType)
    .maybeSingle();

  const row = existing || { attempts: 0, correct: 0, wrong: 0 };
  row.attempts += 1;
  if (isCorrect) row.correct += 1; else row.wrong += 1;
  row.accuracy = row.attempts > 0 ? Math.round((row.correct / row.attempts) * 1000) / 10 : 0;

  const { error } = await supabase.from("user_exercise_type_stats").upsert({
    user_id: userId, exercise_type: exerciseType, ...row,
  });
  if (error) throw error;
}

// Poin D: catat 1 baris answer_log — history mentah, gak pernah dihapus (poin N).
export async function logAnswer(supabase, { userId, exerciseId, vocabId, isCorrect, answer, responseTimeMs }) {
  const { error } = await supabase.from("answer_log").insert({
    user_id: userId, exercise_id: exerciseId, vocab_id: vocabId,
    is_correct: isCorrect, answer, response_time_ms: responseTimeMs,
  });
  if (error) throw error;
}
