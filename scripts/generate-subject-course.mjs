#!/usr/bin/env node
// ============================================================
// Generator konten Subject Language (untuk ADMIN, dijalankan manual).
//
//   PDF/TXT buku -> ekstrak teks -> pecah per Unit -> AI membuat
//   section/lesson/exercise (vocab, academic, exam language, soal) ->
//   validasi ketat -> simpan ke JSON (+ opsional upload ke Supabase).
//
// AI hanya dipanggil SEKALI per unit saat generate. User yang belajar
// membaca hasilnya dari database — tidak ada panggilan AI saat mengerjakan soal.
//
// Contoh:
//   LADIZ_API_KEY boleh ditaruh di file .env (folder tempat perintah dijalankan) atau di-set lewat terminal:
//   (Windows cmd)  set LADIZ_API_KEY=...
//   node scripts/generate-subject-course.mjs --file buku.pdf \
//        --id islamic-banking-ar --title "Islamic Banking" --language Arabic --units 4
//   (hasil: out/islamic-banking-ar.json — periksa dulu!)
//
// MODE PER BAB (satu file PDF/TXT = satu Unit):
//   node scripts/generate-subject-course.mjs --dir bab --id islamic-banking-ar --title "Islamic Banking"
//     -> semua .pdf/.txt di folder "bab" diproses berurutan nama file (bab1.pdf, bab2.pdf, ... bab10.pdf)
//   Tambah bab belakangan ke course yang sudah ada (unit baru dilanjutkan nomornya):
//   node scripts/generate-subject-course.mjs --file bab5.pdf --append --id islamic-banking-ar --title "Islamic Banking"
//   (--append membaca out/<id>.json lalu menambah unit di akhir; --units tidak dipakai di mode per bab)
//   Upload sebagai DRAFT ke Supabase (published=false):
//   (upload memakai Supabase KEDUA, terpisah dari Levantine)
//   set SUBJECT_SUPABASE_URL=...  &  set SUBJECT_SUPABASE_SERVICE_KEY=...  lalu jalankan dengan --upload:
//   node scripts/generate-subject-course.mjs \
//        --file buku.pdf --id ... --title ... --upload
//   Setelah review: update subject_courses set published = true where id = '...';
//
// TERJEMAHAN INGGRIS: generator juga meminta field `en` (prompt, penjelasan, pilihan, dll.)
// pada tiap soal, supaya user bisa belajar dengan UI/isi soal berbahasa Inggris.
// Untuk course lama yang belum punya terjemahan:
//   node scripts/generate-subject-course.mjs --translate --id islamic-banking-ar --title "Islamic Banking"
//   (membaca out/<id>.json, menerjemahkan hanya unit yang belum punya `en`)
//
// Butuh Node 18+. PDF diekstrak lewat `pdftotext` (poppler-utils) kalau ada.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

// Baca file .env (di folder tempat perintah dijalankan) supaya LADIZ_API_KEY dkk. terbaca
// walau tidak di-set lewat terminal. Variabel yang sudah ada di terminal tidak ditimpa.
for (const envFile of [".env.local", ".env"]) {
  try {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch { /* file tidak ada: lewati */ }
}

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith("--")) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : true]);
    return acc;
  }, [])
);
const MODEL = process.env.SL_MODEL || "ladiz-apex";
const API = (process.env.LADIZ_BASE_URL || "https://ladiz.com") + "/v1/messages";
const UNITS = Number(args.units || 4);
// Kepadatan soal: teks panjang dipecah jadi beberapa potongan kecil, tiap potongan 1 panggilan AI.
// Makin kecil --part-chars / makin besar --per-part, makin banyak soal.
const PART_CHARS = Number(args["part-chars"] || 2500);
const PER_PART = Number(args["per-part"] || 20);

