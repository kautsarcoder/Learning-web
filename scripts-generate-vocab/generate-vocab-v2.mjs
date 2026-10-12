// scripts/generate-vocab-v2.js
//
// CSV kamu sekarang CUKUP 4 kolom: kata_arab, latin, arti, contoh_kalimat
// (lihat template-kosakata-ammiyah.csv yang sudah disederhanakan). Kamu
// TIDAK perlu isi bagian/unit/level_number lagi.
//
// Jalankan manual:
//   node scripts/generate-vocab-v2.js --csv kosakata-ammiyah.csv
//   node scripts/generate-vocab-v2.js --csv kosakata-ammiyah.csv --commit
//   node scripts/generate-vocab-v2.js --csv kosakata-ammiyah.csv --commit --audio
//
// ============================================================
// KENAPA DESAINNYA BEGINI (penting dibaca kalau mau ubah nanti)
// ============================================================
// [REVISI: 100 topik, 1 topik = 1 slot Bagian+Unit TETAP, gak berulang
// lintas-Bagian lagi — lihat lib/curriculum-engine.mjs untuk struktur
// CURRICULUM (10 domain x 10 topik). Pengulangan MATERI LAMA sekarang
// ditangani terpisah lewat mekanisme "sisip review lintas-unit" otomatis
// di api/adaptive-exercise.js (berbasis mastery_score/next_review_at
// user via Review Engine, BUKAN lewat pengulangan topik di sini).]
//
// AI TIDAK diminta langsung menebak angka Bagian/Unit/Level — itu riskan
// (gampang salah, bisa di luar rentang, bisa bikin distribusi nggak
// rata). Sebagai gantinya:
//
//   1. AI HANYA mengklasifikasi tiap kata ke SALAH SATU dari 100 nama
//      topik yang SUDAH DITENTUKAN (TOPIC_NAMES, dari CURRICULUM di
//      curriculum-engine.js). Ini pilihan tertutup (closed-set) — jauh
//      lebih gampang divalidasi daripada AI bebas nentuin struktur.
//      (Field "difficulty" SUDAH DIHAPUS dari klasifikasi — gak ada
//      gunanya lagi karena 1 topik = 1 slot Bagian+Unit tetap, gak perlu
//      lagi nentuin "topik ini muncul di Bagian mana" berdasar kesulitan.)
//   2. SCRIPT yang menerjemahkan topic_name jadi (bagian, unit) secara
//      deterministik lewat LOOKUP LANGSUNG (computeBagianNumber /
//      computeUnitNumber di curriculum-engine.js) — BUKAN hash lagi:
//      - topic_name → unit_number (posisi topik itu di dalam domainnya, 1-10)
//      - topic_name → bagian_number (domain/Bagian mana topik itu masuk)
//      - kata-kata yang jatuh ke (bagian, unit) yang sama, dibagi rata ke
//        10 level non-review di unit itu (round-robin)
//   3. AI dipanggil LAGI (seperti sebelumnya) HANYA untuk bikin exercises
//      per level, memakai kata-kata yang SUDAH di-assign ke level itu.
//
// Ada file preview KHUSUS untuk langkah klasifikasi
// (preview-klasifikasi.json) — WAJIB dicek dulu sebelum lanjut, karena
// ini bagian yang paling mungkin meleset (AI menaksir topik).
//
// CATATAN MIGRASI: karena kategori klasifikasi berubah total (10 → 100
// topik) dan seluruh kosakata mau digenerate ulang, HAPUS dulu file
// classify-checkpoint.json lokal sebelum run — kalau tidak, kata yang
// "sudah pernah diklasifikasi" (ke salah satu dari 10 topik LAMA) akan
// dianggap selesai dan gak diklasifikasi ulang ke skema 100 topik baru.
// migrate-bagian-assignment.mjs (dan inferDifficultyFromBagian yang
// dipakainya) juga jadi TIDAK RELEVAN lagi — itu untuk migrasi data lama
// tanpa reklasifikasi AI, sedangkan sekarang memang full regenerate.
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import { pathToFileURL } from "node:url";
import {
  computeVocabSignature,
  orderWordsPedagogically,
  planNewWordPlacement,
  planFullRebalance,
  recordCurriculumVersionIfChanged,
  TOPIC_NAMES,
  computeBagianNumber,
  computeUnitNumber,
} from "../lib/curriculum-engine.mjs";
import {
  loadExistingSignatures,
  filterDuplicateExercises,
  shuffleAnswerPositions,
  sanitizeGeneratedExercises,
  classifyJudgeResult,
  exerciseTextForJudge,
  judgeChoiceAmbiguity,
  proposeWordOrderAlternatives,
  mergeWordOrderAlternatives,
  judgePersonNames,
} from "../lib/exercise-validator.mjs";

// Poin L+M: "sidik jari" kosakata 1 topik — dipakai buat tau apakah topik
// ini BENERAN ada perubahan sejak run terakhir (kosakata baru masuk) atau
// enggak. Kalau signature-nya SAMA PERSIS kayak yang tersimpan di database,
// berarti gak ada yang berubah → SELURUH proses topik ini di-skip (gak ada
// panggilan AI sama sekali), sesuai instruksi "jangan regenerate kalau gak
// ada perubahan vocabulary yang relevan". (Fungsi computeVocabSignature
// sekarang diimport dari lib/curriculum-engine.mjs — poin U.)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const SUBJECT_SLUG = "ammiyah";
const SUBJECT_NAME = "Levantine";

// ============================================================
// STRUKTUR — nama & urutan topik sekarang sumber tunggalnya ada di
// lib/curriculum-engine.mjs (TOPIC_NAMES), supaya generate-vocab-v2.mjs dan
// migrate-bagian-assignment.mjs TIDAK PERNAH bisa punya urutan topik yang
// beda diam-diam (urutan ini menentukan unit_number, jadi kalau beda,
// kata bisa nyasar ke unit yang salah). "Hint" di bawah CUMA dipakai buat
// bantu AI mengklasifikasi kata — samakan urutannya dengan TOPIC_NAMES
// kalau di sana berubah.
// ============================================================
const TOPIC_HINTS = {
  // Bagian 1 — Dasar & Perkenalan
  "Perkenalan Diri": "nama, asal, umur, pekerjaan diri sendiri",
  "Sapaan": "halo, apa kabar, sapaan pagi/siang/malam",
  "Kata Ganti": "aku, kamu, dia, kami, mereka",
  "Angka 1-20": "angka dasar, hitungan",
  "Warna": "nama-nama warna",
  "Hari & Tanggal": "nama hari, bulan, tanggal",
  "Cuaca Dasar": "panas, dingin, hujan, cerah",
  "Anggota Keluarga": "ayah, ibu, saudara, kakek nenek",
  "Kata Sifat Dasar": "besar, kecil, bagus, jelek",
  "Terima Kasih & Maaf": "ucapan terima kasih, permintaan maaf, tolong",
  // Bagian 2 — Kehidupan Sehari-hari
  "Rutinitas Pagi": "bangun tidur, mandi, sarapan",
  "Waktu & Jam": "jam berapa, menit, pagi/siang/malam",
  "Aktivitas Rumah": "bersih-bersih, memasak, mencuci",
  "Makanan Sehari-hari": "nasi, roti, lauk sehari-hari",
  "Minuman": "air, teh, kopi, jus",
  "Pekerjaan Rumah Tangga": "menyapu, mengepel, mencuci piring",
  "Barang di Rumah": "perabotan, alat rumah tangga",
  "Ruangan Rumah": "kamar, dapur, ruang tamu, kamar mandi",
  "Tidur & Istirahat": "tidur, mimpi, istirahat",
  "Rutinitas Malam": "makan malam, nonton TV, tidur malam",
  // Bagian 3 — Makan & Belanja
  "Pesan di Restoran": "pesan makanan, memanggil pelayan",
  "Menu Makanan": "nama hidangan, menu restoran",
  "Belanja di Pasar": "pasar tradisional, belanja bahan makanan",
  "Tawar Harga": "tawar-menawar, harga murah/mahal",
  "Uang & Pembayaran": "uang, bayar, kembalian",
  "Toko Kelontong": "toko kecil, barang sehari-hari",
  "Buah & Sayur": "nama buah dan sayur",
  "Daging & Ikan": "nama daging, ikan, seafood",
  "Rasa Makanan": "manis, asin, pedas, asam",
  "Resep Sederhana": "cara masak, bahan resep",
  // Bagian 4 — Transportasi & Arah
  "Tanya Arah": "arah jalan, kiri kanan lurus",
  "Naik Taksi": "taksi, ongkos, tujuan",
  "Naik Bus": "bus, halte, tiket",
  "Kendaraan Pribadi": "mobil, motor, sepeda",
  "Lalu Lintas": "macet, lampu merah, rambu",
  "Nama Tempat di Kota": "masjid, sekolah, rumah sakit, kantor",
  "Peta & Lokasi": "peta, lokasi, alamat",
  "Bandara": "bandara, tiket pesawat, check-in",
  "Stasiun": "stasiun kereta, peron",
  "Perjalanan Jauh": "mudik, perjalanan panjang, bekal",
  // Bagian 5 — Kesehatan & Tubuh
  "Anggota Tubuh": "kepala, tangan, kaki, mata",
  "Sakit & Gejala": "sakit, demam, pusing, batuk",
  "Ke Dokter": "periksa dokter, keluhan",
  "Apotek": "beli obat, apoteker",
  "Obat-obatan": "nama obat, dosis",
  "Kecelakaan Kecil": "luka, jatuh, terkilir",
  "Kesehatan Mental Dasar": "stres, cemas, tenang",
  "Olahraga": "lari, senam, sepak bola",
  "Kebugaran": "gym, diet, kebugaran tubuh",
  "Emosi & Perasaan": "senang, sedih, marah, takut",
  // Bagian 6 — Pekerjaan & Sekolah
  "Profesi": "dokter, guru, insinyur, petani",
  "Di Kantor": "kantor, meja kerja, rapat",
  "Rapat Kerja": "agenda rapat, presentasi",
  "Wawancara Kerja": "melamar kerja, wawancara",
  "Di Sekolah": "sekolah, kelas, guru murid",
  "Mata Pelajaran": "matematika, bahasa, sains",
  "Universitas": "kuliah, kampus, dosen",
  "Tugas & Ujian": "PR, ujian, nilai",
  "Teknologi di Kerja": "komputer, email, aplikasi kerja",
  "Rekan Kerja": "kolega, atasan, bawahan",
  // Bagian 7 — Sosial & Hubungan
  "Kenalan Baru": "berkenalan dengan orang baru",
  "Ngobrol Santai": "obrolan ringan, basa-basi",
  "Undang Teman": "mengundang, ajakan",
  "Acara Keluarga": "kumpul keluarga, acara di rumah",
  "Pernikahan": "nikah, mempelai, resepsi",
  "Ulang Tahun": "ulang tahun, kado, kue",
  "Ucapan Selamat": "selamat, ucapan doa",
  "Curhat": "cerita masalah, curhat ke teman",
  "Nasihat": "saran, nasihat, motivasi",
  "Berargumen Sopan": "beda pendapat, diskusi sopan",
  // Bagian 8 — Rumah & Tempat Tinggal
  "Cari Tempat Tinggal": "cari kos, cari rumah",
  "Sewa Rumah": "kontrak sewa, uang sewa",
  "Tetangga": "tetangga, lingkungan sekitar rumah",
  "Perabotan": "kursi, meja, lemari",
  "Renovasi": "renovasi rumah, tukang",
  "Listrik & Air": "tagihan listrik, air PDAM",
  "Keamanan Rumah": "kunci, satpam, alarm",
  "Pindah Rumah": "pindahan, angkut barang",
  "Kebersihan": "bersih-bersih, sampah",
  "Hewan Peliharaan": "kucing, anjing, burung peliharaan",
  // Bagian 9 — Hiburan & Waktu Luang
  "Hobi": "hobi, kegiatan favorit",
  "Film & TV": "film, serial, bioskop",
  "Musik": "lagu, penyanyi, alat musik",
  "Baca Buku": "buku, novel, membaca",
  "Media Sosial": "medsos, posting, chat",
  "Liburan": "liburan, cuti, rencana jalan-jalan",
  "Wisata": "tempat wisata, jalan-jalan",
  "Olahraga Favorit": "olahraga kesukaan, tim favorit",
  "Permainan": "game, mainan, permainan tradisional",
  "Kumpul Teman": "nongkrong, kumpul bareng teman",
  // Bagian 10 — Topik Lanjutan
  "Berita & Isu Terkini": "berita, isu terbaru",
  "Pendapat & Diskusi": "opini, diskusi topik",
  "Cuaca Ekstrem": "badai, banjir, gempa",
  "Lingkungan": "lingkungan hidup, polusi, daur ulang",
  "Teknologi Modern": "HP, internet, AI",
  "Uang & Perbankan": "bank, tabungan, transfer",
  "Dokumen & Administrasi": "KTP, paspor, surat",
  "Darurat": "darurat, tolong, ambulans",
  "Budaya & Tradisi": "adat, tradisi, budaya lokal",
  "Percakapan Bebas": "topik campuran, latihan bebas, kalau tidak cocok kategori lain",
};
const TOPICS = TOPIC_NAMES.map((name) => ({ name, hint: TOPIC_HINTS[name] }));

// [PENGAMAN] Kalau nanti nambah Bagian baru di CURRICULUM (lib/curriculum-engine.js)
// tapi LUPA nambahin hint-nya di TOPIC_HINTS di atas, `hint` bakal jadi
// `undefined` dan nongol literal sebagai teks "undefined" di prompt AI
// (bukan error/crash, tapi diam-diam nurunin kualitas klasifikasi topik
// baru itu). Cek di awal biar ketauan SEBELUM keluar biaya AI, bukan
// nyadar belakangan pas lihat hasil klasifikasi aneh.
const topicsMissingHint = TOPICS.filter((t) => !t.hint).map((t) => t.name);
if (topicsMissingHint.length > 0) {
  console.error(
    `\n⚠️  ${topicsMissingHint.length} topik BELUM punya hint di TOPIC_HINTS: ${topicsMissingHint.join(", ")}\n` +
    `Tambahin dulu hint-nya sebelum lanjut, atau klasifikasi buat topik ini bakal kurang akurat.\n`
  );
  // throw (bukan process.exit) biar aman di Windows & tetap berhenti dengan exit code 1
  throw new Error(`TOPIC_HINTS belum lengkap: ${topicsMissingHint.join(", ")}`);
}

