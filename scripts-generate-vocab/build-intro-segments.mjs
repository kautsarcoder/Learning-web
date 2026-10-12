// scripts-generate-vocab/build-intro-segments.mjs
//
// Mengganti segmen 1 & 2 di bulatan PELAJARAN (node_type "lesson") pertama tiap unit dengan soal
// PERKENALAN KATA yang dibuat PROGRAMATIS dari tabel vocab_items -- tanpa AI (tanpa LadizAI), jadi:
//   * tidak ada soal ambigu / kata di luar kosakata yang sudah diperkenalkan,
//   * gratis (tidak memakai kuota), hasilnya konsisten.
//
// Isi tiap segmen (kata level itu dibagi 2: separuh untuk segmen 1, separuh untuk segmen 2):
//   kartu perkenalan (vocab_intro, tidak dinilai) -> matching kata-arti -> pilih arti (5 opsi, Arab+latin)
//   -> dengarkan lalu pilih (4 opsi) [-> matching tambahan / campuran kata segmen sebelumnya]
//
// Jalankan:
//   node scripts-generate-vocab/build-intro-segments.mjs                  (PREVIEW, tidak mengubah database)
//   node scripts-generate-vocab/build-intro-segments.mjs --bagian 1       (preview 1 bagian saja)
//   node scripts-generate-vocab/build-intro-segments.mjs --commit         (GANTI soal lama segmen 1 & 2 di database)
// Opsi:
//   --levels N     jumlah bulatan pelajaran pertama per unit yang diganti (default 2)
//   --segments N   jumlah segmen awal per bulatan yang diganti (default 2)
//
// KEAMANAN: soal lama sebuah segmen HANYA dihapus kalau soal baru untuk segmen itu berhasil dibuat
// (minimal 8 item). Progres user (segmen selesai) tidak disentuh. Preview dulu, cek isinya, baru --commit.
// Setelah --commit: jalankan  node scripts/translate-content-en.mjs  (untuk yang arti_en-nya kosong) dan
//   node scripts/backfill-vocab-audio.mjs --exercises --skip-vocab  (suara listen_choose yang belum ada).

import "dotenv/config";
import fs from "node:fs";
import { supabase } from "./generate-vocab-v2.mjs";
import { computeExerciseSignature, extractAnswerText, inspectExercise } from "../lib/exercise-validator.mjs";

const args = process.argv.slice(2);
const argVal = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const COMMIT = args.includes("--commit");
const LEVELS_TO_REPLACE = Number(argVal("--levels", 2));
const SEGMENTS_TO_REPLACE = Number(argVal("--segments", 2));
const ONLY_BAGIAN = argVal("--bagian", null);
const MIN_PER_SEGMENT = 8;
const MAX_WORDS_PER_GROUP = 7;

