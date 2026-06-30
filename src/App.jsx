import { useState, useEffect } from "react";
import emailjs from '@emailjs/browser';


const fallbackCourses = [
  {
    id: 1,
    title: "Pengantar Ilmu Ekonomi",
    description: "Dasar-dasar ekonomi mikro dan makro untuk pemula",
    thumbnail: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80",
    lessons: [
      {
        id: 1,
        title: "Apa itu Ekonomi?",
        type: "lesson",
        content: `# Apa itu Ekonomi?

Ekonomi adalah ilmu yang mempelajari bagaimana manusia membuat keputusan dalam mengalokasikan sumber daya yang terbatas untuk memenuhi kebutuhan yang tidak terbatas.

## Cabang Utama Ilmu Ekonomi

### 1. Ekonomi Mikro
Mempelajari perilaku individu, rumah tangga, dan perusahaan dalam pengambilan keputusan ekonomi. Contoh: bagaimana konsumen menentukan pilihan, bagaimana perusahaan menetapkan harga.

### 2. Ekonomi Makro
Mempelajari perekonomian secara keseluruhan. Contoh: inflasi, pengangguran, pertumbuhan ekonomi nasional.

## Mengapa Belajar Ekonomi?

Ekonomi membantu kita memahami dunia di sekitar kita — dari harga barang di pasar hingga kebijakan pemerintah. Dengan memahami ekonomi, kita bisa membuat keputusan yang lebih baik dalam kehidupan sehari-hari.

**Ingat:** Inti dari ekonomi adalah bagaimana kita membuat pilihan terbaik dengan sumber daya yang terbatas.`,
        catatan: "Ekonomi = ilmu tentang pilihan dalam keterbatasan sumber daya.",
      },
      {
        id: 2,
        title: "Video version",
        type: "video",
        videoId: "3ez10ADR_gM",
        catatan: "Tonton video ini untuk pemahaman visual tentang konsep dasar ekonomi.",
      },
      {
        id: 3,
        title: "Permintaan & Penawaran",
        type: "lesson",
        content: `# Permintaan & Penawaran

Hukum Permintaan dan Penawaran adalah inti dari ekonomi pasar.

## Hukum Permintaan

Jika harga suatu barang **naik**, maka jumlah yang diminta akan **turun** (ceteris paribus). Sebaliknya, jika harga turun, permintaan naik.

### Contoh Nyata
Ketika harga bensin naik, orang cenderung mengurangi penggunaan kendaraan pribadi dan beralih ke transportasi umum.

## Hukum Penawaran

Jika harga suatu barang **naik**, maka jumlah yang ditawarkan produsen akan **naik**. Karena produsen ingin mendapat keuntungan lebih besar.

## Keseimbangan Pasar

Harga keseimbangan terjadi ketika jumlah yang diminta sama dengan jumlah yang ditawarkan. Di sinilah pasar bekerja secara efisien.

**Ingat:** Permintaan & harga berbanding TERBALIK. Penawaran & harga berbanding LURUS.`,
        catatan: "Permintaan & harga berbanding TERBALIK. Penawaran & harga berbanding LURUS.",
      },
      {
        id: 4,
        title: "Video version",
        type: "video",
        videoId: "g9aDizJpd0s",
        catatan: "Video ini menjelaskan cara membaca kurva permintaan dan penawaran.",
      },
    ],
  },
  {
    id: 2,
    title: "Inflasi & Kebijakan Moneter",
    description: "Memahami inflasi, uang, dan peran bank sentral",
    thumbnail: "siasah.png",
    lessons: [
      {
        id: 1,
        title: "Apa itu Inflasi?",
        type: "lesson",
        content: `# Apa itu Inflasi?

Inflasi adalah kenaikan harga barang dan jasa secara umum dan terus-menerus dalam jangka waktu tertentu.

## Jenis-jenis Inflasi

### Inflasi Ringan (< 10%/tahun)
Masih terkendali, bahkan bisa mendorong pertumbuhan ekonomi.

### Inflasi Sedang (10-30%/tahun)
Menurunkan daya beli masyarakat secara signifikan.

### Inflasi Berat (30-100%/tahun)
Sangat merusak perekonomian dan kesejahteraan masyarakat.

### Hiperinflasi (> 100%/tahun)
Kondisi ekstrem. Contoh: Zimbabwe 2008.

## Penyebab Inflasi

**1. Terlalu banyak uang beredar** — Bank sentral mencetak terlalu banyak uang

**2. Demand-Pull** — Permintaan melebihi penawaran

**3. Cost-Push** — Kenaikan biaya produksi

## Dampak Inflasi

Inflasi menurunkan nilai uang. Jika inflasi 10%, maka uang Rp 100.000 tahun ini hanya memiliki daya beli Rp 90.909 tahun depan.`,
        catatan: "Target inflasi Bank Indonesia biasanya 2-4% per tahun.",
      },
      {
        id: 2,
        title: "Video version",
        type: "video",
        videoId: "zIbNJCSCEjk",
        catatan: "Video penjelasan inflasi dengan analogi sederhana.",
      },
    ],
  },
  {
    id: 3,
    title: "Ekonomi Islam",
    description: "Prinsip-prinsip ekonomi berbasis nilai Islam",
    thumbnail: "https://images.unsplash.com/photo-1585036156171-384164a8c675?w=400&q=80",
    lessons: [
      {
        id: 1,
        title: "Prinsip Dasar Ekonomi Islam",
        type: "lesson",
        content: `# Prinsip Dasar Ekonomi Islam

Ekonomi Islam adalah sistem ekonomi yang berlandaskan nilai-nilai Al-Quran dan Hadis Nabi Muhammad SAW.

## Prinsip-Prinsip Utama

### 1. Larangan Riba
Riba (bunga) dilarang dalam Islam karena dianggap mengeksploitasi. Penggantinya adalah sistem bagi hasil seperti **mudharabah** dan **musyarakah**.

### 2. Larangan Gharar
Gharar berarti ketidakpastian atau spekulasi berlebihan. Kontrak harus jelas dan transparan.

### 3. Larangan Maysir
Maysir adalah perjudian atau untung-untungan. Semua transaksi harus berbasis aset nyata.

### 4. Zakat
Kewajiban menyisihkan sebagian harta untuk kaum yang membutuhkan. Ini adalah instrumen redistribusi kekayaan dalam Islam.

### 5. Takaful
Sistem saling menanggung risiko bersama berdasarkan prinsip **tabarru'** (hibah/donasi).

## Tujuan Ekonomi Islam

**Falah** — kesejahteraan dunia dan akhirat. Ekonomi Islam tidak hanya mengejar keuntungan materi, tetapi juga keadilan sosial dan keberkahan.`,
        catatan: "Kunci: Ekonomi Islam bertujuan pada keadilan dan falah, bukan sekadar keuntungan.",
      },
      {
        id: 2,
        title: "Video version",
        type: "video",
        videoId: "VDnHkrQSeGw",
        catatan: "Video menjelaskan perbedaan ekonomi konvensional dan Islam.",
      },
    ],
  },
  {
    id: 4,
    title: "Sirah Nabawiyah",
    description: "Sejarah kehidupan Nabi Muhammad SAW",
    thumbnail: "sirah.png",
    lessons: [
      {
        id: 1,
        title: "Sejarah di Yaman",
        type: "lesson",
        content: `# Sejarah singkat kerajaan di Yaman
Terbagi menjadi empat tahapan sejarah

## Tahapan pertama : Kejayaan kerajaan Saba’ (650 SM)

Kerajaan Saba adalah kerajaan Arab tertua dan paling maju di Yaman dimana kota Sharawah sebagai ibu kotanya. Kerajaan ini dikenal dengan bendungannya yang bernama ma’rib, bendungan ini mengairi sawah 
sehingga Yaman menjadi sangat subur. Kerajaan Saba’ makmur karena pertanian dan perdagangannya.

## Tahapan kedua : Kerajaan Saba’ (650 SM - 110 SM)

kerajaan saba’ mengalami beberapa perubahan seperti ibu kota yang dipindahkan ke daerah yang bernama Ma’rib 

## Tahapan ketiga : kabilah Himyar mengambil alih (115 - 300 SM)
Kerajaan Saba’ diambil alih oleh kabilah Himyar, kemudian mereka memindahkan ibu kota yang sebelumnya di Ma’rib menjadi Raidan (nama daerah di Yaman), kemudian dipindahkan lagi ke daerah yang bernama 
Raidan.

mulai terjadi kemunduran di masa ini yang sebabnya dimulai dari wilayah Hijaz (wilayah di Arab Saudi yang meliputi Mekkah, Madinah, Tabuk dsb) yang diambil alih dan dikuasai oleh Bangsa Nabat, karena 
Hijaz merupakan jalur perdagangan. Awalnya barang dagang sampai di Yaman dan diteruskan ke Romawi melewati Hijaz sehingga Bangsa Nabat yang menguasainya memperoleh banyak keuntungan dan membuat posisi 
kerajaan  di Yaman rugi dan melemah.

Sebab kemunduran lainnya adalah ketika Kekaisaran Romawi menguasai Mesir dan laut merah, mereka memanfaatkan laut merah sebagai jalur perdagangan baru yang mengakibatkan Yaman tidak lagi menjadi jalur 
perdagangan.

Sebab lainnya adalah persaingan antar kabilah yang mengakibatkan perpecahan internal kerajaan dan membuat sebagian kabilah pindah ke wilayah lain di jazirah arab.

## Tahapan keempat: Perebutan wilayah Yaman (300 M sampai Islam)

  sejak awal 300 M Yaman dipenuhi dengan keributan, persaingan antar kabilah dan revolusi sehingga hal ini menjadi peluang bagi bangsa lain untuk merebut wilayah Yaman. Bangsa Romawi mulai menguasai 
wilayah bernama Adn di Yaman, wilayah ini adalah pelabuhan di ujung selatan Yaman. Pada awal tahun 340 M, Bangsa Habasyah (Ethiopia sekarang) yang merupakan sekutu bangsa Romawi menyerbu Yaman, dibantu 
oleh Romawi hingga tahun 378 M . Setelah itu Yaman berhasil mendapatkan kemerdekaanya lagi, tetapi setelahnya terjadi musibah besar. Bendungan Ma’rib yang menjadi sumber kehidupan Yaman jebol yang 
mengakibatkan banjir, ekonomi hancur dan banyak penduduknya yang pindah ke wilayah lain.

  Pada tahun 523 M Penguasa Yaman saat itu adalah Dhu Nuwas, seorang raja dari kabilah Himyar yang menganut agama Yahudi. Dhu Nuwas memimpin pasukannya menyerang orang - orang masehi (para pengikut agama 
isa al -masih) yang beragama Nasrani di kota Najran (kota di Arab Saudi sekarang)  dan memaksa mereka meninggalkan agama mereka. Karena mereka menolak, Dhu Nuwas kemudian membuat parit-parit besar yang 
didalamnya dinyalakan api dan melempar orang - orang Nasrani kedalamnya. Peristiwa ini dikenal dalam Al-Qur’an sebagai kisah Ashabul Ukhdud (para penghuni parit) dalam Surah Al-Buruj.Peristiwa ini juga 
membuat Bangsa Romawi marah (karena mereka juga beragama Nasrani) dan ingin membalas pembantaian itu dan sekaligus memperluas pengaruh di Yaman. Romawi meminta bantuan orang - orang Habasyah untuk menyerang 
Yaman, Habasyah mengirim 70.000 tentara yang dipimpin oleh Ariyath seorang panglima militer Habasyah dan mereka berhasil mengalahkan Dhu Nuwas, menguasai Yaman untuk kedua kalinya pada tahun 525 M.
Kemudian terjadi konfik internal Habasyah antara Ariyath dan Abraha (bawahan Ariyath) hingga Ariyath dibunuh oleh Abraha. Abraha kemudian menjadi gubernur Yaman setelah mendapat persetujuan raja Habasyah.
Abraha yang menjadi Gubernur ingin menjadikan gereja besarnya di Sana’ah (nama daerah di Yaman sekarang ibu kota Yaman) sebagai pusat ibadah sehingga orang tidak lagi pergi ke Ka’bah untuk beribadah.
Ketika usahanya gagal, ia membawa pasukan besar yang disertai gajah untuk menghancurkan Ka’bah. Namun Allah menghancurkan pasukannya dengan burung-burung yang melempar batu kecil, sebagaimana dikisahkan dalam 
Surah Al-Fil. Peristiwa ini terjadi pada Tahun Gajah, yaitu tahun kelahiran Nabi Muhammad ﷺ (sekitar 570 M). Setelah dijajah Habasyah cukup lama, orang-orang Yaman tidak suka lagi kepada penguasa Habasyah. 
Mereka meminta bantuan kepada orang-orang Persia (sekarang Iran), mereka bekerjasama untuk mengusir orang-orang Habasyah dari Yaman. Pada tahun 575 M, dipimpin oleh Ma’di Yakrib bin Saif Dzi Yazan Al - Himyari
Yaman kembali mendapatkan kemerdekaannya. Ma’di Yakrib kemudian diangkat menjadi raja. Selama Ma’di Yakrib masih menjadi Raja, ia mempertahankan beberapa orang-orang Habasyah untuk menjadi pengawal. Suatu hari 
para pengawal itu berhasil membunuhnya sehingga keluarganya tidak lagi berkuasa. Setelah meninggalnya Ma’di Yakrib, raja Persia (Kisra) tidak mengangkat raja Arab lagi. Sebaliknya, ia mengirim gubernur-gubernur 
Persia untuk memerintah Yaman secara langsung, dengan begitu Yaman menjadi salah satu wilayah kekuasaan Persia. Silih bergantinya pemimpin Persi di Yaman dan terakhir Yaman dipimpin oleh gubernur yang bernama 
Badzan. Badzan kemudian memeluk islam pada tahun 638 M. Dengan masuk islamnya Badzan, kekuasaan Persia di Yaman berakhir dan Yaman bergabung dengan negara islam tanpa peperangan besar.
`,
        catatan: "-",
      },
      {
        id: 2,
        title: "Video version",
        type: "video",
        videoId: "dQw4w9WgXcQ",
        catatan: "Video tentang kelahiran dan masa kecil Nabi Muhammad SAW.",
      },
    ],
  },
  {
    id: 5,
    title: "Islamic Insurance",
    description: "Takaful dan prinsip asuransi syariah",
    thumbnail: "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=400&q=80",
    lessons: [
      {
        id: 1,
        title: "Apa itu Takaful?",
        type: "lesson",
        content: `# Apa itu Takaful?

Takaful adalah sistem asuransi Islam yang berdasarkan prinsip **ta'awun** (tolong-menolong) dan **tabarru'** (hibah/donasi).

## Perbedaan Takaful dan Asuransi Konvensional

### Asuransi Konvensional
Peserta membayar **premi** kepada perusahaan. Perusahaan mendapat keuntungan dari selisih premi dan klaim.

### Takaful
Peserta menyumbangkan **kontribusi** ke dana bersama (tabarru'). Dana ini digunakan untuk membantu peserta yang terkena musibah.

## Model Takaful

**1. Mudharabah** — Keuntungan investasi dibagi antara peserta dan operator

**2. Wakalah** — Operator bertindak sebagai wakil peserta, mendapat fee tetap

**3. Waqf** — Model berbasis wakaf

## Dasar Hukum

Takaful berlandaskan Al-Quran Surah Al-Maidah ayat 2: *"Dan tolong-menolonglah kamu dalam kebajikan dan takwa."*`,
        catatan: "Takaful = asuransi berbasis tolong-menolong, bukan untung-rugi komersial.",
      },
      {
        id: 2,
        title: "Video version",
        type: "video",
        videoId: "3ez10ADR_gM",
        catatan: "Video penjelasan sistem takaful dan perbedaannya dengan asuransi konvensional.",
      },
    ],
  },
  {
    id: 6,
    title: "Kebijakan Moneter Islam",
    description: "Uang dan kebijakan moneter dalam perspektif Islam",
    thumbnail: "https://images.unsplash.com/photo-1554260570-83dc2f46ef79?w=400&q=80",
    lessons: [
      {
        id: 1,
        title: "Konsep Uang dalam Islam",
        type: "lesson",
        content: `# Konsep Uang dalam Islam

Dalam Islam, uang dipandang sebagai **alat tukar** (medium of exchange), bukan komoditas yang bisa diperdagangkan untuk menghasilkan keuntungan semata.

## Fungsi Uang dalam Islam

### 1. Alat Tukar
Uang memudahkan pertukaran barang dan jasa dalam perekonomian.

### 2. Satuan Hitung
Uang digunakan untuk mengukur nilai barang dan jasa.

### 3. Penyimpan Nilai
Uang dapat menyimpan daya beli untuk digunakan di masa depan.

## Larangan Riba dalam Transaksi Uang

Islam melarang **riba al-fadl** (kelebihan dalam pertukaran barang sejenis) dan **riba al-nasi'ah** (tambahan karena penundaan pembayaran).

## Kebijakan Moneter Islami

**Tujuan utama:** Stabilitas nilai uang dan pertumbuhan ekonomi yang adil dan merata.

**Instrumen:** Tidak menggunakan suku bunga, melainkan menggunakan instrumen berbasis bagi hasil seperti **Sertifikat Bank Indonesia Syariah (SBIS)**.`,
        catatan: "Dalam Islam, uang adalah alat, bukan tujuan. Tidak boleh 'mengembangbiakkan' uang dengan riba.",
      },
      {
        id: 2,
        title: "Video version",
        type: "video",
        videoId: "zIbNJCSCEjk",
        catatan: "Video tentang konsep uang dan kebijakan moneter dalam perspektif Islam.",
      },
    ],
  },
];

