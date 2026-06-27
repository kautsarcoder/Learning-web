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
        content: `Hukum Permintaan dan Penawaran adalah inti dari ekonomi pasar.\n\n**Hukum Permintaan**\nJika harga suatu barang naik, maka jumlah yang diminta akan turun (ceteris paribus). Sebaliknya, jika harga turun, permintaan naik.\n\nContoh: Ketika harga bensin naik, orang cenderung mengurangi penggunaan kendaraan pribadi.\n\n**Hukum Penawaran**\nJika harga suatu barang naik, maka jumlah yang ditawarkan produsen akan naik. Karena produsen ingin mendapat keuntungan lebih besar.\n\n**Keseimbangan Pasar**\nHarga keseimbangan terjadi ketika jumlah yang diminta sama dengan jumlah yang ditawarkan.`,
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
        content: `Ekonomi Islam adalah sistem ekonomi yang berlandaskan nilai-nilai Al-Quran dan Hadis.\n\n**Prinsip Utama:**\n\n**1. Larangan Riba**\nRiba (bunga) dilarang dalam Islam. Penggantinya adalah sistem bagi hasil seperti mudharabah dan musyarakah.\n\n**2. Larangan Gharar**\nGharar berarti ketidakpastian berlebihan. Kontrak harus jelas dan transparan.\n\n**3. Larangan Maysir**\nMaysir adalah perjudian. Semua transaksi harus berbasis aset nyata.\n\n**4. Zakat**\nKewajiban menyisihkan sebagian harta untuk kaum yang membutuhkan.\n\n**5. Takaful (Asuransi Islam)**\nSistem saling menanggung risiko bersama berdasarkan prinsip tabarru'.`,
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
]

