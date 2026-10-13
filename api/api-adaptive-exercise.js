// api/adaptive-exercise.js
// POST /api/adaptive-exercise
// Body: { user_id, level_id }
//
// Dipanggil frontend saat user buka bulatan bertipe "practice" atau "review".
//
// TANPA AI. Soal disusun dari soal STATIS yang sudah ada di level lesson/story/
// conversation SEBELUM level ini dalam topik yang sama (hasil generator), lalu:
//   - segmen yang baru dimainkan (lesson segmen 1) dikesampingkan dulu supaya soalnya terasa beda,
//   - tiap soal diberi skor prioritas berdasarkan kosakata yang diujinya:
//       baru salah (48 jam)  > mastery rendah (<40) > belum pernah dilatih,
//   - ditambah sedikit acak supaya tiap kali main urutannya beda,
//   - diambil MAX_QUESTIONS teratas, dengan batas per tipe supaya tidak monoton.
// Tidak ada tulis ke database di sini, dan mastery/next_review_at tetap domain api/answer.js.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_QUESTIONS = 10;
const MAX_PER_TYPE = 4;
const WEAK_MASTERY_THRESHOLD = 40;
const RECENTLY_WRONG_WINDOW_MS = 48 * 60 * 60 * 1000;
const CHUNK = 80;

async function selectIn(table, columns, column, ids, extra) {
  const out = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    let q = supabase.from(table).select(columns).in(column, ids.slice(i, i + CHUNK));
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { user_id, level_id } = req.body || {};
  if (!user_id || !level_id) {
    return res.status(400).json({ error: "user_id dan level_id wajib diisi" });
  }

  try {
    // 1. Level ini + topiknya.
    const { data: level, error: levelError } = await supabase
      .from("levels")
      .select("id, level_number, node_type, topic_id")
      .eq("id", level_id)
      .single();
    if (levelError) throw levelError;

    // 2. Level lain di topik yang sama yang urutannya SEBELUM level ini (bukan practice/review).
    const { data: siblingLevels, error: sibError } = await supabase
      .from("levels")
      .select("id, level_number, node_type")
      .eq("topic_id", level.topic_id)
      .order("level_number");
    if (sibError) throw sibError;

    const sources = (siblingLevels || []).filter(
      (l) => l.level_number < level.level_number && l.node_type !== "practice" && l.node_type !== "review"
    );
    if (sources.length === 0) return res.status(200).json([]);
    const lessonIds = new Set(sources.filter((l) => l.node_type === "lesson").map((l) => l.id));

    // 3. Soal statis dari level-level itu (bukan soal adaptif lama, bukan pengenalan kosakata).
    const rows = await selectIn(
      "exercises",
      "id, level_id, type, order_index, prompt, content, content_en, audio_url, segment_number, is_adaptive",
      "level_id",
      sources.map((l) => l.id),
      (q) => q.or("is_adaptive.is.null,is_adaptive.eq.false").neq("type", "vocab_intro")
    );

    // Lesson: segmen 1 baru saja dimainkan -> dahulukan segmen 2+, tapi kalau kurang, pakai semuanya.
    let pool = rows.filter((r) => !lessonIds.has(r.level_id) || (r.segment_number || 1) >= 2);
    if (pool.length < MAX_QUESTIONS) pool = rows;
    if (pool.length === 0) return res.status(200).json([]);

    // 4. Kosakata tiap soal.
    const links = await selectIn("exercise_vocab", "exercise_id, vocab_id", "exercise_id", pool.map((r) => r.id));
    const vocabByExercise = new Map();
    for (const l of links) {
      if (!vocabByExercise.has(l.exercise_id)) vocabByExercise.set(l.exercise_id, []);
      vocabByExercise.get(l.exercise_id).push(l.vocab_id);
    }

    // 5. Progress user untuk kosakata itu.
    const allVocabIds = [...new Set(links.map((l) => l.vocab_id))];
    const progress = allVocabIds.length
      ? await selectIn("user_vocab_progress", "vocab_id, mastery_score, last_wrong_at", "vocab_id", allVocabIds, (q) => q.eq("user_id", user_id))
      : [];
    const progressByVocab = new Map(progress.map((p) => [p.vocab_id, p]));
    const nowMs = Date.now();

    const vocabScore = (vid) => {
      const p = progressByVocab.get(vid);
      if (!p) return 1; // belum pernah dilatih
      let sc = 0;
      if (p.last_wrong_at && nowMs - new Date(p.last_wrong_at).getTime() < RECENTLY_WRONG_WINDOW_MS) sc += 3;
      if (Number(p.mastery_score) < WEAK_MASTERY_THRESHOLD) sc += 2;
      return sc;
    };

    // 6. Skor + acak, lalu pilih dengan batas per tipe.
    const scored = pool
      .map((r) => {
        const vids = vocabByExercise.get(r.id) || [];
        const base = vids.reduce((a, v) => a + vocabScore(v), 0);
        return { r, vids, score: Math.min(base, 8) + Math.random() * 2.5 };
      })
      .sort((a, b) => b.score - a.score);

    const picked = [];
    const perType = {};
    for (const item of scored) {
      if (picked.length >= MAX_QUESTIONS) break;
      const t = item.r.type;
      if ((perType[t] || 0) >= MAX_PER_TYPE) continue;
      perType[t] = (perType[t] || 0) + 1;
      picked.push(item);
    }
    // Kalau batas per tipe bikin kurang dari target, isi sisanya tanpa batas.
    if (picked.length < Math.min(MAX_QUESTIONS, scored.length)) {
      for (const item of scored) {
        if (picked.length >= MAX_QUESTIONS) break;
        if (!picked.includes(item)) picked.push(item);
      }
    }
    // Urutan tampil diacak lagi supaya soal "prioritas" tidak selalu di depan.
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }

    res.status(200).json(
      picked.map(({ r, vids }) => ({
        id: r.id,
        type: r.type,
        prompt: r.prompt,
        content: r.content,
        content_en: r.content_en || null,
        audio_url: r.audio_url || null,
        vocab_ids: vids,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