// ---------- 1. ekstraksi teks ----------
export function extractText(file) {
  if (/\.pdf$/i.test(file)) {
    return execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8", maxBuffer: 1 << 28 });
  }
  return fs.readFileSync(file, "utf8");
}

// Daftar file bab dalam folder, diurutkan "natural" (bab2 sebelum bab10).
export function listChapterFiles(dir) {
  return fs.readdirSync(dir)
    .filter((f) => /\.(pdf|txt)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((f) => path.join(dir, f));
}

// ---------- 2. pecah jadi N bagian (per Unit), di batas paragraf ----------
export function splitIntoChunks(text, n) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const total = paras.reduce((a, p) => a + p.length, 0);
  const target = Math.ceil(total / n);
  const chunks = [];
  let cur = [], len = 0;
  for (const p of paras) {
    cur.push(p); len += p.length;
    if (len >= target && chunks.length < n - 1) { chunks.push(cur.join("\n\n")); cur = []; len = 0; }
  }
  if (cur.length) chunks.push(cur.join("\n\n"));
  return chunks;
}

// ---------- 3. prompt ----------
const SYSTEM = `Kamu adalah pembuat materi belajar bahasa berbasis mata pelajaran. Tugasmu: dari potongan buku, buat SATU Unit belajar untuk membantu siswa memahami BAHASA buku/ujian (bukan hanya isi materinya).
Balas HANYA dengan JSON valid (tanpa markdown) berbentuk:
{"title": "judul unit (bahasa Indonesia)", "en": {"title": "..."},
 "sections": [{"title": "...", "en": {"title": "..."}, "lessons": [{"kind": "vocab|context|academic|practice|review", "exercises": [EX, ...]}]}]}
Gunakan section seperti: Pengertian, Kosakata, Syarat/Isi inti, Bahasa Ujian, Latihan Ujian (sesuaikan dengan isi).
Setiap EX WAJIB punya:
 "type": "mcq" | "tf" | "fill" | "match" | "translate" | "reading",
 "prompt": instruksi singkat dalam bahasa Indonesia,
 "category": "vocabulary" | "academic" | "exam" | "question",
 "lang": "vocabulary" | "academic" | "exam" | "reading"   (skill BAHASA yang dilatih),
 "focus": (opsional, untuk soal kosakata/ungkapan) "verb" = kata kerja (sertakan bentuk dasar/perubahannya), "word" = kosakata asing/jarang dikenal, "sentence" = kalimat/ungkapan asing,
 "subj": skill MATERI yang diuji (mis. "Syarat Murabahah"),
 "explain": penjelasan singkat Indonesia (wajib untuk soal ujian),
 "langTags": [frasa pola bahasa dalam soal, opsional].
Field per type:
 mcq/fill : "promptAr" (teks asli bahasa materi; fill pakai ______), "options" (4 string), "answer" (indeks 0-3 dari opsi benar)
 tf       : "promptAr", "answer" true/false
 match    : "pairs": [[kata_asli, arti_indonesia], ...] (3-6 pasang)
 translate: "promptAr", "answers": [terjemahan Indonesia yang diterima, ...]
 reading  : "passage" (bacaan asli), "passageTranslation" (Indonesia), "promptAr" (pertanyaan), "options", "answer"
TERJEMAHAN INGGRIS (wajib): tiap EX punya "en": {"prompt": terjemahan prompt, "explain": terjemahan explain (jika ada), "subj": terjemahan subj,
   "options": terjemahan SEMUA opsi jika opsi berbahasa Indonesia (jumlah & URUTAN sama; JANGAN sertakan jika opsi berbahasa Arab),
   "pairs": array terjemahan Inggris untuk kolom KANAN pairs saja (urutan sama), "answers": jawaban terjemahan dalam Inggris (hanya type translate),
   "passageTranslation": terjemahan Inggris bacaan (hanya type reading)}.
Unit dan tiap section juga punya "en": {"title": judul Inggris}.
Aturan: gunakan HANYA istilah/fakta yang ada di potongan buku; jangan mengarang. Pilihan salah harus masuk akal. Sertakan: kosakata, ungkapan akademik (mis. بناءً على ما سبق), pola bahasa ujian (أي مما يلي، ما عدا، ما المقصود بـ ...), dan soal gaya ujian. Jumlah soal: buat SEBANYAK mungkin yang masih bermutu, targetnya sekitar __PERPART__ soal untuk potongan ini. Tiap konsep/istilah/syarat/hukum penting di teks harus punya minimal 1-2 soal, dengan variasi tipe (mcq, tf, fill, match, translate, reading). Jangan berhenti di 15 soal. Untuk kategori kosakata, JANGAN hanya kata benda/istilah umum: gabungkan juga KATA KERJA (focus "verb"), KOSAKATA YANG TIDAK FAMILIAR/jarang dijumpai (focus "word") dan KALIMAT-KALIMAT ASING/pola kalimat yang sulit (focus "sentence") dari potongan buku, dengan variasi tipe soal.`;