// 12 level per unit, node_type cycling 5 tipe.
export const NODE_TYPES = ["lesson", "practice", "story", "conversation", "review"];
export const LEVELS_PER_UNIT = 12;

export function buildLevelPlan() {
  return Array.from({ length: LEVELS_PER_UNIT }, (_, j) => ({
    order_index: j + 1,
    node_type: NODE_TYPES[j % NODE_TYPES.length],
  }));
}
// 10 slot non-review dalam 1 unit — tempat kosakata beneran ditaruh.
// Poin STATIC VS ADAPTIVE: kosakata baru CUMA didistribusikan ke level
// bertipe STATIC (lesson/story/conversation) — practice & review sekarang
// murni ADAPTIVE (dibangun on-the-fly per user pas dimainkan, lihat
// api/adaptive-exercise.js), jadi gak perlu "jatah kosakata sendiri" dari
// proses generate ini.
export const STATIC_CONTENT_SLOTS = buildLevelPlan().filter(
  (p) => p.node_type === "lesson" || p.node_type === "story" || p.node_type === "conversation"
);

// ============================================================
// CSV — parser sederhana, sekarang cuma 4 kolom.
// ============================================================
export function parseCsv(text, delimiter) {
  // Buang BOM (Byte Order Mark) yang sering ditempel Excel di awal file
  // waktu save-as CSV — kalau tidak dibuang, nama kolom pertama jadi rusak
  // (mis. jadi "\uFEFFkata_arab") dan tidak akan pernah cocok.
  text = text.replace(/^\uFEFF/, "");

  const rows = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return rows;

  // Deteksi otomatis pemisah kolom: kalau baris header punya lebih banyak
  // titik-koma daripada koma, berarti ini CSV ala Excel region Indonesia/
  // Eropa (pakai ";"), bukan format internasional (",").
  if (!delimiter) {
    const header = lines[0];
    const commaCount = (header.match(/,/g) || []).length;
    const semicolonCount = (header.match(/;/g) || []).length;
    delimiter = semicolonCount > commaCount ? ";" : ",";
  }

  const parseLine = (line) => {
    const out = [];
    let cur = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === delimiter) { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]);
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => (row[h] = values[idx] ?? ""));
    rows.push(row);
  }
  return rows;
}

export function loadFlatVocabCsv(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`File CSV tidak ditemukan: ${csvPath}. Cek template-kosakata-ammiyah.csv.`);
  }
  const rows = parseCsv(fs.readFileSync(csvPath, "utf-8"));
  return rows
    .filter((r) => r.kata_arab)
    .map((r) => ({
      kata_arab: r.kata_arab,
      latin: r.latin || "",
      arti: r.arti,
      contoh_kalimat: r.contoh_kalimat || "",
    }));
}

// ============================================================
// AI — klasifikasi kata ke topic_name (1 dari 100). Diproses per batch
// (30 kata/panggilan) supaya prompt & respons tetap ringkas dan gampang
// divalidasi; kalau 1 batch gagal, batch lain tidak ikut gagal.
// ============================================================
async function classifyBatch(words) {
  const topicList = TOPICS.map((t, i) => `${i + 1}. ${t.name} — ${t.hint}`).join("\n");
  const wordList = words.map((w, i) => `${i + 1}. ${w.kata_arab} (${w.latin}) = ${w.arti}`).join("\n");

  const prompt = `Kelompokkan tiap kata Bahasa Arab Levantine berikut ke SALAH SATU dari 100 topik ini
(WAJIB pakai nama topik PERSIS seperti tertulis, jangan bikin topik baru):
${topicList}

Daftar kata:
${wordList}

Balas HANYA JSON array (jumlah & urutan harus sama persis dengan daftar di atas), tanpa teks lain:
[ { "kata_arab": "...", "topic_name": "...(persis salah satu dari 100 nama topik di atas)..." }, ... ]`;

  const raw = await callLadiz(prompt, 4000);
  console.log("=== LADIZ CLASSIFICATION ===");
  console.log(raw);

  let parsed;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    // Respons kepotong/rusak (mis. "Unterminated string"). Kalau batch-nya
    // masih lebih dari 1 kata, PECAH jadi dua bagian lebih kecil dan coba
    // lagi masing-masing — output yang lebih pendek jauh lebih kecil
    // kemungkinan kepotong. Ini rekursif, jadi otomatis makin kecil kalau
    // masih gagal terus.
    if (words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      console.warn(`  ⚠ Gagal parse JSON untuk batch ${words.length} kata (${err.message}) — dipecah jadi ${mid} + ${words.length - mid} kata, coba lagi...`);
      const [first, second] = await Promise.all([
        classifyBatch(words.slice(0, mid)),
        classifyBatch(words.slice(mid)),
      ]);
      return [...first, ...second];
    }
    // Tinggal 1 kata dan TETAP gagal — daripada bikin seluruh script
    // berhenti, kasih fallback default supaya kata ini tidak hilang.
    // Nanti bisa dicek & diperbaiki manual di preview-klasifikasi.json.
    console.warn(`  ⚠ Gagal klasifikasi kata "${words[0].kata_arab}" walau sudah dipecah sendirian — dikasih default sementara.`);
    return [{ ...words[0], topic_name: "Percakapan Bebas" }];
  }
  // Cocokkan hasil balik ke kata asli lewat kata_arab (lebih aman daripada
  // asumsi urutan tetap sama), lalu validasi topic_name —
  // kalau AI meleset/invalid, fallback ke default + catat peringatan.
  return words.map((w) => {
    const match = parsed.find((p) => p.kata_arab === w.kata_arab) || parsed[words.indexOf(w)];
    let topicName = match?.topic_name;

    if (!TOPIC_NAMES.includes(topicName)) {
      console.warn(`⚠ "${w.kata_arab}": topic_name AI tidak valid ("${topicName}") — fallback ke "Percakapan Bebas".`);
      topicName = "Percakapan Bebas";
    }
    return { ...w, topic_name: topicName };
  });
}

const CHECKPOINT_FILE = "classify-checkpoint.json";
// Catatan: file checkpoint ini SENGAJA tidak dihapus otomatis setelah
// selesai — kalau nanti kamu nambah kosakata baru ke CSV yang sama, kata
// yang sudah pernah diklasifikasi tidak akan diulang/kena biaya API lagi.
// Kalau suatu saat mau klasifikasi ulang dari nol (misal ganti definisi
// topik), hapus manual file "classify-checkpoint.json" ini dulu.

async function classifyAllVocab(words, batchSize = 30) {
  // Muat checkpoint kalau ada (dari percobaan sebelumnya yang gagal
  // di tengah jalan) — kata yang SUDAH diklasifikasi tidak diulang lagi.
  let results = [];
  if (fs.existsSync(CHECKPOINT_FILE)) {
    try {
      results = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
      console.log(`Ditemukan checkpoint: ${results.length} kata sudah diklasifikasi sebelumnya, dilanjutkan.`);
    } catch {
      results = [];
    }
  }
  const alreadyDone = new Set(results.map((r) => r.kata_arab));
  const remaining = words.filter((w) => !alreadyDone.has(w.kata_arab));

  let incomplete = false;
  for (let i = 0; i < remaining.length; i += batchSize) {
    const batch = remaining.slice(i, i + batchSize);
    console.log(`Mengklasifikasi kata ${i + 1}-${Math.min(i + batchSize, remaining.length)} dari ${remaining.length} (sisa)...`);
    try {
      const classified = await classifyBatch(batch);
      results.push(...classified);
      // Simpan progres tiap batch — kalau nanti crash/error, tidak mulai dari nol.
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(results, null, 2));
    } catch (err) {
      if (err.quotaExceeded) {
        console.warn(
          `\n⚠ Quota Ladiz habis di tengah klasifikasi. ${results.length}/${words.length} kata ` +
          `sudah diklasifikasi & TERSIMPAN di ${CHECKPOINT_FILE}. Tidak ada yang hilang — ` +
          `jalankan script ini lagi nanti (setelah quota reset / upgrade plan) untuk lanjutkan ` +
          `sisanya, batch yang sudah selesai tidak akan diulang.\n`
        );
        incomplete = true;
        break;
      }
      throw err; // error lain (bukan soal quota) tetap dilempar apa adanya
    }
  }
  return { results, incomplete };
}

// ============================================================
// Deterministik: topic_name → (bagian, unit_number), LOOKUP LANGSUNG
// (bukan hash lagi — 1 topik sekarang cuma punya 1 slot tetap). Sumbernya
// di lib/curriculum-engine.mjs (CURRICULUM / computeBagianNumber /
// computeUnitNumber) — satu sumber kebenaran.
// ============================================================
function assignBagianUnit(classifiedWords) {
  return classifiedWords.map((w) => {
    const bagianNumber = computeBagianNumber(w.topic_name);
    const unitNumber = computeUnitNumber(w.topic_name);
    return { ...w, bagianNumber, unitNumber };
  });
}

// ============================================================
// KURASI — kalau 1 topik kebanjiran kandidat kata (misal kamu punya 4000
// kata sumber, tapi 1 topik cuma butuh ~100 kata), AI diminta MEMILIH mana
// yang paling pas/berguna, bukan maksa semuanya masuk. Kata yang tidak
// terpilih tetap ada di CSV sumber kamu, tidak hilang — cuma tidak dipakai
// di generate kali ini (bisa dipertimbangkan lagi nanti).
// ============================================================
const TARGET_WORDS_PER_TOPIC = 100; // tiap topik cuma 1 slot (gak berulang antar-Bagian lagi), jadi ini total kata buat topik itu

export async function selectBestWordsForTopic(topicName, candidates, targetCount) {
  // Kirim per batch (60 kata sekali kirim) supaya prompt tidak kepanjangan
  // kalau kandidatnya ratusan/ribuan. AI pilih porsi terbaik dari tiap
  // batch, proporsional ke targetCount.
  const batchSize = 60;
  const keepPerBatch = Math.max(1, Math.ceil((targetCount / candidates.length) * batchSize));
  let kept = [];

  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    const wordList = batch
      .map((w, idx) => `${idx + 1}. ${w.kata_arab} (${w.latin}) = ${w.arti}`)
      .join("\n");

    const prompt = `Ini daftar kata kandidat untuk topik "${topicName}" (Bahasa Arab Levantine):
${wordList}

Pilih maksimal ${keepPerBatch} kata yang PALING relevan & berguna untuk topik "${topicName}"
(prioritaskan kata yang sering dipakai sehari-hari dan paling representatif untuk topik ini,
dari yang paling dasar sampai yang lebih spesifik). Kata yang tidak relevan dengan topik ini
boleh tidak dipilih sama sekali, walau slot masih ada.

Balas HANYA JSON array berisi kata_arab yang DIPILIH (persis sama ejaannya dengan yang di atas),
tanpa teks lain, format: ["kata1", "kata2", ...]`;

    try {
      const raw = await callLadiz(prompt, 1500);
      const chosen = JSON.parse(cleanJson(raw));
      kept.push(...batch.filter((w) => chosen.includes(w.kata_arab)));
    } catch (err) {
      if (err.quotaExceeded) throw err; // biar ditangani di curateByTopic, jangan ditelan di sini
      console.warn(`  ⚠ Gagal kurasi 1 batch topik "${topicName}", batch ini dilewati:`, err.message);
    }
  }
  return kept;
}

const CURATION_CHECKPOINT_FILE = "curation-checkpoint.json";
// Struktur checkpoint: { [topicName]: { seen: [kata_arab,...], kept: [word,...] } }
// "seen" = SEMUA kata yang pernah dipertimbangkan buat topik ini (baik
// akhirnya lolos maupun tidak) — dipakai buat tahu kata mana yang BENERAN
// baru di run ini. "kept" = hasil akhir yang dipakai.

async function curateByTopic(classifiedWords) {
  const byTopic = {};
  for (const w of classifiedWords) {
    if (!byTopic[w.topic_name]) byTopic[w.topic_name] = [];
    byTopic[w.topic_name].push(w);
  }

  let done = {};
  if (fs.existsSync(CURATION_CHECKPOINT_FILE)) {
    try { done = JSON.parse(fs.readFileSync(CURATION_CHECKPOINT_FILE, "utf-8")); } catch { done = {}; }
  }

  const result = [];
  let incomplete = false;
  for (const topicName of Object.keys(byTopic)) {
    const candidates = byTopic[topicName];
    const prevSeen = new Set(done[topicName]?.seen || []);
    const prevKept = done[topicName]?.kept || [];
    const newCandidates = candidates.filter((w) => !prevSeen.has(w.kata_arab));

    if (newCandidates.length === 0) {
      // Tidak ada kata baru untuk topik ini sejak terakhir dikurasi — pakai
      // hasil lama, tidak perlu panggil AI lagi.
      console.log(`Topik "${topicName}" tidak ada kata baru — pakai ${prevKept.length} kata dari sebelumnya.`);
      result.push(...prevKept);
      continue;
    }

    // Ada kata baru — gabungkan dengan yang sudah lolos sebelumnya, lalu
    // evaluasi ulang sebagai satu pool (supaya kata baru & lama sama-sama
    // dipertimbangkan secara adil, bukan cuma nambah tanpa dibandingkan).
    const pool = [...prevKept, ...newCandidates];
    let chosen;
    if (pool.length <= TARGET_WORDS_PER_TOPIC) {
      chosen = pool; // belum kelebihan, pakai semua
    } else {
      console.log(`Kurasi topik "${topicName}": ${prevKept.length} lama + ${newCandidates.length} baru = ${pool.length} kandidat → target ~${TARGET_WORDS_PER_TOPIC}...`);
      try {
        chosen = await selectBestWordsForTopic(topicName, pool, TARGET_WORDS_PER_TOPIC);
      } catch (err) {
        if (err.quotaExceeded) {
          console.warn(
            `\n⚠ Quota Ladiz habis di tengah kurasi topik "${topicName}". Topik yang sudah ` +
            `selesai dikurasi tetap tersimpan di ${CURATION_CHECKPOINT_FILE}. Jalankan lagi nanti ` +
            `untuk lanjutkan topik yang tersisa.\n`
          );
          incomplete = true;
          break;
        }
        throw err;
      }
      console.log(`  → AI pilih ${chosen.length} kata untuk topik ini.`);
    }

    done[topicName] = {
      seen: [...new Set([...(done[topicName]?.seen || []), ...candidates.map((w) => w.kata_arab)])],
      kept: chosen,
    };
    fs.writeFileSync(CURATION_CHECKPOINT_FILE, JSON.stringify(done, null, 2));
    result.push(...chosen);
  }
  return { result, incomplete };
}




