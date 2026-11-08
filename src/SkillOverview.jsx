// src/SkillOverview.jsx
// Ringkasan "Pemahaman" Subject Language: gambaran besar (2 cincin + area yang perlu diulang),
// rincian per-skill disembunyikan di <details> supaya halaman tidak memanjang.
//
// Props:
//   skills     : state.skills  ({ language: {k:{c,t}}, subject: {k:{c,t}} })
//   langKeys   : Object.keys(LANG_SKILLS)
//   langName   : (k) => label skill bahasa
//   subjLabel  : (k) => label skill materi
//   tx         : (id, en) => teks sesuai bahasa UI
//   C          : palet warna (C.GREEN, C.GREEN_DARK)
//   diagnosis  : teks diagnosis (opsional)
import React from "react";

const pctOf = (v) => (v && v.t ? Math.round((v.c / v.t) * 100) : null);
const sum = (obj) => Object.values(obj || {}).reduce((a, v) => ({ c: a.c + v.c, t: a.t + v.t }), { c: 0, t: 0 });

function MiniRing({ value, color, label, size = 84 }) {
  const r = 34, circ = 2 * Math.PI * r, p = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
      <svg width={size} height={size} viewBox="0 0 84 84" role="img" aria-label={`${label} ${value === null ? "-" : value + "%"}`}>
        <circle cx="42" cy="42" r={r} fill="none" stroke="#edf1ef" strokeWidth="9" />
        <circle cx="42" cy="42" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(p / 100) * circ} ${circ}`} transform="rotate(-90 42 42)" style={{ transition: "stroke-dasharray 0.5s ease" }} />
        <text x="42" y="47" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1a2421">{value === null ? "—" : `${value}%`}</text>
      </svg>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#3d4742" }}>{label}</div>
    </div>
  );
}

function Row({ label, p, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12.5 }}>
      <span style={{ flex: "0 0 44%", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: "#edf1ef", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${p}%`, height: "100%", background: p < 70 ? "#e58a7e" : color }} />
      </div>
      <span style={{ width: 34, textAlign: "right", color: "#666" }}>{p}%</span>
    </div>
  );
}

export default function SkillOverview({ skills, langKeys, langName, subjLabel, tx, C, diagnosis }) {
  const lang = skills.language || {}, subj = skills.subject || {};
  const lt = sum(lang), st = sum(subj);
  const langP = lt.t ? Math.round((lt.c / lt.t) * 100) : null;
  const subjP = st.t ? Math.round((st.c / st.t) * 100) : null;
  const any = lt.t + st.t > 0;

  // Area lemah gabungan (bahasa + materi): minimal 2 percobaan, di bawah 70%, 4 terlemah.
  const weak = [
    ...langKeys.map((k) => ({ kind: "lang", label: langName(k), p: pctOf(lang[k]), t: lang[k] ? lang[k].t : 0 })),
    ...Object.keys(subj).map((k) => ({ kind: "subj", label: subjLabel(k), p: pctOf(subj[k]), t: subj[k].t })),
  ].filter((x) => x.p !== null && x.t >= 2 && x.p < 70).sort((a, b) => a.p - b.p).slice(0, 4);

  const subjRows = Object.entries(subj).map(([k, v]) => ({ k, p: pctOf(v) })).sort((a, b) => a.p - b.p);

  return (
    <div style={{ background: "white", border: "1px solid #e3e9e6", borderRadius: 16, padding: 16, marginBottom: 14 }}>
      <div style={{ fontWeight: "bold", marginBottom: 12 }}>{tx("Ringkasan Pemahaman", "Understanding Overview")}</div>

      <div style={{ display: "flex", gap: 10 }}>
        <MiniRing value={langP} color={C.GREEN} label={tx("Bahasa", "Language")} />
        <MiniRing value={subjP} color="#E0B23D" label={tx("Materi", "Subject")} />
      </div>

      <div style={{ marginTop: 14 }}>
        {!any ? (
          <div style={{ fontSize: 13, color: "#888" }}>{tx("Mulai belajar untuk melihat ringkasanmu.", "Start learning to see your overview.")}</div>
        ) : weak.length === 0 ? (
          <div style={{ fontSize: 13, color: "#4b6b60" }}>{tx("Belum ada area yang lemah. Pertahankan!", "No weak areas so far. Keep it up!")}</div>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#b3382c", marginBottom: 6 }}>{tx("Perlu diulang", "Needs review")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {weak.map((w) => (
                <span key={w.kind + w.label} style={{ fontSize: 12, background: "#fdeceb", border: "1px solid #f3d2ce", color: "#7a2f27", borderRadius: 999, padding: "4px 10px" }}>
                  {w.label} · {w.p}%
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {any && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, color: "#4b6b60", fontWeight: 600 }}>{tx("Lihat rincian", "See details")}</summary>
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#666", marginBottom: 6 }}>{tx("Bahasa", "Language")}</div>
            {langKeys.map((k) => { const p = pctOf(lang[k]); return p === null ? null : <Row key={k} label={langName(k)} p={p} color={C.GREEN} />; })}
            {subjRows.length > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#666", margin: "10px 0 6px" }}>{tx("Materi (terlemah dulu)", "Subject (weakest first)")}</div>}
            {subjRows.map(({ k, p }) => <Row key={k} label={subjLabel(k)} p={p} color="#E0B23D" />)}
          </div>
        </details>
      )}

      {diagnosis && <div style={{ marginTop: 12, fontSize: 13, color: "#555", background: "#f5f8f7", padding: "10px 12px", borderRadius: 10 }}>{diagnosis}</div>}
    </div>
  );
}
