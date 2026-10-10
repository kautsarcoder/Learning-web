// lib/review-engine.mjs
//
// Domain: APA YANG DITAMPILKAN KE USER SAAT SESI REVIEW/PRACTICE.
// - Kategorisasi kata: overdue/weak/recently_wrong/due/maintenance (poin F)
// - Pemilihan exercise dari pool yang sudah ada, dengan variasi tipe,
//   dibobotin ke tipe yang lemah (poin H)
// - Batas kemunculan per kata per sesi (poin G, bagian server-side)
//
// Semua fungsi nerima `supabase` sebagai parameter — modul ini gak bikin
// client sendiri, dipakai bareng oleh api/review-session.js dan
// api/adaptive-exercise.js.

const OVERDUE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // >24 jam telat = overdue
const RECENTLY_WRONG_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 jam terakhir
const WEAK_MASTERY_THRESHOLD = 40;

// Poin F: tentukan tier 1 kata (1=overdue paling prioritas ... 5=maintenance,
// null=gak masuk kriteria apa pun, gak perlu direview sekarang).
export function classifyReviewTier(progressRow, nowMs) {
  if (!progressRow) return { tier: 4, label: "due" }; // belum pernah dilihat = due
  const p = progressRow;
  const nextReviewMs = new Date(p.next_review_at).getTime();
  const lastWrongMs = p.last_wrong_at ? new Date(p.last_wrong_at).getTime() : null;
  const lastCorrectMs = p.last_correct_at ? new Date(p.last_correct_at).getTime() : null;

  const isOverdue = nextReviewMs < nowMs - OVERDUE_THRESHOLD_MS;
  const isWeak = Number(p.mastery_score) < WEAK_MASTERY_THRESHOLD;
  const isRecentlyWrong =
    lastWrongMs && (nowMs - lastWrongMs) < RECENTLY_WRONG_WINDOW_MS &&
    (!lastCorrectMs || lastWrongMs > lastCorrectMs);
  const isDue = nextReviewMs <= nowMs;
  const isMaintenance = p.status === "mastered";

  if (isOverdue) return { tier: 1, label: "overdue" };
  if (isWeak) return { tier: 2, label: "weak" };
  if (isRecentlyWrong) return { tier: 3, label: "recently_wrong" };
  if (isDue) return { tier: 4, label: "due" };
  if (isMaintenance) return { tier: 5, label: "maintenance" };
  return { tier: null, label: "not_needed" };
}

// Urutkan daftar vocab berdasar prioritas Review Engine: tier makin kecil
// makin depan, dalam 1 tier yang sama mastery_score makin rendah makin depan.
export function rankVocabByPriority(vocabList, progressByVocabId, nowMs) {
  const classified = vocabList
    .map((v) => ({ vocab: v, ...classifyReviewTier(progressByVocabId.get(v.id), nowMs) }))
    .filter((c) => c.tier !== null);

  classified.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const ma = progressByVocabId.get(a.vocab.id)?.mastery_score ?? 0;
    const mb = progressByVocabId.get(b.vocab.id)?.mastery_score ?? 0;
    return ma - mb;
  });

  return classified;
}

// Poin H: bobot pemilihan tipe soal — tipe dengan accuracy RENDAH (user
// lemah di situ) diprioritaskan duluan. Tipe yang belum pernah dicoba
// dianggap skor netral (50), gak dianakemaskan/dianaktirikan.
export function buildAccuracyLookup(exerciseTypeStatsRows) {
  const byType = new Map((exerciseTypeStatsRows || []).map((s) => [s.exercise_type, Number(s.accuracy)]));
  return (type) => (byType.has(type) ? byType.get(type) : 50);
}

// Pilih 1 exercise dari kandidat buat 1 kata — utamakan tipe yang LEMAH
// (accuracy rendah) dan yang BELUM dipakai baru-baru ini di sesi ini
// (poin G: variasi tipe). Kandidat kosong -> null (biar caller fallback).
export function pickBestExerciseForVocab(candidates, accuracyForType, usedTypesRecently) {
  if (!candidates || candidates.length === 0) return null;
  const scored = candidates.map((ex) => ({
    ex,
    accuracy: accuracyForType(ex.type),
    isRecent: usedTypesRecently.slice(-3).includes(ex.type),
  }));
  scored.sort((a, b) => {
    if (a.isRecent !== b.isRecent) return a.isRecent ? 1 : -1; // yang BUKAN dipakai baru-baru ini menang
    return a.accuracy - b.accuracy; // makin lemah makin diprioritaskan
  });
  return scored[0].ex;
}

// Fallback: bikin soal translate_choice sederhana kalau 1 kata gak punya
// exercise_vocab sama sekali (konten lama sebelum sistem tagging ada).
export function buildFallbackExercise(vocab, pool) {
  const distractors = pool.filter((p) => p.id !== vocab.id).sort(() => Math.random() - 0.5).slice(0, 2);
  const options = [{ text: vocab.arti }, ...distractors.map((d) => ({ text: d.arti }))].sort(() => Math.random() - 0.5);
  const correctIndex = options.findIndex((o) => o.text === vocab.arti);
  return {
    id: `fallback-${vocab.id}`,
    type: "translate_choice",
    prompt: "Pilih arti yang benar",
    content: { promptText: `${vocab.kata_arab}${vocab.latin ? ` (${vocab.latin})` : ""}`, options, correctIndex },
    audio_url: vocab.audio_url || null,
    vocab_ids: [vocab.id],
  };
}
