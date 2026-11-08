// scripts-generate-vocab/generate-intermediate.mjs
//
// Generator soal LEVANTINE level INTERMEDIATE (Bagian 11-15). Dipisah dari
// generate-vocab-v2.mjs (Beginner, Bagian 1-10), tapi LOGIKA-nya sama:
// skeleton units -> topics -> levels, penempatan kata, top-up per segmen,
// duplicate prevention, audio, curriculum version — semuanya dipakai ulang
// dengan meng-import fungsi dari generate-vocab-v2.mjs.
//
// BEDA dengan Beginner:
//   * Soal didominasi SUSUN KALIMAT (word_order): Arab -> terjemahan, terjemahan -> Arab,
//     dan versi SUARA (audioOnly: kalimat tidak ditampilkan, user hanya mendengar).
//   * Banyak MATCHING PAIRS (5 pasang).
//   * Kalimat lebih panjang (5-9 kata), memakai kata sambung, negasi, kala lampau/depan.
//   * Topik tiap Bagian BERBEDA dari 10 Bagian Beginner (lihat INTERMEDIATE_CURRICULUM di bawah).
//   * Generate PER BAGIAN: `--bagian 11` sampai tuntas dulu, baru Bagian 12, dst.
//
// KUALITAS (menjawab keluhan: soal bernama orang, cacat struktural, ambigu, gender):
//   * Nama orang DILARANG di lesson; di story/conversation maksimal 3 soal yang menyebut nama.
//   * Gender wajib JELAS: kalimat Indonesia yang jadi sumber terjemahan Arab selalu menyebut
//     gender ("kamu (perempuan)", "dia (laki-laki)", "kalian (perempuan)") sehingga HANYA SATU
//     bentuk Arab yang benar.
//   * Semua soal diperiksa: struktural -> AI judge nama -> AI judge ambiguitas (dengan retry)
//     -> alternatif sinonim susun-kata. Soal yang dibuang langsung DIGANTI (maks 3 putaran)
//     dengan umpan balik alasan penolakan.
//
// VERSI 2 (struktur Intermediate baru):
//   * Tiap Unit = 4 bulatan PELAJARAN (4 segmen soal per bulatan) + 1 bulatan REVIEW (1 sesi, soal BARU
//     dari kata-kata yang sama; bukan salinan soal pelajaran). Dulu 12 bulatan/unit seperti Beginner.
//   * Tipe soal meniru contoh Duolingo: susun kalimat, ketuk pasangan, lengkapi kalimat, dengar lalu susun,
//     bacaan + pertanyaan, lengkapi dialog, arti kata, dan soal BERGAMBAR (karakter planet bervariasi,
//     field content.scene -> komponen <PlanetScene /> di aplikasi).
//   * Kata di luar CSV BOLEH ditambahkan AI bila soal memang butuh, tapi WAJIB kosakata ammiyah Yordania:
//     dideklarasikan lewat "extra_words", diperiksa AI judge kedua, dan dicatat di extra-words-intermediate-B*.json.
//   CATATAN: Bagian yang SUDAH terlanjur di-commit dengan struktur 12 bulatan harus di-reset dulu
//   (hapus levels/exercises topik Bagian itu) sebelum memakai struktur 4+1 ini.
//
// PENGGUNAAN
//   Preview (tidak menulis apa pun ke database; hanya klasifikasi + kurasi):
//     node scripts-generate-vocab/generate-intermediate.mjs --bagian 11 --csv kosakata-ammiyah.csv
//   Simpan beneran:
//     node scripts-generate-vocab/generate-intermediate.mjs --bagian 11 --csv kosakata-ammiyah.csv --commit
//   Dengan audio (ElevenLabs; WAJIB kalau mau soal "susun dari suara" bisa diputar):
//     ... --commit --audio
//   Satu topik saja (untuk uji coba): tambah  --topic "Menceritakan Pengalaman"
//
// CSV: MEMAKAI FILE KOSAKATA YANG SAMA dengan Beginner (kosakata-ammiyah.csv: kata_arab, latin, arti, contoh_kalimat).
// Tambahkan kata baru langsung ke file itu; --csv hanya perlu kalau mau file lain. Kata yang tidak
// cocok dengan 10 topik Bagian ini disimpan ke unmatched-intermediate.json (tidak hilang)
// dan bisa dipakai lagi untuk Bagian lain.

import "dotenv/config";
import fs from "fs";
import { pathToFileURL } from "node:url";
import * as V2 from "./generate-vocab-v2.mjs";
import {
  loadExistingSignatures,
  filterDuplicateExercises,
} from "../lib/exercise-validator.mjs";
import {
  supabase,
  ensureSubject,
  ensureUnit,
  ensureTopic,
  callLadiz,
  cleanJson,
  loadFlatVocabCsv,
  selectBestWordsForTopic,
  saveLevelContent,
  getSegmentExerciseCounts,
  getExistingExerciseSummaries,
  topicHasIncompleteSegments,
  segmentsForNodeType,
  TARGET_MIN_PER_SEGMENT,
  summarizeExercise,
  refineExerciseQuality,
} from "./generate-vocab-v2.mjs";
import {
  computeVocabSignature,
  planNewWordPlacement,
  recordCurriculumVersionIfChanged,
} from "../lib/curriculum-engine.mjs";
import { shuffleAnswerPositions } from "../lib/exercise-validator.mjs";

// ============================================================
// KURIKULUM INTERMEDIATE — 5 Bagian x 10 topik. Bebas kamu ubah nama/hint-nya,
// tapi URUTAN topik = nomor Unit (1-10), jadi jangan diubah urutannya setelah
// ada data di database.
// ============================================================
export const INTERMEDIATE_CURRICULUM = {
  11: {
    title: "Percakapan Lanjutan",
    topics: [
      ["Menceritakan Pengalaman", "bercerita tentang kejadian kemarin/lalu, kata kerja bentuk lampau"],
      ["Rencana & Niat", "rencana masa depan, mau/akan, janji, target"],
      ["Meminta & Menawarkan Bantuan", "minta tolong, menawarkan bantuan, menolak dengan sopan"],
      ["Memberi Saran & Instruksi", "sebaiknya, jangan, langkah-langkah, perintah sopan"],
      ["Membandingkan Hal", "lebih ... dari, paling, sama seperti, perbedaan"],
      ["Alasan & Sebab Akibat", "karena, jadi, supaya, meskipun, penjelasan alasan"],
      ["Setuju & Tidak Setuju", "menyetujui, menolak pendapat, ragu-ragu, kompromi"],
      ["Keinginan & Kebutuhan", "ingin, butuh, harus, boleh, preferensi"],
      ["Menanyakan Pendapat", "menurutmu, bagaimana kalau, memilih di antara opsi"],
      ["Kesopanan & Basa-basi", "ungkapan sopan, menerima tamu, menolak halus, pujian"],
    ],
  },
  12: {
    title: "Kota & Layanan Publik",
    topics: [
      ["Kantor Pos & Kurir", "mengirim paket, alamat, resi, ongkos kirim"],
      ["Kantor Polisi & Pelaporan", "melapor kehilangan, saksi, kejadian, kronologi"],
      ["Layanan Pemerintah", "kantor administrasi, formulir, antre, persyaratan"],
      ["Perpustakaan", "meminjam, mengembalikan, kartu anggota, mencari buku"],
      ["Masjid & Tempat Ibadah", "salat, wudu, khotbah, tata tertib"],
      ["Rumah Sakit & Rawat Inap", "pendaftaran, kamar rawat, jam besuk, perawat"],
      ["Hotel & Penginapan", "check-in, kamar, fasilitas, sarapan, check-out"],
      ["Reservasi & Pemesanan", "memesan meja/tiket, konfirmasi, membatalkan, jadwal"],
      ["Keluhan & Komplain", "menyampaikan masalah, meminta ganti rugi, rusak, salah"],
      ["Layanan Pelanggan", "telepon layanan, menunggu, tiket bantuan, solusi"],
    ],
  },
  13: {
    title: "Pekerjaan & Bisnis",
    topics: [
      ["Bisnis & Perdagangan", "toko, pemasok, stok, laba rugi, pelanggan"],
      ["Kontrak & Perjanjian", "syarat, tanda tangan, durasi, kesepakatan"],
      ["Gaji & Keuangan Kerja", "gaji, bonus, lembur, potongan, slip gaji"],
      ["Presentasi & Laporan", "slide, data, kesimpulan, memaparkan hasil"],
      ["Negosiasi", "tawar-menawar bisnis, penawaran, kompromi, tenggat"],
      ["Email & Surat Resmi", "salam pembuka, lampiran, hormat kami, permohonan"],
      ["Proyek & Tenggat", "jadwal, tim, tugas, progres, terlambat"],
      ["Pertemuan Klien", "menyambut klien, agenda, kebutuhan klien, tindak lanjut"],
      ["Karier & Cita-cita", "promosi, keahlian, pelatihan, tujuan hidup"],
      ["Kewirausahaan", "memulai usaha, modal, pemasaran, risiko"],
    ],
  },
  14: {
    title: "Alam, Sains & Lingkungan",
    topics: [
      ["Hewan & Alam Liar", "hewan liar, habitat, makanan hewan, melindungi"],
      ["Tumbuhan & Pertanian", "menanam, panen, ladang, pupuk, musim tanam"],
      ["Laut & Pantai", "ombak, ikan, nelayan, perahu, menyelam"],
      ["Gunung & Gurun", "mendaki, pasir, oasis, perjalanan padang pasir"],
      ["Musim & Iklim", "perubahan musim, suhu, perubahan iklim"],
      ["Energi & Sumber Daya", "listrik, air, minyak, energi terbarukan, hemat"],
      ["Ilmu Pengetahuan Dasar", "percobaan, hukum alam, materi, ukuran, alat sains"],
      ["Antariksa & Planet", "bumi, bulan, bintang, roket, tata surya"],
      ["Bencana Alam", "gempa, banjir, kekeringan, evakuasi, bantuan"],
      ["Penelitian & Penemuan", "ilmuwan, hipotesis, hasil, penemuan, teknologi baru"],
    ],
  },
  15: {
    title: "Masyarakat, Budaya & Sejarah",
    topics: [
      ["Sejarah Singkat", "peristiwa masa lalu, kerajaan, tokoh sejarah umum, abad"],
      ["Tradisi & Perayaan", "hari raya, adat perayaan, persiapan, kebiasaan keluarga"],
      ["Kuliner Khas Levant", "hidangan khas, bahan, cara menyajikan, jamuan"],
      ["Pakaian & Mode", "pakaian tradisional, ukuran, bahan, gaya"],
      ["Seni & Kerajinan", "lukisan, kaligrafi, kerajinan tangan, pameran"],
      ["Hukum & Aturan", "peraturan, hak, kewajiban, denda, izin"],
      ["Pendidikan & Masyarakat", "sekolah, beasiswa, kegiatan sosial, relawan"],
      ["Nilai & Etika", "kejujuran, hormat, tanggung jawab, tolong-menolong"],
      ["Mengenal Yordania", "kota, tempat bersejarah, kebiasaan orang Yordania"],
      ["Ungkapan & Peribahasa", "ungkapan umum, peribahasa Levantine, kiasan"],
    ],
  },
};

