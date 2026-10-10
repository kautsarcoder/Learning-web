// scripts-generate-vocab/fix-existing-answer-positions.mjs
//
// Acak ulang posisi jawaban benar (correctIndex) buat soal YANG SUDAH ADA
// di database — TANPA manggil AI sama sekali (murni operasi lokal, gratis
// & cepat). Dipakai sekali buat benerin soal-soal lama yang jawabannya
// selalu nemplok di pilihan A (dibuat sebelum shuffleAnswerPositions ada
// di generate-vocab-v2.mjs).
//
// Command:
//   node scripts-generate-vocab/fix-existing-answer-positions.mjs           (preview)
//   node scripts-generate-vocab/fix-existing-answer-positions.mjs --commit  (terapkan)

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { shuffleAnswerPositions } from "../lib/exercise-validator.js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE_SIZE = 1000;

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

async function main() {
  const commit = process.argv.includes("--commit");

  console.log("Mengambil semua exercise yang punya correctIndex (pilihan ganda)...");
  const allExercises = await fetchAllPaginated(() =>
    supabase.from("exercises").select("id, content")
  );
  const multipleChoice = allExercises.filter((e) => e.content && typeof e.content.correctIndex === "number" && Array.isArray(e.content.options));
  console.log(`Ditemukan ${multipleChoice.length} soal pilihan ganda dari total ${allExercises.length} exercise.`);

  const stuckAtA = multipleChoice.filter((e) => e.content.correctIndex === 0);
  console.log(`${stuckAtA.length} di antaranya jawabannya SEKARANG ada di posisi A (correctIndex=0).\n`);

  if (!commit) {
    console.log("Mode preview — TIDAK ADA yang ditulis ke database. Tambahkan --commit buat menerapkan.");
    console.log("(Catatan: yang di-acak ulang SEMUA soal pilihan ganda, bukan cuma yang kebetulan di A sekarang —");
    console.log(" biar distribusinya beneran acak merata, bukan cuma \"yang di A dipindah, yang lain dibiarkan\".)");
    return;
  }

  console.log("--commit terdeteksi, mengacak ulang & menyimpan...");
  let done = 0;
  for (const ex of multipleChoice) {
    const [shuffled] = shuffleAnswerPositions([{ content: ex.content }]);
    const { error } = await supabase.from("exercises").update({ content: shuffled.content }).eq("id", ex.id);
    if (error) { console.warn(`  ⚠ Gagal update exercise ${ex.id}:`, error.message); continue; }
    done++;
    if (done % 500 === 0) console.log(`  ...${done}/${multipleChoice.length} selesai`);
  }
  console.log(`\n✓ Selesai. ${done} soal pilihan ganda sudah diacak ulang posisi jawabannya.`);
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exit(1);
});
