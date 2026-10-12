// api/adaptive-exercise.js
// POST /api/adaptive-exercise
// Body: { user_id, level_id }
//
// Dipanggil frontend saat user buka bulatan bertipe "practice" atau
// "review" — BEDA dari lesson/story/conversation (yang statis, disiapkan
// generate-vocab-v2.mjs sekali buat semua orang). Endpoint ini BIKIN soal
// on-the-fly, DIKONTEKSTUALISASI ke progress user itu spesifik.
//
// Poin Q — konteks yang dikasih ke AI:
//   - target vocabulary        -> kosakata dari level lesson SEBELUM level ini
//   - recently learned vocab   -> kosakata yang baru dipelajari (level lesson terdekat)
//   - weak vocabulary          -> user_vocab_progress mastery_score rendah
//   - recently incorrect vocab -> user_vocab_progress last_wrong_at baru-baru ini
//   - user level               -> dihitung kasar dari rata-rata mastery_score user di topik ini
//   - topic, difficulty        -> dari data topics/units
//   - exercise type            -> "practice" atau "review" (step.node_type)
//   - previous exercise signatures -> exercise adaptive user ini SEBELUMNYA
//     di level yg sama (biar gak generate soal mirip² terus tiap kali main ulang)
//   - related vocabulary       -> kosakata lain di topik yang sama
//   - prerequisite vocabulary  -> kosakata dari level SEBELUM topik ini (kalau ada)
//   - cross-unit review vocab  -> [BARU] kosakata dari Unit LAIN (bisa beda
//     Bagian) yang paling butuh direview (Review Engine yang sama dipakai
//     /api/review-session), disisipkan kecil-kecilan (maks CROSS_UNIT_REVIEW_MAX
//     kata) biar materi lama gak lupa -- ini yang gantiin peran "topik
//     berulang antar-Bagian" di desain kurikulum lama.
//
// PENTING (sesuai instruksi): AI CUMA generate ISI soal (teks/pilihan/dst).
// AI SAMA SEKALI TIDAK menentukan mastery_score atau next_review_at --
// itu murni domain api/answer.js (algoritma deterministik, bukan AI).

import { createClient } from "@supabase/supabase-js";
import { loadExistingSignatures, filterDuplicateExercises, sanitizeGeneratedExercises, shuffleAnswerPositions } from "../lib/exercise-validator.mjs";
import { rankVocabByPriority } from "../lib/review-engine.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const WEAK_MASTERY_THRESHOLD = 40;
const RECENTLY_WRONG_WINDOW_MS = 48 * 60 * 60 * 1000;
// Sisip-review lintas-unit (desain kurikulum baru — 100 topik gak berulang,
// jadi pengulangan MATERI lama ditangani DI SINI, bukan lewat topik yang
// muncul lagi). Dibatasi kecil sengaja — ini "SISIPAN", bukan sesi review
// terpisah: cuma nambah 1-2 soal ke practice/review Unit yang lagi
// dimainkan, milih kata paling butuh direview dari Unit MANA PUN yang
// user udah pernah selesaikan (bisa beda Bagian sekalipun).
const CROSS_UNIT_REVIEW_MAX = 4;

