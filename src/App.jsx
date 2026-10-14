import React, { useState, useEffect, useRef } from "react";
import emailjs from '@emailjs/browser';
import { createClient } from "@supabase/supabase-js";
import "./App.css";
import WordOrderBoard from "./WordOrderBoard";
import { sfx, SoundToggle, fxCardClass, CountUp, Celebrate } from "./fx";
import SubjectLanguage, { fetchResumeSummary, Icon, IconTile, Ring, LangSwitch, InstagramLogo, YouTubeLogo } from "./SubjectLanguage";

// Client Supabase buat browser (pakai anon/publishable key — aman dipakai
// di frontend, beda dari service_role key yang cuma boleh di server/api).
// Project ini Create React App, jadi env var HARUS diawali "REACT_APP_"
// dan dibaca lewat process.env (bukan import.meta.env — itu punya Vite).
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true, // sesi disimpan di localStorage — tetap login walau browser ditutup-buka lagi
      autoRefreshToken: true, // token diperpanjang otomatis di background — gak akan expired/logout sendiri selama web dibuka
    },
  }
);

// Supabase KEDUA (opsional) — khusus KONTEN Subject Language, terpisah dari
// project Levantine di atas. Cuma dipakai MEMBACA course yang sudah published
// (public read), jadi pakai anon key & tanpa sesi login. Kalau dua env di
// bawah tidak diisi, konten dibaca dari project utama.
const supabaseSubject =
  process.env.REACT_APP_SUBJECT_SUPABASE_URL && process.env.REACT_APP_SUBJECT_SUPABASE_ANON_KEY
    ? createClient(process.env.REACT_APP_SUBJECT_SUPABASE_URL, process.env.REACT_APP_SUBJECT_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

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

// Font Arab (Amiri) khusus huruf Arab: CSS Google Fonts diambil, hanya blok subset Arab
// yang dipakai & diganti nama keluarganya jadi "AmiriAr". Huruf Latin tetap pakai font biasa.
let amiriArLoaded = false;
function loadArabicFont() {
  if (amiriArLoaded || typeof document === "undefined") return;
  amiriArLoaded = true;
  fetch("https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap")
    .then((r) => r.text())
    .then((css) => {
      const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
      const arabic = blocks.filter((b) => /unicode-range:[^;]*U\+06/i.test(b));
      const use = (arabic.length ? arabic : blocks).map((b) => b.replace(/font-family:\s*['"]?Amiri['"]?/, "font-family: 'AmiriAr'").replace(/unicode-range:[^;]*;/, "unicode-range: U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF;"));
      const el = document.createElement("style");
      el.textContent = use.join("\n");
      document.head.appendChild(el);
    })
    .catch(() => {});
}

// Nama Arab untuk materi/pelajaran. Prioritas: kolom Notion (titleAr / Arabic / Judul Arab),
// lalu peta override di bawah (kunci = judul persis). Isi sesuai kebutuhan.
// Bagian 1..BEGINNER_BAGIAN_COUNT = level Beginner, sesudahnya Intermediate.
const BEGINNER_BAGIAN_COUNT = 10;
const levelOfBagian = (orderIndex) => (orderIndex > BEGINNER_BAGIAN_COUNT ? "intermediate" : "beginner");

const ARABIC_TITLES = {
  "Pengantar Ilmu Ekonomi": "مدخل إلى علم الاقتصاد",
  "Apa itu Ekonomi?": "ما هو الاقتصاد؟",
  "Permintaan & Penawaran": "الطلب والعرض",
  "Inflasi & Kebijakan Moneter": "التضخم والسياسة النقدية",
  "Ekonomi Islam": "الاقتصاد الإسلامي",
  "Sirah Nabawiyah": "السيرة النبوية",
  "Islamic Insurance": "التأمين الإسلامي",
  "Kebijakan Moneter Islam": "السياسة النقدية الإسلامية",
  "Islamic Banking": "الصيرفة الإسلامية",
};
// Nama Arab untuk kartu course: kolom "Course Arab" / ARABIC_TITLES, kalau kosong pakai
// "Judul Arab" dari pelajaran pertama (Order terkecil) di course itu.
const courseArabic = (course) =>
  arabicOf(course, course.title) ||
  ((course.lessons || []).map((l) => l.titleAr).find(Boolean) || "");
const arabicOf = (obj, title) =>
  (obj && (obj.titleAr || obj.arabic || obj.Arabic || obj.judulArab || obj["Judul Arab"] || obj.courseAr || obj.CourseAr)) ||
  ARABIC_TITLES[title] || "";

// Mengubah data flat dari Notion (per-lesson) jadi struktur per-course
function groupLessonsByCourse(lessons) {
  const grouped = {};
  lessons.forEach((lesson) => {
    if (!grouped[lesson.course]) {
      grouped[lesson.course] = {
        id: lesson.course,
        title: lesson.course,
        description: "",
        titleAr: lesson.courseAr || lesson.CourseAr || ARABIC_TITLES[lesson.course] || "",
        thumbnail: lesson.Thumbnail || "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&q=80",
        lessons: [],
      };
    }
    if (!grouped[lesson.course].titleAr && (lesson.courseAr || lesson.CourseAr)) {
      grouped[lesson.course].titleAr = lesson.courseAr || lesson.CourseAr;
    }
    grouped[lesson.course].lessons.push({
      id: lesson.id,
      title: lesson.title,
      titleAr: arabicOf(lesson, lesson.title),
      type: lesson.type,
      videoId: lesson.videoId,
      catatan: lesson.catatan,
      content: lesson.content,
    });
  });
  return Object.values(grouped);
}
function renderInlineBold(text) {
  const parts = text.split("**");
  return parts.map((part, j) =>
    j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
  );
}

function renderTableCell(cell) {
  const lines = cell.split("\\n");
  const result = [];
  lines.forEach((l, idx) => {
    if (idx > 0) result.push(<br key={`br-${idx}`} />);
    result.push(<span key={`t-${idx}`}>{l}</span>);
  });
  return result;
}

function renderContent(content) {
  const lines = content.split("\n");
  const elements = [];
  let tableRows = [];
  let inTable = false;

  lines.forEach((line, i) => {
    if (line === 'TABLE_START') {
      inTable = true;
      tableRows = [];
      return;
    }

    if (line === 'TABLE_END') {
      inTable = false;
      elements.push(
        <div key={i} style={{
          overflowX: "auto",
          marginTop: 16,
          marginBottom: 16,
          borderRadius: 8,
          border: "1px solid #e0e0e0",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {tableRows.map((row, ri) => (
                <tr key={ri} style={{
                  background: ri === 0 ? "#f5f5f5" : "white",
                  borderBottom: "1px solid #e0e0e0",
                }}>
                  {row.map((cell, ci) => (
                    ri === 0 ? (
                      <th key={ci} style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 13,
                        fontWeight: "bold",
                        color: "#1a1a1a",
                        borderRight: ci < row.length - 1 ? "1px solid #e0e0e0" : "none",
                        whiteSpace: "nowrap",
                      }}>
                        {renderTableCell(cell)}
                      </th>
                    ) : (
                      <td key={ci} style={{
                        padding: "10px 14px",
                        fontSize: 13,
                        color: "#333",
                        borderRight: ci < row.length - 1 ? "1px solid #e0e0e0" : "none",
                      }}>
                        {renderTableCell(cell)}
                      </td>
                    )
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      return;
    }

    if (inTable && line.startsWith('TABLE_ROW:')) {
      const cells = line.replace('TABLE_ROW:', '').split('|||');
      tableRows.push(cells);
      return;
    }

    // Render normal (heading, paragraf, dll)
    if (line.startsWith("# ")) {
      elements.push(
        <div key={i} style={{ fontSize: "clamp(20px, 4vw, 26px)", fontWeight: "bold", color: "#1a1a1a", marginTop: 0, marginBottom: 16, paddingBottom: 12, borderBottom: "2px solid #e0e0e0" }}>
          {renderInlineBold(line.replace("# ", ""))}
        </div>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <div key={i} style={{ fontSize: "clamp(16px, 3vw, 19px)", fontWeight: "bold", color: "#1a1a1a", marginTop: 28, marginBottom: 10, paddingLeft: 12, borderLeft: "3px solid #7BAE9B" }}>
          {renderInlineBold(line.replace("## ", ""))}
        </div>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <div key={i} style={{ fontSize: 16, fontWeight: "bold", color: "#1a1a1a", marginTop: 20, marginBottom: 6 }}>
          {renderInlineBold(line.replace("### ", ""))}
        </div>
      );
    } else if (line.startsWith("#### ")) {
      elements.push(
        <div key={i} style={{ fontSize: 15, fontWeight: "bold", color: "#1a1a1a", marginTop: 14, marginBottom: 4 }}>
          {renderInlineBold(line.replace("#### ", ""))}
        </div>
      );
    } else if (line.startsWith("• ")) {
      const parts = line.replace("• ", "").split("**");
      elements.push(
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, paddingLeft: 8 }}>
          <span style={{ color: "#7BAE9B", fontWeight: "bold", flexShrink: 0 }}>•</span>
          <span style={{ fontSize: "clamp(13px, 2.5vw, 15px)", lineHeight: 1.8, color: "#333" }}>
            {parts.map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>)}
          </span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} style={{ height: 10 }} />);
    } else {
      const parts = line.split("**");
      elements.push(
        <p key={i} style={{ marginBottom: 0, marginTop: 0, lineHeight: 1.85, fontSize: "clamp(13px, 2.5vw, 15px)", color: "#333", textAlign: "justify" }}>
          {parts.map((part, j) => j % 2 === 1 ? <strong key={j} style={{ color: "#1a1a1a" }}>{part}</strong> : <span key={j}>{part}</span>)}
        </p>
      );
    }
  });

  return elements;
}
const COURSES_CACHE_KEY = "ls_courses_cache_v1";
// 1 Unit dianggap "selesai penuh" kalau SEMUA levelnya yang punya konten
// (status bukan "locked" — skeleton kosong yang belum digenerate gak
// dihitung) statusnya "done" — status ini sekarang datang ASLI dari tabel
// user_progress Supabase (lihat getUnitsForBagian & goNextExerciseOrFinish),
// bukan tebakan lokal lagi.
function isUnitDone(unit) {
  const playableLevels = (unit.levels || []).filter((l) => l.status !== "locked");
  if (playableLevels.length === 0) return false;
  return playableLevels.every((l) => l.status === "done");
}
// Cek apakah lagi jalan di localhost (development di laptop) — kalau iya,
// fitur yang biasanya wajib login (Ammiyah) dibuka bebas tanpa login,
// supaya gampang testing sendiri tanpa perlu bikin akun/login berulang.
// Di production (domain asli), ini otomatis false, login tetap wajib.
function isLocalDev() {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

// ---------- Pencarian arti kata Arab yang TOLERAN ----------
// Kata di soal sering tidak persis sama dengan kata di kamus: ada harakat (بدّي), variasi alif (أ إ آ ا),
// ى/ي, ة/ه, awalan penghubung (و، ف), "ال", awalan preposisi/kata kerja (ب، ل، ع، رح), dan akhiran
// kata ganti (ـي ـك ـه ـها ـنا ـكم ـهم). Fungsi di bawah menormalkan kata lalu menyusun daftar bentuk dasar
// yang mungkin; bentuk pertama yang ada di kamus dipakai.
function normalizeArabic(w) {
  return (w || "")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "") // harakat, tanwin, tatweel
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")          // آ أ إ ٱ -> ا
    .replace(/[\u0649\u06CC]/g, "\u064A")                         // ى ی -> ي
    .replace(/\u06A9/g, "\u0643")                                   // ک -> ك
    .replace(/\u0629/g, "\u0647")                                   // ة -> ه
    .replace(/[^\u0621-\u064A]/g, "");                              // buang tanda baca & apa pun selain huruf Arab
}
function arabicCandidates(n) {
  if (!n) return [];
  const out = [n];
  const add = (s) => { if (s && s.length >= 2 && !out.includes(s)) out.push(s); };
  const strip = (list, prefixes, minRest) => {
    const res = [];
    for (const b of list) for (const p of prefixes) if (b.startsWith(p) && b.length - p.length >= minRest) res.push(b.slice(p.length));
    return res;
  };
  const suffixes = ["ها", "هم", "هن", "كم", "كن", "نا", "ني", "ات", "ون", "ين", "ان", "ك", "ه", "ي", "و"];
  const withSuffixes = (list) => {
    // ta marbuta + kata ganti: "مدرستي" -> "مدرسه"
    for (const b of list) for (const sfx of ["تها", "تهم", "تكم", "تنا", "تي", "تك", "ته"]) if (b.endsWith(sfx) && b.length - sfx.length >= 2) add(b.slice(0, -sfx.length) + "ه");
    for (const b of list) for (const sfx of suffixes) if (b.endsWith(sfx) && b.length - sfx.length >= 2) {
      const base = b.slice(0, -sfx.length);
      add(base); add(base + "ه"); // "مدرسته" -> "مدرس" / "مدرسه"
    }
  };
  // tahap 1: awalan penghubung (و، ف) dan "ال" / preposisi+ال
  let stage = [n, ...strip([n], ["و", "ف"], 3)];
  const art = [];
  for (const b of stage) {
    for (const p of ["بال", "كال", "فال", "وال", "ال"]) if (b.startsWith(p) && b.length - p.length >= 2) art.push(b.slice(p.length));
    if (b.startsWith("لل") && b.length >= 4) art.push(b.slice(2));
  }
  stage = [...stage, ...art];
  stage.forEach(add);
  // tahap 2: akhiran kata ganti / jamak
  withSuffixes(stage);
  // tahap 3: awalan kata kerja Levantine (رح = akan, ب = sedang/kebiasaan, ع = sedang), lalu akhirannya
  const verbal = strip(stage, ["رح", "ب", "ع"], 3);
  verbal.forEach(add);
  withSuffixes(verbal);
  return out;
}
const WORD_CACHE_KEY = "ls_word_lookup_cache_v2";
function readWordCache() { try { return JSON.parse(window.localStorage.getItem(WORD_CACHE_KEY) || "{}") || {}; } catch (e) { return {}; } }
function writeWordCache(c) { try { window.localStorage.setItem(WORD_CACHE_KEY, JSON.stringify(c)); } catch (e) { /* penuh/diblokir */ } }

// Baca cache course dari localStorage (kalau ada & valid), supaya halaman
// bisa langsung tampil tanpa nunggu fetch API selesai dulu.
function readCachedCourses() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COURSES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    // cache rusak/gak valid, abaikan aja
  }
  return null;
}

function saveCoursesCache(courses) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COURSES_CACHE_KEY, JSON.stringify(courses));
  } catch (e) {
    // storage penuh/diblokir, gak masalah, cuma gak ke-cache
  }
}

// Tentukan page/course/lesson dari query string URL saat ini, secara SINKRON
// (tanpa nunggu network) — dicocokkan ke daftar courses yang tersedia saat itu
// (bisa dari cache localStorage, atau data yang baru selesai di-fetch).
function readUrlState(coursesForLookup) {
  if (typeof window === "undefined") {
    return { page: "home", course: null, lesson: null };
  }
  const params = new URLSearchParams(window.location.search);
  const p = params.get("page");
  const courseId = params.get("course");
  const lessonId = params.get("lesson");

  if (p === "course" && courseId) {
    const course = (coursesForLookup || []).find((c) => c.id === courseId);
    if (course) {
      const lesson = lessonId ? course.lessons.find((l) => l.id === lessonId) : null;
      return { page: "course", course, lesson: lesson || course.lessons[0] };
    }
    // Course belum ketemu (mungkin data belum ke-load) — anggap sementara Explore
    return { page: "explore", course: null, lesson: null };
  }
  if (p === "explore" || p === "contact" || p === "subject" || p === "ammiyah" || p === "ammiyahBagian" || p === "ammiyahPath" || p === "profile") {
    return { page: p, course: null, lesson: null };
  }
  return { page: "home", course: null, lesson: null };
}

// Render konten dengan markdown sederhana
// Bendera Yordania sebagai SVG inline (bukan emoji), supaya tampilannya
// konsisten di semua OS/browser — emoji bendera regional sering di-render
// sebagai teks huruf ("JO") di Windows, bukan gambar bendera.
function JordanFlag({ size = 20 }) {
  const w = size;
  const h = (size * 2) / 3;
  return (
    <svg width={w} height={h} viewBox="0 0 30 20" style={{ borderRadius: 3, flexShrink: 0, display: "block" }}>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.66" fill="#000" />
      <rect y="13.33" width="30" height="6.66" fill="#007A3D" />
      <polygon points="0,0 13,10 0,20" fill="#CE1126" />
      <g fill="#fff" transform="translate(4.3,10)">
        <polygon points="0,-2.6 0.6,-0.8 2.5,-0.8 0.95,0.3 1.55,2.1 0,1 -1.55,2.1 -0.95,0.3 -2.5,-0.8 -0.6,-0.8" />
      </g>
    </svg>
  );
}

// Ikon "G" Google standar 4 warna — dipakai di tombol "Lanjutkan dengan Google".
function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.87-3.04.87-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.15 6.66 3.58 9 3.58z" />
    </svg>
  );
}

// Ikon mahkota outline (bukan emoji) — dipakai di bulatan "Review
// Vocabularies" per unit. Warna kuning kecoklatan sesuai desain.
function CrownIcon({ size = 26, color = "#A9762F" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
      <path d="M3 8.5l3.6 2.6L12 4l5.4 7.1 3.6-2.6-1.8 8.5H4.8L3 8.5z" />
      <path d="M6 18.5h12" />
    </svg>
  );
}

// Ikon matahari sederhana — dipakai di bulatan "Review Semua Kosakata"
// per Bagian, di halaman daftar Bagian. Gaya outline/tribal (garis saja,
// tanpa isi wajah) — flame/lidah api mengelilingi lingkaran tengah.
function SunIcon({ size = 20, color = "#fff" }) {
  const flame = "M0,-15 C4,-11 5,-5 2,-1 C5,1 7,5 3,9 C1,6 -1,6 -3,9 C-7,5 -5,1 -2,-1 C-5,-5 -4,-11 0,-15 Z";
  return (
    <svg width={size} height={size} viewBox="-30 -30 60 60" fill="none">
      <g stroke={color} strokeWidth="2" strokeLinejoin="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <path key={deg} d={flame} transform={`rotate(${deg}) translate(0,-9)`} />
        ))}
        <circle cx="0" cy="0" r="9" />
      </g>
    </svg>
  );
}

// Avatar generik untuk halaman latihan — sengaja dibuat sendiri (bukan
// meniru karakter Duolingo atau IP lain), cuma bentuk sederhana netral.
// Mascot planet — dipakai di halaman latihan/soal.
function PlanetMascot({ size = 84, color = "#7BAE9B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 84 84">
      {/* bintang kecil di sekitar */}
      <path d="M8 20 L9.5 24 L13.5 25 L9.5 26 L8 30 L6.5 26 L2.5 25 L6.5 24 Z" fill="#F5D98B" />
      <circle cx="74" cy="14" r="2" fill="#F5D98B" />
      {/* cincin planet */}
      <ellipse cx="42" cy="48" rx="38" ry="11" fill="none" stroke="#F5B700" strokeWidth="5" opacity="0.9" />
      {/* badan planet */}
      <circle cx="42" cy="40" r="30" fill={color} />
      <ellipse cx="30" cy="28" rx="8" ry="5" fill="rgba(255,255,255,0.18)" />
      <circle cx="55" cy="50" r="5" fill="rgba(0,0,0,0.08)" />
      <circle cx="26" cy="48" r="3.5" fill="rgba(0,0,0,0.08)" />
      {/* wajah */}
      <circle cx="33" cy="38" r="3" fill="#3E3E3E" />
      <circle cx="49" cy="38" r="3" fill="#3E3E3E" />
      <path d="M33 48 Q41 54 49 48" stroke="#3E3E3E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* cincin depan (menutupi sebagian badan biar 3D) */}
      <path d="M4 48 Q42 62 80 48" fill="none" stroke="#F5B700" strokeWidth="5" strokeLinecap="round" opacity="0.95" />
    </svg>
  );
}

// Hero Home: video karakter menaiki tangga -> berhenti menatap cahaya -> teks muncul perlahan di kiri
// -> video selesai: video + teks jadi latar, logo Learning Space muncul di tengah.
// File di folder public/: hero-climb.mp4, hero-climb.webm, hero-poster.jpg (frame terakhir), logo.svg
function HeroIntro({ onStart, isMobile, green }) {
  const TEXT_AT = 4.6; // detik: saat karakter berhenti, teks mulai muncul
  const videoRef = useRef(null);
  const [showText, setShowText] = useState(false);
  const [ended, setEnded] = useState(false);
  const reduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (reduced) { setShowText(true); setEnded(true); return undefined; }
    const v = videoRef.current;
    if (!v) return undefined;
    // Autoplay diblokir / video gagal dimuat -> langsung tampilkan keadaan akhir (poster + teks + logo)
    const p = v.play();
    if (p && p.catch) p.catch(() => { setShowText(true); setEnded(true); });
    return undefined;
  }, [reduced]);

  const replay = () => {
    const v = videoRef.current;
    if (!v) return;
    setEnded(false); setShowText(false);
    v.currentTime = 0;
    const p = v.play();
    if (p && p.catch) p.catch(() => { setShowText(true); setEnded(true); });
  };

  const BG = "#f4f5f4";
  const textStyle = {
    color: "#1f2b27",
    fontSize: isMobile ? 16 : "clamp(16px, 1.75vw, 24px)",
    lineHeight: 1.65,
    fontWeight: 500,
    margin: 0,
    maxWidth: isMobile ? 520 : 480,
    opacity: showText ? (ended ? (isMobile ? 0.75 : 0.28) : 1) : 0,
    transform: showText ? "none" : "translateX(-16px)",
    transition: "opacity 2.4s ease, transform 2.4s ease",
    filter: ended && !isMobile ? "blur(1.5px)" : "none",
  };
  const stage = (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", maxHeight: isMobile ? "none" : "82vh", minHeight: isMobile ? 0 : 420, overflow: "hidden", background: BG }}>
      <video
        ref={videoRef}
        muted
        playsInline
        preload="auto"
        poster="hero-poster.jpg"
        onTimeUpdate={(e) => { if (e.currentTarget.currentTime >= TEXT_AT) setShowText(true); }}
        onEnded={() => { setShowText(true); setEnded(true); }}
        onError={() => { setShowText(true); setEnded(true); }}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: isMobile ? "68% 50%" : "center", transition: "filter 1.4s ease", filter: ended ? "blur(2px)" : "none" }}
      >
        <source src="hero-climb.webm" type="video/webm" />
        <source src="hero-climb.mp4" type="video/mp4" />
      </video>

      {/* teks di sisi kiri (desktop) */}
      {!isMobile && (
        <div style={{ position: "absolute", left: "7%", top: "50%", transform: "translateY(-50%)", width: "38%" }}>
          <p style={textStyle}>{HERO_TEXT}</p>
        </div>
      )}

      {/* tirai lembut + logo di tengah saat video selesai */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: ended ? "rgba(244,245,244,0.72)" : "rgba(244,245,244,0)", transition: "background 1.4s ease", pointerEvents: ended ? "auto" : "none", textAlign: "center", padding: 16 }}>
        <img src="/logo-learningspace.png" alt="Learning Space" style={{ width: isMobile ? "min(78vw, 320px)" : "clamp(280px, 34vw, 500px)", height: "auto", opacity: ended ? 1 : 0, transform: ended ? "scale(1)" : "scale(0.92)", transition: "opacity 1.4s ease .3s, transform 1.4s cubic-bezier(.2,.8,.2,1) .3s" }} />
        <button
          onClick={onStart}
          style={{ opacity: ended ? 1 : 0, transform: ended ? "none" : "translateY(8px)", transition: "opacity 1s ease 1.5s, transform 1s ease 1.5s", background: green, color: "white", border: "none", padding: "13px 38px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px rgba(90,138,121,0.30)", pointerEvents: ended ? "auto" : "none" }}
        >
          Let's roll
        </button>
      </div>

      {ended && !reduced && (
        <button onClick={replay} aria-label="Replay" title="Replay" style={{ position: "absolute", left: 14, bottom: 14, width: 34, height: 34, borderRadius: "50%", border: "1px solid #d5dedb", background: "rgba(255,255,255,0.8)", color: "#5f7f73", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.8 }}>
          <Icon name="repeat" size={16} />
        </button>
      )}
    </div>
  );

  return (
    <div style={{ background: BG }}>
      {stage}
      {isMobile && (
        <div style={{ padding: "24px 24px 30px", background: BG }}>
          <p style={textStyle}>{HERO_TEXT}</p>
        </div>
      )}
    </div>
  );
}
const HERO_TEXT = "A free learning platform for everyone, anywhere. Learn Levantine Arabic for everyday conversation, or master the language of your school subjects, and grow without barriers.";

// Varian "bertanya-tanya" — dipakai di modal konfirmasi keluar, meniru pose
// emoji 🤔 (alis terangkat, mulut mengerucut, tanda tanya mengambang) tapi
// pakai karakter planet yang sama.
function PlanetMascotThinking({ size = 84, color = "#7BAE9B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 84 84">
      {/* tanda tanya mengambang */}
      <text x="56" y="20" fontSize="22" fontWeight="bold" fill="#F5B700" fontFamily="Arial, sans-serif">?</text>
      {/* cincin planet */}
      <ellipse cx="42" cy="48" rx="38" ry="11" fill="none" stroke="#F5B700" strokeWidth="5" opacity="0.9" />
      {/* badan planet */}
      <circle cx="42" cy="40" r="30" fill={color} />
      <ellipse cx="30" cy="28" rx="8" ry="5" fill="rgba(255,255,255,0.18)" />
      <circle cx="55" cy="50" r="5" fill="rgba(0,0,0,0.08)" />
      <circle cx="26" cy="48" r="3.5" fill="rgba(0,0,0,0.08)" />
      {/* wajah bertanya-tanya: alis terangkat + mulut mengerucut */}
      <path d="M28 33 Q33 29 39 33" stroke="#3E3E3E" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <circle cx="33" cy="39" r="3" fill="#3E3E3E" />
      <circle cx="49" cy="38" r="3" fill="#3E3E3E" />
      <circle cx="41" cy="49" r="3" fill="none" stroke="#3E3E3E" strokeWidth="2.2" />
      {/* cincin depan */}
      <path d="M4 48 Q42 62 80 48" fill="none" stroke="#F5B700" strokeWidth="5" strokeLinecap="round" opacity="0.95" />
    </svg>
  );
}

// Varian "lagi ngomong" — mulut kebuka (bukan lengkung senyum), buat kesan
// planet lagi berbicara aktif. Dipakai bareng varian lain di soal
// dialogue_complete biar ekspresinya keliatan gonta-ganti pas dialog jalan.
function PlanetMascotTalking({ size = 84, color = "#7BAE9B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 84 84">
      <path d="M8 20 L9.5 24 L13.5 25 L9.5 26 L8 30 L6.5 26 L2.5 25 L6.5 24 Z" fill="#F5D98B" />
      <circle cx="74" cy="14" r="2" fill="#F5D98B" />
      <ellipse cx="42" cy="48" rx="38" ry="11" fill="none" stroke="#F5B700" strokeWidth="5" opacity="0.9" />
      <circle cx="42" cy="40" r="30" fill={color} />
      <ellipse cx="30" cy="28" rx="8" ry="5" fill="rgba(255,255,255,0.18)" />
      <circle cx="55" cy="50" r="5" fill="rgba(0,0,0,0.08)" />
      <circle cx="26" cy="48" r="3.5" fill="rgba(0,0,0,0.08)" />
      {/* wajah: mata biasa + mulut terbuka bulat (kesan lagi ngomong) */}
      <circle cx="33" cy="38" r="3" fill="#3E3E3E" />
      <circle cx="49" cy="38" r="3" fill="#3E3E3E" />
      <ellipse cx="41" cy="50" rx="6" ry="5.5" fill="#3E3E3E" />
      <path d="M4 48 Q42 62 80 48" fill="none" stroke="#F5B700" strokeWidth="5" strokeLinecap="round" opacity="0.95" />
    </svg>
  );
}

// Varian "senang" — mata melengkung ^ ^ + senyum lebar, buat ekspresi
// antusias/ceria. Sama kayak PlanetMascotTalking, khusus dicampur di
// soal percakapan biar mukanya gak monoton sama terus tiap baris dialog.
function PlanetMascotHappy({ size = 84, color = "#7BAE9B" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 84 84">
      <path d="M8 20 L9.5 24 L13.5 25 L9.5 26 L8 30 L6.5 26 L2.5 25 L6.5 24 Z" fill="#F5D98B" />
      <circle cx="74" cy="14" r="2" fill="#F5D98B" />
      <ellipse cx="42" cy="48" rx="38" ry="11" fill="none" stroke="#F5B700" strokeWidth="5" opacity="0.9" />
      <circle cx="42" cy="40" r="30" fill={color} />
      <ellipse cx="30" cy="28" rx="8" ry="5" fill="rgba(255,255,255,0.18)" />
      <circle cx="55" cy="50" r="5" fill="rgba(0,0,0,0.08)" />
      <circle cx="26" cy="48" r="3.5" fill="rgba(0,0,0,0.08)" />
      {/* wajah: mata melengkung ceria (^ ^) + senyum lebar */}
      <path d="M29 38 Q33 33 37 38" stroke="#3E3E3E" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M45 38 Q49 33 53 38" stroke="#3E3E3E" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M30 46 Q41 58 52 46" stroke="#3E3E3E" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M4 48 Q42 62 80 48" fill="none" stroke="#F5B700" strokeWidth="5" strokeLinecap="round" opacity="0.95" />
    </svg>
  );
}

// Dipakai KHUSUS di soal dialogue_complete (percakapan) -- gantian per baris
// dialog (i % 3), biar ekspresi mukanya keliatan hidup/berubah-ubah selama
// dialog berjalan, bukan wajah statis yang sama terus tiap baris.
const CONVERSATION_MASCOTS = [PlanetMascot, PlanetMascotTalking, PlanetMascotHappy];
function ConversationMascot({ index, size }) {
  const Variant = CONVERSATION_MASCOTS[index % CONVERSATION_MASCOTS.length];
  return <Variant size={size} />;
}


// ============================================================
// i18n — kamus UI bahasa Indonesia/Inggris. CUMA nyakup label/teks statis
// (tombol, judul halaman, label prompt soal, pesan feedback) -- ISI SOAL
// (kalimat Arab, opsi jawaban, dst) punya jalur terjemahan SENDIRI lewat
// content_en di database (lihat scripts/translate-content-en.mjs),
// BUKAN lewat kamus ini.
//
// Label prompt soal (13 baris di bawah) SENGAJA disatukan di sini
// (bukan lewat AI per-baris exercise) karena cuma ada segelintir variasi
// tetap yang berulang di RIBUAN soal -- jauh lebih murah & instan
// diterjemahin statis sekali di sini.
// ============================================================
const UI_STRINGS = {
  // Pemilih bahasa & sapaan
  chooseLanguage: { id: "Choose your language", en: "Choose your language" },
  langIndonesian: { id: "Indonesia", en: "Indonesian" },
  langEnglish: { id: "Inggris", en: "English" },
  // Judul & deskripsi halaman awal Ammiyah
  introTitle: { id: "Belajar Arab Levantine (Yordania)", en: "Learn Levantine Arabic (Jordan)" },
  introDesc: {
    id: "Fitur ini dirancang untuk membantumu menguasai ungkapan santai dan percakapan sehari-hari khas Levantine secara praktis.",
    en: "This feature is designed to help you master casual Levantine expressions and everyday conversation in a practical way.",
  },
  // Tombol & feedback soal
  btnContinue: { id: "LANJUTKAN", en: "CONTINUE" },
  btnCheck: { id: "PERIKSA", en: "CHECK" },
  feedbackCorrect: { id: "Betul!", en: "Correct!" },
  feedbackIncorrect: { id: "Kurang tepat", en: "Not quite" },
  feedbackAnswerPrefix: { id: " — jawaban: ", en: " — answer: " },
  wordMeaningNotFound: { id: "Arti kata ini belum ada di database", en: "This word's meaning isn't in the database yet" },
  wordMeaningSearching: { id: "Mencari arti...", en: "Looking up meaning..." },
  wordMeaningNotFoundFinal: { id: "Arti kata ini belum ditemukan", en: "This word's meaning couldn't be found" },
  // Label prompt soal (13 variasi, dipakai lintas ribuan exercise)
  "Isi bagian yang kosong": { en: "Fill in the blank" },
  "Isi bagian yang kosong (dari cerita di atas)": { en: "Fill in the blank (from the story above)" },
  "Pilih terjemahan yang benar": { en: "Choose the correct translation" },
  "Susun terjemahannya": { en: "Arrange the translation" },
  "Susun kalimat Bahasa Arab": { en: "Arrange the Arabic sentence" },
  "Tulis terjemahannya": { en: "Write the translation" },
  "Tulis terjemahannya (tanpa bantuan)": { en: "Write the translation (without help)" },
  "Dengarkan lalu pilih jawaban yang benar": { en: "Listen, then choose the correct answer" },
  "Cocokkan kata yang sering ketuker": { en: "Match the words that are easily confused" },
  "Cocokkan kata dengan artinya": { en: "Match each word with its meaning" },
  "Kenali kata-kata baru": { en: "Meet the new words" },
  "Dengarkan, lalu pilih kata yang kamu dengar": { en: "Listen, then choose the word you hear" },
  "Pahami bacaannya, lalu jawab": { en: "Read and understand, then answer" },
  "Pahami percakapannya, lalu jawab": { en: "Understand the conversation, then answer" },
  "Pilih arti yang benar": { en: "Choose the correct meaning" },
  "Lengkapi percakapannya": { id: "Lengkapi percakapannya", en: "Complete the conversation" },
  // Halaman login/auth (ditampilkan juga di alur masuk ke fitur Levantine)
  loginPromptTitle: { id: "Login Dulu, Yuk!", en: "Please Log In First!" },
  loginPromptDesc: { id: "Fitur belajar Levantine cuma bisa diakses kalau kamu sudah masuk ke akun.", en: "The Levantine learning feature is only available once you're logged in." },
  loginPromptBtn: { id: "Masuk / Daftar", en: "Log In / Sign Up" },
  authTitleRegister: { id: "Buat Akun Baru", en: "Create New Account" },
  authTitleLogin: { id: "Masuk ke Akun", en: "Log In to Your Account" },
  authSubtitleRegister: { id: "Sudah punya progres belajar? Masuk saja.", en: "Already have learning progress? Just log in." },
  authSubtitleLogin: { id: "Senang ketemu lagi!", en: "Great to see you again!" },
  authAmmiyahBanner: { id: "Login dulu untuk mulai belajar Levantine 🇯🇴 — progres kamu akan tersimpan otomatis.", en: "Log in first to start learning Levantine 🇯🇴 — your progress will be saved automatically." },
  // Halaman intro Ammiyah — daftar fitur
  introFeatureLabel: { id: "Yang akan kamu dapatkan:", en: "What you'll get:" },
  introFeature1Title: { id: "Kosakata & Slang Lokal", en: "Local Vocabulary & Slang" },
  introFeature1Desc: { id: "Ungkapan populer yang biasa digunakan warga Yordania.", en: "Popular expressions commonly used by Jordanians." },
  introFeature2Title: { id: "Dialog Praktis", en: "Practical Dialogues" },
  introFeature2Desc: { id: "Latihan percakapan untuk situasi nyata di kafe, pasar, dan tempat umum.", en: "Conversation practice for real situations at cafes, markets, and public places." },
  introFeature3Title: { id: "Aksen Natural", en: "Natural Accent" },
  introFeature3Desc: { id: "Latihan pengucapan agar caramu berbicara terasa luwes.", en: "Pronunciation practice to make your speech sound natural." },
  // Halaman Bagian/Path
  pickBagianFirst: { id: "Pilih Bagian dulu dari daftar.", en: "Please pick a Section from the list first." },
  backToBagianList: { id: "Kembali ke Daftar Bagian", en: "Back to Section List" },
  loadingUnitLevel: { id: "Memuat unit & level...", en: "Loading units & levels..." },
  failedToLoadPrefix: { id: "Gagal memuat: ", en: "Failed to load: " },
  noUnitYetPrefix: { id: "Belum ada Unit tersimpan untuk ", en: "No Units saved yet for " },
  noUnitYetSuffix: { id: ". Jalankan generate-vocab-v2.js dulu untuk Bagian ini.", en: ". Run generate-vocab-v2.js first for this Section." },
  unitNoteTitle: { id: "Catatan unit", en: "Unit notes" },
  reviewBagianDoneBefore: { id: "Menguji kembali semua kosakata yang sudah kamu pelajari di ", en: "Testing all the vocabulary you've learned in " },
  reviewBagianDoneAfter: { id: ". Opsional — kamu tetap bisa lanjut ke Bagian berikutnya tanpa mengerjakan ini.", en: ". Optional — you can still move on to the next Section without doing this." },
  reviewBagianLockedBefore: { id: "🔒 Untuk review seluruh kosakata ", en: "🔒 To review all the vocabulary in " },
  reviewBagianLockedAfter: { id: ", selesaikan dulu semua unit di Bagian ini.", en: ", finish all units in this Section first." },
  reviewUnitDoneBefore: { id: "Menguji kembali kosakata yang sudah kamu pelajari di ", en: "Testing the vocabulary you've learned in " },
  reviewUnitDoneAfter: { id: ". Opsional — kamu tetap bisa lanjut ke unit berikutnya tanpa mengerjakan ini.", en: ". Optional — you can still move on to the next unit without doing this." },
  reviewUnitLockedBefore: { id: "🔒 Untuk review kosakata seluruh ", en: "🔒 To review all the vocabulary in " },
  reviewUnitLockedAfter: { id: ", selesaikan dulu semua level di unit ini.", en: ", finish all levels in this unit first." },
  btnStartReview: { id: "Mulai Review", en: "Start Review" },
  loadingBagianList: { id: "Memuat daftar Bagian...", en: "Loading Section list..." },
  ammiyahSubtitle: { id: "Bahasa Arab Levantine (Yordania)", en: "Levantine Arabic (Jordan)" },
  noBagianYet: { id: "Belum ada Bagian tersimpan di database. Jalankan generate-vocab-v2.js dulu.", en: "No Sections saved in the database yet. Run generate-vocab-v2.js first." },
  exitConfirmTitle: { id: "Kamu yakin mau keluar?", en: "Are you sure you want to leave?" },
  exitConfirmDesc: { id: "Belajar sebentar yuk!", en: "Let's study a little more!" },
  exitConfirmContinue: { id: "Lanjutkan Pelajaran", en: "Continue Lesson" },
  exitConfirmLeave: { id: "Keluar", en: "Leave" },
  preparingExercises: { id: "Menyiapkan soal...", en: "Preparing exercises..." },
};