// ============================================================
// PROMPT EXERCISES PER NODE_TYPE (sama seperti sebelumnya)
// ============================================================
const SHAPE_INSTRUCTIONS = {
  lesson: `Balas HANYA JSON array berisi 8-13 soal (pilih jumlah pas di rentang ini sesuai banyaknya
kosakata yang tersedia — jangan mepet ke minimum kalau kosakatanya cukup buat lebih banyak variasi).
JANGAN mengulang kombinasi kata+tipe yang sama persis lebih dari 1x — tiap soal harus menguji
kata/konteks yang beda, biar user gak ngerasa "diulang" padahal cuma ganti nomor. Variasikan proporsi
tipe soal (jangan cuma 1 tipe dominan), campur dari tipe berikut. KHUSUS "word_order" — WAJIB PAKAI
KEDUA ARAH (direction: "to_indonesian" DAN "to_arabic"), JANGAN cuma 1 arah terus-terusan.

ATURAN KUALITAS (WAJIB, berlaku di semua tipe soal di bawah):
- Field "has_person_name": true/false WAJIB ada di SETIAP soal — isi true HANYA kalau soal itu
  menyebut nama diri orang (mis. Ahmad, Lara, Joseph, جورج, عطا). Kalau tidak ada nama orang sama
  sekali, isi false. MAKSIMAL 1 dari SELURUH soal di batch ini boleh has_person_name: true — kalau
  kata "nama" ada di daftar kosakata dan kepakai lebih dari 1x, pakai kata ganti (dia/kamu/saya)
  atau profesi/hubungan (guru, tetangga) untuk soal selebihnya, JANGAN nama orang lagi.
- "fill_blank": kalimatnya WAJIB punya PETUNJUK KONTEKS yang bikin CUMA SATU dari 3 opsi masuk akal
  di kalimat itu (dari makna kalimatnya, bukan cuma tata bahasa). JANGAN bikin kalimat generik yang
  bisa menerima semua opsi sama baiknya (mis. "Mereka datang dengan kotak ___?" bisa diisi warna
  APAPUN — itu SALAH, karena tidak ada petunjuk yang menentukan warna mana). Tambahkan detail di
  kalimat (situasi, kata sifat lain, sebab-akibat) yang secara logis cuma cocok dengan 1 opsi.
- "word_order": semua isi "wordBank" dan "correctWords" untuk arah "to_arabic" WAJIB tulisan ARAB
  MURNI (tidak boleh ada 1 huruf Latin pun tercampur, termasuk transliterasi asal-asalan seperti
  menulis "ara" untuk kata Arab) — begitu juga sebaliknya, arah "to_indonesian" wordBank/correctWords
  WAJIB tulisan Indonesia (tidak boleh ada huruf Arab). Untuk "acceptedOrders": SELALU usahakan
  minimal 1-2 alternatif yang memakai SINONIM kata yang SUDAH ada di wordBank (bukan cuma menyusun
  ulang urutan kata yang sama) kalau bahasanya memang punya padanan wajar (mis. "kabarmu" vs
  "keadaanmu" untuk "kiif haalak") — bukan cuma kalau kebetulan ada urutan lain, tapi CARI aktif
  padanan yang wajar untuk kalimat itu.
- AMBIGUITAS GENDER/JUMLAH: beberapa kata ganti Indonesia itu NETRAL gender ("kalian", "kamu",
  "dia", "mereka", "teman", "anak", dst), padahal Arab Levantine WAJIB beda bentuk tergantung
  gender/jumlah yang dimaksud (mis. "kalian" -> akhiran -كم untuk laki-laki/campuran ATAU -كن
  untuk perempuan — DUA-DUANYA sama-sama terjemahan yang benar, Indonesia-nya sendiri tidak
  menentukan). Untuk soal BERTIPE PILIHAN ("fill_blank", "translate_choice", "listen_choose",
  "dialogue_complete") yang kena situasi ini: SELALU sertakan field "acceptedIndices" (array index,
  0-based) berisi SEMUA index opsi yang sama-sama benar — JANGAN cuma pilih 1 bentuk gender lalu
  anggap bentuk lainnya salah. Kalau cuma 1 bentuk yang masuk akal (soal/kalimatnya sudah
  menentukan gender lewat konteks lain), "acceptedIndices" cukup diisi [correctIndex] saja (1
  elemen) — field ini WAJIB ada di setiap soal pilihan, isinya [correctIndex] kalau tidak ada
  ambiguitas, atau beberapa index kalau memang ambigu.
- GENDER WAJIB JELAS (soal Indonesia -> Arab): setiap teks Indonesia yang jadi SUMBER terjemahan ke
  Arab ("translate_write" "text", "word_order" to_arabic "text", "translate_choice" "promptText") dan
  memuat kata ganti netral-gender (kamu, anda, kalian, dia, mereka) WAJIB menyebut gender dalam
  kurung: "Kamu (perempuan) sudah makan?", "Dia (laki-laki) guru", "Kalian (perempuan) di mana?".
  Soal tanpa label gender akan DIBUANG otomatis. Arah Arab -> Indonesia tidak perlu label.
- JAWABAN TULIS ("translate_write"): selain "correctAnswer", isi "acceptedAnswers" (array tulisan Arab
  murni, termasuk correctAnswer sendiri) dengan variasi lain yang SAMA-SAMA benar (sinonim wajar,
  urutan kata lain yang wajar). Kalau memang cuma 1 cara, isi [correctAnswer].
[
  { "type": "fill_blank", "prompt": "Isi bagian yang kosong", "has_person_name": false,
    "content": { "beforeBlank": { "latin": "...(boleh string kosong kalau rumpang di AWAL kalimat)...", "text": "..." },
                 "afterBlank": { "latin": "...(boleh string kosong kalau rumpang di AKHIR kalimat)...", "text": "..." },
                 "options": [{ "latin": "...", "text": "..." }, ...3 pilihan], "correctIndex": 0,
                 "acceptedIndices": [0] /* isi index LAIN juga di sini kalau ada ambiguitas gender/jumlah -- lihat ATURAN AMBIGUITAS GENDER/JUMLAH di atas */ } },
  { "type": "translate_choice", "prompt": "Pilih terjemahan yang benar", "has_person_name": false,
    "content": { "promptText": "...(kata Indonesia)...",
                 "options": [{ "latin": "...", "text": "..." }, ...3 pilihan], "correctIndex": 0,
                 "acceptedIndices": [0] /* sama aturannya seperti di atas */ } },
  { "type": "word_order", "prompt": "Susun terjemahannya", "has_person_name": false,
    "content": { "direction": "to_indonesian", "latin": "...", "text": "...(kalimat arab)...", "hasAudio": true,
                 "correctWords": ["kata1_indonesia","kata2_indonesia",...],
                 "acceptedOrders": [["kata1_indonesia","kata2_indonesia",...] /* WAJIB isi correctWords di atas sebagai 1 elemen di sini juga, PLUS cari aktif 1-2 alternatif sinonim/urutan lain yang sama-sama wajar (lihat ATURAN KUALITAS di atas). Kalau BENAR-BENAR cuma ada 1 cara wajar bilang kalimat itu, boleh 1 elemen saja -- tapi itu pengecualian, bukan default. */],
                 "wordBank": ["kata1_indonesia","kata2_indonesia",...,"pengecoh1","pengecoh2"] } },
  { "type": "word_order", "prompt": "Susun kalimat Bahasa Arab", "has_person_name": false,
    "content": { "direction": "to_arabic", "text": "...(kalimat Indonesia, JADI REFERENSI, BUKAN yang disusun; beri label gender pada kata ganti)...",
                 "correctWords": ["kata1_arab","kata2_arab",...],
                 "acceptedOrders": [["kata1_arab","kata2_arab",...] /* aturan sama seperti di atas -- cari aktif alternatif kalau memang ada urutan/padanan Arab lain yang wajar */],
                 "wordBank": ["kata1_arab","kata2_arab",...,"pengecoh1_arab","pengecoh2_arab"] } },
  { "type": "translate_write", "prompt": "Tulis terjemahannya", "has_person_name": false,
    "content": { "text": "...(kalimat Indonesia, beri label gender bila perlu)...", "correctAnswer": "...(kalimat arab)...", "acceptedAnswers": ["...(kalimat arab, sama dengan correctAnswer)..."] } },
  { "type": "listen_choose", "prompt": "Dengarkan lalu pilih jawaban yang benar", "has_person_name": false,
    "content": { "hasAudio": true, "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0,
                 "acceptedIndices": [0] /* sama aturannya seperti di atas */ } }
]`,
  practice: `Balas HANYA JSON array berisi 8-13 soal (pilih jumlah pas di rentang ini sesuai banyaknya
kosakata yang tersedia), fokus ke kata yang sering ketuker. JANGAN mengulang kombinasi kata+tipe yang
sama persis lebih dari 1x — variasikan pasangan kata & tipe soal tiap nomor.

ATURAN KUALITAS (WAJIB, sama seperti tipe "lesson" — lihat detail lengkapnya di atas): field
"has_person_name" WAJIB di tiap soal (maks 1 true per batch); "fill_blank" wajib punya petunjuk
konteks yang menentukan cuma 1 opsi benar; "word_order" wordBank/correctWords harus 1 bahasa murni
sesuai direction-nya (Arab murni untuk to_arabic, Indonesia murni untuk to_indonesian), dan cari
aktif alternatif sinonim untuk "acceptedOrders"; field "acceptedIndices" WAJIB di tiap soal pilihan
(isi [correctIndex] kalau tidak ada ambiguitas gender/jumlah, atau beberapa index kalau "kalian"/
"kamu"/"dia"/dst punya >1 bentuk Arab yang sama-sama benar — lihat ATURAN AMBIGUITAS GENDER/JUMLAH
di tipe "lesson"):
[
  { "type": "matching_pairs", "prompt": "Cocokkan kata yang sering ketuker", "has_person_name": false,
    "content": { "pairs": [{ "id": "p1", "left": "...", "leftLatin": "...", "right": "..." }, ...4 pasang],
                 "rightOrder": ["...urutan id diacak..."] } },
  { "type": "translate_choice", "prompt": "Pilih terjemahan yang benar", "has_person_name": false,
    "content": { "promptText": "...", "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } },
  { "type": "fill_blank", "prompt": "Isi bagian yang kosong", "has_person_name": false,
    "content": { "beforeBlank": { "latin": "...(boleh kosong kalau rumpang di AWAL)...", "text": "..." },
                 "afterBlank": { "latin": "...(boleh kosong kalau rumpang di AKHIR)...", "text": "..." },
                 "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } }
]`,
  story: `Buat SATU cerita pendek (2-3 kalimat) yang MERANGKAI kata-kata di atas, dalam Arab + latin,
TANPA terjemahan Indonesia (user paham dari konteks).

Dari cerita itu, buat 8-13 soal TOTAL dengan variasi (JANGAN semua soal nanyain hal yang sama):
- 3-4 soal "reading_comprehension" tentang cerita itu — variasikan SUDUT PERTANYAANNYA
  (apa yang terjadi, siapa pelakunya, kapan/di mana kejadiannya, kenapa itu terjadi — JANGAN
  4 soal yang intinya sama cuma beda kalimat)
- 4-6 soal "translate_choice" nanyain ARTI KATA SPESIFIK dari kosakata di atas (bukan tentang
  ceritanya, murni "kata ini artinya apa") — pakai kata-kata BEDA, sebar ke banyak kosakata
- 1-2 soal "fill_blank" pakai salah satu kalimat DARI CERITA itu (bukan kalimat baru)

Field "hasAudio": true WAJIB ada di TIAP soal reading_comprehension/fill_blank yang berbasis cerita
(dipakai buat autoplay audio pas soal itu muncul) — field "passageLatin"/"passageText" WAJIB SAMA
PERSIS di semua soal yang berbasis cerita yang sama (jangan bikin versi cerita berbeda-beda).

BATAS KERAS: maksimal 2 nama orang berbeda di seluruh cerita & soalnya; "translate_choice" (arti kata) TIDAK BOLEH memuat nama orang.
ATURAN KUALITAS: field "has_person_name" WAJIB di tiap soal — nama tokoh cerita WAJAR dipakai
(cerita butuh tokoh), tapi kalau cerita punya 1 nama tokoh, jangan ulang-ulang sebut namanya di
SETIAP soal reading_comprehension — variasikan sebagian pertanyaan pakai "tokoh itu"/"dia" supaya
tidak semua soal ke-flag has_person_name: true. "fill_blank" dari cerita tetap harus jelas
jawabannya cuma 1 opsi dari konteks kalimat cerita itu (bukan makna kalimatnya yang ambigu untuk
ke-3 opsi). Field "acceptedIndices" WAJIB di tiap soal pilihan (isi [correctIndex] kalau tidak ada
ambiguitas gender/jumlah kata ganti, atau beberapa index kalau ada — lihat ATURAN AMBIGUITAS
GENDER/JUMLAH di tipe "lesson").

Balas HANYA JSON array, format:
[
  { "type": "reading_comprehension", "prompt": "Pahami bacaannya, lalu jawab", "has_person_name": false,
    "content": { "hasAudio": true, "passageLatin": "...", "passageText": "...(arab)...",
                 "question": "...(pertanyaan Indonesia, variasikan sudutnya)...",
                 "options": [{ "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } },
  { "type": "translate_choice", "prompt": "Pilih arti yang benar", "has_person_name": false,
    "content": { "promptText": "...(1 kata dari daftar kosakata)...",
                 "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } },
  { "type": "fill_blank", "prompt": "Isi bagian yang kosong (dari cerita di atas)", "has_person_name": false,
    "content": { "hasAudio": true, "passageLatin": "...", "passageText": "...(sama persis cerita di atas)...",
                 "beforeBlank": { "latin": "...(boleh kosong kalau rumpang di AWAL)...", "text": "..." },
                 "afterBlank": { "latin": "...(boleh kosong kalau rumpang di AKHIR)...", "text": "..." },
                 "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } }
]`,
  conversation: `Buat SATU dialog pendek 2 orang (A & B) yang memakai kata-kata di atas, situasi nyata
(kafe/pasar/jalan).

Dari dialog itu, buat 8-13 soal TOTAL dengan variasi (JANGAN semua soal nanyain hal yang sama):
- 3-4 soal "dialogue_complete" — beda-beda baris yang dikosongkan (jangan selalu baris terakhir B;
  variasikan: kadang baris A, kadang di tengah dialog), dialogLines-nya SAMA PERSIS tiap soal
  (cuma beda baris mana yang "blank": true)
- 4-6 soal "translate_choice" nanyain ARTI KATA SPESIFIK dari kosakata di atas (bukan tentang
  dialognya, murni "kata ini artinya apa") — sebar ke banyak kosakata beda
- 1-2 soal "reading_comprehension" tentang isi/konteks dialog itu (siapa yang ngomong apa, situasinya
  di mana, dst)

Field "hasAudio": true WAJIB ada di TIAP soal dialogue_complete (dipakai buat autoplay audio pas
soal itu muncul) — field "dialogueLines" WAJIB SAMA PERSIS di semua soal dialogue_complete yang
pakai dialog yang sama (cuma beda posisi "blank": true).

ATURAN KUALITAS: field "has_person_name" WAJIB di tiap soal — dialog BOLEH pakai 1 nama tokoh
(A dan/atau B), itu wajar untuk percakapan. Tapi JANGAN tambahkan nama tokoh KEDUA/KETIGA cuma buat
variasi (mis. dialog A-B lalu tiba-tiba menyebut nama orang ketiga yang gak perlu) — itu bikin
proporsi soal bernama-orang jadi kebanyakan. BATAS KERAS: maksimal 2 nama orang berbeda di SELURUH dialog/cerita dan soal-soalnya; soal "translate_choice" (arti kata) TIDAK BOLEH memuat nama orang. Kalau A dan B sudah punya nama, cukup itu saja. Field "acceptedIndices" WAJIB di tiap soal pilihan
(isi [correctIndex] kalau tidak ada ambiguitas gender/jumlah kata ganti, atau beberapa index kalau
ada — lihat ATURAN AMBIGUITAS GENDER/JUMLAH di tipe "lesson").

Balas HANYA JSON array, format:
[
  { "type": "dialogue_complete", "prompt": "Lengkapi percakapannya", "has_person_name": false,
    "content": { "hasAudio": true,
                 "dialogueLines": [
                   { "speaker": "A", "latin": "...", "text": "..." },
                   { "speaker": "B", "latin": "___", "text": "___", "blank": true }
                 ],
                 "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } },
  { "type": "translate_choice", "prompt": "Pilih arti yang benar", "has_person_name": false,
    "content": { "promptText": "...(1 kata dari daftar kosakata)...",
                 "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } },
  { "type": "reading_comprehension", "prompt": "Pahami percakapannya, lalu jawab", "has_person_name": false,
    "content": { "passageLatin": "...(gabungan dialog)...", "passageText": "...(arab)...",
                 "question": "...(Indonesia)...",
                 "options": [{ "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } }
]`,
  review: `Ini soal REVIEW/spaced-repetition — TANPA hint latin (field "latin" WAJIB string kosong "").
Balas HANYA JSON array berisi 8-13 soal (pilih jumlah pas di rentang ini sesuai banyaknya kosakata
yang tersedia). JANGAN mengulang kombinasi kata+tipe yang sama persis lebih dari 1x.

ATURAN KUALITAS (WAJIB, sama seperti tipe "lesson" — lihat detail lengkapnya di atas): field
"has_person_name" WAJIB di tiap soal (maks 1 true per batch); "fill_blank" wajib punya petunjuk
konteks yang menentukan cuma 1 opsi benar (bukan kalimat generik yang menerima semua opsi); field
"acceptedIndices" WAJIB di tiap soal pilihan (isi [correctIndex] kalau tidak ada ambiguitas
gender/jumlah, atau beberapa index kalau ada — lihat ATURAN AMBIGUITAS GENDER/JUMLAH di tipe "lesson"):
[
  { "type": "translate_write", "prompt": "Tulis terjemahannya (tanpa bantuan)", "has_person_name": false,
    "content": { "text": "...(Indonesia, beri label gender bila perlu)...", "correctAnswer": "...(arab)...", "acceptedAnswers": ["...(arab)..."] } },
  { "type": "listen_choose", "prompt": "Dengarkan lalu pilih jawaban yang benar", "has_person_name": false,
    "content": { "hasAudio": true, "options": [{ "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } },
  { "type": "fill_blank", "prompt": "Isi bagian yang kosong", "has_person_name": false,
    "content": { "beforeBlank": { "text": "...(arab, tanpa latin, boleh kosong kalau rumpang di AWAL)..." },
                 "afterBlank": { "text": "...(arab, tanpa latin, boleh kosong kalau rumpang di AKHIR)..." },
                 "options": [{ "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } }
]`,
};