// Satu fungsi untuk semua panggilan AI (generate unit & terjemahan).
async function chat(system, userText) {
  const key = process.env.LADIZ_API_KEY;
  if (!key) throw new Error("Set LADIZ_API_KEY dulu.");
  let res;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({ model: MODEL, max_tokens: 16000, system, messages: [{ role: "user", content: userText }] }),
      });
    } catch (e) { res = null; if (attempt === 4) throw new Error(`Gagal terhubung ke API: ${e.message}`); }
    // 429/5xx = gangguan sementara (mis. 504 timeout gateway): tunggu lalu coba lagi, jangan langsung menyerah.
    if (res && (res.ok || ![429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(res.status))) break;
    if (attempt === 4) break;
    const wait = 5000 * attempt;
    console.error(`  API ${res ? res.status : "putus"}, coba lagi dalam ${wait / 1000} detik...`);
    await new Promise((r) => setTimeout(r, wait));
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").slice(0, 200)}`);
  const data = await res.json();
  if (Array.isArray(data.content)) return data.content.map((b) => b.text || "").join("");
  if (data.choices && data.choices[0] && data.choices[0].message) return data.choices[0].message.content;
  throw new Error("Format response API tidak dikenal.");
}
const callModel = (userText) => chat(SYSTEM.replace("__PERPART__", String(PER_PART)), userText);

export function parseJson(raw) {
  const s = raw.indexOf("{"), e = raw.lastIndexOf("}");
  if (s < 0 || e < 0) throw new Error("Tidak ada JSON di balasan model");
  return JSON.parse(raw.slice(s, e + 1));
}

// ---------- 4. normalisasi + validasi (ID dibuat di sini, bukan oleh AI) ----------
const KINDS = ["vocab", "context", "academic", "practice", "review"];
const CATS = ["vocabulary", "academic", "exam", "question"];
const FOCUS = ["verb", "word", "sentence"];
const LANGS = ["vocabulary", "academic", "exam", "reading"];
const nonEmpty = (v) => typeof v === "string" && v.trim().length > 0;

const EN_KEYS = ["prompt", "explain", "subj", "options", "answers", "pairs", "passageTranslation"];
// Validasi terjemahan: bentuk harus cocok dengan versi Indonesia (jumlah opsi/pasangan sama),
// supaya indeks jawaban tidak bergeser. Terjemahan yang tidak valid dibuang (soal tetap jalan, hanya tanpa Inggris).
export function cleanEn(en, out) {
  if (!en || typeof en !== "object") return undefined;
  const e = {};
  for (const k of EN_KEYS) if (en[k] !== undefined) e[k] = en[k];
  const ok = (v) => nonEmpty(v);
  for (const k of ["prompt", "explain", "subj", "passageTranslation"]) if (e[k] !== undefined && !ok(e[k])) delete e[k];
  if (e.options !== undefined && !(Array.isArray(e.options) && out.options && e.options.length === out.options.length && e.options.every(ok))) delete e.options;
  if (e.pairs !== undefined && !(Array.isArray(e.pairs) && out.pairs && e.pairs.length === out.pairs.length && e.pairs.every(ok))) delete e.pairs;
  if (e.answers !== undefined && !(Array.isArray(e.answers) && e.answers.length && e.answers.every(ok))) delete e.answers;
  return Object.keys(e).length ? e : undefined;
}

