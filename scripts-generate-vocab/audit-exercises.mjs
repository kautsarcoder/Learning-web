// scripts/audit-exercises.mjs
// node scripts/audit-exercises.mjs --dry-run        (cuma nampilin, TIDAK ubah/hapus apa pun)
// node scripts/audit-exercises.mjs                  (beneran ubah/hapus)
// node scripts/audit-exercises.mjs --limit 200       (batasi jumlah diproses per run)
//
// Bersihkan soal yang SUDAH ADA di database (bukan soal baru — itu urusan
// generate-vocab-v2.mjs), fokus CUMA ke 4 jenis keluhan berikut, TIDAK
// menyentuh hal lain:
//   1. fill_blank/dialogue_complete yang AMBIGU (>=2 opsi sama-sama valid
//      untuk kalimatnya) -> DIHAPUS. generate-vocab-v2.mjs --commit run
//      berikutnya otomatis nambahin gantinya (topicHasIncompleteSegments
//      mendeteksi segmen itu kekurangan soal).
//   2. word_order kaku (cuma 1 urutan diterima) -> DIPERBAIKI DI TEMPAT:
//      ditambahkan alternatif sinonim yang wajar ke acceptedOrders.
//   3. tile/opsi campur Latin-Arab (mestinya 1 bahasa murni) -> DIPERBAIKI
//      (tile yang salah bahasa dibuang) kalau setelah dibersihkan soalnya
//      masih utuh, DIHAPUS kalau sampai kehilangan kata jawaban.
//   4. Soal berpusat NAMA ORANG kebanyakan -> disisakan MAKS 1 per
//      (level_id, segment_number) untuk node_type lesson/practice/review
//      (story/conversation dibiarkan, wajar pakai nama tokoh).
//
// Resumable: exercise yang SUDAH diperiksa dicatat di tabel
// exercise_quality_audit, jadi run berikutnya cuma proses yang BELUM
// diperiksa -- aman dijalankan berkali-kali, tidak boros AI call berulang
// buat soal yang sudah beres.
//
// SQL yang WAJIB dijalankan dulu sebelum script ini:
//   create table if not exists exercise_quality_audit (
//     exercise_id uuid primary key references exercises(id) on delete cascade,
//     checked_at timestamptz default now()
//   );

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";
import {
  inspectExercise,
  exerciseTextForJudge,
  judgeChoiceAmbiguity,
  judgePersonNames,
  proposeWordOrderAlternatives,
  mergeWordOrderAlternatives,
} from "../lib/exercise-validator.mjs";

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
      if (res.status === 429 || res.status === 503) {
        lastErr = new Error(`LadizAI status ${res.status}`);
      } else {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) return content;
        lastErr = new Error("Respons LadizAI tidak terduga: " + JSON.stringify(json).slice(0, 200));
      }
    } catch (err) {
      lastErr = err;
    }
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  lastErr.quotaExceeded = true; // habis semua percobaan -- anggap kuota/koneksi bermasalah, berhenti rapi
  throw lastErr;
}

const BATCH_SIZE = 40;
const JUDGE_CHUNK = 20; // berapa item per 1 panggilan AI judge

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function markAudited(ids, dryRun) {
  if (dryRun || ids.length === 0) return;
  const rows = ids.map((exercise_id) => ({ exercise_id }));
  const { error } = await supabase.from("exercise_quality_audit").upsert(rows);
  if (error) throw error;
}

async function deleteExercises(ids, dryRun, reasonLabel) {
  if (ids.length === 0) return;
  console.log(`  🗑  ${dryRun ? "[DRY-RUN] AKAN menghapus" : "Menghapus"} ${ids.length} soal (${reasonLabel})`);
  if (dryRun) return;
  await supabase.from("exercise_vocab").delete().in("exercise_id", ids);
  await supabase.from("answer_log").delete().in("exercise_id", ids);
  const { error } = await supabase.from("exercises").delete().in("id", ids);
  if (error) throw error;
}

