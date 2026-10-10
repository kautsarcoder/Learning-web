import { EXERCISE_EN, SECTION_TITLE_EN } from "./subjectLanguageData.en.js";

// ============================================================
// Subject Language Learning — data contoh (seed) untuk testing.
//
// Struktur: Course -> Unit -> Section -> Lesson -> Exercise.
// Jumlah Unit/Section/Lesson/Exercise FLEKSIBEL — semua komponen UI
// cuma meng-iterasi array, tidak ada angka yang di-hardcode.
//
// Nanti konten asli datang dari hasil generate AI (admin) yang disimpan
// ke database; file ini cuma sample supaya seluruh alur bisa dites.
// Bentuk datanya sengaja sama dengan yang akan dibaca dari database:
// kalau nanti pindah ke Supabase, cukup ganti sumber `SUBJECT_COURSES`
// (lihat `loadSubjectCourses` di SubjectLanguage.jsx).
//
// Tiap exercise punya metadata:
//   category : vocabulary | academic | exam | question  (untuk Review)
//   lang     : language skill  (vocabulary | academic | exam | reading)
//   subj     : subject skill   (mis. "Syarat Murabahah") -> dipisahkan
//                               dari language supaya bisa dianalisis
//                               "salah di bahasa atau di materi?"
// ============================================================

export const LESSON_KINDS = {
  vocab: { id: "Kosakata", en: "Vocabulary", icon: "📚" },
  context: { id: "Konteks", en: "Context", icon: "🧠" },
  academic: { id: "Bahasa Akademik", en: "Academic Language", icon: "📖" },
  practice: { id: "Latihan", en: "Practice", icon: "✍️" },
  review: { id: "Review", en: "Review", icon: "🔁" },
};

export const LANG_SKILLS = {
  vocabulary: { id: "Vocabulary", en: "Vocabulary" },
  academic: { id: "Academic Language", en: "Academic Language" },
  reading: { id: "Reading", en: "Reading" },
  exam: { id: "Exam Language", en: "Exam Language" },
};

export const REVIEW_CATEGORIES = {
  vocabulary: { id: "Vocabulary", en: "Vocabulary" },
  academic: { id: "Academic Expressions", en: "Academic Expressions" },
  exam: { id: "Exam Language", en: "Exam Language" },
  question: { id: "Questions", en: "Questions" },
};

// ---- helper pembuat exercise (biar data ringkas) ----
const mcq = (id, prompt, promptAr, options, answer, m) => ({
  id, type: "mcq", prompt, promptAr, options, answer, ...m,
});
const tf = (id, prompt, promptAr, answer, m) => ({
  id, type: "tf", prompt, promptAr, options: ["Benar", "Salah"], answer: answer ? 0 : 1, ...m,
});
const fill = (id, prompt, promptAr, options, answer, m) => ({
  id, type: "fill", prompt, promptAr, options, answer, ...m,
});
const match = (id, prompt, pairs, m) => ({ id, type: "match", prompt, pairs, ...m });
const translate = (id, prompt, promptAr, answers, m) => ({
  id, type: "translate", prompt, promptAr, answers, ...m,
});
const reading = (id, prompt, passage, passageId, promptAr, options, answer, m) => ({
  id, type: "reading", prompt, passage, passageTranslation: passageId, promptAr, options, answer, ...m,
});

const V = (subj, extra) => ({ category: "vocabulary", lang: "vocabulary", subj, ...extra });
const A = (subj, extra) => ({ category: "academic", lang: "academic", subj, ...extra });
const E = (subj, extra) => ({ category: "exam", lang: "exam", subj, ...extra });
const Q = (subj, extra) => ({ category: "question", lang: "exam", subj, ...extra });
const R = (subj, extra) => ({ category: "question", lang: "reading", subj, ...extra });

