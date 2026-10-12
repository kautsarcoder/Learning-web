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
    // to_indonesian: SENGAJA tidak diterjemahkan per kata di sini (kata lepas "dia","tua" jadi
    // "he","old" -- tanpa "is"). Ditangani translateWordOrderBatch(), yang menerjemahkan
    // KALIMAT utuh lalu memecahnya jadi tile kata.
    if (content.direction === "to_arabic") {
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
bukan Inggris formal berlebihan -- ini buat aplikasi belajar bahasa kasual). WAJIB bahasa Inggris yang
GRAMATIKAL dan natural: bahasa Indonesia tidak punya kata kerja bantu, jadi tambahkan "is/am/are",
artikel (a/an/the), dan bentuk kata kerja yang benar bila perlu ("dia tua" -> "He is old",
"saya lapar" -> "I am hungry", "dia punya buku" -> "He has a book"). Jangan menerjemahkan kata per kata. INI DAFTAR per "id",
tiap id punya array string yang URUTAN & JUMLAHNYA HARUS DIPERTAHANKAN PERSIS (jangan digabung,
dipecah, dihilangkan, atau ditambah):

${JSON.stringify(items.map((it) => ({ id: it.id, strings: it.strings })))}

Balas HANYA JSON array, format PERSIS sama: [{ "id": "...", "strings": ["...(inggris)...", ...] }]`;

  const raw = await callLadiz(prompt, 4000);
  return JSON.parse(cleanJson(raw));
}


const hasArabic = (t) => /[\u0600-\u06FF]/.test(String(t || ""));
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Soal susun kata arah to_indonesian: terjemahkan KALIMAT UTUH (dengan konteks Arab supaya
// gender he/she jelas), lalu pecah jadi tile. Pengecoh (kata tunggal) diterjemahkan 1:1.
async function translateWordOrderBatch(items) {
  const prompt = `Tiap item adalah soal SUSUN KATA. Ada kalimat Arab (Levantine), terjemahan Indonesianya,
dan daftar kata pengecoh Indonesia. Buat versi INGGRIS-nya:

- "words": kalimat Inggris yang GRAMATIKAL & natural (tambahkan is/am/are, a/an/the, bentuk kata kerja
  yang benar -- Indonesia tidak punya kata kerja bantu: "dia tua" -> ["He","is","old"], "saya lapar" ->
  ["I","am","hungry"]) dipecah jadi array kata. Maknanya harus sama dengan kalimat Arab/Indonesia;
  pakai kalimat Arab untuk menentukan he/she/you/we/they. Maksimal 12 kata, tanda baca TIDAK jadi
  tile sendiri (taruh menempel pada kata terakhir bila perlu, atau hilangkan).
- "alternatives": 0-3 susunan Inggris LAIN yang sama-sama benar dan hanya memakai kata dari "words"
  (+ pengecoh), mis. kontraksi tidak boleh; kalau tidak ada, array kosong.
- "distractors": terjemahan Inggris tiap kata pengecoh Indonesia, URUTAN & JUMLAH sama persis,
  masing-masing SATU kata Inggris yang wajar. Jangan memakai kata yang sudah ada di "words".

Item:
${JSON.stringify(items.map((it) => ({ id: it.id, arab: it.arabic, indonesia: it.indonesian, pengecohIndonesia: it.distractors })))}

