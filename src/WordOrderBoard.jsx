// WordOrderBoard.jsx
//
// Papan SUSUN KATA dengan drag-and-drop yang terasa natural (mouse & layar sentuh).
// Dipakai oleh soal word_order di Levantine (App.jsx).
//
// Fitur:
//  * Seret kata ke posisi tertentu (di baris Jawaban maupun di Bank kata).
//  * Sisipkan kata DI ANTARA dua kata lain — posisi tujuan ditampilkan sebagai garis penanda sebelum dilepas.
//  * Pindahkan BEBERAPA kata sekaligus: pilih beberapa kata lalu seret salah satunya.
//  * Pilih banyak kata: tombol "Pilih banyak" (muncul checkbox di tiap kata), atau Ctrl/Cmd+klik (toggle)
//    dan Shift+klik (rentang) di komputer.
//  * Pindahkan kata terpilih ke kelompok lain dengan tombol (→ Jawaban / → Bank).
//  * "Pilih semua" per kelompok, "Batal pilih" (juga tombol Esc / klik area kosong).
//  * Indikator saat menyeret: kata asli meredup + "bayangan" kata mengikuti jari/kursor (dengan angka jumlah
//    kalau lebih dari satu), kelompok tujuan ikut menyala.
//  * Undo / Redo (tombol, Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z) dan tombol Reset ke kondisi awal tersimpan
//    (semua kata di bank) — Reset pun bisa di-undo.
//  * Ketuk satu kata (tanpa menyeret) = pindahkan ke kelompok lain, seperti sebelumnya.
//
// Props:
//   words     : string[]            — isi wordBank (urutan = urutan asli bank)
//   rtl       : boolean             — true bila kata-katanya Arab (arah kanan-ke-kiri)
//   disabled  : boolean             — true setelah jawaban dicek
//   onChange  : (tiles) => void     — tiles = [{ word, poolIdx }] urutan jawaban saat ini
//   onTapWord : (word) => void      — dipanggil saat kata diketuk (mis. memutar suara kata)
//   lx        : (id, en) => string  — helper dua bahasa

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

const GREEN = "#7BAE9B";
const GREEN_DARK = "#5a8a79";
const AMBER = "#F5B700";
const DRAG_THRESHOLD = 6;

const initialState = (n) => ({ answer: [], bank: Array.from({ length: n }, (_, i) => i) });
const sameState = (a, b) => a.answer.join(",") === b.answer.join(",") && a.bank.join(",") === b.bank.join(",");

function rectDistance(r, x, y) {
  const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
  const dy = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
  return Math.hypot(dx, dy);
}