// Struktur unit Intermediate: 4 bulatan pelajaran + 1 bulatan review (static, 1 sesi).
const INTERMEDIATE_PLAN = [
  { order_index: 1, node_type: "lesson" },
  { order_index: 2, node_type: "lesson" },
  { order_index: 3, node_type: "lesson" },
  { order_index: 4, node_type: "lesson" },
  { order_index: 5, node_type: "review" },
];
const INTERMEDIATE_SLOTS = INTERMEDIATE_PLAN.filter((p) => p.node_type === "lesson");

async function ensureIntermediateLevels(topicId) {
  const rows = [];
  for (const step of INTERMEDIATE_PLAN) {
    const { data: existing } = await supabase.from("levels").select("*").eq("topic_id", topicId).eq("level_number", step.order_index).maybeSingle();
    if (existing) { rows.push(existing); continue; }
    const { data, error } = await supabase.from("levels").insert({ topic_id: topicId, level_number: step.order_index, node_type: step.node_type }).select().single();
    if (error) throw error;
    rows.push(data);
  }
  // Peringatan bila topik ini masih punya level lama (struktur 12 bulatan).
  const { data: all } = await supabase.from("levels").select("level_number").eq("topic_id", topicId);
  const extra = (all || []).filter((l) => l.level_number > INTERMEDIATE_PLAN.length);
  if (extra.length) console.warn(`  ⚠ Topik ini masih punya ${extra.length} level lama (nomor > 5, struktur 12 bulatan). Reset dulu supaya unit hanya 4+1 bulatan.`);
  return rows;
}

const TARGET_WORDS_PER_TOPIC = 120;
// Unit dengan kosakata di bawah ini DILEWATI: 4 pelajaran x 4 segmen + review butuh puluhan panggilan AI,
// dan dengan 1-9 kata semua soalnya berputar di kata yang sama (banyak duplikat, kuota habis percuma).
// Tambah kosakata ke CSV dulu, atau turunkan batas lewat --min-words N (jangan terlalu kecil).
const DEFAULT_MIN_WORDS_PER_UNIT = 15;
// KOSAKATA DARI AI: unit yang kata CSV-nya kurang dari ini DILENGKAPI AI sampai target (kata ammiyah Yordania,
// diperiksa AI judge kedua, disimpan di ai-vocab-intermediate-B*.json supaya tidak dibuat ulang tiap run).
// Kata ini jadi vocab_items biasa (bisa jadi fokus soal), bukan sekadar pelengkap kalimat.
const DEFAULT_TARGET_WORDS_PER_UNIT = 40;

// ============================================================
// 1. KLASIFIKASI kata -> salah satu dari 10 topik Bagian ini (atau TIDAK_COCOK)
// ============================================================
const NO_MATCH = "TIDAK_COCOK";

async function classifyBatch(words, topics) {
  const topicList = topics.map(([name, hint], i) => `${i + 1}. ${name} — ${hint}`).join("\n");
  const wordList = words.map((w, i) => `${i + 1}. ${w.kata_arab} (${w.latin}) = ${w.arti}`).join("\n");
  const prompt = `Kelompokkan tiap kata Bahasa Arab Levantine berikut ke SALAH SATU dari ${topics.length} topik ini
(WAJIB pakai nama topik PERSIS seperti tertulis). Kalau kata itu BENAR-BENAR tidak cocok dengan topik mana pun,
isi "${NO_MATCH}" (jangan dipaksakan):
${topicList}

Daftar kata:
${wordList}

Balas HANYA JSON array (jumlah & urutan sama persis dengan daftar), tanpa teks lain:
[ { "kata_arab": "...", "topic_name": "...(persis salah satu nama topik di atas, atau ${NO_MATCH})..." }, ... ]`;

  const raw = await callLadiz(prompt, 4000);
  let parsed;
  try {
    parsed = JSON.parse(cleanJson(raw));
  } catch (err) {
    if (words.length > 1) {
      const mid = Math.ceil(words.length / 2);
      console.warn(`  ⚠ JSON klasifikasi rusak (${err.message}) — dipecah ${mid} + ${words.length - mid}...`);
      const a = await classifyBatch(words.slice(0, mid), topics);
      const b = await classifyBatch(words.slice(mid), topics);
      return [...a, ...b];
    }
    return [{ ...words[0], topic_name: NO_MATCH }];
  }
  const valid = new Set(topics.map(([n]) => n));
  return words.map((w, i) => {
    const m = parsed.find((p) => p.kata_arab === w.kata_arab) || parsed[i];
    const name = m?.topic_name;
    return { ...w, topic_name: valid.has(name) ? name : NO_MATCH };
  });
}

const ALL_TOPICS = Object.values(INTERMEDIATE_CURRICULUM).flatMap((c) => c.topics);
const CLASSIFY_ALL_FILE = "classify-intermediate-all.json";

// Kata yang sudah dipakai Beginner (kept di curation-checkpoint.json).
function loadBeginnerUsedWords(file = "curation-checkpoint.json") {
  const used = new Set();
  if (!fs.existsSync(file)) return used;
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8"));
    for (const t of Object.values(data)) for (const w of t.kept || []) used.add(w.kata_arab);
  } catch { /* abaikan */ }
  return used;
}

async function classifyAll(words, topics, checkpointFile, batchSize = 30, maxNew = Infinity) {
  let results = [];
  if (fs.existsSync(checkpointFile)) {
    try { results = JSON.parse(fs.readFileSync(checkpointFile, "utf-8")); } catch { results = []; }
    console.log(`Checkpoint klasifikasi: ${results.length} kata sudah diklasifikasi, dilanjutkan.`);
  } else {
    // Migrasi: pakai hasil lama per-Bagian (classify-intermediate-B11..B15.json).
    // Hanya yang COCOK yang dipakai ulang; TIDAK_COCOK lama bisa jadi cocok di Bagian lain.
    const valid = new Set(topics.map(([n]) => n));
    const seen = new Set();
    for (const f of fs.readdirSync(".").filter((x) => /^classify-intermediate-B\d+\.json$/.test(x))) {
      try {
        for (const r of JSON.parse(fs.readFileSync(f, "utf-8"))) {
          if (valid.has(r.topic_name) && !seen.has(r.kata_arab)) { seen.add(r.kata_arab); results.push(r); }
        }
      } catch { /* abaikan */ }
    }
    if (results.length) console.log(`Migrasi: ${results.length} klasifikasi lama dipakai ulang.`);
  }
  const done = new Set(results.map((r) => r.kata_arab));
  let remaining = words.filter((w) => !done.has(w.kata_arab));
  if (remaining.length > maxNew) {
    console.log(`Mode --classify-limit: hanya ${maxNew} dari ${remaining.length} kata baru diklasifikasi di run ini (sisanya di run berikutnya).`);
    remaining = remaining.slice(0, maxNew);
  }
  let incomplete = false;
  for (let i = 0; i < remaining.length; i += batchSize) {
    const batch = remaining.slice(i, i + batchSize);
    console.log(`Mengklasifikasi kata ${i + 1}-${i + batch.length} dari ${remaining.length} (sisa)...`);
    try {
      results.push(...(await classifyBatch(batch, topics)));
      fs.writeFileSync(checkpointFile, JSON.stringify(results, null, 2));
    } catch (err) {
      if (err.quotaExceeded) {
        console.warn(`\n⚠ Quota/koneksi AI bermasalah di tengah klasifikasi. ${results.length} kata TERSIMPAN di ${checkpointFile}; jalankan lagi untuk lanjut.\n`);
        incomplete = true;
        break;
      }
      throw err;
    }
  }
  return { results, incomplete };
}