// ------------------------------------------------------------
// JUMLAH OPSI: soal kosakata yang menanyakan 1 kata ("translate_choice")
// sekarang punya 5 pilihan, dan soal dengar ("listen_choose") 4 pilihan --
// bukan 3 lagi. Contoh format di SHAPE_INSTRUCTIONS ditulis "...3 pilihan",
// jadi di sini angkanya diganti per-tipe supaya AI tidak bingung antara
// contoh dan aturan.
// ------------------------------------------------------------
const OPTION_COUNT = { translate_choice: 5, listen_choose: 4 };
function adaptOptionCounts(text) {
  return text
    .split(/(?=\{ "type": ")/)
    .map((chunkText) => {
      const m = chunkText.match(/^\{ "type": "([a-z_]+)"/);
      const n = m && OPTION_COUNT[m[1]];
      return n ? chunkText.replace(/\.\.\.3( pilihan)?\]/g, `...${n}$1]`).replace(/\.\.\.3\]/g, `...${n}]`) : chunkText;
    })
    .join("");
}
for (const k of Object.keys(SHAPE_INSTRUCTIONS)) SHAPE_INSTRUCTIONS[k] = adaptOptionCounts(SHAPE_INSTRUCTIONS[k]);

export const NARRATIVE_NODE_TYPES = ["story", "conversation"];

// Aturan tambahan (lebih tegas dari yang ada di SHAPE_INSTRUCTIONS) -- ditaruh
// PALING AKHIR di prompt supaya tidak tenggelam. Menjawab 3 keluhan: nama
// orang masih muncul, soal ambigu masih muncul, struktur soal cacat.
function buildStrictRules(nodeType) {
  const narrative = NARRATIVE_NODE_TYPES.includes(nodeType);
  return `

ATURAN KETAT TAMBAHAN (PALING PENTING, MENGALAHKAN ATURAN LAIN KALAU BERTENTANGAN):
1. NAMA ORANG: ${narrative
    ? 'Cerita/dialog BOLEH punya paling banyak 1-2 tokoh bernama. Soal kosakata ("translate_choice") dan soal lain di luar cerita/dialog DILARANG memakai nama orang.'
    : 'DILARANG KERAS memakai nama orang APA PUN (Ahmad, Lara, Joseph, Mariam, Omar, dll) di soal, opsi, maupun kalimat contoh. Pakai kata ganti (dia/kamu/saya), profesi, atau hubungan (guru, tetangga, ibu, teman). SEMUA soal WAJIB has_person_name: false.'}
2. JUMLAH OPSI: "translate_choice" WAJIB tepat 5 opsi; "listen_choose" WAJIB tepat 4 opsi; tipe pilihan lain (fill_blank, dialogue_complete, reading_comprehension) tetap 3 opsi. Semua opsi harus berbeda satu sama lain, sama-sama kata/frasa wajar (bukan opsi asal-asalan), dan SELURUH opsi salah harus BENAR-BENAR salah.
3. TIDAK AMBIGU: untuk SETIAP soal pilihan, tambahkan field "cek_opsi_salah": array string, 1 elemen per opsi SALAH, berisi alasan singkat KENAPA opsi itu salah di soal ini (mis. "artinya 'kucing', bukan 'anjing'"). Kalau kamu tidak bisa menulis alasan yang kuat untuk salah satu opsi salah, GANTI opsi itu atau ubah soalnya sampai bisa.
4. STRUKTUR: jangan membuat soal yang jawabannya tidak ada di opsi, opsi yang mengandung jawaban ganda, kalimat Arab yang janggal/tidak gramatikal, atau wordBank yang kehilangan kata jawaban. Lebih baik buat SEDIKIT soal yang benar daripada banyak soal yang cacat.`;
}

async function generateExercisesOnce(topicName, nodeType, vocabList, avoidList = [], feedback = [], report = { dropped: [] }) {
  const vocabText = vocabList
    .map((v) => `${v.kata_arab} (${v.latin}) = ${v.arti}${v.contoh_kalimat ? " — contoh: " + v.contoh_kalimat : ""}`)
    .join("\n");

  // Daftar soal yang SUDAH dibuat di segmen sebelumnya (level yang sama).
  // Tanpa ini, tiap segmen dikasih kosakata identik + instruksi identik →
  // AI cenderung bikin soal yang mirip/ulang terus karena gak tau apa yang
  // sudah pernah dibuat. Dikasih daftar ini biar AI aktif menghindarinya.
  const avoidSection = avoidList.length > 0
    ? `\n\nSOAL-SOAL INI SUDAH DIBUAT DI SESI SEBELUMNYA — JANGAN dibuat lagi dengan kata/konteks yang sama,
buat variasi yang BENAR-BENAR BEDA (kata lain dari daftar kosakata, atau konteks kalimat lain):
${avoidList.map((a) => `- ${a}`).join("\n")}`
    : "";

  // Aturan anti-pengulangan yang TEGAS dan konkret — instruksi lama ("jangan
  // ulang kombinasi kata+tipe") ternyata masih terlalu samar, AI tetap suka
  // makein 1-2 kata favorit (misal "أنا") berkali-kali balik-balik dalam 1
  // batch soal yang sama. Ini dikasih hitungan pasti biar gak ambigu.
  const antiRepeatRule = `\n\nATURAN WAJIB SOAL TIDAK MONOTON:
- Sebar soal MERATA ke SEMUA kosakata di atas dulu (tiap kata jadi fokus utama
  minimal 1x) SEBELUM ada kata yang dipakai jadi fokus utama untuk ke-2 kalinya.
- 1 kata yang sama MAKSIMAL jadi fokus utama di 2 soal dalam 1 batch ini —
  kalau kosakata cukup banyak, usahakan tiap kata cuma 1x saja.
- JANGAN taruh 2 soal berturut-turut (nomor urut bersebelahan) yang fokus
  utamanya kata yang SAMA, walau tipe soalnya beda.

ATURAN WAJIB PENANDAAN KATA (PENTING, JANGAN DILEWATKAN):
Setiap objek soal WAJIB punya field tambahan "vocab_used": array berisi kata
arab (kata_arab) PERSIS SAMA EJAANNYA seperti di daftar kosakata di atas —
BENTUK DASAR/KAMUSNYA, BUKAN bentuk yang sudah diubah di kalimat (lihat
ATURAN PENYESUAIAN BENTUK KATA di bawah). Ini dipakai sistem buat tracking
progress per kata per user — kalau ejaannya beda dikit dari daftar (termasuk
kalau kamu taruh bentuk jamak/perempuan/terkonjugasi di sini, bukan bentuk
dasarnya), taggingnya gagal.
Contoh: kalau daftar kosakata punya "كتاب" (buku, tunggal) tapi kalimatnya
pakai "كتب" (buku-buku, jamak) — di kalimat boleh pakai "كتب", tapi
vocab_used TETAP HARUS ["كتاب"] (bentuk dasarnya), bukan ["كتب"].
Contoh format: { "type": "translate_choice", "prompt": "...", "vocab_used": ["أنا"],
"content": { ... } }
Untuk soal yang menguji beberapa kata sekaligus (matching_pairs, dialog,
cerita), masukkan SEMUA kata yang relevan ke array itu (tetap bentuk dasar).`;

  // Umpan balik dari putaran sebelumnya (soal yang dibuang & alasannya), supaya
  // AI tidak mengulang kesalahan yang sama saat mengisi kekurangan soal.
  const feedbackSection = feedback.length > 0
    ? `\n\nPUTARAN SEBELUMNYA, SOAL-SOAL INI DITOLAK PEMERIKSA — JANGAN ulangi pola kesalahan yang sama:\n${feedback.slice(0, 12).map((f) => `- ${f}`).join("\n")}`
    : "";

  const prompt = `Topik: "${topicName}" — Bahasa Arab Levantine (dialek Yordania).
Kategori bulatan pelajaran: "${nodeType}".

Kosakata WAJIB jadi FOKUS soal (jangan bikin soal dari kata di luar daftar ini):
${vocabText}

ATURAN PENYESUAIAN BENTUK KATA:
Kosakata di atas adalah BENTUK DASAR/KAMUS (biasanya tunggal, kata dasar). Kamu
BOLEH menyesuaikan bentuknya di dalam kalimat/soal supaya gramatikal & natural —
ubah ke jamak/dual kalau konteksnya emang jamak, ubah ke bentuk perempuan kalau
subjeknya perempuan, konjugasikan kata kerja sesuai subjek/waktu, dst. JANGAN
maksa kalimat aneh cuma demi mempertahankan ejaan persis dari daftar.
YANG TETAP WAJIB: makna dasar/akar katanya harus tetap kata yang sama dari
daftar (jangan ganti "كتاب"/buku jadi "قلم"/pena) — yang boleh berubah cuma
bentuk gramatikalnya (jamak/tunggal/gender/konjugasi), bukan kata dasarnya.
DAN: field "vocab_used" (lihat aturan di bawah) tetap WAJIB pakai ejaan bentuk
DASAR dari daftar ini, BUKAN bentuk yang sudah disesuaikan di kalimat.

${SHAPE_INSTRUCTIONS[nodeType]}${antiRepeatRule}${avoidSection}${feedbackSection}${buildStrictRules(nodeType)}

Pastikan bahasa Arab akurat dan konsisten dengan kosakata di atas. Balas HANYA JSON, tanpa teks lain,
tanpa markdown code fence.`;

const raw0 = await callLadiz(prompt, 7000);
  console.log(`=== LADIZ EXERCISES: ${nodeType} ===`);
  console.log(raw0);

  // [FIX] Sebelumnya, kalau AI balikin JSON yang RUSAK (bukan gagal network/
  // kuota -- itu udah di-retry sama callLadiz -- tapi JSON-nya sendiri gak
  // valid, misal ada tanda kutip yang gak ke-escape di teks Latin/Arab),
  // error langsung dilempar ke atas dan BIKIN SELURUH SCRIPT BERHENTI,
  // walau ini cuma masalah SEKALI JALAN yang kemungkinan besar gak kejadian
  // lagi kalau AI diminta ulang. Sekarang di-retry MAKS_JSON_RETRY kali dulu
  // (minta AI generate ULANG dari nol, bukan "perbaiki JSON ini" -- lebih
  // reliable) sebelum beneran nyerah.
  const MAKS_JSON_RETRY = 3;
  let raw = raw0;
  let lastErr;
  let parsed = null;
  for (let attempt = 1; attempt <= MAKS_JSON_RETRY; attempt++) {
    try {
      parsed = shuffleAnswerPositions(JSON.parse(cleanJson(raw)));
      break;
    } catch (err) {
      lastErr = err;
      console.error(`\n❌ JSON exercise tidak valid (percobaan ${attempt}/${MAKS_JSON_RETRY}).`);
      console.error(err.message);
      console.error("\n=== RESPONSE LADIZ (RUSAK) ===");
      console.error(raw);
      console.error("\n=== END RESPONSE ===");
      if (attempt >= MAKS_JSON_RETRY) break;
      console.log(`  ↻ Minta AI generate ulang dari nol (percobaan ${attempt + 1}/${MAKS_JSON_RETRY})...`);
      raw = await callLadiz(prompt, 7000);
    }
  }
  if (parsed === null) {
    // Tetap gagal setelah semua percobaan -- BARU dilempar ke atas. Caller
    // (main loop) yang nentuin: skip topik/segmen ini & lanjut ke yang lain,
    // BUKAN matiin seluruh script (lihat pemanggil generateExercisesForLevel).
    throw lastErr;
  }
  // [PENTING] refineExerciseQuality DI LUAR loop retry-JSON di atas -- fungsi
  // ini bisa melempar error QUOTA HABIS (dari judgeChoiceAmbiguity/
  // proposeWordOrderAlternatives), dan itu HARUS diteruskan apa adanya ke
  // pemanggil (biar script berhenti rapi), BUKAN ketangkep loop di atas dan
  // disangka "JSON rusak, coba generate ulang" -- itu salah kaprah & boros.
  return await refineExerciseQuality(parsed, nodeType, report);
}

// Pembungkus: generate -> periksa -> kalau jumlah soal LOLOS masih di bawah
// target (karena banyak yang dibuang: ambigu, nama orang, cacat struktural),
// minta AI membuat pengganti LANGSUNG sekarang (maks MAX_REFILL_ROUNDS kali),
// dengan umpan balik alasan penolakan. Sebelumnya soal yang dibuang baru
// diganti di run berikutnya dengan prompt yang sama, jadi penggantinya sering
// cacat dengan pola yang sama. Cerita/dialog (story/conversation) TIDAK
// di-refill: bacaannya harus 1 utuh dan sama di semua soalnya.
const MAX_REFILL_ROUNDS = 3;
async function generateExercisesForLevel(topicName, nodeType, vocabList, avoidList = []) {
  const accepted = [];
  const feedback = [];
  const rounds = NARRATIVE_NODE_TYPES.includes(nodeType) ? 1 : MAX_REFILL_ROUNDS;
  for (let round = 1; round <= rounds; round++) {
    const report = { dropped: [] };
    const localAvoid = [...avoidList, ...accepted.map(summarizeExercise)];
    const batch = await generateExercisesOnce(topicName, nodeType, vocabList, localAvoid, feedback, report);
    accepted.push(...batch);
    for (const d of report.dropped) feedback.push(d);
    if (accepted.length >= TARGET_MIN_PER_SEGMENT) break;
    if (round < rounds) console.log(`  ↻ Baru ${accepted.length} soal lolos pemeriksaan (target ${TARGET_MIN_PER_SEGMENT}); minta pengganti (putaran ${round + 1}/${rounds})...`);
  }
  return accepted;
}

// ============================================================
// PEMERIKSAAN KUALITAS SOAL (perbaikan 4 keluhan user — lihat komentar
// panjang di lib/exercise-validator.mjs). Dipanggil SETELAH JSON dari AI
// berhasil di-parse & diacak, SEBELUM soal disimpan ke database:
//   1. sanitizeGeneratedExercises  -> struktural, GRATIS (tanpa AI call):
//      buang soal cacat (opsi bukan Arab murni, dst) + batasi maks 1 soal
//      bernama-orang per batch (fallback kalau AI gak isi has_person_name
//      dengan benar walau sudah diminta di prompt).
//   2. judgeChoiceAmbiguity        -> 1 AI call TAMBAHAN (cuma kalau ada soal
//      pilihan ganda: fill_blank/translate_choice/listen_choose/
//      dialogue_complete/reading_comprehension). AI judge nentuin per soal:
//      "ok" (1 opsi valid, dibiarkan), "accept_variants" (2+ opsi valid tapi
//      cuma beda gender/jumlah -- mis. "kalian" -كم vs -كن -- DISIMPAN,
//      acceptedIndices di-update, BUKAN dihapus), atau "bad_ambiguous" (2+
//      opsi valid tanpa alasan gender, soal cacat -- DIHAPUS).
//   3. proposeWordOrderAlternatives -> 1 AI call TAMBAHAN (cuma kalau ada
//      soal word_order), usulkan alternatif sinonim buat acceptedOrders,
//      digabung lewat mergeWordOrderAlternatives (yang tetap MEMVALIDASI
//      ulang -- usulan AI yang gak sesuai tile di bank tetap dibuang).
// Soal yang dibuang DI SINI TIDAK diganti dalam panggilan yang sama --
// jumlah soal tersisa bisa di bawah TARGET_MIN_PER_SEGMENT, tapi itu aman:
// topicHasIncompleteSegments() akan mendeteksinya sebagai belum lengkap,
// dan generate-vocab-v2.mjs otomatis nambahin lagi di run berikutnya.
// ============================================================
const MAX_JUDGE_ATTEMPTS = 3;
// Panggil judge dengan retry; null kalau semua percobaan gagal (BUKAN
// "lolos"): pemanggil yang memutuskan apa yang dilakukan dengan soal berisiko.
async function judgeWithRetry(fn) {
  for (let attempt = 1; attempt <= MAX_JUDGE_ATTEMPTS; attempt++) {
    try {
      const r = await fn();
      if (r) return r;
    } catch (err) {
      if (err.quotaExceeded) throw err;
    }
  }
  return null;
}

export async function refineExerciseQuality(exercises, nodeType, report = { dropped: [] }) {
  const note = (ex, why) => report.dropped.push(`${ex.type}: ${why} — ${summarizeExercise(ex)}`);
  const narrative = NARRATIVE_NODE_TYPES.includes(nodeType);

  // --- Nama orang: di lesson/practice/review TIDAK BOLEH ADA SAMA SEKALI ---
  let pool = exercises;
  if (!narrative) {
    pool = pool.filter((ex) => {
      if (ex.has_person_name === true) { note(ex, "memakai nama orang"); return false; }
      return true;
    });
  }

  const { kept: keptRaw, dropped } = sanitizeGeneratedExercises(pool, { nodeType, maxNameExercises: 1, enforceOptionCount: true, requireGenderLabel: true });
  let kept = keptRaw;
  if (dropped.length > 0) {
    console.warn(`  🧹 ${dropped.length} soal dibuang (struktural): ${dropped.map((d) => d.reasons[0]).join("; ")}`);
    for (const d of dropped) report.dropped.push(`cacat struktural: ${d.reasons[0]}`);
  }

  // --- Judge nama orang (AI) — menangkap nama yang TIDAK ditandai AI sendiri ---
  if (!narrative && kept.length > 0) {
    const items = kept.map((ex, i) => ({ key: String(i), text: exerciseTextForJudge(ex.type, ex.content) }));
    const nameSet = await judgeWithRetry(() => judgePersonNames(callLadiz, cleanJson, items));
    if (nameSet) {
      const before = kept.length;
      kept = kept.filter((ex, i) => {
        if (nameSet.has(String(i))) { note(ex, "mengandung nama orang"); return false; }
        return true;
      });
      if (kept.length < before) console.warn(`  🧹 ${before - kept.length} soal dibuang (mengandung nama orang).`);
    } else {
      console.warn("  ⚠ Judge nama-orang gagal setelah beberapa percobaan; soal dipertahankan tanpa pemeriksaan nama.");
    }
  }

  // --- Judge #1: ambiguitas semua tipe pilihan ganda ---
  // listen_choose TIDAK dinilai: soalnya cuma audio (tanpa teks konteks), jadi penguji teks tidak punya bahan menilai.
  const CHOICE_TYPES_FOR_JUDGE = ["fill_blank", "translate_choice", "dialogue_complete", "reading_comprehension"];
  const RISKY_WITHOUT_JUDGE = ["fill_blank", "dialogue_complete"]; // paling sering ambigu
  const judgeable = kept
    .map((ex, i) => ({ ex, i }))
    .filter(({ ex }) => CHOICE_TYPES_FOR_JUDGE.includes(ex.type));
  let ambiguousIdx = new Set();
  const acceptMap = new Map(); // i -> validIndices (verdict "accept_variants")
  if (judgeable.length > 0) {
    const items = judgeable.map(({ ex, i }) => ({
      key: String(i),
      sentence: exerciseTextForJudge(ex.type, ex.content),
      options: (ex.content.options || []).map((o) => o.text),
    }));
    const resultMap = await judgeWithRetry(() => judgeChoiceAmbiguity(callLadiz, cleanJson, items));
    if (resultMap) {
      for (const { ex, i } of judgeable) {
        const j = classifyJudgeResult(resultMap.get(String(i)), ex.content.correctIndex);
        if (j.kind === "ambiguous") { ambiguousIdx.add(i); note(ex, "ambigu: lebih dari 1 opsi benar"); }
        else if (j.kind === "wrong_key") { ambiguousIdx.add(i); note(ex, "kunci jawaban tidak dianggap valid oleh penguji"); }
        else if (j.kind === "variants") acceptMap.set(i, j.indices);
        else if (j.kind === "unknown" && RISKY_WITHOUT_JUDGE.includes(ex.type)) { ambiguousIdx.add(i); note(ex, "tidak sempat diperiksa ambiguitasnya"); }
      }
      if (ambiguousIdx.size > 0) console.warn(`  🧹 ${ambiguousIdx.size} soal pilihan dibuang (ambigu tanpa alasan gender/jumlah).`);
      if (acceptMap.size > 0) console.warn(`  ✅ ${acceptMap.size} soal diisi acceptedIndices (variasi gender/jumlah wajar).`);
    } else {
      // Judge gagal total: JANGAN lolos begitu saja. Tipe yang paling sering
      // ambigu dibuang; tipe lain (arti kata/dengar) dipertahankan.
      console.warn("  ⚠ Judge ambiguitas gagal setelah beberapa percobaan — soal fill_blank/dialogue_complete dibuang demi aman.");
      judgeable.forEach(({ ex, i }) => { if (RISKY_WITHOUT_JUDGE.includes(ex.type)) { ambiguousIdx.add(i); note(ex, "tidak sempat diperiksa ambiguitasnya"); } });
    }
  }

  // --- Judge #2: alternatif sinonim buat word_order ---
  const woItems = kept
    .map((ex, i) => ({ ex, i }))
    .filter(({ ex }) => ex.type === "word_order");
  const altMap = new Map();
  if (woItems.length > 0) {
    const items = woItems.map(({ ex, i }) => ({
      key: String(i),
      direction: ex.content.direction,
      reference: ex.content.latin || ex.content.text,
      correctWords: ex.content.correctWords,
      wordBank: ex.content.wordBank,
    }));
    try {
      const proposed = await proposeWordOrderAlternatives(callLadiz, cleanJson, items);
      if (proposed) for (const { i } of woItems) altMap.set(i, proposed.get(String(i)) || []);
    } catch (err) {
      if (err.quotaExceeded) throw err;
      console.warn(`  ⚠ Gagal mengusulkan alternatif susun-kata (dilewati, dipakai apa adanya): ${err.message}`);
    }
  }

  const final = [];
  kept.forEach((ex, i) => {
    if (ambiguousIdx.has(i)) return; // dibuang
    if (ex.type === "word_order" && altMap.has(i)) {
      const { content } = mergeWordOrderAlternatives(ex.content, altMap.get(i));
      final.push({ ...ex, content });
    } else if (acceptMap.has(i)) {
      final.push({ ...ex, content: { ...ex.content, acceptedIndices: acceptMap.get(i) } });
    } else {
      final.push(ex);
    }
  });
  return final;
}

// Retry otomatis dengan exponential backoff — kalau LadizAI lagi
// overload/sibuk (503 UNAVAILABLE) atau kena rate limit (429), coba lagi
// beberapa kali dengan jeda makin lama. Kalau tetap gagal setelah semua
// percobaan (biasanya berarti QUOTA/SALDO benar-benar habis, bukan cuma
// sibuk sesaat), error yang dilempar ditandai `.quotaExceeded = true`
// supaya kode pemanggil bisa berhenti dengan RAPI (bukan crash berantakan).
//
// Dipindah dari Gemini ke LadizAI (gateway OpenAI-compatible). Format
// requestnya beda dari Gemini (pakai "messages" + "chat/completions",
// bukan "contents" + "generateContent"), tapi fungsi ini tetap
// mengembalikan STRING JAWABAN AI SAJA — persis seperti callGemini dulu —
// supaya kode pemanggil (classifyBatch, curateByTopic, dst) tidak perlu
// diubah sama sekali.
export async function callLadiz(prompt, maxTokens, attempt = 1) {
  const model = "ladiz-core";
  const maxAttempts = 5;
  const url = `${process.env.LADIZ_BASE_URL}/chat/completions`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LADIZ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.2,
        // CATATAN: TIDAK pakai response_format: { type: "json_object" }.
        // Spec OpenAI-compatible mewajibkan json_object berupa OBJECT di
        // level teratas, padahal semua prompt di file ini (classifyBatch,
        // selectBestWordsForTopic, generateExercisesForLevel, dan yang di
        // lib/curriculum-engine.mjs) minta balasan berupa JSON ARRAY —
        // parsing-nya juga langsung mengasumsikan array (parsed.find(...),
        // parsed.map(...)). Kalau constraint json_object ditegakkan model,
        // ini bisa bikin balasan gagal/berubah bentuk secara diam-diam.
        // Validasi bentuk JSON cukup diserahkan ke instruksi prompt +
        // cleanJson() di bawah.
      }),
    });
  } catch (networkErr) {
    // Error jaringan (ECONNRESET, ETIMEDOUT, dll) — koneksi putus di
    // tengah jalan, BUKAN error dari LadizAI. Perlakukan sama seperti
    // "sibuk sementara": retry dengan backoff, bukan langsung menyerah.
    if (attempt < maxAttempts) {
      const delayMs = 2000 * attempt;
      console.warn(`  ⚠ Koneksi jaringan bermasalah (${networkErr.code || networkErr.message}), coba lagi dalam ${delayMs / 1000}s... (percobaan ${attempt}/${maxAttempts})`);
      await sleep(delayMs);
      return callLadiz(prompt, maxTokens, attempt + 1);
    }
    const err = new Error(`Koneksi ke LadizAI gagal terus setelah ${maxAttempts} percobaan: ${networkErr.message}`);
    err.quotaExceeded = true; // dipakai kode pemanggil buat berhenti rapi (bukan crash)
    throw err;
  }

  const json = await res.json().catch(async () => {
    // Respons bukan JSON (server/proxy kadang balikin halaman HTML pas
    // error/gateway timeout/maintenance) — jangan langsung crash, coba
    // baca sebagai teks buat log, lalu perlakukan seperti "server sibuk".
    const bodyText = await res.text().catch(() => "(tidak bisa dibaca)");
    return { __invalidJson: true, __status: res.status, __body: bodyText.slice(0, 200) };
  });

  if (json.__invalidJson) {
    if (attempt < maxAttempts) {
      const delayMs = 2000 * attempt;
      console.warn(
        `  ⚠ Respons LadizAI bukan JSON (HTTP ${json.__status}, kemungkinan gateway/proxy error) — ` +
        `coba lagi dalam ${delayMs / 1000}s... (percobaan ${attempt}/${maxAttempts})`
      );
      await sleep(delayMs);
      return callLadiz(prompt, maxTokens, attempt + 1);
    }
    const err = new Error(`Respons LadizAI tidak valid (bukan JSON) setelah ${maxAttempts} percobaan. Cuplikan: ${json.__body}`);
    err.quotaExceeded = true; // dipakai kode pemanggil buat berhenti rapi (bukan crash)
    throw err;
  }

  const isRetryable = res.status === 429 || res.status === 503 || res.status === 502;

  if (isRetryable && attempt < maxAttempts) {
    const delayMs = 2000 * attempt; // 2s, 4s, 6s, 8s...
    console.warn(`  ⚠ LadizAI sibuk (${res.status}), coba lagi dalam ${delayMs / 1000}s... (percobaan ${attempt}/${maxAttempts})`);
    await sleep(delayMs);
    return callLadiz(prompt, maxTokens, attempt + 1);
  }
  if (isRetryable && attempt >= maxAttempts) {
    const err = new Error(json.error?.message || "LadizAI kehabisan quota/sibuk terus setelah beberapa percobaan.");
    err.quotaExceeded = true;
    throw err;
  }

  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respons LadizAI tidak terduga: " + JSON.stringify(json).slice(0, 300));
  return content;
}