export function normalizeExercise(ex, id) {
  const bad = (m) => { throw new Error(`${id}: ${m}`); };
  if (!nonEmpty(ex.prompt)) bad("prompt kosong");
  if (!CATS.includes(ex.category)) bad(`category tidak valid (${ex.category})`);
  if (!LANGS.includes(ex.lang)) bad(`lang tidak valid (${ex.lang})`);
  if (!nonEmpty(ex.subj)) bad("subj kosong");
  const out = { id, type: ex.type, prompt: ex.prompt.trim(), category: ex.category, lang: ex.lang, subj: ex.subj.trim() };
  if (FOCUS.includes(ex.focus)) out.focus = ex.focus;
  if (nonEmpty(ex.explain)) out.explain = ex.explain.trim();
  if (Array.isArray(ex.langTags) && ex.langTags.length) out.langTags = ex.langTags.filter(nonEmpty);
  switch (ex.type) {
    case "mcq": case "fill": case "reading": {
      if (!nonEmpty(ex.promptAr)) bad("promptAr kosong");
      if (!Array.isArray(ex.options) || ex.options.length < 2 || !ex.options.every(nonEmpty)) bad("options tidak valid");
      if (new Set(ex.options).size !== ex.options.length) bad("options duplikat");
      if (!Number.isInteger(ex.answer) || ex.answer < 0 || ex.answer >= ex.options.length) bad("answer di luar jangkauan");
      Object.assign(out, { promptAr: ex.promptAr, options: ex.options, answer: ex.answer });
      if (ex.type === "reading") {
        if (!nonEmpty(ex.passage)) bad("passage kosong");
        out.passage = ex.passage;
        if (nonEmpty(ex.passageTranslation)) out.passageTranslation = ex.passageTranslation;
      }
      break;
    }
    case "tf":
      if (!nonEmpty(ex.promptAr) || typeof ex.answer !== "boolean") bad("tf tidak valid");
      Object.assign(out, { promptAr: ex.promptAr, options: ["Benar", "Salah"], answer: ex.answer ? 0 : 1 });
      break;
    case "match":
      if (!Array.isArray(ex.pairs) || ex.pairs.length < 2 || !ex.pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every(nonEmpty))) bad("pairs tidak valid");
      if (new Set(ex.pairs.map((p) => p[1])).size !== ex.pairs.length) bad("arti pada pairs duplikat");
      out.pairs = ex.pairs;
      break;
    case "translate":
      if (!nonEmpty(ex.promptAr) || !Array.isArray(ex.answers) || !ex.answers.length || !ex.answers.every(nonEmpty)) bad("translate tidak valid");
      Object.assign(out, { promptAr: ex.promptAr, answers: ex.answers });
      break;
    default:
      bad(`type tidak dikenal (${ex.type})`);
  }
  const en = cleanEn(ex.en, out);
  if (en) out.en = en;
  return out;
}