// ============================================================
// 2. KURASI per topik (resumable)
// ============================================================
async function curate(classified, curationFile) {
  const byTopic = {};
  for (const w of classified) (byTopic[w.topic_name] ||= []).push(w);
  let done = {};
  if (fs.existsSync(curationFile)) {
    try { done = JSON.parse(fs.readFileSync(curationFile, "utf-8")); } catch { done = {}; }
  }
  const result = [];
  let incomplete = false;
  for (const topicName of Object.keys(byTopic)) {
    const candidates = byTopic[topicName];
    const prevSeen = new Set(done[topicName]?.seen || []);
    const prevKept = done[topicName]?.kept || [];
    const fresh = candidates.filter((w) => !prevSeen.has(w.kata_arab));
    if (fresh.length === 0) { result.push(...prevKept); continue; }
    const pool = [...prevKept, ...fresh];
    let chosen = pool;
    if (pool.length > TARGET_WORDS_PER_TOPIC) {
      console.log(`Kurasi "${topicName}": ${pool.length} kandidat -> target ~${TARGET_WORDS_PER_TOPIC}...`);
      try {
        chosen = await selectBestWordsForTopic(topicName, pool, TARGET_WORDS_PER_TOPIC);
      } catch (err) {
        if (err.quotaExceeded) { incomplete = true; console.warn("⚠ Quota/koneksi AI bermasalah di tengah kurasi; progres tersimpan."); break; }
        throw err;
      }
    }
    done[topicName] = { seen: [...new Set([...(done[topicName]?.seen || []), ...candidates.map((w) => w.kata_arab)])], kept: chosen };
    fs.writeFileSync(curationFile, JSON.stringify(done, null, 2));
    result.push(...chosen);
  }
  return { result, incomplete };
}

// ============================================================
// 3. PROMPT SOAL INTERMEDIATE
// ============================================================
// ------------------------------------------------------------
// SOAL BERGAMBAR: karakter planet (komponen <PlanetScene /> di aplikasi). AI hanya boleh memilih dari
// daftar ini; nilai di luar daftar dibuang oleh sanitizeScenes().
// ------------------------------------------------------------
export const SCENE_MOODS = ["happy", "excited", "sad", "surprised", "sleepy", "angry", "sick", "thinking", "cool"];
export const SCENE_ACCESSORIES = ["none", "hat", "cap", "glasses", "scarf", "headphones", "crown", "bandage"];
export const SCENE_COLORS = ["#7BAE9B", "#6FA8DC", "#B58FD6", "#F2A65A", "#E58FA8", "#8FC98F", "#E8C25A"];
export const SCENE_PROPS = ["🩹","🍕","🍍","🏋️","💪","☕","🛏️","🏨","🔑","🧳","📦","✉️","📚","📖","🚌","🚗","✈️","🏥","💊","🌡️","🍎","🍞","🥛","🍽️","🧺","👕","👟","🎒","📱","💻","🕌","🏠","🌧️","☀️","❄️","🌊","🐱","🐶","🐟","🌳","🌹","⏰","📅","💰","🧾","🎁","🎂","🚪","🪟","🧹","🍳","🥗","🍉","⚽","🎵","📷","🖊️","✂️","🔥","💡","🚰","🛒","🧴","🪥","🧼","🛁","📞","🗺️","🎫","🚕","⛅","🌙","⭐"];

export function sanitizeScenes(list, report) {
  return list.filter((ex) => {
    const sc = ex.content?.scene;
    if (sc === undefined || sc === null) return true;
    const ok = sc && typeof sc === "object"
      && SCENE_MOODS.includes(sc.mood)
      && SCENE_PROPS.includes(sc.prop)
      && (!sc.accessory || SCENE_ACCESSORIES.includes(sc.accessory))
      && (!sc.color || SCENE_COLORS.includes(sc.color));
    if (ok) return true;
    // soal "arti gambar" tidak punya arti tanpa gambar -> dibuang; fill_blank tetap utuh tanpa gambar.
    if (ex.type === "translate_choice") { report.dropped.push(`translate_choice: scene gambar tidak valid (pakai HANYA nilai dari daftar) — ${summarizeExercise(ex)}`); return false; }
    delete ex.content.scene;
    return true;
  });
}

// ------------------------------------------------------------
// KATA TAMBAHAN di luar CSV: harus ammiyah Yordania. Diperiksa AI judge; soal yang memakai kata
// ditolak dibuang. Kata yang disetujui dicatat supaya bisa kamu cek / masukkan ke CSV.
// ------------------------------------------------------------
async function judgeExtraWords(list, report, tag) {
  const wanted = new Map();
  for (const ex of list) for (const w of ex.extra_words || []) if (w?.kata_arab && !wanted.has(w.kata_arab)) wanted.set(w.kata_arab, w);
  if (wanted.size === 0) return list.map((e) => { delete e.extra_words; return e; });
  const items = [...wanted.values()];
  const prompt = `Periksa kata-kata Arab berikut. Apakah TIAP kata benar-benar dipakai sehari-hari dalam bahasa Arab ammiyah/Levantine DIALEK YORDANIA
(bukan Fusha murni, bukan dialek Mesir/Teluk/Maghrib, dan artinya sesuai)? Bersikap ketat; ragu = tidak.
${items.map((w, i) => `${i + 1}. ${w.kata_arab} (${w.latin || "-"}) = ${w.arti || "-"}`).join("\n")}
Balas HANYA JSON array: [ { "kata_arab": "...", "ok": true/false, "alasan": "singkat" }, ... ]`;
  let verdicts = [];
  try { verdicts = JSON.parse(cleanJson(await callLadiz(prompt, 2000))); } catch { verdicts = []; }
  const okSet = new Set(verdicts.filter((v) => v && v.ok === true).map((v) => v.kata_arab));
  const approved = items.filter((w) => okSet.has(w.kata_arab));
  if (approved.length) {
    const file = `extra-words-intermediate-${tag}.json`;
    let prev = [];
    try { prev = JSON.parse(fs.readFileSync(file, "utf-8")); } catch { prev = []; }
    const have = new Set(prev.map((w) => w.kata_arab));
    fs.writeFileSync(file, JSON.stringify([...prev, ...approved.filter((w) => !have.has(w.kata_arab))], null, 2));
  }
  return list.filter((ex) => {
    const bad = (ex.extra_words || []).filter((w) => !okSet.has(w?.kata_arab));
    delete ex.extra_words;
    if (bad.length === 0) return true;
    report.dropped.push(`${ex.type}: memakai kata tambahan yang BUKAN ammiyah Yordania (${bad.map((w) => w.kata_arab).join(", ")}) — ${summarizeExercise(ex)}`);
    return false;
  });
}