const hasArabic = (t) => /[؀-ۿ]/.test(String(t || ""));
const norm = (t) => String(t || "").toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").trim();
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Dua arti dianggap "mirip" (tidak boleh jadi pengecoh satu sama lain) kalau sama atau saling memuat.
function similarMeaning(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

function pickDistractors(word, pool, k) {
  const out = [];
  for (const cand of shuffle(pool)) {
    if (cand.kata_arab === word.kata_arab) continue;
    if (similarMeaning(cand.arti, word.arti)) continue;
    if (out.some((o) => o.kata_arab === cand.kata_arab || similarMeaning(o.arti, cand.arti))) continue;
    out.push(cand);
    if (out.length >= k) break;
  }
  return out.length >= k ? out : null;
}

const opt = (w) => ({ latin: w.latin || "", text: w.kata_arab });

// ---------- Pembuat soal ----------
function introCards(words) {
  const cards = [];
  for (let i = 0; i < words.length; i += 3) {
    const chunk = words.slice(i, i + 3);
    cards.push({
      type: "vocab_intro", prompt: "Kenali kata-kata baru", vocabIds: chunk.map((w) => w.id),
      content: { words: chunk.map((w) => ({ kata_arab: w.kata_arab, latin: w.latin || "", arti: w.arti, arti_en: w.arti_en || null, audio_url: w.audio_url || null })) },
      contentEn: null, audioUrl: null,
    });
  }
  return cards;
}

function matching(words) {
  const ws = words.slice(0, 5);
  if (ws.length < 3) return null;
  const pairs = ws.map((w, i) => ({ id: `p${i + 1}`, left: w.kata_arab, leftLatin: w.latin || "", right: w.arti }));
  const content = { pairs, rightOrder: shuffle(pairs.map((p) => p.id)) };
  const allEn = ws.every((w) => w.arti_en);
  return {
    type: "matching_pairs", prompt: "Cocokkan kata dengan artinya", vocabIds: ws.map((w) => w.id), content,
    contentEn: allEn ? { ...content, pairs: pairs.map((p, i) => ({ ...p, right: ws[i].arti_en })) } : null, audioUrl: null,
  };
}

function translateChoice(word, pool) {
  const d = pickDistractors(word, pool, 4);
  if (!d) return null;
  const options = shuffle([word, ...d]).map(opt);
  const correctIndex = options.findIndex((o) => o.text === word.kata_arab);
  const content = { promptText: word.arti, options, correctIndex, acceptedIndices: [correctIndex] };
  return {
    type: "translate_choice", prompt: "Pilih arti yang benar", vocabIds: [word.id], content,
    contentEn: word.arti_en ? { ...content, promptText: word.arti_en } : null, audioUrl: null,
  };
}

function listenChoose(word, pool) {
  const d = pickDistractors(word, pool, 3);
  if (!d) return null;
  const options = shuffle([word, ...d]).map(opt);
  const correctIndex = options.findIndex((o) => o.text === word.kata_arab);
  return {
    type: "listen_choose", prompt: "Dengarkan lalu pilih jawaban yang benar", vocabIds: [word.id],
    content: { hasAudio: true, options, correctIndex, acceptedIndices: [correctIndex] },
    contentEn: null, audioUrl: word.audio_url || null,
  };
}

function buildSegment(group, previousGroup, pool) {
  const items = [];
  items.push(...introCards(group));
  const m1 = matching(shuffle(group)); if (m1) items.push(m1);
  for (const w of shuffle(group).slice(0, 4)) { const e = translateChoice(w, pool); if (e) items.push(e); }
  for (const w of shuffle(group).slice(0, 3)) { const e = listenChoose(w, pool); if (e) items.push(e); }
  if (group.length > 5) { const m2 = matching(shuffle(group).slice(0, 5)); if (m2) items.push(m2); }
  if (previousGroup && previousGroup.length) {
    const mixed = matching(shuffle([...shuffle(previousGroup).slice(0, 3), ...shuffle(group).slice(0, 2)]));
    if (mixed) items.push(mixed);
  }
  // Kalau masih kurang dari 8: tambah soal pilih arti untuk sisa kata.
  for (const w of shuffle(group)) {
    if (items.length >= MIN_PER_SEGMENT) break;
    const e = translateChoice(w, pool); if (e) items.push(e);
  }
  // Rapikan lewat validator yang sama dengan generator lain; buang yang cacat.
  return items.filter((it) => {
    if (it.type === "vocab_intro") return true;
    const r = inspectExercise(it.type, it.content);
    if (r.verdict === "drop") { console.warn(`      ⚠ soal ${it.type} dibuang: ${r.reasons[0]}`); return false; }
    if (r.verdict === "fixed") it.content = r.content;
    return true;
  });
}

// ---------- Database ----------
async function fetchTopics() {
  const { data, error } = await supabase.from("topics").select("id, name, order_index, unit_id, units(order_index, name)").order("order_index");
  if (error) throw error;
  let rows = data || [];
  if (ONLY_BAGIAN) rows = rows.filter((t) => String(t.units?.order_index) === String(ONLY_BAGIAN));
  return rows.sort((a, b) => (a.units?.order_index ?? 0) - (b.units?.order_index ?? 0) || a.order_index - b.order_index);
}

async function replaceSegment(level, segment, items) {
  const { data: old } = await supabase.from("exercises").select("id").eq("level_id", level.id).eq("segment_number", segment);
  const oldIds = (old || []).map((r) => r.id);
  if (oldIds.length > 0) {
    await supabase.from("exercise_vocab").delete().in("exercise_id", oldIds);
    await supabase.from("answer_log").delete().in("exercise_id", oldIds);
    const { error } = await supabase.from("exercises").delete().in("id", oldIds);
    if (error) throw error;
  }
  const seen = new Set();
  let order = 1;
  for (const it of items) {
    const signature = computeExerciseSignature(it.type, it.prompt, it.type === "vocab_intro" ? it.content.words.map((w) => w.kata_arab).join(",") : extractAnswerText(it), it.vocabIds);
    if (seen.has(signature)) continue;
    seen.add(signature);
    const { data: ins, error } = await supabase.from("exercises").insert({
      level_id: level.id, type: it.type, order_index: order++, prompt: it.prompt, content: it.content,
      content_en: it.contentEn || null, audio_url: it.audioUrl || null, segment_number: segment, signature,
    }).select().single();
    if (error) { if (error.code === "23505") continue; throw error; }
    for (const vocabId of it.vocabIds) {
      const { error: linkErr } = await supabase.from("exercise_vocab").insert({ exercise_id: ins.id, vocab_id: vocabId });
      if (linkErr && linkErr.code !== "23505") throw linkErr;
    }
  }
  return { removed: oldIds.length, inserted: order - 1 };
}

async function main() {
  console.log(COMMIT ? "=== MODE NYATA (--commit): soal lama segmen terkait akan DIGANTI ===" : "=== MODE PREVIEW: tidak ada yang diubah di database ===");
  const topics = await fetchTopics();
  const preview = [];
  let replaced = 0, skipped = 0;

  for (const topic of topics) {
    const { data: levels } = await supabase.from("levels").select("id, level_number, node_type").eq("topic_id", topic.id).order("level_number");
    const lessonLevels = (levels || []).filter((l) => l.node_type === "lesson").slice(0, LEVELS_TO_REPLACE);
    if (lessonLevels.length === 0) continue;
    const { data: poolRows } = await supabase.from("vocab_items").select("*").in("level_id", (levels || []).map((l) => l.id));
    const pool = [...new Map((poolRows || []).filter((v) => v.kata_arab && v.arti && hasArabic(v.kata_arab) && !hasArabic(v.arti)).map((v) => [v.kata_arab, v])).values()];

    console.log(`\nBagian ${topic.units?.order_index} / Unit ${topic.order_index}: ${topic.name}  (pool kosakata: ${pool.length})`);
    for (const level of lessonLevels) {
      const words = pool.filter((v) => v.level_id === level.id);
      if (words.length < 4) { console.log(`  Level ${level.level_number}: hanya ${words.length} kata -- dilewati.`); skipped++; continue; }
      const half = Math.ceil(words.length / 2);
      const groups = [words.slice(0, half).slice(0, MAX_WORDS_PER_GROUP), words.slice(half).slice(0, MAX_WORDS_PER_GROUP)];
      for (let seg = 1; seg <= Math.min(SEGMENTS_TO_REPLACE, 2); seg++) {
        const group = groups[seg - 1];
        if (!group || group.length < 3) { console.log(`  Level ${level.level_number} segmen ${seg}: kata kurang -- dilewati.`); skipped++; continue; }
        const items = buildSegment(group, seg === 2 ? groups[0] : null, pool);
        const summary = items.map((i) => i.type).join(" > ");
        console.log(`  Level ${level.level_number} segmen ${seg}: ${items.length} item [${group.map((w) => w.kata_arab).join(" ")}]`);
        console.log(`      ${summary}`);
        preview.push({ topic: topic.name, level: level.level_number, segment: seg, items });
        if (items.length < MIN_PER_SEGMENT) { console.warn(`      ⚠ kurang dari ${MIN_PER_SEGMENT} item -- soal lama TIDAK diganti.`); skipped++; continue; }
        if (COMMIT) {
          const r = await replaceSegment(level, seg, items);
          console.log(`      ✔ diganti: ${r.removed} soal lama dihapus, ${r.inserted} soal baru disimpan.`);
          replaced++;
        }
      }
    }
  }
  fs.writeFileSync("preview-intro-segments.json", JSON.stringify(preview, null, 2));
  console.log(`\nSelesai. ${COMMIT ? `${replaced} segmen diganti` : `${preview.length} segmen disiapkan (preview, detail: preview-intro-segments.json)`}, ${skipped} dilewati.`);
  if (!COMMIT) console.log("Cek dulu isinya, lalu jalankan lagi dengan --commit.");
}

main().catch((err) => { console.error("Gagal:", err); process.exitCode = 1; });
