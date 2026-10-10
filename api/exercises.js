// api/exercises.js
// GET /api/exercises?level_id=xxx                                -> semua segmen (dipakai untuk hitung exercise_count)
// GET /api/exercises?level_id=xxx&segment_number=1                -> cuma 1 segmen (dipakai saat user main 1 sesi soal)
// GET /api/exercises?level_id=xxx&segment_number=1&user_id=yyy    -> sama seperti di atas, TAPI tiap soal ikut
//                                                                     bawa field "answered" (lihat catatan di bawah)
//
// Tiap soal SEKARANG ikut bawa vocab_ids (array uuid vocab_items yang diuji
// soal itu, dari tabel exercise_vocab) -- ini dipakai frontend buat kirim
// balik ke /api/answer pas user jawab, biar progress per-kata bisa dicatat.
//
// Field "answered" (BARU, cuma muncul kalau query ?user_id= dikasih):
// true/false per soal, dihitung dari answer_log (exercise_id + user_id) --
// BUKAN dari order_index. Alasannya: generate-vocab-v2.mjs bisa menyisipkan
// soal BARU di depan urutan 1 segmen (kosakata baru "menyalip" ke depan
// lesson yang sudah ada -- lihat komentar "Poin L" di saveLevelContent),
// yang berarti order_index soal-soal LAMA bergeser ke belakang. exercise_id
// tiap soal TIDAK PERNAH berubah walau order_index-nya digeser, jadi
// "answered" yang dihitung dari exercise_id ini tetap akurat apa pun yang
// terjadi pada urutannya -- frontend TIDAK PERLU (dan sebaiknya tidak)
// lagi menyimpan "sudah sampai soal ke berapa" sebagai angka index; cukup
// resume dari soal pertama yang answered === false dalam array hasil
// endpoint ini (array-nya sendiri tetap terurut segment_number -> order_index
// seperti sebelumnya).
//
// user_id di query ini CUMA dipakai buat BACA answer_log (read-only) --
// gak ada tulis apa pun di endpoint ini, tetap murni GET.
 
import { createClient } from "@supabase/supabase-js";
 
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
 
export default async function handler(req, res) {
  const { level_id, segment_number, user_id } = req.query;
 
  if (!level_id) {
    return res.status(400).json({ error: "level_id wajib diisi" });
  }
 
  try {
    // "exercise_vocab(vocab_id)" -- embedded select PostgREST/Supabase:
    // untuk tiap baris exercises, ikut diambil semua baris exercise_vocab
    // yang exercise_id-nya cocok. Hasilnya muncul sebagai
    // row.exercise_vocab = [{ vocab_id: "..." }, ...].
    let query = supabase
      .from("exercises")
      .select("*, exercise_vocab(vocab_id)")
      .eq("level_id", level_id)
      .order("segment_number")
      .order("order_index");
 
    if (segment_number) {
      query = query.eq("segment_number", segment_number);
    }
 
    const { data, error } = await query;
    if (error) throw error;
 
    // Ratakan exercise_vocab jadi array vocab_ids biasa, biar frontend
    // gampang pakainya (gak perlu tau struktur join di baliknya).
    const flattened = (data || []).map((row) => ({
      ...row,
      vocab_ids: (row.exercise_vocab || []).map((ev) => ev.vocab_id),
      exercise_vocab: undefined,
    }));
 
    // Kalau user_id dikasih, tambahin status "answered" per soal --
    // dihitung dari answer_log, di-scope ke exercise_id yang memang ada
    // di hasil query ini (bukan ke SEMUA jawaban user ini sepanjang masa).
    if (user_id && flattened.length > 0) {
      const exerciseIds = flattened.map((ex) => ex.id);
      const { data: answeredRows, error: answerError } = await supabase
        .from("answer_log")
        .select("exercise_id")
        .eq("user_id", user_id)
        .in("exercise_id", exerciseIds);
      if (answerError) throw answerError;
 
      const answeredIds = new Set((answeredRows || []).map((r) => r.exercise_id));
      for (const ex of flattened) {
        ex.answered = answeredIds.has(ex.id);
      }
    }
 
    res.status(200).json(flattened);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
 

