// Mengubah data flat dari Notion (per-lesson) jadi struktur per-course
function groupLessonsByCourse(lessons) {
  const grouped = {};
  lessons.forEach((lesson) => {
    if (!grouped[lesson.course]) {
      grouped[lesson.course] = {
        id: lesson.course,
        title: lesson.course,
        description: "",
        thumbnail: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&q=80",
        lessons: [],
      };
    }
    grouped[lesson.course].lessons.push({
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      videoId: lesson.videoId,
      catatan: lesson.catatan,
      content: lesson.content,
    });
  });
  return Object.values(grouped);
}

// Render konten dengan markdown sederhana
function renderContent(content) {
  return content.split("\n").map((line, i) => {
    if (line.startsWith("# ")) {
      return (
        <div key={i} style={{ fontSize: 26, fontWeight: "bold", color: "#1a1a1a", marginTop: 0, marginBottom: 8, paddingBottom: 8, borderBottom: "2px solid #7BAE9B" }}>
          {line.replace("# ", "")}
        </div>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <div key={i} style={{ fontSize: 18, fontWeight: "bold", color: "#2d5a4e", marginTop: 20, marginBottom: 6 }}>
          {line.replace("## ", "")}
        </div>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <div key={i} style={{ fontSize: 15, fontWeight: "bold", color: "#1a1a1a", marginTop: 14, marginBottom: 4 }}>
          {line.replace("### ", "")}
        </div>
      );
    }
    if (line.trim() === "") {
      return <div key={i} style={{ height: 8 }} />;
    }
    const parts = line.split("**");
    return (
      <div key={i} style={{ marginBottom: 4, lineHeight: 1.8, fontSize: 14, color: "#333" }}>
        {parts.map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} style={{ color: "#1a1a1a" }}>{part}</strong>
          ) : (
            <span key={j}>{part}</span>
          )
        )}
      </div>
    );
  });
}

