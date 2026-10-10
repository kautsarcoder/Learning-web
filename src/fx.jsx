// fx.jsx — sistem microinteraction bersama untuk Levantine & Subject Language.
// Murni CSS keyframes + WebAudio (tanpa library baru). Semua efek:
//   - singkat (100–350 ms), hanya memakai transform/opacity (ringan untuk HP lawas)
//   - tidak menggeser layout (badge ✓/✕ absolut, bukan elemen baru di alur)
//   - mati otomatis bila prefers-reduced-motion aktif (warna + ikon tetap ada)
//   - suara bisa dimatikan (tombol SoundToggle, tersimpan di localStorage)
import React, { useEffect, useRef, useState } from "react";

const CSS = `
:root{--ls-ok:#58a700;--ls-ok-bg:#ecf7f0;--ls-ok-bd:#6bb58a;--ls-bad:#e0555a;--ls-bad-bg:#fdf0ef;--ls-bad-bd:#e58a8a;--ls-ease:cubic-bezier(.2,.8,.2,1);--ls-spring:cubic-bezier(.34,1.56,.64,1)}
@keyframes lsPop{0%{transform:scale(1)}45%{transform:scale(1.045)}100%{transform:scale(1)}}
@keyframes lsShake{0%,100%{transform:translateX(0)}18%{transform:translateX(-7px)}38%{transform:translateX(6px)}58%{transform:translateX(-4px)}78%{transform:translateX(3px)}}
@keyframes lsBadgeIn{0%{transform:scale(0) rotate(-25deg);opacity:0}70%{transform:scale(1.18) rotate(4deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes lsFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes lsSlideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes lsSpeaker{0%{box-shadow:0 0 0 0 rgba(74,159,214,.55)}100%{box-shadow:0 0 0 12px rgba(74,159,214,0)}}
@keyframes lsSpeakerWiggle{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
@keyframes lsStarIn{0%{transform:scale(0) rotate(-40deg);opacity:0}65%{transform:scale(1.25) rotate(8deg);opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes lsConfetti{0%{transform:translate3d(0,0,0) rotate(0);opacity:1}100%{transform:translate3d(var(--dx),var(--dy),0) rotate(var(--rot));opacity:0}}
@keyframes lsTilePick{0%{transform:scale(1)}50%{transform:scale(1.07)}100%{transform:scale(1)}}
@keyframes lsGhostLift{from{transform:scale(1)}to{transform:scale(1.06)}}
@keyframes lsDrop{0%{transform:scale(.9);opacity:.5}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}

/* feedback tekan: semua tombol */
button:not(:disabled),[role="button"],.ls-press{transition:transform .12s var(--ls-ease),background-color .15s ease,border-color .15s ease,box-shadow .15s ease,opacity .15s ease}
button:not(:disabled):active,[role="button"]:active,.ls-press:active{transform:scale(.96)}

/* kartu / pilihan / kata */
.ls-card{position:relative;transition:transform .14s var(--ls-ease),border-color .15s ease,background-color .15s ease,box-shadow .15s ease;-webkit-tap-highlight-color:transparent}
@media (hover:hover){.ls-card:not(.ls-locked):hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(40,80,65,.10);border-color:#b9d4c8}}
.ls-card:not(.ls-locked):active{transform:scale(.975)}
.ls-card.ls-picked{animation:lsPop .22s var(--ls-ease)}
.ls-locked{cursor:default}

/* benar */
.ls-card.ls-ok{border-color:var(--ls-ok-bd)!important;background:var(--ls-ok-bg)!important;animation:lsPop .32s var(--ls-spring)}
.ls-card.ls-ok::after{content:"✓";position:absolute;top:-10px;right:8px;width:22px;height:22px;border-radius:50%;background:var(--ls-ok);color:#fff;font-size:13px;font-weight:800;line-height:22px;text-align:center;font-family:system-ui,sans-serif;box-shadow:0 2px 6px rgba(88,167,0,.35);animation:lsBadgeIn .3s var(--ls-spring) both;pointer-events:none}
/* salah */
.ls-card.ls-bad{border-color:var(--ls-bad-bd)!important;background:var(--ls-bad-bg)!important;animation:lsShake .36s ease}
.ls-card.ls-bad::after{content:"✕";position:absolute;top:-10px;right:8px;width:22px;height:22px;border-radius:50%;background:var(--ls-bad);color:#fff;font-size:12px;font-weight:800;line-height:22px;text-align:center;font-family:system-ui,sans-serif;box-shadow:0 2px 6px rgba(224,85,90,.35);animation:lsBadgeIn .3s var(--ls-spring) both;pointer-events:none}
/* jawaban benar yang ditunjukkan setelah salah: tanpa goyang, hanya tandai */
.ls-card.ls-reveal{border-color:var(--ls-ok-bd)!important;background:var(--ls-ok-bg)!important;border-style:dashed!important}
.ls-card.ls-reveal::after{content:"✓";position:absolute;top:-10px;right:8px;width:22px;height:22px;border-radius:50%;background:#fff;color:var(--ls-ok);border:2px solid var(--ls-ok);box-sizing:border-box;font-size:12px;font-weight:800;line-height:18px;text-align:center;font-family:system-ui,sans-serif;pointer-events:none}
.ls-card.ls-done{opacity:.7}

/* ikon speaker */
.ls-speaker-on{animation:lsSpeaker .8s ease-out infinite,lsSpeakerWiggle .8s ease-in-out infinite}

/* soal baru masuk, bar feedback naik */
.ls-enter{animation:lsFadeUp .22s var(--ls-ease) both}
.ls-feedback{animation:lsSlideUp .22s var(--ls-ease) both}
.ls-feedback-ok .ls-feedback-icon{animation:lsBadgeIn .32s var(--ls-spring) both}
.ls-feedback-bad .ls-feedback-icon{animation:lsShake .36s ease}
.ls-feedback-icon{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;color:#fff;font-size:15px;font-weight:800;flex-shrink:0;font-family:system-ui,sans-serif}
.ls-feedback-ok .ls-feedback-icon{background:var(--ls-ok)}
.ls-feedback-bad .ls-feedback-icon{background:var(--ls-bad)}

/* papan susun kata */
.ls-tile{transition:transform .14s var(--ls-ease),opacity .12s ease,background-color .12s ease,border-color .12s ease,box-shadow .12s ease!important}
@media (hover:hover){.ls-tile:not(.ls-locked):hover{transform:translateY(-1px);box-shadow:0 4px 10px rgba(40,80,65,.12)}}
.ls-tile:not(.ls-locked):active{transform:scale(.96)}
.ls-tile.ls-picked{animation:lsTilePick .2s var(--ls-ease)}
.ls-ghost{animation:lsGhostLift .12s var(--ls-ease) both}

/* selesai pelajaran */
.ls-star{display:inline-block;animation:lsStarIn .45s var(--ls-spring) both}
.ls-confetti{position:fixed;left:0;right:0;top:0;height:0;pointer-events:none;z-index:2000;overflow:visible}
.ls-confetti i{position:absolute;left:50%;top:38vh;width:9px;height:14px;border-radius:2px;opacity:0;animation:lsConfetti var(--dur) cubic-bezier(.15,.7,.3,1) var(--delay) forwards;will-change:transform,opacity}

@media (prefers-reduced-motion:reduce){
  .ls-card,.ls-card.ls-ok,.ls-card.ls-bad,.ls-card.ls-picked,.ls-tile,.ls-tile.ls-picked,.ls-ghost,.ls-enter,.ls-feedback,.ls-star,.ls-speaker-on,
  .ls-feedback-ok .ls-feedback-icon,.ls-feedback-bad .ls-feedback-icon,.ls-card.ls-ok::after,.ls-card.ls-bad::after{animation:none!important}
  button:not(:disabled):active,[role="button"]:active,.ls-press:active,.ls-card:not(.ls-locked):active,.ls-tile:not(.ls-locked):active{transform:none}
  .ls-card:not(.ls-locked):hover,.ls-tile:not(.ls-locked):hover{transform:none}
  .ls-confetti{display:none}
}
`;

