// File ini adalah "perantara" antara web React dan Notion.
// Versi ini pakai fetch langsung ke Notion API (tanpa SDK)
// supaya lebih stabil dan tidak tergantung versi package.

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = process.env.NOTION_DATABASE_ID;

  // Cek dulu apakah env variable terbaca
  if (!NOTION_TOKEN || !DATABASE_ID) {
    return res.status(500).json({
      error: 'Environment variable belum terbaca',
      hasToken: !!NOTION_TOKEN,
      hasDatabaseId: !!DATABASE_ID,
    });
  }

  try {
    // Step 1: Query database untuk dapat semua row
    const queryResponse = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );

    if (!queryResponse.ok) {
      const errText = await queryResponse.text();
      return res.status(500).json({
        error: 'Gagal query database',
        status: queryResponse.status,
        detail: errText,
      });
    }

    const queryData = await queryResponse.json();
    const lessons = [];

    // Step 2: Untuk setiap row, ambil isi kontennya
    for (const page of queryData.results) {
      const props = page.properties;

      const blocksResponse = await fetch(
        `https://api.notion.com/v1/blocks/${page.id}/children`,
        {
          headers: {
            'Authorization': `Bearer ${NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
          },
        }
      );

      let content = '';
      if (blocksResponse.ok) {
        const blocksData = await blocksResponse.json();
        for (const block of blocksData.results) {
          content += blockToMarkdown(block);
        }
      }

      lessons.push({
        id: page.id,
        title: props.Title?.title?.[0]?.plain_text || 'Tanpa Judul',
        course: props.Course?.select?.name || 'Umum',
        type: props.Type?.select?.name || 'lesson',
        videoId: props.VideoID?.rich_text?.[0]?.plain_text || '',
        catatan: props.Catatan?.rich_text?.[0]?.plain_text || '',
        content: content,
      });
    }

    res.status(200).json({ lessons });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};

function blockToMarkdown(block) {
  const type = block.type;
  const text = block[type]?.rich_text?.map((t) => {
    let txt = t.plain_text;
    if (t.annotations?.bold) txt = `**${txt}**`;
    return txt;
  }).join('') || '';

  switch (type) {
    case 'heading_1':
      return `# ${text}\n`;
    case 'heading_2':
      return `## ${text}\n`;
    case 'heading_3':
      return `### ${text}\n`;
    case 'paragraph':
      return `${text}\n\n`;
    case 'bulleted_list_item':
      return `• ${text}\n`;
    case 'numbered_list_item':
      return `${text}\n`;
    default:
      return text ? `${text}\n` : '';
  }
}
