// src/PlanetScene.jsx
// Ilustrasi soal bergambar: karakter planet LearningSpace dengan ekspresi, aksesori, warna, dan
// properti (emoji) yang bervariasi. Dipakai untuk soal yang punya `content.scene`, mis.
//   { mood: "sad", accessory: "bandage", color: "#6FA8DC", prop: "🩹" }
// Semua nilai dibatasi daftar di generate-intermediate.mjs (SCENE_*); nilai tak dikenal jatuh ke default.
import React from "react";

const INK = "#3E3E3E";

function Face({ mood }) {
  switch (mood) {
    case "excited":
      return (
        <g>
          <circle cx="66" cy="80" r="4.5" fill={INK} /><circle cx="94" cy="80" r="4.5" fill={INK} />
          <circle cx="64.5" cy="78.5" r="1.4" fill="#fff" /><circle cx="92.5" cy="78.5" r="1.4" fill="#fff" />
          <ellipse cx="80" cy="103" rx="8" ry="7" fill={INK} />
          <ellipse cx="80" cy="106" rx="4.5" ry="3" fill="#E57373" />
          <circle cx="54" cy="94" r="5" fill="#FF9AA2" opacity="0.55" /><circle cx="106" cy="94" r="5" fill="#FF9AA2" opacity="0.55" />
        </g>
      );
    case "sad":
      return (
        <g>
          <circle cx="66" cy="80" r="3.5" fill={INK} /><circle cx="94" cy="80" r="3.5" fill={INK} />
          <path d="M62 71 Q66 68 72 70" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M98 71 Q94 68 88 70" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M68 107 Q80 97 92 107" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M62 88 Q59 94 62 97 Q65 94 62 88 Z" fill="#6EC6FF" />
        </g>
      );
    case "surprised":
      return (
        <g>
          <circle cx="66" cy="80" r="6" fill="#fff" stroke={INK} strokeWidth="2" /><circle cx="94" cy="80" r="6" fill="#fff" stroke={INK} strokeWidth="2" />
          <circle cx="66" cy="81" r="2.6" fill={INK} /><circle cx="94" cy="81" r="2.6" fill={INK} />
          <ellipse cx="80" cy="104" rx="5" ry="7" fill="#fff" stroke={INK} strokeWidth="2.4" />
        </g>
      );
    case "sleepy":
      return (
        <g>
          <path d="M60 80 Q66 85 72 80" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M88 80 Q94 85 100 80" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M74 103 Q80 106 86 103" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <text x="108" y="62" fontSize="15" fontWeight="700" fill="#5B6B8C">z</text>
          <text x="116" y="50" fontSize="11" fontWeight="700" fill="#5B6B8C">z</text>
        </g>
      );
    case "angry":
      return (
        <g>
          <circle cx="66" cy="82" r="3.5" fill={INK} /><circle cx="94" cy="82" r="3.5" fill={INK} />
          <path d="M57 70 L74 77" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M103 70 L86 77" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <path d="M68 107 Q80 99 92 107" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </g>
      );
    case "sick":
      return (
        <g>
          <path d="M61 76 L71 86 M71 76 L61 86" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M89 76 L99 86 M99 76 L89 86" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M67 104 Q73.5 98 80 104 T93 104" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <ellipse cx="80" cy="95" rx="30" ry="14" fill="#9BD08F" opacity="0.28" />
        </g>
      );
    case "thinking":
      return (
        <g>
          <circle cx="68" cy="77" r="3.5" fill={INK} /><circle cx="96" cy="77" r="3.5" fill={INK} />
          <path d="M60 67 Q66 63 73 66" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M72 103 Q80 101 90 105" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>
      );
    case "cool":
      return (
        <g>
          <rect x="55" y="74" width="21" height="12" rx="5" fill={INK} /><rect x="84" y="74" width="21" height="12" rx="5" fill={INK} />
          <path d="M76 79 L84 79" stroke={INK} strokeWidth="2.4" />
          <path d="M68 100 Q80 110 92 100" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </g>
      );
    default: // happy
      return (
        <g>
          <circle cx="66" cy="80" r="3.5" fill={INK} /><circle cx="94" cy="80" r="3.5" fill={INK} />
          <path d="M66 99 Q80 112 94 99" stroke={INK} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

function Accessory({ kind }) {
  switch (kind) {
    case "hat":
      return <g><path d="M62 44 L80 14 L98 44 Z" fill="#FF7A8A" /><circle cx="80" cy="13" r="4.5" fill="#FFD54F" /><path d="M64 40 L96 40" stroke="#fff" strokeWidth="3" opacity="0.7" /></g>;
    case "cap":
      return <g><path d="M48 62 Q80 22 112 62 Z" fill="#4A7BD0" /><path d="M100 60 Q122 58 126 66 Q112 68 98 64 Z" fill="#3A63A8" /></g>;
    case "glasses":
      return <g fill="none" stroke={INK} strokeWidth="2.6"><circle cx="66" cy="80" r="10" /><circle cx="94" cy="80" r="10" /><path d="M76 80 L84 80" /></g>;
    case "scarf":
      return <g><path d="M50 114 Q80 130 110 114 L108 126 Q80 142 52 126 Z" fill="#E96A5A" /><rect x="96" y="120" width="12" height="26" rx="4" fill="#D4574A" /></g>;
    case "headphones":
      return <g><path d="M36 82 Q36 28 80 28 Q124 28 124 82" fill="none" stroke="#37474F" strokeWidth="6" strokeLinecap="round" /><rect x="28" y="76" width="14" height="26" rx="6" fill="#37474F" /><rect x="118" y="76" width="14" height="26" rx="6" fill="#37474F" /></g>;
    case "crown":
      return <g><path d="M60 46 L64 22 L72 36 L80 18 L88 36 L96 22 L100 46 Z" fill="#FFC928" stroke="#E0A800" strokeWidth="1.5" /></g>;
    case "bandage":
      return <g transform="rotate(-18 80 54)"><rect x="60" y="48" width="40" height="13" rx="6" fill="#F5C58B" stroke="#E0A55F" strokeWidth="1" /><rect x="73" y="48" width="14" height="13" fill="#FFE0B8" /><circle cx="66" cy="54.5" r="1.2" fill="#E0A55F" /><circle cx="94" cy="54.5" r="1.2" fill="#E0A55F" /></g>;
    default:
      return null;
  }
}

export default function PlanetScene({ mood = "happy", accessory = "none", color = "#7BAE9B", prop = "", size = 220 }) {
  const w = size, h = Math.round(size * 0.82);
  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "6px auto 18px" }} aria-hidden="true">
      <svg width={w} height={h} viewBox="0 0 200 164" role="img">
        {/* bintang kecil */}
        <path d="M14 30 L16 36 L22 38 L16 40 L14 46 L12 40 L6 38 L12 36 Z" fill="#F5D98B" />
        <circle cx="186" cy="20" r="2.5" fill="#F5D98B" />
        {/* properti (emoji) */}
        {prop && (
          <g>
            <circle cx="166" cy="112" r="29" fill="#F1F5F3" />
            <text x="166" y="125" fontSize="38" textAnchor="middle">{prop}</text>
          </g>
        )}
        {/* cincin belakang */}
        <ellipse cx="80" cy="96" rx="68" ry="15" fill="none" stroke="#F5B700" strokeWidth="6" opacity="0.9" />
        {/* badan */}
        <circle cx="80" cy="82" r="52" fill={color} />
        <ellipse cx="60" cy="58" rx="14" ry="8" fill="rgba(255,255,255,0.2)" />
        <circle cx="106" cy="104" r="7" fill="rgba(0,0,0,0.08)" />
        <circle cx="52" cy="100" r="5" fill="rgba(0,0,0,0.08)" />
        <Face mood={mood} />
        {/* cincin depan */}
        <path d="M12 96 Q80 120 148 96" fill="none" stroke="#F5B700" strokeWidth="6" strokeLinecap="round" />
        <Accessory kind={accessory} />
      </svg>
    </div>
  );
}