export function buildUnit(raw, unitNo) {
  const uid = `u${unitNo}`;
  if (!nonEmpty(raw.title) || !Array.isArray(raw.sections) || !raw.sections.length) throw new Error(`${uid}: struktur unit tidak valid`);
  const sections = raw.sections.map((sec, si) => {
    const sid = `${uid}-s${si + 1}`;
    if (!nonEmpty(sec.title) || !Array.isArray(sec.lessons)) throw new Error(`${sid}: section tidak valid`);
    const lessons = sec.lessons.map((l, li) => {
      const lid = `${sid}-l${li + 1}`;
      if (!KINDS.includes(l.kind)) throw new Error(`${lid}: kind tidak valid (${l.kind})`);
      if (!Array.isArray(l.exercises) || !l.exercises.length) throw new Error(`${lid}: lesson tanpa soal`);
      return { id: lid, kind: l.kind, exercises: l.exercises.map((e, ei) => normalizeExercise(e, `${lid}-e${ei + 1}`)) };
    });
    const secOut = { id: sid, title: sec.title.trim(), lessons };
    if (sec.en && nonEmpty(sec.en.title)) secOut.en = { title: sec.en.title.trim() };
    return secOut;
  });
  const unitOut = { id: uid, title: raw.title.trim(), sections };
  if (raw.en && nonEmpty(raw.en.title)) unitOut.en = { title: raw.en.title.trim() };
  return unitOut;
}

// ---------- 4b. pass terjemahan untuk course yang sudah ada ----------
const TRANSLATE_SYSTEM = `Kamu menerjemahkan materi belajar dari Indonesia ke Inggris. Teks Arab JANGAN diubah. Balas HANYA JSON valid:
{"unit": {"title": "..."}, "sections": {"<sectionId>": "<English title>"}, "exercises": {"<exerciseId>": {"prompt": "...", "explain": "...", "subj": "...", "options": [...], "pairs": [...], "answers": [...], "passageTranslation": "..."}}}
Aturan: sertakan hanya field yang ada di input. "options": terjemahkan hanya jika opsi berbahasa Indonesia, jumlah & urutan HARUS sama. "pairs": array terjemahan untuk kolom KANAN saja, urutan sama. "answers": jawaban terjemahan yang diterima dalam Inggris.`;

async function translateUnit(unit) {
  const input = { unit: { title: unit.title }, sections: {}, exercises: {} };
  for (const sec of unit.sections) {
    input.sections[sec.id] = sec.title;
    for (const l of sec.lessons) for (const e of l.exercises) {
      const x = { prompt: e.prompt, subj: e.subj };
      if (e.explain) x.explain = e.explain;
      if (e.options && e.options.some((o) => !/[\u0600-\u06FF]/.test(o)) && e.type !== "tf") x.options = e.options;
      if (e.type === "tf") x.options = e.options;
      if (e.pairs) x.pairs = e.pairs.map((p) => p[1]);
      if (e.answers) x.answers = e.answers;
      if (e.passageTranslation) x.passageTranslation = e.passageTranslation;
      input.exercises[e.id] = x;
    }
  }
  return parseJson(await chat(TRANSLATE_SYSTEM, JSON.stringify(input)));
}

export function applyTranslation(unit, tr) {
  if (tr.unit && nonEmpty(tr.unit.title)) unit.en = { title: tr.unit.title.trim() };
  for (const sec of unit.sections) {
    if (tr.sections && nonEmpty(tr.sections[sec.id])) sec.en = { title: tr.sections[sec.id].trim() };
    for (const l of sec.lessons) for (const e of l.exercises) {
      const en = cleanEn(tr.exercises && tr.exercises[e.id], e);
      if (en) e.en = en;
    }
  }
}

// ---------- 5. main ----------
export function splitParts(text, maxChars) {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const parts = []; let cur = [], len = 0;
  for (const p of paras) {
    if (len && len + p.length > maxChars) { parts.push(cur.join("\n\n")); cur = []; len = 0; }
    cur.push(p); len += p.length;
  }
  if (cur.length) parts.push(cur.join("\n\n"));
  return parts.length ? parts : [text];
}

