// scripts/translate-content-en.mjs
// node scripts/translate-content-en.mjs [--limit N]
//
// Isi vocab_items.arti_en dan exercises.content_en dengan TERJEMAHAN dari
// konten yang SUDAH ADA (bukan generate ulang dari nol -- jauh lebih hemat
// & konsisten dengan versi Indonesia-nya).
//
// PENTING (prinsip yang sama dipakai di seluruh pipeline ini): AI CUMA
// nerjemahin daftar STRING LEPAS. PROGRAM yang nyusun ulang balik ke posisi
// correctIndex/struktur aslinya. Field BAHASA ARAB (kata_arab, latin, teks
// posisi Arab, audio_url, correctIndex, ids, rightOrder) TIDAK PERNAH
// disentuh/dikirim ke AI sama sekali -- lihat extractTranslatable() di
// bawah, hasil audit manual ke-8 SHAPE_INSTRUCTIONS di generate-vocab-v2.mjs:
//
//   fill_blank         -> 100% Arab (opsi jawaban pun kata Arab) — TIDAK ADA yang diterjemahin
//   dialogue_complete  -> 100% Arab (opsi jawaban pun kata Arab) — TIDAK ADA yang diterjemahin
//   translate_choice   -> promptText (kata Indonesia yang mau diterjemahin)
//   translate_write    -> text (kalimat Indonesia)
//   word_order         -> to_indonesian: correctWords/acceptedOrders/wordBank (semua Indonesia)
//                         to_arabic: text (kalimat Indonesia jadi referensi)
//   listen_choose      -> options[].text (TANPA field latin = pasti makna Indonesia, bukan kata Arab)
//   reading_comprehension -> question + options[].text (sama, options TANPA latin)
//   matching_pairs     -> pairs[].right (makna Indonesia; pairs[].left/leftLatin tetap Arab)
//
// Prompt label ("Isi bagian yang kosong", dst) SENGAJA TIDAK diterjemahin di
// sini -- itu cuma ~15 label tetap yang berulang, jauh lebih murah &
// instan diterjemahin statis di frontend (lihat i18n di App.jsx) daripada
// dikirim ke AI per baris exercise.

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanJson(text) {
  return text.replace(/```json|```/g, "").trim();
}

async function callLadiz(prompt, maxTokens = 3000, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(`${process.env.LADIZ_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.LADIZ_API_KEY}` },
        body: JSON.stringify({
          model: "ladiz-core",
          messages: [{ role: "user", content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
      });
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (content) return content;
      lastErr = new Error("Respons LadizAI tidak terduga: " + JSON.stringify(json).slice(0, 200));
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1200 * attempt));
  }
  throw lastErr || new Error("LadizAI tidak merespons.");
}

// Balikin daftar { get, set } buat tiap string BAHASA INDONESIA yang perlu
// diterjemahin dari 1 exercise, sesuai tipe soalnya. `content` di-mutate
// LANGSUNG oleh set() -- caller yang kasih `content` hasil clone, bukan
// row asli, biar row asli (content, versi Indonesia) gak ke-ubah.
function extractTranslatable(type, content) {
  const paths = [];
  const add = (getFn, setFn) => paths.push({ get: getFn, set: setFn });

  if (type === "translate_choice") {
    if (typeof content.promptText === "string") add(() => content.promptText, (v) => (content.promptText = v));
  } else if (type === "translate_write") {
    if (typeof content.text === "string") add(() => content.text, (v) => (content.text = v));
  } else if (type === "listen_choose" || type === "reading_comprehension") {
    if (type === "reading_comprehension" && typeof content.question === "string") {
      add(() => content.question, (v) => (content.question = v));
    }
    (content.options || []).forEach((opt, i) => {
      // TANPA field "latin" = opsinya makna Indonesia (bukan kata Arab).
      // fill_blank/translate_choice/dialogue_complete's options SELALU
      // punya "latin" (kata Arab) -- otomatis gak kena filter ini.
      if (opt && typeof opt.text === "string" && !opt.latin) {
        add(() => content.options[i].text, (v) => (content.options[i].text = v));
      }
    });
  } else if (type === "matching_pairs") {
    (content.pairs || []).forEach((p, i) => {
      if (typeof p.right === "string") add(() => content.pairs[i].right, (v) => (content.pairs[i].right = v));
    });
  } else if (type === "word_order") {
    if (content.direction === "to_indonesian") {
      (content.correctWords || []).forEach((_, i) => add(() => content.correctWords[i], (v) => (content.correctWords[i] = v)));
      (content.acceptedOrders || []).forEach((order, oi) =>
        order.forEach((_, i) => add(() => content.acceptedOrders[oi][i], (v) => (content.acceptedOrders[oi][i] = v)))
      );
      (content.wordBank || []).forEach((_, i) => add(() => content.wordBank[i], (v) => (content.wordBank[i] = v)));
    } else if (content.direction === "to_arabic") {
      if (typeof content.text === "string") add(() => content.text, (v) => (content.text = v));
    }
  }
  // fill_blank & dialogue_complete: SENGAJA tidak ada case -- 100% Arab,
  // paths tetap kosong, content_en = salinan persis content aslinya.
  return paths;
}

