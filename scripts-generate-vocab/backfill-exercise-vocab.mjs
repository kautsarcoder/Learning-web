// scripts-generate-vocab/backfill-exercise-vocab.mjs
//
// MASALAH: 9514 exercise statis, 0 yang ke-link ke exercise_vocab (soal-soal
// ini dibuat SEBELUM fitur tagging exercise_vocab ada). Akibatnya
// migrate-bagian-assignment.mjs gak bisa tau kata mana yang "sudah ada
// exercise" — semua kata keliatan "aman dipindah" padahal belum tentu.
//
// PENDEKATAN: KONSERVATIF, bukan presisi. Daripada coba nebak-nebak kata
// SPESIFIK mana yang diuji tiap soal (perlu parsing isi content, rawan
// salah), tiap exercise statis di-link ke SEMUA vocab_items yang ada di
// level yang sama. Ini over-linking yang DISENGAJA — efeknya, migration
// script jadi lebih hati-hati (kata yang levelnya punya soal apa pun akan
// dianggap "ada exercise", gak dipindah otomatis) — lebih baik "kelewat
// hati-hati" daripada "kelewat berani mindahin kata yang sebenarnya sudah
// diuji soal".
//
// Idempotent: exercise yang SUDAH punya baris exercise_vocab (dari proses
// normal generate-vocab-v2.mjs yang baru, atau backfill sebelumnya) di-skip,
// gak di-link ulang/dobel.
//
// PENTING: Supabase/PostgREST BATASI hasil query maks 1000 baris per
// request SECARA DEFAULT — walau .in() cuma dikasih sedikit ID, kalau baris
// yang COCOK lebih dari 1000, sisanya diam-diam KEPOTONG tanpa error. Ini
// beda dari masalah "URL kepanjangan" (yang diatasi chunking .in()) — di
// sini perlu PAGINATION (.range()) buat mastiin semua baris kebaca, gak
// cuma 1000 pertama.
//
// Command:
//   node scripts-generate-vocab/backfill-exercise-vocab.mjs           (preview)
//   node scripts-generate-vocab/backfill-exercise-vocab.mjs --commit  (terapkan)

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const IN_CHUNK_SIZE = 150; // batas jumlah ID per .in() — jaga URL gak kepanjangan
const PAGE_SIZE = 1000;    // batas default Supabase per response — perlu di-loop kalau lebih

// Ambil SEMUA baris yang cocok filter tertentu, gak peduli berapa banyak —
// loop pakai .range() sampai halaman yang balik lebih pendek dari PAGE_SIZE
// (tandanya itu halaman terakhir).
async function fetchAllPaginated(buildQuery) {
  const allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allRows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

// Gabungan CHUNKING (biar .in() gak bikin URL kepanjangan) + PAGINATION
// (biar hasil per chunk gak kepotong diam-diam di 1000 baris). 2 masalah
// beda, 2 solusi beda, digabung di 1 helper biar gak lupa salah satu.
async function selectInChunksPaginated(table, selectCols, filterCol, filterValues, extraFilterFn) {
  if (filterValues.length === 0) return [];
  const results = [];
  for (let i = 0; i < filterValues.length; i += IN_CHUNK_SIZE) {
    const chunk = filterValues.slice(i, i + IN_CHUNK_SIZE);
    const rows = await fetchAllPaginated(() => {
      let q = supabase.from(table).select(selectCols).in(filterCol, chunk);
      if (extraFilterFn) q = extraFilterFn(q);
      return q;
    });
    results.push(...rows);
  }
  return results;
}

async function main() {
  const commit = process.argv.includes("--commit");

  console.log("Mengambil semua exercise statis (is_adaptive=false)...");
  const exercises = await fetchAllPaginated(() =>
    supabase.from("exercises").select("id, level_id").eq("is_adaptive", false)
  );
  console.log(`Ditemukan ${exercises.length} exercise statis.`);

  console.log("Mengecek exercise yang SUDAH punya exercise_vocab (biar idempotent)...");
  const alreadyLinkedRows = await selectInChunksPaginated("exercise_vocab", "exercise_id", "exercise_id", exercises.map((e) => e.id));
  const alreadyLinkedSet = new Set(alreadyLinkedRows.map((r) => r.exercise_id));
  const needsLinking = exercises.filter((e) => !alreadyLinkedSet.has(e.id));
  console.log(`${exercises.length - needsLinking.length} sudah ke-link sebelumnya (dilewati), ${needsLinking.length} perlu di-backfill.\n`);

  if (needsLinking.length === 0) {
    console.log("Gak ada yang perlu di-backfill. Selesai.");
    return;
  }

  console.log("Mengambil vocab_items per level yang terdampak...");
  const affectedLevelIds = [...new Set(needsLinking.map((e) => e.level_id))];
  const vocabItems = await selectInChunksPaginated("vocab_items", "id, level_id", "level_id", affectedLevelIds);
  const vocabIdsByLevelId = new Map();
  for (const v of vocabItems) {
    if (!vocabIdsByLevelId.has(v.level_id)) vocabIdsByLevelId.set(v.level_id, []);
    vocabIdsByLevelId.get(v.level_id).push(v.id);
  }

  let totalLinksToCreate = 0;
  let exercisesWithNoVocabInLevel = 0;
  for (const ex of needsLinking) {
    const vocabIds = vocabIdsByLevelId.get(ex.level_id) || [];
    if (vocabIds.length === 0) exercisesWithNoVocabInLevel++;
    totalLinksToCreate += vocabIds.length;
  }

  console.log(`Rencana: ${needsLinking.length} exercise akan di-link ke total ~${totalLinksToCreate} baris exercise_vocab`);
  console.log(`(rata-rata ${(totalLinksToCreate / needsLinking.length).toFixed(1)} kata per exercise, dari vocab_items di level yang sama)`);
  if (exercisesWithNoVocabInLevel > 0) {
    console.log(`⚠ ${exercisesWithNoVocabInLevel} exercise levelnya gak punya vocab_items sama sekali — dilewati, gak ada yang bisa di-link.`);
  }

  if (!commit) {
    console.log("\nMode preview — TIDAK ADA yang ditulis ke database. Tambahkan --commit buat menerapkan.");
    return;
  }

  console.log("\n--commit terdeteksi, menulis exercise_vocab...");
  let done = 0;
  for (const ex of needsLinking) {
    const vocabIds = vocabIdsByLevelId.get(ex.level_id) || [];
    if (vocabIds.length === 0) continue;
    const rows = vocabIds.map((vocabId) => ({ exercise_id: ex.id, vocab_id: vocabId }));
    const { error } = await supabase.from("exercise_vocab").insert(rows);
    if (error && error.code !== "23505") throw error;
    done++;
    if (done % 200 === 0) console.log(`  ...${done}/${needsLinking.length} exercise selesai di-link`);
  }
  console.log(`\n✓ Selesai. ${done} exercise sudah di-link ke exercise_vocab.`);
  console.log("Sekarang jalankan ulang migrate-bagian-assignment.mjs — pengecekan 'sudah ada exercise' bakal akurat.");
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exit(1);
});