export default function KelasNotesters() {
  const [page, setPage] = useState("home");
  const [courses, setCourses] = useState(fallbackCourses);
  const [loadingMateri, setLoadingMateri] = useState(true);
  const [activeCourse, setActiveCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [showDonate, setShowDonate] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMsg, setContactMsg] = useState("");

  // Ambil materi dari Notion saat web pertama kali dibuka
  useEffect(() => {
    fetch("/api/materi")
      .then((res) => res.json())
      .then((data) => {
        if (data.lessons && data.lessons.length > 0) {
          setCourses(groupLessonsByCourse(data.lessons));
        }
        setLoadingMateri(false);
      })
      .catch(() => {
        // Kalau gagal fetch (misal: offline atau belum setup), pakai data contoh
        setLoadingMateri(false);
      });
  }, []);

  const openCourse = (course) => {
    setActiveCourse(course);
    setActiveLesson(course.lessons[0]);
    setPage("course");
    setSidebarOpen(false);
  };

  const goHome = () => {
    setPage("home");
    setSidebarOpen(false);
  };

  const goExplore = () => {
    setPage("explore");
    setSidebarOpen(false);
  };

  const submitContact = () => {
    if (!contactName.trim() || !contactEmail.trim() || !contactMsg.trim()) {
        alert("Mohon isi semua kolom terlebih dahulu.");
        return;
      }
      setContactSending(true);
      emailjs.send(
        'service_noteskey',
        'template_z4bedwg',
        {
          name: contactName,
          email: contactEmail,
          message: contactMsg,
          title: "LearningSpace by Noteskey",
        },
        '0KyhWRhvLRanJLeOf'
      )
      .then(() => {
        setContactSending(false);
        setContactSuccess(true);
        setContactName("");
        setContactEmail("");
        setContactMsg("");
      })
      .catch(() => {
        setContactSending(false);
        alert("Gagal mengirim pesan. Coba lagi.");
      });
    };

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.description.toLowerCase().includes(search.toLowerCase())
  );

  // WARNA
  const GREEN = "#7BAE9B";
  const GREEN_DARK = "#5a8a79";
  const GREEN_BG = "#e8f0ee";

  const s = {
    root: { fontFamily: "'Segoe UI', Arial, sans-serif", minHeight: "100vh", background: "#f5f5f5", color: "#1a1a1a" },

    // NAVBAR
    navbar: {
      background: GREEN,
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 56,
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    navLogo: { color: "white", fontSize: 20, fontWeight: "bold", cursor: "pointer", lineHeight: 1 },
    navLogoSub: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "normal" },
    navLinks: { display: "flex", alignItems: "center", gap: 4 },
    navLink: {
      color: "white",
      background: "transparent",
      border: "none",
      padding: "6px 14px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13,
      fontFamily: "inherit",
    },
    navLinkActive: {
      color: GREEN,
      background: "white",
      border: "none",
      padding: "6px 14px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13,
      fontFamily: "inherit",
      fontWeight: "bold",
    },

    // HERO
    hero: {
      background: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url("background.png")`,
      backgroundSize: "cover",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      padding: "40px 24px",
      position: "relative",
      overflow: "hidden",
    },
    heroTag: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "bold", letterSpacing: 2, marginBottom: 12, textTransform: "uppercase" },
    heroTitle: { color: "white", fontSize: "clamp(36px, 8vw, 60px)", fontWeight: "bold", marginBottom: 4, lineHeight: 1.1 },
    heroTitleSub: { color: "rgba(255,255,255,0.85)", fontSize: "clamp(13px, 2vw, 16px)", fontWeight: "bold", marginBottom: 16, letterSpacing: 1 },
    heroDesc: { color: "rgba(255,255,255,0.9)", fontSize: "clamp(14px, 2.5vw, 16px)", maxWidth: 520, lineHeight: 1.7, marginBottom: 32 },
    heroBtn: {
      background: "#1a1a1a",
      color: "white",
      border: "none",
      padding: "14px 40px",
      borderRadius: 8,
      fontSize: 15,
      fontWeight: "bold",
      cursor: "pointer",
      fontFamily: "inherit",
    },

    // FOOTER
    footer: {
      background: GREEN,
      color: "white",
      padding: "28px 40px",
      display: "flex",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 20,
    },
    footerLeft: { fontSize: 13 },
    footerRight: { display: "flex", flexDirection: "column", gap: 6 },
    footerLink: { color: "rgba(255,255,255,0.85)", fontSize: 13, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", textAlign: "right" },

    // EXPLORE
    exploreSection: { padding: "40px 24px", maxWidth: 1000, margin: "0 auto" },
    exploreTitle: { fontSize: 26, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
    searchWrap: {
      display: "flex",
      alignItems: "center",
      background: "white",
      border: "1px solid #ddd",
      borderRadius: 20,
      padding: "8px 16px",
      maxWidth: 360,
      margin: "0 auto 32px",
      gap: 8,
    },
    searchInput: { border: "none", outline: "none", fontSize: 14, fontFamily: "inherit", width: "100%", background: "transparent" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20 },
    courseCard: { background: "white", borderRadius: 10, overflow: "hidden", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" },
    courseThumb: { width: "100%", height: 160, objectFit: "cover", background: GREEN_BG, display: "block" },
    courseCardBody: { padding: "12px 14px" },
    courseCardTitle: { fontSize: 14, fontWeight: "bold", color: "#1a1a1a", marginBottom: 4 },
    courseCardDesc: { fontSize: 12, color: "#777", lineHeight: 1.5 },

    // COURSE
    courseLayout: { display: "flex", minHeight: "calc(100vh - 56px)", position: "relative" },
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.35)", zIndex: 250 },
    sidebar: {
      width: 240,
      background: "white",
      borderRight: "1px solid #e0e0e0",
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
    sidebarTitle: { padding: "0 16px 12px", borderBottom: "1px solid #eee", fontSize: 14, fontWeight: "bold", color: "#1a1a1a", lineHeight: 1.4 },
    lessonItem: {
      padding: "10px 16px",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 10,
      fontSize: 13,
      color: "#444",
      borderLeft: "3px solid transparent",
    },
    lessonItemActive: { background: GREEN_BG, borderLeft: `3px solid ${GREEN}`, color: GREEN_DARK, fontWeight: "bold" },
    lessonDivider: { height: 1, background: "#f0f0f0", margin: "4px 16px" },
    toggleBtn: {
      position: "fixed",
      top: 66,
      left: 10,
      zIndex: 200,
      background: "white",
      color: "#1a1a1a",
      border: "1px solid #ddd",
      borderRadius: 8,
      padding: "7px 12px",
      cursor: "pointer",
      fontSize: 18,
      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    },
    mainContent: { flex: 1, padding: "24px 20px 40px", paddingTop: 60, maxWidth: "100%", overflowY: "auto" },
    contentTitle: { fontSize: "clamp(18px, 4vw, 26px)", fontWeight: "bold", color: "#1a1a1a", marginBottom: 4, paddingBottom: 10, borderBottom: `2px solid ${GREEN}` },
    contentSubTitle: { fontSize: 15, fontWeight: "bold", color: "#555", marginBottom: 20, paddingBottom: 10, borderBottom: "1px solid #eee" },
    videoWrapper: { position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden", marginBottom: 20, background: "#e0e0e0" },
    videoIframe: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" },
    noteBox: { background: GREEN_BG, border: `1px solid ${GREEN}`, borderLeft: `4px solid ${GREEN}`, borderRadius: 8, padding: "12px 16px", marginTop: 20 },
    noteTitle: { fontSize: 11, fontWeight: "bold", color: GREEN_DARK, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
    noteText: { fontSize: 13, color: "#444", lineHeight: 1.6 },
    navBtns: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 },
    prevBtn: { background: "white", color: "#1a1a1a", border: "1px solid #ddd", padding: "10px 20px", borderRadius: 50, fontSize: 18, cursor: "pointer" },
    nextBtn: { background: "white", color: "#1a1a1a", border: "1px solid #ddd", padding: "10px 20px", borderRadius: 50, fontSize: 18, cursor: "pointer" },
    backBtn: { background: "white", color: "#555", border: "1px solid #ddd", padding: "7px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit", margin: "16px 16px 0" },

    // CONTACT PAGE
    contactPage: { maxWidth: 520, margin: "40px auto", padding: "0 20px" },
    contactTitle: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
    contactDesc: { fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 28 },
    contactSection: { fontSize: 16, fontWeight: "bold", marginBottom: 16 },
    formRow: { display: "flex", gap: 12, marginBottom: 12 },
    formInput: { flex: 1, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "inherit", outline: "none" },
    formTextarea: { width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "inherit", minHeight: 100, resize: "vertical", boxSizing: "border-box", outline: "none" },
    submitBtn: { background: "#1a1a1a", color: "white", border: "none", padding: "12px", width: "100%", borderRadius: 6, fontSize: 14, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit", marginTop: 12 },

    // MODAL
    modal: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 16 },
    modalBox: { background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380 },
    modalTitle: { fontSize: 18, fontWeight: "bold", color: "#1a1a1a", marginBottom: 14 },
  };

  const renderNavbar = () => (
    <div style={s.navbar}>
      <div style={{ cursor: "pointer" }} onClick={goHome}>
        <div style={s.navLogo}>LearningSpace</div>
        <div style={s.navLogoSub}>by Noteskey</div>
      </div>
      <div style={s.navLinks}>
        <button style={page === "home" ? s.navLinkActive : s.navLink} onClick={goHome}>Home</button>
        <button style={page === "explore" || page === "course" ? s.navLinkActive : s.navLink} onClick={goExplore}>Explore</button>
        <button style={s.navLink} onClick={() => setShowDonate(true)}>Donate</button>
        <button style={page === "contact" ? s.navLinkActive : s.navLink} onClick={() => setPage("contact")}>Contact Us</button>
      </div>
    </div>
  );

  const renderFooter = () => (
    <div style={s.footer}>
      <div style={s.footerLeft}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>Our social Media</div>
        <div style={{ display: "flex", gap: 8 }}>
          <a
            href="https://youtube.com/@noteskey?si=8m9rWk59J66TGPAa"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.2)", padding: "5px 12px", borderRadius: 6, color: "white", textDecoration: "none", fontSize: 13 }}
          >
            ▶ YouTube
          </a>
          <a
            href="https://www.instagram.com/islamneconomic.id?igsh=cjBqNWwwajB1NzBo&utm_source=qr"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.2)", padding: "5px 12px", borderRadius: 6, color: "white", textDecoration: "none", fontSize: 13 }}
          >
            ◉ Instagram
          </a>
        </div>
      </div>
      <div style={s.footerRight}>
        <button style={s.footerLink} onClick={goHome}>Home</button>
        <button style={s.footerLink} onClick={goExplore}>Explore</button>
        <button style={s.footerLink} onClick={() => setShowDonate(true)}>Donate</button>
        <button style={s.footerLink} onClick={() => setPage("contact")}>Contact Us</button>
      </div>
    </div>
  );

  const renderHome = () => (
    <div>
      <div style={s.hero}>
        <div style={s.heroTag}>Learning Web</div>
        <div style={s.heroTitle}>LearningSpace</div>
        <div style={s.heroTitleSub}>by Noteskey</div>
        <div style={{ fontWeight: "bold", color: "white", fontSize: 16, marginBottom: 12 }}>Education for Everyone</div>
        <div style={s.heroDesc}>
          A free learning platform that provides educational resources for everyone, anywhere. Our mission is to make knowledge accessible, empower lifelong learning and help people grow without barriers.
        </div>
        <button style={s.heroBtn} onClick={goExplore}>Let's roll</button>
      </div>
      {renderFooter()}
    </div>
  );

  const renderExplore = () => (
    <div>
      <div style={s.exploreSection}>
        <div style={s.exploreTitle}>Explore the subjects</div>
        <div style={s.searchWrap}>
          <span style={{ color: "#aaa" }}>🔍</span>
          <input style={s.searchInput} placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div style={s.grid}>
          {filteredCourses.map((course) => (
            <div key={course.id} style={s.courseCard} onClick={() => openCourse(course)}>
              <img src={course.thumbnail} alt={course.title} style={s.courseThumb} onError={(e) => { e.target.style.background = GREEN_BG; e.target.src = ""; }} />
              <div style={s.courseCardBody}>
                <div style={s.courseCardTitle}>{course.title}</div>
                <div style={s.courseCardDesc}>{course.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {renderFooter()}
    </div>
  );

  const renderCourse = () => {
    const lessonIdx = activeCourse.lessons.findIndex((l) => l.id === activeLesson.id);
    return (
      <div style={s.courseLayout}>
        {sidebarOpen && <div style={s.overlay} onClick={() => setSidebarOpen(false)} />}

        <div style={s.sidebar}>
          <div style={s.sidebarTitle}>≡ &nbsp;{activeCourse.title}</div>
          {activeCourse.lessons.map((lesson, idx) => (
            <div key={lesson.id}>
              <div
                style={{ ...s.lessonItem, ...(activeLesson?.id === lesson.id ? s.lessonItemActive : {}) }}
                onClick={() => { setActiveLesson(lesson); setSidebarOpen(false); }}
              >
                <span>{lesson.type === "video" ? "🎬" : "📖"}</span>
                <span>{lesson.title}</span>
              </div>
              {lesson.type === "video" && idx < activeCourse.lessons.length - 1 && (
                <div style={s.lessonDivider} />
              )}
            </div>
          ))}
          <button style={s.backBtn} onClick={() => { setPage("explore"); setSidebarOpen(false); }}>Back</button>
        </div>

        <button style={s.toggleBtn} onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? "✕" : "≡"}
        </button>

        <div style={s.mainContent}>
          {activeLesson && (
            <>
              <div style={s.contentTitle}>{activeCourse.title.split(" ")[0]} {activeCourse.title.split(" ").slice(1).join(" ")}</div>
              <div style={s.contentSubTitle}>{activeLesson.title}</div>

              {activeLesson.type === "video" ? (
                <div style={s.videoWrapper}>
                  <iframe
                    style={s.videoIframe}
                    src={`https://www.youtube.com/embed/${activeLesson.videoId}`}
                    title={activeLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div>{renderContent(activeLesson.content)}</div>
              )}

              {activeLesson.catatan && (
                <div style={s.noteBox}>
                  <div style={s.noteTitle}>📝 Catatan</div>
                  <div style={s.noteText}>{activeLesson.catatan}</div>
                </div>
              )}

              <div style={s.navBtns}>
                <div>
                  {lessonIdx > 0 && (
                    <button style={s.prevBtn} onClick={() => setActiveLesson(activeCourse.lessons[lessonIdx - 1])}>←</button>
                  )}
                </div>
                <div>
                  {lessonIdx < activeCourse.lessons.length - 1 && (
                    <button style={s.nextBtn} onClick={() => setActiveLesson(activeCourse.lessons[lessonIdx + 1])}>→</button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderContact = () => (
    <div>
      <div style={s.contactPage}>
        <div style={s.contactTitle}>Get in touch with Us</div>
        <div style={s.contactDesc}>
          We welcome feedback that helps us improve the learning experience. If you had questions, suggestions, or ideas, send us a message and we'll do our best to respond within a few business days.
        </div>
        {contactSuccess ? (
          <div style={{ background: "#e8f5e9", border: "1px solid #81c784", borderRadius: 10, padding: "24px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: "#2e7d32", marginBottom: 8 }}>Pesan Terkirim!</div>
            <div style={{ fontSize: 14, color: "#555", marginBottom: 16 }}>Terima kasih, kami akan segera merespons pesanmu.</div>
            <button style={{ ...s.submitBtn, width: "auto", padding: "10px 24px" }} onClick={() => setContactSuccess(false)}>
              Kirim Pesan Lain
            </button>
          </div>
        ) : (
          <>
            <div style={s.contactSection}>Contact Us</div>
            <div style={s.formRow}>
              <input style={s.formInput} placeholder="Nama kamu" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <input style={{ ...s.formInput, width: "100%", marginBottom: 12, boxSizing: "border-box" }} placeholder="Email address" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <textarea style={s.formTextarea} placeholder="Enter your question or message" value={contactMsg} onChange={(e) => setContactMsg(e.target.value)} />
            <button style={{ ...s.submitBtn, opacity: contactSending ? 0.7 : 1 }} onClick={submitContact} disabled={contactSending}>
              {contactSending ? "Mengirim..." : "Submit"}
            </button>
          </>
        )}
      </div>
      {renderFooter()}
    </div>
  );
  return (
  <div style={s.root}>
    {renderNavbar()}
    {page === "home" && renderHome()}
    {page === "explore" && renderExplore()}
    {page === "course" && renderCourse()}
    {page === "contact" && renderContact()}

    {/* Modal Donate */}
    {showDonate && (
      <div style={s.modal} onClick={() => setShowDonate(false)}>
        <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
          <div style={s.modalTitle}>Support LearningSpace</div>

          <p
            style={{
              color: "#555",
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: 18,
            }}
          >
            Platform ini gratis untuk semua. Donasi kamu membantu kami terus
            membuat konten berkualitas.
          </p>

          <div
            style={{
              background: "#f5f5f5",
              borderRadius: 10,
              padding: 16,
              marginBottom: 18,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: "bold",
                marginBottom: 12,
              }}
            >
              Scan QRIS untuk Donasi
            </div>

            <img
              src="/qris.jpeg"
              alt="QRIS"
              style={{
                width: "250px",
                maxWidth: "100%",
                borderRadius: "8px",
              }}
            />

            <div
              style={{
                fontSize: 12,
                color: "#666",
                marginTop: 10,
              }}
            >
              Scan menggunakan aplikasi e-wallet atau mobile banking.
            </div>
          </div>

          <button
            style={{ ...s.submitBtn, marginTop: 0 }}
            onClick={() => setShowDonate(false)}
          >
            Tutup
          </button>
        </div>
      </div>
    )}
  </div>
);
}
