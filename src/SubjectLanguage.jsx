import { useState, useEffect, useMemo, useRef } from "react";
import { sfx, SoundToggle, useCountUp, fxCardClass, CountUp, Celebrate } from "./fx";
import { SUBJECT_COURSES, LESSON_KINDS, LANG_SKILLS, REVIEW_CATEGORIES } from "./subjectLanguageData";

// ============================================================
// Subject Language Learning
//
// Fitur BARU yang ditempel ke LearningSpace (bukan app terpisah):
//  - pakai Supabase client + user login yang sama (dioper lewat props)
//  - pakai objek style `s` & warna GREEN milik App.jsx (dioper lewat props)
//    supaya tampilannya sama dengan fitur Levantine
//  - progress disimpan persisten (Supabase + cadangan localStorage)
//
// Struktur konten: Course -> Unit -> Section -> Lesson -> Exercise.
// Tidak ada jumlah Unit/Section yang di-hardcode.
// ============================================================

const INTERVALS = [0, 1, 3, 7, 16]; // hari, untuk spaced repetition (box 0..4)
const XP_CORRECT = 10;

// Sumber konten: tabel `subject_courses` (course yang sudah di-publish admin,
// hasil generate AI). Kalau tabel kosong/belum ada/offline -> pakai data contoh.
let _coursesCache = null;
export function loadSubjectCourses() {
  return _coursesCache || SUBJECT_COURSES; // sinkron: cache kalau sudah ada
}
export async function fetchSubjectCourses(supabase) {
  if (_coursesCache) return _coursesCache;
  try {
    const { data, error } = await supabase
      .from("subject_courses")
      .select("content")
      .eq("published", true)
      .order("created_at", { ascending: true });
    if (!error && data && data.length > 0) {
      _coursesCache = data.map((r) => r.content).filter((c) => c && c.id && Array.isArray(c.units));
      if (_coursesCache.length > 0) return _coursesCache;
      _coursesCache = null;
    }
  } catch (e) { /* jatuh ke data contoh */ }
  _coursesCache = SUBJECT_COURSES;
  return _coursesCache;
}

// ---------- lokalisasi isi (Indonesia / Inggris) ----------
// Konten boleh punya `en` di tiap exercise ({prompt, explain, subj, options,
// answers, pairs (kolom kanan saja), passageTranslation}) dan `en.title` di
// unit/section. Kalau terjemahan tidak ada, otomatis jatuh ke teks Indonesia.
export function localizeExercise(ex, lang) {
  if (lang !== "en" || !ex.en) return ex;
  const out = { ...ex };
  ["prompt", "explain", "subj", "options", "answers", "passageTranslation"].forEach((k) => {
    if (ex.en[k] !== undefined) out[k] = ex.en[k];
  });
  if (ex.en.pairs && ex.pairs) out.pairs = ex.pairs.map((p, i) => [p[0], ex.en.pairs[i] !== undefined ? ex.en.pairs[i] : p[1]]);
  return out;
}
const titleOf = (node, lang) => (lang === "en" && node.en && node.en.title ? node.en.title : node.title);