// t(key, lang): terjemahin 1 key. Kalau key gak ketemu di kamus ATAU lang
// diminta gak ada isinya, fallback ke Indonesia (kunci itu sendiri kalau
// keynya emang teks Indonesia asli, seperti pola prompt soal di atas).
// Terjemahan nama 10 domain (Bagian) + 100 topik (Unit) dari CURRICULUM di
// lib/curriculum-engine.mjs — nama-nama ini TERSIMPAN di database (kolom
// units.name / topics.name), BUKAN teks statis, jadi gak bisa lewat UI_STRINGS
// biasa. Kamus terpisah ini di-lookup lewat trTopic() di bawah.
const TOPIC_NAME_EN = {
  // 10 domain (Bagian)
  "Dasar & Perkenalan": "Basics & Introductions", "Kehidupan Sehari-hari": "Daily Life",
  "Makan & Belanja": "Food & Shopping", "Transportasi & Arah": "Transportation & Directions",
  "Kesehatan & Tubuh": "Health & Body", "Pekerjaan & Sekolah": "Work & School",
  "Sosial & Hubungan": "Social & Relationships", "Rumah & Tempat Tinggal": "Home & Housing",
  "Hiburan & Waktu Luang": "Entertainment & Leisure", "Topik Lanjutan": "Advanced Topics",
  // Bagian 1
  "Perkenalan Diri": "Self Introduction", "Sapaan": "Greetings", "Kata Ganti": "Pronouns",
  "Angka 1-20": "Numbers 1-20", "Warna": "Colors", "Hari & Tanggal": "Days & Dates",
  "Cuaca Dasar": "Basic Weather", "Anggota Keluarga": "Family Members", "Kata Sifat Dasar": "Basic Adjectives",
  "Terima Kasih & Maaf": "Thanks & Apologies",
  // Bagian 2
  "Rutinitas Pagi": "Morning Routine", "Waktu & Jam": "Time & Clock", "Aktivitas Rumah": "Home Activities",
  "Makanan Sehari-hari": "Everyday Food", "Minuman": "Drinks", "Pekerjaan Rumah Tangga": "Household Chores",
  "Barang di Rumah": "Household Items", "Ruangan Rumah": "Rooms in the House", "Tidur & Istirahat": "Sleep & Rest",
  "Rutinitas Malam": "Night Routine",
  // Bagian 3
  "Pesan di Restoran": "Ordering at a Restaurant", "Menu Makanan": "Food Menu",
  "Belanja di Pasar": "Shopping at the Market", "Tawar Harga": "Bargaining",
  "Uang & Pembayaran": "Money & Payment", "Toko Kelontong": "Convenience Store",
  "Buah & Sayur": "Fruits & Vegetables", "Daging & Ikan": "Meat & Fish",
  "Rasa Makanan": "Taste of Food", "Resep Sederhana": "Simple Recipes",
  // Bagian 4
  "Tanya Arah": "Asking for Directions", "Naik Taksi": "Taking a Taxi", "Naik Bus": "Taking a Bus",
  "Kendaraan Pribadi": "Personal Vehicles", "Lalu Lintas": "Traffic", "Nama Tempat di Kota": "Places in the City",
  "Peta & Lokasi": "Map & Location", "Bandara": "Airport", "Stasiun": "Station", "Perjalanan Jauh": "Long Trips",
  // Bagian 5
  "Anggota Tubuh": "Body Parts", "Sakit & Gejala": "Illness & Symptoms", "Ke Dokter": "Visiting the Doctor",
  "Apotek": "Pharmacy", "Obat-obatan": "Medicines", "Kecelakaan Kecil": "Minor Accidents",
  "Kesehatan Mental Dasar": "Basic Mental Health", "Olahraga": "Sports", "Kebugaran": "Fitness",
  "Emosi & Perasaan": "Emotions & Feelings",
  // Bagian 6
  "Profesi": "Professions", "Di Kantor": "At the Office", "Rapat Kerja": "Work Meetings",
  "Wawancara Kerja": "Job Interview", "Di Sekolah": "At School", "Mata Pelajaran": "School Subjects",
  "Universitas": "University", "Tugas & Ujian": "Assignments & Exams", "Teknologi di Kerja": "Technology at Work",
  "Rekan Kerja": "Coworkers",
  // Bagian 7
  "Kenalan Baru": "Meeting New People", "Ngobrol Santai": "Casual Chat", "Undang Teman": "Inviting Friends",
  "Acara Keluarga": "Family Gatherings", "Pernikahan": "Weddings", "Ulang Tahun": "Birthdays",
  "Ucapan Selamat": "Congratulations", "Curhat": "Venting / Sharing Feelings", "Nasihat": "Advice",
  "Berargumen Sopan": "Polite Disagreement",
  // Bagian 8
  "Cari Tempat Tinggal": "Finding a Place to Live", "Sewa Rumah": "Renting a House", "Tetangga": "Neighbors",
  "Perabotan": "Furniture", "Renovasi": "Renovation", "Listrik & Air": "Electricity & Water",
  "Keamanan Rumah": "Home Security", "Pindah Rumah": "Moving House", "Kebersihan": "Cleanliness",
  "Hewan Peliharaan": "Pets",
  // Bagian 9
  "Hobi": "Hobbies", "Film & TV": "Movies & TV", "Musik": "Music", "Baca Buku": "Reading Books",
  "Media Sosial": "Social Media", "Liburan": "Vacation", "Wisata": "Tourism",
  "Olahraga Favorit": "Favorite Sports", "Permainan": "Games", "Kumpul Teman": "Hanging Out with Friends",
  // Bagian 10
  "Berita & Isu Terkini": "Current News & Issues", "Pendapat & Diskusi": "Opinions & Discussion",
  "Cuaca Ekstrem": "Extreme Weather", "Lingkungan": "Environment", "Teknologi Modern": "Modern Technology",
  "Uang & Perbankan": "Money & Banking", "Dokumen & Administrasi": "Documents & Administration",
  "Darurat": "Emergency", "Budaya & Tradisi": "Culture & Tradition", "Percakapan Bebas": "Free Conversation",
};

// Terjemahin nama Bagian/Topik DINAMIS dari database. Beda dari t() biasa:
// ini juga nangkep pola "Semua Kosakata — <nama>" (dipakai di label review)
// biar prefix-nya ikut diterjemahin, bukan cuma nama topiknya doang.
function trTopic(name, lang) {
  if (!name || lang !== "en") return name;
  if (TOPIC_NAME_EN[name]) return TOPIC_NAME_EN[name];
  const reviewPrefix = "Semua Kosakata — ";
  if (name.startsWith(reviewPrefix)) {
    const rest = name.slice(reviewPrefix.length);
    return `All Vocabulary — ${TOPIC_NAME_EN[rest] || rest}`;
  }
  return name; // nama gak dikenal (harusnya gak kejadian) -- fallback aman ke Indonesia
}

// "Bagian N" ternyata literal string dari database (units.name = `Bagian
// ${bagianNumber}`, lihat ensureUnit di generate-vocab-v2.mjs) — BUKAN nama
// domain kayak "Dasar & Perkenalan" (itu cuma dipakai internal buat
// nge-lookup nomor Bagian, gak pernah disimpan ke DB). Jadi trTopic() gak
// nemu match apa pun buat "Bagian N", perlu helper terpisah: ganti kata
// "Bagian" -> "Section", angkanya tetap.
function trBagianLabel(title, lang) {
  if (!title || lang !== "en") return title;
  return title.replace(/^Bagian\s+/, "Section ");
}

function t(key, lang) {
  const entry = UI_STRINGS[key];
  if (!entry) return key; // key yang gak terdaftar dianggap teks Indonesia apa adanya
  return entry[lang] || entry.id || key;
}

