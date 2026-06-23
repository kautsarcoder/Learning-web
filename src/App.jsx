import { useState } from "react";

const courses = [
  {
    id: 1,
    title: "Pengantar Ilmu Ekonomi",
    description: "Dasar-dasar ekonomi mikro dan makro untuk pemula",
    emoji: "📊",
    lessons: [
      {
        id: 1,
        title: "Apa itu Ekonomi?",
        type: "lesson",
        content: `Ekonomi adalah ilmu yang mempelajari bagaimana manusia membuat keputusan dalam mengalokasikan sumber daya yang terbatas untuk memenuhi kebutuhan yang tidak terbatas.\n\nIlmu ekonomi terbagi menjadi dua cabang utama:\n\n**1. Ekonomi Mikro**\nMempelajari perilaku individu, rumah tangga, dan perusahaan dalam pengambilan keputusan ekonomi. Contoh: bagaimana konsumen menentukan pilihan, bagaimana perusahaan menetapkan harga.\n\n**2. Ekonomi Makro**\nMempelajari perekonomian secara keseluruhan. Contoh: inflasi, pengangguran, pertumbuhan ekonomi nasional.\n\n**Mengapa Belajar Ekonomi?**\nEkonomi membantu kita memahami dunia di sekitar kita — dari harga barang di pasar hingga kebijakan pemerintah.`,
        catatan: "Catat: Ekonomi = ilmu tentang pilihan dalam keterbatasan sumber daya.",
      },
      {
        id: 2,
        title: "Pengantar Ekonomi",
        type: "video",
        videoId: "3ez10ADR_gM",
        catatan: "Tonton video ini untuk pemahaman visual tentang konsep dasar ekonomi.",
      },
      {
        id: 3,
        title: "Permintaan & Penawaran",
        type: "lesson",
        content: `Hukum Permintaan dan Penawaran adalah inti dari ekonomi pasar.\n\n**Hukum Permintaan**\nJika harga suatu barang naik, maka jumlah yang diminta akan turun (ceteris paribus). Sebaliknya, jika harga turun, permintaan naik.\n\nContoh: Ketika harga bensin naik, orang cenderung mengurangi penggunaan kendaraan pribadi.\n\n**Hukum Penawaran**\nJika harga suatu barang naik, maka jumlah yang ditawarkan produsen akan naik. Karena produsen ingin mendapat keuntungan lebih besar.\n\n**Keseimbangan Pasar**\nHarga keseimbangan terjadi ketika jumlah yang diminta sama dengan jumlah yang ditawarkan. Di sinilah pasar bekerja secara efisien.`,
        catatan: "Ingat: Permintaan & harga berbanding TERBALIK. Penawaran & harga berbanding LURUS.",
      },
      {
        id: 4,
        title: "Kurva Permintaan & Penawaran",
        type: "video",
        videoId: "g9aDizJpd0s",
        catatan: "Video ini menjelaskan cara membaca kurva permintaan dan penawaran dengan mudah.",
      },
    ],
  },
  {
    id: 2,
    title: "Sirah Nabawiyah",
    description: "Sejarah kehidupan Nabi Muhammad SAW dan pelajaran dari sirahnya",
    emoji: "🕌",
    lessons: [
      {
        id: 1,
        title: "Kerajaan di Yaman",
        type: "lesson",
        content: `
Kita akan bagi menjadi 4 tahapan.
=================================

TAHAPAN PERTAMA: KEJAYAAN KERAJAAN SABA' (650 SM)

  Kerajaan Saba adalah kerajaan Arab tertua dan paling maju di Yaman dimana kota Sharawah sebagai ibu kotanya.Kerajaan ini dikenal dengan bendungannya yang bernama Ma'rib, bendungan ini mengairi sawah sehingga Yaman menjadi sangat subur.
Kerajaan Saba' makmur karena pertanian dan perdagangannya.

---------------------------------

TAHAPAN KEDUA: KERAJAAN SABA' (650 SM - 110 SM)

  Kerajaan Saba' mengalami beberapa perubahan seperti ibu kota yang dipindahkan ke daerah yang bernama Ma'rib.

---------------------------------

TAHAPAN KETIGA: KERAJAAN HIMYAR MENGAMBIL ALIH (115 - 300 SM)

  Kerajaan Saba' diambil alih oleh kabilah Himyar, kemudian mereka memindahkan ibu kota yang sebelumnya di Ma'rib menjadi Raidan (nama daerah di Yaman), kemudian dipindahkan lagi ke daerah yang bernama Raidan.

  Kemunduran mulai terjadi di masa ini yang sebabnya dimulai dari wilayah Hijaz (wilayah di Arab Saudi yang meliputi Mekkah, Madinah, Tabuk dsb) yang diambil alih
dan dikuasai oleh Bangsa Nabat, karena Hijaz merupakan jalur perdagangan. Awalnya barang dagang sampai di Yaman dan diteruskan ke Romawi melewati Hijaz sehingga Bangsa Nabat yang menguasainya memperoleh banyak keuntungan dan membuat posisi kerajaan Himyar di Yaman rugi dan melemah.

  Sebab kemunduran lainnya adalah ketika Kekaisaran Romawi menguasai Mesir dan laut merah, mereka memanfaatkan laut merah sebagai jalur perdagangan baru yang mengakibatkan Yaman tidak lagi menjadi jalur perdagangan.
`,
  },
  {
        id: 2,
        title: "Video version",
        type: "video",
        videoId: "zIbNJCSCEjk",
      },
    ],
  },
  {
    id: 3,
    title: "Ekonomi Islam (Syariah)",
    description: "Prinsip-prinsip ekonomi berbasis nilai Islam",
    emoji: "☪️",
    lessons: [
      {
        id: 1,
        title: "Prinsip Dasar Ekonomi Islam",
        type: "lesson",
        content: `Ekonomi Islam adalah sistem ekonomi yang berlandaskan nilai-nilai dan prinsip-prinsip Al-Quran dan Hadis.\n\n**Prinsip Utama:**\n\n**1. Larangan Riba**\nRiba (bunga) dilarang dalam Islam karena dianggap mengeksploitasi. Penggantinya adalah sistem bagi hasil seperti mudharabah dan musyarakah.\n\n**2. Larangan Gharar**\nGharar berarti ketidakpastian atau spekulasi berlebihan. Kontrak harus jelas dan transparan.\n\n**3. Larangan Maysir**\nMaysir adalah perjudian atau untung-untungan. Semua transaksi harus berbasis aset nyata.\n\n**4. Zakat**\nKewajiban menyisihkan sebagian harta untuk kaum yang membutuhkan. Ini adalah instrumen redistribusi kekayaan dalam Islam.\n\n**5. Takaful (Asuransi Islam)**\nSistem saling menanggung risiko bersama berdasarkan prinsip tabarru' (hibah/donasi) bukan premi komersial biasa.`,
        catatan: "Kunci: Ekonomi Islam bertujuan pada keadilan, bukan sekadar keuntungan.",
      },
      {
        id: 2,
        title: "Pengantar Ekonomi Syariah",
        type: "video",
        videoId: "VDnHkrQSeGw",
        catatan: "Video menjelaskan perbedaan mendasar antara ekonomi konvensional dan Islam.",
      },
    ],
  },
];

