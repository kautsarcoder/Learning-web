// scripts/backfill-vocab-audio.mjs
//
// Isi audio_url buat vocab_items yang BELUM punya audio (audio_url IS NULL)
// -- vocab-nya sendiri TIDAK dibuat ulang, cuma ditambahin suaranya.
//
// KENAPA INI DIPISAH DARI generate-vocab-v2.mjs --audio:
// TTS pakai ElevenLabs (generateAudio/uploadAudio) -- KUOTA-nya BEDA SAMA
// SEKALI dari LadizAI (dipakai callLadiz buat klasifikasi/kurasi/generate
// soal). Kalau LadizAI abis kuota tapi ElevenLabs masih ada, run
// `generate-vocab-v2.mjs --audio` tetap gak bisa dipakai buat ngisi audio
// vocab lama, karena dia bakal gagal duluan pas nyoba panggil LadizAI buat
// bagian klasifikasi/exercise -- padahal bagian AUDIO-nya sendiri gak
// butuh LadizAI sama sekali. Script ini motong ketergantungan itu: cuma
// baca vocab_items yang SUDAH ADA di database, gak nyentuh CSV/klasifikasi/
// kurasi/exercise apa pun -- jadi tetap jalan walau kuota LadizAI abis.
//
// Idempotent & aman diulang: cuma proses baris yang audio_url-nya masih
// NULL, jadi kalau macet di tengah (mis. kuota ElevenLabs abis juga),
// tinggal jalanin lagi -- otomatis lanjut dari yang belum kebagian.
//
// Jalankan:
//   node scripts/backfill-vocab-audio.mjs              (isi vocab_items)
//   node scripts/backfill-vocab-audio.mjs --exercises   (JUGA isi exercises
//     yang audio_url-nya masih NULL: listen_choose, DAN soal berbasis
//     cerita/dialog -- reading_comprehension/fill_blank dari story,
//     dialogue_complete dari conversation)
//   node scripts/backfill-vocab-audio.mjs --limit 50    (batasi 50 baris
//     dulu buat nyoba -- berguna kalau mau tes kuota ElevenLabs sisa berapa)
//
import "dotenv/config";
import { supabase, generateAudio, uploadAudio } from "./generate-vocab-v2.mjs";

// Jeda antar-panggilan ElevenLabs -- jaga-jaga rate limit di tier gratis/
// murah. Naikkan kalau masih kena 429, turunkan kalau tier-nya lega.
const DELAY_MS = 350;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function parseLimit() {
  const idx = process.argv.indexOf("--limit");
  if (idx === -1) return Infinity;
  const n = Number(process.argv[idx + 1]);
  return Number.isFinite(n) && n > 0 ? n : Infinity;
}

async function backfillVocab(limit) {
  console.log("=== Isi audio_url buat vocab_items yang masih kosong ===");
  let done = 0;
  let failed = 0;

  while (done + failed < limit) {
    const { data: rows, error } = await supabase
      .from("vocab_items")
      .select("id, kata_arab")
      .is("audio_url", null)
      .limit(Math.min(50, limit - done - failed));
    if (error) throw error;
    if (!rows || rows.length === 0) break; // udah abis semua yang kosong

    for (const v of rows) {
      try {
        const buf = await generateAudio(v.kata_arab);
        const url = await uploadAudio(v.kata_arab, buf);
        const { error: updateErr } = await supabase.from("vocab_items").update({ audio_url: url }).eq("id", v.id);
        if (updateErr) throw updateErr;
        done++;
        console.log(`  ✓ [${done}] "${v.kata_arab}"`);
      } catch (err) {
        failed++;
        console.warn(`  ⚠ Gagal "${v.kata_arab}": ${err.message}`);
        // Kuota ElevenLabs abis biasanya muncul sebagai 401/429 terus-terusan --
        // kalau udah 5x gagal beruntun, kemungkinan besar itu masalahnya,
        // mending berhenti daripada gagal ratusan kali sia-sia.
        if (failed >= 5 && done === 0) {
          console.error("\n5 kegagalan beruntun tanpa 1 pun berhasil -- kemungkinan kuota/API key ElevenLabs bermasalah. Berhenti.");
          return { done, failed };
        }
      }
      await sleep(DELAY_MS);
      if (done + failed >= limit) break;
    }
  }

  return { done, failed };
}

async function backfillExercises(limit) {
  console.log("\n=== Isi audio_url buat exercises tipe listen_choose yang masih kosong ===");
  let done = 0;
  let failed = 0;

  while (done + failed < limit) {
    const { data: rows, error } = await supabase
      .from("exercises")
      .select("id, content")
      .eq("type", "listen_choose")
      .is("audio_url", null)
      .limit(Math.min(50, limit - done - failed));
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    for (const ex of rows) {
      const sample = ex.content?.options?.[0]?.text;
      if (!sample) {
        console.warn(`  ⚠ Exercise ${ex.id}: gak ketemu teks buat di-TTS-kan (content.options[0].text kosong) -- dilewati.`);
        continue;
      }
      try {
        const buf = await generateAudio(sample);
        const url = await uploadAudio(sample, buf);
        const { error: updateErr } = await supabase.from("exercises").update({ audio_url: url }).eq("id", ex.id);
        if (updateErr) throw updateErr;
        done++;
        console.log(`  ✓ [${done}] exercise ${ex.id} ("${sample}")`);
      } catch (err) {
        failed++;
        console.warn(`  ⚠ Gagal exercise ${ex.id}: ${err.message}`);
        if (failed >= 5 && done === 0) {
          console.error("\n5 kegagalan beruntun tanpa 1 pun berhasil -- kemungkinan kuota/API key ElevenLabs bermasalah. Berhenti.");
          return { done, failed };
        }
      }
      await sleep(DELAY_MS);
      if (done + failed >= limit) break;
    }
  }

  return { done, failed };
}

