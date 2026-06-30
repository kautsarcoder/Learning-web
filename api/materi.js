// File ini adalah "perantara" antara web React dan Notion.
// Ini berjalan di server Vercel, bukan di browser, jadi token aman.

const { Client } = require('@notionhq/client');

module.exports = async (req, res) => {
  // Izinkan akses dari mana saja (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    const databaseId = process.env.NOTION_DATABASE_ID;

    // Ambil semua baris dari database Notion
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    const lessons = [];

    for (const page of response.results) {
      const props = page.properties;

      // Ambil isi konten lengkap dari halaman (block-block teks)
      const blocks = await notion.blocks.children.list({
        block_id: page.id,
      });

      let content = '';
      for (const block of blocks.results) {
        content += blockToMarkdown(block);
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
    res.status(500).json({ error: error.message });
  }
};

// Mengubah block Notion jadi format markdown sederhana (#, ##, **bold**)
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