const feedbackData = [
  { name: "Andi", pesan: "Materinya mudah dipahami, terima kasih!", waktu: "2 hari lalu" },
  { name: "Sari", pesan: "Video-videonya sangat membantu belajar!", waktu: "5 hari lalu" },
];

export default function KelasNoteskey() {
  const [page, setPage] = useState("home");
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [showDonate, setShowDonate] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbacks, setFeedbacks] = useState(feedbackData);
  const [search, setSearch] = useState("");
  const [exploreOpen, setExploreOpen] = useState(false);

  const openCourse = (course) => {
    setActiveCourse(course);
    setActiveLesson(course.lessons[0]);
    setPage("course");
    setExploreOpen(false);
  };

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const submitFeedback = () => {
    if (feedbackMsg.trim() && feedbackName.trim()) {
      setFeedbacks([{ name: feedbackName, pesan: feedbackMsg, waktu: "Baru saja" }, ...feedbacks]);
      setFeedbackMsg("");
      setFeedbackName("");
    }
  };

  const styles = {
    root: {
      fontFamily: "'Georgia', 'Times New Roman', serif",
      minHeight: "100vh",
      background: "#FAFAF7",
      color: "#1a1a1a",
    },
    navbar: {
      background: "#1C2B4A",
      padding: "0 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 60,
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    },
    navLogo: {
      color: "#E8D5A3",
      fontSize: 20,
      fontWeight: "bold",
      letterSpacing: 1,
      cursor: "pointer",
      fontStyle: "italic",
    },
    navRight: {
      display: "flex",
      alignItems: "center",
      gap: 12,
    },
    navBtn: {
      background: "transparent",
      border: "1.5px solid #E8D5A3",
      color: "#E8D5A3",
      padding: "6px 16px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13,
      fontFamily: "inherit",
      transition: "all 0.2s",
    },
    exploreBtn: {
      background: "#E8D5A3",
      border: "none",
      color: "#1C2B4A",
      padding: "6px 16px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13,
      fontWeight: "bold",
      fontFamily: "inherit",
      position: "relative",
    },
    dropdown: {
      position: "absolute",
      top: 68,
      left: 20,
      background: "white",
      border: "1px solid #e0e0e0",
      borderRadius: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      zIndex: 200,
      minWidth: 280,
      overflow: "hidden",
    },
    dropdownItem: {
      padding: "14px 18px",
      cursor: "pointer",
      borderBottom: "1px solid #f0f0f0",
      display: "flex",
      alignItems: "center",
      gap: 12,
      transition: "background 0.15s",
    },
    hero: {
      background: "linear-gradient(135deg, #1C2B4A 0%, #2D4A7A 60%, #1C2B4A 100%)",
      color: "white",
      padding: "80px 40px",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
    },
    heroTitle: {
      fontSize: 48,
      fontWeight: "bold",
      marginBottom: 16,
      fontStyle: "italic",
      color: "#E8D5A3",
      letterSpacing: 2,
    },
    heroSub: {
      fontSize: 18,
      color: "#B8C9E0",
      maxWidth: 500,
      margin: "0 auto 32px",
      lineHeight: 1.6,
    },
    heroBtn: {
      background: "#E8D5A3",
      color: "#1C2B4A",
      border: "none",
      padding: "14px 36px",
      borderRadius: 8,
      fontSize: 16,
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: "inherit",
      letterSpacing: 0.5,
    },
    section: {
      padding: "48px 40px",
      maxWidth: 1100,
      margin: "0 auto",
    },
    sectionTitle: {
      fontSize: 26,
      fontWeight: "bold",
      marginBottom: 8,
      color: "#1C2B4A",
    },
    sectionSub: {
      color: "#666",
      marginBottom: 32,
      fontSize: 15,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      gap: 24,
    },
    card: {
      background: "white",
      border: "1px solid #E8E8E0",
      borderRadius: 12,
      padding: 24,
      cursor: "pointer",
      transition: "all 0.2s",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    },
    cardEmoji: {
      fontSize: 36,
      marginBottom: 12,
    },
    cardTitle: {
      fontSize: 17,
      fontWeight: "bold",
      color: "#1C2B4A",
      marginBottom: 8,
    },
    cardDesc: {
      fontSize: 14,
      color: "#666",
      lineHeight: 1.5,
      marginBottom: 16,
    },
    cardBtn: {
      background: "#1C2B4A",
      color: "#E8D5A3",
      border: "none",
      padding: "8px 18px",
      borderRadius: 6,
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
      fontWeight: "bold",
    },
    courseLayout: {
      display: "flex",
      minHeight: "calc(100vh - 60px)",
    },
    sidebar: {
      width: 240,
      background: "#1C2B4A",
      color: "white",
      padding: "24px 0",
      flexShrink: 0,
      overflowY: "auto",
    },
    sidebarTitle: {
      padding: "0 20px 16px",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      fontSize: 14,
      fontWeight: "bold",
      color: "#E8D5A3",
      lineHeight: 1.4,
    },
    lessonItem: {
      padding: "12px 20px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 13,
      borderLeft: "3px solid transparent",
      transition: "all 0.15s",
    },
    lessonItemActive: {
      background: "rgba(232,213,163,0.15)",
      borderLeft: "3px solid #E8D5A3",
      color: "#E8D5A3",
    },
    mainContent: {
      flex: 1,
      padding: 32,
      overflowY: "auto",
    },
    videoWrapper: {
      position: "relative",
      paddingBottom: "56.25%",
      height: 0,
      borderRadius: 12,
      overflow: "hidden",
      marginBottom: 24,
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    },
    videoIframe: {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      border: "none",
    },
    noteBox: {
      background: "#FFFBF0",
      border: "1px solid #E8D5A3",
      borderLeft: "4px solid #E8D5A3",
      borderRadius: 8,
      padding: "16px 20px",
      marginTop: 24,
    },
    noteTitle: {
      fontSize: 12,
      fontWeight: "bold",
      color: "#1C2B4A",
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    noteText: {
      fontSize: 14,
      color: "#555",
      lineHeight: 1.6,
    },
    contentText: {
      fontSize: 15,
      lineHeight: 1.8,
      color: "#333",
      whiteSpace: "pre-line",
    },
    contentTitle: {
      fontSize: 22,
      fontWeight: "bold",
      color: "#1C2B4A",
      marginBottom: 20,
      paddingBottom: 12,
      borderBottom: "2px solid #E8D5A3",
    },
    modal: {
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 500,
    },
    modalBox: {
      background: "white",
      borderRadius: 16,
      padding: 36,
      maxWidth: 420,
      width: "90%",
      boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#1C2B4A",
      marginBottom: 16,
    },
    input: {
      width: "100%",
      padding: "10px 14px",
      border: "1px solid #ddd",
      borderRadius: 8,
      fontSize: 14,
      fontFamily: "inherit",
      marginBottom: 12,
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      padding: "10px 14px",
      border: "1px solid #ddd",
      borderRadius: 8,
      fontSize: 14,
      fontFamily: "inherit",
      marginBottom: 12,
      boxSizing: "border-box",
      minHeight: 100,
      resize: "vertical",
    },
    submitBtn: {
      background: "#1C2B4A",
      color: "#E8D5A3",
      border: "none",
      padding: "10px 24px",
      borderRadius: 8,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
      fontWeight: "bold",
      marginRight: 10,
    },
    cancelBtn: {
      background: "#f0f0f0",
      color: "#555",
      border: "none",
      padding: "10px 24px",
      borderRadius: 8,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    feedbackCard: {
      background: "#f9f9f9",
      border: "1px solid #eee",
      borderRadius: 10,
      padding: "14px 18px",
      marginBottom: 12,
    },
    searchBar: {
      display: "flex",
      alignItems: "center",
      background: "white",
      border: "1.5px solid #1C2B4A",
      borderRadius: 8,
      padding: "8px 14px",
      gap: 8,
      marginBottom: 28,
      maxWidth: 400,
    },
    searchInput: {
      border: "none",
      outline: "none",
      fontSize: 14,
      fontFamily: "inherit",
      width: "100%",
    },
    tag: {
      display: "inline-block",
      background: "#EDF2FF",
      color: "#1C2B4A",
      fontSize: 11,
      padding: "3px 10px",
      borderRadius: 20,
      marginRight: 6,
      fontWeight: "bold",
    },
    footer: {
      background: "#1C2B4A",
      color: "#B8C9E0",
      textAlign: "center",
      padding: "24px",
      fontSize: 13,
    },
  };

  const renderHome = () => (
    <div>
      {/* Hero */}
      <div style={styles.hero}>
        <div style={{ fontSize: 14, color: "#E8D5A3", letterSpacing: 3, marginBottom: 12, textTransform: "uppercase" }}>
          Platform Belajar Ekonomi
        </div>
        <div style={styles.heroTitle}>Kelas Notesters</div>
        <div style={styles.heroSub}>
          Belajar ekonomi dengan cara yang menyenangkan — materi terstruktur, video, dan catatan ringkas.
        </div>
        <button style={styles.heroBtn} onClick={() => setExploreOpen(true)}>
          Mulai Belajar →
        </button>
      </div>

      {/* Courses */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Kelas Tersedia</div>
        <div style={styles.sectionSub}>Pilih kelas yang ingin kamu pelajari hari ini</div>

        {/* Search */}
        <div style={styles.searchBar}>
          <span>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Cari kelas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={styles.grid}>
          {filteredCourses.map((course) => (
            <div
              key={course.id}
              style={styles.card}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
              }}
            >
              <div style={styles.cardEmoji}>{course.emoji}</div>
              <div style={styles.cardTitle}>{course.title}</div>
              <div style={styles.cardDesc}>{course.description}</div>
              <div style={{ marginBottom: 16 }}>
                <span style={styles.tag}>{course.lessons.length} Pelajaran</span>
                <span style={styles.tag}>
                  {course.lessons.filter((l) => l.type === "video").length} Video
                </span>
              </div>
              <button style={styles.cardBtn} onClick={() => openCourse(course)}>
                Buka Kelas →
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Feedback Section */}
      <div style={{ ...styles.section, background: "#F4F1E8", borderRadius: 16, marginBottom: 40 }}>
        <div style={styles.sectionTitle}>Kritik & Saran</div>
        <div style={styles.sectionSub}>Bantu kami berkembang dengan masukan kamu</div>
        <button
          style={{ ...styles.cardBtn, marginBottom: 24 }}
          onClick={() => setShowFeedback(true)}
        >
          + Tulis Kritik & Saran
        </button>
        {feedbacks.map((f, i) => (
          <div key={i} style={styles.feedbackCard}>
            <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>
              {f.name} <span style={{ color: "#aaa", fontWeight: "normal", fontSize: 12 }}>· {f.waktu}</span>
            </div>
            <div style={{ fontSize: 14, color: "#444" }}>{f.pesan}</div>
          </div>
        ))}
      </div>

      <div style={styles.footer}>
        <div style={{ marginBottom: 6, fontStyle: "italic", color: "#E8D5A3", fontSize: 15 }}>
          Kelas Notesters
        </div>
        Platform belajar ekonomi gratis untuk semua. Dukung kami dengan donasi.
      </div>
    </div>
  );

  const renderCourse = () => (
    <div style={styles.courseLayout}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>
          {activeCourse.emoji} {activeCourse.title}
        </div>
        {activeCourse.lessons.map((lesson) => (
          <div
            key={lesson.id}
            style={{
              ...styles.lessonItem,
              ...(activeLesson?.id === lesson.id ? styles.lessonItemActive : {}),
            }}
            onClick={() => setActiveLesson(lesson)}
          >
            <span>{lesson.type === "video" ? "▶" : "📄"}</span>
            <span>{lesson.title}</span>
          </div>
        ))}
        <div style={{ padding: "20px 20px 0", marginTop: 12 }}>
          <button
            style={{ ...styles.navBtn, width: "100%", fontSize: 12 }}
            onClick={() => setPage("home")}
          >
            ← Kembali
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={styles.mainContent}>
        {activeLesson && (
          <>
            <div style={styles.contentTitle}>{activeLesson.title}</div>

            {activeLesson.type === "video" ? (
              <>
                <div style={styles.videoWrapper}>
                  <iframe
                    style={styles.videoIframe}
                    src={`https://www.youtube.com/embed/${activeLesson.videoId}`}
                    title={activeLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              </>
            ) : (
              <div style={styles.contentText}>
                {activeLesson.content.split("**").map((part, i) =>
                  i % 2 === 1 ? (
                    <strong key={i} style={{ color: "#1C2B4A" }}>
                      {part}
                    </strong>
                  ) : (
                    <span key={i}>{part}</span>
                  )
                )}
              </div>
            )}

            {activeLesson.catatan && (
              <div style={styles.noteBox}>
                <div style={styles.noteTitle}>📝 Catatan</div>
                <div style={styles.noteText}>{activeLesson.catatan}</div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: "flex", gap: 12, marginTop: 32 }}>
              {activeCourse.lessons.findIndex((l) => l.id === activeLesson.id) > 0 && (
                <button
                  style={styles.cancelBtn}
                  onClick={() => {
                    const idx = activeCourse.lessons.findIndex((l) => l.id === activeLesson.id);
                    setActiveLesson(activeCourse.lessons[idx - 1]);
                  }}
                >
                  ← Sebelumnya
                </button>
              )}
              {activeCourse.lessons.findIndex((l) => l.id === activeLesson.id) <
                activeCourse.lessons.length - 1 && (
                <button
                  style={styles.submitBtn}
                  onClick={() => {
                    const idx = activeCourse.lessons.findIndex((l) => l.id === activeLesson.id);
                    setActiveLesson(activeCourse.lessons[idx + 1]);
                  }}
                >
                  Selanjutnya →
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div style={styles.root}>
      {/* Navbar */}
      <div style={styles.navbar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <button style={styles.exploreBtn} onClick={() => setExploreOpen(!exploreOpen)}>
              Explore ▾
            </button>
            {exploreOpen && (
              <div style={styles.dropdown}>
                {courses.map((c) => (
                  <div
                    key={c.id}
                    style={styles.dropdownItem}
                    onClick={() => openCourse(c)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "white")}
                  >
                    <span style={{ fontSize: 24 }}>{c.emoji}</span>
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 14 }}>{c.title}</div>
                      <div style={{ fontSize: 12, color: "#888" }}>{c.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={styles.navLogo}
          onClick={() => { setPage("home"); setExploreOpen(false); }}
        >
          Kelas Notesters
        </div>

        <div style={styles.navRight}>
          <button style={styles.navBtn} onClick={() => setShowFeedback(true)}>
            Kritik & Saran
          </button>
          <button
            style={{ ...styles.navBtn, background: "#E8D5A3", color: "#1C2B4A", border: "none", fontWeight: "bold" }}
            onClick={() => setShowDonate(true)}
          >
            Donate ♥
          </button>
        </div>
      </div>

      {/* Pages */}
      {page === "home" && renderHome()}
      {page === "course" && renderCourse()}

      {/* Donate Modal */}
      {showDonate && (
        <div style={styles.modal} onClick={() => setShowDonate(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>♥ Dukung Kelas Notesters</div>
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Platform ini gratis untuk semua. Donasi kamu membantu kami terus membuat konten berkualitas dan menjaga platform tetap berjalan.
            </p>
            <div style={{ background: "#f5f5f5", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Transfer ke</div>
              <div style={{ fontWeight: "bold", fontSize: 16, color: "#1C2B4A" }}>BCA: 1234567890</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>a.n. Kelas Notesters</div>
            </div>
            <button style={styles.submitBtn} onClick={() => setShowDonate(false)}>
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <div style={styles.modal} onClick={() => setShowFeedback(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>💬 Kritik & Saran</div>
            <input
              style={styles.input}
              placeholder="Nama kamu"
              value={feedbackName}
              onChange={(e) => setFeedbackName(e.target.value)}
            />
            <textarea
              style={styles.textarea}
              placeholder="Tulis kritik atau saran kamu di sini..."
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
            />
            <div>
              <button
                style={styles.submitBtn}
                onClick={() => { submitFeedback(); setShowFeedback(false); }}
              >
                Kirim
              </button>
              <button style={styles.cancelBtn} onClick={() => setShowFeedback(false)}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