async function callLadiz(prompt, maxTokens) {
  const res = await fetch(`${process.env.LADIZ_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LADIZ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "ladiz-core",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respons LadizAI tidak terduga: " + JSON.stringify(json).slice(0, 300));
  return content;
}

function cleanJson(text) {
  return text.replace(/```json|```/g, "").trim();
}

function summarizeExercise(ex) {
  const c = ex.content || {};
  const key = c.promptText || c.text || c.latin || (c.beforeBlank?.latin || c.beforeBlank?.text) || "(?)";
  return `${ex.type}: ${key}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { user_id, level_id } = req.body;
  if (!user_id || !level_id) {
    return res.status(400).json({ error: "user_id dan level_id wajib diisi" });
  }

  try {
    // 1. Info level ini: node_type (practice/review), topic, unit-nya.
    const { data: level, error: levelError } = await supabase
      .from("levels")
      .select("*, topics(id, name, order_index, unit_id)")
      .eq("id", level_id)
      .single();
    if (levelError) throw levelError;
    const topic = level.topics;

    // 2. Semua level LAIN di topik yang sama, buat tau mana yang "sebelum"
    //    level ini (sumber target/recently-learned/prerequisite vocab).
    const { data: siblingLevels, error: siblingsError } = await supabase
      .from("levels")
      .select("id, level_number, node_type")
      .eq("topic_id", topic.id)
      .order("level_number");
    if (siblingsError) throw siblingsError;

    const levelsBefore = siblingLevels.filter((l) => l.level_number < level.level_number && l.node_type !== "practice" && l.node_type !== "review");
    const levelIdsBefore = levelsBefore.map((l) => l.id);
    const recentLevelIds = levelsBefore.slice(-2).map((l) => l.id); // 2 lesson terakhir sebelum ini = "baru dipelajari"

    // 3. Ambil vocab_items dari level-level "sebelum" ini (target vocabulary).
    const { data: targetVocab, error: vocabError } = await supabase
      .from("vocab_items")
      .select("*")
      .in("level_id", levelIdsBefore.length > 0 ? levelIdsBefore : ["00000000-0000-0000-0000-000000000000"]);
    if (vocabError) throw vocabError;
    if (!targetVocab || targetVocab.length === 0) {
      return res.status(200).json([]); // belum ada vocab buat dijadiin bahan practice/review
    }

    const recentlyLearned = targetVocab.filter((v) => recentLevelIds.includes(v.level_id));

    // 4. Progress user buat kata-kata ini: weak & recently-incorrect.
    const vocabIds = targetVocab.map((v) => v.id);
    const { data: progressRows } = await supabase
      .from("user_vocab_progress")
      .select("*")
      .eq("user_id", user_id)
      .in("vocab_id", vocabIds);
    const progressByVocabId = new Map((progressRows || []).map((p) => [p.vocab_id, p]));

    const nowMs = Date.now();
    const weakVocab = targetVocab.filter((v) => {
      const p = progressByVocabId.get(v.id);
      return p && Number(p.mastery_score) < WEAK_MASTERY_THRESHOLD;
    });
    const recentlyIncorrectVocab = targetVocab.filter((v) => {
      const p = progressByVocabId.get(v.id);
      return p?.last_wrong_at && (nowMs - new Date(p.last_wrong_at).getTime()) < RECENTLY_WRONG_WINDOW_MS;
    });

    // "User level" kasar: rata-rata mastery_score user di topik ini (0..100).
    const masteryValues = vocabIds.map((vid) => progressByVocabId.get(vid)?.mastery_score ?? 0);
    const avgMastery = masteryValues.reduce((a, b) => a + Number(b), 0) / (masteryValues.length || 1);
    const userLevelLabel = avgMastery >= 70 ? "mahir" : avgMastery >= 40 ? "menengah" : "pemula";

    // 4b. SISIP REVIEW LINTAS-UNIT (otomatis, sistem yang milih sendiri):
    //    ambil vocab dari Unit-Unit LAIN (level di luar topic.id sekarang,
    //    bisa beda Bagian) yang levelnya sudah "done" buat user ini, lalu
    //    pakai Review Engine YANG SAMA PERSIS dipakai /api/review-session
    //    (rankVocabByPriority: overdue > weak > recently_wrong > due) buat
    //    milih kata mana yang paling butuh direview sekarang. Ini bonus,
    //    bukan fitur inti — kalau query ini gagal, sesi practice/review
    //    UTAMA tetap harus jalan seperti biasa.
    let crossUnitReviewVocab = [];
    try {
      const { data: doneLevels } = await supabase
        .from("user_progress")
        .select("level_id")
        .eq("user_id", user_id)
        .eq("status", "done");
      const currentTopicLevelIds = new Set(siblingLevels.map((l) => l.id));
      const crossUnitLevelIds = [...new Set((doneLevels || []).map((d) => d.level_id))].filter(
        (lid) => !currentTopicLevelIds.has(lid)
      );

      if (crossUnitLevelIds.length > 0) {
        const { data: crossUnitVocabRows } = await supabase
          .from("vocab_items")
          .select("*")
          .in("level_id", crossUnitLevelIds);

        if (crossUnitVocabRows && crossUnitVocabRows.length > 0) {
          const crossVocabIds = crossUnitVocabRows.map((v) => v.id);
          const { data: crossProgressRows } = await supabase
            .from("user_vocab_progress")
            .select("*")
            .eq("user_id", user_id)
            .in("vocab_id", crossVocabIds);
          const crossProgressByVocabId = new Map((crossProgressRows || []).map((p) => [p.vocab_id, p]));

          const ranked = rankVocabByPriority(crossUnitVocabRows, crossProgressByVocabId, nowMs);
          crossUnitReviewVocab = ranked.slice(0, CROSS_UNIT_REVIEW_MAX).map((c) => c.vocab);
        }
      }
    } catch (err) {
      console.warn("Gagal ambil kosakata review lintas-unit (dilewati, gak fatal):", err.message);
    }

    // 5. Related vocabulary: kata lain di topik yang sama, di LUAR target
    //    vocab (buat variasi distractor pilihan ganda yang masuk akal).
    const { data: allTopicVocab } = await supabase
      .from("vocab_items")
      .select("*")
      .in("level_id", siblingLevels.map((l) => l.id));
    const relatedVocab = (allTopicVocab || []).filter((v) => !vocabIds.includes(v.id)).slice(0, 10);

    // 6. Prerequisite vocabulary: kata dari topik SEBELUMNYA (order_index
    //    lebih kecil) di Bagian yang sama, kalau ada.
    const { data: earlierTopics } = await supabase
      .from("topics")
      .select("id")
      .eq("unit_id", topic.unit_id)
      .lt("order_index", topic.order_index);
    let prerequisiteVocab = [];
    if (earlierTopics && earlierTopics.length > 0) {
      const { data: earlierLevels } = await supabase.from("levels").select("id").in("topic_id", earlierTopics.map((t) => t.id));
      if (earlierLevels && earlierLevels.length > 0) {
        const { data: prereqRows } = await supabase.from("vocab_items").select("*").in("level_id", earlierLevels.map((l) => l.id));
        prerequisiteVocab = (prereqRows || []).slice(0, 10);
      }
    }

    // 7. Previous exercise signatures: soal adaptive yang PERNAH digenerate
    //    buat user ini di level ini sebelumnya — biar AI gak bikin yang mirip.
    const { data: previousAdaptive } = await supabase
      .from("exercises")
      .select("type, content")
      .eq("level_id", level_id)
      .eq("generated_for_user_id", user_id)
      .eq("is_adaptive", true)
      .order("created_at", { ascending: false })
      .limit(15);
    const previousSignatures = (previousAdaptive || []).map(summarizeExercise);

    // ============================================================
    // Susun prompt — SEMUA konteks poin Q dimasukkan.
    // ============================================================
    const prompt = `Kamu bikin soal Bahasa Arab Levantine untuk sesi "${level.node_type}"
(topik: "${topic.name}", level user: ${userLevelLabel}).

TARGET VOCABULARY (fokus utama soal-soal ini):
${targetVocab.map((v) => `${v.kata_arab} (${v.latin}) = ${v.arti}`).join("\n")}

${recentlyLearned.length > 0 ? `KOSAKATA YANG BARU DIPELAJARI (prioritaskan, biar makin lekat):
${recentlyLearned.map((v) => v.kata_arab).join(", ")}
` : ""}
${weakVocab.length > 0 ? `KOSAKATA LEMAH user ini (mastery rendah — kasih porsi lebih banyak):
${weakVocab.map((v) => v.kata_arab).join(", ")}
` : ""}
${recentlyIncorrectVocab.length > 0 ? `KOSAKATA YANG BARU SALAH dijawab user (48 jam terakhir — WAJIB masuk sesi ini):
${recentlyIncorrectVocab.map((v) => v.kata_arab).join(", ")}
` : ""}
${relatedVocab.length > 0 ? `KOSAKATA TERKAIT (boleh dipakai sebagai pengecoh/distractor pilihan ganda, BUKAN fokus utama):
${relatedVocab.map((v) => v.kata_arab).join(", ")}
` : ""}
${prerequisiteVocab.length > 0 ? `KOSAKATA PRASYARAT (dari topik sebelumnya, boleh disinggung buat konteks kalimat):
${prerequisiteVocab.map((v) => v.kata_arab).join(", ")}
` : ""}
${crossUnitReviewVocab.length > 0 ? `KOSAKATA REVIEW DARI UNIT LAIN (sengaja DISISIPKAN dari materi yang sudah lama dipelajari user
di Unit/Bagian lain, supaya gak lupa — buat 1-2 soal SINGKAT pakai kata-kata ini, boleh berdiri
sendiri sebagai kalimat terpisah, JANGAN dipaksa nyambung ke tema "${topic.name}" di atas):
${crossUnitReviewVocab.map((v) => `${v.kata_arab} (${v.latin}) = ${v.arti}`).join("\n")}
` : ""}
${previousSignatures.length > 0 ? `SOAL YANG SUDAH PERNAH DIBUAT buat user ini di sesi sebelumnya — JANGAN dibuat mirip lagi:
${previousSignatures.map((s) => `- ${s}`).join("\n")}
` : ""}

Buat 8-13 soal (translate_choice, word_order, fill_blank, matching_pairs, atau translate_write — variasikan),
tiap soal WAJIB punya field "vocab_used" (array kata_arab persis dari daftar TARGET VOCABULARY di atas
yang diuji soal itu). Balas HANYA JSON array, format:
[{ "type": "...", "prompt": "...", "content": { ... }, "vocab_used": ["..."] }]

ATURAN KUALITAS (WAJIB):
- Tiap soal punya field "has_person_name" (true/false). JANGAN memakai nama orang sama sekali.
- Teks Indonesia yang jadi SUMBER terjemahan ke Arab dan memuat kamu/kalian/dia/mereka/anda WAJIB diberi
  label gender dalam kurung, mis. "Kamu (perempuan) sudah makan?", "Dia (laki-laki) guru".
- "translate_choice" (arti 1 kata) 5 opsi; "fill_blank" 3 opsi dengan HANYA 1 opsi yang benar; semua opsi
  berbeda dan opsi Arab ditulis Arab murni (tanpa huruf Latin).
- Pakai HANYA kata Arab dari daftar TARGET / PRASYARAT / REVIEW LINTAS-UNIT. KOSAKATA TERKAIT hanya boleh
  jadi pengecoh pilihan ganda, jangan dipakai di kalimat soal.

Khusus tipe "fill_blank", content-nya WAJIB pakai bentuk ini (rumpang bisa di AWAL, TENGAH, atau AKHIR
kalimat — sesuaikan posisi beforeBlank/afterBlank, salah satunya boleh string kosong kalau rumpang di
ujung kalimat):
{ "beforeBlank": { "latin": "...", "text": "..." }, "afterBlank": { "latin": "...", "text": "..." },
  "options": [{ "latin": "...", "text": "..." }, ...3], "correctIndex": 0 }

Khusus tipe "word_order", VARIASIKAN 2 arah (jangan cuma 1 arah terus):
- direction:"to_indonesian" — referensi kalimat Arab, wordBank/correctWords Bahasa Indonesia:
  { "direction": "to_indonesian", "latin": "...", "text": "...(arab)...", "hasAudio": true,
    "correctWords": ["..."], "wordBank": ["...", "...pengecoh..."] }
- direction:"to_arabic" — referensi kalimat Indonesia, wordBank/correctWords Bahasa Arab:
  { "direction": "to_arabic", "text": "...(indonesia)...",
    "correctWords": ["...arab..."], "wordBank": ["...arab...", "...pengecoh arab..."] }`;

    const raw = await callLadiz(prompt, 6000);
    const parsed = JSON.parse(cleanJson(raw));
    // response_format json_object kadang membungkus array dalam objek -> ambil array pertamanya.
    const rawExercises = Array.isArray(parsed) ? parsed : (Object.values(parsed || {}).find(Array.isArray) || []);
    // Pemeriksaan struktural GRATIS (tanpa panggilan AI tambahan, supaya user tidak menunggu lebih lama):
    // soal cacat dibuang, nama orang dibuang, kata ganti tanpa label gender dibuang, jumlah soal bernama dibatasi.
    const { kept } = sanitizeGeneratedExercises(
      rawExercises.filter((e) => !(e && (e.has_person_name === true || e.has_person_name === "true"))),
      { nodeType: level.node_type, maxNameExercises: 0, requireGenderLabel: true }
    );
    // AI cenderung menaruh jawaban benar di opsi pertama -> acak posisinya lewat program.
    const generatedExercises = shuffleAnswerPositions(kept);

    // ============================================================
    // Simpan ke database, DI-SCOPE ke user ini (is_adaptive=true,
    // generated_for_user_id=user_id) — TIDAK dibagikan ke user lain.
    // AI TIDAK menyentuh mastery/next_review_at sama sekali di sini.
    // Poin R: signature check di-scope PER USER — 1 user gak akan dapat
    // soal identik 2x di level ini walau replay berkali-kali.
    // ============================================================
    // Gabung targetVocab + crossUnitReviewVocab — AI boleh pakai kata dari
    // keduanya di "vocab_used", jadi vocab_id-nya harus bisa ke-resolve dua-duanya.
    const vocabIdByWord = new Map(
      [...targetVocab, ...crossUnitReviewVocab].map((v) => [v.kata_arab, v.id])
    );

    // Poin R + U: dedup deterministik, di-scope PER USER (exercise adaptive
    // memang cuma milik 1 user) — logic-nya di lib/exercise-validator.mjs,
    // dipakai bareng generate-vocab-v2.mjs (1 sumber, bukan 2 salinan).
    const existingSignatures = await loadExistingSignatures(supabase, { levelId: level_id, generatedForUserId: user_id });
    const toInsert = filterDuplicateExercises(generatedExercises, vocabIdByWord, existingSignatures);

    const savedExercises = [];
    let orderIndex = 1;

    for (const { ex, vocabUsedIds, signature } of toInsert) {
      const { data: insertedEx, error: insertError } = await supabase.from("exercises").insert({
        level_id, type: ex.type, order_index: orderIndex++, prompt: ex.prompt, content: ex.content,
        segment_number: 1, is_adaptive: true, generated_for_user_id: user_id, signature,
      }).select().single();
      if (insertError) {
        if (insertError.code === "23505") continue; // jaring pengaman terakhir, bukan fatal
        throw insertError;
      }

      for (const vid of vocabUsedIds) {
        await supabase.from("exercise_vocab").insert({ exercise_id: insertedEx.id, vocab_id: vid });
      }

      savedExercises.push({
        id: insertedEx.id, type: ex.type, prompt: ex.prompt, content: ex.content,
        audio_url: null, vocab_ids: vocabUsedIds,
      });
    }

    res.status(200).json(savedExercises);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