const SYSTEM_RULES = `Level: INTERMEDIATE — Bahasa Arab Levantine (dialek Yordania), BUKAN Arab Fusha. Kalimat lebih panjang
dari level pemula: 5-9 kata, boleh memakai kata sambung (و، بس، لأن، إذا), negasi, kala lampau/akan, dan pola
percakapan nyata. Fokus pada kosakata dari daftar (bentuk gramatikalnya boleh disesuaikan; kata dasarnya tidak).
KATA TAMBAHAN: bila sebuah kalimat BENAR-BENAR butuh kata yang tidak ada di daftar (kata ganti, kata kerja bantu, kata
sambung, kata benda umum), boleh dipakai — tetapi WAJIB kosakata ammiyah DIALEK YORDANIA yang umum dipakai sehari-hari
(bukan Fusha, bukan dialek lain), maksimal 2 kata tambahan per soal, dan WAJIB dideklarasikan di field soal:
"extra_words": [{ "kata_arab": "...", "latin": "...", "arti": "..." }] (kosongkan [] bila tidak ada). Kata tambahan
tidak boleh jadi jawaban fokus soal arti kata/matching; hanya pelengkap kalimat.

ATURAN KUALITAS (WAJIB — sudah ada keluhan soal-soal sebelumnya yang cacat):
1. NAMA ORANG: DILARANG memakai nama orang (Ahmad, Lara, Omar, Mariam, dst) di soal/opsi/kalimat. Pakai kata ganti,
   profesi, atau hubungan (guru, ibu, tetangga, teman). Field "has_person_name" WAJIB ada di tiap soal (true hanya bila
   ada nama diri). Untuk cerita/dialog: tokoh TANPA nama ("seorang pelajar", "sang ibu", A/B) lebih disukai.
2. GENDER HARUS JELAS: bahasa Indonesia netral gender, Arab tidak. Setiap kalimat/kata Indonesia yang menjadi SUMBER
   terjemahan ke Arab dan memuat kata ganti/orang yang gendernya mengubah bentuk Arab WAJIB menyebut gender di dalam
   kurung: "kamu (laki-laki)", "kamu (perempuan)", "kalian (laki-laki)", "kalian (perempuan)", "dia (laki-laki)",
   "dia (perempuan)", "mereka (perempuan)", "teman (perempuan)", "guru (laki-laki)". Dengan begitu HANYA SATU bentuk
   Arab yang benar. (Kalimat dari Arab ke Indonesia tidak perlu kurung gender.) Kalau tetap ada >1 jawaban benar karena
   gender, isi "acceptedIndices" (soal pilihan) / "acceptedOrders" (susun kata) dengan SEMUA yang benar.
3. TIDAK AMBIGU: untuk SETIAP soal pilihan, hanya SATU opsi yang benar-benar benar. Tambahkan field
   "cek_opsi_salah": array alasan singkat KENAPA tiap opsi salah itu salah. Tidak bisa menulis alasan kuat? Ganti opsinya.
   Soal isian (fill_blank) WAJIB punya petunjuk konteks yang menentukan satu jawaban.
4. STRUKTUR BENAR: jawaban harus ada di opsi/wordBank; kalimat Arab harus gramatikal & natural; opsi tidak boleh
   duplikat atau bersinonim penuh; tidak ada huruf Latin di dalam teks/opsi/tile Arab (kecuali field "latin").
5. SUSUN KATA (word_order): tile = kata utuh TANPA tanda baca (tanpa "؟" "،" "."). wordBank = semua kata jawaban +
   2-3 pengecoh yang berasal dari topik yang sama dan masih satu bahasa/tulisan (Arab murni untuk to_arabic, Indonesia
   murni untuk to_indonesian). "acceptedOrders" WAJIB berisi correctWords sebagai elemen pertama, ditambah 1-2
   alternatif sinonim/urutan yang benar-benar wajar bila ada.
6. JUMLAH OPSI: "translate_choice" TEPAT 5 opsi; "listen_choose" TEPAT 4 opsi; "fill_blank"/"dialogue_complete"/
   "reading_comprehension" 3 opsi. Semua opsi berbeda & masuk akal sebagai pengecoh.
7. SETIAP soal WAJIB punya "vocab_used": array kata_arab (bentuk DASAR persis seperti di daftar) yang diuji.
8. VARIASI: jangan memakai kata fokus yang sama di lebih dari 2 soal dalam 1 batch; sebar ke semua kosakata.
9. ARTI KALIMAT: untuk "fill_blank", "listen_complete", "dialogue_complete" dan "reading_comprehension" (yang teks & jawabannya
   Arab semua) tambahkan arti Indonesia yang wajar: "content.meaning" = arti kalimat LENGKAP setelah rumpang terisi jawaban benar;
   tiap baris di "dialogueLines" punya "meaning"; bacaan punya "passageMeaning". Aplikasi menampilkannya setelah user menjawab.

FORMAT SOAL SUSUN KATA (4 varian):
 (A) { "type": "word_order", "prompt": "Susun kalimat Bahasa Arab", "has_person_name": false, "vocab_used": ["..."],
       "content": { "direction": "to_arabic", "text": "Kamu (perempuan) mau minum kopi atau teh?",
                    "correctWords": ["...arab...", "..."], "acceptedOrders": [["...arab..."]],
                    "wordBank": ["...arab (jawaban + pengecoh)..."] } }
 (B) { "type": "word_order", "prompt": "Susun terjemahannya", "has_person_name": false, "vocab_used": ["..."],
       "content": { "direction": "to_indonesian", "latin": "...", "text": "...kalimat arab...", "hasAudio": true,
                    "correctWords": ["...indonesia..."], "acceptedOrders": [["...indonesia..."]],
                    "wordBank": ["...indonesia (jawaban + pengecoh)..."] } }
 (C) SUARA -> terjemahan: { "type": "word_order", "prompt": "Dengarkan, lalu susun terjemahannya", "has_person_name": false,
       "vocab_used": ["..."], "content": { "direction": "to_indonesian", "audioOnly": true, "hasAudio": true,
       "audioText": "...kalimat arab...", "text": "...kalimat arab yang sama...", "latin": "...",
       "correctWords": ["...indonesia..."], "acceptedOrders": [["...indonesia..."]], "wordBank": ["..."] } }
 (D) SUARA -> kalimat Arab: { "type": "word_order", "prompt": "Dengarkan, lalu susun kalimat yang kamu dengar",
       "has_person_name": false, "vocab_used": ["..."], "content": { "direction": "to_arabic", "audioOnly": true,
       "hasAudio": true, "audioText": "...kalimat arab...", "text": "...kalimat arab yang sama...", "latin": "...",
       "correctWords": ["...arab..."], "acceptedOrders": [["...arab..."]], "wordBank": ["...arab..."] } }
 Pada varian C dan D, kalimat Arab TIDAK ditampilkan ke user (hanya didengar), jadi "audioText" wajib kalimat Arab
 lengkap yang sama dengan jawaban.

FORMAT MATCHING PAIRS (5 pasang, kata berbeda-beda, makna tidak saling tumpang tindih):
 { "type": "matching_pairs", "prompt": "Cocokkan kata dengan artinya", "has_person_name": false, "vocab_used": ["..."],
   "content": { "pairs": [{ "id": "p1", "left": "...arab...", "leftLatin": "...", "right": "...arti Indonesia..." }, ...5 pasang],
                "rightOrder": ["p3", "p1", ...] } }

FORMAT SOAL BERGAMBAR (karakter planet): tambahkan "scene" di dalam "content" soal fill_blank atau translate_choice
 HANYA bila kata fokusnya benda/aksi/kondisi yang bisa digambarkan. "scene": { "mood": satu dari ${SCENE_MOODS.join(", ")}, "accessory":
 satu dari ${SCENE_ACCESSORIES.join(", ")} (opsional), "color": satu dari ${SCENE_COLORS.join(", ")} (opsional; variasikan antar soal),
 "prop": SATU emoji dari daftar ini yang paling cocok dengan kata fokus: ${SCENE_PROPS.join(" ")} }. Mood & aksesori harus cocok dengan
 situasi (mis. jari berdarah -> mood "sad" + accessory "bandage" + prop "🩹"). JANGAN memakai emoji di luar daftar.
 Soal "arti gambar": { "type": "translate_choice", "prompt": "Apa bahasa Arab untuk gambar ini?", ..., "content": { "scene": {...},
 "promptText": "Pilih kata yang cocok dengan gambar", "options": [5 opsi Arab], "correctIndex": 0, "acceptedIndices": [0] } }
 Maksimal 2 soal bergambar per sesi; sebar mood/warna/aksesori agar karakternya bervariasi.

FORMAT SOAL PILIHAN:
 { "type": "translate_choice", "prompt": "Pilih terjemahan yang benar", "has_person_name": false, "vocab_used": ["..."],
   "cek_opsi_salah": ["..."], "content": { "promptText": "...(Indonesia, sebutkan gender bila perlu)...",
   "options": [{ "latin": "...", "text": "...arab..." }, ...5 opsi], "correctIndex": 0, "acceptedIndices": [0] } }
 { "type": "fill_blank", "prompt": "Isi bagian yang kosong", "has_person_name": false, "vocab_used": ["..."],
   "cek_opsi_salah": ["..."], "content": { "beforeBlank": { "latin": "...", "text": "..." }, "afterBlank": { "latin": "...", "text": "..." },
   "options": [{ "latin": "...", "text": "..." }, ...3 opsi], "correctIndex": 0, "acceptedIndices": [0] } }
 { "type": "translate_write", "prompt": "Tulis terjemahannya", "has_person_name": false, "vocab_used": ["..."],
   "content": { "text": "...(Indonesia, sebutkan gender bila perlu)...", "correctAnswer": "...arab...", "acceptedAnswers": ["...arab (sama dengan correctAnswer)...", "...variasi lain yang sama-sama benar..."] } }
 { "type": "listen_choose", "prompt": "Dengarkan lalu pilih jawaban yang benar", "has_person_name": false, "vocab_used": ["..."],
   "content": { "hasAudio": true, "options": [{ "latin": "...", "text": "..." }, ...4 opsi], "correctIndex": 0, "acceptedIndices": [0] } }`;

