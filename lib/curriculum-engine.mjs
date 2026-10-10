// lib/curriculum-engine.mjs
//
// Domain: DI MANA 1 KATA SEHARUSNYA DITEMPATKAN DI KURIKULUM.
// - Penempatan kata baru ke level yang paling sesuai (poin I)
// - Urutan pedagogis (AI kasih rekomendasi, program yang validasi — poin K/J)
// - Rebalance: evaluasi ulang posisi SEMUA kata (poin S, mode --rebalance)
// - Versioning kurikulum (poin O)
//
// Fungsi di sini butuh `supabase` (client) dan `callLadiz` (fungsi pemanggil
// AI) dikasih dari luar (dependency injection) — modul ini gak nentuin
// AI provider apa yang dipakai, itu urusan pemanggilnya (generate-vocab-v2.mjs).

import crypto from "node:crypto";

// ============================================================
// [REVISI DESAIN — 100 topik, gak berulang lintas-Bagian]
// ============================================================
// Sebelumnya: 10 topik tetap, 1 topik BERULANG di banyak Bagian, Bagian
// mana yang dapat topik itu ditentukan HASH (topic_name + difficulty +
// kata_arab). Masalahnya: gak scalable ke banyak Bagian sekaligus bikin
// tiap Bagian isinya topik yang SAMA lagi (cuma beda tingkat kesulitan).
//
// Sekarang: 1 topik = 1 slot (Bagian, Unit) TETAP, gak pernah berulang.
// CURRICULUM di bawah ini isinya 10 "domain" (= 10 Bagian), tiap domain
// punya 10 topik spesifik (= 10 Unit di dalam Bagian itu), progresif dari
// domain paling dasar (Bagian 1) ke paling lanjut (Bagian 10).
//
// Pengulangan MATERI (bukan topik) sekarang ditangani terpisah lewat
// mekanisme "sisip review lintas-unit" di api/adaptive-exercise.js —
// sistem otomatis nyisipin balik beberapa kata dari Unit lama (Bagian
// mana pun) ke sesi practice/review Unit baru, berbasis mastery_score/
// next_review_at user (bukan lewat pengulangan topik di sini).
//
// SCALABLE ke lebih dari 10 Bagian: tinggal TAMBAH ENTRY baru di array
// CURRICULUM (bagianNumber 11, 12, dst, masing-masing 10 topik baru) —
// TIDAK ADA hash/rentang yang perlu dihitung ulang atau disesuaikan.
// ============================================================
export const CURRICULUM = [
  {
    bagianNumber: 1,
    domain: "Dasar & Perkenalan",
    topics: [
      "Perkenalan Diri", "Sapaan", "Kata Ganti", "Angka 1-20", "Warna",
      "Hari & Tanggal", "Cuaca Dasar", "Anggota Keluarga", "Kata Sifat Dasar", "Terima Kasih & Maaf",
    ],
  },
  {
    bagianNumber: 2,
    domain: "Kehidupan Sehari-hari",
    topics: [
      "Rutinitas Pagi", "Waktu & Jam", "Aktivitas Rumah", "Makanan Sehari-hari", "Minuman",
      "Pekerjaan Rumah Tangga", "Barang di Rumah", "Ruangan Rumah", "Tidur & Istirahat", "Rutinitas Malam",
    ],
  },
  {
    bagianNumber: 3,
    domain: "Makan & Belanja",
    topics: [
      "Pesan di Restoran", "Menu Makanan", "Belanja di Pasar", "Tawar Harga", "Uang & Pembayaran",
      "Toko Kelontong", "Buah & Sayur", "Daging & Ikan", "Rasa Makanan", "Resep Sederhana",
    ],
  },
  {
    bagianNumber: 4,
    domain: "Transportasi & Arah",
    topics: [
      "Tanya Arah", "Naik Taksi", "Naik Bus", "Kendaraan Pribadi", "Lalu Lintas",
      "Nama Tempat di Kota", "Peta & Lokasi", "Bandara", "Stasiun", "Perjalanan Jauh",
    ],
  },
  {
    bagianNumber: 5,
    domain: "Kesehatan & Tubuh",
    topics: [
      "Anggota Tubuh", "Sakit & Gejala", "Ke Dokter", "Apotek", "Obat-obatan",
      "Kecelakaan Kecil", "Kesehatan Mental Dasar", "Olahraga", "Kebugaran", "Emosi & Perasaan",
    ],
  },
  {
    bagianNumber: 6,
    domain: "Pekerjaan & Sekolah",
    topics: [
      "Profesi", "Di Kantor", "Rapat Kerja", "Wawancara Kerja", "Di Sekolah",
      "Mata Pelajaran", "Universitas", "Tugas & Ujian", "Teknologi di Kerja", "Rekan Kerja",
    ],
  },
  {
    bagianNumber: 7,
    domain: "Sosial & Hubungan",
    topics: [
      "Kenalan Baru", "Ngobrol Santai", "Undang Teman", "Acara Keluarga", "Pernikahan",
      "Ulang Tahun", "Ucapan Selamat", "Curhat", "Nasihat", "Berargumen Sopan",
    ],
  },
  {
    bagianNumber: 8,
    domain: "Rumah & Tempat Tinggal",
    topics: [
      "Cari Tempat Tinggal", "Sewa Rumah", "Tetangga", "Perabotan", "Renovasi",
      "Listrik & Air", "Keamanan Rumah", "Pindah Rumah", "Kebersihan", "Hewan Peliharaan",
    ],
  },
  {
    bagianNumber: 9,
    domain: "Hiburan & Waktu Luang",
    topics: [
      "Hobi", "Film & TV", "Musik", "Baca Buku", "Media Sosial",
      "Liburan", "Wisata", "Olahraga Favorit", "Permainan", "Kumpul Teman",
    ],
  },
  {
    bagianNumber: 10,
    domain: "Topik Lanjutan",
    topics: [
      "Berita & Isu Terkini", "Pendapat & Diskusi", "Cuaca Ekstrem", "Lingkungan", "Teknologi Modern",
      "Uang & Perbankan", "Dokumen & Administrasi", "Darurat", "Budaya & Tradisi", "Percakapan Bebas",
    ],
  },
  // Nambah Bagian 11-20 nanti: tinggal tempel entry baru di sini, format sama.
];

