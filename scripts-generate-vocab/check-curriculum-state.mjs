// scripts/check-curriculum-state.mjs
//
// CUMA BACA database, gak ngubah apa pun. Tujuannya: cek apakah masih ada
// topik LAMA (dari sebelum redesign 100-topik) yang "nyangkut" di database,
// biar kita tau perlu ditangani atau tidak.
//
// Jalankan:
//   node scripts/check-curriculum-state.mjs
//
// Lalu paste HASIL OUTPUT-nya (bukan screenshot, teksnya aja) balik ke chat.

import "dotenv/config";
import { supabase, SUBJECT_SLUG } from "./generate-vocab-v2.mjs";
import { TOPIC_NAMES } from "../lib/curriculum-engine.mjs";

async function main() {
  const { data: subject, error: subjectErr } = await supabase
    .from("subjects")
    .select("id")
    .eq("slug", SUBJECT_SLUG)
    .maybeSingle();
  if (subjectErr) throw subjectErr;
  if (!subject) {
    console.log(`Subject dengan slug "${SUBJECT_SLUG}" belum ada di database sama sekali -- berarti masih kosong total, belum pernah di-generate.`);
    return;
  }

  const { data: units, error: unitsErr } = await supabase
    .from("units")
    .select("id, order_index")
    .eq("subject_id", subject.id);
  if (unitsErr) throw unitsErr;

  if (!units || units.length === 0) {
    console.log("Belum ada unit/Bagian sama sekali -- database masih kosong, belum pernah di-generate.");
    return;
  }

  const { data: topics, error: topicsErr } = await supabase
    .from("topics")
    .select("id, name, order_index, unit_id")
    .in("unit_id", units.map((u) => u.id));
  if (topicsErr) throw topicsErr;

  const newNameSet = new Set(TOPIC_NAMES);
  const matching = (topics || []).filter((t) => newNameSet.has(t.name));
  const orphaned = (topics || []).filter((t) => !newNameSet.has(t.name));

  console.log(`Total topik di database sekarang: ${topics.length}`);
  console.log(`Cocok dengan CURRICULUM baru (100 nama topik): ${matching.length}`);
  console.log(`TIDAK cocok / kemungkinan topik LAMA: ${orphaned.length}`);

  if (orphaned.length === 0) {
    console.log("\n✓ Bersih -- semua topik yang ada di database namanya cocok sama CURRICULUM baru. Gak ada data lama yang nyangkut.");
    return;
  }

  console.log("\n⚠ Ini daftar topik yang TIDAK ada di CURRICULUM baru (kemungkinan peninggalan skema lama):");
  let totalOrphanedVocab = 0;
  for (const t of orphaned) {
    const { data: levelRows } = await supabase.from("levels").select("id").eq("topic_id", t.id);
    const levelIds = (levelRows || []).map((l) => l.id);
    let vocabCount = 0;
    if (levelIds.length > 0) {
      const { count: vc } = await supabase
        .from("vocab_items")
        .select("id", { count: "exact", head: true })
        .in("level_id", levelIds);
      vocabCount = vc || 0;
    }
    totalOrphanedVocab += vocabCount;
    console.log(`  - "${t.name}" (unit_id: ${t.unit_id}, order_index: ${t.order_index}) -- ${vocabCount} kata`);
  }
  console.log(`\nTotal kata di topik-topik lama ini: ${totalOrphanedVocab}`);
}

main().catch((err) => {
  console.error("Gagal:", err.message);
  process.exit(1);
});