export const SUBJECT_COURSES = [
  {
    id: "islamic-banking-ar",
    title: "Islamic Banking",
    titleAr: "الصيرفة الإسلامية", // nama subject dalam bahasa Arab (opsional)
    subject: "Islamic Banking",
    language: "Arabic",
    description:
      "Pelajari kosakata, istilah akademik, dan bahasa ujian yang digunakan dalam materi Islamic Banking.",
    duration: "± 4 jam",
    difficulty: "Menengah",
    units: [
      // ───────────────────────── UNIT 1 ─────────────────────────
      {
        id: "u1",
        title: "Introduction to Islamic Banking",
        sections: [
          {
            id: "u1-s1",
            title: "Pengertian",
            lessons: [
              {
                id: "u1-s1-l1",
                kind: "vocab",
                exercises: [
                  match("u1-s1-l1-e1", "Cocokkan kata dengan artinya", [
                    ["مصرف إسلامي", "bank syariah"],
                    ["الربا", "riba"],
                    ["رأس المال", "modal"],
                    ["الربح", "keuntungan"],
                  ], V("Konsep dasar bank syariah")),
                  mcq("u1-s1-l1-e2", "Pilih arti yang benar", "الخسارة",
                    ["kerugian", "keuntungan", "modal", "akad"], 0,
                    V("Prinsip bagi untung-rugi", { explain: "الخسارة = kerugian (lawan dari الربح = keuntungan)." })),
                ],
              },
              {
                id: "u1-s1-l2",
                kind: "context",
                exercises: [
                  fill("u1-s1-l2-e1", "Lengkapi kalimat dengan kata yang tepat",
                    "يُحرِّم المصرف الإسلامي ______ ويعتمد على المشاركة في الربح والخسارة.",
                    ["الربا", "الربح", "العقد", "التسليم"], 0,
                    V("Larangan riba", { explain: "Bank syariah mengharamkan الربا (riba/bunga) dan memakai prinsip bagi hasil." })),
                  mcq("u1-s1-l2-e2", "Apa makna kalimat ini?",
                    "يقوم المصرف الإسلامي على مبدأ المشاركة في الربح والخسارة.",
                    ["Bank syariah berdasar pada prinsip berbagi untung dan rugi.",
                      "Bank syariah hanya mengambil keuntungan.",
                      "Bank syariah tidak mengenal akad.",
                      "Bank syariah memberi pinjaman berbunga."], 0,
                    V("Prinsip bagi untung-rugi", { lang: "reading", category: "question" })),
                ],
              },
              {
                id: "u1-s1-l3",
                kind: "practice",
                exercises: [
                  mcq("u1-s1-l3-e1", "Soal ujian", "ما المقصود بالربا؟",
                    ["الزيادة المشروطة على أصل المال دون مقابل مشروع", "عقد بيع بثمن التكلفة", "المشاركة في الخسارة", "تسليم السلعة للمشتري"], 0,
                    E("Definisi riba", { explain: "ما المقصود بـ = apa yang dimaksud dengan. Riba = tambahan yang disyaratkan atas pokok harta tanpa imbalan yang dibenarkan." })),
                ],
              },
            ],
          },
          {
            id: "u1-s2",
            title: "Kosakata",
            lessons: [
              {
                id: "u1-s2-l1",
                kind: "vocab",
                exercises: [
                  mcq("u1-s2-l1-e1", "Pilih arti yang benar", "العقد", ["akad / kontrak", "harga", "barang", "penjual"], 0,
                    V("Akad")),
                  mcq("u1-s2-l1-e2", "Pilih arti yang benar", "السلعة", ["barang", "pembeli", "tempo", "laba"], 0,
                    V("Objek akad")),
                  translate("u1-s2-l1-e3", "Tulis terjemahannya dalam Bahasa Indonesia", "المشتري",
                    ["pembeli"], V("Pihak dalam akad")),
                ],
              },
            ],
          },
        ],
      },

      // ───────────────────────── UNIT 2 ─────────────────────────
      {
        id: "u2",
        title: "Murabahah",
        sections: [
          {
            id: "u2-s1",
            title: "Pengertian",
            lessons: [
              {
                id: "u2-s1-l1",
                kind: "context",
                exercises: [
                  mcq("u2-s1-l1-e1", "Soal ujian", "ما المقصود بالمرابحة؟",
                    ["بيع السلعة بثمن شرائها الأول مع زيادة ربح معلوم", "المشاركة في رأس المال فقط", "قرض بفائدة ثابتة", "إيجار السلعة لمدة محددة"], 0,
                    E("Definisi Murabahah", { explain: "المرابحة = menjual barang dengan harga beli pertama ditambah margin keuntungan yang diketahui." })),
                  tf("u2-s1-l1-e2", "Benar atau salah?",
                    "في المرابحة يعرف المشتري ثمن الشراء الأول والربح.", true,
                    Q("Definisi Murabahah", { lang: "reading", explain: "Transparansi harga beli dan margin adalah inti murabahah." })),
                ],
              },
            ],
          },
          {
            id: "u2-s2",
            title: "Kosakata",
            lessons: [
              {
                id: "u2-s2-l1",
                kind: "vocab",
                exercises: [
                  match("u2-s2-l1-e1", "Cocokkan kata dengan artinya", [
                    ["الثمن", "harga"],
                    ["التكلفة", "biaya pokok"],
                    ["البائع", "penjual"],
                    ["المشتري", "pembeli"],
                    ["الأجل", "tempo / jangka waktu"],
                  ], V("Istilah jual beli murabahah")),
                  mcq("u2-s2-l1-e2", "Pilih arti yang benar", "الهامش", ["margin", "modal", "kerugian", "serah terima"], 0,
                    V("Margin keuntungan")),
                  fill("u2-s2-l1-e3", "Lengkapi kalimat",
                    "يبيع المصرف السلعة للعميل بثمن ______ مع ربح معلوم.",
                    ["التكلفة", "الخسارة", "الأجل", "التسليم"], 0,
                    V("Harga pokok", { explain: "ثمن التكلفة = harga pokok/biaya perolehan." })),
                ],
              },
              {
                id: "u2-s2-l2",
                kind: "context",
                exercises: [
                  translate("u2-s2-l2-e1", "Tulis terjemahannya", "الربح معلوم", ["keuntungan diketahui", "keuntungannya diketahui", "laba diketahui", "keuntungan itu diketahui"],
                    V("Margin keuntungan", { lang: "reading", category: "question" })),
                ],
              },
            ],
          },
          {
            id: "u2-s3",
            title: "Syarat",
            lessons: [
              {
                id: "u2-s3-l1",
                kind: "vocab",
                exercises: [
                  mcq("u2-s3-l1-e1", "Pilih arti yang benar", "الشرط", ["syarat", "harga", "akad", "tempo"], 0,
                    V("Syarat Murabahah")),
                  mcq("u2-s3-l1-e2", "Pilih arti yang benar", "مملوكة للبائع", ["dimiliki oleh penjual", "dijual oleh pembeli", "dititipkan kepada bank", "dibeli secara tunai"], 0,
                    V("Syarat Murabahah", { explain: "Barang harus sudah dimiliki penjual sebelum dijual (مملوكة للبائع)." })),
                ],
              },
              {
                id: "u2-s3-l2",
                kind: "academic",
                exercises: [
                  mcq("u2-s3-l2-e1", "Apa arti ungkapan ini?", "بناءً على ما سبق",
                    ["berdasarkan apa yang telah disebutkan sebelumnya", "sebagai contoh", "kecuali yang berikut", "pada akhirnya tidak"], 0,
                    A("Bahasa akademik", { explain: "بناءً على ما سبق sering dipakai untuk menarik kesimpulan dari pembahasan sebelumnya." })),
                  mcq("u2-s3-l2-e2", "Apa arti ungkapan ini?", "وفقًا للنص",
                    ["sesuai dengan teks", "bertentangan dengan teks", "tanpa teks", "sebelum teks"], 0,
                    A("Bahasa akademik")),
                ],
              },
              {
                id: "u2-s3-l3",
                kind: "practice",
                exercises: [
                  mcq("u2-s3-l3-e1", "Soal ujian", "أي مما يلي لا يُعدّ من شروط المرابحة؟",
                    ["أن يكون الثمن الأول معلومًا", "أن يكون الربح معلومًا", "أن يكون الربح مجهولًا", "أن تكون السلعة مملوكة للبائع"], 2,
                    E("Syarat Murabahah", {
                      langTags: ["أي مما يلي", "لا يُعدّ من"],
                      explain: "لا يُعدّ من = tidak termasuk. Margin harus diketahui (معلوم), jadi 'margin tidak diketahui' bukan syarat — justru melanggarnya.",
                    })),
                  mcq("u2-s3-l3-e2", "Soal ujian", "جميع ما يلي من شروط المرابحة ما عدا:",
                    ["معرفة المشتري بالثمن الأول", "تحديد الربح", "بيع ما لا يملكه البائع", "خلو العقد من الربا"], 2,
                    E("Syarat Murabahah", {
                      langTags: ["جميع ما يلي", "ما عدا"],
                      explain: "ما عدا = kecuali. Menjual barang yang tidak dimiliki penjual tidak dibolehkan.",
                    })),
                ],
              },
              {
                id: "u2-s3-l4",
                kind: "review",
                exercises: [
                  tf("u2-s3-l4-e1", "Benar atau salah?",
                    "يجوز أن يبيع المصرف سلعة لا يملكها بالمرابحة.", false,
                    Q("Syarat Murabahah", { explain: "Salah. Bank harus memiliki barang lebih dulu." })),
                ],
              },
            ],
          },
          {
            id: "u2-s4",
            title: "Prosedur",
            lessons: [
              {
                id: "u2-s4-l1",
                kind: "context",
                exercises: [
                  reading("u2-s4-l1-e1", "Pahami bacaannya, lalu jawab",
                    "يطلب العميل من المصرف شراء سيارة. يشتري المصرف السيارة من المعرض بثلاثين ألفًا، ثم يبيعها للعميل بثلاثة وثلاثين ألفًا، ويسدد العميل الثمن على أقساط.",
                    "Nasabah meminta bank membeli mobil. Bank membeli mobil dari showroom seharga 30 ribu, lalu menjualnya kepada nasabah seharga 33 ribu, dan nasabah membayar harganya dengan cicilan.",
                    "ما مقدار ربح المصرف وفقًا للنص؟",
                    ["ثلاثة آلاف", "ثلاثون ألفًا", "ثلاثة وثلاثون ألفًا", "ألف"], 0,
                    R("Prosedur Murabahah", { langTags: ["وفقًا للنص"], explain: "33.000 − 30.000 = 3.000 (ثلاثة آلاف)." })),
                  mcq("u2-s4-l1-e2", "Pilih arti yang benar", "الأقساط", ["cicilan", "tunai", "modal", "denda"], 0,
                    V("Prosedur Murabahah")),
                ],
              },
            ],
          },
          {
            id: "u2-s5",
            title: "Bahasa Ujian",
            lessons: [
              {
                id: "u2-s5-l1",
                kind: "academic",
                exercises: [
                  mcq("u2-s5-l1-e1", "Apa arti pola soal ini?", "اختر الإجابة الصحيحة",
                    ["pilih jawaban yang benar", "tulislah dengan kata-katamu", "jelaskan dengan contoh", "bandingkan keduanya"], 0,
                    E("Pola soal ujian")),
                  mcq("u2-s5-l1-e2", "Apa arti pola soal ini?", "ما المقصود بـ",
                    ["apa yang dimaksud dengan", "siapa yang menulis", "kapan terjadi", "berapa jumlahnya"], 0,
                    E("Pola soal ujian")),
                  mcq("u2-s5-l1-e3", "Apa arti pola soal ini?", "جميع ما يلي صحيح ما عدا",
                    ["semua berikut benar kecuali", "semua berikut salah", "salah satu berikut benar", "tidak ada yang benar"], 0,
                    E("Pola soal ujian")),
                  match("u2-s5-l1-e4", "Cocokkan pola soal dengan artinya", [
                    ["أي مما يلي", "manakah dari berikut"],
                    ["لا يُعدّ من", "tidak termasuk"],
                    ["وفقًا للنص", "sesuai teks"],
                    ["ما عدا", "kecuali"],
                  ], E("Pola soal ujian")),
                ],
              },
            ],
          },
          {
            id: "u2-s6",
            title: "Latihan Ujian",
            lessons: [
              {
                id: "u2-s6-l1",
                kind: "practice",
                exercises: [
                  mcq("u2-s6-l1-e1", "Simulasi ujian", "أي مما يلي يصف المرابحة بشكل صحيح؟",
                    ["بيع بثمن التكلفة مع ربح معلوم", "قرض بزيادة مشروطة", "مشاركة في الخسارة فقط", "إجارة منتهية بالتمليك"], 0,
                    Q("Definisi Murabahah", { lang: "exam", langTags: ["أي مما يلي"] })),
                  tf("u2-s6-l1-e2", "Simulasi ujian — benar atau salah?",
                    "الربح في المرابحة يكون مجهولًا للمشتري.", false,
                    Q("Syarat Murabahah", { explain: "Salah. Margin harus diketahui pembeli." })),
                  mcq("u2-s6-l1-e3", "Simulasi ujian", "بناءً على ما سبق، لماذا يجب أن يملك المصرف السلعة قبل بيعها؟",
                    ["لأن بيع ما لا يملكه البائع غير جائز", "لأن الربح يصبح أكبر", "لأن العميل لا يحتاج إلى عقد", "لأن الأقساط تُلغى"], 0,
                    Q("Syarat Murabahah", { lang: "academic", langTags: ["بناءً على ما سبق"] })),
                ],
              },
            ],
          },
        ],
      },

      // ───────────────────────── UNIT 3 ─────────────────────────
      {
        id: "u3",
        title: "Mudarabah",
        sections: [
          {
            id: "u3-s1",
            title: "Pengertian",
            lessons: [
              {
                id: "u3-s1-l1",
                kind: "vocab",
                exercises: [
                  match("u3-s1-l1-e1", "Cocokkan kata dengan artinya", [
                    ["المضاربة", "mudharabah"],
                    ["رب المال", "pemilik modal"],
                    ["المضارب", "pengelola dana"],
                    ["نسبة الربح", "nisbah bagi hasil"],
                  ], V("Istilah Mudarabah")),
                ],
              },
              {
                id: "u3-s1-l2",
                kind: "practice",
                exercises: [
                  mcq("u3-s1-l2-e1", "Soal ujian", "في عقد المضاربة، من يقدّم المال؟",
                    ["رب المال", "المضارب", "المورد", "الوسيط"], 0,
                    Q("Pihak dalam Mudarabah", { lang: "exam" })),
                  mcq("u3-s1-l2-e2", "Soal ujian", "من يتحمل الخسارة المالية إذا لم يقصّر المضارب؟",
                    ["رب المال", "المضارب", "الاثنان بالتساوي", "الدولة"], 0,
                    Q("Kerugian dalam Mudarabah", { explain: "Kerugian finansial ditanggung pemilik modal selama pengelola tidak lalai (يقصّر = lalai)." })),
                ],
              },
            ],
          },
          {
            id: "u3-s2",
            title: "Kosakata",
            lessons: [
              {
                id: "u3-s2-l1",
                kind: "vocab",
                exercises: [
                  mcq("u3-s2-l1-e1", "Pilih arti yang benar", "العمل", ["kerja / pengelolaan usaha", "modal", "harga", "bunga"], 0,
                    V("Istilah Mudarabah")),
                  mcq("u3-s2-l1-e2", "Pilih arti yang benar", "الاتفاق", ["kesepakatan", "kerugian", "serah terima", "keuntungan"], 0,
                    V("Istilah Mudarabah")),
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

// Tempelkan terjemahan Inggris ke data contoh. Bentuk akhirnya sama dengan
// konten dari database: tiap exercise punya `en`, tiap section punya `en.title`.
SUBJECT_COURSES.forEach((c) =>
  c.units.forEach((u) =>
    u.sections.forEach((sec) => {
      sec.en = { title: SECTION_TITLE_EN[sec.title] || sec.title };
      sec.lessons.forEach((l) =>
        l.exercises.forEach((e) => { if (EXERCISE_EN[e.id]) e.en = EXERCISE_EN[e.id]; })
      );
    })
  )
);
