// lib/exercise-validator.js
//
// Domain: APAKAH 1 SOAL LAYAK DISIMPAN — deteksi duplikat, validasi format.
// - Normalisasi teks RINGAN (poin R: JANGAN agresif, jangan strip
//   diakritik/huruf sambung Arab — beda dari cleanup-duplicate-exercises.mjs
//   yang memang sengaja lebih agresif, dipertahankan terpisah apa adanya).
// - Ekstrak "jawaban" 1 soal, apa pun tipenya.
// - Hitung signature deterministik 1 soal (buat cegah duplikat SAAT insert).
// - Filter 1 batch soal: buang yang signature-nya sudah ada di database
//   ATAU sudah muncul di batch yang sama (avoidList di prompt AI cuma
//   bantuan tambahan — INI yang jadi jaminan pasti).
//
// Dipakai bareng oleh generate-vocab-v2.mjs (exercise statis) dan
// api/adaptive-exercise.js (exercise adaptive, di-scope per user).

import crypto from "node:crypto";

export function normalizeLight(text) {
  return String(text || "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function extractAnswerText(ex) {
  const c = ex.content || {};
  if (c.correctAnswer) return c.correctAnswer;
  if (typeof c.correctIndex === "number" && c.options) {
    const opt = c.options[c.correctIndex];
    return typeof opt === "string" ? opt : opt?.text || opt?.latin || "";
  }
  if (Array.isArray(c.correctWords)) return c.correctWords.join(" ");
  if (Array.isArray(c.pairs)) return c.pairs.map((p) => `${p.left}=${p.right}`).join(",");
  return "";
}

export function computeExerciseSignature(exerciseType, promptText, answerText, focusVocabIds) {
  const normalizedPrompt = normalizeLight(promptText);
  const normalizedAnswer = normalizeLight(answerText);
  const sortedVocabIds = [...focusVocabIds].sort().join(",");
  const raw = `${exerciseType}|${normalizedPrompt}|${normalizedAnswer}|${sortedVocabIds}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Ambil signature yang SUDAH ADA di database buat 1 level — di-scope per
// user kalau generatedForUserId dikasih (exercise adaptive), atau global
// per level kalau tidak (exercise statis, dibagi semua user).
export async function loadExistingSignatures(supabase, { levelId, generatedForUserId = null }) {
  let query = supabase.from("exercises").select("signature").eq("level_id", levelId).not("signature", "is", null);
  query = generatedForUserId
    ? query.eq("generated_for_user_id", generatedForUserId)
    : query.is("generated_for_user_id", null);
  const { data } = await query;
  return new Set((data || []).map((r) => r.signature));
}

// Terima daftar soal MENTAH dari AI (tiap soal punya field vocab_used berisi
// kata_arab) + peta kata_arab->vocab_id, kembalikan cuma yang LOLOS validasi
// duplikat. `existingSignatures` di-mutate (ditambah signature baru) supaya
// pemanggil bisa reuse Set yang sama across beberapa panggilan berturutan.
export function filterDuplicateExercises(exercises, vocabIdByWord, existingSignatures) {
  const kept = [];
  for (const ex of exercises) {
    const vocabUsedIds = [];
    for (const word of ex.vocab_used || []) {
      const vid = vocabIdByWord.get(word);
      if (vid) vocabUsedIds.push(vid);
    }
    const answerText = extractAnswerText(ex);
    const signature = computeExerciseSignature(ex.type, ex.prompt, answerText, vocabUsedIds);
    if (existingSignatures.has(signature)) continue; // duplikat, skip
    existingSignatures.add(signature);
    kept.push({ ex, vocabUsedIds, signature });
  }
  return kept;
}

// AI cenderung SELALU naruh jawaban benar di correctIndex 0 (bias dari pola
// contoh di prompt, sering kejadian walau sudah diinstruksikan acak).
// Daripada berharap AI "mau nurut", di sini ACAK ULANG posisi options +
// remap correctIndex-nya SETELAH AI generate — program yang jadi jaminan
// pasti posisinya acak, bukan tebak-tebakan prompt engineering. Dipakai
// bareng generate-vocab-v2.mjs (statis) dan api/adaptive-exercise.js (adaptif).
//
// [FIX] Celah yang sama juga berlaku buat "matching_pairs" (node type
// practice): kolom kanannya (rightOrder) SEBELUMNYA cuma diminta lewat
// instruksi prompt ("urutan id diacak"), TANPA penegakan programatis —
// AI bisa aja taruh rightOrder identik urutan `pairs` asli (kolom kanan
// sejajar kolom kiri, soal jadi trivial). Sekarang dipaksa Fisher-Yates
// TRUE shuffle juga, gak bergantung sama sekali ke kepatuhan AI.
function shuffleFisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function shuffleAnswerPositions(exercises) {
  for (const ex of exercises) {
    const c = ex.content;
    if (!c) continue;

    if (typeof c.correctIndex === "number" && Array.isArray(c.options)) {
      // [BARU] acceptedIndices (opsional): soal dengan >1 jawaban valid,
      // mis. "kalian" bisa diterjemahin -كم ATAU -كن (keduanya benar,
      // Indonesia gak nentuin gender). Simpan REFERENSI OBJECT opsi-nya
      // dulu (bukan index-nya) SEBELUM diacak, biar bisa dicari ulang
      // posisi barunya setelah array options berubah urutan.
      const acceptedOptions = Array.isArray(c.acceptedIndices) && c.acceptedIndices.length > 0
        ? c.acceptedIndices.map((i) => c.options[i])
        : null;
      const correctOption = c.options[c.correctIndex];
      const indices = shuffleFisherYates(c.options.map((_, i) => i));
      c.options = indices.map((i) => c.options[i]);
      c.correctIndex = c.options.indexOf(correctOption);
      if (acceptedOptions) {
        c.acceptedIndices = acceptedOptions.map((opt) => c.options.indexOf(opt));
      }
    }

    if (Array.isArray(c.pairs) && Array.isArray(c.rightOrder)) {
      // Bangun ULANG rightOrder dari id yang BENERAN ada di `pairs` (jangan
      // percaya isi rightOrder dari AI mentah-mentah — kalau AI kasih id
      // yang gak lengkap/dobel/nyasar, itu tetap harus dibetulkan di sini,
      // bukan cuma diacak apa adanya).
      const ids = c.pairs.map((p) => p.id);
      c.rightOrder = shuffleFisherYates(ids);
    }

    // [BARU] wordBank soal susun-kata: AI cenderung menaruh kata jawaban
    // BERURUTAN di depan lalu pengecoh di belakang, dan frontend menampilkan
    // wordBank apa adanya -- jadi urutan kata jawaban ketahuan dari urutan
    // tile (bias yang sama dengan correctIndex selalu 0). Diacak di sini.
    if (Array.isArray(c.wordBank) && c.wordBank.length > 1) {
      c.wordBank = shuffleWordBankAvoidingLeak(c.wordBank, c.correctWords);
      c.bankShuffled = true; // penanda: biar skrip audit gak mengacak ulang terus tiap dijalankan
    }
  }
  return exercises;
}


// ============================================================
// KUALITAS SOAL (perbaikan dari 4 keluhan user)
//   1. fill_blank ambigu (banyak opsi bisa benar, tanpa konteks)
//   2. susun-kata terlalu kaku (sinonim/urutan lain yang wajar ditolak)
//   3. pilihan/tile berhuruf Latin padahal harusnya Arab murni
//   4. terlalu banyak soal berpusat pada nama orang
// + urutan wordBank yang bocor (kata jawaban berurutan di depan).
// Semua yang di bawah ini dipakai bareng oleh generate-vocab-v2.mjs
// (soal baru), api/adaptive-exercise.js, dan scripts/audit-exercises.mjs
// (membersihkan soal yang SUDAH ada di database).
// ============================================================

const ARABIC_LETTER = /[\u0620-\u064A\u066E-\u06D3\u06FA-\u06FF\u0750-\u077F]/;
const LATIN_LETTER = /[A-Za-z]/;

export function hasArabicLetters(s) { return typeof s === "string" && ARABIC_LETTER.test(s); }
export function hasLatinLetters(s) { return typeof s === "string" && LATIN_LETTER.test(s); }
// "Arab murni": ada huruf Arab dan TIDAK ada huruf Latin sama sekali.
export function isPureArabic(s) { return hasArabicLetters(s) && !hasLatinLetters(s); }

function wordKey(w) {
  return normalizeLight(w).replace(/[.,!?؟،؛:;"'()]/g, "");
}

function countMap(arr) {
  const m = new Map();
  for (const w of arr) m.set(w, (m.get(w) || 0) + 1);
  return m;
}

function shuffleWordBankAvoidingLeak(bank, correctWords) {
  const leaked = (b) =>
    Array.isArray(correctWords) && correctWords.length >= 2 && correctWords.every((w, i) => b[i] === w);
  const same = (b) => b.every((w, i) => w === bank[i]);
  let out = shuffleFisherYates(bank);
  for (let tries = 0; tries < 5 && (leaked(out) || same(out)); tries++) out = shuffleFisherYates(bank);
  return out;
}

// Rapikan 1 soal word_order: buang tile bersalah-skrip, pastikan semua kata
// jawaban ada di bank, dan pastikan acceptedOrders HANYA berisi urutan yang
// bisa disusun dari tile yang ada (jawaban utama selalu jadi elemen pertama).
function normalizeWordOrder(contentIn) {
  const content = JSON.parse(JSON.stringify(contentIn || {}));
  const notes = [];
  const correct = (Array.isArray(content.correctWords) ? content.correctWords : []).filter(
    (w) => typeof w === "string" && w.trim()
  );
  if (correct.length === 0) return { content, notes, dropReason: "correctWords kosong" };

  let dir = content.direction;
  if (dir !== "to_arabic" && dir !== "to_indonesian") {
    dir = hasArabicLetters(correct[0]) ? "to_arabic" : "to_indonesian";
    content.direction = dir;
    notes.push(`direction diisi otomatis (${dir})`);
  }
  const okTile = dir === "to_arabic" ? isPureArabic : (t) => !hasArabicLetters(t);
  const label = dir === "to_arabic" ? "Arab murni" : "tulisan Latin";

  if (!correct.every(okTile)) return { content, notes, dropReason: `kata jawaban bukan ${label}` };

  const correctCounts = countMap(correct);
  const bank = [];
  const usedExtra = new Map();
  for (const t of Array.isArray(content.wordBank) ? content.wordBank : []) {
    if (typeof t !== "string" || !t.trim()) continue;
    if (!okTile(t)) { notes.push(`pengecoh "${t}" dibuang (bukan ${label})`); continue; }
    const allowed = correctCounts.get(t) || 1;
    const have = bank.filter((x) => x === t).length;
    if (have >= allowed) { notes.push(`tile ganda "${t}" dibuang`); continue; }
    bank.push(t);
    usedExtra.set(t, have + 1);
  }
  for (const [w, need] of correctCounts) {
    const have = bank.filter((x) => x === w).length;
    for (let i = have; i < need; i++) { bank.push(w); notes.push(`kata jawaban "${w}" ditambahkan ke bank`); }
  }

  const bankCounts = countMap(bank);
  const alts = [];
  const seen = new Set();
  let invalidAlts = 0;
  const addAlt = (arr, isOriginalAlt) => {
    if (!Array.isArray(arr) || arr.length === 0 || !arr.every((w) => typeof w === "string" && w.trim())) {
      if (isOriginalAlt) invalidAlts++;
      return;
    }
    const cnt = countMap(arr);
    let ok = arr.every(okTile);
    for (const [w, n] of cnt) if ((bankCounts.get(w) || 0) < n) ok = false;
    if (!ok) { if (isOriginalAlt) invalidAlts++; return; }
    const key = arr.map(wordKey).join(" ");
    if (seen.has(key)) return;
    seen.add(key);
    alts.push(arr);
  };
  addAlt(correct, false);
  for (const a of Array.isArray(content.acceptedOrders) ? content.acceptedOrders : []) addAlt(a, true);
  if (invalidAlts > 0) notes.push(`${invalidAlts} urutan alternatif tidak valid dibuang`);

  content.correctWords = correct;
  content.wordBank = bank;
  content.acceptedOrders = alts;
  return { content, notes, dropReason: null };
}

// Periksa 1 soal. verdict: "ok" (biarkan), "fixed" (pakai content baru),
// "drop" (buang -- akan digenerate ulang oleh top-up generate-vocab-v2).
export function inspectExercise(type, contentIn) {
  const original = JSON.parse(JSON.stringify(contentIn || {}));
  const drop = (why) => ({ verdict: "drop", content: original, reasons: [why] });
  const c = original;

  const CHOICE = ["fill_blank", "translate_choice", "dialogue_complete", "listen_choose", "reading_comprehension"];
  const ARABIC_OPTION_TYPES = ["fill_blank", "translate_choice", "dialogue_complete", "listen_choose"];
  let fixedNotes = [];
  if (CHOICE.includes(type)) {
    if (!Array.isArray(c.options) || c.options.length < 2 || !Number.isInteger(c.correctIndex) || !c.options[c.correctIndex]) {
      return drop("opsi/correctIndex tidak valid");
    }
    const seen = new Set();
    for (let i = 0; i < c.options.length; i++) {
      const t = c.options[i]?.text;
      if (typeof t !== "string" || !t.trim()) return drop(`opsi ${i + 1} kosong`);
      if (ARABIC_OPTION_TYPES.includes(type) && !isPureArabic(t)) return drop(`opsi ${i + 1} bukan tulisan Arab murni ("${t}")`);
      const k = wordKey(t);
      if (seen.has(k)) return drop(`opsi ganda ("${t}")`);
      seen.add(k);
    }
    // acceptedIndices: harus bilangan bulat dalam rentang & memuat correctIndex; kalau tidak -> rapikan.
    if (c.acceptedIndices != null) {
      const arr = Array.isArray(c.acceptedIndices) ? c.acceptedIndices : [];
      const clean = [...new Set(arr.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < c.options.length))];
      if (!clean.includes(c.correctIndex)) clean.unshift(c.correctIndex);
      if (JSON.stringify(clean) !== JSON.stringify(arr)) {
        c.acceptedIndices = clean;
        fixedNotes.push("acceptedIndices dirapikan");
      }
    }
  }
  if (type === "reading_comprehension") {
    if (!c.passageText || !String(c.passageText).trim()) return drop("bacaan kosong");
    if (!c.question || !String(c.question).trim()) return drop("pertanyaan bacaan kosong");
  }
  if (type === "dialogue_complete") {
    const lines = Array.isArray(c.dialogueLines) ? c.dialogueLines : [];
    if (lines.length < 2) return drop("dialog kurang dari 2 baris");
    const blanks = lines.filter((l) => l && l.blank === true);
    if (blanks.length !== 1) return drop(`dialog harus punya TEPAT 1 baris kosong (blank:true), ditemukan ${blanks.length}`);
    // jawaban benar tidak boleh sudah tampil utuh di baris lain
    const right = wordKey(c.options[c.correctIndex]?.text || "");
    if (right && lines.some((l) => l && l.blank !== true && wordKey(l.text || "") === right)) {
      return drop("jawaban benar sudah tampil di baris lain dialog");
    }
  }
  if (type === "fill_blank") {
    for (const part of [c.beforeBlank, c.afterBlank]) {
      if (part?.text && hasLatinLetters(part.text)) return drop("kalimat isian mengandung huruf Latin");
    }
    if (!c.beforeBlank?.text && !c.afterBlank?.text) return drop("kalimat isian kosong");
  }
  if (type === "translate_write") {
    if (!isPureArabic(c.correctAnswer)) return drop("jawaban tulis bukan Arab murni");
    if (!c.text || !String(c.text).trim()) return drop("teks soal kosong");
    if (c.acceptedAnswers != null) {
      const arr = Array.isArray(c.acceptedAnswers) ? c.acceptedAnswers : [];
      const seenA = new Set();
      const clean = [c.correctAnswer, ...arr].filter((a) => {
        if (!isPureArabic(a)) return false;
        const k = wordKey(a);
        if (seenA.has(k)) return false;
        seenA.add(k);
        return true;
      }).slice(0, 5);
      if (JSON.stringify(clean) !== JSON.stringify(arr)) {
        c.acceptedAnswers = clean;
        fixedNotes.push("acceptedAnswers dirapikan");
      }
    }
  }
  if (type === "matching_pairs") {
    if (!Array.isArray(c.pairs) || c.pairs.length < 2) return drop("pasangan kurang dari 2");
    for (const p of c.pairs) {
      if (!isPureArabic(p?.left)) return drop(`sisi kiri pasangan bukan Arab murni ("${p?.left}")`);
      if (hasArabicLetters(p?.right)) return drop(`sisi kanan pasangan berisi huruf Arab ("${p?.right}")`);
    }
  }
  if (type === "word_order") {
    const r = normalizeWordOrder(c);
    if (r.dropReason) return drop(r.dropReason);
    if (r.notes.length > 0) return { verdict: "fixed", content: r.content, reasons: r.notes };
  }
  if (fixedNotes.length > 0) return { verdict: "fixed", content: c, reasons: fixedNotes };
  return { verdict: "ok", content: original, reasons: [] };
}

// Dipanggil generator SETELAH JSON dari AI diparse, SEBELUM diacak/disimpan.
// Buang soal yang cacat + batasi soal bernama orang (cuma buat kategori
// drill kosakata; cerita & dialog memang wajar punya nama tokoh).
// Jumlah opsi minimal untuk soal BARU (bukan untuk audit soal lama, yang masih 3 opsi):
// translate_choice (arti 1 kata) 5 opsi, listen_choose 4 opsi.
export const MIN_OPTIONS_NEW = { translate_choice: 5, listen_choose: 4 };

// Kalimat Indonesia SUMBER terjemahan ke Arab yang memuat kata ganti netral-gender
// (kamu/kalian/dia/mereka/anda) TANPA label gender "(laki-laki)"/"(perempuan)" -> gender Arabnya
// tidak jelas. Dipakai untuk soal yang cuma punya 1 jawaban utama (translate_write, word_order
// to_arabic, translate_choice) kecuali soal itu sudah menyediakan alternatif yang menutup variasinya.
const GENDER_PRONOUN = /(?<![\p{L}])(kamu|kau|engkau|anda|kalian|dia|ia|mereka)(?![\p{L}])/iu;
const GENDER_LABEL = /\([^)]*(laki|pria|perempuan|wanita|putra|putri|campur)[^)]*\)/i;
export function hasUnlabeledGender(type, c = {}) {
  let source = null;
  let covered = false;
  if (type === "translate_write") {
    source = c.text;
    covered = Array.isArray(c.acceptedAnswers) && c.acceptedAnswers.length >= 2;
  } else if (type === "word_order" && c.direction === "to_arabic") {
    source = c.text;
    covered = Array.isArray(c.acceptedOrders) && c.acceptedOrders.length >= 2;
  } else if (type === "translate_choice") {
    source = c.promptText;
    covered = Array.isArray(c.acceptedIndices) && c.acceptedIndices.length >= 2;
  }
  if (typeof source !== "string" || covered) return false;
  if (hasArabicLetters(source)) return false;
  return GENDER_PRONOUN.test(source) && !GENDER_LABEL.test(source);
}

export function sanitizeGeneratedExercises(exercises, { nodeType = "lesson", maxNameExercises = 1, enforceOptionCount = false, requireGenderLabel = false } = {}) {
  const kept = [];
  const dropped = [];
  const capNames = ["lesson", "practice", "review"].includes(nodeType);
  let nameCount = 0;
  for (const ex of Array.isArray(exercises) ? exercises : []) {
    if (!ex || typeof ex !== "object" || !ex.type || !ex.content) {
      dropped.push({ ex, reasons: ["bentuk soal tidak valid"] });
      continue;
    }
    const r = inspectExercise(ex.type, ex.content);
    if (r.verdict === "drop") { dropped.push({ ex, reasons: r.reasons }); continue; }
    if (enforceOptionCount && MIN_OPTIONS_NEW[ex.type]) {
      const n = Array.isArray(ex.content.options) ? ex.content.options.length : 0;
      if (n < MIN_OPTIONS_NEW[ex.type]) {
        dropped.push({ ex, reasons: [`${ex.type} hanya ${n} opsi (wajib ${MIN_OPTIONS_NEW[ex.type]})`] });
        continue;
      }
    }
    if (requireGenderLabel && hasUnlabeledGender(ex.type, r.content)) {
      dropped.push({ ex, reasons: ["gender tidak jelas (kata ganti tanpa label laki-laki/perempuan)"] });
      continue;
    }
    const hasName = ex.has_person_name === true || ex.has_person_name === "true";
    if (capNames && hasName) {
      if (nameCount >= maxNameExercises) {
        dropped.push({ ex, reasons: ["kebanyakan soal yang berpusat pada nama orang"] });
        continue;
      }
      nameCount++;
    }
    kept.push({ ...ex, content: r.content });
  }
  return { kept, dropped };
}

// Teks ringkas 1 soal buat dikirim ke penguji AI (deteksi nama orang, dst).
export function exerciseTextForJudge(_type, c = {}) {
  const parts = [];
  const push = (v) => { if (typeof v === "string" && v.trim()) parts.push(v.trim()); };
  push(c.promptText); push(c.text); push(c.correctAnswer); push(c.question);
  push(c.beforeBlank?.text); push(c.afterBlank?.text);
  if (Array.isArray(c.correctWords)) push(c.correctWords.join(" "));
  for (const o of Array.isArray(c.options) ? c.options : []) push(typeof o === "string" ? o : o?.text);
  for (const p of Array.isArray(c.pairs) ? c.pairs : []) { push(p?.left); push(p?.right); }
  push(c.passageText);
  for (const l of Array.isArray(c.dialogueLines) ? c.dialogueLines : []) push(l?.text);
  return parts.join(" | ").slice(0, 1000);
}

// ---------- Penguji AI (callLadiz & cleanJson di-inject dari luar) ----------

function extractArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") {
    for (const v of Object.values(parsed)) if (Array.isArray(v)) return v;
  }
  return null;
}

// Error kuota/koneksi WAJIB diteruskan (biar script pemanggil berhenti rapi);
// JSON rusak cukup dianggap "gak bisa menilai" (null) -- pemanggil yang
// memutuskan (umumnya: biarkan soalnya, jangan dibuang tanpa bukti).
async function askJsonArray(callLadiz, cleanJson, prompt, maxTokens) {
  let raw;
  try {
    raw = await callLadiz(prompt, maxTokens);
  } catch (err) {
    if (err && err.quotaExceeded) throw err;
    return null;
  }
  try {
    return extractArray(JSON.parse(cleanJson(raw)));
  } catch {
    return null;
  }
}

// items: [{ key, sentence, options: ["...", "..."] }] -> Map(key -> [indeks opsi yang valid]) | null
// items: [{ key, sentence, options: ["...", ...] }] -> Map(key -> { verdict, validIndices }) | null
//   verdict "ok"              -> cuma 1 opsi valid, gak ada yang perlu diubah
//   verdict "accept_variants" -> 2+ opsi valid, TAPI karena variasi gender/jumlah Arab yang wajar
//                                 (mis. "kalian" -> -كم ATAU -كن) -- SIMPAN semua di acceptedIndices,
//                                 JANGAN dihapus
//   verdict "bad_ambiguous"   -> 2+ opsi valid untuk alasan LAIN (konteks kurang petunjuk) -- ini
//                                 soal yang cacat, DIHAPUS
// [GANTI dari judgeFillBlanks lama] -- versi lama cuma bisa bilang "ambigu/tidak", jadi soal
// gender-variant (yang SEHARUSNYA diterima semua) ikut ketumpuk dihapus bareng soal yang BENERAN
// cacat. Sekarang dipisah lewat field "verdict".
export async function judgeChoiceAmbiguity(callLadiz, cleanJson, items, _depth = 0) {
  if (!items.length) return new Map();
  const payload = items.map((it) => ({
    id: it.key,
    konteks: it.sentence,
    opsi: it.options.map((text, i) => ({ i, text })),
  }));
  const prompt = `Kamu penguji soal pilihan ganda Bahasa Arab dialek Levantine. Tiap soal berisi
konteks/kalimat dan beberapa opsi bernomor "i" (mulai dari 0).

Tugasmu: untuk tiap soal, tentukan SEMUA nomor "i" opsi yang VALID sebagai jawaban untuk konteks
itu -- benar secara tata bahasa DAN masuk akal secara makna. Nilai tiap opsi secara MANDIRI (kamu
tidak diberi kunci jawaban). Bersikaplah SKEPTIS dan TELITI: untuk soal arti kata, dua opsi yang
bersinonim atau sama-sama bisa diterjemahkan ke kata Indonesia itu dihitung sama-sama valid; untuk
soal isian, opsi yang tetap masuk akal di kalimat itu (walau kurang natural) dihitung valid. Lalu
klasifikasikan hasilnya ke salah satu "verdict":

- "ok": cuma ADA 1 opsi valid.
- "accept_variants": ADA 2+ opsi valid, TAPI semua opsi valid itu cuma beda BENTUK GENDER/JUMLAH
  tata bahasa Arab untuk MAKNA YANG SAMA (mis. konteks pakai kata ganti netral-gender Indonesia
  "kalian"/"kamu"/"dia"/"mereka", sementara Arab punya bentuk laki-laki/perempuan/jamak terpisah
  yang sama-sama benar -- ini WAJAR, bukan soal yang buruk).
- "bad_ambiguous": ADA 2+ opsi valid untuk alasan LAIN (konteksnya memang kurang petunjuk, opsi-
  opsinya sama masuk akal tanpa alasan gender/jumlah, atau ada sinonim di antara opsi) -- ini soal
  yang cacat.

Soal:
${JSON.stringify(payload)}

Balas HANYA JSON array, SATU objek untuk SETIAP soal: [{ "id": "...", "verdict": "ok"|"accept_variants"|"bad_ambiguous", "valid_indices": [0, 2] }]`;
  const arr = await askJsonArray(callLadiz, cleanJson, prompt, Math.min(8000, 600 + items.length * 140));
  if (!arr) return null;
  const m = new Map();
  for (const r of arr) {
    if (r && r.id != null && r.verdict && Array.isArray(r.valid_indices)) {
      m.set(String(r.id), {
        verdict: r.verdict,
        validIndices: r.valid_indices.map(Number).filter((n) => Number.isInteger(n)),
      });
    }
  }
  // [BARU] Soal yang TIDAK dinilai (AI melewatkan sebagian id, atau jawabannya terpotong) dulu
  // diam-diam dianggap lolos. Sekarang yang terlewat dinilai ulang sekali.
  const missing = items.filter((it) => !m.has(String(it.key)));
  if (missing.length > 0 && _depth < 1) {
    const second = await judgeChoiceAmbiguity(callLadiz, cleanJson, missing, _depth + 1);
    if (second) for (const [k, v] of second) m.set(k, v);
  }
  return m;
}

// Gabungkan hasil penguji dengan kunci jawaban soal.
//   "ok"        : kunci jawaban = satu-satunya opsi valid
//   "variants"  : 2+ opsi valid karena variasi gender/jumlah (kunci termasuk) -> simpan acceptedIndices
//   "ambiguous" : 2+ opsi valid tanpa alasan gender/jumlah, ATAU verdict "ok" tapi opsi valid >1
//   "wrong_key" : penguji menilai kunci jawaban BUKAN opsi yang valid (kunci salah / soal cacat)
//   "unknown"   : penguji tidak memberi hasil yang bisa dipakai
export function classifyJudgeResult(r, correctIndex) {
  if (!r || !Array.isArray(r.validIndices)) return { kind: "unknown", indices: [] };
  const idx = [...new Set(r.validIndices)];
  if (idx.length === 0) return { kind: "wrong_key", indices: [] };
  if (!idx.includes(correctIndex)) return { kind: "wrong_key", indices: idx };
  if (r.verdict === "bad_ambiguous") return { kind: "ambiguous", indices: idx };
  if (idx.length >= 2) return { kind: r.verdict === "accept_variants" ? "variants" : "ambiguous", indices: idx };
  return { kind: "ok", indices: idx };
}

// items: [{ key, text }] -> Set(key yang memuat NAMA ORANG) | null
export async function judgePersonNames(callLadiz, cleanJson, items) {
  if (!items.length) return new Set();
  const prompt = `Untuk tiap soal di bawah (teks bisa Arab/Indonesia), tentukan apakah teks itu memuat NAMA ORANG
(nama diri seseorang, mis. Ahmad, Lara, Joseph, George, جورج, عطا, لارا) sebagai bagian isi soal.
Nama tempat/negara, nama hari/bulan, dan kata biasa BUKAN nama orang.

Soal:
${JSON.stringify(items.map((it) => ({ id: it.key, teks: it.text })))}

Balas HANYA JSON array: [{ "id": "...", "has_name": true }]`;
  const arr = await askJsonArray(callLadiz, cleanJson, prompt, 2500);
  if (!arr) return null;
  const set = new Set();
  for (const r of arr) if (r && r.id != null && (r.has_name === true || r.has_name === "true")) set.add(String(r.id));
  return set;
}

// items: [{ key, direction, reference, correctWords, wordBank }] -> Map(key -> [[kata,...], ...]) | null
export async function proposeWordOrderAlternatives(callLadiz, cleanJson, items) {
  if (!items.length) return new Map();
  const prompt = `Tiap soal di bawah adalah soal SUSUN KATA: ada kalimat referensi, bank kata (tile), dan satu jawaban utama.
Usulkan jawaban ALTERNATIF lain yang juga benar-benar wajar/benar, dengan aturan KETAT:
- HANYA boleh memakai kata yang ada di bank kata (tiap kata maksimal sebanyak kemunculannya di bank).
- Boleh berupa urutan kata lain yang wajar, ATAU penggantian dengan sinonim yang ada di bank
  (contoh: "Bagaimana kabarmu" dan "Bagaimana keadaanmu" sama-sama benar kalau kedua kata itu ada di bank).
- JANGAN usulkan yang janggal, salah tata bahasa, atau berbeda makna.
- Kalau tidak ada alternatif yang benar-benar wajar, balas array kosong.

Soal:
${JSON.stringify(items.map((it) => ({ id: it.key, arah: it.direction, referensi: it.reference, jawabanUtama: it.correctWords, bank: it.wordBank })))}

Balas HANYA JSON array: [{ "id": "...", "alternatives": [["kata", "kata"], ["kata", "kata"]] }]`;
  const arr = await askJsonArray(callLadiz, cleanJson, prompt, 3500);
  if (!arr) return null;
  const m = new Map();
  for (const r of arr) {
    if (r && r.id != null && Array.isArray(r.alternatives)) m.set(String(r.id), r.alternatives);
  }
  return m;
}

// Gabungkan alternatif usulan AI ke acceptedOrders -- TIDAK dipercaya mentah:
// diloloskan lewat normalizeWordOrder, jadi cuma yang bisa disusun dari tile
// di bank yang masuk. Maks `maxAlts` alternatif selain jawaban utama.
export function mergeWordOrderAlternatives(contentIn, proposed, maxAlts = 4) {
  const base = normalizeWordOrder(contentIn);
  if (base.dropReason) return { content: contentIn, added: 0 };
  const candidate = JSON.parse(JSON.stringify(base.content));
  candidate.acceptedOrders = [...candidate.acceptedOrders, ...(Array.isArray(proposed) ? proposed : [])];
  const merged = normalizeWordOrder(candidate);
  if (merged.dropReason) return { content: base.content, added: 0 };
  merged.content.acceptedOrders = merged.content.acceptedOrders.slice(0, 1 + maxAlts);
  return { content: merged.content, added: merged.content.acceptedOrders.length - base.content.acceptedOrders.length };
}