export function injectFxStyles() {
  if (typeof document === "undefined" || document.getElementById("ls-fx-style")) return;
  const el = document.createElement("style");
  el.id = "ls-fx-style";
  el.textContent = CSS;
  document.head.appendChild(el);
}
injectFxStyles();

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- suara (sintesis WebAudio, tanpa file) ----------
const SOUND_KEY = "ls_sound_on";
let soundOn = true;
try { soundOn = window.localStorage.getItem(SOUND_KEY) !== "0"; } catch (e) { /* storage diblokir */ }
const soundListeners = new Set();
let actx = null;

export const sfx = {
  isOn: () => soundOn,
  setOn(v) {
    soundOn = !!v;
    try { window.localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0"); } catch (e) { /* abaikan */ }
    soundListeners.forEach((f) => f(soundOn));
  },
  play(kind) {
    if (!soundOn || typeof window === "undefined") return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!actx) actx = new AC();
      if (actx.state === "suspended") actx.resume();
      const notes = {
        correct: [[659.25, 0, 0.11], [880, 0.09, 0.16]],
        wrong: [[220, 0, 0.14], [174.6, 0.11, 0.2]],
        tap: [[520, 0, 0.05]],
        complete: [[523.25, 0, 0.12], [659.25, 0.11, 0.12], [783.99, 0.22, 0.12], [1046.5, 0.33, 0.28]],
      }[kind];
      if (!notes) return;
      const t0 = actx.currentTime;
      notes.forEach(([f, d, len]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = kind === "wrong" ? "triangle" : "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + d);
        g.gain.exponentialRampToValueAtTime(kind === "tap" ? 0.05 : 0.11, t0 + d + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + len);
        o.connect(g); g.connect(actx.destination);
        o.start(t0 + d); o.stop(t0 + d + len + 0.02);
      });
    } catch (e) { /* audio tidak tersedia: abaikan */ }
  },
};