// Komposisi meniru contoh Duolingo: susun kalimat (dua arah + suara), ketuk pasangan, lengkapi kalimat,
// arti kata, bacaan pendek, dialog pendek, dan soal bergambar.
const MIXED_SHAPE = (n, wo, mp, extra) => `Balas HANYA JSON array berisi ${n} soal dengan KOMPOSISI WAJIB (level Intermediate: kalimat nyata, bukan kata lepas):
 - word_order: minimal ${wo} soal — minimal 2 varian (A) to_arabic, minimal 2 varian (B) to_indonesian, minimal 2 varian
   SUARA (C dan D, masing-masing minimal 1).
 - matching_pairs: minimal ${mp} soal ("Cocokkan kata dengan artinya", 5 pasang, kata-kata berbeda).
 - fill_blank: minimal 2 soal ("Lengkapi kalimat ini", kalimat Arab 5-8 kata dengan SATU rumpang, 3 opsi); minimal 1 dari
   soal ini BERGAMBAR (content.scene) bila ada kata yang bisa digambarkan.
 - translate_choice: minimal 1 soal (arti kata / "arti gambar" dengan content.scene bila ada kata yang bisa digambarkan).
 - reading_comprehension: 1 soal dengan bacaan pendek 2-3 kalimat Levantine + pertanyaan (format di bawah).
 - dialogue_complete: 1 soal dengan dialog pendek 2-3 baris, tokoh A/B tanpa nama (format di bawah).
${extra}
 Format reading_comprehension dan dialogue_complete:
 { "type": "reading_comprehension", "prompt": "Bacalah dan jawab pertanyaannya", "has_person_name": false, "vocab_used": ["..."],
   "extra_words": [], "cek_opsi_salah": ["..."], "content": { "hasAudio": true, "passageLatin": "...", "passageText": "...arab...",
   "passageMeaning": "...", "question": "...(Indonesia)...", "options": [{ "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } }
 { "type": "dialogue_complete", "prompt": "Lengkapi percakapannya", "has_person_name": false, "vocab_used": ["..."], "extra_words": [],
   "cek_opsi_salah": ["..."], "content": { "hasAudio": true, "dialogueLines": [
   { "speaker": "A", "latin": "...", "text": "...", "meaning": "..." }, { "speaker": "B", "latin": "___", "text": "___", "blank": true } ],
   "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } }
 SEMUA soal juga memuat field "extra_words" (array, boleh kosong).`;

const SHAPES = {
  lesson: MIXED_SHAPE("10-13", 5, 2, ""),

  // Bulatan REVIEW: soal BARU (kalimat/konteks lain) dari kata-kata 4 pelajaran di unit yang sama.
  review: MIXED_SHAPE("10-13", 4, 2, ` - Ini bulatan REVIEW: pakai kata dari daftar secara merata (sebar semua kata, jangan hanya beberapa), dengan kalimat
   dan konteks BARU yang berbeda dari soal yang sudah ada (lihat daftar "SOAL INI SUDAH ADA").`),

  story: `Buat SATU cerita pendek (3-4 kalimat Levantine, tokoh TANPA nama bila bisa) yang merangkai kosakata di atas.
Dari cerita itu buat 8-13 soal TOTAL:
 - 3 reading_comprehension (3 opsi; variasikan sudut: apa/siapa/kenapa/kapan-di mana)
 - 3 word_order dari kalimat-kalimat CERITA itu: 1 varian (A), 1 varian (B), 1 varian suara (C atau D)
 - 1-2 matching_pairs (5 pasang kosakata dari daftar)
 - 1-2 translate_choice (5 opsi; arti kata dari daftar)
 - 1 fill_blank dari kalimat cerita
Soal reading_comprehension/fill_blank: "hasAudio": true, "passageLatin", "passageText" (SAMA PERSIS di semua soal):
 { "type": "reading_comprehension", "prompt": "Pahami bacaannya, lalu jawab", "has_person_name": false, "vocab_used": ["..."],
   "cek_opsi_salah": ["..."], "content": { "hasAudio": true, "passageLatin": "...", "passageText": "...arab...",
   "question": "...(Indonesia)...", "options": [{ "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } }
 { "type": "fill_blank", "prompt": "Isi bagian yang kosong (dari cerita)", ... , "content": { "hasAudio": true, "passageLatin": "...", "passageText": "...", "beforeBlank": {...}, "afterBlank": {...}, "options": [...3], "correctIndex": 0, "acceptedIndices": [0] } }`,

  conversation: `Buat SATU dialog 2 orang (A & B), 4-6 baris, situasi nyata, tokoh TANPA nama (A/B saja). Dari dialog itu buat 8-13 soal TOTAL:
 - 3 dialogue_complete (baris yang dikosongkan BEDA-BEDA, dialogueLines SAMA PERSIS tiap soal, hanya posisi "blank": true yang berbeda)
 - 3 word_order dari baris-baris dialog: 1 varian (A), 1 varian (B), 1 varian suara (C atau D)
 - 1-2 matching_pairs (5 pasang kosakata dari daftar)
 - 1 reading_comprehension tentang isi dialog
 - 1 translate_choice (5 opsi; arti kata dari daftar)
 { "type": "dialogue_complete", "prompt": "Lengkapi percakapannya", "has_person_name": false, "vocab_used": ["..."],
   "cek_opsi_salah": ["..."], "content": { "hasAudio": true, "dialogueLines": [
   { "speaker": "A", "latin": "...", "text": "..." }, { "speaker": "B", "latin": "___", "text": "___", "blank": true } ],
   "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0, "acceptedIndices": [0] } }
 { "type": "reading_comprehension", "prompt": "Pahami percakapannya, lalu jawab", ..., "content": { "passageLatin": "...", "passageText": "...", "question": "...", "options": [...3], "correctIndex": 0, "acceptedIndices": [0] } }`,
};

function buildPrompt({ bagianNo, topicName, nodeType, shape, vocabList, avoidList, feedback }) {
  const vocabText = vocabList
    .map((v) => `${v.kata_arab} (${v.latin}) = ${v.arti}${v.contoh_kalimat ? " — contoh: " + v.contoh_kalimat : ""}`)
    .join("\n");
  const avoid = avoidList.length
    ? `\n\nSOAL INI SUDAH ADA — JANGAN dibuat lagi (kata/konteks/kalimat yang sama); buat yang BENAR-BENAR beda:\n${avoidList.map((a) => `- ${a}`).join("\n")}`
    : "";
  const fb = feedback.length
    ? `\n\nPUTARAN SEBELUMNYA, soal-soal ini DITOLAK pemeriksa — jangan ulangi pola kesalahan yang sama:\n${feedback.slice(0, 14).map((f) => `- ${f}`).join("\n")}`
    : "";
  return `Topik: "${topicName}" — Bagian ${bagianNo} (INTERMEDIATE) — Bahasa Arab Levantine (dialek Yordania).
Kategori bulatan pelajaran: "${nodeType}".

Kosakata WAJIB jadi FOKUS soal (jangan bikin soal dari kata di luar daftar ini):
${vocabText}

${SYSTEM_RULES}

${SHAPES[shape || nodeType]}${avoid}${fb}

Pastikan bahasa Arab akurat. Balas HANYA JSON array, tanpa teks lain, tanpa markdown code fence.`;
}

// ============================================================
// 4. GENERATE + PERIKSA + ISI ULANG
// ============================================================
function countByType(list) {
  const c = {};
  for (const ex of list) c[ex.type] = (c[ex.type] || 0) + 1;
  return c;
}

// Komposisi minimal supaya soal Intermediate memang didominasi susun kalimat & matching.
function compositionProblems(nodeType, list) {
  const c = countByType(list);
  const wo = c.word_order || 0;
  const mp = c.matching_pairs || 0;
  const audioWo = list.filter((e) => e.type === "word_order" && e.content?.audioOnly).length;
  const problems = [];
  if (nodeType === "lesson" || nodeType === "review") {
    if (wo < (nodeType === "review" ? 4 : 5)) problems.push(`word_order baru ${wo} (butuh minimal ${nodeType === "review" ? 4 : 5})`);
    if (mp < 2) problems.push(`matching_pairs baru ${mp} (butuh minimal 2)`);
    if (audioWo < 2) problems.push(`word_order suara (audioOnly) baru ${audioWo} (butuh minimal 2)`);
  } else {
    if (wo < 2) problems.push(`word_order baru ${wo} (butuh minimal 2-3)`);
    if (mp < 1) problems.push(`matching_pairs baru ${mp} (butuh minimal 1)`);
  }
  return problems;
}

// Cerita/dialog: nama tokoh boleh, tapi hanya di soal yang memang berbasis cerita/dialog dan maks 3 soal.
const NAME_OK_TYPES = ["reading_comprehension", "dialogue_complete", "fill_blank"];
function limitNarrativeNames(list, report) {
  let n = 0;
  return list.filter((ex) => {
    const hasName = ex.has_person_name === true || ex.has_person_name === "true";
    if (!hasName) return true;
    if (!NAME_OK_TYPES.includes(ex.type)) { report.dropped.push(`${ex.type}: memakai nama orang di soal non-cerita — ${summarizeExercise(ex)}`); return false; }
    if (n >= 3) { report.dropped.push(`${ex.type}: terlalu banyak soal bernama orang — ${summarizeExercise(ex)}`); return false; }
    n++;
    return true;
  });
}