// Gabungkan hasil beberapa potongan jadi satu unit: section berjudul sama disatukan.
export function mergeRawUnits(raws) {
  const out = { title: raws[0].title, en: raws[0].en, sections: [] };
  for (const r of raws) for (const sec of r.sections || []) {
    const hit = out.sections.find((s) => s.title && sec.title && s.title.trim() === sec.title.trim());
    if (hit) hit.lessons.push(...(sec.lessons || [])); else out.sections.push({ ...sec, lessons: [...(sec.lessons || [])] });
  }
  return out;
}

// Bersihkan hasil AI per potongan: perbaiki yang bisa diperbaiki, BUANG soal yang cacat
// (jangan menggagalkan seluruh potongan karena 1 soal rusak).
const KIND_FIX = { exam: "practice", quiz: "practice", test: "practice", exercise: "practice", vocabulary: "vocab", reading: "context" };
export function sanitizeRaw(raw) {
  let dropped = 0, kept = 0;
  const sections = [];
  for (const sec of raw.sections || []) {
    if (!nonEmpty(sec.title)) continue;
    const lessons = [];
    for (const l of sec.lessons || []) {
      const kind = KINDS.includes(l.kind) ? l.kind : (KIND_FIX[l.kind] || "practice");
      const exercises = [];
      for (const e of l.exercises || []) {
        try { normalizeExercise(e, "tmp"); exercises.push(e); kept++; } catch { dropped++; }
      }
      if (exercises.length) lessons.push({ ...l, kind, exercises });
    }
    if (lessons.length) sections.push({ ...sec, lessons });
  }
  if (!sections.length) throw new Error("tidak ada soal valid di balasan AI");
  return { ...raw, sections, _kept: kept, _dropped: dropped };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Cache per potongan: kalau berhenti di tengah unit, potongan yang sudah jadi tidak dibayar ulang saat --resume.
function loadCache(f) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return {}; } }

async function generateUnit(chunk, no, total, meta, hint, cacheFile) {
  const parts = splitParts(chunk, PART_CHARS);
  const where = hint ? `Ini satu bab penuh (file: ${hint}).` : `Ini potongan buku ${no} dari ${total}.`;
  console.log(`  teks ${chunk.length} karakter dipecah jadi ${parts.length} potongan (target ± ${parts.length * PER_PART} soal).`);
  const cache = cacheFile ? loadCache(cacheFile) : {};
  const raws = [];
  for (let pi = 0; pi < parts.length; pi++) {
    const key = `${no}:${pi}:${parts[pi].length}`;
    if (cache[key]) { raws.push(cache[key]); console.log(`  potongan ${pi + 1}/${parts.length} dari cache.`); continue; }
    const userText = `Mata pelajaran: ${meta.subject}\nBahasa materi: ${meta.language}\n${where} Potongan ${pi + 1} dari ${parts.length} untuk unit yang sama.\n\n--- ISI BUKU ---\n${parts[pi]}`;
    let lastErr, raw;
    for (let attempt = 1; attempt <= 4 && !raw; attempt++) {
      try {
        raw = sanitizeRaw(parseJson(await callModel(userText)));
      } catch (e) {
        lastErr = e;
        console.error(`  unit ${no} potongan ${pi + 1} percobaan ${attempt} gagal: ${e.message}`);
        if (attempt < 4) await sleep(Math.min(30000, (process.env.SL_RETRY_MS?+process.env.SL_RETRY_MS:4000) * attempt * attempt)); // jeda makin lama (gateway sibuk / timeout)
      }
    }
    if (!raw) throw lastErr;
    console.log(`  potongan ${pi + 1}/${parts.length} selesai (${raw._kept} soal${raw._dropped ? `, ${raw._dropped} soal cacat dibuang` : ""}).`);
    delete raw._kept; delete raw._dropped;
    raws.push(raw);
    if (cacheFile) { cache[key] = raw; fs.writeFileSync(cacheFile, JSON.stringify(cache)); }
  }
  return buildUnit(mergeRawUnits(raws), no);
}