export function cleanJson(text) {
  return text.replace(/```json|```/g, "").trim();
}




// Ringkas 1 soal jadi 1 baris teks pendek, buat dikasih ke AI sebagai
// "jangan bikin yang mirip ini lagi" pas generate segmen berikutnya.
export function summarizeExercise(ex) {
  const c = ex.content || {};
  const key = c.promptText || c.text || c.latin || c.passageLatin ||
    (c.beforeBlank?.latin || c.beforeBlank?.text) || (c.afterBlank?.latin || c.afterBlank?.text) ||
    (c.dialogueLines?.[0]?.latin) || (c.pairs?.map((p) => p.left).join(", ")) || "(?)";
  return `${ex.type}: ${key}`;
}

// ============================================================
// Audio TTS — opsional (flag --audio)
// ============================================================
export async function generateAudio(kataArab) {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new Error(
      "ELEVENLABS_VOICE_ID belum diisi di .env — cari Voice ID di elevenlabs.io dulu."
    );
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: kataArab, model_id: "eleven_multilingual_v2" }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`ElevenLabs gagal (${res.status}): ${errText}`);
  }
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}
export async function uploadAudio(kataArab, audioBuffer) {
  // Supabase Storage cuma terima key/nama-file ASCII — karakter Arab
  // (kataArab) TIDAK BOLEH masuk nama file, walau sudah di-replace spasi.
  // Nama file di sini cuma perlu UNIK, bukan perlu "berarti" — kata Arab
  // aslinya sudah aman tersimpan di kolom `kata_arab` tabel vocab_items,
  // jadi nama file boleh sekadar timestamp + angka acak.
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${uniqueId}.mp3`;
  const { error } = await supabase.storage.from("vocab-audio").upload(filename, audioBuffer, { contentType: "audio/mpeg" });
  if (error) throw error;
  const { data } = supabase.storage.from("vocab-audio").getPublicUrl(filename);
  return data.publicUrl;
}

// Satu teks = satu file audio selama script berjalan. Dialog/cerita yang sama dipakai oleh banyak
// soal (3-4 soal per dialog), jadi tanpa cache kredit ElevenLabs terbuang untuk audio kembar.
const audioUrlCache = new Map();
export async function audioUrlFor(text) {
  const key = String(text || "").replace(/\s+/g, " ").trim();
  if (!key) return null;
  if (audioUrlCache.has(key)) return audioUrlCache.get(key);
  const buf = await generateAudio(key);
  const url = await uploadAudio(key, buf);
  audioUrlCache.set(key, url);
  return url;
}

// Isi cache dari audio yang SUDAH ada di database (dipakai script backfill supaya teks yang sama
// tidak dibuatkan audio lagi di run berikutnya).
export function seedAudioCache(text, url) {
  const key = String(text || "").replace(/\s+/g, " ").trim();
  if (key && url && !audioUrlCache.has(key)) audioUrlCache.set(key, url);
}

// Teks dialog untuk audio: baris yang dikosongkan DIISI jawaban benar (bukan "___").
export function dialogueSpokenText(content) {
  const lines = Array.isArray(content?.dialogueLines) ? content.dialogueLines : [];
  const right = content?.options?.[content?.correctIndex]?.text;
  return lines
    .map((l) => (l && l.blank === true ? right : l?.text))
    .filter((t) => typeof t === "string" && t.trim() && t.trim() !== "___")
    .join(" ");
}

// ============================================================
// SKELETON — units → topics → levels. Idempotent.
// ============================================================
export async function ensureSubject() {
  const { data: existing } = await supabase.from("subjects").select("*").eq("slug", SUBJECT_SLUG).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from("subjects").insert({ name: SUBJECT_NAME, slug: SUBJECT_SLUG }).select().single();
  if (error) throw error;
  return data;
}
export async function ensureUnit(subjectId, bagianNumber) {
  const { data: existing } = await supabase.from("units").select("*").eq("subject_id", subjectId).eq("order_index", bagianNumber).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from("units").insert({ subject_id: subjectId, name: `Bagian ${bagianNumber}`, order_index: bagianNumber }).select().single();
  if (error) throw error;
  return data;
}
export async function ensureTopic(unitId, unitNumber, topicName) {
  const { data: existing } = await supabase.from("topics").select("*").eq("unit_id", unitId).eq("order_index", unitNumber).maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from("topics").insert({ unit_id: unitId, name: topicName, order_index: unitNumber }).select().single();
  if (error) throw error;
  return data;
}
export async function ensureLevels(topicId) {
  const plan = buildLevelPlan();
  const levelRows = [];
  for (const step of plan) {
    const { data: existing } = await supabase.from("levels").select("*").eq("topic_id", topicId).eq("level_number", step.order_index).maybeSingle();
    if (existing) { levelRows.push(existing); continue; }
    const { data, error } = await supabase.from("levels").insert({ topic_id: topicId, level_number: step.order_index, node_type: step.node_type }).select().single();
    if (error) throw error;
    levelRows.push(data);
  }
  return levelRows;
}

export const SEGMENTS_PER_LEVEL = 4; // 1 bulatan = 4 sesi soal, dibuka satu-satu
export const TARGET_MIN_PER_SEGMENT = 8; // batas bawah rentang 8-13 soal/segmen

// Node type yang punya 4 segmen soal beneran. "story"/"conversation" TETAP
// 1 segmen — itu 1 bacaan/dialog utuh, dipecah 4x malah merusak alurnya.
export function segmentsForNodeType(nodeType) {
  return nodeType === "story" || nodeType === "conversation" ? 1 : SEGMENTS_PER_LEVEL;
}

// Baca jumlah soal YANG SUDAH ADA di 1 level, per segmen (1-4). Dipakai buat
// nentuin segmen mana yang: (a) belum digarap sama sekali → generate baru,
// (b) sudah ada tapi masih di bawah target 8 → di-"top up" (ditambah lagi,
// BUKAN diulang dari nol — soal lama tetap dipertahankan), atau
// (c) sudah lengkap (>= 8) → dilewati, hemat quota.
export async function getSegmentExerciseCounts(levelId) {
  const { data, error } = await supabase
    .from("exercises")
    .select("segment_number")
    .eq("level_id", levelId);
  if (error) throw error;
  const counts = {};
  for (const row of data || []) {
    counts[row.segment_number] = (counts[row.segment_number] || 0) + 1;
  }
  return counts; // contoh: { 1: 10, 2: 13, 3: 4 } → segmen 4 belum ada sama sekali
}

// BUG YANG DIPERBAIKI: sebelumnya, kalau vocab_signature topik SAMA PERSIS
// kayak run sebelumnya, topik itu di-skip TOTAL — termasuk kalau ada segmen
// yang belum pernah nyampe TARGET_MIN_PER_SEGMENT (mis. AI cuma balikin 3
// soal di run sebelumnya, macet di situ selamanya karena skip signature
// mencegah top-up kejadian lagi). Fungsi ini cek dulu: ada gak segmen yang
// masih kurang, SEBELUM keputusan skip diambil.
export async function topicHasIncompleteSegments(topicId) {
  const { data: levelRows } = await supabase.from("levels").select("id, level_number, node_type").eq("topic_id", topicId);
  for (const lvl of levelRows || []) {
    if (lvl.node_type === "practice" || lvl.node_type === "review") continue; // adaptif, gak dihitung di sini
    const totalSegmentsNeeded = segmentsForNodeType(lvl.node_type);
    const counts = await getSegmentExerciseCounts(lvl.id);
    for (let seg = 1; seg <= totalSegmentsNeeded; seg++) {
      if ((counts[seg] || 0) < TARGET_MIN_PER_SEGMENT) return true; // ketemu 1 aja yang kurang, cukup
    }
  }
  return false;
}

// Ambil ISI soal yang SUDAH ADA di 1 level (semua segmen, termasuk yang
// sudah lengkap/dilewati) — dipakai buat mengisi awal `avoidList` supaya
// segmen yang baru digenerate/di-top-up tahu apa yang harus dihindari,
// bukan cuma soal yang baru dibuat di sesi berjalan ini saja. Ini yang
// tadinya bolong: sebelumnya avoidList kosong tiap mulai proses 1 level,
// jadi segmen yang sudah ada (apalagi dari run sebelumnya) tidak pernah
// "diketahui" pas generate segmen lain — makanya soal masih bisa mirip.
export async function getExistingExerciseSummaries(levelId) {
  const { data, error } = await supabase
    .from("exercises")
    .select("type, content")
    .eq("level_id", levelId);
  if (error) throw error;
  return (data || []).map(summarizeExercise);
}

export async function saveLevelContent(levelRow, vocabList, exercises, useAudio, segmentNumber) {
  // Cek kata yang SUDAH ada di level ini dulu, supaya kalau kamu jalankan
  // script lagi nanti (misal nambah kosakata baru), kata yang sama tidak
  // ke-insert dobel.
  const { data: existingVocab } = await supabase
    .from("vocab_items")
    .select("id, kata_arab")
    .eq("level_id", levelRow.id);
  const existingWords = new Set((existingVocab || []).map((v) => v.kata_arab));
  // Map kata_arab -> vocab_id, dipakai buat nge-tag exercise_vocab di bawah.
  // Diisi dari SEMUA vocab yang sudah ada di level ini (bukan cuma vocabList
  // batch sekarang) — penting buat node_type "review", yang soalnya sering
  // gabungin kata dari level-level sebelumnya juga.
  const vocabIdByWord = new Map((existingVocab || []).map((v) => [v.kata_arab, v.id]));

  for (const v of vocabList) {
    if (existingWords.has(v.kata_arab)) {
      console.log(`    (lewati, sudah ada) ${v.kata_arab}`);
      continue;
    }
    let audioUrl = null;
    if (useAudio) audioUrl = await audioUrlFor(v.kata_arab);
    const { data: inserted, error } = await supabase.from("vocab_items").insert({
      level_id: levelRow.id, kata_arab: v.kata_arab, latin: v.latin, arti: v.arti,
      contoh_kalimat: v.contoh_kalimat, audio_url: audioUrl,
    }).select().single();
    if (error) throw error;
    vocabIdByWord.set(v.kata_arab, inserted.id); // vocab_id BARU ini juga masuk map
  }

  // Poin R + U: DUPLICATE PREVENTION deterministik — sekarang lewat
  // lib/exercise-validator.mjs (dipakai bareng sama api/adaptive-exercise.js,
  // 1 sumber logic, bukan 2 salinan terpisah lagi).
  const existingSignatures = await loadExistingSignatures(supabase, { levelId: levelRow.id, generatedForUserId: null });
  const toInsert = filterDuplicateExercises(exercises, vocabIdByWord, existingSignatures);
  for (const { ex, vocabUsedIds } of toInsert) {
    if ((ex.vocab_used || []).length !== vocabUsedIds.length) {
      console.warn(`    ⚠ Sebagian vocab_used di "${ex.type}" gak ketemu di daftar kosakata level ini — dilewati sebagian (exercise_vocab).`);
    }
  }
  console.log(`    (${exercises.length - toInsert.length} soal dilewati karena duplikat, ${toInsert.length} soal baru akan disimpan)`);

  // Poin L: kosakata BARU (yang baru masuk topik ini) soalnya ditaruh DI
  // DEPAN urutan segmen ini — BUKAN ditambah di belakang seperti
  // sebelumnya. Soal-soal LAMA yang sudah ada TETAP UTUH (isi/vocab_id/
  // exercise_id-nya gak berubah sama sekali), cuma nomor urutnya
  // (order_index) digeser ke belakang. Ini yang bikin kata yang "lebih
  // dasar" tapi baru ditambahkan ke Excel belakangan bisa "menyalip" ke
  // depan lesson yang sudah ada — buat user BARU yang belum pernah buka
  // segmen ini, urutannya jadi pedagogis dari awal.
  //
  // Buat user yang SEDANG di tengah segmen ini (sudah jawab sebagian soal
  // sebelum top-up ini terjadi): geser order_index TIDAK bikin soal yang
  // sudah dijawab ke-skip atau muncul ulang, dan TIDAK bikin soal yang
  // belum dijawab keloncat. GET /api/exercises?...&user_id=... menghitung
  // status "answered" dari answer_log (exercise_id + user_id), bukan dari
  // order_index — jadi resume tetap akurat apa pun yang terjadi ke urutan.
  // (Syaratnya cuma satu: frontend memang resume dari exercise_id yang
  // "answered": false di respons itu, bukan dari angka index yang disimpan
  // sendiri di frontend.)
  //
  // Aman buat level yang BENAR-BENAR baru juga — geser 0 baris = no-op.
  if (toInsert.length > 0) {
    const { data: existingExercisesForShift } = await supabase
      .from("exercises")
      .select("id, order_index")
      .eq("level_id", levelRow.id)
      .eq("segment_number", segmentNumber);

    if (existingExercisesForShift && existingExercisesForShift.length > 0) {
      const shiftAmount = toInsert.length;
      await Promise.all(
        existingExercisesForShift.map((row) =>
          supabase.from("exercises").update({ order_index: row.order_index + shiftAmount }).eq("id", row.id)
        )
      );
    }
  }
  let orderIndex = 1; // soal BARU mulai dari depan (1); soal lama sudah digeser ke belakang di atas

  for (const { ex, vocabUsedIds, signature } of toInsert) {
    let audioUrl = null;
    if (useAudio && ex.type === "listen_choose") {
      const sample = ex.content?.options?.[ex.content?.correctIndex ?? 0]?.text; // OPSI BENAR (opsi sudah diacak, options[0] bukan jawabannya)
      if (sample) audioUrl = await audioUrlFor(sample);
    } else if (useAudio && ex.type === "word_order" && (ex.content?.audioText || (ex.content?.hasAudio && /[\u0600-\u06FF]/.test(ex.content?.text || "")))) {
      // Soal susun-kata dengan suara (termasuk mode "audioOnly": teks disembunyikan, user hanya
      // mendengar kalimat Arabnya). Audio dibuat dari audioText, atau dari text kalau itu kalimat Arab.
      const spoken = ex.content.audioText || ex.content.text;
      audioUrl = await audioUrlFor(spoken);
    } else if (useAudio && ex.type === "fill_blank" && ex.content?.audioText && !ex.content?.passageText) {
      // Isian dengan kalimat Arab utuh (level Intermediate): audio = kalimat lengkap dengan jawaban yang benar
      audioUrl = await audioUrlFor(ex.content.audioText);
    } else if (useAudio && ex.content?.hasAudio && ex.content?.passageText) {
      // Soal berbasis cerita (reading_comprehension/fill_blank dari story)
      audioUrl = await audioUrlFor(ex.content.passageText);
    } else if (useAudio && ex.content?.hasAudio && Array.isArray(ex.content?.dialogueLines)) {
      // Soal berbasis dialog (dialogue_complete dari conversation) — gabung
      // semua baris JADI SATU audio (diputar berurutan sebagai 1 percakapan)
      const fullDialogueText = dialogueSpokenText(ex.content);
      if (fullDialogueText) audioUrl = await audioUrlFor(fullDialogueText);
    }
    const { data: insertedEx, error } = await supabase.from("exercises").insert({
      level_id: levelRow.id, type: ex.type, order_index: orderIndex++, prompt: ex.prompt,
      content: ex.content, audio_url: audioUrl, segment_number: segmentNumber, signature,
    }).select().single();
    if (error) {
      // 23505 = unique violation -- unique index (level_id, signature) yang
      // jadi jaring pengaman TERAKHIR (jaga-jaga race condition/bug di
      // pengecekan di atas). Bukan error fatal, cukup di-skip.
      if (error.code === "23505") { console.log(`    (lewati, duplikat kena unique constraint database)`); continue; }
      throw error;
    }

    for (const vocabId of vocabUsedIds) {
      const { error: linkError } = await supabase
        .from("exercise_vocab")
        .insert({ exercise_id: insertedEx.id, vocab_id: vocabId });
      // Duplikat (exercise+vocab sama) diabaikan diam-diam, bukan fatal.
      if (linkError && linkError.code !== "23505") throw linkError;
    }
  }
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const commit = process.argv.includes("--commit");
  const previewFlag = process.argv.includes("--preview"); // eksplisit — sama efeknya kayak gak pakai --commit, cuma buat kejelasan command
  const rebalanceMode = process.argv.includes("--rebalance");
  const useAudio = process.argv.includes("--audio");
  const csvFlagIdx = process.argv.indexOf("--csv");
  const csvPath = csvFlagIdx !== -1 ? process.argv[csvFlagIdx + 1] : "kosakata-ammiyah.csv";

  // 1. Baca CSV flat (kata_arab, latin, arti, contoh_kalimat saja)
  const words = loadFlatVocabCsv(csvPath);
  console.log(`Membaca ${words.length} kata dari ${csvPath}...`);

  // 2. AI klasifikasi topic_name per kata (resumable — lihat
  // classify-checkpoint.json). Kalau quota habis di tengah jalan, LANJUT
  // saja pakai kata yang SUDAH diklasifikasi — tidak perlu nunggu semua
  // 100% selesai. Sisa kata yang belum sempat akan otomatis ikut di run
  // berikutnya (checkpoint tetap dibaca), dan bisa jadi masuk ke topik yang
  // sama yang sudah ter-commit sebelumnya (tinggal jalan lagi nanti, aman
  // karena vocab_items & exercises sudah anti-duplikat).
  const { results: classified, incomplete: classifyIncomplete } = await classifyAllVocab(words);
  if (classifyIncomplete) {
    console.log(
      `Lanjut proses pakai ${classified.length}/${words.length} kata yang sudah diklasifikasi. ` +
      `Sisanya akan otomatis ikut kalau kamu jalankan script ini lagi nanti.\n`
    );
  }

  // 2b. Kurasi per topik (resumable — lihat curation-checkpoint.json).
  const { result: curated, incomplete: curateIncomplete } = await curateByTopic(classified);
  console.log(`\nSetelah kurasi: ${curated.length} dari ${classified.length} kata dipakai.\n`);
  if (curateIncomplete) {
    console.log(
      `Lanjut proses pakai topik yang sudah dikurasi. Topik yang belum sempat dikurasi akan ` +
      `otomatis ikut kalau kamu jalankan script ini lagi nanti.\n`
    );
  }

  // 3. Deterministik: tentukan bagian & unit dari topic_name (lookup langsung)
  const withBagianUnit = assignBagianUnit(curated);

  fs.writeFileSync("preview-klasifikasi.json", JSON.stringify(withBagianUnit, null, 2));
  console.log(
    `\nPreview klasifikasi disimpan ke preview-klasifikasi.json — CEK DULU sebelum lanjut ` +
    `(ini bagian yang paling mungkin meleset, karena AI yang menaksir topik tiap kata).\n`
  );

  // 4. Kelompokkan per (bagian, unit), lalu URUTKAN per BAGIAN dulu (baru
  // unit di dalamnya) — supaya 1 Bagian SELESAI TOTAL (semua 10 Unit-nya)
  // sebelum pindah ke Bagian berikutnya. [FIX: sebelumnya diurutkan per
  // unitNumber dulu — itu peninggalan desain LAMA waktu 1 nama topik masih
  // muncul berkali-kali di 10 Bagian sekaligus (jadi masuk akal selesaikan
  // "semua kemunculan 1 topik" dulu). Sekarang 1 topik = 1 slot tetap,
  // urutan lama itu malah bikin proses loncat-loncat antar Bagian (Bagian
  // 1 Unit 1 → Bagian 2 Unit 1 → ... baru balik ke Bagian 1 Unit 2) — kalau
  // quota habis di tengah jalan, yang kesimpan cuma "Unit 1 doang" di SEMUA
  // Bagian, bukan 1 Bagian yang beneran lengkap & siap dipakai user.]
  const groups = {}; // "bagian-unit" -> { bagianNumber, unitNumber, topicName, words: [] }
  for (const w of withBagianUnit) {
    const key = `${w.bagianNumber}-${w.unitNumber}`;
    if (!groups[key]) groups[key] = { bagianNumber: w.bagianNumber, unitNumber: w.unitNumber, topicName: w.topic_name, words: [] };
    groups[key].words.push(w);
  }
  const groupList = Object.values(groups).sort(
    (a, b) => a.bagianNumber - b.bagianNumber || a.unitNumber - b.unitNumber
  );

  if (!commit) {
    console.log(`Ditemukan ${groupList.length} kombinasi Bagian/Unit yang akan dibuat/diisi:`);
    for (const g of groupList) {
      console.log(`  Bagian ${g.bagianNumber}, Unit ${g.unitNumber} (${g.topicName}): ${g.words.length} kata`);
    }
    console.log("\nMode preview — belum ada yang disimpan ke database. Tambahkan --commit kalau sudah yakin.");
    return;
  }

  // 5. Untuk tiap (bagian, unit), urut per topik: skeleton + generate
  // exercises + simpan LANGSUNG ke Supabase satu-satu. Kalau quota habis
  // di tengah, berhenti dengan rapi — semua unit yang SUDAH diproses tetap
  // tersimpan & langsung muncul di web; sisanya tinggal lanjutkan nanti.
  const subject = await ensureSubject();
  const changedTopicNames = []; // poin O: cuma diisi topik yang BENERAN diproses (bukan yang di-skip signature-nya)
  let quotaHit = false;
  const processGroup = async (g) => {
    console.log(`\nMemproses Bagian ${g.bagianNumber}, Unit ${g.unitNumber} (${g.topicName})...`);
    const unit = await ensureUnit(subject.id, g.bagianNumber);
    const topic = await ensureTopic(unit.id, g.unitNumber, g.topicName);

    // Poin L+M: kalau signature kosakata topik ini SAMA PERSIS kayak yang
    // tersimpan dari run sebelumnya, berarti gak ada kosakata baru yang
    // relevan buat topik ini → skip TOTAL (0 panggilan AI, 0 perubahan
    // database). Ini yang bikin "Unit 5-10 gak perlu diregenerate" kalau
    // cuma nambah kosakata ke topik Unit 1.
    // CUMA berlaku di mode NORMAL — mode --rebalance sengaja BYPASS ini,
    // karena rebalance justru mau evaluasi ulang topik walau kosakatanya
    // gak berubah (tujuannya beda: benerin posisi, bukan reaksi ke kata baru).
    const newSignature = computeVocabSignature(g.words);
    if (!rebalanceMode && topic.vocab_signature === newSignature) {
      const incomplete = await topicHasIncompleteSegments(topic.id);
      if (!incomplete) {
        console.log(`  (lewati topik — kosakata sama persis kayak run sebelumnya, semua segmen sudah lengkap)`);
        return;
      }
      console.log(`  (kosakata sama persis, TAPI ada segmen yang belum lengkap — lanjut top-up)`);
    }

    // Poin S: MODE --rebalance — evaluasi ulang SEMUA kata (lama+baru) di
    // topik ini, TERPISAH dari alur normal (yang cuma nempatkan kata baru
    // tanpa mikirin ulang kata lama). Preview SELALU aman (gak nulis apa
    // pun). Commit CUMA mindah level_id kata yang perlu — vocab_id gak
    // berubah, exercise lama gak pernah dihapus (poin N).
    if (rebalanceMode) {
      const levels = await ensureLevels(topic.id);
      const rebalancePlan = await planFullRebalance(supabase, callLadiz, cleanJson, STATIC_CONTENT_SLOTS, topic.id, g.topicName, g.words);

      console.log(`\n📊 REBALANCE PREVIEW — Bagian ${g.bagianNumber}, Unit ${g.unitNumber} (${g.topicName})`);
      console.log(`  Kosakata baru: ${rebalancePlan.newWords.length} kata${rebalancePlan.newWords.length > 0 ? " (" + rebalancePlan.newWords.map((w) => w.kata_arab).join(", ") + ")" : ""}`);
      const duplicatesInThisTopic = g.words.filter((w, i, arr) => arr.findIndex((x) => x.kata_arab === w.kata_arab) !== i);
      console.log(`  Kosakata duplikat (di CSV, topik ini): ${duplicatesInThisTopic.length > 0 ? [...new Set(duplicatesInThisTopic.map((w) => w.kata_arab))].join(", ") : "(tidak ada)"}`);
      console.log(`  Kosakata yang berubah posisi: ${rebalancePlan.moved.length} kata`);
      for (const m of rebalancePlan.moved) console.log(`    - ${m.kata_arab}: level ${m.fromLevel} → level ${m.toLevel}`);
      const affectedLevelNumbers = [...new Set(rebalancePlan.moved.flatMap((m) => [m.fromLevel, m.toLevel]))];
      console.log(`  Level/node terdampak: ${affectedLevelNumbers.length > 0 ? affectedLevelNumbers.join(", ") : "(tidak ada)"}`);
      console.log(`  Exercise yang DIPERTAHANKAN (tidak disentuh): ${rebalancePlan.keptExercises} soal`);
      console.log(`  Exercise di level terdampak (TETAP ADA, gak dihapus, tapi levelnya mungkin butuh top-up soal baru setelah rebalance): ${rebalancePlan.exercisesNeedingRegenerate.length} soal`);
      const { data: curVersion } = await supabase.from("curriculum_versions").select("version_number").eq("subject_id", subject.id).order("version_number", { ascending: false }).limit(1).maybeSingle();
      console.log(`  Curriculum version saat ini: ${curVersion?.version_number || "(belum ada)"}`);

      if (commit) {
        console.log(`  → --commit terdeteksi, menerapkan ${rebalancePlan.moved.length} perpindahan posisi...`);
        for (const m of rebalancePlan.moved) {
          const targetLevelId = rebalancePlan.levelIdByNumber.get(m.toLevel);
          if (!targetLevelId) continue;
          const { error: moveError } = await supabase.from("vocab_items").update({ level_id: targetLevelId }).eq("id", m.vocabId);
          if (moveError) console.warn(`    ⚠ Gagal pindahkan "${m.kata_arab}":`, moveError.message);
        }
        console.log(`  ✓ Selesai. Catatan: level yang terdampak mungkin butuh soal baru (top-up) — jalankan script ini SEKALI LAGI TANPA --rebalance buat itu.`);
      } else {
        console.log(`  (mode preview — TIDAK ADA yang ditulis ke database. Tambahkan --commit buat menerapkan.)`);
      }
      return; // rebalance topik ini selesai, lanjut ke grup berikutnya (gak masuk alur generate exercise normal)
    }

    const levels = await ensureLevels(topic.id);
    const plan = buildLevelPlan();

    // Poin I + K + J: kata BARU ditempatkan ke level yang paling sesuai
    // (paling longgar isinya) dengan urutan pedagogis dari AI (divalidasi
    // program dulu) — kata LAMA yang sudah ada di database TIDAK PERNAH
    // dipindah/disentuh, jadi aman dijalankan berulang kali walau CSV
    // terus nambah kata baru.
    const vocabByLevel = await planNewWordPlacement(supabase, callLadiz, cleanJson, STATIC_CONTENT_SLOTS, topic.id, g.topicName, g.words);

    for (let i = 0; i < levels.length; i++) {
      const step = plan[i];
      const levelRow = levels[i];

      // Poin STATIC VS ADAPTIVE: practice & review TIDAK digenerate statis
      // sama sekali di sini — kontennya dibangun on-the-fly per user pas
      // dimainkan (lihat api/adaptive-exercise.js). Level-nya tetap ada
      // (skeleton dari ensureLevels), cuma gak diisi vocab_items/exercises
      // dari proses ini.
      if (step.node_type === "practice" || step.node_type === "review") {
        console.log(`  (lewati — level ${step.order_index} tipe "${step.node_type}" sekarang adaptive, bukan statis)`);
        continue;
      }

      const vocabForLevel = vocabByLevel[step.order_index] || [];
      let vocabForAI = vocabForLevel;

      // Kalau gak ada kata BARU buat level ini (vocabForLevel kosong),
      // TAPI ternyata ada segmen yang belum lengkap (dicek di bawah),
      // fallback pakai kosakata yang SUDAH ADA di level ini — biar top-up
      // tetap bisa jalan (generate soal TAMBAHAN dari kata yang sudah ada),
      // bukan cuma bisa top-up kalau kebetulan ada kata baru yang nyasar
      // ke level ini.
      let vocabForTopUpFallback = null;
      async function getVocabForAI() {
        if (vocabForLevel.length > 0) return vocabForLevel;
        if (vocabForTopUpFallback === null) {
          const { data } = await supabase.from("vocab_items").select("kata_arab, latin, arti, contoh_kalimat").eq("level_id", levelRow.id);
          vocabForTopUpFallback = data || [];
        }
        return vocabForTopUpFallback;
      }

      // Sudah pernah digenerate sebelumnya? Cek PER SEGMEN (1 bulatan = 4
      // segmen soal terpisah), bukan per level:
      // - segmen sudah >= 8 soal → LENGKAP, lewati (hemat quota)
      // - segmen ada tapi < 8 soal → TOP UP (nambah sampai cukup, soal
      //   lama TETAP ada, tidak dihapus/diulang dari nol)
      // - segmen belum ada sama sekali (0 soal) → generate baru
      // Ini juga jawaban buat "kalau nambah kosakata lagi nanti disesuaikan
      // lagi": segmen yang belum lengkap (<8) otomatis di-top-up pakai
      // kosakata terbaru waktu script dijalankan ulang. Segmen yang SUDAH
      // lengkap (>=8) tidak disentuh lagi — supaya tidak boros quota
      // generate ulang soal yang sudah bagus. Kalau kamu mau maksa 1 segmen
      // tertentu digenerate ulang total (misal kosakatanya berubah banyak),
      // hapus dulu baris exercises segmen itu manual di Supabase, baru
      // jalankan script ini lagi.
      const segmentCounts = await getSegmentExerciseCounts(levelRow.id);
      const totalSegments = segmentsForNodeType(step.node_type);

      let allExercisesThisLevel = [];
      // Diisi dari soal yang SUDAH ADA di database dulu (semua segmen,
      // termasuk yang sudah lengkap/dilewati) — baru ditambah lagi tiap
      // ada soal baru yang digenerate di bawah. Ini kunci perbaikan biar
      // soal tidak mirip/dobel antar segmen.
      const avoidList = await getExistingExerciseSummaries(levelRow.id);
      if (avoidList.length > 20) avoidList.splice(0, avoidList.length - 20); // cukup 20 terakhir, biar prompt tidak kepanjangan
      for (let seg = 1; seg <= totalSegments; seg++) {
        const existingCount = segmentCounts[seg] || 0;
        if (existingCount < TARGET_MIN_PER_SEGMENT) vocabForAI = await getVocabForAI();

        if (vocabForAI.length === 0) {
          console.warn(`  ⚠ Level ${step.order_index} segmen ${seg} (${step.node_type}): tidak ada kosakata — dilewati.`);
          continue;
        }
        if (existingCount >= TARGET_MIN_PER_SEGMENT) {
          console.log(`  (lewati, sudah lengkap: ${existingCount} soal) Level ${step.order_index} segmen ${seg} (${step.node_type})`);
          continue;
        }

        const isTopUp = existingCount > 0;
        console.log(
          isTopUp
            ? `  Top-up segmen ${seg}: baru ${existingCount}/${TARGET_MIN_PER_SEGMENT} soal, generating tambahan...`
            : `  Generating soal level ${step.order_index} segmen ${seg} (${step.node_type})...`
        );
        try {
          let newExercises = await generateExercisesForLevel(g.topicName, step.node_type, vocabForAI, avoidList);
          // Top-up (mis. setelah audit menghapus soal cacat): simpan HANYA sebanyak yang kurang
          // supaya segmen pas mencapai batas bawah, bukan menambah 8-13 soal lagi.
          if (isTopUp) {
            const need = TARGET_MIN_PER_SEGMENT - existingCount;
            if (newExercises.length > need) newExercises = newExercises.slice(0, need);
          }
          await saveLevelContent(levelRow, vocabForLevel, newExercises, useAudio, seg);
          // Simpan ringkasan soal segmen ini, biar segmen BERIKUTNYA (seg+1)
          // di level yang sama tau apa yang harus dihindari. Dibatasi biar
          // prompt gak makin gemuk tiap segmen (ambil maks 20 terakhir).
          avoidList.push(...newExercises.map(summarizeExercise));
          if (avoidList.length > 20) avoidList.splice(0, avoidList.length - 20);
          // vocabForLevel cuma perlu di-insert 1x (dicek anti-dobel di
          // dalam saveLevelContent sendiri), jadi aman dipanggil tiap segmen.
        } catch (err) {
          if (err.quotaExceeded) {
            console.warn(
              `\n⚠ Quota habis di tengah generate soal (Bagian ${g.bagianNumber}, Unit ` +
              `${g.unitNumber}, Level ${step.order_index}, segmen ${seg}). Semua yang SUDAH ` +
              `diproses sebelum ini tetap tersimpan & sudah bisa muncul di web. Jalankan lagi ` +
              `script ini (masih dengan --commit) nanti untuk lanjutkan sisanya.\n`
            );
            quotaHit = true;
            return; // berhenti rapi, bukan crash
          }
          // [FIX] Sebelumnya error APAPUN selain quotaExceeded (termasuk JSON
          // rusak yang gagal terus walau udah di-retry di generateExercisesForLevel)
          // dilempar lagi ke atas -- BIKIN SELURUH SCRIPT BERHENTI, walau ini
          // cuma 1 segmen di 1 topik dari ratusan yang diproses. Sekarang
          // di-skip DOANG (segmen ini kelewat, lanjut ke segmen/level/topik
          // berikutnya) -- segmen yang gagal ini otomatis kecoba lagi kalau
          // script dijalankan ulang nanti (existingCount-nya masih di bawah
          // TARGET_MIN_PER_SEGMENT, jadi ke-detect belum lengkap).
          console.error(
            `\n⚠ Segmen ${seg} (Bagian ${g.bagianNumber}, Unit ${g.unitNumber}, Level ${step.order_index}, ` +
            `${step.node_type}) tetap gagal setelah semua percobaan — DILEWATI, lanjut ke segmen/topik ` +
            `berikutnya. Jalankan script ini lagi nanti untuk nyoba segmen ini ulang. Error: ${err.message}\n`
          );
          continue;
        }
      }
    }

    changedTopicNames.push(g.topicName);

    // Poin L+M: tandai topik ini "sudah diproses buat kosakata versi ini" —
    // run BERIKUTNYA yang kosakatanya PERSIS SAMA bakal skip total (lihat
    // pengecekan signature di atas). Sengaja diletakkan di SINI (bukan di
    // awal), supaya kalau proses berhenti di tengah (quota habis dll),
    // signature TIDAK ikut ke-update — topik ini akan dicoba lagi dari
    // awal di run berikutnya, bukan dianggap keliru "sudah beres".
    const { error: sigError } = await supabase
      .from("topics")
      .update({ vocab_signature: newSignature })
      .eq("id", topic.id);
    if (sigError) console.warn(`  ⚠ Gagal update vocab_signature topik "${g.topicName}":`, sigError.message);
    };

  // Proses beberapa topik BERSAMAAN (default 3, ubah pakai --concurrency N; 1 = berurutan seperti dulu).
  // Log dari topik yang jalan bersamaan akan selang-seling.
  const ciIdx = process.argv.indexOf("--concurrency");
  const concurrency = Math.max(1, Math.min(8, Number(ciIdx !== -1 ? process.argv[ciIdx + 1] : 3) || 3));
  let nextGroup = 0;
  const worker = async () => {
    while (!quotaHit && nextGroup < groupList.length) {
      const g = groupList[nextGroup++];
      await processGroup(g);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, groupList.length) }, worker));
  if (quotaHit) return;

  // Poin O + U: catat versi kurikulum BARU — TAPI CUMA kalau memang ada
  // topik yang beneran berubah run ini. Logic-nya sekarang di
  // lib/curriculum-engine.mjs (recordCurriculumVersionIfChanged).
  const versionResult = await recordCurriculumVersionIfChanged(supabase, subject.id, changedTopicNames);
  if (versionResult) {
    console.log(`\n📌 Curriculum version ${versionResult.versionNumber} tercatat — total ${versionResult.totalVocabCount} kosakata, topik berubah: ${[...new Set(changedTopicNames)].join(", ")}`);
  } else {
    console.log("\n(Gak ada perubahan kurikulum run ini — curriculum_version tidak nambah baris baru.)");
  }

  console.log("\nSelesai: semua kosakata & soal tersimpan ke database.");
}

// Guard: cuma jalankan main() kalau file ini dieksekusi LANGSUNG sebagai
// script ("node generate-vocab-v2.mjs ..."), BUKAN waktu di-import sebagai
// modul oleh script lain (mis. migrate-bagian-assignment.mjs, yang cuma
// butuh pakai ulang supabase client + ensureUnit/ensureTopic/ensureLevels
// dari sini, tanpa ikut menjalankan alur generate CSV segala macam).
//
// [FIX WINDOWS] Perbandingan string manual `file://${process.argv[1]}`
// SELALU gagal di Windows -- process.argv[1] pakai backslash
// (C:\Users\...), sedangkan import.meta.url pakai format URL asli
// (file:///C:/Users/..., forward-slash + 3 garis miring). Dua-duanya TIDAK
// PERNAH sama persis di Windows, jadi main() TIDAK PERNAH kepanggil sama
// sekali -- script diam-diam keluar tanpa error apa pun (karena memang
// gak ada yang error, cuma gak pernah mulai). pathToFileURL() dari Node
// sendiri yang bikin konversi path->URL ini benar di SEMUA OS.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Gagal:", err);
    // [FIX WINDOWS] JANGAN process.exit(1) di sini: di Windows, exit paksa selagi
    // koneksi fetch/Supabase masih menutup bikin Node crash dengan pesan
    // 'Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) ... async.c' --
    // pesan itu MENIMPA/menyembunyikan error asli di atasnya. exitCode = 1
    // tetap menandai gagal, tapi biarkan Node menutup koneksi dengan rapi.
    process.exitCode = 1;
  });
}