// Sumber tunggal daftar 100 nama topik, urutannya = urutan definisi di
// CURRICULUM di atas (dipakai generate-vocab-v2.mjs buat validasi hasil
// klasifikasi AI, dan buat bikin daftar pilihan topik di prompt-nya).
export const TOPIC_NAMES = CURRICULUM.flatMap((d) => d.topics);

// Lookup topic_name -> { bagianNumber, unitNumber, domain }. Dibangun sekali
// waktu modul di-import, dipakai berulang oleh computeBagianNumber/
// computeUnitNumber di bawah.
const TOPIC_LOOKUP = new Map();
for (const d of CURRICULUM) {
  d.topics.forEach((topicName, i) => {
    TOPIC_LOOKUP.set(topicName, { bagianNumber: d.bagianNumber, unitNumber: i + 1, domain: d.domain });
  });
}

// Deterministik & sederhana: topic_name -> bagianNumber, LANGSUNG dari
// lookup (bukan hash lagi) — karena sekarang 1 topik cuma punya 1 slot.
export function computeBagianNumber(topicName) {
  const entry = TOPIC_LOOKUP.get(topicName);
  if (!entry) throw new Error(`computeBagianNumber: topic_name "${topicName}" tidak ada di CURRICULUM.`);
  return entry.bagianNumber;
}

// topic_name -> unitNumber (posisi topik itu DI DALAM domain/Bagian-nya, 1-10).
export function computeUnitNumber(topicName) {
  const entry = TOPIC_LOOKUP.get(topicName);
  if (!entry) throw new Error(`computeUnitNumber: topic_name "${topicName}" tidak ada di CURRICULUM.`);
  return entry.unitNumber;
}

// "Sidik jari" kosakata 1 topik — dipakai generate-vocab-v2.mjs buat skip
// topik yang gak ada perubahan (poin L+M, poin T: hemat AI call).
export function computeVocabSignature(words) {
  const sorted = words.map((w) => w.kata_arab).sort().join("|");
  return crypto.createHash("sha256").update(sorted).digest("hex");
}