export default function WordOrderBoard({ words, rtl = false, disabled = false, onChange, onTapWord, lx }) {
  const L = lx || ((id) => id);
  const n = words.length;

  const [state, setState] = useState(() => initialState(n));
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [drag, setDrag] = useState(null); // { ids, x, y, over: { group, index, marker } | null }

  const stateRef = useRef(state);
  stateRef.current = state;
  const selRef = useRef(sel);
  selRef.current = sel;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const rtlRef = useRef(rtl);
  rtlRef.current = rtl;
  const tileEls = useRef({});
  const boxEls = useRef({ answer: null, bank: null });
  const anchor = useRef(null); // { group, id } untuk Shift+klik
  const dragRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onTapRef = useRef(onTapWord);
  onTapRef.current = onTapWord;

  // ---- laporkan susunan jawaban ke induk ----
  useEffect(() => {
    if (onChangeRef.current) onChangeRef.current(state.answer.map((id) => ({ word: words[id], poolIdx: id })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.answer]);

  // ---- riwayat (undo/redo) ----
  const commit = useCallback((next) => {
    const cur = stateRef.current;
    if (sameState(cur, next)) return;
    setPast((p) => [...p, cur].slice(-100));
    setFuture([]);
    setState(next);
  }, []);

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture((f) => [stateRef.current, ...f]);
      setState(prev);
      return p.slice(0, -1);
    });
    setSel(new Set());
  }, []);

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f;
      const nxt = f[0];
      setPast((p) => [...p, stateRef.current]);
      setState(nxt);
      return f.slice(1);
    });
    setSel(new Set());
  }, []);

  const reset = useCallback(() => {
    commit(initialState(n));
    setSel(new Set());
  }, [commit, n]);

  // ---- operasi pemindahan ----
  // Memindahkan `ids` ke kelompok `group` di posisi `index` (index terhadap daftar tujuan SETELAH
  // kata-kata yang dipindah dikeluarkan dari daftar).
  const moveIds = useCallback((ids, group, index) => {
    const cur = stateRef.current;
    const idSet = new Set(ids);
    // urutan kata yang dipindah: urutan di jawaban dulu, lalu urutan di bank (menjaga urutan relatif)
    const ordered = [...cur.answer.filter((i) => idSet.has(i)), ...cur.bank.filter((i) => idSet.has(i))];
    const next = {
      answer: cur.answer.filter((i) => !idSet.has(i)),
      bank: cur.bank.filter((i) => !idSet.has(i)),
    };
    const target = next[group].slice();
    const at = Math.max(0, Math.min(index, target.length));
    target.splice(at, 0, ...ordered);
    next[group] = target;
    commit(next);
  }, [commit]);

  // Kembalikan ke bank di posisi aslinya (berurutan menurut id)
  const moveToBankSorted = useCallback((ids) => {
    const cur = stateRef.current;
    const idSet = new Set(ids);
    const next = {
      answer: cur.answer.filter((i) => !idSet.has(i)),
      bank: [...cur.bank, ...cur.answer.filter((i) => idSet.has(i))].sort((a, b) => a - b),
    };
    commit(next);
  }, [commit]);

  const groupOf = (id) => (stateRef.current.answer.includes(id) ? "answer" : "bank");

  // ---- seleksi ----
  const toggleSel = (id) => {
    setSel((s) => {
      const nx = new Set(s);
      if (nx.has(id)) nx.delete(id); else nx.add(id);
      return nx;
    });
  };
  const clearSel = useCallback(() => { setSel(new Set()); anchor.current = null; }, []);
  const selectAllIn = (group) => {
    const ids = stateRef.current[group];
    setSel((s) => {
      const all = ids.length > 0 && ids.every((i) => s.has(i));
      const nx = new Set(s);
      ids.forEach((i) => (all ? nx.delete(i) : nx.add(i)));
      return nx;
    });
  };
  const selectRange = (group, id) => {
    const list = stateRef.current[group];
    const a = anchor.current && anchor.current.group === group ? list.indexOf(anchor.current.id) : -1;
    const b = list.indexOf(id);
    if (a < 0 || b < 0) { toggleSel(id); anchor.current = { group, id }; return; }
    const [lo, hi] = a < b ? [a, b] : [b, a];
    setSel((s) => {
      const nx = new Set(s);
      list.slice(lo, hi + 1).forEach((i) => nx.add(i));
      return nx;
    });
  };

  const moveSelectedTo = (group) => {
    const cur = stateRef.current;
    const ids = [...selRef.current].filter((i) => (group === "answer" ? cur.bank.includes(i) : cur.answer.includes(i)));
    if (!ids.length) return;
    if (group === "answer") moveIds(ids, "answer", cur.answer.length);
    else moveToBankSorted(ids);
    clearSel();
  };

  // ---- keyboard: Ctrl+Z / Ctrl+Y / Esc ----
  useEffect(() => {
    const onKey = (e) => {
      if (disabledRef.current) return;
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target && e.target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
      else if (mod && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
      else if (e.key === "Escape") { clearSel(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, clearSel]);

  // ---- hit-test saat menyeret ----
  const computeOver = useCallback((x, y, ids) => {
    const idSet = new Set(ids);
    let best = null;
    for (const group of ["answer", "bank"]) {
      const el = boxEls.current[group];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const d = rectDistance(r, x, y);
      if (!best || d < best.d) best = { group, d, rect: r };
    }
    if (!best || best.d > 90) return null;

    const list = stateRef.current[best.group].filter((i) => !idSet.has(i));
    if (list.length === 0) return { group: best.group, index: 0, marker: null };

    let nearest = null;
    list.forEach((id, idx) => {
      const el = tileEls.current[id];
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = rectDistance(r, x, y) + (y >= r.top && y <= r.bottom ? 0 : 0.01);
      if (!nearest || d < nearest.d) nearest = { id, idx, r, d };
    });
    if (!nearest) return { group: best.group, index: list.length, marker: null };

    const cx = (nearest.r.left + nearest.r.right) / 2;
    const isRtl = rtlRef.current;
    const before = isRtl ? x > cx : x < cx;
    const index = before ? nearest.idx : nearest.idx + 1;
    const edgeX = (before !== isRtl) ? nearest.r.left - 6 : nearest.r.right + 6; // before&ltr -> kiri; after&ltr -> kanan; rtl kebalikan
    return {
      group: best.group,
      index,
      marker: { left: edgeX - best.rect.left, top: nearest.r.top - best.rect.top, height: nearest.r.height },
    };
  }, []);

  // ---- pointer: awal tekan -> seret / klik ----
  const onTilePointerDown = (e, id) => {
    if (disabledRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const start = { x: e.clientX, y: e.clientY, id, group: groupOf(id), shift: e.shiftKey, mod: e.ctrlKey || e.metaKey };
    let dragging = false;

    const move = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      if (!dragging) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        dragging = true;
        const s = selRef.current;
        const cur = stateRef.current;
        const ids = s.has(id)
          ? [...cur.answer.filter((i) => s.has(i)), ...cur.bank.filter((i) => s.has(i))]
          : [id];
        dragRef.current = { ids };
      }
      const { ids } = dragRef.current;
      const over = computeOver(ev.clientX, ev.clientY, ids);
      dragRef.current.over = over;
      setDrag({ ids, x: ev.clientX, y: ev.clientY, over });
    };

    const finish = (ev, cancelled) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      if (dragging) {
        const info = dragRef.current;
        dragRef.current = null;
        setDrag(null);
        if (!cancelled && info && info.over) {
          moveIds(info.ids, info.over.group, info.over.index);
          clearSel();
        }
        return;
      }
      if (cancelled) return;
      // ---- klik biasa ----
      if (start.mod) { toggleSel(id); anchor.current = { group: start.group, id }; return; }
      if (start.shift) { selectRange(start.group, id); return; }
      if (selectModeRef.current || selRef.current.size > 0) { toggleSel(id); anchor.current = { group: start.group, id }; return; }
      if (onTapRef.current) onTapRef.current(words[id]);
      if (start.group === "bank") moveIds([id], "answer", stateRef.current.answer.length);
      else moveToBankSorted([id]);
    };
    const up = (ev) => finish(ev, false);
    const cancel = (ev) => finish(ev, true);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
  };

  const selectModeRef = useRef(selectMode);
  selectModeRef.current = selectMode;

  // ---- tampilan ----
  const draggingIds = useMemo(() => new Set(drag ? drag.ids : []), [drag]);
  const showChecks = selectMode || sel.size > 0;
  const selInAnswer = state.answer.filter((i) => sel.has(i)).length;
  const selInBank = state.bank.filter((i) => sel.has(i)).length;
  const canUndo = past.length > 0 && !disabled;
  const canRedo = future.length > 0 && !disabled;
  const isInitial = sameState(state, initialState(n));

  const tileStyle = (id, group) => {
    const selected = sel.has(id);
    return {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      border: selected ? `2px solid ${AMBER}` : group === "answer" ? "1.5px solid #cfe3da" : "1.5px solid #e3e9e6",
      background: selected ? "#FFF6DD" : group === "answer" ? "#f1f7f4" : "white",
      color: selected ? "#a97b00" : group === "answer" ? GREEN_DARK : "#1a1a1a",
      boxShadow: selected ? "0 0 0 2px rgba(245,183,0,0.22)" : "0 1px 0 rgba(0,0,0,0.04)",
      borderRadius: 12,
      padding: showChecks ? "9px 12px 9px 10px" : "10px 16px",
      fontSize: 16,
      cursor: disabled ? "default" : draggingIds.has(id) ? "grabbing" : "grab",
      opacity: draggingIds.has(id) ? 0.35 : 1,
      userSelect: "none",
      WebkitUserSelect: "none",
      touchAction: "none",
      transition: "opacity .12s ease, background .12s ease, border-color .12s ease",
    };
  };

  const checkbox = (id) => (
    <span
      role="checkbox"
      aria-checked={sel.has(id)}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => { e.stopPropagation(); toggleSel(id); anchor.current = { group: groupOf(id), id }; }}
      style={{
        width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
        border: sel.has(id) ? `2px solid ${AMBER}` : "2px solid #c5d1cc", background: sel.has(id) ? AMBER : "white", color: "white", fontSize: 12, lineHeight: 1, cursor: "pointer",
      }}
    >
      {sel.has(id) ? "✓" : ""}
    </span>
  );

  const renderGroup = (group, label, emptyHint) => {
    const ids = state[group];
    const over = drag && drag.over && drag.over.group === group ? drag.over : null;
    const allSelected = ids.length > 0 && ids.every((i) => sel.has(i));
    return (
      <div style={{ marginBottom: group === "answer" ? 18 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, fontSize: 12, color: "#7a8a84", fontWeight: 600, letterSpacing: 0.3 }}>
          <span>{label}{ids.length ? ` · ${ids.length}` : ""}</span>
          {!disabled && ids.length > 0 && (
            <button type="button" onClick={() => selectAllIn(group)} style={linkBtn}>
              {allSelected ? L("Lepas semua", "Deselect all") : L("Pilih semua", "Select all")}
            </button>
          )}
        </div>
        <div
          ref={(el) => { boxEls.current[group] = el; }}
          style={{
            position: "relative",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            minHeight: 58,
            padding: 10,
            borderRadius: 14,
            direction: rtl ? "rtl" : "ltr",
            justifyContent: group === "bank" ? "center" : "flex-start",
            alignContent: "flex-start",
            background: over ? "rgba(123,174,155,0.10)" : group === "answer" ? "#fbfdfc" : "transparent",
            border: over ? `2px dashed ${GREEN}` : group === "answer" ? "1.5px dashed #d5e2dc" : "1.5px dashed transparent",
            transition: "background .12s ease, border-color .12s ease",
          }}
        >
          {ids.length === 0 && (
            <div style={{ width: "100%", textAlign: "center", color: "#a3b0aa", fontSize: 13, alignSelf: "center", direction: "ltr" }}>{emptyHint}</div>
          )}
          {ids.map((id) => (
            <div
              key={id}
              ref={(el) => { if (el) tileEls.current[id] = el; else delete tileEls.current[id]; }}
              role="button"
              className={`ls-tile${disabled ? " ls-locked" : ""}${sel.has(id) ? " ls-picked" : ""}`}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => onTilePointerDown(e, id)}
              onKeyDown={(e) => {
                if (disabled) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (onTapRef.current) onTapRef.current(words[id]);
                  if (group === "bank") moveIds([id], "answer", stateRef.current.answer.length); else moveToBankSorted([id]);
                }
              }}
              style={tileStyle(id, group)}
            >
              {showChecks && !disabled && checkbox(id)}
              <span>{words[id]}</span>
            </div>
          ))}
          {over && over.marker && (
            <div
              aria-hidden="true"
              style={{ position: "absolute", left: over.marker.left - 2, top: over.marker.top, height: over.marker.height, width: 4, borderRadius: 3, background: GREEN, boxShadow: "0 0 0 3px rgba(123,174,155,0.25)", pointerEvents: "none" }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div onPointerDown={(e) => { if (e.target === e.currentTarget && sel.size) clearSel(); }} style={{ touchAction: "pan-y" }}>
      {/* toolbar */}
      {!disabled && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <button type="button" onClick={undo} disabled={!canUndo} style={toolBtn(canUndo)} title="Ctrl+Z" aria-label="Undo">↶ {L("Undo", "Undo")}</button>
          <button type="button" onClick={redo} disabled={!canRedo} style={toolBtn(canRedo)} title="Ctrl+Y" aria-label="Redo">↷ {L("Redo", "Redo")}</button>
          <button type="button" onClick={reset} disabled={isInitial} style={toolBtn(!isInitial)} aria-label="Reset">⟲ {L("Reset", "Reset")}</button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            onClick={() => { setSelectMode((m) => !m); if (selectMode) clearSel(); }}
            style={{ ...toolBtn(true), ...(selectMode || sel.size ? { background: "#FFF6DD", borderColor: AMBER, color: "#a97b00" } : null) }}
            aria-pressed={selectMode}
          >
            ☑ {L("Pilih banyak", "Multi-select")}
          </button>
        </div>
      )}

      {/* bar aksi untuk kata terpilih */}
      {!disabled && sel.size > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 10px", marginBottom: 12, borderRadius: 12, background: "#FFF9E8", border: "1px solid #f3e1a8" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#a97b00" }}>{sel.size} {L("dipilih", "selected")}</span>
          <span style={{ flex: 1 }} />
          {selInBank > 0 && <button type="button" onClick={() => moveSelectedTo("answer")} style={actBtn}>{rtl ? "←" : "→"} {L("Ke Jawaban", "To Answer")}</button>}
          {selInAnswer > 0 && <button type="button" onClick={() => moveSelectedTo("bank")} style={actBtn}>{rtl ? "→" : "←"} {L("Ke Bank", "To Bank")}</button>}
          <button type="button" onClick={clearSel} style={{ ...actBtn, background: "white", color: "#7a8a84", borderColor: "#dfe7e3" }}>✕ {L("Batal pilih", "Clear")}</button>
        </div>
      )}

      {renderGroup("answer", L("Jawabanmu", "Your answer"), L("Seret kata ke sini, atau ketuk kata di bawah", "Drag words here, or tap the words below"))}
      {renderGroup("bank", L("Kumpulan kata", "Word bank"), L("Semua kata sudah dipakai", "All words are used"))}

      {/* bayangan kata saat diseret */}
      {drag && (
        <div
          aria-hidden="true"
          style={{ position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%, -60%) rotate(-2deg)", pointerEvents: "none", zIndex: 1000, direction: rtl ? "rtl" : "ltr" }}
        >
          <div className="ls-ghost" style={{ position: "relative" }}>
            {drag.ids.slice(0, 3).map((id, i) => (
              <div
                key={id}
                style={{
                  position: i === 0 ? "relative" : "absolute", left: i * 6, top: i * 6, zIndex: 3 - i,
                  border: `2px solid ${GREEN}`, background: "white", color: GREEN_DARK, borderRadius: 12, padding: "9px 16px", fontSize: 16, whiteSpace: "nowrap",
                  boxShadow: "0 10px 24px rgba(40,80,65,0.28)",
                }}
              >
                {words[id]}
              </div>
            ))}
            {drag.ids.length > 1 && (
              <span style={{ position: "absolute", top: -10, right: -10, zIndex: 5, minWidth: 22, height: 22, borderRadius: 11, background: AMBER, color: "white", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", direction: "ltr" }}>
                {drag.ids.length}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const linkBtn = { background: "none", border: "none", color: GREEN_DARK, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" };
const actBtn = { border: `1.5px solid ${AMBER}`, background: AMBER, color: "white", borderRadius: 10, padding: "6px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const toolBtn = (enabled) => ({
  border: "1.5px solid #dfe7e3", background: "white", color: enabled ? "#3f5b52" : "#b6c0bc", borderRadius: 10, padding: "6px 11px", fontSize: 13, fontWeight: 600,
  cursor: enabled ? "pointer" : "default", fontFamily: "inherit", opacity: enabled ? 1 : 0.7,
});