async function generateOnce({ bagianNo, topicName, nodeType, shape, vocabList, avoidList, feedback, report }) {
  const prompt = buildPrompt({ bagianNo, topicName, nodeType, shape, vocabList, avoidList, feedback });
  let parsed = null;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const raw = await callLadiz(prompt, 8000);
    try {
      parsed = shuffleAnswerPositions(JSON.parse(cleanJson(raw)));
      break;
    } catch (err) {
      lastErr = err;
      console.error(`  ❌ JSON soal tidak valid (percobaan ${attempt}/3): ${err.message}`);
    }
  }
  if (!parsed) throw lastErr;
  if (!Array.isArray(parsed)) throw new Error("Respons AI bukan array soal.");
  // Soal cerita/dialog (reading_comprehension, dialogue_complete) ikut aturan nama maks 3 per batch.
  let pool = limitNarrativeNames(parsed, report);
  pool = sanitizeScenes(pool, report);
  pool = await judgeExtraWords(pool, report, `B${bagianNo}`);
  // refineExerciseQuality memeriksa dengan aturan "lesson" (review memakai aturan yang sama).
  return await refineExerciseQuality(pool, nodeType === "review" ? "lesson" : nodeType, report);
}

// Tiap putaran = 1 panggilan AI besar + pemeriksaan (judge) AI. 2 putaran cukup; 3 putaran memboroskan kuota.
const MAX_ROUNDS = 2;
const MAX_PER_SEGMENT = 13;

// ------------------------------------------------------------
// URUTAN SOAL dalam satu segmen: kosakata dulu, kalimat belakangan.
//   0 matching_pairs (kenalan dengan kata-kata kunci)
//   1 pilihan kosakata (translate_choice / listen_choose)
//   2 isian / dialog / bacaan (kata dipakai dalam konteks)
//   3 susun kalimat (word_order) — varian suara terakhir
//   4 tulis terjemahan (translate_write)
// ------------------------------------------------------------
const TYPE_RANK = { matching_pairs: 0, translate_choice: 1, listen_choose: 1, fill_blank: 2, dialogue_complete: 2, reading_comprehension: 2, word_order: 3, translate_write: 4 };
export function orderExercises(list) {
  const rank = (e) => {
    const r = TYPE_RANK[e.type] ?? 2;
    return e.type === "word_order" && e.content?.audioOnly ? r + 0.5 : r;
  };
  return list.map((e, i) => ({ e, i })).sort((a, b) => rank(a.e) - rank(b.e) || a.i - b.i).map((x) => x.e);
}

// ------------------------------------------------------------
// SUARA: tiap kalimat Arab yang TAMPIL di soal diberi audioText + hasAudio supaya muncul ikon 🔊
// (user menekan sendiri; tidak diputar otomatis). Soal yang jawabannya berupa kata Arab
// (translate_choice / translate_write) TIDAK diberi audio karena akan membocorkan jawaban —
// kata Arab di opsi tetap bisa diketuk untuk didengar lewat fitur ketuk-kata.
// ------------------------------------------------------------
export function attachAudioText(list) {
  for (const e of list) {
    const c = e.content || (e.content = {});
    if (e.type === "word_order" && !c.audioOnly && c.direction === "to_indonesian" && /[\u0600-\u06FF]/.test(c.text || "")) {
      c.hasAudio = true; c.audioText = c.audioText || c.text;
    } else if (e.type === "fill_blank" && !c.passageText && c.beforeBlank && c.afterBlank && Array.isArray(c.options)) {
      const right = c.options[c.correctIndex]?.text;
      const full = [c.beforeBlank.text, right, c.afterBlank.text].filter(Boolean).join(" ").trim();
      if (full && /[\u0600-\u06FF]/.test(full)) { c.hasAudio = true; c.audioText = full; }
    }
  }
  return list;
}

export async function generateExercises(ctx) {
  const { nodeType, avoidList } = ctx;
  const accepted = [];
  const feedback = [];
  const rounds = MAX_ROUNDS;
  for (let round = 1; round <= rounds; round++) {
    const report = { dropped: [] };
    const batch = await generateOnce({ ...ctx, avoidList: [...avoidList, ...accepted.map(summarizeExercise)], feedback, report });
    accepted.push(...batch);
    feedback.push(...report.dropped);
    const comp = compositionProblems(nodeType, accepted);
    const enough = accepted.length >= TARGET_MIN_PER_SEGMENT;
    // Hemat kuota: komposisi yang kurang ideal hanya jadi PERINGATAN bila jumlah soal sudah cukup;
    // putaran tambahan hanya dilakukan kalau soal yang lolos masih kurang dari target.
    if (enough) {
      if (comp.length) console.warn(`  ⚠ Komposisi belum ideal (dibiarkan, jumlah soal sudah cukup): ${comp.join("; ")}`);
      break;
    }
    if (round < rounds) {
      const why = [!enough ? `baru ${accepted.length} soal lolos (target ${TARGET_MIN_PER_SEGMENT}+)` : null, ...comp].filter(Boolean).join("; ");
      console.log(`  ↻ Putaran ${round + 1}/${rounds}: ${why}`);
      if (comp.length) feedback.push(`KOMPOSISI KURANG: ${comp.join("; ")} — buat soal TAMBAHAN yang menutup kekurangan ini`);
    } else if (comp.length) {
      console.warn(`  ⚠ Komposisi belum ideal setelah ${rounds} putaran: ${comp.join("; ")}`);
    }
  }
  return orderExercises(attachAudioText(accepted.slice(0, MAX_PER_SEGMENT)));
}

// ============================================================
// KOSAKATA TAMBAHAN DARI AI (untuk unit yang kata CSV-nya sedikit)
// ============================================================
const ARABIC_ONLY = /^[\u0600-\u06FF\s]+$/;
const stripHarakat = (s) => (s || "").replace(/[\u064B-\u065F\u0670]/g, "");

async function proposeTopicWords(topicName, hint, avoidWords, ask) {
  const prompt = `Topik: "${topicName}" — ${hint}.
Level INTERMEDIATE, Bahasa Arab Levantine DIALEK YORDANIA (ammiyah yang dipakai sehari-hari di Yordania/Amman; BUKAN Fusha, BUKAN dialek Mesir/Teluk/Maghrib).
Buatkan ${ask} kata atau ungkapan pendek (1-3 kata) yang paling berguna untuk topik ini dan BELUM ada di daftar berikut:
${avoidWords.slice(0, 120).join("، ")}

ATURAN:
- Hanya kosakata ammiyah Yordania yang BENAR-BENAR dipakai penutur; ragu = jangan masukkan.
- Bentuk dasar: kata benda tunggal; kata kerja dalam bentuk yang lazim dipakai (mis. "بيبعت" / "بعت"). Jangan menempelkan awalan seperti و/ب/ال kecuali memang bagian kata.
- Variasikan jenis kata (benda, kerja, sifat, ungkapan) dan sebar ke seluruh sub-topik.
- Tanpa nama orang. Tanpa harakat di "kata_arab".
- "latin": transliterasi gaya Levantine (mis. "taabi'", "bil-bariid"). "arti": bahasa Indonesia singkat (gender dalam kurung bila perlu, mis. "(pr)").
- "contoh_kalimat": SATU kalimat ammiyah Yordania natural 4-8 kata yang memakai kata itu.
Balas HANYA JSON array: [ { "kata_arab": "...", "latin": "...", "arti": "...", "contoh_kalimat": "..." }, ... ]`;
  const raw = await callLadiz(prompt, 6000);
  const list = JSON.parse(cleanJson(raw));
  return Array.isArray(list) ? list : [];
}

async function judgeAmmiyahWords(items) {
  if (!items.length) return [];
  const prompt = `Periksa kata-kata Arab berikut. Untuk TIAP kata: (1) apakah benar dipakai sehari-hari dalam ammiyah DIALEK YORDANIA/Levantine (bukan Fusha murni / dialek lain), (2) apakah arti Indonesia dan transliterasinya benar, (3) apakah kalimat contoh natural? Bersikap ketat; ragu = false.
${items.map((w, i) => `${i + 1}. ${w.kata_arab} (${w.latin}) = ${w.arti} — contoh: ${w.contoh_kalimat}`).join("\n")}
Balas HANYA JSON array: [ { "kata_arab": "...", "ok": true/false, "alasan": "singkat" }, ... ]`;
  let verdicts = [];
  try { verdicts = JSON.parse(cleanJson(await callLadiz(prompt, 3000))); } catch { verdicts = []; }
  const ok = new Set(verdicts.filter((v) => v && v.ok === true).map((v) => v.kata_arab));
  return items.filter((w) => ok.has(w.kata_arab));
}