// Poin K+J: minta AI urutkan kata secara pedagogis, TAPI program WAJIB
// validasi hasilnya sebelum dipakai — AI cuma "kasih rekomendasi",
// program tetap source of truth (poin J).
export async function orderWordsPedagogically(callLadiz, cleanJson, topicName, words) {
  if (words.length <= 1) return words;

  const wordList = words.map((w, i) => `${i + 1}. ${w.kata_arab} (${w.latin}) = ${w.arti}`).join("\n");
  const prompt = `Kamu bantu urutkan kosakata Bahasa Arab Levantine untuk topik "${topicName}" jadi urutan
BELAJAR yang masuk akal (paling dasar/fondasi dulu, baru yang lebih spesifik/jarang dipakai).
Contoh pola pikirnya: sapaan dasar & kata ganti ("halo", "aku", "kamu") sebelum frasa yang lebih
panjang/kompleks ("siapa namamu"), dan kosakata inti topik ini sebelum kosakata yang cuma
"nyerempet" terkait.

Daftar kata (JANGAN diubah ejaannya, JANGAN ada yang ditambah/dihapus/didobelin — cuma diurutkan ulang):
${wordList}

Balas HANYA JSON array berisi kata_arab dalam URUTAN BELAJAR yang kamu rekomendasikan
(harus PERSIS ${words.length} item, semua kata di atas harus ada, gak boleh ada yang hilang/dobel/nambah):
["kata_arab_1", "kata_arab_2", ...]`;

  let recommendedOrder;
  try {
    const raw = await callLadiz(prompt, 2000);
    recommendedOrder = JSON.parse(cleanJson(raw));
  } catch (err) {
    console.warn(`  ⚠ Gagal minta urutan pedagogis buat topik "${topicName}" (${err.message}) — pakai urutan asli.`);
    return words;
  }

  // VALIDASI KETAT — program = source of truth. Kalau AI ngaco (kata
  // hilang/dobel/nambah), BUANG rekomendasinya, fallback ke urutan asli.
  const originalSet = new Set(words.map((w) => w.kata_arab));
  const recommendedSet = new Set(recommendedOrder);
  const isValid =
    Array.isArray(recommendedOrder) &&
    recommendedOrder.length === words.length &&
    recommendedSet.size === words.length &&
    [...originalSet].every((k) => recommendedSet.has(k));

  if (!isValid) {
    console.warn(`  ⚠ Urutan pedagogis dari AI buat topik "${topicName}" tidak valid — pakai urutan asli.`);
    return words;
  }

  const wordByKataArab = new Map(words.map((w) => [w.kata_arab, w]));
  return recommendedOrder.map((k) => wordByKataArab.get(k));
}

// Poin I+K: tempatkan kata BARU ke level yang paling longgar isinya — kata
// LAMA yang sudah ada di database TIDAK PERNAH dipindah/disentuh di sini
// (lihat planFullRebalance kalau butuh evaluasi ulang kata lama juga).
export async function planNewWordPlacement(supabase, callLadiz, cleanJson, staticContentSlots, topicId, topicName, allWordsForTopic) {
  const { data: levelRows } = await supabase.from("levels").select("id, level_number").eq("topic_id", topicId);
  const levelIdByNumber = new Map((levelRows || []).map((l) => [l.level_number, l.id]));
  const staticLevelIds = staticContentSlots.map((s) => levelIdByNumber.get(s.order_index)).filter(Boolean);
  if (staticLevelIds.length === 0) return {};

  const { data: existingVocabRows } = await supabase
    .from("vocab_items")
    .select("kata_arab, level_id")
    .in("level_id", staticLevelIds);

  const existingKataSet = new Set((existingVocabRows || []).map((v) => v.kata_arab));
  const countByLevelId = {};
  for (const lid of staticLevelIds) countByLevelId[lid] = 0;
  for (const row of existingVocabRows || []) countByLevelId[row.level_id] = (countByLevelId[row.level_id] || 0) + 1;

  const newWords = allWordsForTopic.filter((w) => !existingKataSet.has(w.kata_arab));
  if (newWords.length === 0) return {};

  const orderedNewWords = await orderWordsPedagogically(callLadiz, cleanJson, topicName, newWords);

  const byLevel = {};
  for (const w of orderedNewWords) {
    let targetLevelNumber = staticContentSlots[0].order_index;
    let minCount = Infinity;
    for (const slot of staticContentSlots) {
      const lid = levelIdByNumber.get(slot.order_index);
      const c = countByLevelId[lid] ?? Infinity;
      if (lid && c < minCount) { minCount = c; targetLevelNumber = slot.order_index; }
    }
    if (!byLevel[targetLevelNumber]) byLevel[targetLevelNumber] = [];
    byLevel[targetLevelNumber].push(w);
    const lid = levelIdByNumber.get(targetLevelNumber);
    countByLevelId[lid] = (countByLevelId[lid] || 0) + 1;
  }
  return byLevel;
}