async function updateExerciseContent(id, content, dryRun) {
  if (dryRun) return;
  const { error } = await supabase.from("exercises").update({ content }).eq("id", id);
  if (error) throw error;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;
  const onlyIdx = args.indexOf("--only");
  const onlyGender = onlyIdx >= 0 && args[onlyIdx + 1] === "gender";

  console.log(dryRun ? "=== MODE DRY-RUN: tidak ada yang benar-benar diubah/dihapus ===" : "=== MODE NYATA: akan mengubah/menghapus data ===");
  if (onlyGender) {
    console.log(
      "=== MODE --only gender: CUMA cek ambiguitas gender/jumlah. Gak ada pemeriksaan\n" +
      "    struktural, word_order, atau nama-orang. Gak ada soal yang DIHAPUS sama sekali\n" +
      "    (soal 'bad_ambiguous' DILEWATI, bukan dihapus, di mode ini). Soal yang diperiksa\n" +
      "    di sini TIDAK ditandai selesai-diaudit, jadi audit PENUH nanti tetap akan\n" +
      "    memeriksanya lagi untuk hal-hal lain. ==="
    );
  }

  let processed = 0;
  let totalDropped = 0;
  let totalFixed = 0;
  let totalNameDropped = 0;
  // [--only gender] Baris yang diproses mode ini TIDAK ditandai di
  // exercise_quality_audit (lihat alasan di atas), jadi perlu dilacak
  // di memori SELAMA 1 KALI RUN INI SAJA -- biar batch berikutnya dalam
  // loop while yang sama gak ambil baris yang SAMA PERSIS lagi.
  const processedThisRun = new Set();

  // [FIX "cuma 98 soal diperiksa"] Versi lama: (1) select exercise_quality_audit
  // tanpa paginasi -> Supabase membatasi 1000 baris, jadi sebagian soal yang
  // sebenarnya sudah diaudit dianggap belum (atau sebaliknya); (2) exercises
  // di-.limit(500) TANPA urutan -> tiap putaran yang terlihat hanya 500 baris
  // pertama yang SAMA; begitu 500 itu sudah diaudit, script bilang "Semua soal
  // sudah pernah diperiksa" padahal masih ada ribuan di luar 500 itu;
  // (3) mode --only gender ikut membuang soal yang sudah ditandai diaudit,
  // padahal mode ini memang TIDAK menandai apa pun. Sekarang semua dibaca
  // dengan paginasi, dan mode --only gender memeriksa SEMUA soal statis.
  async function fetchAllPaged(buildQuery) {
    const PAGE = 1000;
    const out = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await buildQuery().range(from, from + PAGE - 1);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < PAGE) break;
    }
    return out;
  }

  const auditedRows = onlyGender
    ? []
    : await fetchAllPaged(() => supabase.from("exercise_quality_audit").select("exercise_id").order("exercise_id"));
  const auditedIds = new Set(auditedRows.map((r) => r.exercise_id));

  const allRows = await fetchAllPaged(() =>
    supabase
      .from("exercises")
      .select("id, level_id, segment_number, type, content, levels(node_type)")
      // [FIX "Total diperiksa: 0"] is_adaptive bisa NULL (bukan false) untuk soal statis.
      .or("is_adaptive.is.null,is_adaptive.eq.false")
      .order("id")
  );
  console.log(`Total soal statis di database: ${allRows.length}${onlyGender ? "" : ` (sudah diaudit sebelumnya: ${auditedIds.size})`}`);

  while (processed < limit) {
    const batch = allRows
      .filter((r) => !auditedIds.has(r.id) && !processedThisRun.has(r.id))
      .slice(0, Math.min(BATCH_SIZE, limit - processed));
    if (batch.length === 0) {
      console.log("\nSemua soal sudah pernah diperiksa. Selesai.");
      break;
    }
    for (const r of batch) processedThisRun.add(r.id);

    console.log(`\n--- Batch ${processed + 1}-${processed + batch.length} ---`);

    // listen_choose dikeluarkan: soalnya audio saja (tanpa teks konteks), penguji teks tidak bisa menilainya
    // dan bisa salah menghapus soal yang sebenarnya baik.
    const CHOICE_TYPES_FOR_AUDIT = ["fill_blank", "translate_choice", "dialogue_complete", "reading_comprehension"];
    const toDelete = [];
    const toUpdate = []; // { id, content }
    const toMarkOk = [];
    const choiceCandidates = []; // { id, sentence, options, content } -- diperiksa judgeChoiceAmbiguity
    const wordOrderCandidates = []; // { id, direction, reference, correctWords, wordBank, baseContent }
    const nameCandidates = []; // { id, text, level_id, segment_number, node_type }

    for (const row of batch) {
      // [--only gender] Lewati SEMUA pemeriksaan selain ambiguitas pilihan
      // ganda -- gak ada inspectExercise (struktural), gak ada word_order,
      // gak ada cek nama. Langsung pakai row.content apa adanya.
      if (onlyGender) {
        if (CHOICE_TYPES_FOR_AUDIT.includes(row.type)) {
          choiceCandidates.push({
            id: row.id,
            sentence: exerciseTextForJudge(row.type, row.content),
            options: (row.content.options || []).map((o) => o.text),
            content: row.content,
          });
        }
        continue;
      }

      const nodeType = row.levels?.node_type || "lesson";
      const r = inspectExercise(row.type, row.content);
      if (r.verdict === "drop") {
        toDelete.push({ id: row.id, reason: r.reasons[0] });
        continue;
      }
      const content = r.verdict === "fixed" ? r.content : row.content;
      if (r.verdict === "fixed") {
        toUpdate.push({ id: row.id, content });
        console.log(`  🔧 ${row.id.slice(0, 8)} (${row.type}): ${r.reasons.join("; ")}`);
      }

      if (CHOICE_TYPES_FOR_AUDIT.includes(row.type)) {
        choiceCandidates.push({
          id: row.id,
          sentence: exerciseTextForJudge(row.type, content),
          options: (content.options || []).map((o) => o.text),
          content,
        });
      }
      if (row.type === "word_order") {
        wordOrderCandidates.push({
          id: row.id,
          direction: content.direction,
          reference: content.latin || content.text,
          correctWords: content.correctWords,
          wordBank: content.wordBank,
          baseContent: content,
        });
      }
      if (["lesson", "practice", "review"].includes(nodeType)) {
        nameCandidates.push({
          id: row.id,
          text: exerciseTextForJudge(row.type, content),
          level_id: row.level_id,
          segment_number: row.segment_number,
        });
      } else {
        toMarkOk.push(row.id); // story/conversation gak kena cek nama, langsung aman (kalau gak ke-flag drop/update di atas)
      }
    }

    // --- Judge ambiguitas 5 tipe pilihan ganda ---
    // 3 kemungkinan hasil per soal (lihat judgeChoiceAmbiguity di
    // lib/exercise-validator.mjs): "ok" (dibiarkan), "accept_variants" (2+
    // opsi valid TAPI cuma beda gender/jumlah -- mis. "kalian" -كم vs -كن --
    // DIPERBAIKI di tempat, acceptedIndices di-update, BUKAN dihapus),
    // "bad_ambiguous" (2+ opsi valid tanpa alasan gender -- soal cacat,
    // DIHAPUS, nanti digantikan otomatis oleh generate-vocab-v2.mjs).
    const ambiguousIds = new Set();
    let acceptVariantsCount = 0;
    for (const c of chunk(choiceCandidates, JUDGE_CHUNK)) {
      const items = c.map((x) => ({ key: x.id, sentence: x.sentence, options: x.options }));
      const resultMap = await judgeChoiceAmbiguity(callLadiz, cleanJson, items);
      if (!resultMap) { console.warn("  ⚠ Judge ambiguitas gagal dinilai untuk 1 chunk, dilewati (soal dibiarkan apa adanya)."); continue; }
      for (const x of c) {
        const r = resultMap.get(x.id);
        if (!r) continue;
        if (r.verdict === "bad_ambiguous") {
          ambiguousIds.add(x.id);
        } else if (r.verdict === "accept_variants" && r.validIndices.length >= 2) {
          const newContent = { ...x.content, acceptedIndices: r.validIndices };
          const existing = toUpdate.find((u) => u.id === x.id);
          if (existing) existing.content = newContent;
          else toUpdate.push({ id: x.id, content: newContent });
          acceptVariantsCount++;
          console.log(`  ✅ ${x.id.slice(0, 8)}: acceptedIndices diisi ${JSON.stringify(r.validIndices)} (variasi gender/jumlah wajar)`);
        }
      }
    }
    if (!onlyGender) {
      // Di mode --only gender, "bad_ambiguous" SENGAJA dilewati (gak dihapus)
      // -- itu bukan soal gender, di luar cakupan mode ini. Biar soal itu
      // kena pemeriksaan ini lagi nanti pas audit PENUH dijalankan.
      for (const id of ambiguousIds) toDelete.push({ id, reason: "ambigu (bukan variasi gender/jumlah — soal cacat menurut AI judge)" });
    }

    // --- Judge alternatif word_order ---
    for (const c of onlyGender ? [] : chunk(wordOrderCandidates, JUDGE_CHUNK)) {
      const items = c.map((x) => ({ key: x.id, direction: x.direction, reference: x.reference, correctWords: x.correctWords, wordBank: x.wordBank }));
      const proposed = await proposeWordOrderAlternatives(callLadiz, cleanJson, items);
      if (!proposed) { console.warn("  ⚠ Judge word_order gagal untuk 1 chunk, dilewati."); continue; }
      for (const x of c) {
        const alt = proposed.get(x.id) || [];
        const { content, added } = mergeWordOrderAlternatives(x.baseContent, alt);
        if (added > 0) {
          const existing = toUpdate.find((u) => u.id === x.id);
          if (existing) existing.content = content;
          else toUpdate.push({ id: x.id, content });
          console.log(`  ➕ ${x.id.slice(0, 8)}: +${added} alternatif susun-kata`);
        }
      }
    }

    // --- Judge nama orang, DIKELOMPOKKAN per (level_id, segment_number) ---
    const groups = new Map(); // "level-seg" -> [ids in original order]
    for (const x of nameCandidates) {
      const key = `${x.level_id}-${x.segment_number}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(x);
    }
    const nameDeleteIds = new Set();
    for (const c of onlyGender ? [] : chunk(nameCandidates, JUDGE_CHUNK)) {
      const items = c.map((x) => ({ key: x.id, text: x.text }));
      const nameSet = await judgePersonNames(callLadiz, cleanJson, items);
      if (!nameSet) { console.warn("  ⚠ Judge nama-orang gagal untuk 1 chunk, dilewati (dianggap aman)."); continue; }
      for (const x of c) if (nameSet.has(x.id)) x._hasName = true;
    }
    for (const [, items] of groups) {
      const named = items.filter((x) => x._hasName);
      for (const extra of named.slice(1)) nameDeleteIds.add(extra.id); // sisakan yang PERTAMA, sisanya dihapus
    }
    for (const id of nameDeleteIds) toDelete.push({ id, reason: "kebanyakan soal bernama-orang di segmen yang sama" });

    // --- Terapkan ---
    const deleteIds = [...new Set(toDelete.map((d) => d.id))];
    await deleteExercises(
      deleteIds.filter((id) => ambiguousIds.has(id)),
      dryRun,
      "ambigu"
    );
    await deleteExercises(
      deleteIds.filter((id) => nameDeleteIds.has(id)),
      dryRun,
      "kelebihan nama orang"
    );
    await deleteExercises(
      deleteIds.filter((id) => !ambiguousIds.has(id) && !nameDeleteIds.has(id)),
      dryRun,
      "cacat struktural"
    );

    for (const u of toUpdate) {
      if (deleteIds.includes(u.id)) continue; // udah kehapus di atas, jangan diupdate juga
      console.log(`  ${dryRun ? "[DRY-RUN] AKAN " : ""}memperbarui ${u.id.slice(0, 8)}`);
      await updateExerciseContent(u.id, u.content, dryRun);
    }

    if (!onlyGender) {
      // [FIX FK 23503] Soal yang BARU SAJA DIHAPUS tidak boleh ikut ditandai: kolom
      // exercise_id di exercise_quality_audit berelasi ke exercises(id), jadi
      // menandai baris yang sudah tidak ada ditolak database ("violates foreign key").
      // Soal yang sudah terhapus memang tidak perlu ditandai.
      const deletedSet = new Set(deleteIds);
      const allIds = batch.map((r) => r.id).filter((id) => !deletedSet.has(id));
      await markAudited(allIds, dryRun);
    }

    totalDropped += toDelete.filter((d) => !d.reason.includes("nama")).length;
    totalNameDropped += nameDeleteIds.size;
    totalFixed += toUpdate.filter((u) => !deleteIds.includes(u.id)).length;
    processed += batch.length;

    console.log(`  Ringkas batch: ${batch.length} diperiksa, ${toDelete.length} dihapus, ${toUpdate.length} diperbaiki.`);
  }

  console.log(`\n=== SELESAI ===`);
  console.log(`Total diperiksa: ${processed}`);
  console.log(`Dihapus (ambigu/struktural): ${totalDropped}`);
  console.log(`Dihapus (kelebihan nama orang): ${totalNameDropped}`);
  console.log(`Diperbaiki di tempat (word_order + lainnya): ${totalFixed}`);
  if (!dryRun && (totalDropped + totalNameDropped) > 0) {
    console.log(`\nJalankan generate-vocab-v2.mjs --commit lagi kapan-kapan untuk mengisi ulang soal yang terhapus.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error("Gagal:", err);
    process.exitCode = 1;
  });
}
