
Api review session · JS
// api/review-session.js
// GET /api/review-session?user_id=xxx&scope=unit|bagian&scope_id=xxx&limit=20
//
// ============================================================
// REVIEW ENGINE -- sumber kata BUKAN LAGI learnedSoFar.slice(-15) (yang
// cuma "15 kata terakhir dipelajari di kurikulum", sama buat semua orang).
// Sekarang per-USER, berdasar histori jawaban ASLI user itu di
// user_vocab_progress. Prioritas (dari paling penting):
//   1. overdue        -- jatuh tempo review, TELAT lebih dari 24 jam
//   2. weak           -- mastery_score rendah (< 40), kapan pun jadwalnya
//   3. recently_wrong -- jawaban TERAKHIR untuk kata ini salah, dalam 48 jam terakhir
//   4. due            -- jatuh tempo review (termasuk kata yang BELUM PERNAH dilihat)
//   5. maintenance    -- kata yang sudah "mastered", sesekali tetap muncul biar gak lupa
// Kalau 1 kata masuk beberapa kriteria sekaligus (mis. overdue DAN weak),
// dihitung di tier TERTINGGI saja (overdue menang), gak dobel.
//
// Soal yang dikembalikan diambil dari POOL SOAL YANG SUDAH ADA (lewat
// exercise_vocab), bukan bikin baru -- jadi variasi TIPE soal otomatis
// ada (translate_choice, word_order, fill_blank, dst), bukan cuma 1 tipe
// terus-terusan. Kalau 1 kata kebetulan belum py exercise_vocab (konten
// lama sebelum sistem tagging ini ada), fallback bikin soal translate_choice
// sederhana on-the-fly biar kata itu TETAP kepakai buat review.
 
import { createClient } from "@supabase/supabase-js";
 
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
 
const OVERDUE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // >24 jam telat = overdue
const RECENTLY_WRONG_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 jam terakhir
const WEAK_MASTERY_THRESHOLD = 40;
const MAX_SAME_VOCAB_PER_SESSION = 3; // sesuai poin G: maks 2-3 kemunculan/sesi
 
async function getVocabIdsForScope(scope, scopeId) {
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
 
// Tentukan tier (1=overdue ... 5=maintenance, null=gak masuk kriteria apa pun)
function classifyTier(progressRow, nowMs) {
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
  return { tier: null, label: "not_needed" }; // udah bagus & belum due -- gak perlu direview sekarang
}
 
function buildFallbackExercise(vocab, pool) {
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
    const vocabList = await getVocabIdsForScope(scope, scope_id);
    if (vocabList.length === 0) return res.status(200).json([]);
 
    const vocabIds = vocabList.map((v) => v.id);
    const { data: progressRows, error: progressError } = await supabase
      .from("user_vocab_progress")
      .select("*")
      .eq("user_id", user_id)
      .in("vocab_id", vocabIds);
    if (progressError) throw progressError;
    const progressByVocabId = new Map((progressRows || []).map((p) => [p.vocab_id, p]));
 
    const nowMs = Date.now();
 
    // Poin H: ambil statistik akurasi per tipe soal user ini. Dipakai buat
    // milih tipe soal yang PALING LEMAH duluan (bukan cuma random/rotasi),
    // pas ada beberapa pilihan tipe buat 1 kata yang sama.
    const { data: typeStatsRows, error: typeStatsError } = await supabase
      .from("user_exercise_type_stats")
      .select("exercise_type, accuracy")
      .eq("user_id", user_id);
    if (typeStatsError) throw typeStatsError;
    const accuracyByType = new Map((typeStatsRows || []).map((t) => [t.exercise_type, Number(t.accuracy)]));
    // Tipe yang BELUM PERNAH dicoba user ini dianggap prioritas sedang
    // (bukan 0/tertinggi, biar gak selalu dipaksa nyoba tipe baru terus;
    // bukan juga 100/terendah, biar tetap kebagian giliran dicoba).
    const accuracyForType = (type) => accuracyByType.has(type) ? accuracyByType.get(type) : 50;
 
    // 1. Klasifikasi tiap kata ke tier, buang yang gak butuh direview sama sekali.
    const classified = vocabList
      .map((v) => ({ vocab: v, ...classifyTier(progressByVocabId.get(v.id), nowMs) }))
      .filter((c) => c.tier !== null);
 
    // 2. Urutkan: tier makin kecil makin prioritas, dalam 1 tier yang sama
    //    urutkan mastery_score makin rendah makin depan (lebih butuh direview).
    classified.sort((a, b) => {
      if (a.tier !== b.tier) return a.tier - b.tier;
      const ma = progressByVocabId.get(a.vocab.id)?.mastery_score ?? 0;
      const mb = progressByVocabId.get(b.vocab.id)?.mastery_score ?? 0;
      return ma - mb;
    });
 
    const selectedVocab = classified.slice(0, targetWordCount).map((c) => c.vocab);
    if (selectedVocab.length === 0) return res.status(200).json([]);
 
    // 3. Ambil SOAL YANG SUDAH ADA buat kata-kata ini (lewat exercise_vocab),
    //    biar variasi tipe soal otomatis kepakai, bukan bikin 1 tipe monoton.
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
 
    // 4. Susun sesi: tiap kata (urut prioritas) diambil 1 soal, PILIH TIPE
    //    YANG BELUM DIPAKAI DULU (variasi), maks MAX_SAME_VOCAB_PER_SESSION
    //    kemunculan per kata dalam 1 sesi ini.
    const usedTypesRecently = [];
    const vocabAppearanceCount = new Map();
    const session = [];
 
    for (const vocab of selectedVocab) {
      const currentCount = vocabAppearanceCount.get(vocab.id) || 0;
      if (currentCount >= MAX_SAME_VOCAB_PER_SESSION) continue;
 
      const candidates = exercisesByVocabId.get(vocab.id) || [];
      // Urutkan kandidat: tipe dengan akurasi PALING RENDAH duluan (poin H —
      // "kasih lebih banyak exercise type yang lemah"). Di antara tipe-tipe
      // yang akurasinya mirip, hindari dulu yang baru dipakai 1-3 soal
      // terakhir (biar gak berturut-turut sama), tapi ini kalah prioritas
      // dari soal kelemahan tipe.
      const sortedCandidates = [...candidates].sort((a, b) => {
        const accA = accuracyForType(a.type);
        const accB = accuracyForType(b.type);
        if (accA !== accB) return accA - accB;
        const aRecent = usedTypesRecently.slice(-3).includes(a.type) ? 1 : 0;
        const bRecent = usedTypesRecently.slice(-3).includes(b.type) ? 1 : 0;
        return aRecent - bRecent;
      });
      const chosen = sortedCandidates[0];
 
      const exercise = chosen
        ? { id: chosen.id, type: chosen.type, prompt: chosen.prompt, content: chosen.content, audio_url: chosen.audio_url, vocab_ids: [vocab.id] }
        : buildFallbackExercise(vocab, vocabList); // gak ada exercise_vocab sama sekali -- fallback
 
      session.push(exercise);
      usedTypesRecently.push(exercise.type);
      vocabAppearanceCount.set(vocab.id, currentCount + 1);
    }
 
    res.status(200).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
 


















