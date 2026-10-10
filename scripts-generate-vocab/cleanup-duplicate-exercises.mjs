// scripts/cleanup-duplicate-exercises.mjs
//
// Jalankan manual, terpisah dari generate-vocab-v2.mjs:
//   node scripts-generate-vocab/cleanup-duplicate-exercises.mjs
//   node scripts-generate-vocab/cleanup-duplicate-exercises.mjs --commit
//
// Tujuan: bersihkan soal yang MIRIP/DOBEL di 1 level yang sama (biasanya
// kejadian di level yang sudah "lengkap" dari SEBELUM perbaikan avoidList —
// generate-vocab-v2.mjs otomatis MELEWATI level yang sudah lengkap, jadi
// duplikat lama di situ tidak pernah ke-bersihkan sendiri).
//
// Cara kerja: per level, bandingkan kunci ringkasan tiap soal (kata/kalimat
// utamanya, huruf besar-kecil diabaikan). Soal dengan kunci yang SAMA
// dianggap duplikat — yang PALING PERTAMA dibuat (created_at paling awal)
// DIPERTAHANKAN, sisanya DIHAPUS. Setelah dihapus, jalankan lagi
// generate-vocab-v2.mjs seperti biasa — segmen yang jadi kurang dari 8 soal
// otomatis di-top-up dengan soal baru (yang sudah tidak akan mirip lagi,
// berkat perbaikan avoidList kemarin).
//
// Default: mode PREVIEW saja (cuma nampilin apa yang AKAN dihapus, belum
// beneran dihapus). Tambahkan --commit kalau sudah yakin.

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { createClient } from "@supabase/supabase-js";
import fs from "fs";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("\n❌ SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum kebaca dari .env.local.\n");
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Sama persis dengan yang dipakai generate-vocab-v2.mjs, supaya konsisten
// dalam menentukan "identitas" 1 soal — termasuk membersihkan imbuhan kecil
// seperti huruf sambung "و" (dan) yang nempel di depan kata, supaya "أنا"
// dan "وأنا" dianggap soal yang SAMA (bukan soal baru yang beda).
function normalizeArabicKey(text) {
  return String(text)
    .normalize("NFC")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/^[\s،.!؟?]*[وف](?=[ابتثجحخدذرزسشصضطظعغفقكلمنهوي])/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function summarizeExercise(ex) {
  const c = ex.content || {};
  const key = c.promptText || c.text || c.latin || c.passageLatin ||
    (c.bubbleLines?.[0]?.latin) || (c.dialogueLines?.[0]?.latin) ||
    (c.pairs?.map((p) => p.left).join(", ")) || "(?)";
  return `${ex.type}: ${normalizeArabicKey(key)}`;
}

async function getAllLevelIds() {
  const { data, error } = await supabase.from("levels").select("id");
  if (error) throw error;
  return (data || []).map((l) => l.id);
}

async function findDuplicatesForLevel(levelId) {
  const { data, error } = await supabase
    .from("exercises")
    .select("id, type, content, created_at")
    .eq("level_id", levelId)
    .order("created_at", { ascending: true }); // paling lama duluan = dipertahankan
  if (error) throw error;

  const seen = new Map(); // key -> id yang dipertahankan
  const toDelete = [];

  for (const ex of data || []) {
    const key = summarizeExercise(ex);
    if (seen.has(key)) {
      toDelete.push({ id: ex.id, key, keptId: seen.get(key) });
    } else {
      seen.set(key, ex.id);
    }
  }
  return toDelete;
}

async function main() {
  const commit = process.argv.includes("--commit");

  console.log("Memindai semua level untuk soal duplikat...\n");
  const levelIds = await getAllLevelIds();

  let totalDuplicates = 0;
  const report = [];

  for (const levelId of levelIds) {
    const duplicates = await findDuplicatesForLevel(levelId);
    if (duplicates.length === 0) continue;

    totalDuplicates += duplicates.length;
    report.push({ levelId, count: duplicates.length, samples: duplicates.slice(0, 3).map((d) => d.key) });

    console.log(`Level ${levelId}: ${duplicates.length} soal duplikat ditemukan.`);
    duplicates.slice(0, 3).forEach((d) => console.log(`   - "${d.key}"`));
    if (duplicates.length > 3) console.log(`   ...dan ${duplicates.length - 3} lainnya`);

    if (commit) {
      const idsToDelete = duplicates.map((d) => d.id);
      const { error } = await supabase.from("exercises").delete().in("id", idsToDelete);
      if (error) {
        console.error(`   ❌ Gagal hapus duplikat di level ${levelId}:`, error.message);
      } else {
        console.log(`   ✅ ${idsToDelete.length} soal duplikat dihapus.`);
      }
    }
  }

  fs.writeFileSync("cleanup-report.json", JSON.stringify(report, null, 2));

  console.log(`\nTotal soal duplikat ditemukan: ${totalDuplicates} (di ${report.length} level).`);
  console.log("Detail lengkap disimpan ke cleanup-report.json.");

  if (!commit) {
    console.log(
      "\nMode preview — belum ada yang dihapus. Cek dulu cleanup-report.json, " +
      "kalau sudah yakin jalankan lagi dengan --commit."
    );
  } else {
    console.log(
      "\nSelesai menghapus. Sekarang jalankan lagi generate-vocab-v2.mjs --commit " +
      "seperti biasa — segmen yang jadi kurang dari 8 soal otomatis di-top-up."
    );
  }
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exit(1);
});
