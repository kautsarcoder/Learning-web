// scripts-generate-vocab/migrate-bagian-assignment.mjs
//
// SEKALI JALAN — migrasi posisi kata LAMA di database supaya mengikuti
// algoritma assignBagianUnit yang BARU (hash-based, vocabulary-dependent),
// bukan yang lama (round-robin, position-dependent).
//
// KENAPA INI PERLU: sebelum perbaikan, Bagian tempat 1 kata jatuh
// ditentukan oleh POSISI kata itu di array hasil kurasi — bisa geser
// antar-run walau katanya sendiri gak berubah (lihat diskusi di
// generate-vocab-v2.mjs / lib/curriculum-engine.mjs). Kata-kata yang SUDAH
// masuk database dari run-run sebelumnya, posisinya "beku" di skema lama.
// Script ini menghitung ULANG Bagian yang SEHARUSNYA (skema baru) untuk
// tiap kata yang sudah ada, dan memindahkannya kalau beda.
//
// PRINSIP KESELAMATAN DATA:
//   1. TIDAK PERNAH menghapus/mengubah baris `exercises` — exercise yang
//      sudah pernah dikerjakan user (di Bagian manapun) TETAP UTUH persis
//      seperti sebelumnya.
//   2. Kata yang SUDAH punya exercise yang mengujinya (lewat exercise_vocab)
//      TIDAK dipindah otomatis — karena exercise itu masih fisik ada di
//      level/Bagian LAMA, sementara vocab_items-nya mau dipindah ke Bagian
//      BARU. Ini bikin exercise_vocab "menunjuk" ke vocab yang levelnya
//      beda topik dari exercise itu sendiri — bukan error fatal, tapi
//      butuh keputusan manual, bukan dipindah diam-diam oleh script.
//      Kata jenis ini akan MUNCUL DI LAPORAN tapi DILEWATI, kecuali kamu
//      sengaja pakai flag --move-words-with-exercises (lihat di bawah).
//   3. Kata yang BELUM punya exercise sama sekali (baru ditempatkan lewat
//      planNewWordPlacement tapi levelnya belum sempat digenerate soal, ATAU
//      levelnya practice/review yang memang adaptive) SELALU aman dipindah
//      — gak ada apa pun yang bisa "nyasar".
//   4. Default mode = PREVIEW (gak nulis apa pun ke database). Tambahkan
//      --commit buat benar-benar menjalankan perpindahan.
//
// Jalankan:
//   node scripts-generate-vocab/migrate-bagian-assignment.mjs                (preview)
//   node scripts-generate-vocab/migrate-bagian-assignment.mjs --commit         (terapkan)
//   node scripts-generate-vocab/migrate-bagian-assignment.mjs --commit --move-words-with-exercises
//     (juga pindahkan kata yang SUDAH ada exercise-nya — HATI-HATI, baca
//     poin 2 di atas dulu sebelum pakai flag ini)
//
import "dotenv/config";
import fs from "fs";
import {
  supabase,
  SUBJECT_SLUG,
  STATIC_CONTENT_SLOTS,
  ensureSubject,
  ensureUnit,
  ensureTopic,
  ensureLevels,
} from "./generate-vocab-v2.mjs";
import { computeBagianNumber, inferDifficultyFromBagian } from "../lib/curriculum-engine.mjs";

const PREVIEW_FILE = "migrate-bagian-preview.json";

// Cache count vocab_items per level, per topic — dihitung SEKALI (query
// database), lalu di-update di MEMORI tiap ada kata yang "diklaim" masuk
// level itu. Sebelumnya (versi awal) tiap kata query ulang ke database —
// lambat kalau migrasi ratusan kata sekaligus. Sekarang cuma 1 query per
// topic yang baru pertama kali disentuh, sisanya dari cache.
// Supabase/PostgREST kirim filter .in() lewat query string di URL — kalau
// array ID-nya banyak (ratusan UUID, tiap UUID ~36 karakter), URL-nya bisa
// tembus batas header server (~16KB) dan gagal dengan HeadersOverflowError.
// Helper ini pecah array jadi BATCH kecil (150 ID per request), query
// berkali-kali, gabung hasilnya — hasil akhirnya SAMA PERSIS kayak query
// sekali jalan, cuma lebih banyak round-trip (aman, bukan cuma workaround).
const IN_CHUNK_SIZE = 150;

const PAGE_SIZE = 1000; // Supabase/PostgREST batasi hasil maks 1000 baris per
                         // request SECARA DEFAULT — beda dari masalah "URL
                         // kepanjangan" (diatasi chunking .in()), ini perlu
                         // pagination (.range()) biar gak kepotong diam-diam.