// Poin S: mode --rebalance — evaluasi ULANG posisi SEMUA kata (lama+baru).
// Poin N tetap berlaku: cuma UPDATE level_id (vocab_id gak berubah),
// caller (generate-vocab-v2.mjs) yang nentuin apply atau cuma preview.
export async function planFullRebalance(supabase, callLadiz, cleanJson, staticContentSlots, topicId, topicName, allWordsForTopic) {
  const { data: levelRows } = await supabase.from("levels").select("id, level_number").eq("topic_id", topicId);
  const levelIdByNumber = new Map((levelRows || []).map((l) => [l.level_number, l.id]));
  const levelNumberById = new Map((levelRows || []).map((l) => [l.id, l.level_number]));
  const staticLevelIds = staticContentSlots.map((s) => levelIdByNumber.get(s.order_index)).filter(Boolean);
  if (staticLevelIds.length === 0) return { proposedByLevel: {}, moved: [], newWords: [], keptExercises: 0, exercisesNeedingRegenerate: [] };

  const { data: existingVocabRows } = await supabase
    .from("vocab_items")
    .select("id, kata_arab, latin, arti, contoh_kalimat, level_id")
    .in("level_id", staticLevelIds);

  const existingByWord = new Map((existingVocabRows || []).map((v) => [v.kata_arab, v]));
  const newWords = allWordsForTopic.filter((w) => !existingByWord.has(w.kata_arab));

  const combined = [
    ...(existingVocabRows || []).map((v) => ({ kata_arab: v.kata_arab, latin: v.latin, arti: v.arti, contoh_kalimat: v.contoh_kalimat })),
    ...newWords,
  ];
  const orderedCombined = await orderWordsPedagogically(callLadiz, cleanJson, topicName, combined);

  const perLevel = Math.ceil(orderedCombined.length / staticContentSlots.length);
  const proposedByLevel = {};
  staticContentSlots.forEach((slot, i) => {
    proposedByLevel[slot.order_index] = orderedCombined.slice(i * perLevel, (i + 1) * perLevel);
  });

  const proposedLevelByWord = new Map();
  for (const [levelNumber, words] of Object.entries(proposedByLevel)) {
    for (const w of words) proposedLevelByWord.set(w.kata_arab, Number(levelNumber));
  }

  const moved = [];
  for (const v of existingVocabRows || []) {
    const currentLevelNumber = levelNumberById.get(v.level_id);
    const proposedLevelNumber = proposedLevelByWord.get(v.kata_arab);
    if (proposedLevelNumber !== undefined && proposedLevelNumber !== currentLevelNumber) {
      moved.push({ kata_arab: v.kata_arab, vocabId: v.id, fromLevel: currentLevelNumber, toLevel: proposedLevelNumber });
    }
  }

  const { data: allExercises } = await supabase.from("exercises").select("id, level_id, segment_number").in("level_id", staticLevelIds).eq("is_adaptive", false);
  const affectedLevelIds = new Set(moved.flatMap((m) => [levelIdByNumber.get(m.fromLevel), levelIdByNumber.get(m.toLevel)]).filter(Boolean));
  const keptExercises = (allExercises || []).filter((e) => !affectedLevelIds.has(e.level_id)).length;
  const exercisesInAffectedLevels = (allExercises || []).filter((e) => affectedLevelIds.has(e.level_id));

  return { proposedByLevel, moved, newWords, keptExercises, exercisesNeedingRegenerate: exercisesInAffectedLevels, levelIdByNumber };
}

// Poin O: catat versi kurikulum baru — CUMA kalau memang ada topik yang
// beneran berubah (changedTopicNames gak kosong).
export async function recordCurriculumVersionIfChanged(supabase, subjectId, changedTopicNames) {
  if (changedTopicNames.length === 0) return null;

  const { count: totalVocabCount } = await supabase.from("vocab_items").select("id", { count: "exact", head: true });
  const { data: lastVersion } = await supabase
    .from("curriculum_versions")
    .select("version_number")
    .eq("subject_id", subjectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersionNumber = (lastVersion?.version_number || 0) + 1;
  const { error } = await supabase.from("curriculum_versions").insert({
    subject_id: subjectId,
    version_number: nextVersionNumber,
    total_vocab_count: totalVocabCount || 0,
    changed_topic_names: [...new Set(changedTopicNames)],
  });
  if (error) throw error;
  return { versionNumber: nextVersionNumber, totalVocabCount };
}
