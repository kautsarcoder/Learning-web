// scripts/backfill-vocab-audio.mjs
//
// Isi audio_url yang masih KOSONG (NULL) -- tanpa membuat ulang vocab/soalnya, dan tanpa LadizAI
// (cuma butuh ElevenLabs + Supabase), jadi tetap jalan walau kuota LadizAI habis.
//
// Jalankan:
//   node scripts/backfill-vocab-audio.mjs                (hanya kosakata / vocab_items)
//   node scripts/backfill-vocab-audio.mjs --exercises    (kosakata + SOAL: listen_choose, susun kata
//                                                         dengan suara, isian kalimat utuh, cerita, dialog)
//   node scripts/backfill-vocab-audio.mjs --exercises --skip-vocab   (hanya soal)
//   node scripts/backfill-vocab-audio.mjs --limit 50     (batasi per bagian, buat mencoba)
//   node scripts/backfill-vocab-audio.mjs --fix-listen-choose   (perbaiki audio listen_choose lama yang salah kata)
//
// Aman diulang: hanya baris dengan audio_url NULL yang diproses; teks yang sama (di database maupun
// dalam 1 kali jalan) memakai audio yang sudah ada, bukan membuat baru.
//
// [DIPERBAIKI dibanding versi lama]
//  - Dulu loop "ambil 50 baris audio_url NULL" bisa berputar TANPA HENTI: baris yang dilewati (mis. fill_blank
//    biasa tanpa audio) tetap NULL, jadi 50 baris yang sama terambil lagi terus. Sekarang pakai paginasi per id.
//  - Audio dialog dibuat dengan baris kosong DIISI jawaban benar (dulu "___" ikut dibacakan).
//  - Tipe yang dulu tidak tercakup: word_order bersuara dan fill_blank kalimat utuh (audioText).
//  - Teks sama di database tidak dibuat ulang lintas run (cache diisi dari audio yang sudah ada).
//  - Berhenti kalau 5 kegagalan BERUNTUN (kuota/API key), bukan hanya kalau belum ada yang berhasil.
import "dotenv/config";
import { supabase, audioUrlFor, seedAudioCache, dialogueSpokenText } from "./generate-vocab-v2.mjs";

