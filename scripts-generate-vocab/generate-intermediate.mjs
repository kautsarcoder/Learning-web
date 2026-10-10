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
// cocok dengan 10 topik Bagian ini disimpan ke unmatched-intermediate-B<N>.json (tidak hilang)
// dan bisa dipakai lagi untuk Bagian lain.

import "dotenv/config";
import fs from "fs";
import { pathToFileURL } from "node:url";
import {
  supabase,
  ensureSubject,
  ensureUnit,
  ensureTopic,
  ensureLevels,
  buildLevelPlan,
  STATIC_CONTENT_SLOTS,
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
  NARRATIVE_NODE_TYPES,
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

const TARGET_WORDS_PER_TOPIC = 120; // Intermediate boleh lebih kaya kosakata dari Beginner (100)

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

async function classifyAll(words, topics, checkpointFile, batchSize = 30) {
  let results = [];
  if (fs.existsSync(checkpointFile)) {
    try { results = JSON.parse(fs.readFileSync(checkpointFile, "utf-8")); } catch { results = []; }
    console.log(`Checkpoint klasifikasi: ${results.length} kata sudah diklasifikasi, dilanjutkan.`);
  }
  const done = new Set(results.map((r) => r.kata_arab));
  const remaining = words.filter((w) => !done.has(w.kata_arab));
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
const SYSTEM_RULES = `Level: INTERMEDIATE — Bahasa Arab Levantine (dialek Yordania), BUKAN Arab Fusha. Kalimat lebih panjang
dari level pemula: 5-9 kata, boleh memakai kata sambung (و، بس، لأن، إذا), negasi, kala lampau/akan, dan pola
percakapan nyata. Tetap pakai HANYA kosakata dari daftar (bentuk gramatikalnya boleh disesuaikan; kata dasarnya tidak).

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

const SHAPES = {
  lesson: `Balas HANYA JSON array berisi 8-13 soal dengan KOMPOSISI WAJIB (level ini fokus SUSUN KALIMAT & MATCHING):
 - word_order: minimal 6 soal — minimal 2 varian (A) to_arabic, minimal 2 varian (B) to_indonesian, minimal 2 varian
   SUARA (C dan D, masing-masing minimal 1).
 - matching_pairs: minimal 2 soal (masing-masing 5 pasang, kata-kata berbeda).
 - sisanya (0-5 soal): campuran translate_choice (5 opsi), fill_blank, translate_write, listen_choose (4 opsi).`,

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

function buildPrompt({ bagianNo, topicName, nodeType, vocabList, avoidList, feedback }) {
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

${SHAPES[nodeType]}${avoid}${fb}

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
  if (nodeType === "lesson") {
    if (wo < 5) problems.push(`word_order baru ${wo} (butuh minimal 5-6)`);
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

async function generateOnce({ bagianNo, topicName, nodeType, vocabList, avoidList, feedback, report }) {
  const prompt = buildPrompt({ bagianNo, topicName, nodeType, vocabList, avoidList, feedback });
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
  const pool = NARRATIVE_NODE_TYPES.includes(nodeType) ? limitNarrativeNames(parsed, report) : parsed;
  return await refineExerciseQuality(pool, nodeType, report);
}

const MAX_ROUNDS = 3;
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
  const rounds = NARRATIVE_NODE_TYPES.includes(nodeType) ? 1 : MAX_ROUNDS;
  for (let round = 1; round <= rounds; round++) {
    const report = { dropped: [] };
    const batch = await generateOnce({ ...ctx, avoidList: [...avoidList, ...accepted.map(summarizeExercise)], feedback, report });
    accepted.push(...batch);
    feedback.push(...report.dropped);
    const comp = compositionProblems(nodeType, accepted);
    const enough = accepted.length >= TARGET_MIN_PER_SEGMENT;
    if (enough && comp.length === 0) break;
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
// MAIN
// ============================================================
async function main() {
  const args = process.argv.slice(2);
  const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const commit = args.includes("--commit");
  const useAudio = args.includes("--audio");
  const bagianNo = Number(arg("--bagian"));
  const onlyTopic = arg("--topic");
  const csvPath = arg("--csv") || "kosakata-ammiyah.csv";

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
  const classifyFile = `classify-intermediate-${tag}.json`;
  const curationFile = `curation-intermediate-${tag}.json`;

  const words = loadFlatVocabCsv(csvPath);
  console.log(`Membaca ${words.length} kata dari ${csvPath}...`);

  const { results: classified, incomplete: ci } = await classifyAll(words, topics, classifyFile);
  const unmatched = classified.filter((w) => w.topic_name === NO_MATCH);
  const matched = classified.filter((w) => w.topic_name !== NO_MATCH);
  fs.writeFileSync(`unmatched-intermediate-${tag}.json`, JSON.stringify(unmatched, null, 2));
  console.log(`\n${matched.length} kata cocok dengan topik Bagian ${bagianNo}; ${unmatched.length} tidak cocok (disimpan di unmatched-intermediate-${tag}.json).`);
  if (ci) console.log("Klasifikasi belum selesai (quota/koneksi) — lanjut dengan yang sudah ada.");

  const { result: curated } = await curate(matched, curationFile);
  const topicNo = (name) => topics.findIndex(([n]) => n === name) + 1;
  const groups = {};
  for (const w of curated) {
    (groups[w.topic_name] ||= { topicName: w.topic_name, unitNumber: topicNo(w.topic_name), words: [] }).words.push(w);
  }
  let groupList = Object.values(groups).sort((a, b) => a.unitNumber - b.unitNumber);
  if (onlyTopic) groupList = groupList.filter((g) => g.topicName === onlyTopic);

  fs.writeFileSync(`preview-intermediate-${tag}.json`, JSON.stringify(groupList, null, 2));
  console.log(`\nRingkasan Bagian ${bagianNo}:`);
  for (const [name] of topics) {
    const g = groups[name];
    console.log(`  Unit ${String(topicNo(name)).padStart(2)} ${name}: ${g ? g.words.length : 0} kata${g ? "" : "  ← BELUM ADA KOSAKATA"}`);
  }
  if (!commit) {
    console.log(`\nMode preview — belum ada yang disimpan ke database. Detail: preview-intermediate-${tag}.json. Tambahkan --commit kalau sudah yakin.`);
    return;
  }

  const subject = await ensureSubject();
  const unit = await ensureUnit(subject.id, bagianNo); // nama "Bagian N", order_index = N
  const changedTopicNames = [];

  for (const g of groupList) {
    console.log(`\nMemproses Bagian ${bagianNo}, Unit ${g.unitNumber} (${g.topicName})...`);
    const topic = await ensureTopic(unit.id, g.unitNumber, g.topicName);
    const newSignature = computeVocabSignature(g.words);
    if (topic.vocab_signature === newSignature) {
      if (!(await topicHasIncompleteSegments(topic.id))) {
        console.log("  (lewati — kosakata sama persis & semua segmen sudah lengkap)");
        continue;
      }
      console.log("  (kosakata sama, tapi ada segmen belum lengkap — lanjut top-up)");
    }

    const levels = await ensureLevels(topic.id);
    const plan = buildLevelPlan();
    const vocabByLevel = await planNewWordPlacement(supabase, callLadiz, cleanJson, STATIC_CONTENT_SLOTS, topic.id, g.topicName, g.words);

    for (let i = 0; i < levels.length; i++) {
      const step = plan[i];
      const levelRow = levels[i];
      if (step.node_type === "practice" || step.node_type === "review") {
        console.log(`  (lewati level ${step.order_index} "${step.node_type}" — adaptive)`);
        continue;
      }
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
