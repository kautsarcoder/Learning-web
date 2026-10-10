// scripts-generate-vocab/migrate-fillblank-format.mjs
//
// Convert soal fill_blank/listen_complete LAMA (format bubbleLines) jadi
// format BARU (beforeBlank/afterBlank) — TANPA manggil AI sama sekali
// (murni transformasi lokal, gratis & cepat).
//
// bubbleLines lama cuma bisa naruh rumpang di AKHIR kalimat (blankAfter di
// baris terakhir) — jadi migrasi ini: teks SEBELUM rumpang → beforeBlank,
// afterBlank dikosongkan (karena struktur lama emang gak pernah punya teks
// SESUDAH rumpang). Ini bukan "membenarkan" posisi rumpang yang salah
// secara pedagogis (itu perlu regenerate AI) — ini cuma benerin soal biar
// KETAMPIL lagi (gak kosong kayak di screenshot), posisinya tetap di akhir.
//
// Command:
//   node scripts-generate-vocab/migrate-fillblank-format.mjs           (preview)
//   node scripts-generate-vocab/migrate-fillblank-format.mjs --commit  (terapkan)

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PAGE_SIZE = 1000;

async function fetchAllPaginated(buildQuery) {
  const allRows = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    allRows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
}

async function main() {
  const commit = process.argv.includes("--commit");

  console.log("Mengambil semua exercise fill_blank/listen_complete...");
  const allExercises = await fetchAllPaginated(() =>
    supabase.from("exercises").select("id, type, content").in("type", ["fill_blank", "listen_complete"])
  );
  const needsMigration = allExercises.filter((e) => e.content?.bubbleLines && !e.content?.beforeBlank);
  console.log(`Ditemukan ${allExercises.length} soal tipe ini, ${needsMigration.length} masih format lama (bubbleLines).\n`);

  if (needsMigration.length === 0) {
    console.log("Gak ada yang perlu dimigrasi. Selesai.");
    return;
  }

  // Preview 3 contoh biar kamu bisa cek hasilnya masuk akal sebelum commit
  console.log("Contoh hasil konversi (3 pertama):");
  for (const ex of needsMigration.slice(0, 3)) {
    const lines = ex.content.bubbleLines;
    const combinedText = lines.map((l) => l.text).join(" ");
    const combinedLatin = lines.map((l) => l.latin).filter(Boolean).join(" ");
    console.log(`  "${combinedText}" (${combinedLatin || "-"}) → beforeBlank: "${combinedText}", afterBlank: "" `);
  }

  if (!commit) {
    console.log("\nMode preview — TIDAK ADA yang ditulis ke database. Tambahkan --commit buat menerapkan.");
    return;
  }

  console.log("\n--commit terdeteksi, mengonversi & menyimpan...");
  let done = 0;
  for (const ex of needsMigration) {
    const lines = ex.content.bubbleLines;
    const combinedText = lines.map((l) => l.text).join(" ");
    const combinedLatin = lines.map((l) => l.latin).filter(Boolean).join(" ");

    const newContent = {
      ...ex.content,
      beforeBlank: { text: combinedText, latin: combinedLatin || undefined },
      afterBlank: { text: "", latin: "" },
    };
    delete newContent.bubbleLines;

    const { error } = await supabase.from("exercises").update({ content: newContent }).eq("id", ex.id);
    if (error) { console.warn(`  ⚠ Gagal update exercise ${ex.id}:`, error.message); continue; }
    done++;
    if (done % 200 === 0) console.log(`  ...${done}/${needsMigration.length} selesai`);
  }
  console.log(`\n✓ Selesai. ${done} soal berhasil dikonversi ke format baru.`);
}

main().catch((err) => {
  console.error("Gagal:", err);
  process.exit(1);
});