const DELAY_MS = 350; // jeda antar-panggilan ElevenLabs; naikkan kalau kena 429
const PAGE = 50;
const MAX_CONSECUTIVE_FAILS = 5;
const ARABIC = /[؀-ۿ]/;
const EXERCISE_TYPES = ["listen_choose", "word_order", "fill_blank", "reading_comprehension", "dialogue_complete"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseLimit() {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return Infinity;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

// Teks yang harus dibacakan untuk 1 soal; null = soal ini memang tidak punya audio.
function spokenTextFor(ex) {
  const c = ex.content || {};
  if (ex.type === "listen_choose") return c.options?.[Number.isInteger(c.correctIndex) ? c.correctIndex : 0]?.text || null; // opsi BENAR (opsi sudah diacak)
  if (ex.type === "word_order") {
    if (c.audioText) return c.audioText;
    return c.hasAudio && ARABIC.test(c.text || "") ? c.text : null;
  }
  if (ex.type === "fill_blank" && !c.passageText) return c.hasAudio && c.audioText ? c.audioText : null;
  if (!c.hasAudio) return null;
  if (typeof c.passageText === "string" && c.passageText.trim()) return c.passageText;
  if (Array.isArray(c.dialogueLines)) return dialogueSpokenText(c) || null;
  return null;
}

// Baca tabel per halaman berdasarkan id (keyset) -- tiap baris dilihat tepat sekali.
async function* pagedRows(table, select, applyFilters) {
  let lastId = null;
  for (;;) {
    let q = supabase.from(table).select(select).order("id").limit(PAGE);
    q = applyFilters(q);
    if (lastId) q = q.gt("id", lastId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) return;
    for (const row of data) yield row;
    lastId = data[data.length - 1].id;
    if (data.length < PAGE) return;
  }
}

// Isi cache dengan audio yang sudah ada supaya teks yang sama tidak dibuat ulang.
async function seedFromDatabase(includeExercises) {
  let n = 0;
  for await (const v of pagedRows("vocab_items", "id, kata_arab, audio_url", (q) => q.not("audio_url", "is", null))) {
    seedAudioCache(v.kata_arab, v.audio_url); n++;
  }
  if (includeExercises) {
    for await (const ex of pagedRows("exercises", "id, type, content, audio_url", (q) => q.in("type", EXERCISE_TYPES).not("audio_url", "is", null))) {
      const t = spokenTextFor(ex);
      if (t) { seedAudioCache(t, ex.audio_url); n++; }
    }
  }
  console.log(`(cache audio terisi dari ${n} baris yang sudah punya audio)`);
}

async function runBackfill(title, rowsIterator, textOf, saveFn, limit) {
  console.log(`\n=== ${title} ===`);
  let done = 0, failed = 0, skipped = 0, consecutiveFails = 0;
  for await (const row of rowsIterator) {
    if (done + failed >= limit) break;
    const text = textOf(row);
    if (!text) { skipped++; continue; }
    try {
      const url = await audioUrlFor(text);
      await saveFn(row, url);
      done++; consecutiveFails = 0;
      console.log(`  ✓ [${done}] ${row.id.slice(0, 8)} "${text.slice(0, 40)}"`);
    } catch (err) {
      failed++; consecutiveFails++;
      console.warn(`  ⚠ Gagal ${row.id.slice(0, 8)}: ${err.message}`);
      if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
        console.error(`\n${MAX_CONSECUTIVE_FAILS} kegagalan beruntun -- kemungkinan kuota/API key ElevenLabs bermasalah. Berhenti; jalankan lagi nanti (lanjut otomatis).`);
        return { done, failed, skipped, stopped: true };
      }
    }
    await sleep(DELAY_MS);
  }
  return { done, failed, skipped, stopped: false };
}

// --fix-listen-choose: soal "dengarkan lalu pilih" lama diberi audio dari options[0] SETELAH opsi diacak, jadi
// suaranya sering BUKAN jawaban yang benar. Ganti audio_url semua soal itu dengan suara opsi yang benar.
// Teks yang sama dengan kosakata memakai audio kosakata (cache), jadi hampir tanpa kredit baru.
async function fixListenChoose(limit) {
  console.log("\n=== Perbaiki audio listen_choose (pakai opsi yang benar) ===");
  let done = 0, failed = 0, same = 0, consecutiveFails = 0;
  for await (const ex of pagedRows("exercises", "id, type, content, audio_url", (q) => q.eq("type", "listen_choose"))) {
    if (done + failed >= limit) break;
    const text = spokenTextFor(ex);
    if (!text) continue;
    try {
      const url = await audioUrlFor(text);
      if (url === ex.audio_url) { same++; continue; }
      const { error } = await supabase.from("exercises").update({ audio_url: url }).eq("id", ex.id);
      if (error) throw error;
      done++; consecutiveFails = 0;
      console.log(`  ✓ [${done}] ${ex.id.slice(0, 8)} "${text}"`);
    } catch (err) {
      failed++; consecutiveFails++;
      console.warn(`  ⚠ Gagal ${ex.id.slice(0, 8)}: ${err.message}`);
      if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) { console.error("5 kegagalan beruntun -- berhenti."); break; }
    }
    await sleep(DELAY_MS);
  }
  console.log(`listen_choose: ${done} diperbaiki, ${same} sudah benar, ${failed} gagal.`);
}

async function main() {
  const limit = parseLimit();
  if (process.argv.includes("--fix-listen-choose")) {
    await seedFromDatabase(false);
    await fixListenChoose(limit);
    return;
  }
  const includeExercises = process.argv.includes("--exercises");
  const skipVocab = process.argv.includes("--skip-vocab");

  await seedFromDatabase(includeExercises);

  if (!skipVocab) {
    const r = await runBackfill(
      "Isi audio_url kosakata (vocab_items)",
      pagedRows("vocab_items", "id, kata_arab", (q) => q.is("audio_url", null)),
      (v) => v.kata_arab,
      async (v, url) => { const { error } = await supabase.from("vocab_items").update({ audio_url: url }).eq("id", v.id); if (error) throw error; },
      limit
    );
    console.log(`Vocab: ${r.done} berhasil, ${r.failed} gagal.`);
    if (r.stopped) return;
  }

  if (includeExercises) {
    const r = await runBackfill(
      "Isi audio_url soal (listen_choose, susun kata, isian kalimat utuh, cerita, dialog)",
      pagedRows("exercises", "id, type, content", (q) => q.in("type", EXERCISE_TYPES).is("audio_url", null)),
      spokenTextFor,
      async (ex, url) => { const { error } = await supabase.from("exercises").update({ audio_url: url }).eq("id", ex.id); if (error) throw error; },
      limit
    );
    console.log(`Soal: ${r.done} berhasil, ${r.failed} gagal, ${r.skipped} dilewati (memang tanpa audio).`);
  } else {
    console.log("(Soal belum diisi -- tambahkan --exercises kalau mau sekalian.)");
  }
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exitCode = 1;
});