export default function KelasNotesters() {
  const [page, setPage] = useState("home");
  const [showCourses, setShowCourses] = useState(false);
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [showDonate, setShowDonate] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [search, setSearch] = useState("");
  const [exploreOpen, setExploreOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const openCourse = (course) => {
    setActiveCourse(course);
    setActiveLesson(course.lessons[0]);
    setPage("course");
    setExploreOpen(false);
    setSidebarOpen(false);
  };

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  const submitFeedback = () => {
    if (feedbackMsg.trim() && feedbackName.trim() && feedbackEmail.trim()) {
      const subject = encodeURIComponent(`Kritik & Saran dari ${feedbackName}`);
      const body = encodeURIComponent(
        `Nama: ${feedbackName}\nEmail: ${feedbackEmail}\n\nPesan:\n${feedbackMsg}`
      );
      window.open(`mailto:EMAILKAMU@gmail.com?subject=${subject}&body=${body}`);
      setFeedbackMsg("");
      setFeedbackName("");
      setFeedbackEmail("");
      setShowFeedback(false);
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
      padding: "0 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 56,
      position: "sticky",
      top: 0,
      zIndex: 100,
      boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
    },
    navLogo: {
      color: "#E8D5A3",
      fontSize: 18,
      fontWeight: "bold",
      cursor: "pointer",
      fontStyle: "italic",
      letterSpacing: 1,
    },
    navRight: {
      display: "flex",
      alignItems: "center",
      gap: 8,
    },
    navBtn: {
      background: "transparent",
      border: "1.5px solid #E8D5A3",
      color: "#E8D5A3",
      padding: "5px 12px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 12,
      fontFamily: "inherit",
    },
    exploreBtn: {
      background: "#E8D5A3",
      border: "none",
      color: "#1C2B4A",
      padding: "5px 12px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 12,
      fontWeight: "bold",
      fontFamily: "inherit",
      position: "relative",
    },
    donateBtn: {
      background: "#E8D5A3",
      color: "#1C2B4A",
      border: "none",
      padding: "5px 12px",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: "inherit",
    },
    dropdown: {
      position: "absolute",
      top: 60,
      left: 0,
      background: "white",
      border: "1px solid #e0e0e0",
      borderRadius: 10,
      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
      zIndex: 200,
      minWidth: 260,
      overflow: "hidden",
    },
    dropdownItem: {
      padding: "12px 16px",
      cursor: "pointer",
      borderBottom: "1px solid #f0f0f0",
      display: "flex",
      alignItems: "center",
      gap: 10,
    },
    // HOME
    hero: {
      background: "linear-gradient(135deg, #1C2B4A 0%, #2D4A7A 60%, #1C2B4A 100%)",
      color: "white",
      padding: "60px 24px",
      textAlign: "center",
      minHeight: showCourses ? "auto" : "calc(100vh - 56px)",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
    },
    heroTitle: {
      fontSize: "clamp(32px, 8vw, 52px)",
      fontWeight: "bold",
      marginBottom: 12,
      fontStyle: "italic",
      color: "#E8D5A3",
      letterSpacing: 2,
    },
    heroSub: {
      fontSize: "clamp(14px, 3vw, 18px)",
      color: "#B8C9E0",
      maxWidth: 480,
      margin: "0 auto 32px",
      lineHeight: 1.7,
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
    },
    section: {
      padding: "40px 20px",
      maxWidth: 1000,
      margin: "0 auto",
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 6,
      color: "#1C2B4A",
    },
    sectionSub: {
      color: "#666",
      marginBottom: 24,
      fontSize: 14,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      gap: 20,
    },
    card: {
      background: "white",
      border: "1px solid #E8E8E0",
      borderRadius: 12,
      padding: 20,
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    },
    cardEmoji: { fontSize: 32, marginBottom: 10 },
    cardTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: "#1C2B4A",
      marginBottom: 6,
    },
    cardDesc: {
      fontSize: 13,
      color: "#666",
      lineHeight: 1.5,
      marginBottom: 14,
    },
    cardBtn: {
      background: "#1C2B4A",
      color: "#E8D5A3",
      border: "none",
      padding: "8px 16px",
      borderRadius: 6,
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
      fontWeight: "bold",
    },
    tag: {
      display: "inline-block",
      background: "#EDF2FF",
      color: "#1C2B4A",
      fontSize: 11,
      padding: "3px 8px",
      borderRadius: 20,
      marginRight: 6,
      fontWeight: "bold",
    },
    // COURSE LAYOUT
    courseLayout: {
      display: "flex",
      minHeight: "calc(100vh - 56px)",
      position: "relative",
    },
    overlay: {
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.4)",
      zIndex: 250,
    },
    sidebar: {
      width: 240,
      background: "#1C2B4A",
      color: "white",
      padding: "16px 0",
      position: "fixed",
      top: 56,
      left: 0,
      height: "calc(100vh - 56px)",
      overflowY: "auto",
      zIndex: 300,
      transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
      transition: "transform 0.3s ease",
    },
    sidebarTitle: {
      padding: "0 16px 14px",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      fontSize: 13,
      fontWeight: "bold",
      color: "#E8D5A3",
      lineHeight: 1.4,
    },
    lessonItem: {
      padding: "11px 16px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      borderLeft: "3px solid transparent",
    },
    lessonItemActive: {
      background: "rgba(232,213,163,0.15)",
      borderLeft: "3px solid #E8D5A3",
      color: "#E8D5A3",
    },
    toggleBtn: {
      position: "fixed",
      top: 66,
      left: 10,
      zIndex: 200,
      background: "#1C2B4A",
      color: "#E8D5A3",
      border: "none",
      borderRadius: 8,
      padding: "8px 12px",
      cursor: "pointer",
      fontSize: 18,
      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    },
    mainContent: {
      flex: 1,
      padding: "20px 16px 40px",
      paddingTop: 56,
      overflowY: "auto",
      maxWidth: "100%",
    },
    contentTitle: {
      fontSize: "clamp(18px, 4vw, 24px)",
      fontWeight: "bold",
      color: "#1C2B4A",
      marginBottom: 18,
      paddingBottom: 12,
      borderBottom: "2px solid #E8D5A3",
    },
    videoWrapper: {
      position: "relative",
      paddingBottom: "56.25%",
      height: 0,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 20,
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
    },
    videoIframe: {
      position: "absolute",
      top: 0, left: 0,
      width: "100%", height: "100%",
      border: "none",
    },
    noteBox: {
      background: "#FFFBF0",
      border: "1px solid #E8D5A3",
      borderLeft: "4px solid #E8D5A3",
      borderRadius: 8,
      padding: "14px 16px",
      marginTop: 20,
    },
    noteTitle: {
      fontSize: 11,
      fontWeight: "bold",
      color: "#1C2B4A",
      marginBottom: 6,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    noteText: { fontSize: 13, color: "#555", lineHeight: 1.6 },
    contentText: {
      fontSize: 14,
      lineHeight: 1.8,
      color: "#333",
      whiteSpace: "pre-line",
    },
    navButtons: {
      display: "flex",
      gap: 10,
      marginTop: 28,
      flexWrap: "wrap",
    },
    // MODAL
    modal: {
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 500,
      padding: 16,
    },
    modalBox: {
      background: "white",
      borderRadius: 16,
      padding: 28,
      width: "100%",
      maxWidth: 400,
      boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "#1C2B4A",
      marginBottom: 14,
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #ddd",
      borderRadius: 8,
      fontSize: 14,
      fontFamily: "inherit",
      marginBottom: 10,
      boxSizing: "border-box",
    },
    textarea: {
      width: "100%",
      padding: "10px 12px",
      border: "1px solid #ddd",
      borderRadius: 8,
      fontSize: 14,
      fontFamily: "inherit",
      marginBottom: 10,
      boxSizing: "border-box",
      minHeight: 90,
      resize: "vertical",
    },
    submitBtn: {
      background: "#1C2B4A",
      color: "#E8D5A3",
      border: "none",
      padding: "10px 22px",
      borderRadius: 8,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
      fontWeight: "bold",
      marginRight: 8,
    },
    cancelBtn: {
      background: "#f0f0f0",
      color: "#555",
      border: "none",
      padding: "10px 22px",
      borderRadius: 8,
      fontSize: 14,
      cursor: "pointer",
      fontFamily: "inherit",
    },
    searchBar: {
      display: "flex",
      alignItems: "center",
      background: "white",
      border: "1.5px solid #1C2B4A",
      borderRadius: 8,
      padding: "8px 12px",
      gap: 8,
      marginBottom: 24,
      maxWidth: 360,
    },
    searchInput: {
      border: "none",
      outline: "none",
      fontSize: 14,
      fontFamily: "inherit",
      width: "100%",
      background: "transparent",
    },
    footer: {
      background: "#1C2B4A",
      color: "#B8C9E0",
      textAlign: "center",
      padding: "20px",
      fontSize: 12,
    },
  };

  const renderHome = () => (
    <div>
      {/* Hero — full screen kalau belum klik mulai belajar */}
      <div style={styles.hero}>
        <div style={{ fontSize: 12, color: "#E8D5A3", letterSpacing: 3, marginBottom: 10, textTransform: "uppercase" }}>
          Platform Belajar Ekonomi
        </div>
        <div style={styles.heroTitle}>Kelas Notesters</div>
        <div style={styles.heroSub}>
          Belajar ekonomi dengan cara yang menyenangkan — materi terstruktur, video, dan catatan ringkas.
        </div>
        {!showCourses && (
          <button style={styles.heroBtn} onClick={() => setShowCourses(true)}>
            Mulai Belajar →
          </button>
        )}
      </div>

      {/* Daftar Kelas — muncul setelah klik Mulai Belajar */}
      {showCourses && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Kelas Tersedia</div>
          <div style={styles.sectionSub}>Pilih kelas yang ingin kamu pelajari hari ini</div>

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
              <div key={course.id} style={styles.card}>
                <div style={styles.cardEmoji}>{course.emoji}</div>
                <div style={styles.cardTitle}>{course.title}</div>
                <div style={styles.cardDesc}>{course.description}</div>
                <div style={{ marginBottom: 14 }}>
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
      )}

      <div style={styles.footer}>
        <div style={{ marginBottom: 4, fontStyle: "italic", color: "#E8D5A3", fontSize: 14 }}>
          Kelas Notesters
        </div>
        Platform belajar ekonomi gratis untuk semua.
      </div>
    </div>
  );

  const renderCourse = () => (
    <div style={styles.courseLayout}>

      {/* Overlay gelap kalau sidebar terbuka di mobile */}
      {sidebarOpen && (
        <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

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
            onClick={() => {
              setActiveLesson(lesson);
              setSidebarOpen(false);
            }}
          >
            <span>{lesson.type === "video" ? "▶" : "📄"}</span>
            <span>{lesson.title}</span>
          </div>
        ))}
        <div style={{ padding: "16px 16px 0" }}>
          <button
            style={{ ...styles.cancelBtn, width: "100%", fontSize: 12 }}
            onClick={() => { setPage("home"); setSidebarOpen(false); }}
          >
            ← Kembali
          </button>
        </div>
      </div>

      {/* Tombol toggle sidebar */}
      <button style={styles.toggleBtn} onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Konten Utama */}
      <div style={styles.mainContent}>
        {activeLesson && (
          <>
            <div style={styles.contentTitle}>{activeLesson.title}</div>

            {activeLesson.type === "video" ? (
              <div style={styles.videoWrapper}>
                <iframe
                  style={styles.videoIframe}
                  src={`https://www.youtube.com/embed/${activeLesson.videoId}`}
                  title={activeLesson.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div style={styles.contentText}>
                {activeLesson.content.split("**").map((part, i) =>
                  i % 2 === 1 ? (
                    <strong key={i} style={{ color: "#1C2B4A" }}>{part}</strong>
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

            {/* Navigasi Pelajaran */}
            <div style={styles.navButtons}>
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
                >
                  <span style={{ fontSize: 22 }}>{c.emoji}</span>
                  <div>
                    <div style={{ fontWeight: "bold", fontSize: 13 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{c.description}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          style={styles.navLogo}
          onClick={() => { setPage("home"); setExploreOpen(false); setSidebarOpen(false); }}
        >
          Kelas Notesters
        </div>

        <div style={styles.navRight}>
          <button style={styles.navBtn} onClick={() => setShowFeedback(true)}>
            Kritik & Saran
          </button>
          <button style={styles.donateBtn} onClick={() => setShowDonate(true)}>
            Donate ♥
          </button>
        </div>
      </div>

      {/* Halaman */}
      {page === "home" && renderHome()}
      {page === "course" && renderCourse()}

      {/* Modal Donate */}
      {showDonate && (
        <div style={styles.modal} onClick={() => setShowDonate(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>♥ Dukung Kelas Notesters</div>
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
              Platform ini gratis untuk semua. Donasi kamu membantu kami terus membuat konten berkualitas.
            </p>
            <div style={{ background: "#f5f5f5", borderRadius: 10, padding: 14, marginBottom: 18, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Transfer ke</div>
              <div style={{ fontWeight: "bold", fontSize: 16, color: "#1C2B4A" }}>BCA: 1234567890</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>a.n. Kelas Notesters</div>
            </div>
            <button style={styles.submitBtn} onClick={() => setShowDonate(false)}>Tutup</button>
          </div>
        </div>
      )}

      {/* Modal Kritik & Saran */}
      {showFeedback && (
        <div style={styles.modal} onClick={() => setShowFeedback(false)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>💬 Kritik & Saran</div>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 14 }}>
              Pesanmu akan dikirim langsung ke email kami.
            </p>
            <input
              style={styles.input}
              placeholder="Nama kamu"
              value={feedbackName}
              onChange={(e) => setFeedbackName(e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Email kamu"
              type="email"
              value={feedbackEmail}
              onChange={(e) => setFeedbackEmail(e.target.value)}
            />
            <textarea
              style={styles.textarea}
              placeholder="Tulis kritik atau saran kamu di sini..."
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
            />
            <div>
              <button style={styles.submitBtn} onClick={submitFeedback}>
                Kirim via Email
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
