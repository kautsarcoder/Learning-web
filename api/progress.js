// api/progress.js
// POST /api/progress
//   Body: { user_id, level_id, score, segment_number? }
//   segment_number OPSIONAL:
//     - DIKASIH (1-4): tandai SEGMEN itu selesai. Kalau semua segmen level
//       ini (sesuai jumlah segment_number unik yang ada di tabel exercises
//       buat level itu) sudah selesai, level KESELURUHAN otomatis ditandai
//       "done" di user_progress juga.
//     - GAK DIKASIH: perilaku lama — langsung tandai level "done" (dipakai
//       practice/review adaptif, yang gak punya struktur 4 segmen).
//
// GET /api/progress?user_id=xxx&level_ids=id1,id2,id3
//   Ambil status progress level (done/current/dst) SEKALIGUS daftar segmen
//   yang sudah selesai per level — dipakai frontend buat ring 4-bagian +
//   nentuin segmen mana yang harus dimainkan berikutnya.
 
import { createClient } from "@supabase/supabase-js";
 
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // perlu write access
);
 
export default async function handler(req, res) {
  if (req.method === "GET") {
    const { user_id, level_ids } = req.query;
    if (!user_id || !level_ids) {
      return res.status(400).json({ error: "user_id dan level_ids wajib diisi" });
    }
    try {
      const ids = level_ids.split(",").filter(Boolean);
 
      const { data: levelProgress, error: lpErr } = await supabase
        .from("user_progress")
        .select("level_id, status, score")
        .eq("user_id", user_id)
        .in("level_id", ids);
      if (lpErr) throw lpErr;
 
      const { data: segmentRows, error: segErr } = await supabase
        .from("user_segment_progress")
        .select("level_id, segment_number")
        .eq("user_id", user_id)
        .in("level_id", ids);
      if (segErr) throw segErr;
 
      const segmentsByLevelId = new Map();
      for (const row of segmentRows || []) {
        if (!segmentsByLevelId.has(row.level_id)) segmentsByLevelId.set(row.level_id, []);
        segmentsByLevelId.get(row.level_id).push(row.segment_number);
      }
 
      const result = (levelProgress || []).map((p) => ({
        ...p,
        segments_done: (segmentsByLevelId.get(p.level_id) || []).sort((a, b) => a - b),
      }));
      // Level yang statusnya belum ada di user_progress SAMA SEKALI tapi
      // sudah punya progress segmen (baru mulai, belum selesai semua) —
      // tetap perlu dikirim biar frontend tau segmen mana yang sudah jalan.
      for (const levelId of segmentsByLevelId.keys()) {
        if (!result.some((r) => r.level_id === levelId)) {
          result.push({ level_id: levelId, status: null, score: null, segments_done: segmentsByLevelId.get(levelId).sort((a, b) => a - b) });
        }
      }
 
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }
 
  if (req.method !== "POST") return res.status(405).end();
 
  const { user_id, level_id, score, segment_number } = req.body;
 
  try {
    if (segment_number) {
      // 1. Catat segmen ini selesai (idempotent — replay segmen yang sama
      // cuma nimpa baris yang sama, gak dobel).
      const { error: segError } = await supabase.from("user_segment_progress").upsert({
        user_id, level_id, segment_number, score, completed_at: new Date().toISOString(),
      });
      if (segError) throw segError;
 
      // 2. Cek: sudah berapa segmen TOTAL yang ada buat level ini (dari
      // tabel exercises, distinct segment_number), vs berapa yang SUDAH
      // diselesaikan user ini. Kalau semua sudah, level keseluruhan ikut
      // ditandai "done".
      const { data: exerciseSegments, error: exErr } = await supabase
        .from("exercises")
        .select("segment_number")
        .eq("level_id", level_id)
        .eq("is_adaptive", false);
      if (exErr) throw exErr;
      const totalSegments = new Set((exerciseSegments || []).map((e) => e.segment_number)).size;
 
      const { data: doneSegments, error: doneErr } = await supabase
        .from("user_segment_progress")
        .select("segment_number")
        .eq("user_id", user_id)
        .eq("level_id", level_id);
      if (doneErr) throw doneErr;
      const doneCount = new Set((doneSegments || []).map((d) => d.segment_number)).size;
 
      if (totalSegments > 0 && doneCount >= totalSegments) {
        const { error: lvlError } = await supabase.from("user_progress").upsert({
          user_id, level_id, status: "done", score, last_played_at: new Date().toISOString(),
        });
        if (lvlError) throw lvlError;
      }
    } else {
      // Perilaku lama — dipakai practice/review adaptif (gak ada struktur
      // 4 segmen, langsung selesai = level selesai).
      const { error: progressError } = await supabase.from("user_progress").upsert({
        user_id, level_id, status: "done", score, last_played_at: new Date().toISOString(),
      });
      if (progressError) throw progressError;
    }
 
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}