Balas HANYA JSON array: [{ "id": "...", "words": ["..."], "alternatives": [["..."]], "distractors": ["..."] }]`;
  const raw = await callLadiz(prompt, 4500);
  return JSON.parse(cleanJson(raw));
}

// Bangun content_en soal susun kata dari hasil AI; null kalau hasilnya tidak layak.
export function buildWordOrderEn(content, res) {
  if (!res || !Array.isArray(res.words)) return null;
  const words = res.words.map((w) => String(w || "").trim()).filter(Boolean);
  if (words.length < 1 || words.length > 12 || words.some(hasArabic)) return null;
  const origDistractors = distractorsOf(content);
  let dist = Array.isArray(res.distractors) ? res.distractors.map((w) => String(w || "").trim()) : [];
  if (dist.length !== origDistractors.length) return null; // 1:1 supaya jumlah ubin sama
  const lowerWords = new Set(words.map((w) => w.toLowerCase().replace(/[.,!?]/g, "")));
  const seen = new Set();
  dist = dist.filter((d) => {
    const k = d.toLowerCase().replace(/[.,!?]/g, "");
    if (!d || hasArabic(d) || lowerWords.has(k) || seen.has(k)) return false; // buang pengecoh yang bocor/ganda
    seen.add(k);
    return true;
  });
  const bank = [...words, ...dist];
  const byLower = new Map();
  for (const b of bank) if (!byLower.has(b.toLowerCase())) byLower.set(b.toLowerCase(), b);
  const accepted = [words];
  for (const alt of Array.isArray(res.alternatives) ? res.alternatives : []) {
    if (!Array.isArray(alt)) continue;
    const mapped = alt.map((w) => byLower.get(String(w || "").trim().toLowerCase()));
    if (mapped.some((w) => !w) || mapped.length === 0) continue;
    // tiap kata tidak boleh dipakai lebih sering dari jumlahnya di bank
    const need = new Map(); mapped.forEach((w) => need.set(w, (need.get(w) || 0) + 1));
    const have = new Map(); bank.forEach((w) => have.set(w, (have.get(w) || 0) + 1));
    if ([...need].some(([w, n]) => n > (have.get(w) || 0))) continue;
    if (accepted.some((a) => a.join(" ") === mapped.join(" "))) continue;
    accepted.push(mapped);
    if (accepted.length >= 4) break;
  }
  let shuffled = shuffle(bank);
  for (let i = 0; i < 5 && bank.length > 1 && shuffled.join("|") === words.join("|"); i++) shuffled = shuffle(bank);
  return { ...content, correctWords: words, acceptedOrders: accepted, wordBank: shuffled };
}

// Pengecoh Indonesia = isi wordBank dikurangi correctWords (hitung per kemunculan).
function distractorsOf(content) {
  const left = [...(content.wordBank || [])];
  for (const w of content.correctWords || []) {
    const i = left.indexOf(w);
    if (i >= 0) left.splice(i, 1);
  }
  return left;
}

function wordOrderJob(row) {
  const c = row.content;
  return {
    id: row.id,
    content: c,
    arabic: c.text,
    indonesian: (c.correctWords || []).join(" "),
    distractors: distractorsOf(c),
  };
}

async function translateWordOrderRows(rows) {
  const jobs = rows.map(wordOrderJob);
  let ok = 0, bad = 0;
  try {
    const results = await translateWordOrderBatch(jobs.map((j) => ({ id: j.id, arabic: j.arabic, indonesian: j.indonesian, distractors: j.distractors })));
    const byId = new Map((Array.isArray(results) ? results : []).map((r) => [r.id, r]));
    for (const j of jobs) {
      const en = buildWordOrderEn(j.content, byId.get(j.id));
      if (!en) { bad++; console.warn(`  ⚠ Soal susun-kata ${String(j.id).slice(0, 8)}: terjemahan tidak layak -- dilewati.`); continue; }
      const { error: updErr } = await supabase.from("exercises").update({ content_en: en }).eq("id", j.id);
      if (updErr) { bad++; continue; }
      ok++;
    }
  } catch (err) {
    bad += jobs.length;
    console.warn(`  ⚠ Batch susun-kata gagal total: ${err.message}`);
  }
  return { ok, bad };
}

// --fix-word-order: ulangi terjemahan SEMUA soal susun-kata to_indonesian yang sudah punya content_en
// (versi lama menerjemahkan per kata, hasilnya mis. "he old").
async function fixExistingWordOrder(limit) {
  console.log("\n=== Perbaiki content_en soal susun-kata (to_indonesian) ===");
  let done = 0, failed = 0;
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("exercises").select("id, type, content").eq("type", "word_order").order("id").range(from, from + 999);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const targets = all.filter((r) => r.content?.direction === "to_indonesian").slice(0, limit === Infinity ? undefined : limit);
  console.log(`  ${targets.length} soal akan diterjemahkan ulang.`);
  for (let i = 0; i < targets.length; i += 10) {
    const r = await translateWordOrderRows(targets.slice(i, i + 10));
    done += r.ok; failed += r.bad;
    console.log(`  Progres: ${done} berhasil, ${failed} gagal`);
  }
  return { done, failed };
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
    const doneBefore = done;
    const { data: rows, error } = await supabase
      .from("exercises")
      .select("id, type, content")
      .is("content_en", null)
      .limit(Math.min(20, limit - done - failed));
    if (error) throw error;
    if (!rows || rows.length === 0) break;

    const woRows = rows.filter((r) => r.type === "word_order" && r.content?.direction === "to_indonesian");
    if (woRows.length > 0) {
      const r = await translateWordOrderRows(woRows);
      done += r.ok; failed += r.bad;
    }
    rows.splice(0, rows.length, ...rows.filter((r) => !woRows.includes(r)));

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
    // Tidak ada kemajuan sama sekali di putaran ini -> baris yang sama akan terambil lagi terus; berhenti.
    if (done === doneBefore) { console.warn("  Tidak ada soal yang berhasil di putaran ini, berhenti (jalankan lagi nanti)."); break; }
    if (failed >= 150 && done === 0) { console.error("Terlalu banyak gagal beruntun tanpa 1 pun berhasil, berhenti."); break; }
  }
  return { done, failed };
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

  if (args.includes("--fix-word-order")) {
    const fx = await fixExistingWordOrder(limit);
    console.log(`\nSelesai: ${fx.done} diperbaiki, ${fx.failed} gagal.`);
    return;
  }

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