// ---------- util umum ----------
const todayStr = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x.toISOString().slice(0, 10);
};
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const normalize = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/[ً-ْ]/g, "") // harakat Arab
    .replace(/[.,!?؟،;:"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const isArabic = (str) => /[؀-ۿ]/.test(str || "");

// ---------- helper struktur course ----------
function indexCourse(course) {
  const map = {};
  course.units.forEach((u) =>
    u.sections.forEach((sec) =>
      sec.lessons.forEach((l) =>
        l.exercises.forEach((e) => {
          map[e.id] = { ex: e, unitId: u.id, sectionId: sec.id, lessonId: l.id };
        })
      )
    )
  );
  return map;
}
const lessonIds = (l) => l.exercises.map((e) => e.id);
const sectionIds = (sec) => sec.lessons.flatMap(lessonIds);
const unitIds = (u) => u.sections.flatMap(sectionIds);
const courseIds = (c) => c.units.flatMap(unitIds);
const countDone = (ids, done) => ids.reduce((n, id) => n + (done[id] ? 1 : 0), 0);
const pct = (ids, done) => (ids.length === 0 ? 100 : Math.round((countDone(ids, done) / ids.length) * 100));
const allDone = (ids, done) => ids.every((id) => done[id]);

// Status: completed | current | available | locked, tergantung mode.
// sequential = urut ketat, free = bebas, hybrid (default) = yang sedang
// dikerjakan + 1 berikutnya terbuka, sisanya terkunci.
function statusList(items, isDone, mode) {
  const firstOpen = items.findIndex((it) => !isDone(it));
  return items.map((it, i) => {
    if (isDone(it)) return "completed";
    if (i === firstOpen) return "current";
    if (mode === "free") return "available";
    if (mode === "hybrid" && i === firstOpen + 1) return "available";
    return "locked";
  });
}

function flatLessons(course) {
  const out = [];
  course.units.forEach((u) =>
    u.sections.forEach((sec) => sec.lessons.forEach((l) => out.push({ unit: u, section: sec, lesson: l })))
  );
  return out;
}

function emptyState() {
  return {
    v: 1,
    pos: null, // { unitId, sectionId, lessonId, exerciseId }
    mode: "hybrid",
    done: {},
    answers: {}, // exId -> { attempts, correct, last }
    skills: { language: {}, subject: {} }, // key -> { c, t }
    review: {}, // exId -> { cat, box, due }
    xp: 0,
    streak: { count: 0, last: null },
    updatedAt: 0,
  };
}

// Pilih posisi "lanjutkan": posisi tersimpan, atau exercise pertama yang belum selesai.
function resolvePos(course, state, index) {
  if (state.pos && index[state.pos.exerciseId]) return state.pos;
  const ids = courseIds(course);
  const id = ids.find((x) => !state.done[x]) || ids[0];
  if (!id) return null;
  const m = index[id];
  return { unitId: m.unitId, sectionId: m.sectionId, lessonId: m.lessonId, exerciseId: id };
}

// Ringkasan untuk kartu "Lanjutkan Belajar" di Home.
export function summarizeProgress(course, state, lang) {
  if (!course || !state || !state.pos) return null;
  const index = indexCourse(course);
  const pos = resolvePos(course, state, index);
  if (!pos) return null;
  const unit = course.units.find((u) => u.id === pos.unitId);
  const section = unit && unit.sections.find((x) => x.id === pos.sectionId);
  const lesson = section && section.lessons.find((x) => x.id === pos.lessonId);
  const unitNo = unit ? course.units.indexOf(unit) + 1 : 0;
  return {
    courseId: course.id,
    courseTitle: `${course.title} — ${course.language}`,
    unitLabel: unit ? `Unit ${unitNo} · ${titleOf(unit, lang)}` : "",
    sectionTitle: section ? titleOf(section, lang) : "",
    exerciseNo: lesson ? lesson.exercises.findIndex((e) => e.id === pos.exerciseId) + 1 : 0,
    percent: pct(courseIds(course), state.done || {}),
  };
}

const lsKey = (userId, courseId) => `sl_progress_${userId || "anon"}_${courseId}`;
const sumKey = (userId) => `sl_summary_${userId || "anon"}`;

// Dipakai Home: ambil ringkasan progress terakhir (Supabase dulu, lalu cache lokal).
export async function fetchResumeSummary(supabase, userId, lang, contentSupabase) {
  const courses = await fetchSubjectCourses(contentSupabase || supabase);
  try {
    if (userId) {
      const { data, error } = await supabase
        .from("user_course_progress")
        .select("course_id, state, last_accessed_at")
        .eq("user_id", userId)
        .order("last_accessed_at", { ascending: false })
        .limit(1);
      if (!error && data && data[0]) {
        const course = courses.find((c) => c.id === data[0].course_id);
        const sm = summarizeProgress(course, data[0].state, lang);
        if (sm) return sm;
      }
    }
  } catch (e) { /* jatuh ke cache lokal */ }
  try {
    const raw = window.localStorage.getItem(sumKey(userId));
    if (raw) return JSON.parse(raw);
  } catch (e) { /* abaikan */ }
  return null;
}

// ============================================================
// Komponen kecil
// ============================================================
function Bar({ value, color, height = 8 }) {
  return (
    <div style={{ flex: 1, height, background: "#e5e5e5", borderRadius: height, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: color, borderRadius: height, transition: "width .25s" }} />
    </div>
  );
}

function Chip({ children, bg = "#eef4f1", color = "#4b6b60" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: bg, color, borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
      {children}
    </span>
  );
}

// ---------- ikon garis (SVG) — pengganti emoji supaya tampilan konsisten ----------
const ICONS = {
  cap: <><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /></>,
  book: <><path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4z" /><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7z" /></>,
  doc: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5" /><path d="M9 13h7M9 17h5" /></>,
  layers: <><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.3" /></>,
  pen: <><path d="M4 20l1-4L16 5l3 3L8 19z" /><path d="M14 7l3 3" /></>,
  repeat: <><path d="M17 2l3 3-3 3" /><path d="M4 11V9a4 4 0 014-4h12" /><path d="M7 22l-3-3 3-3" /><path d="M20 13v2a4 4 0 01-4 4H4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  flame: <path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  check: <path d="M5 12l5 5 9-10" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  back: <path d="M15 6l-6 6 6 6" />,
  play: <path d="M8 5l11 7-11 7z" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  headphones: <><path d="M4 15v-3a8 8 0 0116 0v3" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  user: <><circle cx="12" cy="8.5" r="3.7" /><path d="M5 20c.8-3.6 3.7-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="2.5" /><path d="M4 7.5l8 6 8-6" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4.2 4.2 0 0 1 7-3 4.2 4.2 0 0 1 7 3c0 5.6-7 10-7 10z" />,
  send: <><path d="M20 4L10.5 13.5" /><path d="M20 4l-6 16-3.5-6.5L4 10z" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
};
const KIND_ICON = { vocab: "book", context: "layers", academic: "cap", practice: "pen", review: "repeat" };

// ---- Bendera & logo sosial (SVG) + pemilih bahasa kustom ----
export function FlagID({ w = 22 }) {
  return (
    <svg width={w} height={w * 2 / 3} viewBox="0 0 30 20" style={{ borderRadius: 3, boxShadow: "0 0 0 1px rgba(0,0,0,0.12)", flexShrink: 0 }} aria-hidden="true">
      <rect width="30" height="10" fill="#E70011" />
      <rect y="10" width="30" height="10" fill="#fff" />
    </svg>
  );
}
export function FlagGB({ w = 22 }) {
  return (
    <svg width={w} height={w * 2 / 3} viewBox="0 0 60 40" style={{ borderRadius: 3, boxShadow: "0 0 0 1px rgba(0,0,0,0.12)", flexShrink: 0 }} aria-hidden="true">
      <clipPath id="gbclip"><rect width="60" height="40" rx="0" /></clipPath>
      <g clipPath="url(#gbclip)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0L60 40M60 0L0 40" stroke="#fff" strokeWidth="8" />
        <path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" strokeWidth="3" />
        <path d="M30 0V40M0 20H60" stroke="#fff" strokeWidth="13" />
        <path d="M30 0V40M0 20H60" stroke="#C8102E" strokeWidth="7.5" />
      </g>
    </svg>
  );
}
export function InstagramLogo({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FEDA75" /><stop offset="0.3" stopColor="#FA7E1E" />
          <stop offset="0.55" stopColor="#D62976" /><stop offset="0.8" stopColor="#962FBF" /><stop offset="1" stopColor="#4F5BD5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6.5" fill="url(#igGrad)" />
      <rect x="5" y="5" width="14" height="14" rx="4.2" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="3.3" fill="none" stroke="#fff" strokeWidth="1.7" />
      <circle cx="16.2" cy="7.8" r="1" fill="#fff" />
    </svg>
  );
}
export function YouTubeLogo({ size = 20 }) {
  return (
    <svg width={size * 1.4} height={size} viewBox="0 0 28 20" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="28" height="20" rx="5.5" fill="#FF0000" />
      <path d="M11 6l7.5 4L11 14z" fill="#fff" />
    </svg>
  );
}
export function LangSwitch({ uiLang, onChange, s, title }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const opts = [{ v: "id", n: "Indonesia", F: FlagID }, { v: "en", n: "English", F: FlagGB }];
  const cur = opts.find((o) => o.v === uiLang) || opts[0];
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" title={title} onClick={() => setOpen(!open)}
        style={{ ...s.langSelectBox, cursor: "pointer", fontFamily: "inherit" }}>
        <cur.F w={20} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>{cur.n}</span>
        <Icon name="chevron" size={12} color="#888" />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 160, background: "#fff", border: "1px solid #e3e9e6", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 4, zIndex: 200 }}>
          {opts.map((o) => (
            <button key={o.v} type="button" onClick={() => { setOpen(false); onChange && onChange(o.v); }}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: "none", background: o.v === uiLang ? "#f1f5f3" : "transparent", padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1a1a1a", fontFamily: "inherit", textAlign: "left" }}>
              <o.F w={22} /><span style={{ flex: 1 }}>{o.n}</span>
              {o.v === uiLang && <Icon name="check" size={14} color="#2e7d5b" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Icon({ name, size = 20, color = "currentColor", stroke = 1.8, fill = "none" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {ICONS[name]}
    </svg>
  );
}

// Kotak ikon: lembut (default) atau solid.
export function IconTile({ name, C, size = 40, solid = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.32), flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: solid ? C.GREEN_DARK : "#e8f1ed",
      color: solid ? "white" : C.GREEN_DARK,
      boxShadow: solid ? "0 8px 18px rgba(90,138,121,0.28)" : "none",
    }}>
      <Icon name={name} size={Math.round(size * 0.5)} />
    </div>
  );
}

function LoadingScreen({ label, sub, C }) {
  return (
    <div style={{ minHeight: "70vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24, textAlign: "center" }}>
      <style>{"@keyframes slSpin{to{transform:rotate(360deg)}}@keyframes slFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"}</style>
      <div style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid #e1ece7", borderTopColor: C.GREEN_DARK, animation: "slSpin .8s linear infinite" }} />
      <div style={{ animation: "slFade .3s ease" }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: "#1a2421" }}>{label}</div>
        {sub && <div style={{ fontSize: 13, color: "#888", marginTop: 4, maxWidth: 280 }}>{sub}</div>}
      </div>
    </div>
  );
}

export function Ring({ value, C, size = 124 }) {
  const r = (size - 14) / 2, circ = 2 * Math.PI * r;
  const shown = useCountUp(value, 800);
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8f1ed" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.GREEN_DARK} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - shown / 100)} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: "#1a2421", lineHeight: 1 }}>{shown}%</div>
      </div>
    </div>
  );
}

// ---------- tampilan 1 soal ----------
function ExerciseView({ ex: rawEx, lang, s, C, tx, langName, onAnswered, onNext, onExit, position, total, mascot }) {
  const ex = useMemo(() => localizeExercise(rawEx, lang), [rawEx, lang]);
  const [sel, setSel] = useState(null);
  const [text, setText] = useState("");
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState(false);
  const [pick, setPick] = useState(null); // match: { side: "L"|"R", i } — boleh mulai dari Arab ATAU dari arti
  const [matched, setMatched] = useState({});
  const [mistakes, setMistakes] = useState(0);
  const [wrongIdx, setWrongIdx] = useState([]); // indeks pasangan yang pernah salah dipasangkan
  const [flash, setFlash] = useState(null); // { a: {side,i}, b: {side,i} }
  const [showExit, setShowExit] = useState(false);

  const options = useMemo(() => {
    if (!ex.options) return [];
    const mapped = ex.options.map((t, i) => ({ t, orig: i }));
    return ex.type === "tf" ? mapped : shuffle(mapped);
  }, [ex]);
  const rightCol = useMemo(
    () => (ex.type === "match" ? shuffle(ex.pairs.map((p, i) => ({ t: p[1], i }))) : []),
    [ex]
  );

  const finish = (result) => {
    setOk(result);
    setChecked(true);
    sfx.play(result ? "correct" : "wrong");
    onAnswered(result);
  };

  const check = () => {
    if (checked) return;
    if (ex.type === "translate") finish(ex.answers.map(normalize).includes(normalize(text)));
    else finish(options[sel].orig === ex.answer);
  };

  // Klik kartu di kolom kiri (Arab) atau kanan (arti). Klik pertama = pilih, klik kedua di sisi seberang = cocokkan.
  const clickCard = (side, i) => {
    if (checked || flash || matched[i]) return;
    if (!pick || pick.side === side) { sfx.play("tap"); setPick({ side, i }); return; }
    if (pick.i === i) {
      const next = { ...matched, [i]: true };
      setMatched(next);
      setPick(null);
      if (Object.keys(next).length !== ex.pairs.length) sfx.play("correct");
      if (Object.keys(next).length === ex.pairs.length) finish(mistakes === 0);
    } else {
      setMistakes((m) => m + 1);
      sfx.play("wrong");
      // Yang dicatat: pasangan yang pertama kali dipilih (itu yang sedang dicoba dicocokkan)
      setWrongIdx((w) => (w.includes(pick.i) ? w : [...w, pick.i]));
      setFlash({ a: pick, b: { side, i } });
      setTimeout(() => { setFlash(null); setPick(null); }, 450);
    }
  };
  const isFlash = (side, i) => !!flash && ((flash.a.side === side && flash.a.i === i) || (flash.b.side === side && flash.b.i === i));
  const isPicked = (side, i) => !!pick && pick.side === side && pick.i === i;

  const canCheck = ex.type === "translate" ? text.trim().length > 0 : sel !== null;
  const answerText =
    ex.type === "translate" ? ex.answers[0] : ex.options ? ex.options[ex.answer] : "";

  const optBtn = (active, state) => ({
    width: "100%",
    textAlign: isArabic(active) ? "right" : "left",
    direction: isArabic(active) ? "rtl" : "ltr",
    fontFamily: "inherit",
    fontSize: isArabic(active) ? 20 : 15,
    padding: "14px 16px",
    marginBottom: 10,
    borderRadius: 16,
    cursor: checked ? "default" : "pointer",
    border: "1.5px solid #e3e9e6",
    background: "white",
    color: "#1a1a1a",
    transition: "border-color .15s, background .15s",
    ...state,
  });

  const matchCardStyle = (side, i, ar) => ({
    ...s.matchCard,
    fontSize: ar ? 20 : 15,
    lineHeight: 1.5,
    ...(isPicked(side, i) ? s.matchCardSelected : {}),
    ...(matched[i] ? s.matchCardDone : {}),
    ...(isFlash(side, i) ? { borderColor: "#E0555A", background: "#fdeaea" } : {}),
  });

  const matchFx = (side, i) => fxCardClass(matched[i] ? "ok" : isFlash(side, i) ? "bad" : isPicked(side, i) ? "picked" : "idle", !!matched[i]);

  const wrongPairs = ex.type === "match" ? wrongIdx.map((i) => ex.pairs[i]) : [];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", maxWidth: 560, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <button onClick={() => setShowExit(true)} aria-label={tx("Keluar", "Leave")} style={{ background: "none", border: "none", color: "#999", cursor: "pointer", display: "flex", padding: 4 }}>
          <Icon name="x" size={22} />
        </button>
        <Bar value={((position - 1 + (checked ? 1 : 0)) / total) * 100} color={C.GREEN_DARK} height={8} />
        <span style={{ fontSize: 12, color: "#888" }}>{position}/{total}</span>
        <SoundToggle lang={lang} />
      </div>

      <div style={{ flex: 1, maxWidth: 560, width: "100%", margin: "0 auto", padding: "8px 20px 24px", boxSizing: "border-box" }}>
        <div className="ls-enter" style={{ fontWeight: 700, fontSize: 17, marginBottom: 10, color: "#1a2421" }}>{ex.prompt}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
          <Chip><Icon name="globe" size={12} /> {tx("Bahasa", "Language")}: {langName(ex.lang)}</Chip>
          <Chip bg="#fdf3dc" color="#8a6a1c"><Icon name="book" size={12} /> {tx("Materi", "Subject")}: {ex.subj}</Chip>
        </div>

        {ex.type === "reading" && (
          <div style={s.readingPassage}>
            <div dir="rtl" style={s.readingPassageText}>{ex.passage}</div>
            {ex.passageTranslation && <div style={s.readingPassageTranslation}>{ex.passageTranslation}</div>}
          </div>
        )}

        {ex.promptAr && (
          <div dir="rtl" style={{ fontSize: 26, lineHeight: 1.7, marginBottom: 20, textAlign: "right", color: "#1a1a1a" }}>
            {ex.promptAr}
          </div>
        )}

        {ex.type === "match" && (
          <>
            <div style={{ fontSize: 12, color: "#8a9692", marginBottom: 8, textAlign: "center" }}>
              {tx("Mulai dari kata Arab atau dari artinya — pilih salah satu, lalu pasangannya.", "Start from the Arabic or from the meaning — pick one, then its match.")}
            </div>
            <div style={s.matchGrid}>
              <div style={s.matchCol}>
                {ex.pairs.map((p, i) => (
                  <div key={i} role="button" className={matchFx("L", i)} dir={isArabic(p[0]) ? "rtl" : "ltr"} style={matchCardStyle("L", i, isArabic(p[0]))} onClick={() => clickCard("L", i)}>
                    {p[0]}
                  </div>
                ))}
              </div>
              <div style={s.matchCol}>
                {rightCol.map((r) => (
                  <div key={r.i} role="button" className={matchFx("R", r.i)} dir={isArabic(r.t) ? "rtl" : "ltr"} style={matchCardStyle("R", r.i, isArabic(r.t))} onClick={() => clickCard("R", r.i)}>
                    {r.t}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {ex.type === "translate" && (
          <input
            className={checked ? fxCardClass(ok ? "ok" : "bad", true) : undefined}
            style={s.lessonTextInput}
            value={text}
            disabled={checked}
            placeholder={tx("Ketik jawabanmu...", "Type your answer...")}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && canCheck && !checked) check(); }}
          />
        )}

        {options.length > 0 &&
          options.map((o, i) => {
            const chosen = sel === i;
            let st = chosen ? { borderColor: C.GREEN, background: "#f1f7f4" } : {};
            let fx = chosen && !checked ? "picked" : "idle";
            if (checked && o.orig === ex.answer) { st = { borderColor: "#6bb58a", background: "#ecf7f0" }; fx = chosen ? "ok" : "reveal"; }
            else if (checked && chosen) { st = { borderColor: "#e58a8a", background: "#fdf0ef" }; fx = "bad"; }
            return (
              <button key={i} className={fxCardClass(fx, checked)} aria-pressed={chosen} style={optBtn(o.t, st)} onClick={() => { if (checked) return; sfx.play("tap"); setSel(i); }}>
                {o.t}
              </button>
            );
          })}
      </div>

      <div style={s.lessonBottomBar}>
        <div style={s.lessonBottomInner}>
          {checked && (
            <div className={`ls-feedback ${ok ? "ls-feedback-ok" : "ls-feedback-bad"}`} role="status" aria-live="polite" style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 16, color: ok ? "#3f8f5a" : "#d0494f" }}>
                <span className="ls-feedback-icon" aria-hidden="true">{ok ? "✓" : "✕"}</span>
                {ok ? tx("Betul!", "Correct!") : ex.type === "match" ? tx("Ada yang masih keliru", "Some matches were wrong") : tx("Kurang tepat", "Not quite")}
              </div>

              {!ok && ex.type !== "match" && answerText ? (
                <div style={{ marginTop: 6, fontSize: 14, color: "#444" }}>
                  {tx("Jawaban yang tepat: ", "Correct answer: ")}
                  <b dir={isArabic(answerText) ? "rtl" : "ltr"}>{answerText}</b>
                </div>
              ) : null}

              {/* Match: tampilkan jawaban tepat HANYA untuk pasangan yang salah */}
              {!ok && ex.type === "match" && wrongPairs.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 6 }}>{tx("Pasangan yang tepat untuk yang keliru:", "The correct pairs for the ones you missed:")}</div>
                  {wrongPairs.map((p, k) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, background: "#f4f8f6", borderRadius: 10, padding: "8px 12px", marginBottom: 6, fontSize: 14 }}>
                      <span dir={isArabic(p[0]) ? "rtl" : "ltr"} style={{ fontSize: isArabic(p[0]) ? 18 : 14, fontWeight: 700, color: "#1a2421" }}>{p[0]}</span>
                      <span style={{ color: "#9aa6a1" }}>=</span>
                      <span dir={isArabic(p[1]) ? "rtl" : "ltr"} style={{ fontSize: isArabic(p[1]) ? 18 : 14 }}>{p[1]}</span>
                    </div>
                  ))}
                </div>
              )}

              {ex.explain && <div style={{ fontSize: 13, color: "#666", marginTop: 8, lineHeight: 1.5 }}>{ex.explain}</div>}
            </div>
          )}
          {!checked && ex.type !== "match" && (
            <button
              style={{ ...s.lessonMainBtn, ...(canCheck ? s.lessonBtnActive : s.lessonBtnDisabled) }}
              disabled={!canCheck}
              onClick={check}
            >
              {tx("PERIKSA", "CHECK")}
            </button>
          )}
          {!checked && ex.type === "match" && (
            <div style={{ textAlign: "center", color: "#888", fontSize: 13 }}>
              {Object.keys(matched).length}/{ex.pairs.length} {tx("pasangan cocok", "pairs matched")}
            </div>
          )}
          {checked && (
            <button style={{ ...s.lessonMainBtn, ...(ok ? s.lessonBtnActive : s.lessonBtnWrong) }} onClick={onNext}>
              {tx("LANJUTKAN", "CONTINUE")}
            </button>
          )}
        </div>
      </div>

      {/* Konfirmasi keluar — sama seperti di fitur Levantine */}
      {showExit && (
        <div style={s.modal} onClick={() => setShowExit(false)}>
          <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
              {mascot || <IconTile name="cap" C={C} size={64} />}
            </div>
            <div style={{ ...s.modalTitle, textAlign: "center" }}>{tx("Kamu yakin mau keluar?", "Are you sure you want to leave?")}</div>
            <p style={{ color: "#555", fontSize: 14, lineHeight: 1.6, marginBottom: 20, textAlign: "center" }}>
              {tx("Belajar sebentar yuk! Progresmu sampai soal ini tetap tersimpan.", "Let's study a little more! Your progress up to this question is saved.")}
            </p>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 4 }}>
              <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive }} onClick={() => setShowExit(false)}>
                {tx("Lanjutkan Pelajaran", "Continue Lesson")}
              </button>
              <button style={{ width: "100%", background: "none", border: "none", color: "#999", fontSize: 13, cursor: "pointer", padding: 8 }} onClick={() => { setShowExit(false); onExit(); }}>
                {tx("Keluar", "Leave")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Komponen utama
// ============================================================
export default function SubjectLanguage({
  supabase, contentSupabase, user, uiLang, onChangeLang, s, colors: C,
  resumeCourseId, autoResume, onResumeDone, onProgressChange, onExerciseChange, mascot,
}) {
  const tx = (idText, enText) => (uiLang === "en" ? enText : idText);
  const langName = (k) => (LANG_SKILLS[k] ? LANG_SKILLS[k][uiLang === "en" ? "en" : "id"] : k);

  const [courses, setCourses] = useState(_coursesCache);
  const [courseId, setCourseId] = useState(resumeCourseId || null);
  const course = (courses || []).find((c) => c.id === courseId) || null;
  const index = useMemo(() => (course ? indexCourse(course) : {}), [course]);

  const [view, setView] = useState(courseId ? "intro" : "feature");

  // Muat daftar course (DB -> fallback contoh), lalu pilih otomatis kalau cuma satu.
  useEffect(() => {
    let cancelled = false;
    fetchSubjectCourses(contentSupabase || supabase).then((list) => {
      if (cancelled) return;
      setCourses(list);
    });
    return () => { cancelled = true; };
  }, [supabase, contentSupabase]);
  const [sel, setSel] = useState(null); // { unitId, sectionId } untuk halaman Section
  const [openUnit, setOpenUnit] = useState(null);
  const [notice, setNotice] = useState("");
  // Pindah halaman di dalam fitur ini: langsung, tanpa layar loading.
  const nav = (label, sub, action) => { action(); };
  // Beri tahu App kapan user sedang mengerjakan soal, supaya navbar dikunci (keluar hanya lewat ✕).
  useEffect(() => {
    if (!onExerciseChange) return undefined;
    onExerciseChange(view === "exercise");
    return () => onExerciseChange(false);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps
  const [run, setRun] = useState(null);
  const [state, setState] = useState(emptyState());
  const [loaded, setLoaded] = useState(false);
  const stateRef = useRef(state);
  const saveTimer = useRef(null);
  const userId = user ? user.id : null;

  // ---------- muat progress (Supabase + localStorage, ambil yang terbaru) ----------
  useEffect(() => {
    if (!course) { setLoaded(true); return; }
    let cancelled = false;
    setLoaded(false);
    (async () => {
      let best = emptyState();
      try {
        const raw = window.localStorage.getItem(lsKey(userId, course.id));
        if (raw) best = { ...best, ...JSON.parse(raw) };
      } catch (e) { /* abaikan */ }
      if (userId) {
        try {
          const { data, error } = await supabase
            .from("user_course_progress")
            .select("state")
            .eq("user_id", userId)
            .eq("course_id", course.id)
            .maybeSingle();
          if (!error && data && data.state && (data.state.updatedAt || 0) >= (best.updatedAt || 0)) {
            best = { ...emptyState(), ...data.state };
          }
        } catch (e) { console.warn("Gagal memuat progress:", e.message); }
      }
      if (cancelled) return;
      stateRef.current = best;
      setState(best);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [course, userId, supabase]);

  // ---------- simpan progress ----------
  const persist = (next) => {
    if (!course) return;
    const ids = courseIds(course);
    const percent = pct(ids, next.done);
    try {
      window.localStorage.setItem(lsKey(userId, course.id), JSON.stringify(next));
      const sm = summarizeProgress(course, next);
      if (sm) window.localStorage.setItem(sumKey(userId), JSON.stringify(sm));
    } catch (e) { /* storage penuh/diblokir */ }
    if (onProgressChange) onProgressChange();
    if (!userId) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const p = next.pos || {};
      const { error } = await supabase.from("user_course_progress").upsert(
        {
          user_id: userId,
          course_id: course.id,
          current_unit_id: p.unitId || null,
          current_section_id: p.sectionId || null,
          current_lesson_id: p.lessonId || null,
          current_exercise_id: p.exerciseId || null,
          progress_percentage: percent,
          last_accessed_at: new Date().toISOString(),
          state: next,
        },
        { onConflict: "user_id,course_id" }
      );
      if (error) console.warn("Gagal menyimpan progress:", error.message);
    }, 800);
  };
  const commit = (fn) => {
    const next = { ...fn(stateRef.current), updatedAt: Date.now() };
    stateRef.current = next;
    setState(next);
    persist(next);
  };
  useEffect(() => () => clearTimeout(saveTimer.current), []);

  // ---------- turunan ----------
  const allIds = course ? courseIds(course) : [];
  const overall = pct(allIds, state.done);
  const hasProgress = !!state.pos;
  const today = todayStr();
  const dueItems = Object.entries(state.review).filter(([id, it]) => it.due <= today && index[id]);
  const dueByCat = Object.keys(REVIEW_CATEGORIES).reduce((acc, k) => {
    acc[k] = dueItems.filter(([, it]) => it.cat === k).length;
    return acc;
  }, {});

  // Kosakata, kata kerja, kata/kalimat asing digabung jadi satu kelompok review "Kosakata".
  const vocabDue = dueItems.filter(([, it]) => it.cat === "vocabulary" || it.cat === "academic");

  const unitStatuses = course ? statusList(course.units, (u) => allDone(unitIds(u), state.done), state.mode) : [];

  // ---------- mulai sesi latihan ----------
  const startLesson = (unitId, sectionId, lessonId, exerciseId) => {
    const lesson = course.units.find((u) => u.id === unitId).sections.find((x) => x.id === sectionId).lessons.find((l) => l.id === lessonId);
    const list = lesson.exercises;
    let idx = exerciseId ? list.findIndex((e) => e.id === exerciseId) : list.findIndex((e) => !state.done[e.id]);
    if (idx < 0) idx = 0;
    setRun({ mode: "lesson", ctx: { unitId, sectionId, lessonId }, list, idx, correct: 0, answered: 0, xp: 0 });
    setView("exercise");
  };

  const continueLearning = () => {
    if (!course) return;
    if (allDone(allIds, state.done)) { setView("path"); return; }
    const pos = resolvePos(course, state, index);
    if (!pos) { setView("path"); return; }
    // Kalau soal di posisi tersimpan sudah selesai, lompat ke soal belum selesai berikutnya.
    const exId = state.done[pos.exerciseId] ? allIds.find((id) => !state.done[id]) || pos.exerciseId : pos.exerciseId;
    const m = index[exId];
    startLesson(m.unitId, m.sectionId, m.lessonId, exId);
  };

  const startReview = () => {
    const list = shuffle(dueItems).slice(0, 20).map(([id]) => index[id].ex);
    if (list.length === 0) return;
    setRun({ mode: "review", ctx: null, list, idx: 0, correct: 0, answered: 0, xp: 0 });
    setView("exercise");
  };

  // Auto-resume dari kartu Home: langsung ke soal terakhir.
  useEffect(() => {
    if (!autoResume || !loaded || !course) return;
    if (onResumeDone) onResumeDone();
    if (state.pos) nav(tx("Melanjutkan belajar...", "Resuming your lesson..."), tx("Membuka soal terakhirmu", "Opening your last question"), continueLearning);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResume, loaded, course]);

  // Simpan posisi tiap kali soal baru ditampilkan (mode lesson saja).
  useEffect(() => {
    if (view !== "exercise" || !run || run.mode !== "lesson") return;
    const ex = run.list[run.idx];
    if (!ex) return;
    commit((st) => ({ ...st, pos: { ...run.ctx, exerciseId: ex.id } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, run && run.idx, run && run.mode]);

  // ---------- jawaban ----------
  const handleAnswered = (ok) => {
    const ex = run.list[run.idx];
    commit((st) => {
      const prev = st.answers[ex.id] || { attempts: 0, correct: 0, last: null };
      const bump = (bucket, key) => {
        const cur = (bucket[key] || { c: 0, t: 0 });
        return { ...bucket, [key]: { c: cur.c + (ok ? 1 : 0), t: cur.t + 1 } };
      };
      // streak harian
      let streak = st.streak;
      if (streak.last !== today) {
        const yesterday = addDays(today, -1);
        streak = { count: streak.last === yesterday ? streak.count + 1 : 1, last: today };
      }
      // review (spaced repetition / Leitner)
      const review = { ...st.review };
      const cur = review[ex.id];
      if (!ok) review[ex.id] = { cat: ex.category, focus: ex.focus, box: 0, due: today };
      else if (cur && run.mode === "review") {
        const box = Math.min(cur.box + 1, INTERVALS.length - 1);
        review[ex.id] = { ...cur, box, due: addDays(today, INTERVALS[box]) };
      }
      return {
        ...st,
        done: run.mode === "lesson" ? { ...st.done, [ex.id]: true } : st.done,
        answers: { ...st.answers, [ex.id]: { attempts: prev.attempts + 1, correct: prev.correct + (ok ? 1 : 0), last: ok } },
        skills: { language: bump(st.skills.language, ex.lang), subject: bump(st.skills.subject, ex.subj) },
        review,
        xp: st.xp + (ok ? XP_CORRECT : 0),
        streak,
      };
    });
    setRun((r) => ({ ...r, correct: r.correct + (ok ? 1 : 0), answered: r.answered + 1, xp: r.xp + (ok ? XP_CORRECT : 0) }));
  };

  const handleNext = () => {
    if (run.idx + 1 < run.list.length) {
      setRun((r) => ({ ...r, idx: r.idx + 1 }));
      return;
    }
    if (run.mode === "lesson") {
      // Geser posisi ke lesson berikutnya supaya "Lanjutkan" benar.
      const fl = flatLessons(course);
      const at = fl.findIndex((x) => x.lesson.id === run.ctx.lessonId);
      const nxt = fl[at + 1];
      if (nxt) {
        const firstEx = nxt.lesson.exercises.find((e) => !stateRef.current.done[e.id]) || nxt.lesson.exercises[0];
        commit((st) => ({ ...st, pos: { unitId: nxt.unit.id, sectionId: nxt.section.id, lessonId: nxt.lesson.id, exerciseId: firstEx.id } }));
      }
    }
    setView("result");
  };

  const exitRun = () => {
    const toSection = run && run.mode === "lesson" && run.ctx;
    nav(tx("Menyimpan progresmu...", "Saving your progress..."), tx("Kamu bisa lanjut kapan saja", "You can continue any time"), () => {
      if (toSection) setSel({ unitId: run.ctx.unitId, sectionId: run.ctx.sectionId });
      setView(toSection ? "section" : "path");
    });
  };

  const setMode = (mode) => commit((st) => ({ ...st, mode }));

  // ============================================================
  // RENDER
  // ============================================================
  if (!courses) {
    return <LoadingScreen C={C} label={tx("Memuat Subject Language...", "Loading Subject Language...")} sub={tx("Mengambil daftar mata pelajaran", "Fetching the subject list")} />;
  }

  // Pilihan bahasa — sama seperti di fitur Levantine (pakai style yang sama).
  const langSelect = () => <LangSwitch uiLang={uiLang} onChange={onChangeLang} s={s} title="Choose your language" />;

  // Nama skill materi dalam bahasa yang dipilih (kunci statistik tetap teks Indonesia).
  const subjLabel = (k) => {
    if (uiLang !== "en") return k;
    const hit = Object.values(index).find((m) => m.ex.subj === k && m.ex.en && m.ex.en.subj);
    return hit ? hit.ex.en.subj : k;
  };

  const Header = ({ title, subtitle, onBack }) => (
    <div style={s.ammiyahHeader}>
      {onBack && <button style={s.ammiyahBackBtn} onClick={onBack}>‹</button>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.ammiyahTitle}>{title}</div>
        {subtitle && <div style={s.ammiyahSubtitle}>{subtitle}</div>}
      </div>
      {langSelect()}
    </div>
  );

  const statChips = course && loaded && (
    <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
      <Chip bg="#fff4d6" color="#8a6a1c"><Icon name="bolt" size={13} /> {state.xp} XP</Chip>
      <Chip bg="#ffe9e0" color="#a8481f"><Icon name="flame" size={13} /> {state.streak.count} {tx("hari", "day streak")}</Chip>
    </div>
  );

  const card = s.card || { background: "white", border: "1px solid #e9eeec", borderRadius: 18, padding: "16px 18px", marginBottom: 14, boxShadow: "0 1px 2px rgba(20,40,30,0.04), 0 6px 20px rgba(20,40,30,0.04)" };

  // ---- halaman 1: keterangan fitur (belum pilih subject) ----
  if (view === "feature") {
    const benefits = [
      ["book", tx("Kosakata Mata Pelajaran", "Subject Vocabulary"), tx("Istilah penting yang sering muncul dalam materi.", "Key terms that often appear in the material.")],
      ["cap", tx("Bahasa Akademik", "Academic Language"), tx("Frasa dan pola bahasa yang dipakai dalam buku.", "Phrases and patterns used in textbooks.")],
      ["doc", tx("Bahasa Ujian", "Exam Language"), tx("Pola pertanyaan yang sering muncul di ujian.", "Question patterns common in exams.")],
      ["layers", tx("Pemahaman Konteks", "Context Understanding"), tx("Memahami kata dari penggunaannya dalam kalimat.", "Understand words from how they are used.")],
      ["target", tx("Latihan Ujian", "Exam Practice"), tx("Latihan berdasarkan materi mata pelajaran.", "Practice based on the course material.")],
    ];
    const steps = [
      tx("Pilih mata pelajaran yang ingin kamu pelajari.", "Pick the subject you want to study."),
      tx("Belajar kosakata, bahasa akademik, dan pola soal ujian per unit.", "Learn vocabulary, academic language, and exam patterns unit by unit."),
      tx("Pantau progres dan ulangi materi yang masih sering salah.", "Track your progress and revisit what you still get wrong."),
    ];
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 20px 72px" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 22 }}>{langSelect()}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <IconTile name="cap" C={C} size={58} solid />
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.4, color: C.GREEN_DARK, fontWeight: 800 }}>SUBJECT LANGUAGE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#1a2421", lineHeight: 1.25, marginTop: 2 }}>
              {tx("Pahami bahasa mata pelajaranmu", "Understand the language of your subject")}
            </div>
          </div>
        </div>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "#55625d", margin: "0 0 26px" }}>
          {tx(
            "Pelajari bahasa yang dipakai dalam buku dan ujian mata pelajaranmu, supaya bahasa tidak lagi jadi penghalang saat memahami materi dan mengerjakan ujian.",
            "Learn the language used in your subject's textbooks and exams, so language is no longer a barrier to understanding the material and sitting the exam."
          )}
        </p>

        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#8a9692", marginBottom: 10 }}>{tx("YANG AKAN KAMU DAPATKAN", "WHAT YOU'LL GET")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginBottom: 28 }}>
          {benefits.map(([icon, title, desc]) => (
            <div key={title} style={{ ...card, marginBottom: 0, padding: "14px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <IconTile name={icon} C={C} size={38} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2421" }}>{title}</div>
                <div style={{ fontSize: 12.5, color: "#7a8782", lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#8a9692", marginBottom: 12 }}>{tx("CARA BELAJARNYA", "HOW IT WORKS")}</div>
        <div style={{ marginBottom: 30 }}>
          {steps.map((st, i) => (
            <div key={i} style={{ display: "flex", gap: 14, position: "relative", paddingBottom: i < steps.length - 1 ? 18 : 0 }}>
              {i < steps.length - 1 && <div style={{ position: "absolute", left: 13, top: 30, bottom: 0, width: 2, background: "#e1ece7" }} />}
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.GREEN_DARK, color: "white", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ fontSize: 14, color: "#3c4945", lineHeight: 1.55, paddingTop: 3 }}>{st}</div>
            </div>
          ))}
        </div>

        <button
          style={{ ...s.introCta, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={() => nav(tx("Memuat daftar mata pelajaran...", "Loading subjects..."), tx("Menyiapkan pilihan subject untukmu", "Getting the available subjects ready"), () => setView("courses"))}
        >
          {tx("PILIH MATA PELAJARAN", "CHOOSE A SUBJECT")} <Icon name="chevron" size={18} stroke={2.4} />
        </button>
      </div>
    );
  }

  // ---- halaman 2: pilih mata pelajaran ----
  if (view === "courses" || !course) {
    if (courses.length === 0) {
      return <div style={{ ...s.ammiyahPage, textAlign: "center", color: "#888" }}>{tx("Belum ada course.", "No courses yet.")}</div>;
    }
    return (
      <div style={s.ammiyahPage}>
        <Header title={tx("Pilih Mata Pelajaran", "Choose a Subject")} subtitle={tx(`${courses.length} subject tersedia`, `${courses.length} subject${courses.length > 1 ? "s" : ""} available`)} onBack={() => nav(tx("Kembali...", "Going back..."), "", () => setView("feature"))} />
        {courses.map((c) => (
          <div
            key={c.id}
            style={{ ...card, cursor: "pointer", padding: 0, overflow: "hidden", transition: "transform .15s, box-shadow .15s" }}
            onClick={() => nav(tx("Membuka mata pelajaran...", "Opening subject..."), c.title, () => { setCourseId(c.id); setView("intro"); })}
          >
            {c.titleAr && (
              <div dir="rtl" lang="ar" style={{ background: "linear-gradient(135deg, #eaf3ef, #f5faf8)", padding: "18px 20px 14px", fontSize: 26, fontWeight: 700, color: C.GREEN_DARK, lineHeight: 1.5, textAlign: "right" }}>
                {c.titleAr}
              </div>
            )}
            <div style={{ padding: "14px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#1a2421" }}>{c.title}</div>
                <div style={{ color: "#7a8782", fontSize: 13, lineHeight: 1.5, marginTop: 4 }}>{c.description}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  <Chip><Icon name="globe" size={12} /> {c.language}</Chip>
                  <Chip><Icon name="grid" size={12} /> {c.units.length} Unit</Chip>
                  <Chip><Icon name="clock" size={12} /> {c.duration}</Chip>
                  <Chip bg="#fdf3dc" color="#8a6a1c">{c.difficulty}</Chip>
                </div>
              </div>
              <span style={{ color: "#b5c2bc" }}><Icon name="chevron" size={22} /></span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---- pengenalan course ----
  if (view === "intro") {
    const sectionCount = course.units.reduce((n, u) => n + u.sections.length, 0);
    const facts = [
      [tx("Mata pelajaran", "Subject"), course.subject],
      [tx("Bahasa materi", "Material language"), course.language],
      [tx("Durasi", "Duration"), course.duration],
      [tx("Tingkat kesulitan", "Difficulty"), course.difficulty],
      [tx("Jumlah Unit", "Units"), course.units.length],
      [tx("Jumlah Section", "Sections"), sectionCount],
    ];
    const sm = hasProgress ? summarizeProgress(course, state, uiLang) : null;
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "22px 20px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button style={s.ammiyahBackBtn} onClick={() => nav(tx("Kembali...", "Going back..."), "", () => setView("courses"))} aria-label={tx("Kembali", "Back")}>‹</button>
          {langSelect()}
        </div>

        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><IconTile name="cap" C={C} size={60} solid /></div>
          {course.titleAr && (
            <div dir="rtl" lang="ar" style={{ fontSize: 30, fontWeight: 700, color: C.GREEN_DARK, lineHeight: 1.5, marginBottom: 2 }}>{course.titleAr}</div>
          )}
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2421", lineHeight: 1.3 }}>{course.title}</div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: "#6a7772", marginTop: 8 }}>
            {tx(
              `Pelajari kosakata, istilah akademik, dan bahasa ujian yang digunakan dalam materi ${course.subject}.`,
              `Learn the vocabulary, academic terms, and exam language used in ${course.subject} material.`
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          {facts.map(([k, v]) => (
            <div key={k} style={{ ...card, marginBottom: 0, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: "#8a9692" }}>{k}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#1a2421", marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>

        {sm && (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 14 }}>
            <IconTile name="play" C={C} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#8a9692" }}>{tx("Terakhir dipelajari", "Last studied")}</div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{sm.unitLabel}</div>
              <div style={{ fontSize: 12.5, color: "#7a8782", marginBottom: 8 }}>Section: {sm.sectionTitle}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Bar value={overall} color={C.GREEN_DARK} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{overall}%</span>
              </div>
            </div>
          </div>
        )}

        <button
          style={{ ...s.introCta, marginTop: 8, opacity: loaded ? 1 : 0.6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          disabled={!loaded}
          onClick={() => (hasProgress
            ? nav(tx("Menyiapkan soal terakhirmu...", "Getting your last question ready..."), tx("Kamu akan lanjut tepat di tempat terakhir berhenti", "You'll pick up exactly where you left off"), continueLearning)
            : nav(tx("Memuat learning path...", "Loading learning path..."), tx("Menyusun unit dan section untukmu", "Putting your units and sections together"), () => setView("path")))}
        >
          {!loaded ? tx("MEMUAT PROGRES...", "LOADING PROGRESS...") : hasProgress ? tx("LANJUTKAN BELAJAR", "CONTINUE LEARNING") : tx("MULAI BELAJAR", "START LEARNING")}
          {loaded && <Icon name="chevron" size={18} stroke={2.4} />}
        </button>
        {hasProgress && (
          <button style={{ width: "100%", background: "none", border: "none", color: C.GREEN_DARK, marginTop: 12, cursor: "pointer", fontSize: 14, fontWeight: 600 }} onClick={() => nav(tx("Memuat learning path...", "Loading learning path..."), tx("Menyusun unit dan section untukmu", "Putting your units and sections together"), () => setView("path"))}>
            {tx("Lihat Learning Path", "View Learning Path")}
          </button>
        )}
      </div>
    );
  }

  // ---- learning path ----
  if (view === "path") {
    const total = (obj) => Object.values(obj).reduce((a, v) => ({ c: a.c + v.c, t: a.t + v.t }), { c: 0, t: 0 });
    const langT = total(state.skills.language);
    const subjT = total(state.skills.subject);
    const langPct = langT.t ? Math.round((langT.c / langT.t) * 100) : null;
    const subjPct = subjT.t ? Math.round((subjT.c / subjT.t) * 100) : null;
    let diagnosis = "";
    if (langPct !== null && subjPct !== null && langT.t >= 5) {
      if (langPct + 10 < subjPct) diagnosis = tx("Kesalahanmu lebih sering di BAHASA daripada di materi — perbanyak latihan kosakata & bahasa ujian.", "You miss more on LANGUAGE than on the subject itself — practise more vocabulary and exam language.");
      else if (subjPct + 10 < langPct) diagnosis = tx("Bahasamu sudah baik, tapi pemahaman MATERI masih perlu diperkuat.", "Your language is solid, but your SUBJECT understanding needs more work.");
      else diagnosis = tx("Bahasa dan pemahaman materimu seimbang. Pertahankan!", "Your language and subject understanding are balanced. Keep it up!");
    }
    const modes = [["hybrid", "Hybrid"], ["sequential", "Sequential"], ["free", tx("Bebas", "Free")]];
    const statusIcon = { completed: <Icon name="check" size={16} stroke={2.6} />, current: <Icon name="play" size={13} fill="currentColor" stroke={1} />, available: <span style={{ width: 8, height: 8, borderRadius: "50%", border: "2px solid currentColor", display: "inline-block" }} />, locked: <Icon name="lock" size={14} /> };
    const statusColor = { completed: C.GREEN_DARK, current: "#3B9DE8", available: "#888", locked: "#bbb" };
    const reviewTotal = dueItems.length;

    return (
      <div style={s.ammiyahPage}>
        <Header
          title={`${course.title} — ${course.language}`}
          subtitle={`Progress: ${overall}%`}
          onBack={() => nav(tx("Kembali...", "Going back..."), "", () => setView("intro"))}
        />

        {statChips}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <Bar value={overall} color={C.GREEN} height={10} />
            <b>{overall}%</b>
          </div>
          {hasProgress && !allDone(allIds, state.done) && (
            <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive }} onClick={() => nav(tx("Menyiapkan soal terakhirmu...", "Getting your last question ready..."), "", continueLearning)}>
              {tx("LANJUTKAN", "CONTINUE")}
            </button>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{tx("Mode:", "Mode:")}</span>
            {modes.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                style={{ border: "1px solid " + (state.mode === k ? C.GREEN : "#ddd"), background: state.mode === k ? C.GREEN_BG : "white", color: "#333", borderRadius: 999, padding: "4px 12px", fontSize: 12, cursor: "pointer" }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {notice && (
          <div style={{ background: "#fff4d6", border: "1px solid #f0d98a", color: "#7a5b10", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>
            {notice}
          </div>
        )}

        {course.units.map((u, ui) => {
          const status = unitStatuses[ui];
          const ids = unitIds(u);
          const isOpen = (openUnit === null ? status === "current" : openUnit === u.id);
          const secStatuses = statusList(u.sections, (x) => allDone(sectionIds(x), state.done), state.mode);
          return (
            <div key={u.id} style={{ ...card, opacity: status === "locked" ? 0.6 : 1, padding: 0, overflow: "hidden" }}>
              <div
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", cursor: "pointer" }}
                onClick={() => {
                  if (status === "locked") {
                    setNotice(tx(`Selesaikan unit sebelumnya dulu, atau ubah mode ke "Bebas".`, `Finish the previous unit first, or switch the mode to "Free".`));
                    return;
                  }
                  setNotice("");
                  setOpenUnit(isOpen ? "" : u.id);
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${statusColor[status]}`, color: statusColor[status], fontWeight: "bold", flexShrink: 0 }}>
                  {statusIcon[status]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "bold" }}>Unit {ui + 1}</div>
                  <div style={{ fontSize: 13, color: "#666" }}>{titleOf(u, uiLang)}</div>
                  {status === "current" && <div style={{ fontSize: 11, color: "#3B9DE8", fontWeight: "bold", marginTop: 2 }}>{tx("SEDANG DIPELAJARI", "IN PROGRESS")}</div>}
                </div>
                <span style={{ fontSize: 12, color: "#888" }}>{pct(ids, state.done)}%</span>
              </div>
              {isOpen && (
                <div style={{ borderTop: "1px solid #eee", background: "#fafafa", padding: "6px 18px 10px" }}>
                  {u.sections.map((sec, si) => {
                    const ss = status === "locked" ? "locked" : secStatuses[si];
                    return (
                      <div
                        key={sec.id}
                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", cursor: "pointer", opacity: ss === "locked" ? 0.55 : 1 }}
                        onClick={() => {
                          if (ss === "locked") {
                            setNotice(tx(`Section ini masih terkunci pada mode ${state.mode}. Ubah mode ke "Bebas" untuk membuka.`, `This section is locked in ${state.mode} mode. Switch to "Free" to open it.`));
                            return;
                          }
                          setNotice("");
                          nav(tx("Membuka section...", "Opening section..."), titleOf(sec, uiLang), () => {
                            setSel({ unitId: u.id, sectionId: sec.id });
                            setView("section");
                          });
                        }}
                      >
                        <span style={{ width: 20, display: "inline-flex", justifyContent: "center", color: statusColor[ss] }}>{statusIcon[ss]}</span>
                        <span style={{ flex: 1, fontSize: 14 }}>{titleOf(sec, uiLang)}</span>
                        <span style={{ fontSize: 12, color: "#888" }}>{pct(sectionIds(sec), state.done)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Review */}
        <div style={card}>
          <div style={{ fontWeight: "bold", marginBottom: 8 }}>{tx("Review Hari Ini", "Today's Review")}</div>
          {reviewTotal === 0 ? (
            <div style={{ fontSize: 13, color: "#888" }}>{tx("Belum ada yang perlu di-review. Soal yang salah akan muncul di sini.", "Nothing to review yet. Questions you miss will show up here.")}</div>
          ) : (
            <>
              {vocabDue.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 14, marginBottom: 4 }}><b>{vocabDue.length}</b> {tx("Kosakata", "Vocabulary")}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[["verb", "Kata kerja", "Verbs"], ["word", "Kosakata asing", "Unfamiliar words"], ["sentence", "Kalimat asing", "Unfamiliar sentences"]].map(([f, a, b]) => {
                      const n = vocabDue.filter(([, it]) => it.focus === f).length;
                      return n > 0 && <span key={f} style={{ fontSize: 12, background: "#f1f5f3", border: "1px solid #e3e9e6", borderRadius: 999, padding: "3px 10px", color: "#3d4742" }}>{n} {tx(a, b)}</span>;
                    })}
                  </div>
                </div>
              )}
              {["exam", "question"].map((k) => dueByCat[k] > 0 && (
                <div key={k} style={{ fontSize: 14, marginBottom: 4 }}>
                  <b>{dueByCat[k]}</b> {REVIEW_CATEGORIES[k][uiLang === "en" ? "en" : "id"]}
                </div>
              ))}
              <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive, marginTop: 10 }} onClick={() => nav(tx("Menyiapkan review...", "Preparing your review..."), tx("Mengambil soal yang perlu diulang", "Picking the questions to revisit"), startReview)}>
                {tx("MULAI REVIEW", "START REVIEW")}
              </button>
            </>
          )}
        </div>

        {/* Performa: bahasa vs materi dipisah */}
        <div style={card}>
          <div style={{ fontWeight: "bold", marginBottom: 10 }}>{tx("Performa Bahasa", "Language Performance")}</div>
          {Object.keys(LANG_SKILLS).map((k) => {
            const v = state.skills.language[k];
            const p = v && v.t ? Math.round((v.c / v.t) * 100) : null;
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13 }}>
                <span style={{ width: 130 }}>{langName(k)}</span>
                <Bar value={p || 0} color={C.GREEN} />
                <span style={{ width: 38, textAlign: "right", color: "#666" }}>{p === null ? "—" : `${p}%`}</span>
              </div>
            );
          })}
          <div style={{ fontWeight: "bold", margin: "14px 0 10px" }}>{tx("Pemahaman Materi", "Subject Knowledge")}</div>
          {Object.keys(state.skills.subject).length === 0 && <div style={{ fontSize: 13, color: "#888" }}>—</div>}
          {Object.entries(state.skills.subject).map(([k, v]) => {
            const p = Math.round((v.c / v.t) * 100);
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, fontSize: 13 }}>
                <span style={{ width: 130 }}>{subjLabel(k)}</span>
                <Bar value={p} color="#E0B23D" />
                <span style={{ width: 38, textAlign: "right", color: "#666" }}>{p}%</span>
              </div>
            );
          })}
          {diagnosis && <div style={{ marginTop: 12, fontSize: 13, color: "#555", background: "#f5f8f7", padding: "10px 12px", borderRadius: 10 }}>{diagnosis}</div>}
        </div>
      </div>
    );
  }

  // ---- halaman section ----
  if (view === "section" && sel) {
    const unit = course.units.find((u) => u.id === sel.unitId);
    const section = unit.sections.find((x) => x.id === sel.sectionId);
    const ui = course.units.indexOf(unit) + 1;
    const sp = pct(sectionIds(section), state.done);
    return (
      <div style={s.ammiyahPage}>
        <Header title={`Unit ${ui} — ${titleOf(unit, uiLang)}`} subtitle={`Section: ${titleOf(section, uiLang)}`} onBack={() => nav(tx("Kembali ke learning path...", "Back to learning path..."), "", () => setView("path"))} />
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Bar value={sp} color={C.GREEN} height={10} />
            <b>{sp}%</b>
          </div>
        </div>
        {section.lessons.map((l, li) => {
          const kind = LESSON_KINDS[l.kind] || { id: l.kind, en: l.kind, icon: "•" };
          const ids = lessonIds(l);
          const d = countDone(ids, state.done);
          const finished = d === ids.length;
          return (
            <div
              key={l.id}
              style={{ ...card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
              onClick={() => nav(tx("Menyiapkan soal...", "Preparing exercises..."), kind[uiLang === "en" ? "en" : "id"], () => startLesson(unit.id, section.id, l.id))}
            >
              <IconTile name={KIND_ICON[l.kind] || "book"} C={C} size={44} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold" }}>{li + 1}. {kind[uiLang === "en" ? "en" : "id"]}</div>
                <div style={{ fontSize: 12, color: "#888" }}>{d}/{ids.length} {tx("soal", "exercises")}</div>
              </div>
              <span style={{ color: finished ? C.GREEN_DARK : "#b5c2bc", display: "flex" }}><Icon name={finished ? "check" : "chevron"} size={20} stroke={finished ? 2.6 : 1.8} /></span>
            </div>
          );
        })}
      </div>
    );
  }

  // ---- mengerjakan soal ----
  if (view === "exercise" && run) {
    const ex = run.list[run.idx];
    if (!ex) return null;
    return (
      <ExerciseView
        key={ex.id + ":" + run.idx}
        ex={ex}
        lang={uiLang}
        s={s}
        C={C}
        tx={tx}
        langName={langName}
        position={run.idx + 1}
        total={run.list.length}
        onAnswered={handleAnswered}
        onNext={handleNext}
        onExit={exitRun}
        mascot={mascot}
      />
    );
  }

  // ---- hasil sesi ----
  if (view === "result" && run) {
    const finishedCourse = allDone(allIds, state.done);
    const acc = run.answered ? Math.round((run.correct / run.answered) * 100) : 0;
    const missed = run.answered - run.correct;
    const title = run.mode === "review" ? tx("Review selesai", "Review complete") : finishedCourse ? tx("Course selesai", "Course complete") : tx("Lesson selesai", "Lesson complete");
    const msg = acc >= 90 ? tx("Hasil yang luar biasa. Pertahankan!", "Excellent work. Keep it up!")
      : acc >= 70 ? tx("Bagus! Sedikit lagi sempurna.", "Nice! Almost perfect.")
      : tx("Tidak apa-apa. Soal yang salah masuk ke Review supaya mudah diulang.", "No worries. Missed questions go to Review so you can revisit them.");
    const stat = (label, value, tone) => (
      <div style={{ flex: 1, background: tone || "#f4f8f6", borderRadius: 14, padding: "12px 6px" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1a2421" }}>{value}</div>
        <div style={{ fontSize: 11, color: "#7a8782", marginTop: 2 }}>{label}</div>
      </div>
    );
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, boxSizing: "border-box" }}>
        <div style={{ ...card, width: "100%", maxWidth: 400, boxSizing: "border-box", textAlign: "center", padding: "34px 24px 26px", marginBottom: 0 }}>
          <Ring value={acc} C={C} />
          <div style={{ marginTop: 10 }}><Celebrate acc={acc} /></div>
          <div className="ls-enter" style={{ fontSize: 22, fontWeight: 800, color: "#1a2421", marginTop: 8 }}>{title}</div>
          <div style={{ fontSize: 13.5, color: "#6a7772", lineHeight: 1.6, margin: "6px auto 20px", maxWidth: 290 }}>{msg}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {stat(tx("Benar", "Correct"), <><CountUp to={run.correct} />/{run.answered}</>)}
            {stat("XP", <CountUp to={run.xp} prefix="+" />, "#fff4d6")}
            {stat(tx("Ke Review", "To review"), missed, missed ? "#fdeceb" : undefined)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {run.mode === "lesson" && !finishedCourse && (
              <button style={{ ...s.lessonMainBtn, ...s.lessonBtnActive }} onClick={() => nav(tx("Menyiapkan soal berikutnya...", "Getting the next question ready..."), "", continueLearning)}>
                {tx("LANJUTKAN", "CONTINUE")}
              </button>
            )}
            <button
              style={{ ...s.lessonMainBtn, ...(run.mode === "lesson" && !finishedCourse ? { background: "#eef2f0", color: "#4a5753", boxShadow: "none" } : s.lessonBtnActive) }}
              onClick={() => nav(tx("Memuat learning path...", "Loading learning path..."), tx("Memperbarui progresmu", "Updating your progress"), () => setView("path"))}
            >
              LEARNING PATH
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