async function selectInChunks(supabase, table, selectCols, filterCol, filterValues, extraFilterFn) {
  if (filterValues.length === 0) return [];
  const results = [];
  for (let i = 0; i < filterValues.length; i += IN_CHUNK_SIZE) {
    const chunk = filterValues.slice(i, i + IN_CHUNK_SIZE);
    let from = 0;
    while (true) {
      let query = supabase.from(table).select(selectCols).in(filterCol, chunk).range(from, from + PAGE_SIZE - 1);
      if (extraFilterFn) query = extraFilterFn(query);
      const { data, error } = await query;
      if (error) throw error;
      results.push(...(data || []));
      if (!data || data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return results;
}

const levelCountCache = new Map(); // topicId -> { levels: [...], counts: {levelId: n} }

async function pickLeastPopulatedStaticLevel(topicId) {
  let cached = levelCountCache.get(topicId);
  if (!cached) {
    const levels = await ensureLevels(topicId);
    const staticLevels = levels.filter((l) =>
      STATIC_CONTENT_SLOTS.some((s) => s.order_index === l.level_number)
    );
    const { data: countRows, error } = await supabase
      .from("vocab_items")
      .select("level_id")
      .in("level_id", staticLevels.map((l) => l.id));
    if (error) throw error;
    const counts = {};
    for (const lvl of staticLevels) counts[lvl.id] = 0;
    for (const row of countRows || []) counts[row.level_id] = (counts[row.level_id] || 0) + 1;
    cached = { levels: staticLevels, counts };
    levelCountCache.set(topicId, cached);
  }

  let best = cached.levels[0];
  let bestCount = Infinity;
  for (const lvl of cached.levels) {
    if (cached.counts[lvl.id] < bestCount) {
      bestCount = cached.counts[lvl.id];
      best = lvl;
    }
  }
  cached.counts[best.id] += 1; // "klaim" langsung di cache, biar kata berikutnya di topic yang sama gak milih level yang sama terus
  return best;
}

async function main() {
  const commit = process.argv.includes("--commit");
  const moveWordsWithExercises = process.argv.includes("--move-words-with-exercises");

  const subject = await ensureSubject();

  // 1. Peta unit (Bagian): unitId <-> bagianNumber (order_index)
  const { data: units, error: unitsErr } = await supabase
    .from("units")
    .select("id, order_index")
    .eq("subject_id", subject.id);
  if (unitsErr) throw unitsErr;
  const bagianByUnitId = new Map((units || []).map((u) => [u.id, u.order_index]));
  if (units.length === 0) {
    console.log("Belum ada unit/Bagian sama sekali di database — tidak ada yang perlu dimigrasi.");
    return;
  }

  // 2. Peta topic: topicId -> { name, unitNumber(order_index), unitId, bagianNumber }
  const topics = await selectInChunks(supabase, "topics", "id, name, order_index, unit_id", "unit_id", units.map((u) => u.id));
  const topicById = new Map(
    (topics || []).map((t) => [
      t.id,
      { name: t.name, unitNumber: t.order_index, unitId: t.unit_id, bagianNumber: bagianByUnitId.get(t.unit_id) },
    ])
  );

  // 3. Level STATIC (lesson/story/conversation) — cuma di situ vocab_items
  // beneran ditaruh (practice/review adaptive, gak punya vocab_items sendiri).
  const staticLevelNumbers = STATIC_CONTENT_SLOTS.map((s) => s.order_index);
  const levels = await selectInChunks(
    supabase, "levels", "id, topic_id, level_number", "topic_id", topics.map((t) => t.id),
    (q) => q.in("level_number", staticLevelNumbers)
  );
  const topicIdByLevelId = new Map((levels || []).map((l) => [l.id, l.topic_id]));

  // 4. Semua vocab_items yang ada di level static tersebut.
  const vocabItems = await selectInChunks(supabase, "vocab_items", "id, kata_arab, level_id", "level_id", levels.map((l) => l.id));

  console.log(`Ditemukan ${vocabItems.length} kata di database untuk dievaluasi ulang posisinya...\n`);

  const plan = { unchanged: 0, safeToMove: [], needsDecision: [] };

  for (const v of vocabItems) {
    const topicId = topicIdByLevelId.get(v.level_id);
    const topic = topicById.get(topicId);
    if (!topic) {
      console.warn(`  ⚠ vocab_id ${v.id} ("${v.kata_arab}") level_id-nya gak ketemu topic-nya — dilewati.`);
      continue;
    }
    const currentBagianNumber = topic.bagianNumber;
    const difficulty = inferDifficultyFromBagian(currentBagianNumber);
    if (difficulty === null) {
      console.warn(`  ⚠ "${v.kata_arab}": Bagian ${currentBagianNumber} gak cocok rentang difficulty manapun — dilewati.`);
      continue;
    }
    const newBagianNumber = computeBagianNumber(topic.name, difficulty, v.kata_arab);

    if (newBagianNumber === currentBagianNumber) {
      plan.unchanged++;
      continue;
    }

    // Cek apakah kata ini SUDAH ada exercise yang mengujinya.
    const { count: exerciseCount, error: exErr } = await supabase
      .from("exercise_vocab")
      .select("exercise_id", { count: "exact", head: true })
      .eq("vocab_id", v.id);
    if (exErr) throw exErr;

    const entry = {
      vocabId: v.id,
      kataArab: v.kata_arab,
      topicName: topic.name,
      unitNumber: topic.unitNumber,
      fromBagian: currentBagianNumber,
      toBagian: newBagianNumber,
      exerciseCount: exerciseCount || 0,
    };

    if ((exerciseCount || 0) === 0) {
      plan.safeToMove.push(entry);
    } else {
      plan.needsDecision.push(entry);
    }
  }

  // ============================================================
  // LAPORAN
  // ============================================================
  console.log(`Tetap di Bagian yang sama (gak perlu apa-apa): ${plan.unchanged} kata`);
  console.log(`Perlu pindah Bagian, AMAN (belum ada exercise): ${plan.safeToMove.length} kata`);
  console.log(`Perlu pindah Bagian, TAPI SUDAH ada exercise (butuh keputusan manual): ${plan.needsDecision.length} kata`);

  if (plan.safeToMove.length > 0) {
    console.log(`\nContoh kata yang AMAN dipindah:`);
    for (const e of plan.safeToMove.slice(0, 15)) {
      console.log(`  - "${e.kataArab}" (${e.topicName}): Bagian ${e.fromBagian} → Bagian ${e.toBagian}`);
    }
    if (plan.safeToMove.length > 15) console.log(`  ... dan ${plan.safeToMove.length - 15} kata lainnya.`);
  }

  if (plan.needsDecision.length > 0) {
    console.log(`\n⚠ Kata yang SUDAH ada exercise-nya (butuh keputusan manual):`);
    for (const e of plan.needsDecision) {
      console.log(
        `  - "${e.kataArab}" (${e.topicName}): Bagian ${e.fromBagian} → Bagian ${e.toBagian} ` +
        `(${e.exerciseCount} exercise sudah menguji kata ini)`
      );
    }
    console.log(
      `\n  Kata-kata di atas TIDAK dipindah otomatis. Kalau dipindah, exercise lama yang mengujinya\n` +
      `  akan tetap fisik ada di level/Bagian LAMA (soal user tidak berubah), tapi vocab_items-nya\n` +
      `  akan "diklaim" milik Bagian BARU — exercise_vocab jadi nunjuk ke vocab yang levelnya beda\n` +
      `  topik dari exercise itu sendiri. Ini gak merusak apa pun secara teknis (FK tetap valid),\n` +
      `  tapi artinya vocab_items.level_id gak lagi 100% mencerminkan "kata ini pernah diajarkan di\n` +
      `  Bagian mana". Kalau kamu tetap mau pindahkan, jalankan ulang dengan\n` +
      `  --commit --move-words-with-exercises.`
    );
  }

  fs.writeFileSync(PREVIEW_FILE, JSON.stringify(plan, null, 2));
  console.log(`\nRencana lengkap tersimpan di ${PREVIEW_FILE}.`);

  if (!commit) {
    console.log(`\nMode preview — TIDAK ADA yang ditulis ke database. Tambahkan --commit buat menerapkan.`);
    return;
  }

  // ============================================================
  // TERAPKAN
  // ============================================================
  const toApply = [...plan.safeToMove, ...(moveWordsWithExercises ? plan.needsDecision : [])];
  console.log(`\n→ --commit terdeteksi, memindahkan ${toApply.length} kata...`);

  let moved = 0;
  let failed = 0;
  for (const e of toApply) {
    try {
      const unit = await ensureUnit(subject.id, e.toBagian);
      const topic = await ensureTopic(unit.id, e.unitNumber, e.topicName);
      const targetLevel = await pickLeastPopulatedStaticLevel(topic.id);
      const { error } = await supabase
        .from("vocab_items")
        .update({ level_id: targetLevel.id })
        .eq("id", e.vocabId);
      if (error) throw error;
      moved++;
    } catch (err) {
      failed++;
      console.warn(`  ⚠ Gagal pindahkan "${e.kataArab}" (Bagian ${e.fromBagian} → ${e.toBagian}):`, err.message);
    }
  }

  console.log(`\n✓ Selesai. ${moved} kata dipindahkan, ${failed} gagal.`);
  if (plan.needsDecision.length > 0 && !moveWordsWithExercises) {
    console.log(
      `${plan.needsDecision.length} kata yang sudah ada exercise-nya SENGAJA tidak disentuh ` +
      `(lihat laporan di atas / ${PREVIEW_FILE}).`
    );
  }
  console.log(
    `\nCatatan: topic.vocab_signature TIDAK disentuh script ini — kalau posisi kata di suatu topik\n` +
    `berubah, run generate-vocab-v2.mjs berikutnya (mode normal) otomatis mendeteksi topik itu\n` +
    `"berubah" (signature gak match lagi) dan akan meng-top-up soal yang perlu, tanpa perlu langkah\n` +
    `tambahan dari script ini.`
  );
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exit(1);
});
