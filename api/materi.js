// File ini adalah "perantara" antara web React dan Notion.
// Mengambil data database Notion beserta isi setiap halaman.
async function fetchAllBlocks(id, NOTION_TOKEN) {

  let results = [];
  let cursor = undefined;

  while (true) {

    let url = `https://api.notion.com/v1/blocks/${id}/children?page_size=100`;

    if (cursor) {
      url += `&start_cursor=${cursor}`;
    }


    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
      },
    });


    if (!response.ok) {
      throw new Error("Gagal mengambil blocks Notion");
    }
    const data = await response.json();


    results.push(...data.results);


    if (!data.has_more) {
      break;
    }


    cursor = data.next_cursor;
  }


  return results;
}

async function processBlocks(blocks, NOTION_TOKEN) {
  let content = "";
  let numberedCounter = 0;
 
  for (const block of blocks) {
    console.log(block.type);
 
    if (block.type === "numbered_list_item") {
      numberedCounter++;
 
      let text = block.numbered_list_item.rich_text
          .map((t) => {
            let txt = t.plain_text;
 
            if (t.annotations?.bold) txt = `**${txt}**`;
            if (t.annotations?.italic) txt = `*${txt}*`;
 
            return txt;
        })
        .join("");
 
      // Buang angka manual yang mungkin sudah diketik sendiri
      // di Notion (mis. "1. Islam" atau "1) Islam"), supaya
      // tidak dobel dengan nomor otomatis dari counter di bawah.
      text = text.replace(/^\s*\d+[.)]\s*/, "");
 
      content += `${numberedCounter}. ${text}\n`;
 
      // Kalau item ini punya sub-konten yang di-indent (children),
      // proses secara rekursif dengan scope counter baru.
      if (block.has_children) {
        const children = await fetchAllBlocks(block.id, NOTION_TOKEN);
        content += await processBlocks(children, NOTION_TOKEN);
      }
 
      continue;
    }
 
    // Sesuai perilaku Notion: paragraf & bulleted list biasa
    // (keterangan/rincian) TIDAK memutus urutan nomor. Tapi block
    // lain yang menandakan pemisah topik/section — divider,
    // heading, table, quote, dll — TETAP mereset nomor ke 0.
    if (block.type !== "paragraph" && block.type !== "bulleted_list_item") {
      numberedCounter = 0;
    }
 
    // ==========================
    // TABLE
    // ==========================
    if (block.type === "table") {
 
      const tableData = await fetchAllBlocks(block.id, NOTION_TOKEN);
 
      content += "TABLE_START\n";
 
      for (const row of tableData) {
        const cells = row.table_row.cells
          .map((cell) =>
            cell
              .map((text) => text.plain_text)
              .join("")
              // ganti newline asli (dari Shift+Enter di cell Notion)
              // dengan placeholder, supaya tidak memutus parsing
              // baris TABLE_ROW di frontend (yang split berdasarkan "\n")
              .replace(/\r\n|\r|\n/g, "\\n")
          )
          .join("|||");
 
        content += `TABLE_ROW:${cells}\n`;
      }
 
      content += "TABLE_END\n";
    } else {
      content += blockToMarkdown(block);
 
      // Block lain (paragraf, bulleted list, heading, dll) yang
      // punya children ter-indent — proses rekursif juga.
      if (block.has_children) {
        const children = await fetchAllBlocks(block.id, NOTION_TOKEN);
        content += await processBlocks(children, NOTION_TOKEN);
      }
    }
  }
 
  return content;
}
 
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
 
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;
 
  if (!NOTION_TOKEN || !DATABASE_ID) {
    return res.status(500).json({
      error: "Environment variable belum terbaca",
      hasToken: !!NOTION_TOKEN,
      hasDatabaseId: !!DATABASE_ID,
    });
  }

  // ==========================
  // MODE DEBUG (sementara):
  // Akses /api/materi?debug=raw&pageId=xxxx untuk lihat block
  // mentah dari satu page (termasuk field "has_children"),
  // tanpa diproses jadi content. Untuk keperluan diagnosa saja.
  // ==========================
  if (req.query && req.query.debug === "raw") {
    try {
      const targetPageId = req.query.pageId;
      if (!targetPageId) {
        return res.status(400).json({
          error: "Tambahkan ?pageId=xxxx di URL (ambil dari id lesson yang bermasalah)",
        });
      }
      const rawBlocks = await fetchAllBlocks(targetPageId, NOTION_TOKEN);
      return res.status(200).json({
        totalBlocks: rawBlocks.length,
        blocks: rawBlocks.map((b) => ({
          id: b.id,
          type: b.type,
          has_children: b.has_children,
          text:
            b[b.type]?.rich_text?.map((t) => t.plain_text).join("") || "",
        })),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
 
  try {
    // ==========================
    // STEP 1 - Query Database
    // ==========================
    const queryResponse = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sorts: [
            {
              property: "Order",
              direction: "ascending",
            },
          ],
        }),
      }
    );
 
    if (!queryResponse.ok) {
      const errText = await queryResponse.text();
      return res.status(500).json({
        error: "Gagal query database",
        status: queryResponse.status,
        detail: errText,
      });
    }
 
    const queryData = await queryResponse.json();
    const lessons = [];
 
    // ==========================
    // STEP 2 - Ambil isi tiap page
    // ==========================
    for (const page of queryData.results) {
      const props = page.properties;
 
      const blocksData = await fetchAllBlocks(
        page.id,
        NOTION_TOKEN
      );
 
      const content = await processBlocks(blocksData, NOTION_TOKEN);
 

      // ==========================
      // Simpan ke array lessons
      // ==========================
      lessons.push({
        id: page.id,

        title:
          props.Title?.title?.map((t) => t.plain_text).join("") ||
          "Tanpa Judul",

        course:
          props.Course?.select?.name ||
          props.Course?.multi_select?.map((x) => x.name).join(", ") ||
          "Tanpa Course",

        type: props.Type?.select?.name || "lesson",

        videoId: props.VideoID?.rich_text?.map((t) => t.plain_text).join("") || "",

        catatan: props.Catatan?.rich_text?.map((t) => t.plain_text).join("") || "",

        Thumbnail: props.Thumbnail?.url || "",

        order: props.Order?.number || 0,

        content,
      });
    }

    res.status(200).json({ lessons });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      stack: error.stack,
    });
  }
};

function blockToMarkdown(block) {
  const type = block.type;

  const text =
    block[type]?.rich_text
      ?.map((t) => {
        let txt = t.plain_text;

        if (t.annotations?.bold) txt = `**${txt}**`;
        if (t.annotations?.italic) txt = `*${txt}*`;

        return txt;
      })
      .join("") || "";

  switch (type) {
    case "heading_1":
      return `# ${text}\n\n`;

    case "heading_2":
      return `## ${text}\n\n`;

    case "heading_3":
      return `### ${text}\n\n`;

    case "heading_4":
      return `#### ${text}\n\n`;

    case "paragraph":
      return `${text}\n\n`;

    case "bulleted_list_item":
      return `• ${text}\n`;

    case "numbered_list_item":
      return "";

    case "quote":
      return `> ${text}\n\n`;

    case "divider":
      return `--------------------\n`;

    default:
      return text ? `${text}\n` : "";
  }
}