// Lengkapi tiap unit sampai `target` kata. Hasil di-cache per topik; run berikutnya memakai cache.
async function topUpVocab({ groups, topics, tag, target, known, onlyTopic }) {
  const file = `ai-vocab-intermediate-${tag}.json`;
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(file, "utf-8")); } catch { cache = {}; }
  for (const [name, hint] of topics) {
    if (onlyTopic && name !== onlyTopic) continue;
    const g = (groups[name] ||= { topicName: name, unitNumber: topics.findIndex(([n]) => n === name) + 1, words: [] });
    const have = new Set(g.words.map((w) => w.kata_arab));
    // kata AI yang sudah pernah dibuat untuk topik ini (cache) ikut dipakai
    for (const w of cache[name] || []) if (!have.has(w.kata_arab)) { g.words.push({ ...w, topic_name: name, source: "ai" }); have.add(w.kata_arab); }
    let need = target - g.words.length;
    if (need <= 0) continue;
    console.log(`Kosakata "${name}": ${g.words.length} kata (CSV + cache) < target ${target} — AI melengkapi ${need} kata ammiyah Yordania...`);
    for (let attempt = 1; attempt <= 3 && need > 0; attempt++) {
      try {
        const proposed = await proposeTopicWords(name, hint, [...have], Math.min(40, Math.ceil(need * 1.3) + 2));
        const fresh = proposed.filter((w) => w && ARABIC_ONLY.test(stripHarakat(w.kata_arab || "")) && w.latin && w.arti && w.contoh_kalimat
          && !have.has(w.kata_arab) && !known.has(w.kata_arab));
        const approved = await judgeAmmiyahWords(fresh);
        for (const w of approved) {
          if (need <= 0) break;
          const row = { kata_arab: stripHarakat(w.kata_arab).trim(), latin: w.latin.trim(), arti: w.arti.trim(), contoh_kalimat: w.contoh_kalimat.trim() };
          if (have.has(row.kata_arab) || known.has(row.kata_arab)) continue;
          g.words.push({ ...row, topic_name: name, source: "ai" });
          (cache[name] ||= []).push(row);
          have.add(row.kata_arab);
          need--;
        }
        fs.writeFileSync(file, JSON.stringify(cache, null, 2));
        console.log(`  putaran ${attempt}: ${approved.length}/${fresh.length} kata lolos pemeriksaan ammiyah; sisa kebutuhan ${Math.max(0, need)}.`);
      } catch (err) {
        if (err.quotaExceeded) { console.warn("  ⚠ Quota/koneksi AI bermasalah saat melengkapi kosakata; yang sudah jadi tersimpan."); return { incomplete: true }; }
        console.warn(`  ⚠ Gagal melengkapi kosakata (putaran ${attempt}): ${err.message}`);
      }
    }
  }
  return { incomplete: false };
}

// ============================================================
// REVIEW LEVEL (level 5, static, 1 sesi)
// ============================================================
async function reviewIsMissing(topicId) {
  const { data: lv } = await supabase.from("levels").select("id").eq("topic_id", topicId).eq("level_number", 5).maybeSingle();
  if (!lv) return false; // level belum dibuat -> ditangani ensureIntermediateLevels
  const counts = await getSegmentExerciseCounts(lv.id);
  return (counts[1] || 0) < TARGET_MIN_PER_SEGMENT;
}

// Simpan soal review. TIDAK menambah vocab_items (kata sudah milik 4 level pelajaran); exercise_vocab
// dihubungkan ke vocab_items level-level pelajaran itu, supaya progres per-kata tetap tercatat.
async function saveReviewContent(reviewLevel, lessonLevelIds, exercises, useAudio) {
  const { data: vocabRows } = await supabase.from("vocab_items").select("id, kata_arab").in("level_id", lessonLevelIds);
  const vocabIdByWord = new Map((vocabRows || []).map((v) => [v.kata_arab, v.id]));
  const existingSignatures = await loadExistingSignatures(supabase, { levelId: reviewLevel.id, generatedForUserId: null });
  const toInsert = filterDuplicateExercises(exercises, vocabIdByWord, existingSignatures);
  console.log(`    (${exercises.length - toInsert.length} soal dilewati karena duplikat, ${toInsert.length} soal baru akan disimpan)`);
  let orderIndex = 1;
  for (const { ex, vocabUsedIds, signature } of toInsert) {
    let audioUrl = null;
    if (useAudio && typeof V2.generateAudio === "function" && typeof V2.uploadAudio === "function") {
      let text = null;
      if (ex.type === "listen_choose") text = ex.content?.options?.[0]?.text;
      else if (ex.content?.hasAudio && ex.content?.passageText) text = ex.content.passageText;
      else if (ex.content?.hasAudio && Array.isArray(ex.content?.dialogueLines)) text = ex.content.dialogueLines.map((l) => l.text).filter(Boolean).join(" ");
      if (text) { const buf = await V2.generateAudio(text); audioUrl = await V2.uploadAudio(text, buf); }
    }
    const { data: inserted, error } = await supabase.from("exercises").insert({
      level_id: reviewLevel.id, type: ex.type, order_index: orderIndex++, prompt: ex.prompt,
      content: ex.content, audio_url: audioUrl, segment_number: 1, signature,
    }).select().single();
    if (error) { if (error.code === "23505") continue; throw error; }
    for (const vocabId of vocabUsedIds) {
      const { error: linkError } = await supabase.from("exercise_vocab").insert({ exercise_id: inserted.id, vocab_id: vocabId });
      if (linkError && linkError.code !== "23505") throw linkError;
    }
  }
}