// Panel "Artinya" — muncul setelah soal dijawab (benar/salah) untuk soal yang teks & jawabannya Arab semua.
// Memakai arti kalimat dari data soal bila ada (`meaning`), kalau tidak ada: arti per kata dari kamus/lookup.
function MeaningPanel({ lines, translate, resolve, lx }) {
  // Terjemahan KALIMAT UTUH: dari data soal (`meaning`) bila ada, kalau tidak diminta ke /api/translate-sentence.
  const [tr, setTr] = useState({});        // text -> terjemahan
  const [state, setState] = useState("loading"); // loading | ok | failed
  const [glosses, setGlosses] = useState({}); // cadangan arti per kata, HANYA bila terjemahan kalimat gagal
  const key = JSON.stringify(lines.map((l) => [l.text, l.meaning || ""]));
  useEffect(() => {
    let dead = false;
    const need = [...new Set(lines.filter((l) => !l.meaning).map((l) => l.text))];
    if (need.length === 0) { setState("ok"); return undefined; }
    setState("loading");
    translate(need)
      .then((arr) => { if (dead) return; const m = {}; need.forEach((s, i) => { m[s] = arr[i]; }); setTr(m); setState("ok"); })
      .catch(() => { if (!dead) setState("failed"); });
    return () => { dead = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state !== "failed") return undefined;
    let dead = false;
    const words = new Set();
    lines.forEach((l) => {
      if (l.meaning) return;
      l.text.split(/\s+/).forEach((w) => { const c = w.replace(/[^\u0600-\u06FF]/g, ""); if (c) words.add(c); });
    });
    [...words].slice(0, 40).forEach(async (w) => {
      let r = null;
      try { r = await resolve(w); } catch (e) { r = null; }
      if (!dead) setGlosses((g) => ({ ...g, [w]: r || false }));
    });
    return () => { dead = true; };
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const wordChips = (text) => text.split(/\s+/).filter(Boolean).map((w, i) => {
    const c = w.replace(/[^\u0600-\u06FF]/g, "");
    const g = glosses[c];
    return (
      <span key={i} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", background: "white", border: "1px solid #e3ece7", borderRadius: 10, padding: "5px 9px", minWidth: 40 }}>
        <span style={{ fontSize: 17, lineHeight: 1.4, color: "#1a2421" }}>{w}</span>
        <span style={{ fontSize: 11.5, color: g ? "#4a6358" : "#aab4af", marginTop: 1 }}>{g ? g.arti : g === false ? "–" : "…"}</span>
      </span>
    );
  });
  return (
    <div className="ls-feedback" style={{ marginTop: 18, background: "#f4f9f6", border: "1px solid #dcebe4", borderRadius: 16, padding: "14px 14px 12px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: "#4a6358", letterSpacing: 0.4, marginBottom: 10 }}>{lx("ARTINYA", "MEANING")}</div>
      {lines.map((l, i) => {
        const sentence = l.meaning || tr[l.text];
        return (
          <div key={i} style={{ marginBottom: i === lines.length - 1 ? 0 : 12 }}>
            {l.label && <div style={{ fontSize: 11.5, fontWeight: 700, color: "#7a8782", marginBottom: 4 }}>{l.label}</div>}
            <div dir="rtl" style={{ fontSize: 18, lineHeight: 1.7, color: "#1a2421", textAlign: "right" }}>{l.text}</div>
            {sentence ? (
              <div style={{ fontSize: 14.5, color: "#33423c", lineHeight: 1.55, marginTop: 2 }}>{sentence}</div>
            ) : state === "loading" ? (
              <div style={{ fontSize: 13.5, color: "#9aa6a1", marginTop: 2, fontStyle: "italic" }}>{lx("Menerjemahkan...", "Translating...")}</div>
            ) : (
              <>
                <div style={{ fontSize: 12, color: "#9aa6a1", margin: "2px 0 4px" }}>{lx("Terjemahan kalimat belum tersedia — arti per kata:", "Sentence translation unavailable — word meanings:")}</div>
                <div dir="rtl" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{wordChips(l.text)}</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function KelasNotesters() {
  // Bahasa UI (Layer 2 i18n) — 'id' default, 'en' kalau user pernah pilih
  // Inggris sebelumnya (persist localStorage, gak perlu login).
  const [uiLang, setUiLang] = useState(() => {
    try { return localStorage.getItem("uiLang") === "en" ? "en" : "id"; } catch { return "id"; }
  });
  const changeUiLang = (lang) => {
    setUiLang(lang);
    try { localStorage.setItem("uiLang", lang); } catch {}
  };

  useEffect(() => { loadArabicFont(); }, []);
  const [page, setPage] = useState(() => readUrlState(readCachedCourses() || fallbackCourses).page);
  const [courses, setCourses] = useState(() => readCachedCourses() || fallbackCourses);
  const [loadingMateri, setLoadingMateri] = useState(() => !readCachedCourses());
  const [activeCourse, setActiveCourse] = useState(() => readUrlState(readCachedCourses() || fallbackCourses).course);
  const [activeLesson, setActiveLesson] = useState(() => readUrlState(readCachedCourses() || fallbackCourses).lesson);
  const [showDonate, setShowDonate] = useState(false);
  const [donateMethod, setDonateMethod] = useState(null); // null | "paypal" | "qris"
  const [donateImgErr, setDonateImgErr] = useState(false);
  const closeDonate = () => { setShowDonate(false); setDonateMethod(null); setDonateImgErr(false); };

  // ============================================================
  // AUTH — UI dulu, belum nyambung ke Supabase Auth beneran. `currentUser`
  // nanti diisi dari `supabase.auth.getSession()` / `onAuthStateChange()`.
  // Cuma fitur Levantine yang mewajibkan login; Home/Explore/Contact bebas.
  // ============================================================
  const [currentUser, setCurrentUser] = useState(null); // null = belum login, nanti: { id, email, name }

  // Cek sesi login yang sudah ada (kalau user sebelumnya sudah login dan
  // belum logout, session-nya tersimpan di browser — jangan suruh login
  // ulang tiap buka web). Juga dengerin SEMUA perubahan status login
  // (login, logout, dan PENTING: redirect balik dari Google OAuth — abis
  // Google, browser diarahkan balik ke web ini dan event ini yang
  // nangkep hasil loginnya, BUKAN handleGoogleAuth, karena handleGoogleAuth
  // cuma MEMULAI redirect ke Google, gak nunggu hasilnya).
  const toAppUser = (u) => {
    const meta = u.user_metadata || {};
    const email = u.email || "";
    return {
      id: u.id,
      email,
      name: meta.name || meta.full_name || (email ? email.split("@")[0] : "User"),
      avatarUrl: meta.avatar_url || meta.picture || null,
      provider: u.app_metadata?.provider || "email",
      createdAt: u.created_at || null,
    };
  };
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUser(toAppUser(session.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser(toAppUser(session.user));
      } else {
        setCurrentUser(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kalau login Google gagal, Supabase mengembalikan user ke web dengan ?error_description=... (di query atau hash).
  // Tampilkan pesannya di halaman login supaya penyebabnya kelihatan, terutama di HP.
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const h = new URLSearchParams((window.location.hash || "").replace(/^#/, ""));
      const desc = q.get("error_description") || h.get("error_description");
      if (desc) {
        setAuthError(`Login Google gagal: ${desc.replace(/\+/g, " ")}`);
        setAuthMode("login");
        setPage("login");
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch (e) { /* abaikan */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Subject Language Learning: ringkasan untuk kartu "Lanjutkan Belajar" di Home ---
  const [slSummary, setSlSummary] = useState(null);
  const [slAutoResume, setSlAutoResume] = useState(false);
  const refreshSlSummary = () => {
    fetchResumeSummary(supabase, currentUser ? currentUser.id : null, uiLang, supabaseSubject).then(setSlSummary).catch(() => {});
  };
  useEffect(() => {
    refreshSlSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, page, uiLang]);
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [authRedirectTarget, setAuthRedirectTarget] = useState("ammiyahBagian"); // halaman tujuan setelah login berhasil
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [authError, setAuthError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [lockToast, setLockToast] = useState(false);
  const [slInExercise, setSlInExercise] = useState(false); // Subject Language sedang di layar soal
  const lessonLocked = page === "ammiyahLesson" || (page === "subject" && slInExercise);
  const lockedRef = useRef(false);
  lockedRef.current = lessonLocked;
  const pageRef = useRef(page);
  pageRef.current = page;
  const lockToastTimer = useRef(null);
  const flashLockToast = () => {
    setLockToast(true);
    clearTimeout(lockToastTimer.current);
    lockToastTimer.current = setTimeout(() => setLockToast(false), 2600);
  };
  const [authLoading, setAuthLoading] = useState(false);
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    if (!sidebarOpen) return;
    const t = setTimeout(() => { const el = document.getElementById("sb-active"); if (el && el.scrollIntoView) el.scrollIntoView({ block: "center" }); }, 120);
    return () => clearTimeout(t);
  }, [sidebarOpen]);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMsg, setContactMsg] = useState("");
  const mainContentRef = useRef(null);

  // Setiap ganti materi/lesson, otomatis scroll balik ke paling atas
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo({ top: 0, behavior: "auto" });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [activeLesson]);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 640 : false
  );

  // Pantau lebar layar supaya navbar bisa berubah jadi mode scroll di HP
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Ambil materi dari Notion saat web pertama kali dibuka (data segar di
  // background; kalau ada cache, halaman sudah tampil duluan tanpa nunggu ini)
  useEffect(() => {
    fetch("/api/materi")
      .then((res) => res.json())
      .then((data) => {
        if (data.lessons && data.lessons.length > 0) {
          const grouped = groupLessonsByCourse(data.lessons);
          setCourses(grouped);
          saveCoursesCache(grouped);

          // Kalau tadinya belum ada cache (jadi belum sempat ke-restore ke
          // course/lesson yang dituju URL), coba restore lagi sekarang
          // setelah data asli tersedia.
          setActiveCourse((prevCourse) => {
            if (prevCourse) return prevCourse;
            const restored = readUrlState(grouped);
            if (restored.page === "course" && restored.course) {
              setActiveLesson(restored.lesson);
              setPage("course");
              return restored.course;
            }
            return prevCourse;
          });
        }
        setLoadingMateri(false);
      })
      .catch(() => {
        // Kalau gagal fetch (misal: offline atau belum setup), pakai data contoh/cache yang ada
        setLoadingMateri(false);
      });
  }, []);

  // Setiap page/course/lesson berubah, update URL supaya bisa di-share & tahan reload.
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", page);
    if (page === "course" && activeCourse) {
      params.set("course", activeCourse.id);
      if (activeLesson) params.set("lesson", activeLesson.id);
    }
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, "", newUrl);
  }, [page, activeCourse, activeLesson]);

  // Dukung tombol Back/Forward browser
  useEffect(() => {
    const handlePopState = () => {
      if (lockedRef.current) {
        // Sedang di pelajaran: batalkan Back/Forward, kembalikan URL, ingatkan lewat toast.
        window.history.pushState({}, "", `${window.location.pathname}?page=${pageRef.current}`);
        flashLockToast();
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const urlPage = params.get("page") || "home";
      const urlCourseId = params.get("course");
      const urlLessonId = params.get("lesson");

      if (urlPage === "ammiyah") {
        setPage("ammiyah");
        return;
      }
      if (urlPage === "ammiyahBagian") {
        setPage("ammiyahBagian");
        return;
      }
      if (urlPage === "ammiyahPath") {
        setPage("ammiyahPath");
        return;
      }
      if (urlPage === "course" && urlCourseId) {
        const course = courses.find((c) => c.id === urlCourseId);
        if (course) {
          const lesson = urlLessonId
            ? course.lessons.find((l) => l.id === urlLessonId)
            : course.lessons[0];
          setActiveCourse(course);
          setActiveLesson(lesson || course.lessons[0]);
          setPage("course");
          return;
        }
      }
      setPage(urlPage);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [courses]);

  // Selama pelajaran: tombol Back browser dan tutup tab tidak boleh keluar diam-diam.
  useEffect(() => {
    if (!lessonLocked) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [lessonLocked]);

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

  const goContact = () => {
    setPage("contact");
    setSidebarOpen(false);
  };

  const goAmmiyah = () => {
    setPage("ammiyah");
    setSidebarOpen(false);
  };

  const goSubject = () => {
    setSlAutoResume(false);
    setPage("subject");
    setSidebarOpen(false);
  };

  const updateAuthForm = (field, value) => {
    setAuthForm((f) => ({ ...f, [field]: value }));
    setAuthError("");
  };

  // Login/register beneran lewat Supabase Auth. `setCurrentUser` di sini
  // TIDAK dipanggil manual — begitu signIn/signUp berhasil, Supabase
  // otomatis trigger event di onAuthStateChange (effect di atas) yang
  // nge-update currentUser dari situ. Di sini cuma perlu handle
  // loading/error state + pindah halaman kalau sukses.
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    // Keyboard HP sering menambah huruf kapital di awal / spasi di akhir email — bersihkan dulu.
    const cleanEmail = (authForm.email || "").trim().toLowerCase();

    if (!cleanEmail || !authForm.password) {
      setAuthError("Email dan password wajib diisi.");
      return;
    }
    if (authMode === "register") {
      if (!authForm.name) { setAuthError("Nama wajib diisi."); return; }
      if (authForm.password.length < 6) { setAuthError("Password minimal 6 karakter."); return; }
      if (authForm.password !== authForm.confirmPassword) { setAuthError("Konfirmasi password tidak cocok."); return; }
    }

    setAuthLoading(true);
    try {
      if (authMode === "register") {
        const { error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: authForm.password,
          options: { data: { name: authForm.name.trim() } },
        });
        if (error) throw error;
        // Kalau project Supabase kamu masih mewajibkan verifikasi email
        // (Confirm email = ON di Authentication settings), user BELUM
        // otomatis login di sini — mereka perlu klik link di email dulu.
        // Kalau mau langsung bisa login tanpa verifikasi (cocok buat masa
        // development), matikan "Confirm email" di Supabase → Authentication
        // → Providers → Email.
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: authForm.password,
        });
        if (error) throw error;
      }
      setAuthForm({ name: "", email: "", password: "", confirmPassword: "" });
      setPage(authRedirectTarget);
      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (err) {
      // Pesan error Supabase asalnya bahasa Inggris — beberapa yang
      // paling sering muncul diterjemahkan biar lebih jelas buat user.
      const msg = err.message || "";
      if (msg.includes("Invalid login credentials")) {
        setAuthError("Email atau password salah.");
      } else if (msg.includes("Email not confirmed")) {
        setAuthError(lx("Email belum diverifikasi — klik link verifikasi yang dikirim ke emailmu dulu.", "Email not verified yet — click the verification link we sent you first."));
      } else if (/failed to fetch|network/i.test(msg)) {
        setAuthError(lx("Koneksi bermasalah — periksa internet lalu coba lagi.", "Connection problem — check your internet and try again."));
      } else if (msg.includes("User already registered")) {
        setAuthError("Email ini sudah terdaftar — coba masuk saja.");
      } else {
        setAuthError(msg || "Terjadi kesalahan, coba lagi.");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // Login pakai Google — ini cuma MEMULAI redirect ke halaman consent
  // Google, bukan menyelesaikan proses login (makanya gak ada
  // setCurrentUser di sini). Setelah user approve di Google, browser
  // diarahkan balik ke web ini, dan onAuthStateChange (effect di atas)
  // yang nangkep sesi login barunya.
  const handleGoogleAuth = async () => {
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
    // Kalau sukses, browser langsung redirect ke Google — kode setelah
    // baris ini gak akan sempat jalan, gak perlu setAuthLoading(false) lagi.
  };

  const renderLoginRequired = () => (
    <div style={s.authPage}>
      <div style={{ ...s.authCard, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          {page === "subject" ? <span style={{ display: "inline-flex", width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", background: GREEN_DARK, color: "white" }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /></svg></span> : <JordanFlag size={40} />}
        </div>
        <div style={s.authTitle}>{t("loginPromptTitle", uiLang)}</div>
        <p style={{ ...s.authSubtitle, marginBottom: 24 }}>
          {page === "subject"
            ? (uiLang === "en" ? "The Subject Language feature is only available once you're logged in." : "Fitur Subject Language cuma bisa diakses kalau kamu sudah masuk ke akun.")
            : t("loginPromptDesc", uiLang)}
        </p>
        <button
          className="ls-press"
          style={s.authSubmitBtn}
          onClick={() => { setAuthRedirectTarget(page); setAuthMode("login"); setPage("login"); }}
        >
          {t("loginPromptBtn", uiLang)}
        </button>
      </div>
    </div>
  );

  const renderProfile = () => {
    const u = currentUser;
    if (!u) return renderLogin();
    const initial = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
    const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString(uiLang === "en" ? "en-US" : "id-ID", { year: "numeric", month: "long" }) : null;
    const providerLabel = u.provider === "google" ? "Google" : "Email";
    const row = (label, value) => (
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "13px 0", borderBottom: "1px solid #eef2f0", fontSize: 14 }}>
        <span style={{ color: "#8a9692" }}>{label}</span>
        <span style={{ color: "#1a2421", fontWeight: 600, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
      </div>
    );
    return (
      <div style={s.authPage}>
        <div style={{ ...s.authCard, textAlign: "center" }} className="ls-enter">
          {u.avatarUrl ? (
            <img src={u.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 84, height: 84, borderRadius: "50%", objectFit: "cover", margin: "4px auto 14px", display: "block", boxShadow: "0 6px 18px rgba(30,70,50,0.18)" }} />
          ) : (
            <div style={{ width: 84, height: 84, borderRadius: "50%", margin: "4px auto 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800, color: "white", background: `linear-gradient(135deg, ${GREEN}, ${GREEN_DARK})`, boxShadow: "0 6px 18px rgba(30,70,50,0.18)" }}>{initial}</div>
          )}
          <div style={{ fontSize: 21, fontWeight: 800, color: "#1a2421" }}>{u.name}</div>
          <div style={{ fontSize: 13.5, color: "#7a8782", marginTop: 3 }}>{u.email}</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, fontWeight: 700, color: "#2e7d5b", background: "#E6F4EC", padding: "5px 12px", borderRadius: 999 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2e9e6b" }} />
            {lx("Sudah masuk", "Signed in")}
          </div>

          <div style={{ textAlign: "left", margin: "22px 0 20px" }}>
            {row(lx("Masuk lewat", "Signed in with"), providerLabel)}
            {joined && row(lx("Bergabung", "Joined"), joined)}
          </div>

          <button className="ls-press" style={s.authSubmitBtn} onClick={() => { setPage("ammiyahBagian"); window.scrollTo({ top: 0, behavior: "auto" }); }}>
            {lx("Lanjut belajar Levantine", "Continue learning Levantine")}
          </button>
          <button className="ls-press" style={{ ...s.authSubmitBtn, marginTop: 10, background: "white", color: "#c23b3b", border: "1.5px solid #f0d4d4", boxShadow: "none" }}
            onClick={() => { supabase.auth.signOut(); setPage("home"); window.scrollTo({ top: 0, behavior: "auto" }); }}>
            {lx("Keluar", "Log out")}
          </button>
        </div>
      </div>
    );
  };

  const renderLogin = () => {
    if (currentUser) return renderProfile();
    const isRegister = authMode === "register";
    const isAmmiyahRedirect = authRedirectTarget && authRedirectTarget.startsWith("ammiyah");
    const switchMode = (m) => { setAuthMode(m); setAuthError(""); };
    const tabBtn = (m, label) => (
      <button
        type="button" role="tab" aria-selected={authMode === m} onClick={() => switchMode(m)}
        style={{ flex: 1, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, padding: "9px 0", borderRadius: 10,
          background: authMode === m ? "white" : "transparent", color: authMode === m ? "#1a2421" : "#7a8782",
          boxShadow: authMode === m ? "0 1px 3px rgba(20,40,30,0.12)" : "none", transition: "background .15s ease, color .15s ease, box-shadow .15s ease" }}
      >{label}</button>
    );
    const pwToggle = (
      <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? lx("Sembunyikan password", "Hide password") : lx("Tampilkan password", "Show password")}
        style={{ position: "absolute", right: 6, top: 4, height: 36, padding: "0 10px", background: "none", border: "none", cursor: "pointer", color: "#7a8782", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit" }}>
        {showPw ? lx("Sembunyi", "Hide") : lx("Lihat", "Show")}
      </button>
    );
    return (
      <div style={s.authPage}>
        <div style={s.authCard} className="ls-enter">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <img src="/logo-learningspace.png" alt="LearningSpace" style={{ height: 46, width: "auto", display: "block" }} />
          </div>

          <div role="tablist" style={{ display: "flex", gap: 4, background: "#eef3f0", borderRadius: 12, padding: 4, marginBottom: 22 }}>
            {tabBtn("login", lx("Masuk", "Log in"))}
            {tabBtn("register", lx("Daftar", "Sign up"))}
          </div>

          <div style={s.authTitle}>{isRegister ? t("authTitleRegister", uiLang) : t("authTitleLogin", uiLang)}</div>
          <div style={s.authSubtitle}>
            {isRegister ? t("authSubtitleRegister", uiLang) : t("authSubtitleLogin", uiLang)}
          </div>

          {isAmmiyahRedirect && (
            <div style={s.authBanner}>
              <JordanFlag size={22} />
              <span>{t("authAmmiyahBanner", uiLang)}</span>
            </div>
          )}

          {authError && <div style={s.authError} role="alert">{authError}</div>}

          <button className="ls-press" style={{ ...s.authGoogleBtn, opacity: authLoading ? 0.7 : 1 }} onClick={handleGoogleAuth} disabled={authLoading}>
            <GoogleIcon size={18} /> {lx("Lanjutkan dengan Google", "Continue with Google")}
          </button>

          <div style={s.authDividerRow}>
            <span style={s.authDividerLine} /> {lx("atau dengan email", "or with email")} <span style={s.authDividerLine} />
          </div>

          <form onSubmit={handleAuthSubmit} noValidate>
            {isRegister && (
              <div>
                <label style={s.authLabel} htmlFor="auth-name">{lx("Nama", "Name")}</label>
                <input id="auth-name" className="auth-input" style={s.authInput} type="text" autoComplete="name" placeholder={lx("Nama kamu", "Your name")}
                  value={authForm.name} onChange={(e) => updateAuthForm("name", e.target.value)} />
              </div>
            )}
            <label style={s.authLabel} htmlFor="auth-email">Email</label>
            <input id="auth-email" className="auth-input" style={s.authInput} type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="nama@email.com"
              value={authForm.email} onChange={(e) => updateAuthForm("email", e.target.value)} />
            <label style={s.authLabel} htmlFor="auth-password">Password</label>
            <div style={{ position: "relative" }}>
              <input id="auth-password" className="auth-input" style={{ ...s.authInput, paddingRight: 72 }} type={showPw ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="••••••••"
                value={authForm.password} onChange={(e) => updateAuthForm("password", e.target.value)} />
              {pwToggle}
            </div>
            {isRegister && (
              <div>
                <label style={s.authLabel} htmlFor="auth-confirm">{lx("Konfirmasi Password", "Confirm Password")}</label>
                <input id="auth-confirm" className="auth-input" style={s.authInput} type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="••••••••"
                  value={authForm.confirmPassword} onChange={(e) => updateAuthForm("confirmPassword", e.target.value)} />
              </div>
            )}
            <button type="submit" className="ls-press" style={{ ...s.authSubmitBtn, opacity: authLoading ? 0.7 : 1 }} disabled={authLoading}>
              {authLoading ? lx("Memproses...", "Please wait...") : isRegister ? lx("Buat Akun", "Create Account") : lx("Masuk", "Log in")}
            </button>
          </form>

          <div style={s.authToggleRow}>
            {isRegister ? lx("Sudah punya akun? ", "Already have an account? ") : lx("Belum punya akun? ", "New here? ")}
            <button style={s.authToggleLink} onClick={() => switchMode(isRegister ? "login" : "register")}>
              {isRegister ? lx("Masuk", "Log in") : lx("Daftar", "Sign up")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Handler untuk anchor tag: cegah reload penuh browser, biar tetap SPA,
  // tapi href-nya tetap ada jadi bisa di-copy/klik-kanan/buka tab baru.
  const navLinkClick = (fn) => (e) => {
    e.preventDefault();
    if (lockedRef.current) { flashLockToast(); return; }
    fn();
  };

  // Pindah ANTAR FITUR (mis. ke Levantine / Subject Language): tampilkan loading singkat + keterangan.
  const [featureLoading, setFeatureLoading] = useState(null);
  const featureLinkClick = (fn, target) => (e) => {
    e.preventDefault();
    if (lockedRef.current) { flashLockToast(); return; }
    const already = target === "subject" ? page === "subject" : page.startsWith("ammiyah");
    if (already) { fn(); return; }
    const en = uiLang === "en";
    setSidebarOpen(false);
    setFeatureLoading(target === "subject"
      ? { label: en ? "Opening Subject Language..." : "Membuka Subject Language...", sub: en ? "Getting your subjects ready" : "Menyiapkan mata pelajaranmu" }
      : { label: en ? "Opening Levantine..." : "Membuka Levantine...", sub: en ? "Getting your Levantine lessons ready" : "Menyiapkan pelajaran Levantine-mu" });
    setTimeout(() => {
      fn();
      setFeatureLoading(null);
      window.scrollTo({ top: 0, behavior: "auto" });
    }, 600);
  };

  const submitContact = () => {
    if (!contactName.trim() || !contactEmail.trim() || !contactMsg.trim()) {
        alert(lx("Mohon isi semua kolom terlebih dahulu.", "Please fill in all fields."));
        return;
      }
    if (!/^\S+@\S+\.\S+$/.test(contactEmail.trim())) {
        alert(lx("Alamat email tidak valid.", "Please enter a valid email address."));
        return;
      }
      setContactSending(true);
      emailjs.send(
        'service_noteskey',
        'template_z4bedwg',
        {
          name: contactName.trim(),
          email: contactEmail.trim(),
          message: contactMsg,
          title: "LearningSpace by Kyo",
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

  // Palet warna per unit di learning path — bergantian tiap unit, siklus 5
  // warna (hijau → biru → merah → kuning → oranye), lalu balik ke hijau lagi
  // mulai unit ke-6, dan seterusnya.
  const BLUE = "#4A9FD6";
  const BLUE_DARK = "#3A80AD";
  const RED = "#E0555A";
  const RED_DARK = "#B33F44";
  const YELLOW = "#E0B23D";
  const YELLOW_DARK = "#B38A2E";
  const ORANGE = "#E0893D";
  const ORANGE_DARK = "#B36B2E";
  const UNIT_COLORS = [
    { bg: GREEN, dark: GREEN_DARK },
    { bg: BLUE, dark: BLUE_DARK },
    { bg: RED, dark: RED_DARK },
    { bg: YELLOW, dark: YELLOW_DARK },
    { bg: ORANGE, dark: ORANGE_DARK },
  ];

  // Tinggi navbar: di HP navbar dua baris (logo+akun, lalu menu), jadi offset 'sticky' harus ikut.
  const NAV_H = isMobile ? 108 : 56;
  const s = {
    root: { fontFamily: "'AmiriAr', 'Segoe UI', Arial, sans-serif", minHeight: "100vh", background: "#f6f8f7", color: "#1a1a1a" },
    // NAVBAR
    navbar: {
      background: GREEN,
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 60,
      position: "sticky",
      top: 0,
      zIndex: 100,
    },
    navLogo: { color: "white", fontSize: 20, fontWeight: "bold", cursor: "pointer", lineHeight: 1, fontFamily: "'Julius Sans One', sans-serif", letterSpacing: 2 },
    navLogoSub: { color: "rgba(255,255,255,0.75)", fontSize: 11, fontWeight: "normal" },
    navLinks: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      flexWrap: isMobile ? "nowrap" : "wrap",
      justifyContent: isMobile ? "flex-start" : "flex-end",
      overflowX: isMobile ? "auto" : "visible",
      WebkitOverflowScrolling: "touch",
      scrollbarWidth: "none",
      maxWidth: isMobile ? "calc(100vw - 120px)" : "none",
    },
    navLink: {
      color: "white",
      background: "transparent",
      border: "none",
      padding: "6px 14px",
      borderRadius: 6,
      cursor: "pointer",
      fontSize: 13.5,
      fontFamily: "inherit",
      flexShrink: 0,
      whiteSpace: "nowrap",
    },
    navLinkActive: {
      color: GREEN,
      background: "white",
      border: "none",
      padding: "6px 14px",
      borderRadius: 6,
      cursor: "pointer",
      fontFamily: "inherit",
      fontWeight: 700,
      fontSize: 13.5,
      flexShrink: 0,
      whiteSpace: "nowrap",
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
    heroTitle: { color: "white", fontSize: "clamp(36px, 8vw, 60px)", fontWeight: "normal", marginBottom: 20, lineHeight: 1.1, fontFamily: "'Julius Sans One', sans-serif", letterSpacing: 4 },
    heroTitleSub: { color: "rgba(255,255,255,0.85)", fontSize: "clamp(13px, 2vw, 16px)", fontWeight: "bold", marginBottom: 16, letterSpacing: 1 },
    heroDesc: { color: "rgba(255,255,255,0.9)", fontSize: "clamp(14px, 2.5vw, 16px)", width: "100%", maxWidth: "600", boxSizing: "border-box", lineHeight: 1.7, textAlign: "center", margin: "0 auto 32px", padding: "0 24px" },
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
    footerLink: { color: "rgba(255,255,255,0.85)", fontSize: 13, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", textAlign: isMobile ? "center" : "right", padding: isMobile ? "8px 10px" : 0 },

    // EXPLORE
    exploreSection: { padding: "40px 24px", maxWidth: 1000, margin: "0 auto" },
    exploreTitle: { fontSize: 28, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.3px", marginBottom: 8 },
    searchWrap: {
      display: "flex",
      alignItems: "center",
      background: "white",
      border: "1px solid #e3e9e6",
      borderRadius: 999,
      padding: "10px 18px",
      maxWidth: 380,
      margin: "0 auto 34px",
      gap: 10,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    },
    searchInput: { border: "none", outline: "none", fontSize: 14, fontFamily: "inherit", width: "100%", background: "transparent" },
    courseCountChip: { position: "absolute", left: 10, bottom: 10, display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.94)", borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 600, color: "#3d4742" },
    courseCardAr: { fontSize: 17, color: GREEN_DARK, fontFamily: "'Amiri', 'Noto Naskh Arabic', 'Traditional Arabic', serif", lineHeight: 1.6, marginBottom: 6 },
    courseCardGo: { display: "flex", alignItems: "center", gap: 4, marginTop: 12, fontSize: 12.5, fontWeight: 600, color: GREEN_DARK },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 22 },
    courseCard: { background: "white", border: "1px solid #e8eeeb", borderRadius: 16, overflow: "hidden", cursor: "pointer", boxShadow: "0 2px 10px rgba(30,60,50,0.06)", transition: "transform .18s ease, box-shadow .18s ease" },
    courseThumb: { width: "100%", height: 160, objectFit: "cover", background: GREEN_BG, display: "block" },
    courseCardBody: { padding: "14px 16px 16px" },
    courseCardTitle: { fontSize: 15.5, fontWeight: 700, color: "#1a1a1a", marginBottom: 2, lineHeight: 1.35 },
    courseCardDesc: { fontSize: 12.5, color: "#7a8581", lineHeight: 1.55 },

    // COURSE
    courseLayout: { display: "flex", minHeight: `calc(100vh - ${NAV_H}px)`, position: "relative" },
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(20,32,27,0.42)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", zIndex: 250 },
    sidebar: {
      width: "min(310px, 86vw)",
      background: "white",
      borderRight: "1px solid #e3e9e6",
      boxShadow: sidebarOpen ? "8px 0 30px rgba(20,40,30,0.16)" : "none",
      position: "fixed",
      top: NAV_H,
      left: 0,
      height: `calc(100vh - ${NAV_H}px)`,
      zIndex: 300,
      transform: sidebarOpen ? "translateX(0)" : "translateX(-102%)",
      transition: "transform 0.28s cubic-bezier(.2,.8,.2,1), box-shadow 0.28s ease",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
    },
    sidebarList: {
      flex: 1,
      minHeight: 0,
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      overscrollBehavior: "contain",
      padding: "6px 0 12px",
    },
    sidebarFooter: {
      flexShrink: 0,
      borderTop: "1px solid #eef2f0",
      background: "white",
      padding: "12px 14px calc(12px + env(safe-area-inset-bottom, 0px))",
    },
    sidebarTitle: { fontSize: 15.5, fontWeight: 800, color: "#1a2421", lineHeight: 1.35 },
    lessonItem: {
      padding: "9px 12px",
      margin: "2px 10px",
      borderRadius: 12,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: 12,
      fontSize: 14,
      lineHeight: 1.35,
      color: "#3b4743",
      minHeight: 48,
      boxSizing: "border-box",
    },
    lessonItemActive: { background: GREEN_BG, color: GREEN_DARK, fontWeight: 700, boxShadow: `inset 3px 0 0 ${GREEN}` },
    lessonDivider: { height: 1, background: "#f0f0f0", margin: "4px 16px" },
    toggleBtn: {
      position: "fixed",
      top: NAV_H + 10,
      left: 12,
      zIndex: 200,
      background: "white",
      color: "#26332e",
      border: "1px solid #e3e9e6",
      borderRadius: 999,
      padding: "8px 14px 8px 12px",
      cursor: "pointer",
      fontSize: 13.5,
      fontWeight: 700,
      fontFamily: "inherit",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      boxShadow: "0 4px 14px rgba(20,40,30,0.14)",
    },
    
    articleWrap: {
      maxWidth: 680,
      margin: "0 auto",
      padding: "0 64px ",
    },
    contentTitle: { fontFamily: "' Segoe UI', Arial, sans-serif", fontSize: "clamp(18px, 4vw, 26px)", fontWeight: "bold", color: "#1a1a1a", marginBottom: 4, paddingBottom: 10, borderBottom: `2px solid ${GREEN}` },
    contentSubTitle: { fontFamily: "' Segoe UI', Arial, sans-serif", fontSize: 15, fontWeight: "bold", color: "#555", marginBottom: 20, paddingBottom: 10, borderBottom: "1px solid #eee" },
    videoWrapper: { position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 10, overflow: "hidden", marginBottom: 20, background: "#e0e0e0" },
    videoIframe: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" },
    noteBox: { background: GREEN_BG, border: `1px solid ${GREEN}`, borderLeft: `4px solid ${GREEN}`, borderRadius: 8, padding: "12px 16px", marginTop: 20 },
    noteTitle: { fontSize: 11, fontWeight: "bold", color: GREEN_DARK, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
    noteText: { fontSize: 13, color: "#444", lineHeight: 1.6 },
    navBtns: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 28 },
    prevBtn: { background: "white", color: "#1a1a1a", border: "1px solid #ddd", padding: "10px 20px", borderRadius: 50, fontSize: 18, cursor: "pointer" },
    nextBtn: { background: "white", color: "#1a1a1a", border: "1px solid #ddd", padding: "10px 20px", borderRadius: 50, fontSize: 18, cursor: "pointer" },
    backBtn: { background: "white", color: "#555", border: "1px solid #ddd", padding: "8px 16px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit", width: "100%" },

    // CONTACT PAGE
    contactPage: { maxWidth: 520, margin: "40px auto", padding: "0 20px" },
    contactTitle: { fontSize: 28, fontWeight: "bold", marginBottom: 10 },
    contactDesc: { fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 28 },
    contactSection: { fontSize: 16, fontWeight: "bold", marginBottom: 16 },
    formRow: { display: "flex", gap: 12, marginBottom: 12 },
    formInput: { flex: 1, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "inherit", outline: "none" },
    formTextarea: { width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, fontFamily: "inherit", minHeight: 100, resize: "vertical", boxSizing: "border-box", outline: "none" },
    submitBtn: { background: "#1a1a1a", color: "white", border: "none", padding: "12px", width: "100%", borderRadius: 6, fontSize: 14, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit", marginTop: 12 },

    // AMMIYAH — INTRO / LANDING
    introHero: { maxWidth: 560, margin: "0 auto", padding: "36px 22px 72px", textAlign: "center" },
    introFlagRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 },
    langSelectBox: { display: "flex", alignItems: "center", gap: 6, background: "white", border: "1px solid #e3e9e6", borderRadius: 999, padding: "6px 12px" },
    langSelectDropdown: { border: "none", background: "transparent", fontSize: 13, fontWeight: 600, color: "#1a1a1a", cursor: "pointer", outline: "none" },
    introTitle: { fontSize: 28, fontWeight: 700, color: "#1a2421", lineHeight: 1.25, letterSpacing: -0.3, marginBottom: 12 },
    introDesc: { fontSize: 15, color: "#5f6b66", lineHeight: 1.7, marginBottom: 32 },
    introFeatureLabel: { fontSize: 12, fontWeight: 700, color: "#8a9892", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 14, textAlign: "left" },
    introFeatureList: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 36 },
    introFeatureItem: { display: "flex", alignItems: "center", gap: 14, textAlign: "left", background: "white", border: "1px solid #e8eeeb", borderRadius: 16, padding: "14px 16px" },
    introFeatureIcon: { width: 42, height: 42, borderRadius: 12, background: GREEN_BG, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, color: GREEN_DARK, fontWeight: 700 },
    introFeatureTitle: { fontSize: 15, fontWeight: 600, color: "#1a2421", marginBottom: 2 },
    introFeatureDesc: { fontSize: 13.5, color: "#6b7772", lineHeight: 1.5 },
    introCta: { width: "100%", background: GREEN_DARK, color: "white", border: "none", borderRadius: 16, padding: "16px", fontSize: 15, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer", boxShadow: "0 8px 20px rgba(90,138,121,0.30)" },
    // Tombol utama & kartu bersama (dipakai Levantine + Subject Language)
    lessonMainBtn: { width: "100%", border: "none", borderRadius: 16, padding: "15px", fontSize: 15, fontWeight: 700, letterSpacing: 0.6, cursor: "pointer", fontFamily: "inherit", display: "block", margin: "0 auto" },
    card: { background: "white", border: "1px solid #e8eeeb", borderRadius: 18, padding: "16px 18px", marginBottom: 14, boxShadow: "0 1px 2px rgba(20,40,30,0.04), 0 8px 24px rgba(20,40,30,0.05)" },

    // AUTH (Login/Register)
    authPage: { minHeight: `calc(100vh - ${NAV_H}px)`, display: "flex", alignItems: isMobile ? "flex-start" : "center", justifyContent: "center", padding: isMobile ? "24px 16px 40px" : "36px 18px", background: "radial-gradient(900px 420px at 50% -10%, #e4efe9 0%, rgba(228,239,233,0) 70%), #f6f9f7" },
    authCard: { width: "100%", maxWidth: 420, background: "white", borderRadius: 24, padding: "34px 30px 28px", border: "1px solid #e8eeeb", boxShadow: "0 1px 2px rgba(20,40,30,0.04), 0 16px 40px rgba(20,40,30,0.07)", boxSizing: "border-box" },
    authTitle: { fontSize: 22, fontWeight: 800, color: "#1a2421", textAlign: "center", marginBottom: 6, letterSpacing: "-0.2px" },
    authSubtitle: { fontSize: 13.5, color: "#7a8782", textAlign: "center", marginBottom: 22, lineHeight: 1.55 },
    authBanner: { display: "flex", alignItems: "center", gap: 10, background: "#f1f7f4", border: "1px solid #dcebe4", borderRadius: 12, padding: "11px 13px", marginBottom: 20, fontSize: 12.5, color: "#4a6358", lineHeight: 1.5 },
    authLabel: { fontSize: 12.5, fontWeight: 600, color: "#4a5753", marginBottom: 6, display: "block" },
    authInput: { width: "100%", border: "1.5px solid #e3e9e6", borderRadius: 12, padding: "12px 14px", fontSize: 14.5, marginBottom: 14, boxSizing: "border-box", outline: "none", background: "#fbfcfc", fontFamily: "inherit", color: "#1a2421" },
    authError: { background: "#fdf0ef", color: "#b8403f", border: "1px solid #f5d4d2", borderRadius: 12, padding: "10px 14px", fontSize: 13, marginBottom: 16, textAlign: "left", lineHeight: 1.5 },
    authSubmitBtn: { width: "100%", background: GREEN_DARK, color: "white", border: "none", borderRadius: 14, padding: "14px", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 18px rgba(90,138,121,0.28)", marginTop: 4, marginBottom: 6, fontFamily: "inherit", letterSpacing: 0.3 },
    authDividerRow: { display: "flex", alignItems: "center", gap: 12, margin: "20px 0", color: "#9aa6a1", fontSize: 12 },
    authDividerLine: { flex: 1, height: 1, background: "#e8eeeb" },
    authGoogleBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "white", border: "1.5px solid #e3e9e6", borderRadius: 14, padding: "12px", fontSize: 14.5, fontWeight: 600, color: "#2b3733", cursor: "pointer", marginBottom: 0, fontFamily: "inherit" },
    authToggleRow: { textAlign: "center", fontSize: 13.5, color: "#7a8782", marginTop: 18 },
    authToggleLink: { color: GREEN_DARK, fontWeight: 700, cursor: "pointer", background: "none", border: "none", fontSize: 13.5, padding: 0, fontFamily: "inherit" },

    // AMMIYAH
    ammiyahBackBtn: { background: "white", border: "1px solid #e3e9e6", width: 36, height: 36, borderRadius: "50%", fontSize: 20, color: "#5f6b66", cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, padding: 0 },
    ammiyahPage: { maxWidth: 640, margin: "0 auto", padding: "28px 20px 72px" },
    ammiyahHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 22 },
    ammiyahTitle: { fontSize: 21, fontWeight: 700, color: "#1a2421", letterSpacing: -0.2 },
    ammiyahSubtitle: { fontSize: 13, color: "#7a8782", marginTop: 2 },
    bagianCard: { background: "white", border: "1px solid #e8eeeb", borderRadius: 18, padding: "18px 20px", marginBottom: 14, boxShadow: "0 1px 2px rgba(20,40,30,0.04), 0 8px 24px rgba(20,40,30,0.05)", cursor: "pointer", transition: "border-color 0.15s ease, transform 0.15s ease" },
    bagianCardTop: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    bagianCardTitle: { fontSize: 17, fontWeight: "bold", color: "#1a1a1a" },
    bagianRange: { display: "flex", alignItems: "center", gap: 6, background: "#eef4f1", color: GREEN_DARK, fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 20 },
    bagianTrackRow: { display: "flex", alignItems: "center", gap: 10 },
    bagianTrack: { flex: 1, height: 8, borderRadius: 20, background: "#e9eeec", overflow: "hidden" },
    bagianFill: { height: "100%", borderRadius: 20, background: `linear-gradient(90deg, ${GREEN}, ${GREEN_DARK})`, transition: "width 0.3s ease" },
    bagianPercent: { fontSize: 12, fontWeight: "bold", color: GREEN_DARK, minWidth: 34, textAlign: "right" },
    bagianSunNode: { width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, border: "none", background: "linear-gradient(135deg, #FFA23A, #F2790C)", color: "white", cursor: "pointer", boxShadow: "0 4px 10px rgba(242,121,12,0.28)", flexShrink: 0, position: "relative" },
    bagianSunRingWrap: { position: "relative", width: 46, height: 46, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    bagianSunRing: { position: "absolute", inset: 0, borderRadius: "50%" },
    bagianSunNodeLocked: { background: "#eceff0", color: "#aab3b0", cursor: "default", boxShadow: "none" },
    bagianSunBubble: { position: "absolute", top: "100%", right: 0, marginTop: 10, width: 240, background: "#fff", border: "1px solid #e3e9e6", borderRadius: 14, padding: "12px", boxShadow: "0 10px 28px rgba(0,0,0,0.12)", zIndex: 150 },
    bubbleHead: { display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 },
    bubbleIcon: { width: 30, height: 30, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
    bagianSunBubbleTail: { position: "absolute", top: -6, right: 18, width: 11, height: 11, background: "#fff", borderLeft: "1px solid #e3e9e6", borderTop: "1px solid #e3e9e6", transform: "rotate(45deg)" },
    bagianSunBubbleText: { color: "#3d4742", fontSize: 12.5, fontWeight: 500, lineHeight: 1.5, textAlign: "left", flex: 1 },
    bagianSunBubbleBtn: { flex: 1, background: "#1f6f4a", color: "white", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
    bagianSunBubbleClose: { background: "#f1f5f3", color: "#5b6862", border: "none", borderRadius: 9, padding: "8px 11px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" },

    // AMMIYAH — LEARNING PATH (units + levels)
    unitBannerWrap: { position: "sticky", top: NAV_H, zIndex: 90, padding: "14px 20px 8px", background: "linear-gradient(#fff 60%, rgba(255,255,255,0))" },
    unitBanner: { maxWidth: 460, margin: "0 auto", borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 6px 14px rgba(0,0,0,0.15)" },
    unitBannerClose: { background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", lineHeight: 1 },
    unitBannerText: { color: "white", flex: 1 },
    unitBannerLabel: { fontSize: 11, opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "bold" },
    unitBannerTopic: { fontSize: 15, fontWeight: "bold", marginTop: 2, lineHeight: 1.25 },
    unitBannerDivider: { width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.35)" },
    unitBannerIcon: { background: "none", border: "none", color: "white", fontSize: 20, cursor: "pointer", opacity: 0.9 },
    unitDividerBox: { maxWidth: 340, margin: "28px auto", padding: "10px 18px", borderRadius: 12, color: "white", fontSize: 13, fontWeight: "bold", textAlign: "center", boxShadow: "0 3px 8px rgba(0,0,0,0.12)" },
    pathWrap: { maxWidth: 480, margin: "0 auto", padding: "56px 20px 60px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 },
    pathNodeCol: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
    pathRingWrap: { position: "relative", width: 84, height: 84, display: "flex", alignItems: "center", justifyContent: "center" },
    pathNode: { position: "relative", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23, border: "3px solid rgba(255,255,255,0.9)", cursor: "pointer", boxShadow: "0 6px 14px rgba(0,0,0,0.12)", boxSizing: "border-box" },
    pathNodeDone: { color: "white" },
    pathNodeCurrent: { color: "white" },
    pathNodeLocked: { background: "#eceff0", color: "#aab3b0", cursor: "default", boxShadow: "none" },
    pathNodeLabel: { fontSize: 11, color: "#888", fontWeight: "bold" },
    vocabReviewNode: { position: "relative", width: 64, height: 64, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, border: "2px solid #A9762F", background: "#FFF6E0", color: "#A9762F", cursor: "pointer", boxShadow: "0 6px 14px rgba(196,136,26,0.22)" },
    vocabReviewNodeLocked: { background: "#eceff0", color: "#aab3b0", cursor: "default", boxShadow: "none" },
    vocabReviewRing: { position: "absolute", inset: 0, borderRadius: "50%" },
    vocabReviewBubble: { position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", marginTop: 14, width: 250, background: "#fff", border: "1px solid #e3e9e6", borderRadius: 14, padding: "12px", boxShadow: "0 10px 28px rgba(0,0,0,0.12)", zIndex: 150 },
    vocabReviewBubbleTail: { position: "absolute", top: -6, left: "50%", marginLeft: -5, width: 11, height: 11, background: "#fff", borderLeft: "1px solid #e3e9e6", borderTop: "1px solid #e3e9e6", transform: "rotate(45deg)" },
    vocabReviewBubbleText: { color: "#3d4742", fontSize: 12.5, fontWeight: 500, lineHeight: 1.5, textAlign: "left", flex: 1 },
    vocabReviewBubbleBtn: { flex: 1, background: "#1f6f4a", color: "white", border: "none", borderRadius: 9, padding: "8px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
    vocabReviewBubbleClose: { background: "#f1f5f3", color: "#5b6862", border: "none", borderRadius: 9, padding: "8px 11px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: "auto" },

    // AMMIYAH — LESSON / EXERCISE SESSION
    lessonPage: { minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" },
    lessonTop: { display: "flex", alignItems: "center", gap: 16, padding: "18px 20px 8px" },
    lessonClose: { background: "none", border: "none", color: "#999", fontSize: 22, cursor: "pointer", lineHeight: 1 },
    lessonProgressTrack: { flex: 1, height: 8, borderRadius: 20, background: "#e9eeec", overflow: "hidden" },
    lessonProgressFill: { height: "100%", borderRadius: 20, background: `linear-gradient(90deg, ${GREEN}, ${GREEN_DARK})`, transition: "width 0.3s ease" },
    lessonBody: { flex: 1, padding: "20px 20px 140px", maxWidth: 560, margin: "0 auto", width: "100%", boxSizing: "border-box" },
    lessonQuestion: { fontSize: 20, fontWeight: "bold", color: "#1a1a1a", marginBottom: 22 },
    lessonPromptRow: { display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 30 },
    lessonAvatarWrap: { flexShrink: 0 },
    lessonBubble: { position: "relative", background: "white", border: "1px solid #e5e5e5", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", maxWidth: 340 },
    lessonBubbleLatin: { fontFamily: "inherit", fontSize: isMobile ? 15 : 14, color: "#5f6b66", letterSpacing: 0, lineHeight: 1.4, marginBottom: 2 },
    // [FIX] flexWrap:"wrap" WAJIB -- ini container kata-kata Arab yang bisa
    // diklik (renderClickableArabic motong kalimat jadi kata-kata terpisah).
    // Tanpa flexWrap, kalimat PENDEK gak masalah (muat 1 baris), tapi
    // kalimat PANJANG (dari cerita/dialog) kata-katanya gak pindah baris,
    // malah meluber keluar batas lessonBubble (maxWidth: 340).
    lessonBubbleMain: { fontSize: 20, color: "#1a1a1a", marginTop: 2, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 },
    lessonBlank: { display: "inline-block", minWidth: 46, borderBottom: "2px solid #999", height: 22 },
    lessonAudioBtn: { background: "#4A9FD6", border: "none", color: "white", width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, cursor: "pointer", flexShrink: 0 },
    lessonOption: { border: "1.5px solid #e3e9e6", borderRadius: 16, padding: "15px 18px", marginBottom: 12, cursor: "pointer", textAlign: "center", background: "white", transition: "border-color 0.15s ease, background 0.15s ease" },
    lessonOptionSelected: { borderColor: GREEN, background: "#f1f7f4" },
    lessonOptionCorrect: { borderColor: "#6bb58a", background: "#ecf7f0" },
    lessonOptionWrong: { borderColor: "#e58a8a", background: "#fdf0ef" },
    lessonOptionLatin: { fontFamily: "inherit", fontSize: isMobile ? 14.5 : 13, color: "#6b7772", letterSpacing: 0, lineHeight: 1.35, marginBottom: 2 },
    lessonOptionText: { fontSize: 18, color: "#1a1a1a" },
    lessonWordAnswerRow: { display: "flex", flexWrap: "wrap", gap: 10, minHeight: 46, borderBottom: "1px solid #e5e5e5", paddingBottom: 14, marginBottom: 26 },
    lessonWordBankRow: { display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" },
    lessonWordTile: { border: "1.5px solid #e3e9e6", borderRadius: 12, padding: "10px 16px", fontSize: 16, background: "white", cursor: "pointer", color: "#1a1a1a" },
    lessonWordTilePlaced: { border: "1.5px solid #cfe3da", background: "#f1f7f4", color: GREEN_DARK },
    // Ditandai pas kotak lagi "dipilih" buat ditukar posisinya (lihat handlePlacedTileClick).
    lessonWordTileSelected: { border: "2px solid #F5B700", background: "#FFF6DD", color: "#a97b00", boxShadow: "0 0 0 2px rgba(245,183,0,0.25)" },
    lessonTextInput: { width: "100%", border: "1.5px solid #e3e9e6", borderRadius: 14, fontSize: 18, padding: "12px 14px", outline: "none", marginBottom: 20, boxSizing: "border-box" },
    lessonBottomBar: { position: "sticky", bottom: 0, left: 0, right: 0, borderTop: "1px solid #e8eeeb", padding: "16px 20px calc(20px + env(safe-area-inset-bottom, 0px))", background: "white" },
    lessonBottomInner: { maxWidth: 560, margin: "0 auto" },
    lessonFeedback: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontWeight: "bold", fontSize: 15 },
    lessonBtnDisabled: { background: "#eceff0", color: "#a3adaa", cursor: "default", boxShadow: "none" },
    lessonBtnActive: { background: GREEN_DARK, color: "white", boxShadow: "0 8px 18px rgba(90,138,121,0.28)" },
    lessonBtnWrong: { background: "#e0646a", color: "white", boxShadow: "0 8px 18px rgba(224,100,106,0.25)" },
    lessonCompleteWrap: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20, textAlign: "center" },
    lessonCompleteTitle: { fontSize: 24, fontWeight: "bold", color: "#1a1a1a" },
    lessonCompleteScore: { fontSize: 15, color: "#666" },

    // Reading passage (read_respond, reading_comprehension)
    readingPassage: { border: "1px solid #e8eeeb", borderRadius: 16, padding: "16px 18px", marginBottom: 26, background: "#f7faf8" },
    readingPassageText: { fontSize: 19, color: "#1a1a1a", marginTop: 4, lineHeight: 1.6 },
    readingPassageTranslation: { fontSize: 13, color: "#888", marginTop: 8, fontStyle: "italic" },
    readingQuestion: { fontSize: 15, fontWeight: "bold", color: "#1a1a1a", marginTop: 14, paddingTop: 14, borderTop: "1px solid #e5e5e5" },

    // Matching pairs
    matchGrid: { display: "flex", gap: 14, marginBottom: 20 },
    matchCol: { flex: 1, display: "flex", flexDirection: "column", gap: 10 },
    matchCard: { border: "1.5px solid #e3e9e6", borderRadius: 14, padding: "14px 10px", background: "white", cursor: "pointer", textAlign: "center", fontSize: 15, color: "#1a1a1a" },
    matchCardSelected: { borderColor: GREEN, background: "#f1f7f4" },
    matchCardDone: { borderColor: "#6bb58a", background: "#ecf7f0", opacity: 0.85, cursor: "default" },
    // MODAL
    modal: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 16 },
    modalBox: { background: "white", borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxSizing: "border-box", maxHeight: "92vh", overflowY: "auto" },
    modalTitle: { fontSize: 18, fontWeight: "bold", color: "#1a1a1a", marginBottom: 14 },
  };

  const renderNavbar = () => {
    const authItem = currentUser ? (
      <a
        href="?page=profile"
        onClick={navLinkClick(() => { setPage("profile"); window.scrollTo({ top: 0, behavior: "auto" }); })}
        aria-label={lx("Profil", "Profile")}
        style={{ ...s.navLink, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none", padding: "4px 12px 4px 4px", borderRadius: 999,
          background: page === "profile" ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.16)" }}
      >
        {currentUser.avatarUrl ? (
          <img src={currentUser.avatarUrl} alt="" referrerPolicy="no-referrer" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: "white", color: GREEN_DARK, fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {(currentUser.name || "?").trim().charAt(0).toUpperCase()}
          </span>
        )}
        <span style={{ maxWidth: isMobile ? 90 : 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(currentUser.name || "").split(" ")[0]}</span>
      </a>
    ) : (
      <a
        href="?page=login"
        onClick={navLinkClick(() => { setAuthRedirectTarget("ammiyahBagian"); setAuthMode("login"); setPage("login"); })}
        style={{ ...(page === "login" ? s.navLinkActive : s.navLink), textDecoration: "none", display: "inline-block",
          ...(isMobile && page !== "login" ? { background: "rgba(255,255,255,0.2)", borderRadius: 999, padding: "7px 18px", fontWeight: 700 } : {}) }}
      >
        Login
      </a>
    );

    const logo = (
      <a href="?page=home" onClick={navLinkClick(goHome)} style={{ cursor: "pointer", textDecoration: "none", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 7 }}><img src="/logo-learningspace-white.png" alt="LearningSpace by Kyo" style={{ height: isMobile ? 30 : 38, width: "auto", display: "block" }} /><span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", paddingBottom: 3, letterSpacing: 0.3 }}>by Kyo</span></div>
      </a>
    );

    // Gaya tautan: di HP berbentuk "pil" supaya mudah ditekan jari dan jelas mana yang aktif.
    const lk = (active) => (isMobile
      ? { ...(active ? s.navLinkActive : s.navLink), padding: "6px 14px", borderRadius: 999, fontSize: 13.5, minHeight: 34,
          background: active ? "white" : "rgba(255,255,255,0.14)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }
      : { ...(active ? s.navLinkActive : s.navLink), textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 });
    const links = [
      <a key="home" href="?page=home" onClick={navLinkClick(goHome)} style={lk(page === "home")}>Home</a>,
      <a key="explore" href="?page=explore" onClick={navLinkClick(goExplore)} style={lk(page === "explore" || page === "course")}>Explore</a>,
      <a key="subject" href="?page=subject" onClick={featureLinkClick(goSubject, "subject")} style={lk(page === "subject")}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /></svg> Subject Language
      </a>,
      <a key="levantine" href="?page=ammiyah" onClick={featureLinkClick(goAmmiyah, "ammiyah")} style={lk(page.startsWith("ammiyah"))}>
        <JordanFlag size={16} /> Levantine
      </a>,
      <button key="donate" className="nav-donate" style={{ ...lk(false), visibility: "visible", opacity: 1, border: "none" }} onClick={() => setShowDonate(true)}>Donate</button>,
      <a key="contact" href="?page=contact" onClick={navLinkClick(goContact)} style={lk(page === "contact")}>Contact Us</a>,
    ];

    if (isMobile) {
      return (
        <div style={{ ...s.navbar, height: "auto", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", padding: 0, boxShadow: "0 2px 10px rgba(30,60,50,0.12)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 14px 6px 16px" }}>
            {logo}
            {authItem}
          </div>
          <div style={{ position: "relative" }}>
            <div className="nav-links-scroll" style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "2px 16px 10px", scrollbarWidth: "none" }}>
              {links}
            </div>
            <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 28, pointerEvents: "none", background: `linear-gradient(to right, transparent, ${GREEN})` }} />
          </div>
        </div>
      );
    }
    return (
      <div style={s.navbar}>
        {logo}
        <div style={{ position: "relative", overflow: "hidden", flex: "none", minWidth: 0 }}>
          <div style={s.navLinks} className="nav-links-scroll">
            {authItem}
            {links}
          </div>
        </div>
      </div>
    );
  };

  const renderFooter = () => (
    <div style={{ background: GREEN, color: "white" }}>
      <div style={{ ...s.footer, background: "transparent", alignItems: isMobile ? "center" : "flex-start", ...(isMobile ? { flexDirection: "column", padding: "28px 20px 22px", gap: 22, textAlign: "center" } : {}) }}>
        <div style={{ ...s.footerLeft, flex: isMobile ? "0 0 auto" : "1 1 200px" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 8 }}>Our social Media</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: isMobile ? "center" : "flex-start" }}>
            <a className="ls-press" href="https://youtube.com/@noteskey?si=8m9rWk59J66TGPAa" target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.2)", padding: "5px 12px", borderRadius: 6, color: "white", textDecoration: "none", fontSize: 13 }}>
              <YouTubeLogo size={15} /> YouTube
            </a>
            <a className="ls-press" href="https://www.instagram.com/islamneconomic.id?igsh=cjBqNWwwajB1NzBo&utm_source=qr" target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,0.2)", padding: "5px 12px", borderRadius: 6, color: "white", textDecoration: "none", fontSize: 13 }}>
              <InstagramLogo size={18} /> Instagram
            </a>
          </div>
        </div>
        <div style={{ flex: isMobile ? "0 0 auto" : "1 1 200px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
          <a href="?page=home" onClick={navLinkClick(goHome)} aria-label="LearningSpace" style={{ display: "flex" }}>
            <img src="/logo-learningspace-white.png" alt="LearningSpace" style={{ height: 40, width: "auto", display: "block" }} />
          </a>
        </div>
        <div style={{ flex: isMobile ? "0 0 auto" : "1 1 200px", display: "flex", justifyContent: isMobile ? "center" : "flex-end" }}>
      <div style={isMobile ? { display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 6px" } : s.footerRight}>
        <a href="?page=home" onClick={navLinkClick(goHome)} style={{ ...s.footerLink, textDecoration: "none" }}>Home</a>
        <a href="?page=explore" onClick={navLinkClick(goExplore)} style={{ ...s.footerLink, textDecoration: "none" }}>Explore</a>
        <a href="?page=subject" onClick={featureLinkClick(goSubject, "subject")} style={{ ...s.footerLink, textDecoration: "none" }}>Subject Language</a>
        <a href="?page=ammiyah" onClick={featureLinkClick(goAmmiyah, "ammiyah")} style={{ ...s.footerLink, textDecoration: "none" }}>Levantine</a>
        <button style={s.footerLink} onClick={() => setShowDonate(true)}>Donate</button>
        <a href="?page=contact" onClick={navLinkClick(goContact)} style={{ ...s.footerLink, textDecoration: "none" }}>Contact Us</a>
      </div>
        </div>
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.18)", padding: isMobile ? "14px 20px" : "14px 40px", textAlign: "center", fontSize: 12.5, color: "rgba(255,255,255,0.8)" }}>
        <div style={{ marginBottom: 6, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="/privacy.html" style={{ color: "rgba(255,255,255,0.9)", textDecoration: "underline" }}>Privacy Policy</a>
          <a href="/terms.html" style={{ color: "rgba(255,255,255,0.9)", textDecoration: "underline" }}>Terms of Service</a>
        </div>
        © 2026 LearningSpace. All rights reserved.
      </div>
    </div>
  );

  // Kartu "Lanjutkan Belajar" di Home — dipakai bersama oleh Subject Language dan Levantine.
  const renderHomeContinueCard = ({ icon, label, title, line1, line2, percent, onClick }) => (
    <div style={{ background: "white", border: "1px solid #e8eeeb", borderRadius: 18, padding: "16px 18px", marginBottom: 14, boxShadow: "0 1px 2px rgba(20,40,30,0.04), 0 8px 24px rgba(20,40,30,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <IconTile name={icon} C={{ GREEN_DARK }} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: GREEN_DARK, fontWeight: 700, letterSpacing: 0.3 }}>{label}</div>
          <div style={{ fontWeight: 700, fontSize: 15.5, color: "#1a2421", marginTop: 1 }}>{title}</div>
          {line1 && <div style={{ fontSize: 12.5, color: "#7a8782" }}>{line1}</div>}
          {line2 && <div style={{ fontSize: 12.5, color: "#7a8782" }}>{line2}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={s.bagianTrack}><div style={{ ...s.bagianFill, width: `${percent}%` }} /></div>
        <div style={s.bagianPercent}>{percent}%</div>
      </div>
      <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive }} onClick={onClick}>
        {uiLang === "en" ? "CONTINUE" : "LANJUTKAN"}
      </button>
    </div>
  );

 const renderHome = () => (
    <div>
      <HeroIntro onStart={goExplore} isMobile={isMobile} green={GREEN_DARK} />
      {(currentUser || isLocalDev()) && (slSummary || (lvContinue && currentUser)) && (
        <div style={{ maxWidth: 560, margin: "24px auto 0", padding: "0 20px" }}>
          {slSummary && renderHomeContinueCard({
            icon: "cap",
            label: uiLang === "en" ? "Continue Learning · Subject Language" : "Lanjutkan Belajar · Subject Language",
            title: slSummary.courseTitle,
            line1: slSummary.unitLabel,
            line2: `Section: ${slSummary.sectionTitle}`,
            percent: slSummary.percent,
            onClick: () => { setSlAutoResume(true); setPage("subject"); window.scrollTo({ top: 0, behavior: "auto" }); },
          })}
          {lvContinue && currentUser && renderHomeContinueCard({
            icon: "mic",
            label: uiLang === "en" ? "Continue Learning · Levantine" : "Lanjutkan Belajar · Levantine",
            title: trBagianLabel(lvContinue.bagian.title, uiLang),
            line1: `Unit ${lvContinue.unit.unitNumber} — ${trTopic(lvContinue.unit.topicName, uiLang)}`,
            line2: null,
            percent: lvContinue.percent,
            onClick: () => { continueLevantine(); },
          })}
        </div>
      )}
      {renderFooter()}
    </div>
  );

  const renderExplore = () => (
    <div style={{ background: "#fafbfa" }}>
      <div style={s.exploreSection}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={s.exploreTitle}>Explore the subjects</div>
          <div style={{ fontSize: 14, color: "#7a8581", maxWidth: 460, margin: "0 auto" }}>
            {lx("Pilih mata pelajaran dan mulai belajar kapan saja.", "Pick a subject and start learning anytime.")}
          </div>
        </div>
        <div style={s.searchWrap}>
          <Icon name="search" size={16} color="#9aa6a1" />
          <input style={s.searchInput} placeholder={lx("Cari mata pelajaran", "Search subjects")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {loadingMateri ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#999" }}>
            Memuat materi...
          </div>
        ) : filteredCourses.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "#9aa6a1", fontSize: 14 }}>
            {lx("Tidak ada materi yang cocok.", "No matching subjects.")}
          </div>
        ) : (
          <div style={s.grid}>
            {filteredCourses.map((course) => (
              <div key={course.id} className="exploreCard" style={s.courseCard} onClick={() => openCourse(course)}>
                <div style={{ position: "relative" }}>
                  <img src={course.thumbnail} alt={course.title} style={s.courseThumb} onError={(e) => { e.target.style.background = GREEN_BG; e.target.src = ""; }} />
                  <span style={s.courseCountChip}>
                    <Icon name="book" size={12} color="#3d4742" />
                    {course.lessons.length} {lx("pelajaran", "lessons")}
                  </span>
                </div>
                <div style={s.courseCardBody}>
                  <div style={s.courseCardTitle}>{course.title}</div>
                  {courseArabic(course) && <div dir="rtl" lang="ar" style={s.courseCardAr}>{courseArabic(course)}</div>}
                  {course.description && <div style={s.courseCardDesc}>{course.description}</div>}
                  <div style={s.courseCardGo}>
                    {lx("Mulai belajar", "Start learning")} <Icon name="chevron" size={13} color={GREEN_DARK} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {renderFooter()}
    </div>
  );

  // 5 tipe bulatan pelajaran (sesuai kategori yang ditentukan):
  // lesson = Vocabulary + grammar baru (materi baru)
  // practice = Personalized Practice (materi yang dianggap sulit, perbaiki kelemahan)
  // story = Story (cerita, reading, pemahaman konteks)
  // conversation = Conversation (penggunaan bahasa situasi nyata)
  // review = Practice/Review (materi sebelumnya, spaced repetition, tanpa hint, lebih sulit)
  // review sengaja GAK ada di sini -- ditangani DumbbellIcon lewat renderNodeIcon()
  // NODE_ICON cuma dipakai buat "done"/"locked" (simbol utilitas, ceklis &
  // gembok emoji sudah cukup jelas & konsisten di semua platform). Tipe
  // lain (lesson/practice/story/conversation/vocabReview/review) sekarang
  // SEMUA pakai ikon SVG custom lewat renderNodeIcon() di bawah, biar
  // gayanya seragam (bukan campuran emoji yang beda-beda gaya gambarnya).
  const NODE_ICON = { done: "✓", locked: "🔒" };

// Set ikon SVG custom buat bulatan learning path -- gaya seragam (bentuk
// solid + sedikit detail highlight/shading buat kesan mendalam), semua pakai
// currentColor biar ngikutin warna teks tombol. Ukuran default 26px, kecuali
// dumbbell yang sengaja dibesarin (28px) + dikasih detail garis pegangan
// sesuai permintaan.

function StarIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2.7l2.7 5.7 6.2.6-4.6 4.2 1.3 6.1L12 16.1l-5.6 3.2 1.3-6.1-4.6-4.2 6.2-.6z" fill="currentColor" />
      <path d="M12 2.7l2.7 5.7 3.4.3-4.4 8.2-1.7-1-3.7 1.1 1.3-6.1-4.6-4.2 6.2-.6z" fill="rgba(255,255,255,0.16)" />
    </svg>
  );
}

function TargetIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.2" fill="currentColor" opacity="0.18" />
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="12" cy="12" r="5.2" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
    </svg>
  );
}

function BookIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 5.6c-1.7-1.15-3.9-1.7-6.1-1.7-.55 0-1 .45-1 1v11.7c0 .55.45 1 1 1 2.2 0 4.4.55 6.1 1.7 1.7-1.15 3.9-1.7 6.1-1.7.55 0 1-.45 1-1V4.9c0-.55-.45-1-1-1-2.2 0-4.4.55-6.1 1.7z" fill="currentColor" />
      <path d="M12 5.6v13.7" stroke="rgba(0,0,0,0.15)" strokeWidth="1.3" />
      <path d="M6.4 7.6c1.3.1 2.6.5 3.7 1.15" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 6.2C4 5 5 4 6.2 4h11.6C19 4 20 5 20 6.2v8.6c0 1.2-1 2.2-2.2 2.2H9.3L4.8 20.5c-.3.25-.8.05-.8-.35v-3.1h-.05C4 17 4 17 4 16.9z" fill="currentColor" />
      <circle cx="8.3" cy="10.3" r="1.15" fill="rgba(255,255,255,0.85)" />
      <circle cx="12" cy="10.3" r="1.15" fill="rgba(255,255,255,0.85)" />
      <circle cx="15.7" cy="10.3" r="1.15" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}

function PathCrownIcon({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 17.3L1.6 8.2 6.2 11 12 4.6 17.8 11l4.6-2.8-1.4 9.1z" fill="currentColor" />
      <rect x="3" y="18.2" width="18" height="2.4" rx="1.1" fill="currentColor" />
      <circle cx="6.2" cy="10.4" r="1.1" fill="rgba(255,255,255,0.8)" />
      <circle cx="12" cy="6.7" r="1.25" fill="rgba(255,255,255,0.8)" />
      <circle cx="17.8" cy="10.4" r="1.1" fill="rgba(255,255,255,0.8)" />
    </svg>
  );
}

// Ikon dumbbell buat node type "review" -- SEBELUMNYA emoji 🏋️ (orang angkat
// beban), diganti SVG custom biar beneran cuma dumbbell-nya doang (emoji
// weightlifter gak punya varian "objek doang tanpa orang" yang konsisten
// render-nya di semua platform). [DIPERBESAR & DIPERHALUS]: pemberat lebih
// besar (28px, sebelumnya 22px) + garis pegangan tipis di tiap pemberat
// buat kesan detail 3D, bukan cuma balok polos. currentColor biar warnanya
// ngikutin warna teks tombol.
function DumbbellIcon({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="7.5" width="5" height="9" rx="1.8" fill="currentColor" />
      <rect x="18" y="7.5" width="5" height="9" rx="1.8" fill="currentColor" />
      <rect x="5.2" y="10.3" width="13.6" height="3.4" rx="1.4" fill="currentColor" />
      <rect x="2.6" y="5.8" width="1.2" height="12.4" rx="0.6" fill="rgba(0,0,0,0.14)" />
      <rect x="20.2" y="5.8" width="1.2" height="12.4" rx="0.6" fill="rgba(0,0,0,0.14)" />
    </svg>
  );
}

// Helper render icon node path — pengganti NODE_ICON[type] mentah. Semua
// tipe SEKARANG balikin komponen SVG (bukan cuma "review"), kecuali
// done/locked yang tetap emoji ✓/🔒 (sudah jelas & konsisten by default).
function renderNodeIcon(type, status) {
  const key = status === "locked" ? "locked" : status === "done" ? "done" : type;
  if (key === "review") return <DumbbellIcon />;
  if (key === "lesson") return <StarIcon />;
  if (key === "practice") return <TargetIcon />;
  if (key === "story") return <BookIcon />;
  if (key === "conversation") return <ChatIcon />;
  if (key === "vocabReview") return <PathCrownIcon />;
  return NODE_ICON[key];
}

  const NODE_META = {
    lesson: { label: "Vocabulary & Grammar", desc: "Mempelajari materi baru" },
    practice: { label: "Personalized Practice", desc: "Memperbaiki kelemahanmu" },
    story: { label: "Story", desc: "Cerita & pemahaman konteks" },
    conversation: { label: "Conversation", desc: "Bahasa dalam situasi nyata" },
    review: { label: "Practice/Review", desc: "Ulasan materi lama, tanpa hint" },
    vocabReview: { label: "Review Vocabularies", desc: "Kosakata yang sudah dipelajari di unit ini" },
  };
  const REPS_PER_LEVEL = 4;   // tiap bulatan = 4x belajar (ditandai ring segmen)
  const REPS_PER_BAGIAN_REVIEW = 5; // bulatan matahari = 5 ronde review (ring 5 segmen)

  // Cincin segmen di sekeliling node — generik, bisa berapa pun jumlah
  // segmennya (`total`). `filled` dari segmen berwarna (sudah selesai),
  // sisanya abu-abu (belum). Dipasang sebagai background pada wrapper —
  // node bulat di tengahnya menutupi bagian tengah sehingga yang terlihat
  // cuma cincinnya (efek "ring" ala crown level). Kalau semua sudah
  // selesai, ring jadi lingkaran penuh solid tanpa celah sama sekali.
  function ringGradientN(colorHex, filled, total) {
    if (filled >= total) {
      return `conic-gradient(${colorHex} 0deg 360deg)`;
    }
    const gapAngle = total >= 5 ? 6 : 8;
    const segAngle = 360 / total - gapAngle;
    // Mulai dari 0deg (sudut negatif di conic-gradient TIDAK digambar -> segmen pertama dulu hilang).
    // "from" memutar ring supaya celah jatuh tepat di atas.
    let angle = 0;
    const stops = [];
    for (let i = 0; i < total; i++) {
      const start = angle;
      const end = angle + segAngle;
      stops.push(`${i < filled ? colorHex : "#e2e2e2"} ${start}deg ${end}deg`);
      angle = end;
      stops.push(`transparent ${angle}deg ${angle + gapAngle}deg`);
      angle += gapAngle;
    }
    return `conic-gradient(from ${-gapAngle / 2}deg, ${stops.join(", ")})`;
  }
  // Alias — dipakai untuk ring 4 segmen bulatan pelajaran biasa (kompatibel
  // dengan pemakaian sebelumnya).
  function ringGradient(colorHex, filled) {
    return ringGradientN(colorHex, filled, REPS_PER_LEVEL);
  }

  // ============================================================
  // Helper fetch API — dipakai AmmiyahDataSource di bawah.
  // ============================================================
  const unitsInflightRef = useRef(new Map());
  const ammiyahSubjectIdRef = useRef(null); // cache id subject "ammiyah", supaya tidak fetch berulang

  // ---- Progress Levantine saat BELUM LOGIN (tamu / localhost) ----
  // Disimpan di localStorage browser, seperti Subject Language. Kalau user login,
  // progress asli tetap lewat /api/progress ke Supabase.
  // Dicatat SELALU di browser (per akun / "guest") sebagai cadangan, jadi tetap muncul
  // walau API/Supabase lagi tidak jalan (mis. localhost tanpa setup).
  const guestProgressKey = () => `ls_guest_level_progress_v1_${currentUser?.id || "guest"}`;
  const readGuestProgress = () => {
    try { return JSON.parse(window.localStorage.getItem(guestProgressKey()) || "{}") || {}; } catch (e) { return {}; }
  };
  const saveGuestLevelProgress = (level, score) => {
    if (!level || !level.id) return;
    try {
      const all = readGuestProgress();
      const cur = all[level.id] || { segments: [], done: false };
      if (level.segmentNumber) {
        if (!cur.segments.includes(level.segmentNumber)) cur.segments.push(level.segmentNumber);
        // lesson = 4 segmen; story/conversation = 1 segmen (sama seperti generator soal)
        const total = level.type === "lesson" ? 4 : 1;
        if (cur.segments.length >= total) cur.done = true;
      } else {
        cur.done = true; // practice/review adaptif: selesai = level selesai
      }
      cur.score = score;
      cur.updatedAt = Date.now();
      all[level.id] = cur;
      window.localStorage.setItem(guestProgressKey(), JSON.stringify(all));
    } catch (e) { /* storage penuh/diblokir */ }
  };

  async function apiGet(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Gagal memuat ${url}`);
    }
    return res.json();
  }

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const hint = res.status === 504 || res.status === 408
        ? " (server timeout — coba lagi sebentar)"
        : res.status >= 500 && !errBody.error ? " (server error, cek Vercel Logs)" : "";
      throw new Error(errBody.error || `Gagal mengirim ke ${url} [HTTP ${res.status}]${hint}`);
    }
    return res.json();
  }

  async function fetchAmmiyahSubjectId() {
    if (ammiyahSubjectIdRef.current) return ammiyahSubjectIdRef.current;
    try {
      const saved = window.localStorage.getItem("ls_ammiyah_subject_id");
      if (saved) { ammiyahSubjectIdRef.current = saved; return saved; }
    } catch (e) { /* abaikan */ }
    const subjects = await apiGet("/api/content?type=subjects");
    const found = (subjects || []).find((s) => s.slug === "ammiyah");
    if (found) {
      ammiyahSubjectIdRef.current = found.id;
      try { window.localStorage.setItem("ls_ammiyah_subject_id", String(found.id)); } catch (e) { /* abaikan */ }
    }
    return found ? found.id : null;
  }

  // Bikin soal "Pilih arti yang benar" on-the-fly dari daftar vocab_items
  // ASLI (dipakai bulatan mahkota & matahari, yang memang tidak punya soal
  // tersimpan di tabel `exercises` — cukup dibangun langsung dari kata+arti).
  function buildTranslateChoiceFromVocab(vocabList) {
    const pool = (vocabList || []).filter((v) => v.arti && v.kata_arab);
    return shuffleArray(pool).map((v) => {
      const distractors = shuffleArray(pool.filter((p) => p.id !== v.id)).slice(0, 2);
      const options = shuffleArray([{ text: v.arti }, ...distractors.map((d) => ({ text: d.arti }))]);
      const correctIndex = options.findIndex((o) => o.text === v.arti);
      return {
        type: "translate_choice",
        prompt: "Pilih arti yang benar",
        content: {
          promptText: `${v.kata_arab}${v.latin ? ` (${v.latin})` : ""}`,
          options,
          correctIndex,
        },
      };
    });
  }

  // ============================================================
  // SUMBER DATA AMMIYAH — sekarang manggil API asli (Supabase), bukan data
  // statis lagi. Semua komponen render (renderAmmiyahBagian, renderAmmiyahPath,
  // renderAmmiyahLesson) tetap lewat fungsi-fungsi ini, jadi kalau nanti mau
  // ubah caranya lagi, cukup ubah isi fungsi ini saja.
  //
  // CATATAN PENTING: belum ada sistem login, jadi progress per-user (level
  // mana yang sudah selesai, dst) belum bisa dihitung. Untuk sementara:
  // - Semua level & bulatan mahkota/matahari DIBUKA (tidak dikunci), supaya
  //   konten yang sudah di-generate bisa langsung dicoba/dicek.
  // - progress Bagian selalu 0%.
  // Begitu ada login (Supabase Auth + user_id asli), ganti bagian yang
  // ditandai "sementara" di bawah dengan query ke tabel `user_progress`.
  // ============================================================
  const AmmiyahDataSource = {
    // Daftar Bagian (dari tabel `units`, subject = "ammiyah").
    async getBagianList() {
      // "_v2" SENGAJA ditambahin -- struktur kurikulum berubah total (10
      // topik berulang lintas-Bagian -> 100 topik tetap, 10 per Bagian/domain).
      // Tanpa bump versi ini, tab yang udah kebuka dari sebelum perubahan
      // bakal terus baca cache LAMA dari sessionStorage selamanya (dia gak
      // hilang di-refresh, cuma hilang kalau tab-nya ditutup) -- sama
      // persis alasan cache exercises di bawah udah lebih dulu di-_v2-in.
      const cacheKey = `ls_bagian_list_cache_v2`;
      if (typeof window !== "undefined") {
        try {
          const cached = window.sessionStorage.getItem(cacheKey);
          if (cached) return JSON.parse(cached);
        } catch (e) { /* cache rusak, lanjut fetch biasa */ }
      }

      const subjectId = await fetchAmmiyahSubjectId();
      if (!subjectId) return [];
      const units = await apiGet(`/api/content?type=units&subject_id=${subjectId}`);
      const result = (units || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((u) => ({
          id: u.id,
          orderIndex: u.order_index,
          title: u.name,
          // Bagian 1-10 = Beginner; Bagian 11+ = Intermediate (penomoran unit Intermediate mulai dari 1 lagi).
          rangeLabel: u.order_index > BEGINNER_BAGIAN_COUNT
            ? `${(u.order_index - BEGINNER_BAGIAN_COUNT - 1) * 10 + 1}-${(u.order_index - BEGINNER_BAGIAN_COUNT) * 10}`
            : `${(u.order_index - 1) * 10 + 1}-${u.order_index * 10}`,
          // Sementara (belum ada login): nanti hitung dari user_progress —
          // (jumlah level status 'done' di semua Unit Bagian ini) / total level.
          progress: 0,
        }));

      if (typeof window !== "undefined") {
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch (e) { /* storage penuh, gak masalah */ }
        try { window.localStorage.setItem("ls_bagian_list_swr_v1", JSON.stringify(result)); } catch (e) { /* abaikan */ }
      }
      return result;
    },

    // Daftar Unit (dari tabel `topics`) + Level (dari tabel `levels`) di
    // dalam 1 Bagian. Menerima objek `bagian` utuh (bukan cuma id) supaya
    // bisa hitung unitNumber global (1-100).
    //
    // Di-cache ke sessionStorage per Bagian: request Supabase (units+topics
    // +levels, beberapa round-trip) cuma kejadian sekali per Bagian per
    // sesi browser tab ini — buka Bagian yang sama lagi (mis. balik dari
    // halaman soal) langsung tampil dari cache, gak nunggu network lagi.
    // Pakai sessionStorage (bukan localStorage) supaya cache otomatis
    // "segar" lagi tiap sesi baru — penting karena generator AI kamu masih
    // terus nambah konten, jangan sampai user lihat data basi berhari-hari.
    getUnitsForBagian(bagian) {
      // Gabungkan permintaan yang sama yang sedang berjalan (mis. kartu "Lanjutkan" + halaman path
      // sama-sama minta Bagian yang sama) supaya tidak menembak API dua kali.
      const key = `${bagian.id}_${currentUser?.id || "guest"}`;
      const inflight = unitsInflightRef.current;
      if (inflight.has(key)) return inflight.get(key);
      const p = AmmiyahDataSource._loadUnits(bagian).finally(() => inflight.delete(key));
      inflight.set(key, p);
      return p;
    },
    async _loadUnits(bagian) {
      // "_v2" -- sama alasannya kayak ls_bagian_list_cache_v2 di atas:
      // struktur topik per-Bagian berubah total, cache lama harus dianggap
      // basi, bukan cuma "lupa refresh".
      const cacheKey = `ls_units_cache_v2_${bagian.id}_${currentUser?.id || "guest"}`;
      if (typeof window !== "undefined") {
        try {
          const cached = window.sessionStorage.getItem(cacheKey);
          if (cached) return JSON.parse(cached);
        } catch (e) { /* cache rusak, lanjut fetch biasa */ }
      }

      const topics = await apiGet(`/api/content?type=topics&unit_id=${bagian.id}`);
      const sorted = (topics || []).sort((a, b) => a.order_index - b.order_index);
      const result = await Promise.all(
        sorted.map(async (t) => {
          const levels = await apiGet(`/api/content?type=levels&topic_id=${t.id}`);
          const sortedLevels = (levels || []).sort((a, b) => a.level_number - b.level_number);

          // Dipakai buat nentuin status practice/review (lihat komentar di
          // bawah) — variable biasa (bukan property object), di-reset tiap
          // unit karena tiap unit diproses lewat closure map() sendiri.
          let hasAnyStaticContentSoFar = false;

          return {
            id: t.id,
            unitNumber: t.order_index, // 1-10, RESET tiap Bagian — bukan nomor global (dulu salah: Bagian 2 jadi "Unit 11")
            topicName: t.name,
            // Level bertipe lesson/story/conversation (STATIC): status
            // ditentukan dari exercise_count seperti biasa.
            // Level bertipe practice/review (ADAPTIVE): SEKARANG gak
            // pernah punya exercise statis sama sekali (dibangun on-the-fly
            // pas diklik, lihat api/adaptive-exercise.js) — jadi statusnya
            // ditentukan dari ada/tidaknya konten statis SEBELUM level ini
            // di topik yang sama (gak ada gunanya "practice" kalau belum
            // ada 1 pun lesson buat dipraktekkan).
            // Status "done" (BENERAN selesai oleh USER INI) ditimpakan di
            // bawah dari user_progress.
            levels: sortedLevels.map((l) => {
              const exerciseCount = l.exercises?.[0]?.count ?? 0;
              const isAdaptiveType = l.node_type === "practice" || l.node_type === "review";
              let status;
              if (isAdaptiveType) {
                status = hasAnyStaticContentSoFar ? "current" : "locked";
              } else {
                status = exerciseCount > 0 ? "current" : "locked";
                if (exerciseCount > 0) hasAnyStaticContentSoFar = true;
              }
              return { id: l.id, type: l.node_type, status, reps: 0, segmentsDone: [] };
            }),
            vocabReview: { status: "available" },
          };
        })
      );

      // Timpa status "current" → "done" berdasar user_progress ASLI dari
      // Supabase — CUMA kalau user sudah login (guest/localhost dev gak
      // punya user_id, biarkan pakai status default di atas).
      if (currentUser?.id) {
        const allLevelIds = result.flatMap((u) => u.levels.map((l) => l.id)).filter(Boolean);
        if (allLevelIds.length > 0) {
          try {
            const progressRows = await apiGet(
              `/api/progress?user_id=${currentUser.id}&level_ids=${allLevelIds.join(",")}`
            );
            const doneSet = new Set(
              (progressRows || []).filter((p) => p.status === "done").map((p) => p.level_id)
            );
            const segmentsByLevelId = new Map(
              (progressRows || []).map((p) => [p.level_id, p.segments_done || []])
            );
            for (const unit of result) {
              for (const lvl of unit.levels) {
                if (doneSet.has(lvl.id)) lvl.status = "done";
                lvl.segmentsDone = segmentsByLevelId.get(lvl.id) || [];
                lvl.reps = lvl.status === "done" ? 4 : lvl.segmentsDone.length;
              }
            }
          } catch (e) {
            // Gagal ambil progress (mis. offline) — gak fatal, biarkan
            // status default ("current") tetap tampil, cuma gak ada tanda
            // "sudah selesai" buat sementara.
            console.warn("Gagal memuat user_progress:", e.message);
          }
        }
      }

      // Gabungkan dengan progress cadangan di browser (guest / API tidak tersedia).
      {
        const local = readGuestProgress();
        for (const unit of result) {
          for (const lvl of unit.levels) {
            const g = local[lvl.id];
            if (!g) continue;
            const merged = new Set([...(lvl.segmentsDone || []), ...(g.segments || [])]);
            lvl.segmentsDone = [...merged].sort((a, b) => a - b);
            if (g.done) lvl.status = "done";
            lvl.reps = lvl.status === "done" ? 4 : lvl.segmentsDone.length;
          }
        }
      }

      if (typeof window !== "undefined") {
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch (e) { /* storage penuh, gak masalah */ }
        try { window.localStorage.setItem(`ls_units_swr_v1_${cacheKey}`, JSON.stringify(result)); } catch (e) { /* abaikan */ }
      }
      return result;
    },

    // Soal untuk 1 level, dari tabel `exercises`. Di-cache per level_id
    // dengan alasan sama seperti di atas — buka level yang sama 2x (mis.
    // klik lalu batal lalu klik lagi) gak perlu fetch ulang.
    async getExercisesForLevel(level) {
      // practice/review sekarang ADAPTIVE — dibangun on-the-fly per user
      // lewat /api/adaptive-exercise, BUKAN diambil dari /api/exercises
      // (yang isinya statis, disiapkan generate-vocab-v2.mjs). Butuh user
      // login (personalisasi berbasis progress); guest/local dev gak bisa
      // dapat konten practice/review (gak ada yang bisa dipersonalisasi).
      if (level.type === "practice" || level.type === "review") {
        if (!currentUser?.id) {
          // Tamu (belum login): tidak ada personalisasi, jadi practice/review disusun dari
          // soal statis level lesson/story/conversation di topik yang sama (acak, maks 10).
          // Lesson: ambil segmen 2-4 (BUKAN segmen 1 yang baru dimainkan, supaya soalnya beda);
          // story/conversation: segmen 1.
          const sibs = (level.siblingLevels || []).slice(0, 4);
          const reqs = sibs.flatMap((l) => (l.type === "lesson" ? [2, 3, 4] : [1]).map((seg) => `/api/exercises?level_id=${l.id}&segment_number=${seg}`));
          const pools = await Promise.all(reqs.map((u) => apiGet(u).catch(() => [])));
          const seen = new Set();
          const pool = pools.flat().filter((r) => r && r.type !== "vocab_intro" && !seen.has(r.id) && seen.add(r.id));
          for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
          return pool.slice(0, 10).map((r) => ({
            id: r.id, type: r.type, prompt: r.prompt, content: r.content,
            contentEn: r.content_en || null,
            audioUrl: r.audio_url || null, vocabIds: r.vocab_ids || [],
          }));
        }
        let rows;
        try {
          rows = await apiPost("/api/adaptive-exercise", { user_id: currentUser.id, level_id: level.id });
        } catch (err) {
          // Endpoint adaptif tidak tersedia/gagal (mis. belum ter-deploy -> 404): jangan blokir user,
          // susun dari soal statis level lesson/story/conversation di topik yang sama (sama seperti tamu).
          console.warn("adaptive-exercise gagal, pakai soal statis:", err.message);
          const sibs = (level.siblingLevels || []).slice(0, 4);
          const reqs = sibs.flatMap((l) => (l.type === "lesson" ? [2, 3, 4] : [1]).map((seg) => `/api/exercises?level_id=${l.id}&segment_number=${seg}`));
          const pools = await Promise.all(reqs.map((u) => apiGet(u).catch(() => [])));
          const seen = new Set();
          const pool = pools.flat().filter((r) => r && r.type !== "vocab_intro" && !seen.has(r.id) && seen.add(r.id));
          for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
          if (pool.length === 0) throw err;
          rows = pool.slice(0, 10);
        }
        // Sengaja TIDAK di-cache sessionStorage — practice/review harus
        // beda tiap kali dimainkan (adaptif ke progress TERBARU user).
        return (rows || []).map((r) => ({
          id: r.id, type: r.type, prompt: r.prompt, content: r.content,
          contentEn: r.content_en || null,
          audioUrl: r.audio_url || null, vocabIds: r.vocab_ids || [],
        }));
      }

      const segmentNumber = level.segmentNumber || 1; // dikirim caller, lihat startLesson()
      // [FIX] "_v2" ditambahin SENGAJA -- cache LAMA (key tanpa _v2) dibuat
      // SEBELUM kolom content_en ada, jadi bentuknya gak punya field
      // contentEn sama sekali. Tanpa bump versi ini, cache lama itu bakal
      // terus kepakai selamanya (sessionStorage gak tau datanya "basi"),
      // dan soal tetap Indonesia terus walau translate-content-en.mjs udah
      // selesai jalan di server. Cache BARU (dengan _v2) udah pasti include
      // contentEn dari awal, jadi gak perlu bump lagi ke depannya kecuali
      // bentuk datanya berubah lagi.
      const cacheKey = `ls_exercises_cache_v2_${level.id}_seg${segmentNumber}`;
      if (typeof window !== "undefined") {
        try {
          const cached = window.sessionStorage.getItem(cacheKey);
          if (cached) return JSON.parse(cached);
        } catch (e) { /* cache rusak, lanjut fetch biasa */ }
      }

      const rows = await apiGet(`/api/exercises?level_id=${level.id}&segment_number=${segmentNumber}`);
      const result = (rows || [])
        .sort((a, b) => a.order_index - b.order_index)
        .map((r) => ({
          id: r.id,
          type: r.type,
          prompt: r.prompt,
          content: r.content,
          contentEn: r.content_en || null, // [i18n] cuma ada di soal lesson/story/conversation statis
          audioUrl: r.audio_url || null,
          vocabIds: r.vocab_ids || [], // dipakai buat lapor ke /api/answer pas user jawab
        }));

      if (typeof window !== "undefined") {
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch (e) { /* storage penuh, gak masalah */ }
      }
      return result;
    },

    // Soal "Review Vocabularies" 1 Unit.
    // KALAU USER LOGIN: pakai Review Engine (/api/review-session) — kata
    // dipilih berdasar progress ASLI user itu (overdue/lemah/baru salah/due/
    // maintenance), soal diambil dari pool exercise yang sudah ada (variasi
    // tipe otomatis).
    // KALAU GUEST/LOCAL DEV: fallback ke cara lama (semua vocab, dibikin
    // jadi translate_choice) — supaya testing tanpa login tetap bisa jalan.
    async getVocabReviewForUnit(unit) {
      // "_v2" -- ikutan konsisten sama 3 cache lain di atas (lihat alasan
      // di ls_bagian_list_cache_v2).
      const cacheKey = `ls_vocabreview_unit_cache_v2_${unit.id}_${currentUser?.id || "guest"}`;
      if (typeof window !== "undefined") {
        try {
          const cached = window.sessionStorage.getItem(cacheKey);
          if (cached) return JSON.parse(cached);
        } catch (e) { /* cache rusak, lanjut fetch biasa */ }
      }

      let result;
      if (currentUser?.id) {
        const exercises = await apiGet(`/api/review-session?user_id=${currentUser.id}&scope=unit&scope_id=${unit.id}&limit=20`);
        result = (exercises || []).map((ex) => ({
          type: ex.type, prompt: ex.prompt, content: ex.content,
          audioUrl: ex.audio_url || null, vocabIds: ex.vocab_ids || [],
          id: typeof ex.id === "string" && ex.id.startsWith("fallback-") ? null : ex.id,
        }));
      } else {
        const vocab = await apiGet(`/api/content?type=vocab_by_topic&topic_id=${unit.id}`);
        result = buildTranslateChoiceFromVocab(vocab);
      }

      if (typeof window !== "undefined") {
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch (e) { /* storage penuh, gak masalah */ }
      }
      return result;
    },

    // Soal "Review Semua Kosakata" 1 Bagian — sama seperti di atas, tapi
    // cakupannya SEMUA Unit di Bagian ini (scope="bagian").
    async getVocabReviewForBagian(bagian) {
      // "_v2" -- ini yang PALING rawan basi di antara ke-4 cache, karena
      // bagian.id (unit UUID, 1-10) DIPAKAI ULANG oleh ensureUnit() di
      // generate-vocab-v2.mjs (bukan dibuat baru), jadi key lama PASTI
      // collide sama isi lama walau topik di dalamnya udah ganti total.
      const cacheKey = `ls_vocabreview_bagian_cache_v2_${bagian.id}_${currentUser?.id || "guest"}`;
      if (typeof window !== "undefined") {
        try {
          const cached = window.sessionStorage.getItem(cacheKey);
          if (cached) return JSON.parse(cached);
        } catch (e) { /* cache rusak, lanjut fetch biasa */ }
      }

      let result;
      if (currentUser?.id) {
        const exercises = await apiGet(`/api/review-session?user_id=${currentUser.id}&scope=bagian&scope_id=${bagian.id}&limit=25`);
        result = (exercises || []).map((ex) => ({
          type: ex.type, prompt: ex.prompt, content: ex.content,
          audioUrl: ex.audio_url || null, vocabIds: ex.vocab_ids || [],
          id: typeof ex.id === "string" && ex.id.startsWith("fallback-") ? null : ex.id,
        }));
      } else {
        const vocab = await apiGet(`/api/content?type=vocab_by_unit&unit_id=${bagian.id}`);
        result = buildTranslateChoiceFromVocab(vocab);
      }

      if (typeof window !== "undefined") {
        try { window.sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch (e) { /* storage penuh, gak masalah */ }
      }
      return result;
    },
  };

  const [vocabReviewIntro, setVocabReviewIntro] = useState(null); // { bagian, unit } | null
  const [showExitConfirm, setShowExitConfirm] = useState(false); // konfirmasi keluar dari halaman soal

  const openVocabReviewIntro = (bagian, unit) => {
    // Klik bulatan yang sama lagi → tutup balonnya (toggle). Sengaja TIDAK
    // ada guard "kalau terkunci jangan dibuka" di sini — bubble harus tetap
    // bisa dibuka walau unit belum selesai, isinya yang beda (lihat isi
    // bubble di renderAmmiyahPath: pesan kunci vs tombol mulai review).
    setVocabReviewIntro((cur) => (cur && cur.unit.id === unit.id ? null : { bagian, unit }));
  };

  const [bagianReviewReps, setBagianReviewReps] = useState({}); // { [bagianId]: 0-5 } — progres ring 5 segmen bulatan matahari

  const confirmStartVocabReview = async () => {
    if (!vocabReviewIntro) return;
    const { bagian, unit } = vocabReviewIntro;
    setVocabReviewIntro(null);
    setLessonCtx({ bagian, unit, level: { type: "vocabReview", scope: "unit" } });
    setLessonExercises([]);
    setLessonIndex(0);
    resetExerciseState();
    setLessonScore(0);
    setPage("ammiyahLesson");
    window.scrollTo({ top: 0, behavior: "auto" });
    try {
      const exercises = await AmmiyahDataSource.getVocabReviewForUnit(unit);
      setLessonExercises(exercises);
    } catch (err) {
      console.error("Gagal memuat soal review:", err);
      alert("Gagal memuat soal review: " + err.message);
      setPage("ammiyahPath");
    }
  };

  const [activeBagian, setActiveBagian] = useState(null);
  const [activeUnitIdx, setActiveUnitIdx] = useState(0);
  const unitSectionRefs = useRef([]);
  const currentNodeRef = useRef(null); // node dengan status "current" — target auto-scroll

  // ---------- Lanjutkan pelajaran Levantine ----------
  // Bagian terakhir yang dibuka disimpan di localStorage (per user). Dari situ dicari level
  // berikutnya yang belum selesai, jadi tombol "Lanjutkan" langsung membuka pelajarannya.
  const lx = (idText, enText) => (uiLang === "en" ? enText : idText);
  const lvLastKey = () => `lv_last_bagian_${currentUser?.id || "guest"}`;
  const [lvContinue, setLvContinue] = useState(null); // { bagian, unit, level, percent } | null
  const [lvContinueBusy, setLvContinueBusy] = useState(false);

  const findNextLevel = (units) => {
    for (const unit of units) for (const level of unit.levels) if (level.status === "current") return { unit, level };
    return null;
  };

  useEffect(() => {
    if (!(page === "home" || page === "ammiyah" || page === "ammiyahBagian") || !currentUser) { setLvContinue(null); return; }
    let last = null;
    try { last = JSON.parse(window.localStorage.getItem(lvLastKey()) || "null"); } catch (e) { /* abaikan */ }
    if (!last || !last.bagian) { setLvContinue(null); return; }
    let cancelled = false;
    AmmiyahDataSource.getUnitsForBagian(last.bagian)
      .then((units) => {
        if (cancelled) return;
        const levels = units.flatMap((u) => u.levels);
        const done = levels.filter((l) => l.status === "done").length;
        const next = findNextLevel(units);
        if (!next) { setLvContinue(null); return; }
        setLvContinue({ bagian: last.bagian, unit: next.unit, level: next.level, percent: levels.length ? Math.round((done / levels.length) * 100) : 0 });
      })
      .catch(() => { if (!cancelled) setLvContinue(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, currentUser && currentUser.id]);

  const continueLevantine = () => {
    if (!lvContinue) return;
    setActiveBagian(lvContinue.bagian);
    setActiveUnitIdx(Math.max(0, (lvContinue.unit.unitNumber || 1) - 1));
    startLesson(lvContinue.bagian, lvContinue.unit, lvContinue.level);
  };

  // Dari halaman "selesai pelajaran": ambil level berikutnya (cache sudah dihapus setelah progres tersimpan).
  const continueAfterLesson = async () => {
    const bagian = lessonCtx && lessonCtx.bagian;
    if (!bagian) { setPage("ammiyahPath"); return; }
    setLvContinueBusy(true);
    try {
      const units = await AmmiyahDataSource.getUnitsForBagian(bagian);
      const next = findNextLevel(units);
      setLvContinueBusy(false);
      if (!next) { setActiveBagian(bagian); setPage("ammiyahPath"); return; }
      setActiveBagian(bagian);
      startLesson(bagian, next.unit, next.level);
    } catch (e) {
      setLvContinueBusy(false);
      setPage("ammiyahPath");
    }
  };

  const renderLvContinueCard = (withButton = true) => {
    if (!lvContinue || !currentUser) return null;
    const b = lvContinue.bagian;
    return (
      <div style={{ background: "white", border: "1px solid #e8eeeb", borderRadius: 18, padding: "16px 18px", marginBottom: 16, boxShadow: "0 1px 2px rgba(20,40,30,0.04), 0 8px 24px rgba(20,40,30,0.05)", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <IconTile name="play" C={{ GREEN_DARK }} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#8a9692" }}>{lx("Terakhir dipelajari", "Last studied")}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#1a2421" }}>{trBagianLabel(b.title, uiLang)}</div>
            <div style={{ fontSize: 12.5, color: "#7a8782" }}>Unit {lvContinue.unit.unitNumber} — {trTopic(lvContinue.unit.topicName, uiLang)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={s.bagianTrack}><div style={{ ...s.bagianFill, width: `${lvContinue.percent}%` }} /></div>
          <div style={s.bagianPercent}>{lvContinue.percent}%</div>
        </div>
        {withButton && (
          <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive }} onClick={continueLevantine}>
            {lx("LANJUTKAN PELAJARAN", "CONTINUE LESSON")}
          </button>
        )}
      </div>
    );
  };

  const goAmmiyahPath = (bagian) => {
    setActiveBagian(bagian);
    setActiveUnitIdx(0);
    setPage("ammiyahPath");
    // Tidak scroll ke atas di sini — biarkan efek di bawah yang scroll
    // langsung ke bulatan yang sedang aktif, begitu halamannya selesai render.
  };

  // Bulatan matahari "Review Semua Kosakata" di halaman daftar Bagian —
  // hanya terbuka begitu progress Bagian tersebut 100% (semua unit selesai).
  const [bagianReviewIntro, setBagianReviewIntro] = useState(null); // bagian | null

  const openBagianReviewIntro = (bagian) => {
    // Sengaja TIDAK ada guard "kalau belum 100% jangan dibuka" — bubble
    // harus tetap kebuka walau Bagian belum selesai, biar user tau apa
    // fungsi bulatan ini dan kenapa masih terkunci.
    setBagianReviewIntro((cur) => (cur && cur.id === bagian.id ? null : bagian));
  };

  const confirmStartBagianReview = async () => {
    if (!bagianReviewIntro) return;
    const bagian = bagianReviewIntro;
    setBagianReviewIntro(null);
    setActiveBagian(bagian);
    setLessonCtx({ bagian, unit: { topicName: `Semua Kosakata — ${bagian.title}` }, level: { type: "vocabReview", scope: "bagian" } });
    setLessonExercises([]);
    setLessonIndex(0);
    resetExerciseState();
    setLessonScore(0);
    setPage("ammiyahLesson");
    window.scrollTo({ top: 0, behavior: "auto" });
    try {
      const exercises = await AmmiyahDataSource.getVocabReviewForBagian(bagian);
      setLessonExercises(exercises);
    } catch (err) {
      console.error("Gagal memuat soal review Bagian:", err);
      alert("Gagal memuat soal review Bagian: " + err.message);
      setPage("ammiyahBagian");
    }
  };

  const [pathUnits, setPathUnits] = useState([]);
  const [pathUnitsLoading, setPathUnitsLoading] = useState(true);
  const [pathUnitsError, setPathUnitsError] = useState(null);

  // Ambil Unit + Level dari Supabase untuk Bagian yang lagi dibuka.
  useEffect(() => {
    if (page !== "ammiyahPath" || !activeBagian) return;
    let cancelled = false;
    setPathUnitsError(null);
    // Tampilkan salinan terakhir (kalau ada) LANGSUNG, lalu perbarui diam-diam begitu data segar tiba.
    let shownStale = false;
    try {
      const stale = window.localStorage.getItem(`ls_units_swr_v1_ls_units_cache_v2_${activeBagian.id}_${currentUser?.id || "guest"}`);
      if (stale) { setPathUnits(JSON.parse(stale)); shownStale = true; }
    } catch (e) { /* abaikan */ }
    setPathUnitsLoading(!shownStale);
    AmmiyahDataSource.getUnitsForBagian(activeBagian)
      .then((units) => {
        if (!cancelled) {
          setPathUnits(units);
          setPathUnitsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPathUnitsError(err.message || "Gagal memuat data.");
          setPathUnitsLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeBagian]);

  // Begitu masuk halaman path, langsung scroll ke bulatan yang sedang
  // dikerjakan user (status "current") — supaya tidak perlu scroll manual
  // nyari posisi terakhir tiap kali buka halaman ini.
  useEffect(() => {
    if (page !== "ammiyahPath") return;
    const sections = unitSectionRefs.current.filter(Boolean);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Number(entry.target.dataset.unitIdx);
            setActiveUnitIdx(idx);
          }
        });
      },
      { rootMargin: "-120px 0px -70% 0px", threshold: 0 }
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // pathUnits sengaja ditambahkan: data Unit di-fetch ASYNC di effect lain
    // dengan dependency [page, activeBagian] yang sama — tanpa pathUnits di
    // sini, observer ini kadung jalan duluan saat pathUnits masih kosong,
    // dan gak pernah dipasang ulang begitu data akhirnya siap.
  }, [page, activeBagian, pathUnits]);

  // Posisi scroll TERAKHIR user di halaman path — disimpan pas user KLIK
  // masuk ke 1 lesson (lihat startLesson), dipulihkan PERSIS pas balik lagi
  // ke halaman ini. null = belum pernah ada posisi tersimpan (kunjungan
  // pertama), baru di situ fallback ke scroll-ke-current-node.
  const savedPathScrollRef = useRef(null);

  useEffect(() => {
    if (page !== "ammiyahPath") return;
    const timer = setTimeout(() => {
      if (savedPathScrollRef.current !== null) {
        // Balik PERSIS ke posisi scroll terakhir user, apa adanya — bukan
        // "cari node current lalu scroll ke situ", karena posisi user
        // sebelumnya bisa aja di unit lain yang lagi dia lihat-lihat.
        window.scrollTo({ top: savedPathScrollRef.current, behavior: "auto" });
      } else {
        // Kunjungan PERTAMA kali ke halaman ini (belum pernah nyimpen
        // posisi apa pun) — baru di sini masuk akal auto-scroll ke bulatan
        // yang lagi "current", biar user gak perlu cari-cari manual.
        currentNodeRef.current?.scrollIntoView({ behavior: "auto", block: "center" });
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [page, activeBagian, pathUnits]);

  const renderAmmiyahIntro = () => {
    const feats = [
      ["mic", t("introFeature1Title", uiLang), t("introFeature1Desc", uiLang)],
      ["chat", t("introFeature2Title", uiLang), t("introFeature2Desc", uiLang)],
      ["headphones", t("introFeature3Title", uiLang), t("introFeature3Desc", uiLang)],
    ];
    const startLearning = () => {
      if (!currentUser && !isLocalDev()) {
        setAuthRedirectTarget("ammiyahBagian");
        setAuthMode("login");
        setPage("login");
      } else {
        setPage("ammiyahBagian");
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    return (
      <div>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 20px 56px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 22 }}>
            <LangSwitch uiLang={uiLang} onChange={changeUiLang} s={s} title={t("chooseLanguage", uiLang)} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <div style={{ width: 58, height: 58, borderRadius: 19, background: "white", border: "1px solid #e8eeeb", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 18px rgba(20,40,30,0.08)", flexShrink: 0 }}>
              <JordanFlag size={34} />
            </div>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 1.4, color: GREEN_DARK, fontWeight: 800 }}>LEVANTINE</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2421", lineHeight: 1.25, marginTop: 2 }}>{t("introTitle", uiLang)}</div>
            </div>
          </div>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#55625d", margin: "0 0 26px" }}>{t("introDesc", uiLang)}</p>

          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#8a9692", marginBottom: 10 }}>{t("introFeatureLabel", uiLang).replace(/:\s*$/, "").toUpperCase()}</div>
          <div style={{ marginBottom: 26 }}>
            {feats.map(([icon, title, desc]) => (
              <div key={title} style={{ background: "white", border: "1px solid #e8eeeb", borderRadius: 18, padding: "14px 16px", marginBottom: 10, display: "flex", gap: 14, alignItems: "flex-start", boxShadow: "0 1px 2px rgba(20,40,30,0.04), 0 6px 20px rgba(20,40,30,0.04)" }}>
                <IconTile name={icon} C={{ GREEN_DARK }} size={40} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: "#1a2421" }}>{title}</div>
                  <div style={{ fontSize: 13, color: "#7a8782", lineHeight: 1.55, marginTop: 2 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {renderLvContinueCard(false)}

          <button style={{ ...s.introCta, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} onClick={lvContinue ? continueLevantine : startLearning}>
            {lvContinue ? lx("LANJUTKAN PELAJARAN", "CONTINUE LESSON") : lx("MULAI BELAJAR", "LEARN NOW")} <Icon name="chevron" size={18} stroke={2.4} />
          </button>
          {lvContinue && (
            <button style={{ width: "100%", background: "none", border: "none", color: GREEN_DARK, marginTop: 12, cursor: "pointer", fontSize: 14, fontWeight: 600 }} onClick={startLearning}>
              {lx("Lihat semua Bagian", "View all Sections")}
            </button>
          )}
        </div>
        {renderFooter()}
      </div>
    );
  };

  const [bagianList, setBagianList] = useState([]);
  const [bagianListLoading, setBagianListLoading] = useState(true);
  const [bagianListError, setBagianListError] = useState(null);

  // Ambil daftar Bagian dari Supabase begitu halaman ini dibuka.
  useEffect(() => {
    if (page !== "ammiyahBagian") return;
    let cancelled = false;
    setBagianListError(null);
    let shownStaleList = false;
    try {
      const stale = window.localStorage.getItem("ls_bagian_list_swr_v1");
      if (stale) { setBagianList(JSON.parse(stale)); shownStaleList = true; }
    } catch (e) { /* abaikan */ }
    setBagianListLoading(!shownStaleList);
    AmmiyahDataSource.getBagianList()
      .then((list) => {
        if (!cancelled) {
          setBagianList(list);
          setBagianListLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setBagianListError(err.message || "Gagal memuat data.");
          setBagianListLoading(false);
        }
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const renderAmmiyahBagian = () => (
    <div>
      <div style={s.ammiyahPage}>
        <div style={s.ammiyahHeader}>
          <button style={s.ammiyahBackBtn} onClick={() => setPage("ammiyah")} aria-label={lx("Kembali", "Back")}>‹</button>
          <div style={{ width: 40, height: 40, borderRadius: 13, background: "white", border: "1px solid #e8eeeb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <JordanFlag size={24} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.ammiyahTitle}>Levantine</div>
            <div style={s.ammiyahSubtitle}>{t("ammiyahSubtitle", uiLang)}</div>
          </div>
        </div>

        {renderLvContinueCard()}

        {bagianListLoading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>{t("loadingBagianList", uiLang)}</div>
        )}
        {bagianListError && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#c23b3b" }}>
            {t("failedToLoadPrefix", uiLang)}{bagianListError}
          </div>
        )}
        {!bagianListLoading && !bagianListError && bagianList.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
            {t("noBagianYet", uiLang)}
          </div>
        )}

        {bagianList.map((bagian, bagianIdx) => {
          const isBagianDone = bagian.progress >= 100;
          const isBagianReviewOpen = bagianReviewIntro && bagianReviewIntro.id === bagian.id;
          const bagianLevel = levelOfBagian(bagian.orderIndex);
          const showLevelHeader = bagianIdx === 0 || levelOfBagian(bagianList[bagianIdx - 1].orderIndex) !== bagianLevel;
          return (
            <React.Fragment key={bagian.id}>
            {showLevelHeader && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: bagianIdx === 0 ? "4px 2px 12px" : "26px 2px 12px" }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: bagianLevel === "beginner" ? "#2e7d5b" : "#8a5a00", background: bagianLevel === "beginner" ? "#E6F4EC" : "#FFF1D6", padding: "4px 11px", borderRadius: 999 }}>
                  {bagianLevel === "beginner" ? "Beginner" : "Intermediate"}
                </span>
                <span style={{ flex: 1, height: 1, background: "#e3e9e6" }} />
              </div>
            )}
            <div style={{ ...s.bagianCard, padding: "16px 18px" }} onClick={() => goAmmiyahPath(bagian)}
              onMouseEnter={() => AmmiyahDataSource.getUnitsForBagian(bagian).catch(() => {})}
              onTouchStart={() => AmmiyahDataSource.getUnitsForBagian(bagian).catch(() => {})}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 15, background: "#e8f1ed", color: GREEN_DARK, fontWeight: 800, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {bagian.orderIndex}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2421" }}>{trBagianLabel(bagian.title, uiLang)}</div>
                  <div style={{ fontSize: 12, color: "#8a9692", margin: "3px 0 8px" }}>{lx("Unit", "Units")} {bagian.rangeLabel}</div>
                  <div style={s.bagianTrackRow}>
                    <div style={s.bagianTrack}>
                      <div style={{ ...s.bagianFill, width: `${bagian.progress}%` }} />
                    </div>
                    <div style={s.bagianPercent}>{bagian.progress}%</div>
                  </div>
                </div>

                <div style={{ position: "relative" }}>
                  <div style={s.bagianSunRingWrap}>
                    <div
                      style={{
                        ...s.bagianSunRing,
                        background: isBagianDone
                          ? ringGradientN("#FFA23A", bagianReviewReps[bagian.id] || 0, REPS_PER_BAGIAN_REVIEW)
                          : "#e2e2e2",
                      }}
                    />
                    <button
                      style={{ ...s.bagianSunNode, ...(isBagianDone ? {} : s.bagianSunNodeLocked) }}
                      title={lx("Review semua kosakata Bagian ini", "Review all vocabulary in this Section")}
                      onClick={(e) => { e.stopPropagation(); openBagianReviewIntro(bagian); }}
                    >
                      {isBagianDone ? <SunIcon size={18} color="#fff" /> : <Icon name="lock" size={16} color="#9aa6a1" />}
                    </button>
                  </div>

                  {isBagianReviewOpen && (
                    <div style={s.bagianSunBubble} onClick={(e) => e.stopPropagation()}>
                      <div style={s.bagianSunBubbleTail} />
                      <div style={s.bubbleHead}><span style={{ ...s.bubbleIcon, background: isBagianDone ? "#FFF3DC" : "#eef1ef" }}>{isBagianDone ? <SunIcon size={16} color="#E8920F" /> : <Icon name="lock" size={15} color="#8a9690" />}</span>
                      <div style={s.bagianSunBubbleText}>
                        {isBagianDone ? (
                          <>{t("reviewBagianDoneBefore", uiLang)}<b>{trBagianLabel(bagian.title, uiLang)}</b>{t("reviewBagianDoneAfter", uiLang)}</>
                        ) : (
                          <>{t("reviewBagianLockedBefore", uiLang)}<b>{trBagianLabel(bagian.title, uiLang)}</b>{t("reviewBagianLockedAfter", uiLang)}</>
                        )}
                      </div></div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {isBagianDone && <button style={s.bagianSunBubbleBtn} onClick={confirmStartBagianReview}>{t("btnStartReview", uiLang)}</button>}
                        <button style={s.bagianSunBubbleClose} onClick={() => setBagianReviewIntro(null)}><Icon name="x" size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            </React.Fragment>
          );
        })}
      </div>
      {renderFooter()}
    </div>
  );

  const renderAmmiyahPath = () => {
    if (!activeBagian) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div style={{ color: "#888", fontSize: 14 }}>{t("pickBagianFirst", uiLang)}</div>
          <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive, maxWidth: 220 }} onClick={() => setPage("ammiyahBagian")}>
            {t("backToBagianList", uiLang)}
          </button>
        </div>
      );
    }
    const bagian = activeBagian;
    const units = pathUnits;
    if (pathUnitsLoading) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <PlanetMascot size={70} />
          <div style={{ color: "#888", fontSize: 14 }}>{t("loadingUnitLevel", uiLang)}</div>
        </div>
      );
    }
    if (pathUnitsError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, textAlign: "center" }}>
          <div style={{ color: "#c23b3b", fontSize: 14 }}>{t("failedToLoadPrefix", uiLang)}{pathUnitsError}</div>
          <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive, maxWidth: 220 }} onClick={() => setPage("ammiyahBagian")}>
            {t("backToBagianList", uiLang)}
          </button>
        </div>
      );
    }
    const activeUnit = units[activeUnitIdx] || units[0];
    const activeColor = UNIT_COLORS[activeUnitIdx % UNIT_COLORS.length];
    // Hanya SATU node yang diberi sorotan "MULAI" + maskot: level terbuka pertama yang belum selesai.
    const nextLvlId = (units.flatMap((u) => u.levels).find((l) => l.status === "current") || {}).id;

    if (units.length === 0) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20, textAlign: "center" }}>
          <div style={{ color: "#888", fontSize: 14 }}>
            {t("noUnitYetPrefix", uiLang)}{trBagianLabel(bagian.title, uiLang)}{t("noUnitYetSuffix", uiLang)}
          </div>
          <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive, maxWidth: 220 }} onClick={() => setPage("ammiyahBagian")}>
            {t("backToBagianList", uiLang)}
          </button>
        </div>
      );
    }

    return (
      <div>
        {/* Banner: kartu di tengah, ukuran sedang, warna & judul berganti
            otomatis sesuai unit yang sedang di-scroll */}
        <div style={s.unitBannerWrap}>
          <div style={{ ...s.unitBanner, background: activeColor.bg }}>
            <button style={s.unitBannerClose} onClick={() => setPage("ammiyahBagian")}>✕</button>
            <div style={s.unitBannerText}>
              <div style={s.unitBannerLabel}>{trBagianLabel(bagian.title, uiLang)}, Unit {activeUnit?.unitNumber}</div>
              <div style={s.unitBannerTopic}>{trTopic(activeUnit?.topicName, uiLang)}</div>
            </div>
            <div style={s.unitBannerDivider} />
            <button style={s.unitBannerIcon} title={t("unitNoteTitle", uiLang)}>📋</button>
          </div>
        </div>
      
        <div style={s.pathWrap}>
          {units.map((unit, uIdx) => {
            const color = UNIT_COLORS[uIdx % UNIT_COLORS.length];
            // Jalur berkelok: tiap node digeser ke kiri/kanan mengikuti gelombang, dihubungkan garis putus-putus.
            const ROW = 98, RING = 84, COLW = 300;
            const WAVE = [0, 54, 80, 54, 0, -54, -80, -54];
            const levels = unit.levels;
            const unitDone = isUnitDone(unit);
            const isVocabReviewOpen = vocabReviewIntro && vocabReviewIntro.unit.id === unit.id;
            const total = levels.length + 1; // + node mahkota "Review Vocabularies" di ujung
            const offAt = (i) => WAVE[i % WAVE.length];
            const cx = (i) => COLW / 2 + offAt(i);
            const cy = (i) => i * ROW + RING / 2;
            const segments = [];
            for (let i = 0; i < total - 1; i++) {
              const my = (cy(i) + cy(i + 1)) / 2;
              const reached = i < levels.length && levels[i].status === "done";
              segments.push({ d: `M ${cx(i)} ${cy(i)} C ${cx(i)} ${my}, ${cx(i + 1)} ${my}, ${cx(i + 1)} ${cy(i + 1)}`, reached });
            }
            const place = (i, children, ref) => (
              <div key={`n${i}`} ref={ref || null} style={{ position: "absolute", left: "50%", top: i * ROW, width: RING, marginLeft: -RING / 2, transform: `translateX(${offAt(i)}px)`, display: "flex", flexDirection: "column", alignItems: "center" }}>
                {children}
              </div>
            );
            return (
              <div
                key={unit.id}
                ref={(el) => (unitSectionRefs.current[uIdx] = el)}
                data-unit-idx={uIdx}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%" }}
              >
                {uIdx > 0 && (
                  <div style={{ ...s.unitDividerBox, background: color.bg }}>
                    {trTopic(unit.topicName, uiLang)}
                  </div>
                )}
                <div style={{ position: "relative", width: COLW, maxWidth: "none", height: (total - 1) * ROW + RING + 24, margin: "0 auto" }}>
                  <svg width={COLW} height={(total - 1) * ROW + RING} style={{ position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none" }} aria-hidden="true">
                    {segments.map((sg, i) => (
                      <path key={i} d={sg.d} fill="none" stroke={sg.reached ? color.bg : "#d6e0db"} strokeOpacity={sg.reached ? 0.55 : 1} strokeWidth="4" strokeLinecap="round" strokeDasharray={sg.reached ? "0.1 9" : "0.1 10"} />
                    ))}
                  </svg>

                  {levels.map((lvl, i) => {
                    const isCur = lvl.id === nextLvlId;
                    const nodeStyle =
                      lvl.status === "done" ? { ...s.pathNodeDone, background: color.bg, boxShadow: `0 8px 16px ${color.bg}55, inset 0 -3px 0 rgba(0,0,0,0.10), inset 0 2px 0 rgba(255,255,255,0.28)` } :
                      lvl.status === "current" ? { ...s.pathNodeCurrent, background: color.bg, boxShadow: `0 10px 22px ${color.bg}77, inset 0 -3px 0 rgba(0,0,0,0.10), inset 0 2px 0 rgba(255,255,255,0.28)` } :
                      s.pathNodeLocked;
                    const mascotSide = offAt(i) > 0 ? "left" : "right";
                    return place(i, (
                      <>
                        {isCur && (
                          <div className="path-start-chip" style={{ position: "absolute", top: -26, left: "50%", transform: "translateX(-50%)", background: "white", color: color.dark, border: `1.5px solid ${color.bg}`, borderRadius: 10, padding: "3px 10px", fontSize: 11.5, fontWeight: 800, letterSpacing: 0.6, whiteSpace: "nowrap", boxShadow: "0 4px 10px rgba(0,0,0,0.08)" }}>
                            {lx("MULAI", "START")}
                          </div>
                        )}
                        <div style={s.pathRingWrap}>
                          {isCur && <span className="path-halo" style={{ position: "absolute", inset: 6, borderRadius: "50%", border: `3px solid ${color.bg}` }} />}
                          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ringGradient(color.bg, lvl.reps) }} />
                          <button
                            className="path-node"
                            aria-label={`${NODE_META[lvl.type]?.label || lvl.type}${lvl.status === "locked" ? " (terkunci)" : ""}`}
                            style={{ ...s.pathNode, ...nodeStyle }}
                            disabled={lvl.status === "locked"}
                            onClick={() => lvl.status !== "locked" && startLesson(bagian, unit, lvl)}
                          >
                            {renderNodeIcon(lvl.type, lvl.status)}
                          </button>
                        </div>
                        {isCur && (
                          <>
                            <div className="path-mascot" style={{ position: "absolute", top: 4, [mascotSide]: -(RING - 6), pointerEvents: "none" }}>
                              <PlanetMascot size={62} />
                            </div>
                          </>
                        )}
                      </>
                    ), isCur ? currentNodeRef : null);
                  })}

                  {/* Node mahkota di ujung jalur — terkunci sampai SEMUA level di unit ini selesai (isUnitDone). Tombol
                      sengaja tanpa atribut disabled supaya klik saat terkunci tetap membuka penjelasan di bubble. */}
                  {place(levels.length, (
                    <>
                      <div style={s.pathRingWrap}>
                        <div style={{ ...s.vocabReviewRing, background: unitDone ? "#F7CD5A" : "#e2e2e2" }} />
                        <button
                          className="path-node"
                          aria-label="Review Vocabularies"
                          style={{ ...s.vocabReviewNode, ...(unitDone ? {} : s.vocabReviewNodeLocked) }}
                          onClick={() => openVocabReviewIntro(bagian, unit)}
                        >
                          {unitDone ? <CrownIcon size={26} color="#A9762F" /> : NODE_ICON.locked}
                        </button>
                      </div>
                      {isVocabReviewOpen && (
                        <div style={{ ...s.vocabReviewBubble, left: "50%", transform: `translateX(calc(-50% - ${offAt(levels.length)}px))`, top: "100%", maxWidth: "calc(100vw - 40px)" }}>
                          <div style={s.vocabReviewBubbleTail} />
                          <div style={s.bubbleHead}><span style={{ ...s.bubbleIcon, background: unitDone ? "#FFF3DC" : "#eef1ef" }}>{unitDone ? <CrownIcon size={18} color="#E8920F" /> : <Icon name="lock" size={15} color="#8a9690" />}</span>
                          <div style={s.vocabReviewBubbleText}>
                            {unitDone ? (
                              <>{t("reviewUnitDoneBefore", uiLang)}<b>{trTopic(unit.topicName, uiLang)}</b>{t("reviewUnitDoneAfter", uiLang)}</>
                            ) : (
                              <>{t("reviewUnitLockedBefore", uiLang)}<b>{trTopic(unit.topicName, uiLang)}</b>{t("reviewUnitLockedAfter", uiLang)}</>
                            )}
                          </div></div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {unitDone && <button style={s.vocabReviewBubbleBtn} onClick={confirmStartVocabReview}>{t("btnStartReview", uiLang)}</button>}
                            <button style={s.vocabReviewBubbleClose} onClick={() => setVocabReviewIntro(null)}><Icon name="x" size={14} /></button>
                          </div>
                        </div>
                      )}
                    </>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {renderFooter()}
      </div>
    );
  };

  // ============================================================
  // HALAMAN LATIHAN/SOAL (dibuka saat node di learning path diklik)
  // Tipe soal mengikuti enum `exercise_type` di tabel `exercises`
  // (lihat skema SQL yang sudah dibuat). 5 tipe di bawah diimplementasi
  // penuh sebagai contoh; sisanya (matching_pairs, listen_type,
  // listen_complete, dialogue_complete, read_respond,
  // reading_comprehension) memakai pola `content` JSONB yang sama dan
  // tinggal ditambah case renderer-nya menyusul.
  // ============================================================
  // Set soal "Vocabulary & Grammar" — materi baru, hint lengkap (translit + audio)
  // Set soal "Vocabulary & Grammar" — materi baru, hint lengkap (translit + audio)
  const LESSON_EXERCISES = [
    {
      type: "fill_blank",
      prompt: "Isi bagian yang kosong",
      content: {
        bubbleLines: [{ latin: "ana biddi", text: "أنا بدّي", blankAfter: true }],
        options: [
          { latin: "mai", text: "مي" },
          { latin: "ktab", text: "كتاب" },
          { latin: "qalam", text: "قلم" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "translate_choice",
      prompt: "Pilih terjemahan yang benar",
      content: {
        promptText: "Terima kasih",
        options: [
          { latin: "shukran", text: "شكرا" },
          { latin: "bet", text: "بيت" },
          { latin: "ktab", text: "كتاب" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "word_order",
      prompt: "Susun terjemahannya",
      content: {
        latin: "biddi qahwe w shay",
        text: "بدّي قهوة وشاي",
        hasAudio: true,
        correctWords: ["Saya", "mau", "kopi", "dan", "teh"],
        wordBank: ["Saya", "mau", "kopi", "dan", "teh", "roti", "kamu"],
      },
    },
    {
      type: "translate_write",
      prompt: "Tulis terjemahannya",
      content: { text: "Selamat pagi", correctAnswer: "صباح الخير" },
    },
    {
      type: "listen_choose",
      prompt: "Dengarkan lalu pilih jawaban yang benar",
      content: {
        hasAudio: true,
        options: [
          { latin: "marhaba", text: "مرحبا" },
          { latin: "shukran", text: "شكرا" },
          { latin: "ma'a salame", text: "مع السلامة" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "translate_choice",
      prompt: "Pilih terjemahan yang benar",
      content: {
        promptText: "Rumah",
        options: [
          { latin: "beit", text: "بيت" },
          { latin: "souq", text: "سوق" },
          { latin: "madrase", text: "مدرسة" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "fill_blank",
      prompt: "Isi bagian yang kosong",
      content: {
        bubbleLines: [{ latin: "sabah el", text: "صباح ال", blankAfter: true }],
        options: [
          { latin: "kheir", text: "خير" },
          { latin: "kbir", text: "كبير" },
          { latin: "helu", text: "حلو" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "word_order",
      prompt: "Susun terjemahannya",
      content: {
        latin: "ana rayeh 'a-madrase",
        text: "أنا رايح عالمدرسة",
        hasAudio: true,
        correctWords: ["Saya", "pergi", "ke", "sekolah"],
        wordBank: ["Saya", "pergi", "ke", "sekolah", "pasar", "rumah"],
      },
    },
    {
      type: "translate_write",
      prompt: "Tulis terjemahannya",
      content: { text: "Kopi dan teh", correctAnswer: "قهوة وشاي" },
    },
    {
      type: "listen_choose",
      prompt: "Dengarkan lalu pilih jawaban yang benar",
      content: {
        hasAudio: true,
        options: [
          { latin: "tamam", text: "تمام" },
          { latin: "ktir", text: "كتير" },
          { latin: "shway", text: "شوي" },
        ],
        correctIndex: 0,
      },
    },
  ];

  // Set soal "Personalized Practice" — materi yang dianggap sulit,
  // memperbaiki kelemahan (nanti: dipilih otomatis dari histori kesalahan user)
  const PRACTICE_EXERCISES = [
    {
      type: "matching_pairs",
      prompt: "Cocokkan kata yang sering ketuker",
      content: {
        pairs: [
          { id: "q1", left: "هلق", leftLatin: "halla'", right: "Sekarang" },
          { id: "q2", left: "بعدين", leftLatin: "ba'dein", right: "Nanti" },
          { id: "q3", left: "وين", leftLatin: "wein", right: "Di mana" },
          { id: "q4", left: "شو", leftLatin: "shu", right: "Apa" },
        ],
        rightOrder: ["q3", "q1", "q4", "q2"],
      },
    },
    {
      type: "translate_choice",
      prompt: "Pilih terjemahan yang benar",
      content: {
        promptText: "Di mana",
        options: [
          { latin: "wein", text: "وين" },
          { latin: "shu", text: "شو" },
          { latin: "yalla", text: "يلا" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "fill_blank",
      prompt: "Isi bagian yang kosong",
      content: {
        bubbleLines: [{ latin: "ana rayeh 'a", text: "أنا رايح ع", blankAfter: true }],
        options: [
          { latin: "souq", text: "السوق" },
          { latin: "beit", text: "البيت" },
          { latin: "madrase", text: "المدرسة" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "matching_pairs",
      prompt: "Cocokkan kata yang sering ketuker",
      content: {
        pairs: [
          { id: "r1", left: "بكرا", leftLatin: "bukra", right: "Besok" },
          { id: "r2", left: "مبارح", leftLatin: "mbareh", right: "Kemarin" },
          { id: "r3", left: "كبير", leftLatin: "kbir", right: "Besar" },
          { id: "r4", left: "صغير", leftLatin: "zghir", right: "Kecil" },
        ],
        rightOrder: ["r3", "r1", "r4", "r2"],
      },
    },
    {
      type: "translate_choice",
      prompt: "Pilih terjemahan yang benar",
      content: {
        promptText: "Berapa",
        options: [
          { latin: "kam", text: "كم" },
          { latin: "shu", text: "شو" },
          { latin: "wein", text: "وين" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "fill_blank",
      prompt: "Isi bagian yang kosong",
      content: {
        bubbleLines: [{ latin: "hayde flous", text: "هيدي فلوس", blankAfter: true }],
        options: [
          { latin: "ktir", text: "كتير" },
          { latin: "helu", text: "حلو" },
          { latin: "mnih", text: "منيح" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "word_order",
      prompt: "Susun terjemahannya",
      content: {
        latin: "biddak tise'ed?",
        text: "بدك تساعد؟",
        hasAudio: true,
        correctWords: ["Kamu", "mau", "bantu"],
        wordBank: ["Kamu", "mau", "bantu", "sekarang", "besok"],
      },
    },
    {
      type: "translate_write",
      prompt: "Tulis terjemahannya",
      content: { text: "Sekarang atau nanti", correctAnswer: "هلق أو بعدين" },
    },
  ];

  // Set soal "Story" — cerita pendek, reading, pemahaman konteks
  const STORY_EXERCISES = [
    {
      type: "reading_comprehension",
      prompt: "Pahami bacaannya, lalu jawab",
      content: {
        passageLatin: "kill youm, ana bru7 'a-souq. bashtri khodra w fawakeh.",
        passageText: "كل يوم، أنا بروح عالسوق. بشتري خضرا وفواكه.",
        question: "Apa yang dibeli orang ini di pasar?",
        options: [{ text: "Sayur dan buah" }, { text: "Buku" }, { text: "Kopi" }],
        correctIndex: 0,
      },
    },
    {
      type: "read_respond",
      prompt: "Baca lalu jawab",
      content: {
        passageLatin: "ana rayeh 'a-souq bukra",
        passageText: "أنا رايح عالسوق بكرا",
        question: "Kapan orang ini pergi ke pasar?",
        options: [{ text: "Besok" }, { text: "Hari ini" }, { text: "Kemarin" }],
        correctIndex: 0,
      },
    },
    {
      type: "reading_comprehension",
      prompt: "Pahami bacaannya, lalu jawab",
      content: {
        passageLatin: "hayde ukhti. hiyye tudrus b-il-jam'a. hiyye bethibb el-'arabi ktir.",
        passageText: "هيدي أختي. هيّي تدرس بالجامعة. هيّي بتحب العربي كتير.",
        question: "Kakak perempuannya suka apa?",
        options: [{ text: "Bahasa Arab" }, { text: "Memasak" }, { text: "Olahraga" }],
        correctIndex: 0,
      },
    },
    {
      type: "read_respond",
      prompt: "Baca lalu jawab",
      content: {
        passageLatin: "sabahiyye, ana bishrab qahwe m'a khubz",
        passageText: "صباحية، أنا بشرب قهوة مع خبز",
        question: "Apa yang diminum orang ini di pagi hari?",
        options: [{ text: "Kopi" }, { text: "Teh" }, { text: "Air" }],
        correctIndex: 0,
      },
    },
    {
      type: "reading_comprehension",
      prompt: "Pahami bacaannya, lalu jawab",
      content: {
        passageLatin: "huwwe 'am beshtghel b-mustashfa kbir b-'amman",
        passageText: "هوّي عم بشتغل بمستشفى كبير بعمّان",
        question: "Di mana orang ini bekerja?",
        options: [{ text: "Di rumah sakit besar" }, { text: "Di sekolah" }, { text: "Di pasar" }],
        correctIndex: 0,
      },
    },
    {
      type: "read_respond",
      prompt: "Baca lalu jawab",
      content: {
        passageLatin: "ihna rayheen 'a-mat'am helu hallak",
        passageText: "إحنا رايحين عالمطعم حلو هلق",
        question: "Kapan mereka pergi ke restoran?",
        options: [{ text: "Sekarang" }, { text: "Besok" }, { text: "Kemarin" }],
        correctIndex: 0,
      },
    },
    {
      type: "reading_comprehension",
      prompt: "Pahami bacaannya, lalu jawab",
      content: {
        passageLatin: "el-baas bewassel 'a-jam'a kill sa'a",
        passageText: "الباص بيوصل عالجامعة كل ساعة",
        question: "Kemana bus itu mengantar?",
        options: [{ text: "Ke universitas" }, { text: "Ke pasar" }, { text: "Ke rumah sakit" }],
        correctIndex: 0,
      },
    },
    {
      type: "read_respond",
      prompt: "Baca lalu jawab",
      content: {
        passageLatin: "ana bhebb el-akl el-'arabi ktir",
        passageText: "أنا بحب الأكل العربي كتير",
        question: "Apa yang disukai orang ini?",
        options: [{ text: "Masakan Arab" }, { text: "Buku" }, { text: "Sekolah" }],
        correctIndex: 0,
      },
    },
  ];

  // Set soal "Conversation" — penggunaan bahasa dalam situasi nyata (dialog)
  const CONVERSATION_EXERCISES = [
    {
      type: "dialogue_complete",
      prompt: "Lengkapi percakapannya",
      content: {
        dialogueLines: [
          { speaker: "A", latin: "sabah el-kheir", text: "صباح الخير" },
          { speaker: "B", latin: "___", text: "___", blank: true },
        ],
        options: [
          { latin: "sabah el-nour", text: "صباح النور" },
          { latin: "shukran", text: "شكرا" },
          { latin: "wein", text: "وين" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "dialogue_complete",
      prompt: "Lengkapi percakapannya",
      content: {
        dialogueLines: [
          { speaker: "A", latin: "kifak?", text: "كيفك؟" },
          { speaker: "B", latin: "___, w inte?", text: "___، وإنتَ؟", blank: true },
        ],
        options: [
          { latin: "mnih, shukran", text: "منيح، شكرا" },
          { latin: "bet kbir", text: "بيت كبير" },
          { latin: "yalla bye", text: "يلا باي" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "listen_choose",
      prompt: "Dengarkan lalu pilih jawaban yang benar",
      content: {
        hasAudio: true,
        options: [
          { latin: "yalla", text: "يلا" },
          { latin: "shukran", text: "شكرا" },
          { latin: "beit", text: "بيت" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "dialogue_complete",
      prompt: "Lengkapi percakapannya",
      content: {
        dialogueLines: [
          { speaker: "A", latin: "shukran ktir", text: "شكرا كتير" },
          { speaker: "B", latin: "___", text: "___", blank: true },
        ],
        options: [
          { latin: "al-'afw", text: "العفو" },
          { latin: "wein", text: "وين" },
          { latin: "kam", text: "كم" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "dialogue_complete",
      prompt: "Lengkapi percakapannya",
      content: {
        dialogueLines: [
          { speaker: "A", latin: "hayde bikam?", text: "هيدي بكم؟" },
          { speaker: "B", latin: "___", text: "___", blank: true },
        ],
        options: [
          { latin: "khamse denanir", text: "خمسة دنانير" },
          { latin: "sabah el-kheir", text: "صباح الخير" },
          { latin: "ma'a salame", text: "مع السلامة" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "listen_choose",
      prompt: "Dengarkan lalu pilih jawaban yang benar",
      content: {
        hasAudio: true,
        options: [
          { latin: "biddi taxi", text: "بدي تاكسي" },
          { latin: "biddi ktab", text: "بدي كتاب" },
          { latin: "biddi mai", text: "بدي مي" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "dialogue_complete",
      prompt: "Lengkapi percakapannya",
      content: {
        dialogueLines: [
          { speaker: "A", latin: "wein es-saydaliyye?", text: "وين الصيدلية؟" },
          { speaker: "B", latin: "___", text: "___", blank: true },
        ],
        options: [
          { latin: "hunik, jamb el-mat'am", text: "هونيك، جمب المطعم" },
          { latin: "ana mnih, shukran", text: "أنا منيح، شكرا" },
          { latin: "ma'a salame", text: "مع السلامة" },
        ],
        correctIndex: 0,
      },
    },
    {
      type: "dialogue_complete",
      prompt: "Lengkapi percakapannya",
      content: {
        dialogueLines: [
          { speaker: "A", latin: "yalla, ihna met'akhrin!", text: "يلا، إحنا متأخرين!" },
          { speaker: "B", latin: "___", text: "___", blank: true },
        ],
        options: [
          { latin: "tamam, jaye halla'", text: "تمام، جاي هلق" },
          { latin: "biddi qahwe", text: "بدي قهوة" },
          { latin: "hayde ktab", text: "هيدي كتاب" },
        ],
        correctIndex: 0,
      },
    },
  ];

  // Set soal "Practice/Review" — materi lama (spaced repetition), TANPA hint
  // transliterasi (latin dikosongkan) dan tanpa word bank berlebih — sengaja
  // lebih sulit karena ini uji ketahanan ingatan, bukan pengenalan awal.
  const REVIEW_EXERCISES = [
    {
      type: "translate_write",
      prompt: "Tulis terjemahannya (tanpa bantuan)",
      content: { text: "Terima kasih banyak", correctAnswer: "شكرا كتير" },
    },
    {
      type: "listen_choose",
      prompt: "Dengarkan lalu pilih jawaban yang benar",
      content: {
        hasAudio: true,
        options: [{ text: "منيح" }, { text: "بيت" }, { text: "مي" }],
        correctIndex: 0,
      },
    },
    {
      type: "fill_blank",
      prompt: "Isi bagian yang kosong",
      content: {
        bubbleLines: [{ text: "أنا بدّي", blankAfter: true }],
        options: [{ text: "قهوة" }, { text: "مدرسة" }, { text: "سيارة" }],
        correctIndex: 0,
      },
    },
    {
      type: "word_order",
      prompt: "Susun terjemahannya",
      content: {
        latin: "",
        text: "بدّي قهوة وشاي",
        hasAudio: true,
        correctWords: ["Saya", "mau", "kopi", "dan", "teh"],
        wordBank: ["Saya", "mau", "kopi", "dan", "teh", "roti", "kamu"],
      },
    },
    {
      type: "translate_choice",
      prompt: "Pilih terjemahan yang benar",
      content: {
        promptText: "Di mana",
        options: [{ text: "وين" }, { text: "شو" }, { text: "كم" }],
        correctIndex: 0,
      },
    },
    {
      type: "matching_pairs",
      prompt: "Cocokkan pasangannya",
      content: {
        pairs: [
          { id: "s1", left: "بكرا", right: "Besok" },
          { id: "s2", left: "مبارح", right: "Kemarin" },
          { id: "s3", left: "هلق", right: "Sekarang" },
          { id: "s4", left: "بعدين", right: "Nanti" },
        ],
        rightOrder: ["s3", "s1", "s4", "s2"],
      },
    },
    {
      type: "translate_write",
      prompt: "Tulis terjemahannya (tanpa bantuan)",
      content: { text: "Selamat tinggal", correctAnswer: "مع السلامة" },
    },
    {
      type: "fill_blank",
      prompt: "Isi bagian yang kosong",
      content: {
        bubbleLines: [{ text: "هوّي عم بشتغل ب", blankAfter: true }],
        options: [{ text: "مستشفى" }, { text: "قهوة" }, { text: "بيت" }],
        correctIndex: 0,
      },
    },
  ];


  // Pool soal "Review Vocabularies" — kosakata + pilihan arti, dari kata-kata
  // yang sudah dipelajari. Nanti: AmmiyahDataSource.getVocabReviewForUnit()
  // diganti fetch vocab_items where topic_id = unit.id (bisa lintas semua
  // node_type di unit itu), digenerate jadi soal translate_choice on-the-fly.
  //
  // Pool ini juga dipakai (dalam bentuk diperbesar + diacak) untuk bulatan
  // matahari "Review Semua Kosakata" 1 Bagian — mewakili gabungan kata dari
  // SEMUA unit di Bagian itu, bukan cuma 1 unit. Nanti diganti gabungan
  // vocab_items dari semua topic_id di bawah unit_id (= Bagian) tersebut.
  // eslint-disable-next-line no-unused-vars
  const VOCAB_REVIEW_POOL = [
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "مرحبا (marhaba)", options: [{ text: "Halo" }, { text: "Terima kasih" }, { text: "Rumah" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "شكرا (shukran)", options: [{ text: "Terima kasih" }, { text: "Di mana" }, { text: "Sekarang" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "بيت (beit)", options: [{ text: "Rumah" }, { text: "Buku" }, { text: "Air" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "وين (wein)", options: [{ text: "Di mana" }, { text: "Apa" }, { text: "Berapa" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "شو (shu)", options: [{ text: "Apa" }, { text: "Ayo" }, { text: "Besok" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "بكرا (bukra)", options: [{ text: "Besok" }, { text: "Kemarin" }, { text: "Sekarang" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "كتير (ktir)", options: [{ text: "Banyak/sangat" }, { text: "Sedikit" }, { text: "Besar" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "قهوة (qahwe)", options: [{ text: "Kopi" }, { text: "Teh" }, { text: "Roti" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "أهلا (ahlan)", options: [{ text: "Halo/selamat datang" }, { text: "Selamat tinggal" }, { text: "Maaf" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "عيلة ('a'ile)", options: [{ text: "Keluarga" }, { text: "Sekolah" }, { text: "Pekerjaan" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "أحمر (ahmar)", options: [{ text: "Merah" }, { text: "Biru" }, { text: "Hijau" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "بدي (biddi)", options: [{ text: "Saya mau" }, { text: "Saya pergi" }, { text: "Saya lihat" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "شتوة (shitwe)", options: [{ text: "Musim dingin" }, { text: "Musim panas" }, { text: "Hujan" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "يمين (yamin)", options: [{ text: "Kanan" }, { text: "Kiri" }, { text: "Lurus" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "سوق (souq)", options: [{ text: "Pasar" }, { text: "Sekolah" }, { text: "Rumah sakit" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "دكتور (doktor)", options: [{ text: "Dokter" }, { text: "Guru" }, { text: "Sopir" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "يلا (yalla)", options: [{ text: "Ayo" }, { text: "Nanti" }, { text: "Sudah" }], correctIndex: 0 } },
    { type: "translate_choice", prompt: "Pilih arti yang benar", content: { promptText: "منيح (mnih)", options: [{ text: "Baik/bagus" }, { text: "Buruk" }, { text: "Besar" }], correctIndex: 0 } },
  ];

  // Kocok array (Fisher-Yates) — dipakai supaya urutan kosakata review
  // Bagian selalu beda tiap dibuka (kesan "acak dari tiap unit").
  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // eslint-disable-next-line no-unused-vars
  const EXERCISES_BY_NODE_TYPE = {
    lesson: LESSON_EXERCISES,
    practice: PRACTICE_EXERCISES,
    story: STORY_EXERCISES,
    conversation: CONVERSATION_EXERCISES,
    review: REVIEW_EXERCISES,
  };

  const CHOICE_TYPES = ["translate_choice", "word_choice", "fill_blank", "listen_choose", "listen_complete", "dialogue_complete", "read_respond", "reading_comprehension"];

  const [lessonCtx, setLessonCtx] = useState(null); // { bagian, unit, level }
  const [lessonExercises, setLessonExercises] = useState([]);
  const [wordMeanings, setWordMeanings] = useState(new Map()); // kata_arab -> { arti, latin }
  const [wordBubble, setWordBubble] = useState(null); // { word, arti, latin, x, y } | null — balon arti-per-kata
  const [lessonIndex, setLessonIndex] = useState(0);
  const [lessonSelected, setLessonSelected] = useState(null);
  const [lessonBuiltWords, setLessonBuiltWords] = useState([]);
  // Kotak jawaban yang lagi "dipilih" buat ditukar posisinya — null kalau
  // belum ada yang dipilih. Lihat handlePlacedTileClick di bawah.
  const [lessonSelectedTileIdx, setLessonSelectedTileIdx] = useState(null);
  const [lessonTextAnswer, setLessonTextAnswer] = useState("");
  const [lessonChecked, setLessonChecked] = useState(false);
  const [lessonCorrect, setLessonCorrect] = useState(null);
  const [lessonScore, setLessonScore] = useState(0);
  const [lessonMatched, setLessonMatched] = useState([]); // id pasangan yang sudah cocok (matching_pairs)
  const [lessonMatchSel, setLessonMatchSel] = useState({ left: null, right: null });
  const exerciseShownAtRef = useRef(Date.now()); // buat hitung response_time_ms tiap soal
  const vocabAppearanceCountRef = useRef(new Map()); // berapa kali tiap vocab_id sudah muncul dalam sesi INI (poin G: maks 2-3)
  const MAX_SAME_VOCAB_PER_SESSION = 3;

  // Lapor jawaban ke /api/answer — dipanggil dari tiap handler cek jawaban
  // (selectChoice, checkBuiltAnswer, checkTextAnswer, matching_pairs).
  // Cuma jalan kalau user beneran login (currentUser.id ada) — guest/local
  // dev gak nyimpen progress apa pun ke server, konsisten dengan
  // goNextExerciseOrFinish yang juga skip kalau !currentUser.
  const recordAnswer = (ex, isCorrect, answerText, severity) => {
    // Hitung kemunculan tiap vocab di soal ini — ini jalan TERLEPAS dari
    // status login, karena dipakai buat batas "maks 2-3x per sesi" (poin G)
    // yang berlaku juga buat guest/local dev.
    for (const vid of ex?.vocabIds || []) {
      vocabAppearanceCountRef.current.set(vid, (vocabAppearanceCountRef.current.get(vid) || 0) + 1);
    }
    if (!currentUser?.id || !ex?.id) return;
    const responseTimeMs = Date.now() - exerciseShownAtRef.current;
    apiPost("/api/answer", {
      user_id: currentUser.id,
      exercise_id: ex.id,
      exercise_type: ex.type, // poin H: dasar tracking accuracy per tipe soal
      vocab_ids: ex.vocabIds || [],
      is_correct: isCorrect,
      severity, // "minor" | "major" | undefined — cuma relevan kalau isCorrect=false
      answer: answerText ?? null,
      response_time_ms: responseTimeMs,
    }).catch((err) => console.warn("Gagal menyimpan jawaban:", err.message));
  };

  // Hitung "seberapa jauh" 2 teks berbeda (Levenshtein distance sederhana)
  // — dipakai buat nentuin salah "minor" (typo kecil, satu-dua huruf beda)
  // vs "major" (jawaban jauh berbeda), biar penalti spaced-repetition-nya
  // adil (typo dikit gak harus dihukum sama beratnya kayak salah total).
  const levenshteinDistance = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[a.length][b.length];
  };
  const classifyTextErrorSeverity = (userAnswer, correctAnswer) => {
    const distance = levenshteinDistance(userAnswer, correctAnswer);
    const threshold = Math.max(2, Math.ceil(correctAnswer.length * 0.2)); // toleransi ~20% panjang teks
    return distance <= threshold ? "minor" : "major";
  };

  const resetExerciseState = () => {
    setLessonSelected(null);
    setLessonBuiltWords([]);
    setLessonSelectedTileIdx(null); // batal seleksi tukar-posisi tiap pindah soal
    setLessonTextAnswer("");
    setLessonChecked(false);
    setLessonCorrect(null);
    setLessonMatched([]);
    setLessonMatchSel({ left: null, right: null });
    exerciseShownAtRef.current = Date.now();
  };

  // Auto-play audio buat soal berbasis cerita/dialog (content.hasAudio ===
  // true) — begitu soal ini jadi "current", audio langsung diputar TANPA
  // nunggu user pencet tombol 🔊. Soal tipe lain (listen_choose dkk) TETAP
  // manual (via tombol), biar user gak kaget denger audio setiap soal.
  useEffect(() => {
    const ex = lessonExercises[lessonIndex];
    // Cerita, percakapan & soal lain: TIDAK diputar otomatis -- user menekan ikon 🔊 sendiri
    // (audio memutar seluruh teks sekaligus). Otomatis hanya untuk soal "dengarkan lalu susun" (audioOnly).
    if (ex?.content?.hasAudio && ex?.audioUrl && ex?.content?.audioOnly) {
      const audio = getCachedAudio(ex.audioUrl);
      try { audio.currentTime = 0; } catch (e) { /* belum siap, abaikan */ }
      audio.play().catch((err) => console.warn("Autoplay audio gagal (browser mungkin block autoplay):", err.message));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonIndex, lessonExercises]);

  const SEGMENTS_PER_LEVEL = 4; // samain sama SEGMENTS_PER_LEVEL di generate-vocab-v2.mjs

  // Segmen PERTAMA yang belum diselesaikan user (1-4). Kalau semua 4 sudah
  // selesai, balik ke segmen 1 (replay) — daripada nge-block user main lagi.
  const nextSegmentFor = (level) => {
    const done = new Set(level.segmentsDone || []);
    for (let s = 1; s <= SEGMENTS_PER_LEVEL; s++) {
      if (!done.has(s)) return s;
    }
    return 1;
  };

  const startLesson = async (bagian, unit, level) => {
    // Simpan posisi scroll PERSIS sebelum pindah halaman — dipulihkan pas
    // user balik lagi ke path (lihat useEffect savedPathScrollRef di atas).
    savedPathScrollRef.current = window.scrollY;
    try {
      if (bagian && bagian.id && currentUser) window.localStorage.setItem(lvLastKey(), JSON.stringify({ bagian: { id: bagian.id, orderIndex: bagian.orderIndex, title: bagian.title, rangeLabel: bagian.rangeLabel, progress: 0 }, ts: Date.now() }));
    } catch (e) { /* storage diblokir */ }

    // practice/review (adaptif) gak punya struktur segmen — biarkan
    // segmentNumber default 1 dari getExercisesForLevel. Lesson/story/
    // conversation (statis) WAJIB tau segmen mana yang mau dimainkan.
    const segmentNumber = (level.type === "practice" || level.type === "review") ? undefined : nextSegmentFor(level);
    let levelWithSegment = segmentNumber ? { ...level, segmentNumber } : level;
    if (!segmentNumber && unit && Array.isArray(unit.levels)) {
      // dipakai practice/review untuk tamu (lihat getExercisesForLevel)
      levelWithSegment = { ...level, siblingLevels: unit.levels.filter((l) => ["lesson", "story", "conversation"].includes(l.type) && l.id !== level.id).map((l) => ({ id: l.id, type: l.type })) };
    }

    setLessonCtx({ bagian, unit, level: levelWithSegment });
    setLessonExercises([]);
    setLessonIndex(0);
    resetExerciseState();
    setLessonScore(0);
    vocabAppearanceCountRef.current = new Map();
    setPage("ammiyahLesson");
    window.scrollTo({ top: 0, behavior: "auto" });
    try {
      const exercises = await AmmiyahDataSource.getExercisesForLevel(levelWithSegment);
      setLessonExercises(exercises);

      // Poin "arti per kata": kumpulin semua vocab_ids yang dipakai soal-soal
      // sesi ini, ambil kata_arab+arti-nya sekaligus (1 request), dipakai
      // buat balon arti pas user klik kata mana pun di layar.
      const allVocabIds = [...new Set(exercises.flatMap((ex) => ex.vocabIds || []))];
      if (allVocabIds.length > 0) {
        try {
          const vocabRows = await apiGet(`/api/content?type=vocab_by_ids&ids=${allVocabIds.join(",")}`);
          const map = new Map();
          for (const v of vocabRows || []) map.set(v.kata_arab, { arti: v.arti, artiEn: v.arti_en, latin: v.latin });
          setWordMeanings(map);
        } catch (e) {
          console.warn("Gagal memuat arti kata:", e.message);
          setWordMeanings(new Map());
        }
      } else {
        setWordMeanings(new Map());
      }
    } catch (err) {
      console.error("Gagal memuat soal:", err);
      alert("Gagal memuat soal: " + err.message);
      setPage("ammiyahPath");
    }
  };

  // [i18n Layer 3] Kalau uiLang="en" dan exercise ini udah punya versi
  // Inggris (contentEn, dari content_en di database), pakai itu -- SEMUA
  // kode render di bawah baca dari ex.content, jadi cukup di-swap DI SINI
  // SATU TEMPAT, gak perlu ubah satu-satu di seluruh renderAmmiyahLesson.
  // Kalau belum ada versi Inggrisnya (belum sempat di-backfill), fallback
  // otomatis ke versi Indonesia -- gak ada bug/blank soal.
  const currentExercise = () => {
    const ex = lessonExercises[lessonIndex];
    if (!ex) return ex;
    if (uiLang === "en" && ex.contentEn) return { ...ex, content: ex.contentEn };
    return ex;
  };

  const goNextExerciseOrFinish = () => {
    if (lessonIndex + 1 < lessonExercises.length) {
      setLessonIndex((i) => i + 1);
      resetExerciseState();
    } else {
      // Kalau ini sesi "Review Semua Kosakata" 1 Bagian (bulatan matahari),
      // majukan progres ring 5 segmennya (maksimal 5).
      if (lessonCtx?.level?.type === "vocabReview" && lessonCtx?.level?.scope === "bagian" && lessonCtx?.bagian) {
        const bagianId = lessonCtx.bagian.id;
        setBagianReviewReps((cur) => ({
          ...cur,
          [bagianId]: Math.min((cur[bagianId] || 0) + 1, REPS_PER_BAGIAN_REVIEW),
        }));
      } else if (lessonCtx?.level?.id && lessonCtx.level.type !== "vocabReview" && currentUser?.id) {
        // Lesson biasa (bukan review) selesai DAN user login — simpan ke
        // Supabase user_progress beneran. Kalau gagal (mis. offline), gak
        // di-throw ke user — biar tetap bisa lanjut ke halaman selesai,
        // cuma progresnya gak kesimpen kali ini.
        apiPost("/api/progress", {
          user_id: currentUser.id,
          level_id: lessonCtx.level.id,
          score: lessonScore,
          segment_number: lessonCtx.level.segmentNumber, // undefined buat practice/review, itu OK
        }).then(() => {
          // Cache units Bagian ini jadi basi (status level berubah) — hapus
          // biar pas balik ke learning path, di-fetch ulang dengan status
          // "done" yang baru, bukan status lama dari cache.
          if (typeof window !== "undefined" && lessonCtx.bagian?.id) {
            try { window.sessionStorage.removeItem(`ls_units_cache_v2_${lessonCtx.bagian.id}_${currentUser.id}`); } catch (e) {}
          }
        }).catch((err) => console.warn("Gagal menyimpan progress:", err.message));
      }
      // Cadangan di browser (selalu, login maupun tidak) — supaya ring tetap terisi
      // walau API/Supabase tidak tersedia, mis. di localhost.
      if (lessonCtx?.level?.id && lessonCtx.level.type !== "vocabReview") {
        saveGuestLevelProgress(lessonCtx.level, lessonScore);
        if (typeof window !== "undefined" && lessonCtx.bagian?.id) {
          try { window.sessionStorage.removeItem(`ls_units_cache_v2_${lessonCtx.bagian.id}_${currentUser?.id || "guest"}`); } catch (e) {}
        }
        // Optimistic update: isi segmen/status bulatan SEKARANG juga di state + salinan SWR,
        // jadi saat balik ke learning path ring langsung penuh (tanpa menunggu fetch ulang).
        {
          const lv = lessonCtx.level;
          const applyDone = (l) => {
            if (l.id !== lv.id) return l;
            const segs = new Set(l.segmentsDone || []);
            let done = l.status === "done";
            if (lv.segmentNumber) {
              segs.add(lv.segmentNumber);
              if (segs.size >= (lv.type === "lesson" ? SEGMENTS_PER_LEVEL : 1)) done = true;
            } else {
              done = true;
            }
            const segmentsDone = [...segs].sort((a, b) => a - b);
            return { ...l, segmentsDone, status: done ? "done" : l.status, reps: done ? 4 : segmentsDone.length };
          };
          const updated = (pathUnits || []).map((u) => ({ ...u, levels: (u.levels || []).map(applyDone) }));
          if (updated.length > 0) {
            setPathUnits(updated);
            try {
              if (lessonCtx.bagian?.id) window.localStorage.setItem(`ls_units_swr_v1_ls_units_cache_v2_${lessonCtx.bagian.id}_${currentUser?.id || "guest"}`, JSON.stringify(updated));
            } catch (e) { /* abaikan */ }
          }
        }
      }
      setPage("ammiyahLessonComplete");
    }
  };

  // Alur: belajar → diuji → salah/benar dicatat → kalau salah, soal itu
  // "diulang" dengan jarak (disisipkan beberapa soal kemudian, bukan
  // langsung) → diuji lagi. Kalau masih salah lagi, jaraknya makin
  // dijauhkan (biar tidak langsung ketebak dari posisi). Ini simulasi
  // spaced-repetition DI DALAM satu sesi; jarak antar-hari lintas sesi
  // (kalau sudah kuat → interval diperpanjang) sudah ditangani terpisah
  // oleh review_queue + calculateNextReview() di api/progress.js.
  const requeueMistake = (ex) => {
    // Poin G: kalau kata ini SUDAH mencapai batas maks kemunculan dalam
    // sesi ini, JANGAN diulang lagi — cukup tampilkan jawaban benar
    // (sudah kejadian di feedback bar) lalu lanjut, jangan dipaksa muncul
    // lagi walau secara teori masih "boleh" berdasar _retryCount saja.
    const anyVocabMaxedOut = (ex.vocabIds || []).some(
      (vid) => (vocabAppearanceCountRef.current.get(vid) || 0) >= MAX_SAME_VOCAB_PER_SESSION
    );
    if (anyVocabMaxedOut) return;

    setLessonExercises((list) => {
      const retryCount = (ex._retryCount || 0) + 1;
      const spacing = 2 + retryCount; // makin sering salah, makin dijauhkan
      const insertAt = Math.min(lessonIndex + spacing, list.length);

      // Coba cari soal LAIN (tipe beda) yang menguji kata yang sama, biar
      // pengulangan gak identik persis soalnya — cuma dipakai kalau ada
      // alternatif nyata di pool soal sesi ini (poin G: "gunakan exercise
      // type berbeda jika memungkinkan"). Kalau gak ada, fallback clone
      // soal yang sama seperti sebelumnya.
      const alternative = list.find(
        (other) =>
          other !== ex &&
          other.type !== ex.type &&
          !other._isRetry &&
          (other.vocabIds || []).some((vid) => (ex.vocabIds || []).includes(vid))
      );

      const base = alternative || ex;
      const clone = { ...base, _retryCount: retryCount, _isRetry: true };
      const newList = [...list];
      newList.splice(insertAt, 0, clone);
      return newList;
    });
  };

  // Ambil teks jawaban benar buat ditampilkan di feedback bar — beda tipe
  // soal nyimpen "jawaban benar" di field yang beda (correctAnswer untuk
  // fill_blank/translate_write/listen_type, correctIndex+options untuk
  // pilihan ganda, correctWords untuk word_order). Ini nyatuin semua jadi
  // 1 teks biar dipakai di 1 tempat render, apa pun tipe soalnya.
  // Deteksi apakah 1 string isinya huruf Arab — dipakai buat nentuin RTL
  // kotak kata word_order SECARA OTOMATIS (bukan diasumsikan selalu Arab),
  // karena wordBank bisa Indonesia (arah "susun terjemahan Indonesia") ATAU
  // Arab (arah baru "susun kalimat Arab") tergantung soalnya.
  const isArabicText = (text) => /[\u0600-\u06FF]/.test(text || "");

  const getCorrectAnswerText = (ex) => {
    if (!ex) return null;
    if (ex.content?.correctAnswer) return ex.content.correctAnswer;
    if (typeof ex.content?.correctIndex === "number" && ex.content?.options) {
      // [FIX] sebelumnya balikin OBJECT opsi ({latin,text}) bukan string --
      // pas digabung ke pesan feedback ("jawaban: " + ini) jadinya nampilin
      // literal "[object Object]". Sekarang ambil .text-nya.
      const opt = ex.content.options[ex.content.correctIndex];
      return typeof opt === "string" ? opt : opt?.text ?? null;
    }
    if (Array.isArray(ex.content?.correctWords)) return ex.content.correctWords.join(" ");
    return null;
  };

  // [BARU] Sebagian kata ganti Indonesia netral-gender ("kalian", "kamu",
  // "dia", "mereka") WAJIB dipilih salah satu bentuk gender di Arab (mis.
  // "kalian" -> -كم (laki-laki/campuran) ATAU -كن (perempuan), dua-duanya
  // sama-sama benar secara terjemahan). "acceptedIndices" (array, opsional)
  // dipakai buat soal yang punya >1 opsi valid kayak gini -- correctIndex
  // tetap ada buat 1 contoh jawaban (dipakai di pesan feedback & soal LAMA
  // yang belum punya acceptedIndices sama sekali).
  const getAcceptedIndices = (ex) => {
    if (!ex?.content) return [];
    if (Array.isArray(ex.content.acceptedIndices) && ex.content.acceptedIndices.length > 0) {
      return ex.content.acceptedIndices;
    }
    if (typeof ex.content.correctIndex === "number") return [ex.content.correctIndex];
    return [];
  };

  // Kamus kata fungsi Levantine yang paling sering muncul di HAMPIR SEMUA
  // kalimat (kata ganti, kata tanya, preposisi, kata sambung, negasi,
  // kata tunjuk, dst) TAPI jarang jadi "kata inti" yang sengaja diuji di
  // soal manapun -- jadi gak akan pernah ke-cover oleh wordMeanings
  // (yang cuma isi vocab_used sesi ini). Statis, gratis, instan, gak
  // perlu network sama sekali. Lapisan pertama sebelum fallback ke
  // /api/word-lookup (lihat handleWordClick).
  const COMMON_WORD_MEANINGS = {
    // Kata ganti
    "أنا": { arti: "saya", en: "I / me", latin: "ana" }, "انت": { arti: "kamu (laki-laki)", en: "you (to a man)", latin: "inta" },
    "إنت": { arti: "kamu (laki-laki)", en: "you (to a man)", latin: "inta" }, "انتي": { arti: "kamu (perempuan)", en: "you (to a woman)", latin: "inti" },
    "إنتي": { arti: "kamu (perempuan)", en: "you (to a woman)", latin: "inti" }, "هو": { arti: "dia (laki-laki)", en: "he", latin: "huwwe" },
    "هي": { arti: "dia (perempuan)", en: "she", latin: "hiyye" }, "احنا": { arti: "kami/kita", en: "we / us", latin: "ihna" },
    "نحنا": { arti: "kami/kita", en: "we / us", latin: "nihna" }, "انتو": { arti: "kalian", en: "you (plural)", latin: "intu" },
    "إنتو": { arti: "kalian", en: "you (plural)", latin: "intu" }, "هني": { arti: "mereka", en: "they", latin: "hinne" }, "هم": { arti: "mereka", en: "they", latin: "hinne" },
    // Kata tanya
    "شو": { arti: "apa", en: "what", latin: "shu" }, "مين": { arti: "siapa", en: "who", latin: "miin" },
    "وين": { arti: "di mana", en: "where", latin: "wein" }, "ليش": { arti: "kenapa", en: "why", latin: "leish" },
    "كيف": { arti: "bagaimana", en: "how", latin: "kiif" }, "إمتى": { arti: "kapan", en: "when", latin: "eimta" },
    "قديش": { arti: "berapa", en: "how much/many", latin: "addeish" }, "أي": { arti: "yang mana", en: "which", latin: "ay" },
    // Kata tunjuk
    "هاد": { arti: "ini (laki-laki)", en: "this (masc.)", latin: "haad" }, "هيدا": { arti: "ini (laki-laki)", en: "this (masc.)", latin: "heida" },
    "هاي": { arti: "ini (perempuan)", en: "this (fem.)", latin: "hayy" }, "هيدي": { arti: "ini (perempuan)", en: "this (fem.)", latin: "heidi" },
    "هدول": { arti: "ini (jamak)", en: "these", latin: "hadool" }, "هداك": { arti: "itu (laki-laki)", en: "that (masc.)", latin: "hadaak" },
    "هديك": { arti: "itu (perempuan)", en: "that (fem.)", latin: "hadiik" },
    // Negasi
    "مش": { arti: "bukan/tidak", en: "not / isn't", latin: "mish" }, "ما": { arti: "tidak", en: "not", latin: "ma" },
    "لا": { arti: "tidak/jangan", en: "no / don't", latin: "la" }, "ولا": { arti: "tidak satupun", en: "not even one / nor", latin: "wala" },
    // Kata sambung & partikel
    "و": { arti: "dan", en: "and", latin: "w" }, "أو": { arti: "atau", en: "or", latin: "aw" },
    "بس": { arti: "tapi/cuma", en: "but / just", latin: "bass" }, "لأن": { arti: "karena", en: "because", latin: "la'ann" },
    "عشان": { arti: "supaya/karena", en: "so that / because", latin: "'ashaan" }, "لو": { arti: "kalau/seandainya", en: "if", latin: "law" },
    "إذا": { arti: "kalau/jika", en: "if", latin: "iza" }, "كمان": { arti: "juga", en: "also", latin: "kamaan" },
    "برضه": { arti: "juga", en: "also / too", latin: "bardo" },
    // Preposisi
    "من": { arti: "dari", en: "from", latin: "min" }, "عن": { arti: "tentang", en: "about", latin: "'an" },
    "على": { arti: "di atas/pada", en: "on", latin: "'ala" }, "تحت": { arti: "di bawah", en: "under", latin: "taht" },
    "فوق": { arti: "di atas", en: "above / up", latin: "fooq" }, "جوا": { arti: "di dalam", en: "inside", latin: "juwwa" },
    "برا": { arti: "di luar", en: "outside", latin: "barra" }, "مع": { arti: "dengan/bersama", en: "with", latin: "ma'" },
    "عند": { arti: "punya/di tempat", en: "at / has", latin: "'ind" }, "قبل": { arti: "sebelum", en: "before", latin: "abl" },
    "بعد": { arti: "setelah/sesudah", en: "after", latin: "ba'd" },
    // Modal & keharusan
    "لازم": { arti: "harus", en: "must / have to", latin: "laazim" }, "بدي": { arti: "saya mau", en: "I want", latin: "biddi" },
    "بدو": { arti: "dia mau (laki-laki)", en: "he wants", latin: "biddu" }, "بدها": { arti: "dia mau (perempuan)", en: "she wants", latin: "bidha" },
    "ممكن": { arti: "mungkin/boleh", en: "maybe / may", latin: "mumkin" }, "في": { arti: "ada/bisa", en: "there is / can", latin: "fi" },
    // Waktu
    "هلق": { arti: "sekarang", en: "now", latin: "halla'" }, "هسع": { arti: "sekarang", en: "now", latin: "hassa'" },
    "هسّع": { arti: "sekarang", en: "now", latin: "hassa'" }, "بكرا": { arti: "besok", en: "tomorrow", latin: "bukra" },
    "مبارح": { arti: "kemarin", en: "yesterday", latin: "mbaareh" }, "دايما": { arti: "selalu", en: "always", latin: "dayman" },
    "اليوم": { arti: "hari ini", en: "today", latin: "ilyoom" }, "الليلة": { arti: "malam ini", en: "tonight", latin: "illeila" },
    // Keterangan & jumlah
    "كتير": { arti: "banyak/sangat", en: "a lot / very", latin: "ktiir" }, "شوي": { arti: "sedikit", en: "a little", latin: "shwayy" },
    "كل": { arti: "setiap/semua", en: "every / all", latin: "kill" }, "بعض": { arti: "sebagian", en: "some", latin: "ba'd" },
    // Sapaan & basa-basi umum
    "مرحبا": { arti: "halo", en: "hello", latin: "marhaba" }, "أهلا": { arti: "halo/selamat datang", en: "welcome / hi", latin: "ahlan" },
    "يلا": { arti: "ayo", en: "come on / let's go", latin: "yalla" }, "خلص": { arti: "selesai/sudah", en: "done / finished", latin: "khalas" },
    "طيب": { arti: "baiklah/oke", en: "okay / alright", latin: "tayyib" }, "شكرا": { arti: "terima kasih", en: "thank you", latin: "shukran" },
    "عفوا": { arti: "sama-sama/maaf", en: "you're welcome / excuse me", latin: "'afwan" }, "آسف": { arti: "maaf", en: "sorry", latin: "aasif" },
    "نعم": { arti: "ya", en: "yes", latin: "na'am" }, "أيوة": { arti: "iya", en: "yeah", latin: "aywa" }, "تمام": { arti: "oke/baik", en: "okay / great", latin: "tamaam" },
  };


  // `e.stopPropagation()` WAJIB — banyak teks ini ada di dalam container
  // yang punya onClick sendiri (pilih jawaban, tap matching pairs, dst),
  // tanpa stopPropagation klik kata bakal ke-anggep klik jawaban juga.
  // Token buat jaga-jaga race condition: kalau user klik kata A (lagi nunggu
  // /api/word-lookup), terus buru-buru klik kata B sebelum A selesai,
  // jangan sampai hasil lookup A yang telat nyasar nimpa balon kata B.
  const wordLookupTokenRef = useRef(0);

  const commonNormRef = useRef(null);
  const handleWordClick = async (e, word) => {
    e.stopPropagation();
    // buang tanda baca; harakat dibuang saat normalisasi
    const cleaned = (word || "").replace(/[^\u0600-\u06FF]/g, "").replace(/[\u060C\u061B\u061F]/g, "").trim();
    if (!cleaned) return;
    const norm = normalizeArabic(cleaned);
    if (!norm) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top;
    const pick = (entry) => (uiLang === "en" && (entry.artiEn || entry.en)) || entry.arti;

    // kamus ternormalisasi (dibangun sekali untuk COMMON, tiap klik untuk kosakata sesi)
    if (!commonNormRef.current) {
      const m = new Map();
      for (const [k, v] of Object.entries(COMMON_WORD_MEANINGS)) { const nk = normalizeArabic(k); if (nk && !m.has(nk)) m.set(nk, { ...v, kata: k }); }
      commonNormRef.current = m;
    }
    const sessionNorm = new Map();
    for (const [k, v] of wordMeanings.entries()) { const nk = normalizeArabic(k); if (nk && !sessionNorm.has(nk)) sessionNorm.set(nk, { ...v, kata: k }); }
    const cache = readWordCache();

    const candidates = arabicCandidates(norm);
    const lookupLocal = () => {
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i];
        const hit = sessionNorm.get(c) || commonNormRef.current.get(c) || cache[`${uiLang}:${c}`];
        if (hit) return { hit, exact: i === 0, base: hit.kata || c };
      }
      return null;
    };
    const show = (arti, latin, note) => setWordBubble({ word: cleaned, arti: note ? `${arti} (≈ ${note})` : arti, latin: latin || null, x, y });

    // Tingkat 1-3 (lokal, instan): kosakata sesi -> kamus kata fungsi -> cache hasil pencarian sebelumnya,
    // semuanya dengan pencocokan toleran (harakat, alif, awalan/akhiran).
    const local = lookupLocal();
    if (local) {
      show(pick(local.hit), local.hit.latin, local.exact ? null : local.base);
      return;
    }

    // Tingkat 4: tanya backend (/api/word-lookup) — kata tanpa harakat dulu, lalu bentuk dasar bila gagal.
    const myToken = ++wordLookupTokenRef.current;
    setWordBubble({ word: cleaned, arti: t("wordMeaningSearching", uiLang), latin: null, x, y, loading: true });
    const tryBackend = async (q) => {
      try {
        const result = await apiGet(`/api/word-lookup?word=${encodeURIComponent(q)}&lang=${uiLang}`);
        return result && result.arti ? result : null;
      } catch (err) { return null; }
    };
    const queries = [norm, ...candidates.slice(1, 3)];
    if (cleaned !== norm) queries.push(cleaned);
    let found = null, usedQuery = null;
    for (const q of queries) {
      found = await tryBackend(q);
      if (wordLookupTokenRef.current !== myToken) return; // user sudah klik kata lain
      if (found) { usedQuery = q; break; }
    }
    if (found) {
      cache[`${uiLang}:${usedQuery === norm ? norm : usedQuery}`] = { arti: found.arti, latin: found.latin || null, kata: usedQuery };
      if (usedQuery !== norm) cache[`${uiLang}:${norm}`] = { arti: found.arti, latin: found.latin || null, kata: usedQuery };
      writeWordCache(cache);
      show(found.arti, found.latin, usedQuery === norm ? null : usedQuery);
    } else {
      setWordBubble({ word: cleaned, arti: t("wordMeaningNotFoundFinal", uiLang), latin: null, x, y });
    }
  };

  // Pecah 1 string Arab jadi span per-kata yang bisa diklik. Dipakai di
  // SEMUA tempat teks Arab ditampilkan ke user (pilihan jawaban, bacaan
  // cerita, dialog, dst) — bukan cuma kosakata inti, biar konsisten.
  const renderClickableArabic = (text, keyPrefix = "w") => {
    if (!text) return text;
    const words = text.split(/(\s+)/); // simpan spasi di array biar layout gak berantakan
    return words.map((chunk, i) => {
      if (/^\s+$/.test(chunk)) return chunk; // spasi apa adanya, gak usah dibungkus span
      return (
        <span
          key={`${keyPrefix}-${i}`}
          onClick={(e) => handleWordClick(e, chunk)}
          style={{ cursor: "pointer", borderBottom: "1px dotted transparent" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderBottomColor = "#bbb"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderBottomColor = "transparent"; }}
        >
          {chunk}
        </span>
      );
    });
  };

  // Cari arti SATU kata Arab tanpa memunculkan balon (dipakai panel "Artinya"): kosakata sesi -> kamus kata fungsi -> cache -> /api/word-lookup.
  const resolveWordMeaning = async (word) => {
    const cleaned = (word || "").replace(/[^\u0600-\u06FF]/g, "").trim();
    const norm = normalizeArabic(cleaned);
    if (!norm) return null;
    const pick = (entry) => (uiLang === "en" && (entry.artiEn || entry.en)) || entry.arti;
    if (!commonNormRef.current) {
      const m = new Map();
      for (const [k, v] of Object.entries(COMMON_WORD_MEANINGS)) { const nk = normalizeArabic(k); if (nk && !m.has(nk)) m.set(nk, { ...v, kata: k }); }
      commonNormRef.current = m;
    }
    const sessionNorm = new Map();
    for (const [k, v] of wordMeanings.entries()) { const nk = normalizeArabic(k); if (nk && !sessionNorm.has(nk)) sessionNorm.set(nk, { ...v, kata: k }); }
    const cache = readWordCache();
    const candidates = arabicCandidates(norm);
    for (const c of candidates) {
      const hit = sessionNorm.get(c) || commonNormRef.current.get(c) || cache[`${uiLang}:${c}`];
      if (hit) return { arti: pick(hit), latin: hit.latin || null };
    }
    for (const q of [norm, ...candidates.slice(1, 3)]) {
      try {
        const r = await apiGet(`/api/word-lookup?word=${encodeURIComponent(q)}&lang=${uiLang}`);
        if (r && r.arti) {
          cache[`${uiLang}:${norm}`] = { arti: r.arti, latin: r.latin || null, kata: q };
          writeWordCache(cache);
          return { arti: r.arti, latin: r.latin || null };
        }
      } catch (err) { /* coba kandidat berikutnya */ }
    }
    return null;
  };

  // Terjemahan kalimat utuh via /api/translate-sentence (di-cache di browser supaya kalimat yang sama tidak diminta ulang).
  const translateSentences = async (texts) => {
    const KEY = "ls_sentence_tr_v1";
    let cache = {};
    try { cache = JSON.parse(window.localStorage.getItem(KEY) || "{}") || {}; } catch (e) { cache = {}; }
    const ck = (s) => `${uiLang}|${s}`;
    const missing = texts.filter((s) => !cache[ck(s)]);
    if (missing.length > 0) {
      const r = await apiPost("/api/translate-sentence", { sentences: missing, lang: uiLang });
      missing.forEach((s, i) => { if (r?.translations?.[i]) cache[ck(s)] = r.translations[i]; });
      try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch (e) { /* penuh/diblokir */ }
    }
    const result = texts.map((s) => cache[ck(s)] || "");
    if (result.some((x) => !x)) throw new Error("terjemahan tidak lengkap");
    return result;
  };

  // Soal yang teks & jawabannya Arab semua: setelah dijawab, tampilkan artinya (arti kalimat dari data bila ada, kalau tidak per kata).
  const MEANING_TYPES = ["fill_blank", "listen_complete", "listen_choose", "dialogue_complete", "read_respond", "reading_comprehension"];
  const meaningLinesFor = (ex) => {
    if (!ex || !MEANING_TYPES.includes(ex.type)) return [];
    const c = ex.content || {};
    const opts = c.options || [];
    const right = opts[c.correctIndex];
    const picked = lessonSelected != null ? opts[lessonSelected] : null;
    const out = [];
    const add = (text, meaning, label) => { if (text && isArabicText(text)) out.push({ text, meaning: meaning || null, label: label || null }); };
    if (ex.type === "fill_blank" || ex.type === "listen_complete") {
      add([c.beforeBlank?.text, right?.text, c.afterBlank?.text].filter(Boolean).join(" ").trim(), c.meaning);
    } else if (ex.type === "listen_choose") {
      add(right?.text, right?.meaning, lx("Jawaban benar", "Correct answer"));
    } else if (ex.type === "dialogue_complete") {
      (c.dialogueLines || []).forEach((l) => add(l.blank ? (right?.text || l.text) : l.text, l.meaning));
    } else {
      add(c.passageText, c.passageMeaning || c.meaning);
      add(c.question, c.questionMeaning);
      add(right?.text, right?.meaning, lx("Jawaban benar", "Correct answer"));
    }
    if (lessonCorrect === false && picked && picked !== right) add(picked.text, picked.meaning, lx("Pilihanmu", "Your choice"));
    return out;
  };

  const selectChoice = (idx) => {
    if (lessonChecked) return;
    const ex = currentExercise();
    const correct = getAcceptedIndices(ex).includes(idx);
    setLessonSelected(idx);
    setLessonChecked(true);
    setLessonCorrect(correct);
    sfx.play(correct ? "correct" : "wrong");
    recordAnswer(ex, correct, ex.content.options?.[idx]?.text ?? String(idx));
    if (correct) setLessonScore((sc) => sc + 1);
    // Diulang lagi cuma kalau ini salah ke-1 atau ke-2 (_retryCount belum
    // sampai 2). Salah yang ke-3, JANGAN diulang lagi — biarkan user lihat
    // jawaban benar (sudah tampil di feedback bar) lalu lanjut ke soal
    // berikutnya, supaya tidak macet stuck di soal yang sama terus.
    else if ((ex._retryCount || 0) < 2) requeueMistake(ex);
  };

  // [BARU] Voice per-kata buat soal susun-kalimat Arab: tiap kali tile
  // kata Arab di-klik (dari bank ATAU yang udah ditaruh), mainkan cara
  // bacanya. Dicache per-sesi (wordAudioCacheRef) biar klik ulang kata yang
  // SAMA dalam 1 sesi gak nembak /api/word-audio lagi -- backend sendiri
  // juga udah cache permanen lintas sesi/user (lihat api/word-audio.js).
  const wordAudioCacheRef = useRef(new Map());
  // Cache objek Audio per URL (preload="auto"): file sudah terunduh SEBELUM tombol ditekan,
  // jadi suara keluar langsung, bukan menunggu unduh dulu tiap kali diputar.
  const audioObjCacheRef = useRef(new Map());
  const getCachedAudio = (url) => {
    let a = audioObjCacheRef.current.get(url);
    if (!a) {
      a = new Audio();
      a.preload = "auto";
      a.src = url;
      audioObjCacheRef.current.set(url, a);
      if (audioObjCacheRef.current.size > 120) {
        const firstKey = audioObjCacheRef.current.keys().next().value;
        audioObjCacheRef.current.delete(firstKey);
      }
    }
    return a;
  };
  // Cari URL audio 1 kata. Permintaan yang sedang berjalan DIGABUNG (inflightWordAudioRef) dan hasilnya
  // disimpan di memori + localStorage, jadi kata yang sama tidak pernah menembak /api/word-audio dua kali.
  const inflightWordAudioRef = useRef(new Map());
  const resolveWordAudioUrl = async (word) => {
    let url = wordAudioCacheRef.current.get(word);
    if (url) return url;
    try {
      const stored = JSON.parse(window.localStorage.getItem("ls_word_audio_v1") || "{}");
      if (stored[word]) { wordAudioCacheRef.current.set(word, stored[word]); return stored[word]; }
    } catch (e) { /* abaikan */ }
    let p = inflightWordAudioRef.current.get(word);
    if (!p) {
      p = apiGet(`/api/word-audio?word=${encodeURIComponent(word)}`)
        .then((r) => r?.audio_url || null)
        .catch(() => null)
        .finally(() => inflightWordAudioRef.current.delete(word));
      inflightWordAudioRef.current.set(word, p);
    }
    url = await p;
    if (url) {
      wordAudioCacheRef.current.set(word, url);
      try {
        const stored = JSON.parse(window.localStorage.getItem("ls_word_audio_v1") || "{}");
        stored[word] = url;
        const keys = Object.keys(stored);
        if (keys.length > 800) delete stored[keys[0]];
        window.localStorage.setItem("ls_word_audio_v1", JSON.stringify(stored));
      } catch (e) { /* storage penuh/diblokir */ }
    }
    return url;
  };
  // Unduh di muka: cari URL + muat file mp3-nya, supaya saat kata diketuk suara langsung keluar.
  const prefetchWordAudio = (words) => {
    for (const w of words || []) {
      if (!isArabicText(w)) continue;
      resolveWordAudioUrl(w).then((u) => { if (u) getCachedAudio(u); });
    }
  };
  const playWordAudio = async (word) => {
    if (!isArabicText(word)) return; // cuma kata Arab yang ada suaranya di sini
    try {
      const url = await resolveWordAudioUrl(word);
      if (url) {
        const a = getCachedAudio(url);
        try { a.currentTime = 0; } catch (e) { /* belum siap, abaikan */ }
        a.play().catch(() => {});
      }
    } catch (err) {
      // Audio per-kata itu bonus, bukan inti soal -- gagal diam-diam aja.
    }
  };

  // eslint-disable-next-line no-unused-vars
  const addWordToAnswer = (word, poolIdx) => {
    if (lessonChecked) return;
    playWordAudio(word);
    setLessonBuiltWords((w) => [...w, { word, poolIdx }]);
  };
  const removeWordFromAnswer = (idx) => {
    if (lessonChecked) return;
    setLessonBuiltWords((w) => w.filter((_, i) => i !== idx));
  };
  // Interaksi kotak yang SUDAH ditaruh di baris jawaban:
  //   - Tap kotak (belum ada yang dipilih)   -> kotak itu jadi "terpilih" (ditandai)
  //   - Tap kotak yang SAMA lagi             -> batal pilih & kotak itu DIHAPUS (balik ke bank)
  //   - Tap kotak LAIN sementara ada yang terpilih -> TUKAR posisi dua kotak itu
  // Jadi urutan kata bisa dibetulkan tanpa hapus-taruh ulang dari nol, mis.
  // [kabarmu][apa] -> tap "kabarmu" (terpilih) -> tap "apa" -> jadi [apa][kabarmu].
  // eslint-disable-next-line no-unused-vars
  const handlePlacedTileClick = (idx) => {
    if (lessonChecked) return;
    playWordAudio(lessonBuiltWords[idx]?.word);
    if (lessonSelectedTileIdx === null) {
      setLessonSelectedTileIdx(idx);
    } else if (lessonSelectedTileIdx === idx) {
      removeWordFromAnswer(idx);
      setLessonSelectedTileIdx(null);
    } else {
      setLessonBuiltWords((w) => {
        const copy = [...w];
        [copy[lessonSelectedTileIdx], copy[idx]] = [copy[idx], copy[lessonSelectedTileIdx]];
        return copy;
      });
      setLessonSelectedTileIdx(null);
    }
  };

  const checkBuiltAnswer = () => {
    const ex = currentExercise();
    const built = lessonBuiltWords.map((w) => w.word);
    // [FIX] Sebelumnya cuma nerima 1 urutan persis (ex.content.correctWords)
    // -- padahal buat terjemahan, sering ada >1 urutan kata yang SAMA-SAMA
    // benar secara alami (mis. "apa warna ini" vs "warna apa ini"). Sekarang
    // terima urutan MANA PUN yang ada di acceptedOrders (kalau soalnya
    // sudah punya field itu); soal LAMA yang belum punya acceptedOrders
    // tetap jalan seperti biasa (fallback ke correctWords doang).
    const candidates = Array.isArray(ex.content.acceptedOrders) && ex.content.acceptedOrders.length > 0
      ? ex.content.acceptedOrders
      : [ex.content.correctWords];
    const builtJson = JSON.stringify(built);
    const correct = candidates.some((c) => JSON.stringify(c) === builtJson);
    setLessonChecked(true);
    setLessonCorrect(correct);
    sfx.play(correct ? "correct" : "wrong");
    recordAnswer(ex, correct, built.join(" "));
    if (correct) setLessonScore((sc) => sc + 1);
    else if ((ex._retryCount || 0) < 2) requeueMistake(ex);
  };

  const checkTextAnswer = () => {
    const ex = currentExercise();
    const userAnswer = lessonTextAnswer.trim();
    const correctAnswer = ex.content.correctAnswer.trim();
    // Bandingkan tanpa harakat/tatwil/tanda baca/spasi ganda & alef disamakan; terima juga
    // jawaban alternatif (acceptedAnswers) yang sama-sama benar.
    const normAr = (t) => String(t || "")
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      .replace(/[\u0622\u0623\u0625]/g, "\u0627")
      .replace(/[.,!?;:\u061F\u060C\u061B"'()-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const accepted = [correctAnswer, ...(Array.isArray(ex.content.acceptedAnswers) ? ex.content.acceptedAnswers : [])];
    const correct = userAnswer === correctAnswer || accepted.some((a) => normAr(a) !== "" && normAr(a) === normAr(userAnswer));
    setLessonChecked(true);
    setLessonCorrect(correct);
    sfx.play(correct ? "correct" : "wrong");
    const severity = correct ? undefined : classifyTextErrorSeverity(userAnswer, correctAnswer);
    recordAnswer(ex, correct, userAnswer, severity);
    if (correct) setLessonScore((sc) => sc + 1);
    else if ((ex._retryCount || 0) < 2) requeueMistake(ex);
  };

  // Matching pairs: tap satu kartu kiri, lalu satu kartu kanan. Cocok kalau
  // id pasangannya sama; kalau tidak, pilihan kanan dibatalkan lagi.
  const [lessonMatchFlash, setLessonMatchFlash] = useState(null); // { left, right } — salah pasang, tampil sebentar
  const tryMatch = (leftId, rightId) => {
    if (leftId === rightId) {
      setLessonMatched((m) => (m.includes(leftId) ? m : [...m, leftId]));
      setLessonMatchSel({ left: null, right: null });
      sfx.play("correct");
    } else {
      setLessonMatchSel({ left: null, right: null });
      setLessonMatchFlash({ left: leftId, right: rightId });
      sfx.play("wrong");
      setTimeout(() => setLessonMatchFlash(null), 420);
    }
  };
  const tapMatchLeft = (id) => {
    if (lessonMatched.includes(id) || lessonMatchFlash) return;
    sfx.play("tap");
    if (lessonMatchSel.right) return tryMatch(id, lessonMatchSel.right);
    setLessonMatchSel((sel) => ({ ...sel, left: sel.left === id ? null : id }));
  };
  const tapMatchRight = (id) => {
    if (lessonMatched.includes(id) || lessonMatchFlash) return;
    sfx.play("tap");
    if (lessonMatchSel.left) return tryMatch(lessonMatchSel.left, id);
    setLessonMatchSel((sel) => ({ ...sel, right: sel.right === id ? null : id }));
  };

  const isMainButtonEnabled = () => {
    const ex = currentExercise();
    if (!ex) return false;
    if (ex.type === "vocab_intro") return true;
    if (ex.type === "matching_pairs") return lessonMatched.length === ex.content.pairs.length;
    if (lessonChecked) return true;
    if (CHOICE_TYPES.includes(ex.type)) return lessonSelected !== null;
    if (ex.type === "word_order") return lessonBuiltWords.length >= 1;
    if (ex.type === "translate_write" || ex.type === "listen_type") return lessonTextAnswer.trim().length > 0;
    return false;
  };

  const handleMainButton = () => {
    const ex = currentExercise();
    if (ex.type === "vocab_intro") {
      // Kartu perkenalan kata: tidak dinilai & tidak dicatat sebagai jawaban -- langsung lanjut.
      sfx.play("tap");
      goNextExerciseOrFinish();
      return;
    }
    if (ex.type === "matching_pairs") {
      if (lessonMatched.length === ex.content.pairs.length) {
        // Matching pairs gak nge-track salah per-kata di tengah jalan (tap
        // salah cuma reset pilihan, gak dihitung salah) — begitu semua
        // pasang cocok, seluruh vocab_ids di exercise ini dilaporkan benar.
        recordAnswer(ex, true);
        setLessonScore((sc) => sc + 1);
        goNextExerciseOrFinish();
      }
      return;
    }
    if (!lessonChecked) {
      if (ex.type === "word_order") checkBuiltAnswer();
      else if (ex.type === "translate_write" || ex.type === "listen_type") checkTextAnswer();
      return;
    }
    goNextExerciseOrFinish();
  };

  // Putar audio_url exercise yang lagi aktif. `new Audio(...).play()` cuma
  // bisa jalan sebagai respons langsung ke klik user (kebijakan browser
  // modern nolak autoplay tanpa interaksi) — makanya ini dipanggil dari
  // onClick tombol 🔊, BUKAN otomatis pas soal muncul.
  const [audioPlaying, setAudioPlaying] = useState(false); // animasi ikon speaker saat audio berbunyi
  const playExerciseAudio = (url) => {
    if (!url) return;
    const audio = getCachedAudio(url);
    // Hentikan audio lain yang masih berbunyi supaya tidak bertumpuk.
    audioObjCacheRef.current.forEach((a) => { if (a !== audio && !a.paused) a.pause(); });
    audio.onplaying = () => setAudioPlaying(true);
    audio.onended = () => setAudioPlaying(false);
    audio.onpause = () => setAudioPlaying(false);
    audio.onerror = () => setAudioPlaying(false);
    try { audio.currentTime = 0; } catch (e) { /* belum siap, abaikan */ }
    audio.play().catch((err) => {
      setAudioPlaying(false);
      // Browser kadang nolak play() kalau ada masalah lain (format gak
      // didukung, URL 404, dst) — gak perlu crash, cukup dicatat.
      console.warn("Gagal memutar audio:", err.message);
    });
  };

  // Unduh di muka audio soal yang sedang tampil + 3 soal berikutnya.
  useEffect(() => {
    for (let i = lessonIndex; i < Math.min((lessonExercises || []).length, lessonIndex + 4); i++) {
      const u = lessonExercises[i]?.audioUrl;
      if (u) getCachedAudio(u);
      for (const w of lessonExercises[i]?.content?.words || []) if (w?.audio_url) getCachedAudio(w.audio_url);
      // Susun kata: siapkan audio tiap kata di bank (soal ini + 2 berikutnya).
      if (i < lessonIndex + 3 && lessonExercises[i]?.type === "word_order") prefetchWordAudio(lessonExercises[i].content?.wordBank);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonIndex, lessonExercises]);

  const renderAmmiyahLesson = () => {
    const ex = currentExercise();
    if (!ex) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <PlanetMascot size={70} />
          <div style={{ color: "#888", fontSize: 14 }}>{t("preparingExercises", uiLang)}</div>
        </div>
      );
    }
    const progressPct = (lessonIndex / lessonExercises.length) * 100;
    const isChoice = CHOICE_TYPES.includes(ex.type);
    const isCheckStyleType = ex.type === "word_order" || ex.type === "translate_write" || ex.type === "listen_type";

    return (
      <>
      <div style={s.lessonPage}>
        <div style={s.lessonTop}>
          <button style={s.lessonClose} onClick={() => setShowExitConfirm(true)}>✕</button>
          <div style={s.lessonProgressTrack}>
            <div style={{ ...s.lessonProgressFill, width: `${progressPct}%` }} />
          </div>
          <SoundToggle lang={uiLang} />
        </div>

        {lessonCtx && (
          <div style={{ maxWidth: 560, margin: "10px auto 0", padding: "0 20px", display: "flex", alignItems: "center", gap: 8, color: "#888", fontSize: 12.5, fontWeight: "bold" }}>
            <span>{renderNodeIcon(lessonCtx.level.type)}</span>
            <span>{NODE_META[lessonCtx.level.type]?.label}</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{trTopic(lessonCtx.unit.topicName, uiLang)}</span>
          </div>
        )}

        <div style={s.lessonBody} className="ls-enter" key={`lb-${lessonIndex}-${ex.id || ""}-${ex._retryCount || 0}`}>
          <div style={s.lessonQuestion}>{t(ex.prompt, uiLang)}</div>

          {ex.type === "fill_blank" && (
            <div style={s.lessonPromptRow}>
              <div style={s.lessonAvatarWrap}><PlanetMascot /></div>
              <div style={s.lessonBubble}>
                {(ex.content.beforeBlank?.latin || ex.content.afterBlank?.latin) && (
                  <div style={s.lessonBubbleLatin}>
                    {ex.content.beforeBlank?.latin} ___ {ex.content.afterBlank?.latin}
                  </div>
                )}
                {/* dir="rtl" WAJIB — rumpang harus muncul di POSISI yang benar
                    relatif ke teks Arab (bisa di awal/tengah/akhir kalimat),
                    bukan cuma nempel di ujung seperti struktur lama. */}
                <div style={s.lessonBubbleMain} dir="rtl">
                  {ex.content.beforeBlank?.text && renderClickableArabic(ex.content.beforeBlank.text, "before")}
                  <span style={s.lessonBlank} />
                  {ex.content.afterBlank?.text && renderClickableArabic(ex.content.afterBlank.text, "after")}
                </div>
                {ex.content.hasAudio && ex.audioUrl && lessonChecked && (
                  <div style={{ marginTop: 8 }}>
                    <button className={audioPlaying ? "ls-speaker-on" : undefined} style={s.lessonAudioBtn} onClick={() => playExerciseAudio(ex.audioUrl)} aria-label="Play">🔊</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {ex.type === "translate_choice" && (
            <div style={s.lessonPromptRow}>
              <div style={s.lessonAvatarWrap}><PlanetMascot /></div>
              <div style={s.lessonBubble}>
                {/* [FIX] promptText itu kata Indonesia/Inggris (LTR), BUKAN
                    Arab -- dir="rtl" yang sebelumnya di sini itu KESALAHAN
                    (ke-copy dari fix RTL di tempat lain tanpa ngecek dulu
                    bahasa field ini). Efeknya gak kelihatan waktu promptText
                    cuma 1 kata Indonesia ("kucing" tetap "kucing" mau
                    dibaca arah mana pun), tapi begitu jadi frasa 2+ kata
                    Inggris (content_en, mis. "I have"), urutannya kebalik
                    jadi "have I". dir="ltr" di sini SELALU benar, baik mode
                    Indonesia maupun Inggris -- promptText gak pernah Arab. */}
                <div style={s.lessonBubbleMain} dir="ltr">{renderClickableArabic(ex.content.promptText, "prompt")}</div>
              </div>
            </div>
          )}

          {ex.type === "word_order" && (
            <div style={s.lessonPromptRow}>
              <div style={s.lessonAvatarWrap}><PlanetMascot /></div>
              <div style={s.lessonBubble}>
                {ex.content.audioOnly ? (
                  // Mode SUARA (level Intermediate): kalimat TIDAK ditampilkan, user hanya mendengarnya.
                  <div style={{ ...s.lessonBubbleMain, flexDirection: "column", alignItems: "center", gap: 8, padding: "6px 4px" }}>
                    <button className={audioPlaying ? "ls-speaker-on" : undefined} style={{ ...s.lessonAudioBtn, width: 58, height: 58, fontSize: 24 }} onClick={() => playExerciseAudio(ex.audioUrl)} aria-label="Play">🔊</button>
                    <div style={{ fontSize: 13, color: "#6b7772" }}>{lx("Ketuk untuk mendengarkan lagi", "Tap to listen again")}</div>
                  </div>
                ) : (
                <div style={s.lessonBubbleMain}>
                  {ex.content.hasAudio && <button className={audioPlaying ? "ls-speaker-on" : undefined} style={s.lessonAudioBtn} onClick={() => (ex.audioUrl ? playExerciseAudio(ex.audioUrl) : playWordAudio(ex.content.audioText || ex.content.text))}>🔊</button>}
                  <div>
                    {ex.content.latin && <div style={s.lessonBubbleLatin}>{ex.content.latin}</div>}
                    {/* Referensi bisa Arab (arah "susun terjemahan Indonesia")
                        ATAU Indonesia (arah baru "susun kalimat Arab") — cuma
                        yang Arab yang perlu renderClickableArabic (buat arti
                        per-kata) & dir="rtl". */}
                    <div dir={isArabicText(ex.content.text) ? "rtl" : "ltr"}>
                      {isArabicText(ex.content.text) ? renderClickableArabic(ex.content.text, "wo-text") : ex.content.text}
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
          )}

          {ex.type === "translate_write" && (
            <div style={s.lessonPromptRow}>
              <div style={s.lessonAvatarWrap}><PlanetMascot /></div>
              <div style={s.lessonBubble}>
                <div style={s.lessonBubbleMain}>{ex.content.text}</div>
              </div>
            </div>
          )}

          {ex.type === "listen_choose" && (
            <div style={{ ...s.lessonPromptRow, justifyContent: "center" }}>
              <button className={audioPlaying ? "ls-speaker-on" : undefined} style={{ ...s.lessonAudioBtn, width: 54, height: 54, fontSize: 22 }} onClick={() => playExerciseAudio(ex.audioUrl)}>🔊</button>
            </div>
          )}

          {ex.type === "listen_complete" && (
            <div style={s.lessonPromptRow}>
              <button className={audioPlaying ? "ls-speaker-on" : undefined} style={s.lessonAudioBtn} onClick={() => playExerciseAudio(ex.audioUrl)}>🔊</button>
              <div style={s.lessonBubble}>
                {(ex.content.beforeBlank?.latin || ex.content.afterBlank?.latin) && (
                  <div style={s.lessonBubbleLatin}>
                    {ex.content.beforeBlank?.latin} ___ {ex.content.afterBlank?.latin}
                  </div>
                )}
                <div style={s.lessonBubbleMain} dir="rtl">
                  {ex.content.beforeBlank?.text && renderClickableArabic(ex.content.beforeBlank.text, "lc-before")}
                  <span style={s.lessonBlank} />
                  {ex.content.afterBlank?.text && renderClickableArabic(ex.content.afterBlank.text, "lc-after")}
                </div>
              </div>
            </div>
          )}

          {ex.type === "dialogue_complete" && (
            <div>
              {/* Audio berisi percakapan LENGKAP (jawaban benar ikut terdengar), jadi baru muncul setelah user menjawab. */}
              {ex.content.hasAudio && ex.audioUrl && lessonChecked && (
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <button className={audioPlaying ? "ls-speaker-on" : undefined} style={s.lessonAudioBtn} onClick={() => playExerciseAudio(ex.audioUrl)}>🔊</button>
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 30 }}>
                {(() => {
                  const lines = ex.content.dialogueLines || [];
                  // Baris yang dikosongkan: yang ditandai blank:true. Soal lama yang lupa menandai -> cari baris
                  // yang teksnya sama dengan jawaban benar, supaya kelihatan bagian mana yang harus dilengkapi.
                  let blankIdx = lines.findIndex((l) => l.blank);
                  if (blankIdx < 0) {
                    const right = ex.content.options?.[ex.content.correctIndex]?.text;
                    if (right) blankIdx = lines.findIndex((l) => normalizeArabic(l.text) === normalizeArabic(right));
                  }
                  return lines.map((line, i) => {
                    const isBlank = i === blankIdx;
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 14, flexDirection: line.speaker === "B" ? "row-reverse" : "row" }}>
                        <div style={s.lessonAvatarWrap}><ConversationMascot index={i} size={54} /></div>
                        <div style={{ ...s.lessonBubble, ...(isBlank ? { border: "1.5px dashed #9fc3b3", background: "#f7fbf9" } : null) }}>
                          {isBlank ? (
                            <div style={{ ...s.lessonBubbleMain, minWidth: 120, minHeight: 34, justifyContent: "center", color: "#7a8a84", fontSize: 14 }} dir="ltr">
                              <span style={s.lessonBlank} />
                              <span>{lx("bagian yang harus dilengkapi", "the part to complete")}</span>
                            </div>
                          ) : (
                            <>
                              {line.latin && <div style={s.lessonBubbleLatin}>{line.latin}</div>}
                              <div style={s.lessonBubbleMain} dir="rtl">{renderClickableArabic(line.text, `ln-${i}`)}</div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {(ex.type === "read_respond" || ex.type === "reading_comprehension") && (
            <div style={s.readingPassage}>
              {ex.content.hasAudio && ex.audioUrl && (
                <div style={{ textAlign: "center", marginBottom: 10 }}>
                  <button className={audioPlaying ? "ls-speaker-on" : undefined} style={s.lessonAudioBtn} onClick={() => playExerciseAudio(ex.audioUrl)}>🔊</button>
                </div>
              )}
              <div style={s.lessonBubbleLatin}>{ex.content.passageLatin}</div>
              <div style={s.readingPassageText} dir="rtl">{renderClickableArabic(ex.content.passageText, "passage")}</div>
              <div style={s.readingQuestion}>{ex.content.question}</div>
            </div>
          )}

          {ex.type === "vocab_intro" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
              {(ex.content.words || []).map((w, wi) => (
                <div key={`${w.kata_arab}-${wi}`} className="ls-card" style={{ display: "flex", alignItems: "center", gap: 14, background: "white", border: "1.5px solid #e3e9e6", borderRadius: 16, padding: "14px 16px" }}>
                  <button
                    className={audioPlaying ? "ls-speaker-on" : undefined}
                    style={s.lessonAudioBtn}
                    aria-label="Play"
                    onClick={() => (w.audio_url ? playExerciseAudio(w.audio_url) : playWordAudio(w.kata_arab))}
                  >🔊</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div dir="rtl" style={{ fontSize: 26, color: "#1a1a1a", lineHeight: 1.3, textAlign: "left" }}>{w.kata_arab}</div>
                    {w.latin && <div style={{ fontFamily: "inherit", fontSize: isMobile ? 14.5 : 13.5, color: "#6b7772", marginTop: 2 }}>{w.latin}</div>}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: GREEN_DARK, textAlign: "right", maxWidth: "42%" }}>
                    {uiLang === "en" && w.arti_en ? w.arti_en : w.arti}
                  </div>
                </div>
              ))}
            </div>
          )}

          {ex.type === "matching_pairs" && (
            <div style={s.matchGrid}>
              <div style={s.matchCol}>
                {ex.content.pairs.map((p) => (
                  <button
                    key={p.id}
                    disabled={lessonMatched.includes(p.id)}
                    onClick={() => tapMatchLeft(p.id)}
                    className={fxCardClass(lessonMatched.includes(p.id) ? "ok" : lessonMatchFlash?.left === p.id ? "bad" : lessonMatchSel.left === p.id ? "picked" : "idle", lessonMatched.includes(p.id))}
                    style={{
                      ...s.matchCard,
                      ...(lessonMatched.includes(p.id) ? s.matchCardDone : {}),
                      ...(lessonMatchSel.left === p.id ? s.matchCardSelected : {}),
                    }}
                  >
                    <div style={s.lessonOptionLatin}>{p.leftLatin}</div>
                    <div dir="rtl">{p.left}</div>
                  </button>
                ))}
              </div>
              <div style={s.matchCol}>
                {ex.content.rightOrder.map((id) => {
                  const p = ex.content.pairs.find((pp) => pp.id === id);
                  return (
                    <button
                      key={id}
                      disabled={lessonMatched.includes(id)}
                      onClick={() => tapMatchRight(id)}
                      className={fxCardClass(lessonMatched.includes(id) ? "ok" : lessonMatchFlash?.right === id ? "bad" : lessonMatchSel.right === id ? "picked" : "idle", lessonMatched.includes(id))}
                      style={{
                        ...s.matchCard,
                        ...(lessonMatched.includes(id) ? s.matchCardDone : {}),
                        ...(lessonMatchSel.right === id ? s.matchCardSelected : {}),
                      }}
                    >
                      {p.right}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isChoice && (
            <div>
              {ex.content.options.map((opt, i) => {
                let optStyle = s.lessonOption;
                let fxState = "idle";
                if (lessonChecked) {
                  if (getAcceptedIndices(ex).includes(i)) { optStyle = { ...s.lessonOption, ...s.lessonOptionCorrect }; fxState = i === lessonSelected ? "ok" : "reveal"; }
                  else if (i === lessonSelected) { optStyle = { ...s.lessonOption, ...s.lessonOptionWrong }; fxState = "bad"; }
                } else if (i === lessonSelected) {
                  optStyle = { ...s.lessonOption, ...s.lessonOptionSelected };
                  fxState = "picked";
                }
                return (
                  <div key={i} role="button" tabIndex={lessonChecked ? -1 : 0} aria-pressed={i === lessonSelected} className={fxCardClass(fxState, lessonChecked)} style={optStyle}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectChoice(i); } }}
                    onClick={() => { if (!lessonChecked) sfx.play("tap"); selectChoice(i); }}>
                    {opt.latin && <div style={s.lessonOptionLatin}>{opt.latin}</div>}
                    <div style={s.lessonOptionText}>{renderClickableArabic(opt.text, `opt-${i}`)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {ex.type === "word_order" && (() => {
            // Cek dari isi wordBank itu sendiri — bukan asumsi, biar aman
            // buat 2 arah soal (susun Indonesia ATAU susun Arab) dan buat
            // konten lama yang mungkin belum punya field "direction".
            const rtl = ex.content.wordBank?.length > 0 && isArabicText(ex.content.wordBank[0]);
            return (
              <WordOrderBoard
                key={`wo-${lessonIndex}-${ex.id || ""}`}
                words={ex.content.wordBank || []}
                rtl={rtl}
                disabled={lessonChecked}
                onChange={setLessonBuiltWords}
                onTapWord={playWordAudio}
                lx={lx}
              />
            );
          })()}

          {ex.type === "translate_write" && (
            <input
              className={lessonChecked ? fxCardClass(lessonCorrect ? "ok" : "bad", true) : undefined}
              style={s.lessonTextInput}
              placeholder="Tulis jawabanmu di sini..."
              value={lessonTextAnswer}
              onChange={(e) => setLessonTextAnswer(e.target.value)}
              disabled={lessonChecked}
            />
          )}

          {lessonChecked && (() => {
            const lines = meaningLinesFor(ex);
            return lines.length > 0 ? <MeaningPanel key={`mp-${lessonIndex}-${ex.id || ""}-${ex._retryCount || 0}`} lines={lines} translate={translateSentences} resolve={resolveWordMeaning} lx={lx} /> : null;
          })()}
        </div>

        <div style={{ ...s.lessonBottomBar, background: lessonChecked ? (lessonCorrect ? "#eaf7d9" : "#fdeceb") : "white" }}>
          <div style={s.lessonBottomInner}>
            {lessonChecked && (
              <div className={`ls-feedback ${lessonCorrect ? "ls-feedback-ok" : "ls-feedback-bad"}`} role="status" aria-live="polite" style={{ ...s.lessonFeedback, color: lessonCorrect ? "#58A700" : "#E0555A" }}>
                <span className="ls-feedback-icon" aria-hidden="true">{lessonCorrect ? "✓" : "✕"}</span>
                {lessonCorrect
                  ? t("feedbackCorrect", uiLang)
                  : `${t("feedbackIncorrect", uiLang)}${getCorrectAnswerText(ex) ? `${t("feedbackAnswerPrefix", uiLang)}${getCorrectAnswerText(ex)}` : ""}`}
              </div>
            )}
            <button
              style={{
                ...s.lessonMainBtn,
                ...(isMainButtonEnabled() ? (lessonChecked ? (lessonCorrect ? s.lessonBtnActive : s.lessonBtnWrong) : s.lessonBtnActive) : s.lessonBtnDisabled),
              }}
              disabled={!isMainButtonEnabled()}
              onClick={handleMainButton}
            >
              {lessonChecked ? t("btnContinue", uiLang) : (isCheckStyleType ? t("btnCheck", uiLang) : t("btnContinue", uiLang))}
            </button>
          </div>
        </div>
      </div>

      {wordBubble && (
        <>
          {/* Overlay transparan — klik di luar balon buat nutup */}
          <div style={{ position: "fixed", inset: 0, zIndex: 998 }} onClick={() => setWordBubble(null)} />
          <div
            style={{
              position: "fixed",
              left: Math.min(Math.max(wordBubble.x, 90), window.innerWidth - 90),
              top: Math.max(wordBubble.y - 12, 60),
              transform: "translate(-50%, -100%)",
              background: "#3C3C3C",
              color: "white",
              padding: "10px 14px",
              borderRadius: 10,
              fontSize: 14,
              maxWidth: 220,
              textAlign: "center",
              zIndex: 999,
              boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: 2 }}>{wordBubble.word}</div>
            {wordBubble.latin && <div style={{ fontFamily: "inherit", fontSize: isMobile ? 13 : 12, opacity: 0.8, marginBottom: 2 }}>{wordBubble.latin}</div>}
            <div style={wordBubble.loading ? { fontStyle: "italic", opacity: 0.7 } : undefined}>
              {wordBubble.arti || t("wordMeaningNotFound", uiLang)}
            </div>
            <div
              style={{
                position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
                width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
                borderTop: "6px solid #3C3C3C",
              }}
            />
          </div>
        </>
      )}
    </>
    );
  };

  const renderAmmiyahLessonComplete = () => {
    const totalQ = lessonExercises.filter((e) => e.type !== "vocab_intro").length || 0; // kartu perkenalan tidak dinilai
    const acc = totalQ ? Math.min(100, Math.round((lessonScore / totalQ) * 100)) : 0;
    const msg = acc >= 90 ? lx("Hasil yang luar biasa. Pertahankan!", "Excellent work. Keep it up!")
      : acc >= 70 ? lx("Bagus! Sedikit lagi sempurna.", "Nice! Almost perfect.")
      : lx("Tidak apa-apa, ulangi lagi supaya makin lancar.", "No worries, practise again to get smoother.");
    const stat = (label, value, bg) => (
      <div style={{ flex: 1, background: bg || "#f4f8f6", borderRadius: 14, padding: "12px 6px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1a2421" }}>{value}</div>
        <div style={{ fontSize: 11, color: "#7a8782", marginTop: 2 }}>{label}</div>
      </div>
    );
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" }}>
        <div style={{ background: "white", border: "1px solid #e8eeeb", borderRadius: 22, width: "100%", maxWidth: 400, boxSizing: "border-box", textAlign: "center", padding: "30px 24px 26px", boxShadow: "0 1px 2px rgba(20,40,30,0.04), 0 12px 32px rgba(20,40,30,0.06)" }}>
          <Ring value={acc} C={{ GREEN_DARK }} />
          <div style={{ marginTop: 10 }}><Celebrate acc={acc} /></div>
          <div className="ls-enter" style={{ fontSize: 22, fontWeight: 800, color: "#1a2421", marginTop: 8 }}>{lx("Lesson selesai", "Lesson complete")}</div>
          <div style={{ fontSize: 13.5, color: "#6a7772", lineHeight: 1.6, margin: "6px auto 20px", maxWidth: 290 }}>{msg}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {stat(lx("Skor", "Score"), <><CountUp to={lessonScore} />/{totalQ}</>)}
            {stat(lx("Akurasi", "Accuracy"), `${acc}%`, "#e8f1ed")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {currentUser && (
              <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive, opacity: lvContinueBusy ? 0.7 : 1 }} disabled={lvContinueBusy} onClick={continueAfterLesson}>
                {lvContinueBusy ? lx("MEMUAT...", "LOADING...") : lx("LANJUTKAN PELAJARAN", "CONTINUE LESSON")}
              </button>
            )}
            <button
              style={{ ...s.lessonMainBtn, ...(currentUser ? { background: "#eef2f0", color: "#4a5753", boxShadow: "none" } : s.lessonBtnActive) }}
              onClick={() => setPage("ammiyahPath")}
            >
              {lx("KEMBALI KE PATH", "BACK TO PATH")}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCourse = () => {
    const lessonIdx = activeCourse.lessons.findIndex((l) => l.id === activeLesson.id);
    return (
      <div style={s.courseLayout}>
        {sidebarOpen && <div style={s.overlay} onClick={() => setSidebarOpen(false)} />}

        <div style={s.sidebar} aria-hidden={!sidebarOpen}>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-start", gap: 10, padding: "16px 12px 12px 16px", borderBottom: "1px solid #eef2f0" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", color: "#8a9692", marginBottom: 4 }}>
                {lx("Daftar materi", "Lessons")} · {activeCourse.lessons.length}
              </div>
              <div style={s.sidebarTitle}>{activeCourse.title}</div>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} aria-label={lx("Tutup", "Close")}
              style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 12, border: "none", background: "#f1f5f3", color: "#52605b", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>
          <div style={s.sidebarList} className="sb-scroll">
            {activeCourse.lessons.map((lesson, idx) => {
              const isActive = activeLesson?.id === lesson.id;
              return (
                <div
                  key={lesson.id}
                  id={isActive ? "sb-active" : undefined}
                  role="button" tabIndex={0}
                  className="sb-item"
                  style={{ ...s.lessonItem, ...(isActive ? s.lessonItemActive : {}) }}
                  onClick={() => { setActiveLesson(lesson); setSidebarOpen(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveLesson(lesson); setSidebarOpen(false); } }}
                >
                  <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12.5, fontWeight: 800, background: isActive ? GREEN_DARK : "#eef3f0", color: isActive ? "white" : "#6b7a75" }}>
                    {lesson.type === "video" ? <Icon name="play" size={14} /> : idx + 1}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>{lesson.title}</span>
                </div>
              );
            })}
          </div>
          <div style={s.sidebarFooter}>
            <button className="ls-press" style={{ width: "100%", boxSizing: "border-box", background: "#f1f5f3", color: "#3b4743", border: "none", borderRadius: 12, padding: "12px 16px", fontSize: 14, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}
              onClick={() => { setPage("explore"); setSidebarOpen(false); }}>
              ← {lx("Kembali ke Explore", "Back to Explore")}
            </button>
          </div>
        </div>

        <button style={s.toggleBtn} onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={lx("Daftar materi", "Lessons")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10" /></svg>
          {lx("Materi", "Lessons")}
        </button>

        <div className="mainContent" ref={mainContentRef} style={isMobile ? { padding: "64px 18px 48px", boxSizing: "border-box" } : undefined}>
          {activeLesson && (
            <>
              <div className="contentTitle">{activeCourse.title.split(" ")[0]} {activeCourse.title.split(" ").slice(1).join(" ")}</div>
              {arabicOf(activeLesson, activeLesson.title) && (
                <div dir="rtl" lang="ar" style={{ fontFamily: "'Amiri','Noto Naskh Arabic','Traditional Arabic',serif", fontSize: "clamp(22px, 5vw, 30px)", lineHeight: 1.7, color: GREEN_DARK, textAlign: "right", margin: "10px 0 6px" }}>
                  {arabicOf(activeLesson, activeLesson.title)}
                </div>
              )}

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

  const renderContact = () => {
    const field = { width: "100%", boxSizing: "border-box", padding: "13px 14px 13px 42px", border: "1px solid #e3e9e6", borderRadius: 12, fontSize: 14, fontFamily: "inherit", outline: "none", background: "#fbfcfb", color: "#1a1a1a" };
    return (
    <div style={{ background: "#fafbfa" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 20px 56px" }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: GREEN_BG, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <Icon name="mail" size={26} color={GREEN_DARK} />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#1a1a1a", letterSpacing: "-0.3px", marginBottom: 8 }}>Get in touch with us</div>
          <div style={{ fontSize: 14, color: "#6b7772", lineHeight: 1.65 }}>
            {lx(
              "Punya pertanyaan, saran, atau ide? Kirim pesan dan kami akan membalas dalam beberapa hari kerja.",
              "Have a question, suggestion, or idea? Send us a message and we'll reply within a few business days."
            )}
          </div>
        </div>

        <div style={{ background: "white", border: "1px solid #e8eeeb", borderRadius: 18, padding: 22, boxShadow: "0 2px 12px rgba(30,60,50,0.06)" }}>
          {contactSuccess ? (
            <div style={{ textAlign: "center", padding: "18px 6px 8px" }}>
              <div style={{ width: 52, height: 52, borderRadius: 999, background: "#E6F4EC", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Icon name="check" size={26} color="#2e8b57" stroke={2.4} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>{lx("Pesan terkirim", "Message sent")}</div>
              <div style={{ fontSize: 14, color: "#6b7772", marginBottom: 20, lineHeight: 1.6 }}>{lx("Terima kasih, kami akan segera membalas pesanmu.", "Thank you, we'll get back to you soon.")}</div>
              <button style={{ background: "#f1f5f3", color: "#3d4742", border: "none", borderRadius: 12, padding: "11px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setContactSuccess(false)}>
                {lx("Kirim pesan lain", "Send another message")}
              </button>
            </div>
          ) : (
            <>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <span style={{ position: "absolute", left: 14, top: 14, display: "flex" }}><Icon name="user" size={17} color="#9aa6a1" /></span>
                <input style={field} placeholder={lx("Nama kamu", "Your name")} value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div style={{ position: "relative", marginBottom: 12 }}>
                <span style={{ position: "absolute", left: 14, top: 14, display: "flex" }}><Icon name="mail" size={17} color="#9aa6a1" /></span>
                <input style={field} placeholder={lx("Alamat email kamu", "Your email address")} type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
              <textarea style={{ ...field, padding: "13px 14px", minHeight: 130, resize: "vertical", marginBottom: 14, display: "block" }} placeholder={lx("Tulis pertanyaan atau pesanmu", "Write your question or message")} value={contactMsg} onChange={(e) => setContactMsg(e.target.value)} />
              <button
                style={{ width: "100%", background: GREEN_DARK, color: "white", border: "none", borderRadius: 12, padding: "13px", fontSize: 14.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: contactSending ? 0.7 : 1 }}
                onClick={submitContact} disabled={contactSending}>
                {contactSending ? lx("Mengirim...", "Sending...") : (<>{lx("Kirim pesan", "Send message")} <Icon name="send" size={16} color="white" /></>)}
              </button>
            </>
          )}
        </div>
      </div>
      {renderFooter()}
    </div>
    );
  };
  return (
  <div style={s.root}>
    <style>{`
      @import url("https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap");
      button, input, textarea, select { font-family: 'AmiriAr', system-ui, -apple-system, "Segoe UI", Arial, sans-serif; }
      .exploreCard:hover { transform: translateY(-3px); box-shadow: 0 10px 26px rgba(30,60,50,0.12) !important; }
      .nav-links-scroll::-webkit-scrollbar { height: 3px; }
      .nav-links-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.5); border-radius: 4px; }
      .nav-links-scroll::-webkit-scrollbar-track { background: transparent; }
      @keyframes pathPulse { 0% { transform: scale(.9); opacity: .6; } 100% { transform: scale(1.32); opacity: 0; } }
      @keyframes pathBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
      .path-halo { animation: pathPulse 1.8s ease-out infinite; pointer-events: none; }
      .path-mascot { animation: pathBob 2.6s ease-in-out infinite; }
      .path-node:not(:disabled):hover { transform: translateY(-2px) scale(1.04); }
      @media (prefers-reduced-motion: reduce) { .path-halo, .path-mascot { animation: none; } .path-node:not(:disabled):hover { transform: none; } }
      .auth-input:focus { border-color: #7BAE9B !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(123,174,155,0.22); }
      .nav-links-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.5) transparent; }
      .sb-item:hover { background: #f3f7f5; }
      .sb-item:focus-visible { outline: 2px solid #7BAE9B; outline-offset: -2px; }
      .sb-scroll { scrollbar-width: thin; scrollbar-color: #d5dedb transparent; }
      .sb-scroll::-webkit-scrollbar { width: 6px; }
      .sb-scroll::-webkit-scrollbar-thumb { background: #d5dedb; border-radius: 6px; }
      html { -webkit-text-size-adjust: 100%; }
      button, a, [role="button"] { -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
      @media (max-width: 640px) {
        /* 16px mencegah iOS memperbesar halaman otomatis saat kolom isian difokus */
        input, textarea, select { font-size: 16px !important; }
        .nav-links-scroll::-webkit-scrollbar { display: none; }
        img, video { max-width: 100%; }
      }
    `}</style>
    <div
      onClickCapture={(e) => { if (lessonLocked) { e.preventDefault(); e.stopPropagation(); flashLockToast(); } }}
      style={lessonLocked ? { opacity: 0.55, cursor: "not-allowed", filter: "grayscale(0.2)" } : undefined}
      aria-disabled={lessonLocked || undefined}
    >
      {!(isMobile && lessonLocked) && renderNavbar()}
    </div>
    {lockToast && (
      <div style={{ position: "fixed", bottom: 120, left: 0, right: 0, zIndex: 3000, display: "flex", justifyContent: "center", padding: "0 16px", pointerEvents: "none" }}>
        <div role="status" aria-live="polite" className="ls-feedback" style={{ background: "#26332e", color: "white", padding: "11px 16px", borderRadius: 12, fontSize: 13.5, boxShadow: "0 10px 28px rgba(0,0,0,0.25)", maxWidth: 360, textAlign: "center", lineHeight: 1.45 }}>
          {lx("Kamu sedang belajar. Tekan ✕ untuk keluar dari pelajaran.", "You're in a lesson. Press ✕ to leave it.")}
        </div>
      </div>
    )}
    {featureLoading && (
      <div style={{ position: "fixed", top: NAV_H, left: 0, right: 0, bottom: 0, zIndex: 90, background: "#f6f8f7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", padding: 24 }}>
        <style>{"@keyframes featSpin{to{transform:rotate(360deg)}}"}</style>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid #e1ece7", borderTopColor: GREEN_DARK, animation: "featSpin .8s linear infinite" }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1a2421" }}>{featureLoading.label}</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>{featureLoading.sub}</div>
        </div>
      </div>
    )}
    {page === "home" && renderHome()}
    {page === "explore" && renderExplore()}
    {page === "login" && renderLogin()}
    {page === "profile" && renderProfile()}
    {page === "subject" && ((currentUser || isLocalDev())
      ? (
        <SubjectLanguage
          supabase={supabase}
          contentSupabase={supabaseSubject}
          user={currentUser}
          uiLang={uiLang}
          onChangeLang={changeUiLang}
          s={s}
          colors={{ GREEN, GREEN_DARK, GREEN_BG }}
          resumeCourseId={slAutoResume && slSummary ? slSummary.courseId : null}
          autoResume={slAutoResume}
          onResumeDone={() => setSlAutoResume(false)}
          onProgressChange={refreshSlSummary}
          onExerciseChange={setSlInExercise}
          mascot={<PlanetMascotThinking size={70} />}
        />
      )
      : renderLoginRequired())}
    {page === "ammiyah" && renderAmmiyahIntro()}
    {page === "ammiyahBagian" && ((currentUser || isLocalDev()) ? renderAmmiyahBagian() : renderLoginRequired())}
    {page === "ammiyahPath" && ((currentUser || isLocalDev()) ? renderAmmiyahPath() : renderLoginRequired())}
    {page === "ammiyahLesson" && ((currentUser || isLocalDev()) ? renderAmmiyahLesson() : renderLoginRequired())}
    {page === "ammiyahLessonComplete" && ((currentUser || isLocalDev()) ? renderAmmiyahLessonComplete() : renderLoginRequired())}
    {page === "course" && renderCourse()}
    {page === "contact" && renderContact()}

    {/* Modal Review Vocabularies */}
    

    {/* Modal konfirmasi keluar dari halaman soal */}
    {showExitConfirm && (
      <div style={s.modal} onClick={() => setShowExitConfirm(false)}>
        <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <PlanetMascotThinking size={70} />
          </div>
          <div style={{ ...s.modalTitle, textAlign: "center" }}>{t("exitConfirmTitle", uiLang)}</div>
          <p style={{ color: "#555", fontSize: 14, lineHeight: 1.6, marginBottom: 20, textAlign: "center" }}>
            {t("exitConfirmDesc", uiLang)}
          </p>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4 }}>
            <button
              style={{ ...s.lessonMainBtn, ...s.lessonBtnActive }}
              onClick={() => setShowExitConfirm(false)}
            >
              {t("exitConfirmContinue", uiLang)}
            </button>
            <button
              style={{ width: "100%", background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer", padding: 8 }}
              onClick={() => { setShowExitConfirm(false); setPage("ammiyahPath"); }}
            >
              {t("exitConfirmLeave", uiLang)}
            </button>
          </div>
        </div>
      </div>
    )}

    {showDonate && (
      <div style={s.modal} onClick={closeDonate}>
        <div style={{ ...s.modalBox, maxWidth: 400, padding: "30px 26px 24px", position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <button onClick={closeDonate} aria-label="Close" style={{ position: "absolute", top: 14, right: 14, background: "#f1f5f3", border: "none", borderRadius: 999, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5b6862" }}>
            <Icon name="x" size={15} />
          </button>

          {!donateMethod ? (
            <>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: "#FDECEC", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <Icon name="heart" size={24} color="#E0505A" fill="#E0505A" stroke={1.4} />
              </div>
              <div style={{ fontSize: 21, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>Support LearningSpace</div>
              <p style={{ color: "#5b6862", fontSize: 14, lineHeight: 1.65, margin: "0 0 22px" }}>
                {lx(
                  "LearningSpace gratis untuk semua orang. Donasi kamu, sekecil apa pun, membantu kami menjaga platform ini tetap berjalan dan terus membuat materi yang berkualitas. Terima kasih sudah ikut mendukung!",
                  "LearningSpace is free for everyone. Your donation, however small, helps us keep the platform running and keep creating quality learning material. Thank you for your support!"
                )}
              </p>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.6, color: "#8a9690", textTransform: "uppercase", marginBottom: 10 }}>
                {lx("Pilih metode donasi", "Choose a donation method")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["paypal", "PayPal", "/paypal-logo.png"], ["qris", "QRIS", "/qris-logo.png"]].map(([id, name, logo]) => (
                  <button key={id} onClick={() => setDonateMethod(id)}
                    style={{ background: "white", border: "1px solid #e3e9e6", borderRadius: 14, padding: "14px 10px 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, fontFamily: "inherit", transition: "box-shadow .15s, border-color .15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 18px rgba(30,60,50,0.12)"; e.currentTarget.style.borderColor = GREEN; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#e3e9e6"; }}>
                    <img src={logo} alt={name} style={{ height: 78, width: "100%", objectFit: "contain" }} />
                    <span style={{ fontSize: 12.5, color: "#5b6862", fontWeight: 600 }}>{lx("Tampilkan barcode", "Show barcode")}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => { setDonateMethod(null); setDonateImgErr(false); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#5b6862", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14, fontFamily: "inherit" }}>
                <Icon name="back" size={14} /> {lx("Kembali", "Back")}
              </button>
              <div style={{ textAlign: "center" }}>
                <img src={donateMethod === "paypal" ? "/paypal-logo.png" : "/qris-logo.png"} alt={donateMethod} style={{ height: 54, objectFit: "contain", marginBottom: 12 }} />
                <div style={{ background: "#f6f8f7", border: "1px solid #e3e9e6", borderRadius: 16, padding: 14, display: donateImgErr ? "none" : "inline-block", maxWidth: "100%" }}>
                  <img
                    src={donateMethod === "paypal" ? "/paypal-qr.png" : "/qris.jpeg"}
                    alt={donateMethod === "paypal" ? "PayPal barcode" : "QRIS barcode"}
                    style={{ width: 240, maxWidth: "100%", borderRadius: 10, display: "block", background: "white" }}
                    onError={() => setDonateImgErr(true)}
                  />
                </div>
                {donateImgErr && <div style={{ fontSize: 13, color: "#9aa6a1", padding: "26px 0 4px" }}>{lx("Barcode belum tersedia.", "Barcode not available yet.")}</div>}
                <div style={{ fontSize: 13, color: "#6b7772", marginTop: 14, lineHeight: 1.6 }}>
                  {donateMethod === "paypal"
                    ? lx("Scan barcode dengan aplikasi PayPal.", "Scan the barcode with the PayPal app.")
                    : lx("Scan dengan aplikasi e-wallet atau mobile banking apa pun.", "Scan with any e-wallet or mobile banking app.")}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )}
  </div>
  );
}