export function useSoundOn() {
  const [on, setOn] = useState(soundOn);
  useEffect(() => { soundListeners.add(setOn); return () => soundListeners.delete(setOn); }, []);
  return on;
}

export function SoundToggle({ lang = "id", style }) {
  const on = useSoundOn();
  const label = on ? (lang === "en" ? "Sound on" : "Suara aktif") : (lang === "en" ? "Sound off" : "Suara mati");
  return (
    <button
      type="button" className="ls-press" aria-pressed={on} aria-label={label} title={label}
      onClick={() => { const next = !on; sfx.setOn(next); if (next) sfx.play("tap"); }}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", color: on ? "#5a8a79" : "#aab4af", ...style }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" fillOpacity=".15" />
        {on ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></> : <path d="m16 9 5 6m0-6-5 6" />}
      </svg>
    </button>
  );
}

// ---------- confetti (CSS murni, jumlah proporsional) ----------
const COLORS = ["#7BAE9B", "#5A8A79", "#F5B700", "#4A9FD6", "#E0555A", "#9b7bd6"];
export function Confetti({ count = 28, duration = 1.4 }) {
  const [alive, setAlive] = useState(!prefersReducedMotion());
  const pieces = useRef(null);
  if (!pieces.current) {
    pieces.current = Array.from({ length: count }, (_, i) => {
      const a = (Math.random() - 0.5) * Math.PI * 1.15 - Math.PI / 2;
      const v = 140 + Math.random() * 230;
      return {
        c: COLORS[i % COLORS.length],
        dx: Math.cos(a) * v, dy: Math.sin(a) * v + 160 + Math.random() * 90,
        rot: (Math.random() - 0.5) * 900, delay: Math.random() * 0.12, dur: duration * (0.75 + Math.random() * 0.5),
        w: 6 + Math.random() * 6,
      };
    });
  }
  useEffect(() => { const id = setTimeout(() => setAlive(false), (duration + 0.8) * 1000); return () => clearTimeout(id); }, [duration]);
  if (!alive) return null;
  return (
    <div className="ls-confetti" aria-hidden="true">
      {pieces.current.map((p, i) => (
        <i key={i} style={{ background: p.c, width: p.w, "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rot}deg`, "--delay": `${p.delay}s`, "--dur": `${p.dur}s` }} />
      ))}
    </div>
  );
}

// ---------- bintang penyelesaian ----------
export function Stars({ count = 3, total = 3 }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "2px 0 6px" }} role="img" aria-label={`${count}/${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < count ? "ls-star" : undefined} style={{ fontSize: 30, lineHeight: 1, color: i < count ? "#F5B700" : "#dfe6e2", animationDelay: `${0.15 + i * 0.16}s` }}>★</span>
      ))}
    </div>
  );
}

// ---------- angka naik pelan (count-up) ----------
export function useCountUp(target, ms = 700) {
  const [v, setV] = useState(prefersReducedMotion() ? target : 0);
  useEffect(() => {
    if (prefersReducedMotion()) { setV(target); return undefined; }
    let raf, start = null;
    const tick = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// Bantu: kelas untuk satu pilihan jawaban.
//   state: "idle" | "picked" | "ok" | "bad" | "reveal"
export const fxCardClass = (state, locked) =>
  ["ls-card", locked ? "ls-locked" : "", state === "picked" ? "ls-picked" : "", state === "ok" ? "ls-ok" : "", state === "bad" ? "ls-bad" : "", state === "reveal" ? "ls-reveal" : ""]
    .filter(Boolean).join(" ");

export const starsFor = (acc) => (acc >= 90 ? 3 : acc >= 60 ? 2 : 1);

// Angka yang naik pelan sampai nilai akhir.
export function CountUp({ to, prefix = "", suffix = "" }) {
  const v = useCountUp(Math.max(0, Math.round(to || 0)), 700);
  return <>{prefix}{v}{suffix}</>;
}

// Perayaan layar selesai: bintang (1–3) + confetti hanya untuk hasil bagus (proporsional) + nada selesai.
export function Celebrate({ acc }) {
  const stars = starsFor(acc);
  useEffect(() => { if (acc >= 60) sfx.play("complete"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Stars count={stars} />
      {acc >= 70 && <Confetti count={acc >= 100 ? 46 : acc >= 90 ? 34 : 20} />}
    </>
  );
}