async function main() {
  if (args.translate) {
    if (!args.id) throw new Error("--translate butuh --id <course-id>");
    const f = path.join("out", `${args.id}.json`);
    if (!fs.existsSync(f)) throw new Error(`${f} tidak ditemukan`);
    let course = JSON.parse(fs.readFileSync(f, "utf8"));
    if (Array.isArray(course)) course = course[0]; // file lama (versi array) tetap terbaca
    for (const u of course.units) {
      const needs = u.sections.some((s) => s.lessons.some((l) => l.exercises.some((e) => !e.en)));
      if (!needs) { console.log(`${u.id}: sudah ada terjemahan, dilewati`); continue; }
      console.log(`Terjemahkan ${u.id}...`);
      applyTranslation(u, await translateUnit(u));
      fs.writeFileSync(f, JSON.stringify(course, null, 2)); // simpan per unit (aman kalau berhenti di tengah)
    }
    console.log(`Selesai: ${f}`);
    return;
  }
  if ((!args.file && !args.dir) || !args.id || !args.title) {
    console.error("Pakai: (--file <buku.pdf|txt> [--units 4]) ATAU (--dir <folder-bab>) ATAU (--file <bab.pdf> --append)\n       --id <course-id> --title <judul> [--language Arabic] [--subject ...] [--upload]");
    process.exit(1);
  }
  const meta = { subject: args.subject || args.title, language: args.language || "Arabic" };
  fs.mkdirSync("out", { recursive: true });
  const outFile = path.join("out", `${args.id}.json`);

  // Berkas hasil sudah ada? Jangan menimpa hasil yang sudah dibayar tanpa sengaja.
  const resuming = !!args.resume, appending = !!args.append;
  if (fs.existsSync(outFile) && !resuming && !appending && !args.force) {
    throw new Error(`${outFile} sudah ada. Pakai --resume (lanjutkan yang terhenti), --append (tambah unit baru), atau --force (timpa).`);
  }

  // Mode per bab: tiap file = satu unit. Mode buku utuh: satu file dipecah jadi N unit.
  let jobs; // [{ text, hint }]
  if (args.dir) {
    const files = listChapterFiles(args.dir);
    if (!files.length) throw new Error(`Tidak ada .pdf/.txt di folder ${args.dir}`);
    jobs = files.map((f) => ({ text: extractText(f), hint: path.basename(f) }));
  } else if (appending) {
    jobs = [{ text: extractText(args.file), hint: path.basename(args.file) }];
  } else {
    jobs = splitIntoChunks(extractText(args.file), UNITS).map((text) => ({ text, hint: null }));
  }

  // --append / --resume: baca hasil yang sudah ada
  let existing = null;
  if (appending || resuming) {
    if (!fs.existsSync(outFile)) {
      if (appending) throw new Error(`--append: ${outFile} belum ada. Buat dulu tanpa --append.`);
    } else {
      existing = JSON.parse(fs.readFileSync(outFile, "utf8"));
      if (Array.isArray(existing)) existing = existing[0]; // file lama (versi array) tetap terbaca
    }
  }
  const startNo = existing ? existing.units.length : 0;
  // --resume: lewati pekerjaan yang unitnya sudah jadi (daftar pekerjaan sama persis dengan run sebelumnya)
  if (resuming && existing) jobs = jobs.slice(startNo);
  if (jobs.length === 0) { console.log("Semua unit sudah selesai dibuat. Tidak ada yang perlu dilanjutkan."); }

  // Nama subject dalam bahasa Arab: pakai --title-ar kalau diberikan; kalau tidak, minta AI
  // menerjemahkan judul (1 panggilan kecil). Hasilnya TETAP perlu kamu cek.
  let titleAr = typeof args["title-ar"] === "string" ? args["title-ar"] : existing && existing.titleAr;
  if (!titleAr && jobs.length > 0) {
    try {
      titleAr = (await chat("Terjemahkan nama mata pelajaran ke bahasa Arab baku (fusha) yang lazim dipakai di buku/kampus. Balas HANYA teks Arab, tanpa tanda baca tambahan.", meta.subject));
      const m = titleAr.match(/[\u0600-\u06FF][\u0600-\u06FF\s]*/); // ambil hanya teks Arab (buang pagar kode/komentar)
      titleAr = m ? m[0].trim() : "";
      if (titleAr) console.log(`Nama Arab (dari AI, mohon cek): ${titleAr}`);
    } catch (e) { console.warn("Nama Arab tidak dibuat:", e.message); }
  }

  const cacheFile = path.join("out", `${args.id}.parts.json`);
  if (args.force && !resuming && !appending && fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
  const units = existing ? existing.units.slice() : [];
  const course = { id: args.id, title: args.title, ...(titleAr ? { titleAr } : {}), subject: meta.subject, language: meta.language,
    description: `Pelajari kosakata, istilah akademik, dan bahasa ujian yang digunakan dalam materi ${meta.subject}.`,
    duration: "", difficulty: args.difficulty || (existing && existing.difficulty) || "Menengah", units };
  // Simpan SETIAP SELESAI 1 unit: kalau berhenti di tengah (kredit habis, internet putus, dll),
  // semua unit yang sudah jadi tetap aman di berkas, dan bisa dilanjutkan dengan --resume.
  const save = () => {
    const total = units.reduce((n, u) => n + u.sections.reduce((m, s) => m + s.lessons.reduce((k, l) => k + l.exercises.length, 0), 0), 0);
    course.duration = args.duration || `± ${Math.max(1, Math.round(total / 12))} jam`;
    fs.writeFileSync(outFile, JSON.stringify(course, null, 2));
  };

  console.log(`${jobs.length} unit akan dibuat${startNo ? ` (sudah ada ${startNo} unit sebelumnya)` : ""}.`);
  const grand = startNo + jobs.length;
  try {
    for (let i = 0; i < jobs.length; i++) {
      const no = startNo + i + 1;
      console.log(`Generate unit ${no}/${grand}${jobs[i].hint ? ` (${jobs[i].hint})` : ""}...`);
      units.push(await generateUnit(jobs[i].text, no, grand, meta, jobs[i].hint, cacheFile));
      save();
      console.log(`  unit ${no} tersimpan.`);
    }
  } catch (e) {
    if (units.length > startNo) save();
    console.error(`\nBERHENTI di unit ${units.length + 1}: ${e.message}`);
    console.error(`${units.length} unit yang sudah jadi TETAP tersimpan di ${outFile}.`);
    console.error("Setelah masalahnya beres (kredit diisi / server normal lagi), lanjutkan dengan perintah yang SAMA, buang --force, tambahkan --resume.\nPotongan yang sudah jadi di unit ini juga tersimpan (out/<id>.parts.json) dan tidak dibayar ulang.");
    process.exit(1);
  }
  save();
  console.log(`Selesai. Tersimpan: ${outFile} (REVIEW dulu sebelum di-publish)`);

  if (args.upload) {
    // Supabase KEDUA (khusus Subject Language). Sengaja BEDA nama dari env Levantine
    // supaya tidak tertukar dengan SUPABASE_URL / service key milik Levantine.
    const url = process.env.SUBJECT_SUPABASE_URL, key = process.env.SUBJECT_SUPABASE_SERVICE_KEY;
    if (!url || !key) throw new Error("Set SUBJECT_SUPABASE_URL dan SUBJECT_SUPABASE_SERVICE_KEY (Supabase kedua) untuk --upload");
    const res = await fetch(`${url}/rest/v1/subject_courses`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ id: course.id, title: course.title, language: course.language, published: false, content: course }),
    });
    if (!res.ok) throw new Error(`Upload gagal ${res.status}: ${await res.text()}`);
    console.log("Terupload sebagai DRAFT (published=false).");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch((e) => { console.error(e.message); process.exit(1); });