async function translateBatch(items) {
  // items: [{ id, strings: [...] }]
  const prompt = `Terjemahkan tiap string Bahasa Indonesia berikut ke Bahasa Inggris (Inggris umum,
bukan Inggris formal berlebihan -- ini buat aplikasi belajar bahasa kasual). INI DAFTAR per "id",
tiap id punya array string yang URUTAN & JUMLAHNYA HARUS DIPERTAHANKAN PERSIS (jangan digabung,
dipecah, dihilangkan, atau ditambah):

${JSON.stringify(items.map((it) => ({ id: it.id, strings: it.strings })))}

Balas HANYA JSON array, format PERSIS sama: [{ "id": "...", "strings": ["...(inggris)...", ...] }]`;

  const raw = await callLadiz(prompt, 4000);
  return JSON.parse(cleanJson(raw));
}

async function translateVocab(limit) {
  console.log("\n=== Terjemahin arti vocab_items ke Inggris (arti_en) ===");
  let done = 0, failed = 0;
  while (done + failed < limit) {
    const { data: rows, error } = await supabase
      .from("vocab_items")
      .select("id, arti")
      .is("arti_en", null)
      .limit(Math.min(30, limit - done - failed));
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    try {
      const results = await translateBatch(rows.map((r) => ({ id: r.id, strings: [r.arti] })));
      const resultById = new Map(results.map((r) => [r.id, r.strings]));
      for (const r of rows) {
        const translated = resultById.get(r.id)?.[0];
        if (!translated) { failed++; continue; }
        const { error: updErr } = await supabase.from("vocab_items").update({ arti_en: translated }).eq("id", r.id);
        if (updErr) { failed++; continue; }
        done++;
      }
      console.log(`  ✓ Batch ${rows.length} kata diproses (total ${done} berhasil, ${failed} gagal)`);
    } catch (err) {
      failed += rows.length;
      console.warn(`  ⚠ Batch gagal total: ${err.message}`);
      if (failed >= 150 && done === 0) { console.error("Terlalu banyak gagal beruntun tanpa 1 pun berhasil, berhenti."); break; }
    }
  }
  return { done, failed };
}

async function translateExercises(limit) {
  console.log("\n=== Terjemahin isi soal ke Inggris (content_en) ===");
  let done = 0, failed = 0;
  while (done + failed < limit) {
    const { data: rows, error } = await supabase
      .from("exercises")
      .select("id, type, content")
      .is("content_en", null)
      .limit(Math.min(20, limit - done - failed));
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const jobs = rows.map((r) => {
      const cloned = JSON.parse(JSON.stringify(r.content));
      const paths = extractTranslatable(r.type, cloned);
      return { id: r.id, cloned, paths, strings: paths.map((p) => p.get()).filter((s) => typeof s === "string" && s.trim()) };
    });

    const jobsWithText = jobs.filter((j) => j.strings.length > 0);
    const jobsWithoutText = jobs.filter((j) => j.strings.length === 0);

    // Tipe 100% Arab (fill_blank, dialogue_complete) -- salin langsung,
    // gak perlu tanya AI sama sekali.
    for (const j of jobsWithoutText) {
      const { error: updErr } = await supabase.from("exercises").update({ content_en: j.cloned }).eq("id", j.id);
      if (updErr) { failed++; continue; }
      done++;
    }

    if (jobsWithText.length > 0) {
      try {
        const results = await translateBatch(jobsWithText.map((j) => ({ id: j.id, strings: j.strings })));
        const resultById = new Map(results.map((r) => [r.id, r.strings]));
        for (const j of jobsWithText) {
          const translatedStrings = resultById.get(j.id);
          if (!translatedStrings || translatedStrings.length !== j.paths.length) {
            failed++;
            console.warn(`  ⚠ Exercise ${j.id}: jumlah terjemahan gak cocok (dapat ${translatedStrings?.length ?? 0}, butuh ${j.paths.length}) -- dilewati, coba lagi run berikutnya.`);
            continue;
          }
          j.paths.forEach((p, i) => p.set(translatedStrings[i]));
          const { error: updErr } = await supabase.from("exercises").update({ content_en: j.cloned }).eq("id", j.id);
          if (updErr) { failed++; continue; }
          done++;
        }
      } catch (err) {
        failed += jobsWithText.length;
        console.warn(`  ⚠ Batch gagal total: ${err.message}`);
      }
    }
    console.log(`  Progres: ${done} berhasil, ${failed} gagal`);
    if (failed >= 150 && done === 0) { console.error("Terlalu banyak gagal beruntun tanpa 1 pun berhasil, berhenti."); break; }
  }
  return { done, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  const vocabResult = await translateVocab(limit);
  const exResult = await translateExercises(limit);

  console.log(`\n=== SELESAI ===`);
  console.log(`Vocab (arti_en): ${vocabResult.done} berhasil, ${vocabResult.failed} gagal.`);
  console.log(`Exercises (content_en): ${exResult.done} berhasil, ${exResult.failed} gagal.`);
}

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