async function buildReviewLevel({ bagianNo, topicName, levelRows, useAudio }) {
  const reviewLevel = levelRows.find((l) => l.level_number === 5);
  const lessonLevels = levelRows.filter((l) => l.level_number <= 4);
  if (!reviewLevel) return;
  const counts = await getSegmentExerciseCounts(reviewLevel.id);
  if ((counts[1] || 0) >= TARGET_MIN_PER_SEGMENT) { console.log(`  (lewati, review lengkap: ${counts[1]} soal)`); return; }
  const { data: vocab } = await supabase.from("vocab_items").select("kata_arab, latin, arti, contoh_kalimat").in("level_id", lessonLevels.map((l) => l.id));
  const all = vocab || [];
  if (all.length === 0) { console.warn("  ⚠ Review: belum ada kosakata di 4 pelajaran — dilewati."); return; }
  // Acak, maksimal 40 kata supaya prompt tidak membengkak; run berikutnya mengacak ulang.
  const vocabList = [...all].sort(() => Math.random() - 0.5).slice(0, 40);
  // Hindari soal yang sudah ada di 4 pelajaran + soal review yang sudah ada.
  const avoidList = [];
  for (const l of [...lessonLevels, reviewLevel]) avoidList.push(...(await getExistingExerciseSummaries(l.id)));
  if (avoidList.length > 40) avoidList.splice(0, avoidList.length - 40);
  console.log(`  Generating REVIEW (level 5) dari ${vocabList.length} kata...`);
  const exercises = await generateExercises({ bagianNo, topicName, nodeType: "review", shape: "review", vocabList, avoidList });
  console.log(`    → ${exercises.length} soal lolos: ${JSON.stringify(countByType(exercises))}`);
  await saveReviewContent(reviewLevel, lessonLevels.map((l) => l.id), exercises, useAudio);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const commit = args.includes("--commit");
  const useAudio = args.includes("--audio");
  const bagianNo = Number(arg("--bagian"));
  const onlyTopic = arg("--topic");
  const classifyLimit = arg("--classify-limit") ? Number(arg("--classify-limit")) : Infinity;
  const csvPath = arg("--csv") || "kosakata-ammiyah.csv";
  const minWords = arg("--min-words") ? Number(arg("--min-words")) : DEFAULT_MIN_WORDS_PER_UNIT;
  const targetWords = arg("--target-words") ? Number(arg("--target-words")) : DEFAULT_TARGET_WORDS_PER_UNIT;
  const aiVocab = !args.includes("--no-ai-vocab");

  const cur = INTERMEDIATE_CURRICULUM[bagianNo];
  if (!cur) {
    console.error(`Pakai --bagian 11 sampai 15. Contoh: node scripts-generate-vocab/generate-intermediate.mjs --bagian 11 --csv ${csvPath}`);
    process.exitCode = 1;
    return;
  }
  if (commit && useAudio && !process.env.ELEVENLABS_API_KEY) {
    throw new Error("--audio butuh ELEVENLABS_API_KEY & ELEVENLABS_VOICE_ID di .env");
  }
  const topics = cur.topics;
  console.log(`=== INTERMEDIATE — Bagian ${bagianNo}: ${cur.title} (${topics.length} topik) ${commit ? "[COMMIT]" : "[PREVIEW]"} ===\n`);

  const tag = `B${bagianNo}`;
  const curationFile = `curation-intermediate-${tag}.json`;

  let words = loadFlatVocabCsv(csvPath);
  console.log(`Membaca ${words.length} kata dari ${csvPath}...`);
  const knownWords = new Set(words.map((w) => w.kata_arab)); // seluruh CSV: kata AI tidak boleh menduplikasi

  // Buang kata yang SUDAH dipakai Beginner (hasil kurasi beginner), supaya
  // tidak diajarkan dua kali. Sumber: curation-checkpoint.json dari generate-vocab-v2.
  const usedBeginner = loadBeginnerUsedWords();
  if (usedBeginner.size) {
    const before = words.length;
    words = words.filter((w) => !usedBeginner.has(w.kata_arab));
    console.log(`${before - words.length} kata sudah dipakai Beginner → dilewati. Sisa kandidat: ${words.length}.`);
  }

  // SATU klasifikasi bersama untuk semua Bagian 11-15 (50 topik), disimpan di
  // classify-intermediate-all.json. Kata yang sudah pernah diklasifikasi TIDAK
  // diulang; tiap run cuma kata BARU yang dikirim ke AI. Satu kata juga hanya
  // masuk ke satu topik (tidak dobel antar-Bagian).
  const { results: classifiedAll, incomplete: ci } = await classifyAll(words, ALL_TOPICS, CLASSIFY_ALL_FILE, 30, classifyLimit);
  const wordSet = new Set(words.map((w) => w.kata_arab));
  const inCsv = classifiedAll.filter((w) => wordSet.has(w.kata_arab));
  const topicNames = new Set(topics.map(([n]) => n));
  const unmatched = inCsv.filter((w) => w.topic_name === NO_MATCH);
  const matched = inCsv.filter((w) => topicNames.has(w.topic_name));
  fs.writeFileSync(`unmatched-intermediate.json`, JSON.stringify(unmatched, null, 2));
  console.log(`\n${matched.length} kata cocok dengan topik Bagian ${bagianNo}; ${unmatched.length} tidak cocok ke Bagian 11-15 mana pun (unmatched-intermediate.json).`);
  if (ci) console.log("Klasifikasi belum selesai (quota/koneksi) — lanjut dengan yang sudah ada.");

  const { result: curated } = await curate(matched, curationFile);
  const topicNo = (name) => topics.findIndex(([n]) => n === name) + 1;
  const groups = {};
  for (const w of curated) {
    (groups[w.topic_name] ||= { topicName: w.topic_name, unitNumber: topicNo(w.topic_name), words: [] }).words.push(w);
  }
  // Unit dengan kata CSV sedikit dilengkapi AI (ammiyah Yordania, diperiksa judge, di-cache).
  if (aiVocab) await topUpVocab({ groups, topics, tag, target: targetWords, known: knownWords, onlyTopic });
  let groupList = Object.values(groups).sort((a, b) => a.unitNumber - b.unitNumber);
  if (onlyTopic) groupList = groupList.filter((g) => g.topicName === onlyTopic);

  fs.writeFileSync(`preview-intermediate-${tag}.json`, JSON.stringify(groupList, null, 2));
  console.log(`\nRingkasan Bagian ${bagianNo}:`);
  let estCalls = 0;
  for (const [name] of topics) {
    const g = groups[name];
    const n = g ? g.words.length : 0;
    const ok = n >= minWords;
    if (ok) estCalls += 16 * 2 * 3 + 2 * 3; // 16 segmen x ~2 putaran x (1 generate + ~2 judge) + review
    const nAi = g ? g.words.filter((w) => w.source === "ai").length : 0;
    console.log(`  Unit ${String(topicNo(name)).padStart(2)} ${name}: ${n} kata${nAi ? ` (${nAi} dari AI, cek di ai-vocab-intermediate-${tag}.json)` : ""}${n === 0 ? "  ← BELUM ADA KOSAKATA" : ok ? "" : `  ← DILEWATI (kurang dari ${minWords} kata)`}`);
  }
  console.log(`\nPerkiraan panggilan AI untuk unit yang diproses: ~${estCalls} (±; tiap unit ~100). Kuota habis di tengah? Jalankan lagi perintah yang sama — yang sudah jadi tidak diulang.`);
  if (!commit) {
    console.log(`\nMode preview — belum ada yang disimpan ke database. Detail: preview-intermediate-${tag}.json. Tambahkan --commit kalau sudah yakin.`);
    return;
  }

  const subject = await ensureSubject();
  const unit = await ensureUnit(subject.id, bagianNo); // nama "Bagian N", order_index = N
  const changedTopicNames = [];

  for (const g of groupList) {
    if (g.words.length < minWords) {
      console.log(`\n(lewati Unit ${g.unitNumber} "${g.topicName}": hanya ${g.words.length} kata, minimal ${minWords}. Tambah kosakata ke CSV atau pakai --min-words.)`);
      continue;
    }
    console.log(`\nMemproses Bagian ${bagianNo}, Unit ${g.unitNumber} (${g.topicName})...`);
    const topic = await ensureTopic(unit.id, g.unitNumber, g.topicName);
    const newSignature = computeVocabSignature(g.words);
    if (topic.vocab_signature === newSignature) {
      if (!(await topicHasIncompleteSegments(topic.id)) && !(await reviewIsMissing(topic.id))) {
        console.log("  (lewati — kosakata sama persis & semua segmen sudah lengkap)");
        continue;
      }
      console.log("  (kosakata sama, tapi ada segmen belum lengkap — lanjut top-up)");
    }

    const levels = await ensureIntermediateLevels(topic.id);
    const plan = INTERMEDIATE_PLAN;
    const vocabByLevel = await planNewWordPlacement(supabase, callLadiz, cleanJson, INTERMEDIATE_SLOTS, topic.id, g.topicName, g.words);

    for (let i = 0; i < levels.length; i++) {
      const step = plan[i];
      const levelRow = levels[i];
      if (step.node_type === "review") continue; // dikerjakan sesudah 4 pelajaran selesai (lihat di bawah)
      const vocabForLevel = vocabByLevel[step.order_index] || [];
      let fallbackVocab = null;
      const getVocab = async () => {
        if (vocabForLevel.length > 0) return vocabForLevel;
        if (fallbackVocab === null) {
          const { data } = await supabase.from("vocab_items").select("kata_arab, latin, arti, contoh_kalimat").eq("level_id", levelRow.id);
          fallbackVocab = data || [];
        }
        return fallbackVocab;
      };

      const counts = await getSegmentExerciseCounts(levelRow.id);
      const totalSegments = segmentsForNodeType(step.node_type);
      const avoidList = await getExistingExerciseSummaries(levelRow.id);
      if (avoidList.length > 24) avoidList.splice(0, avoidList.length - 24);

      for (let seg = 1; seg <= totalSegments; seg++) {
        const existing = counts[seg] || 0;
        if (existing >= TARGET_MIN_PER_SEGMENT) {
          console.log(`  (lewati, lengkap: ${existing} soal) Level ${step.order_index} segmen ${seg}`);
          continue;
        }
        const vocabForAI = await getVocab();
        if (vocabForAI.length === 0) {
          console.warn(`  ⚠ Level ${step.order_index} segmen ${seg}: tidak ada kosakata — dilewati.`);
          continue;
        }
        console.log(existing > 0
          ? `  Top-up level ${step.order_index} segmen ${seg}: baru ${existing}/${TARGET_MIN_PER_SEGMENT} soal...`
          : `  Generating level ${step.order_index} segmen ${seg} (${step.node_type})...`);
        try {
          const exercises = await generateExercises({ bagianNo, topicName: g.topicName, nodeType: step.node_type, vocabList: vocabForAI, avoidList });
          console.log(`    → ${exercises.length} soal lolos: ${JSON.stringify(countByType(exercises))}`);
          await saveLevelContent(levelRow, vocabForLevel, exercises, useAudio, seg);
          avoidList.push(...exercises.map(summarizeExercise));
          if (avoidList.length > 24) avoidList.splice(0, avoidList.length - 24);
        } catch (err) {
          if (err.quotaExceeded) {
            console.warn(`\n⚠ Quota/koneksi AI habis (Bagian ${bagianNo}, Unit ${g.unitNumber}, Level ${step.order_index}, segmen ${seg}). Yang sudah diproses TERSIMPAN. Jalankan lagi perintah yang sama untuk melanjutkan.\n`);
            return;
          }
          console.error(`\n⚠ Segmen ${seg} (Unit ${g.unitNumber}, Level ${step.order_index}) gagal & DILEWATI: ${err.message}\n  Jalankan lagi nanti untuk mencoba ulang.\n`);
        }
      }
    }
    // ---- Bulatan REVIEW (level 5): 1 sesi soal BARU dari kata-kata 4 pelajaran ----
    try {
      await buildReviewLevel({ bagianNo, topicName: g.topicName, levelRows: levels, useAudio });
    } catch (err) {
      if (err.quotaExceeded) {
        console.warn(`\n⚠ Quota/koneksi AI habis saat membuat REVIEW (Unit ${g.unitNumber}). Yang sudah diproses TERSIMPAN. Jalankan lagi perintah yang sama.\n`);
        return;
      }
      console.error(`\n⚠ Review Unit ${g.unitNumber} gagal & DILEWATI: ${err.message}\n`);
    }
    changedTopicNames.push(g.topicName);
    const { error } = await supabase.from("topics").update({ vocab_signature: newSignature }).eq("id", topic.id);
    if (error) console.warn(`  ⚠ Gagal update vocab_signature "${g.topicName}": ${error.message}`);
  }

  const v = await recordCurriculumVersionIfChanged(supabase, subject.id, changedTopicNames);
  if (v) console.log(`\n📌 Curriculum version ${v.versionNumber} tercatat.`);
  console.log(`\nSelesai Bagian ${bagianNo}. Cek hasilnya di aplikasi; kalau ada topik yang kosakatanya masih kurang, tambah ke CSV lalu jalankan perintah yang sama (soal lama tidak ditimpa).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  });
}