// [BARU] Isi audio_url buat soal berbasis CERITA (reading_comprehension /
// fill_blank dari node_type "story", ditandai field content.hasAudio +
// content.passageText) DAN soal berbasis DIALOG (dialogue_complete dari
// node_type "conversation", ditandai content.hasAudio +
// content.dialogueLines) -- 2 tipe ini SEBELUMNYA gak ke-cover sama sekali
// oleh backfillExercises() di atas (yang cuma urus listen_choose).
//
// Optimisasi tambahan (TIDAK ada di generate-vocab-v2.mjs asli): kalau
// beberapa baris soal (misal 3-4 soal reading_comprehension dari CERITA
// YANG SAMA) punya teks identik, TTS cuma dipanggil SEKALI per teks unik
// dalam 1 kali jalan script ini -- baris-baris lain yang teksnya sama
// tinggal pakai audio_url yang sama, hemat kuota ElevenLabs. (Catatan:
// dedup ini cuma berlaku DALAM 1 kali eksekusi script -- kalau macet di
// tengah terus dijalankan ulang nanti, teks yang KEBETULAN sudah kebagian
// audio_url di baris lain sebelumnya TIDAK dicek ulang, jadi ada kemungkinan
// kecil TTS dipanggil lagi buat teks yang sebenarnya sudah punya audio di
// baris lain -- bukan bug fatal, cuma bukan penghematan maksimal.)
function getAudioTextForExercise(ex) {
  const c = ex.content || {};
  if (!c.hasAudio) return null;
  if (typeof c.passageText === "string" && c.passageText) return c.passageText;
  if (Array.isArray(c.dialogueLines)) {
    const text = c.dialogueLines.map((l) => l.text).filter(Boolean).join(" ");
    return text || null;
  }
  return null;
}

async function backfillStoryAndDialogueAudio(limit) {
  console.log("\n=== Isi audio_url buat soal cerita/dialog (reading_comprehension, fill_blank, dialogue_complete) yang masih kosong ===");
  let done = 0;
  let failed = 0;
  let reused = 0;
  const audioUrlByText = new Map();

  while (done + failed < limit) {
    const { data: rows, error } = await supabase
      .from("exercises")
      .select("id, type, content")
      .in("type", ["reading_comprehension", "fill_blank", "dialogue_complete"])
      .is("audio_url", null)
      .limit(Math.min(50, limit - done - failed));
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    for (const ex of rows) {
      const text = getAudioTextForExercise(ex);
      if (!text) continue; // fill_blank BIASA (bukan dari story, gak ada hasAudio) -- memang gak butuh audio, dilewati diam-diam

      try {
        let url = audioUrlByText.get(text);
        const isReuse = Boolean(url);
        if (!url) {
          const buf = await generateAudio(text);
          url = await uploadAudio(text, buf);
          audioUrlByText.set(text, url);
        }
        const { error: updateErr } = await supabase.from("exercises").update({ audio_url: url }).eq("id", ex.id);
        if (updateErr) throw updateErr;
        done++;
        if (isReuse) reused++;
        console.log(`  ✓ [${done}] exercise ${ex.id} (${ex.type})${isReuse ? " [pakai audio yang sudah dibuat barusan, teks sama]" : ""}`);
      } catch (err) {
        failed++;
        console.warn(`  ⚠ Gagal exercise ${ex.id}: ${err.message}`);
        if (failed >= 5 && done === 0) {
          console.error("\n5 kegagalan beruntun tanpa 1 pun berhasil -- kemungkinan kuota/API key ElevenLabs bermasalah. Berhenti.");
          return { done, failed, reused };
        }
      }
      await sleep(DELAY_MS);
      if (done + failed >= limit) break;
    }
  }

  return { done, failed, reused };
}

async function main() {
  const limit = parseLimit();
  const includeExercises = process.argv.includes("--exercises");

  const vocabResult = await backfillVocab(limit);
  console.log(`\nVocab: ${vocabResult.done} berhasil, ${vocabResult.failed} gagal.`);

  if (includeExercises) {
    const exResult = await backfillExercises(limit);
    console.log(`Exercises (listen_choose): ${exResult.done} berhasil, ${exResult.failed} gagal.`);

    const storyResult = await backfillStoryAndDialogueAudio(limit);
    console.log(
      `Exercises (cerita/dialog): ${storyResult.done} berhasil (${storyResult.reused} di antaranya pakai ulang ` +
      `audio yang teksnya sama), ${storyResult.failed} gagal.`
    );
  } else {
    console.log(`(Exercises listen_choose/cerita/dialog belum diisi -- tambahkan --exercises kalau mau sekalian.)`);
  }
}

main().catch((err) => {
  console.error("Gagal:", err);
  // [FIX WINDOWS] exitCode, bukan process.exit(1) -- lihat penjelasan di generate-vocab-v2.mjs
  process.exitCode = 1;
});
