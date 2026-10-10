// src/setupProxy.js
//
// Membuat folder /api (serverless ala Vercel) ikut jalan saat `npm start`,
// jadi Levantine, Explore (Notion), audio, dsb. berfungsi di localhost TANPA `vercel dev`.
// CRA otomatis memuat file ini saat dev server menyala — tidak perlu di-import.
//
// Cara kerja: tiap request ke /api/<nama> dijalankan oleh file api/<nama>.js
// dengan req.query / req.body / res.status().json() yang sama seperti di Vercel.
// Variabel rahasia server (SUPABASE_SERVICE_ROLE_KEY, NOTION_TOKEN, LADIZ/ELEVENLABS key, dst.)
// dibaca dari file .env di root proyek. RESTART `npm start` setiap .env atau file api/ berubah.

const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

try { require("dotenv").config({ path: path.join(process.cwd(), ".env") }); } catch (e) { /* dotenv tidak ada: CRA sudah memuat .env sendiri */ }

console.log("[api] setupProxy aktif: /api/* dijalankan lokal dari folder api/");
const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((k) => !process.env[k] && !process.env["REACT_APP_" + k]);
if (missing.length) console.warn("[api] PERINGATAN: variabel ini tidak ada di .env:", missing.join(", "), "(cek nama persis yang dipakai file api/*.js)");

const API_DIR = path.join(process.cwd(), "api");

// Handler Vercel bisa CommonJS (module.exports) atau ESM (import/export default).
// File ESM di folder api/ yang berekstensi .js tidak bisa di-import langsung oleh Node kalau
// package.json tidak "type":"module" — jadi salinannya ditulis ke api/_dev_<nama>.mjs
// (awalan "_" = tidak ikut jadi fungsi di Vercel) lalu di-import. Import relatif ("../lib/...")
// dan paket npm tetap ketemu karena salinan ada di folder yang sama. Dibuat ulang otomatis
// kalau file aslinya berubah, jadi tidak perlu restart untuk edit file api/.
const ESM_RE = /^\s*(import\s|export\s)/m;

async function loadHandler(name) {
  const base = path.join(API_DIR, name);
  const file = [".js", ".mjs", ".cjs"].map((e) => base + e).find((f) => fs.existsSync(f));
  if (!file) return null;

  const src = fs.readFileSync(file, "utf8");
  const mtime = fs.statSync(file).mtimeMs;
  let mod;
  if (file.endsWith(".mjs") || (file.endsWith(".js") && ESM_RE.test(src))) {
    let target = file;
    if (!file.endsWith(".mjs")) {
      target = path.join(API_DIR, `_dev_${name}.mjs`);
      fs.writeFileSync(target, src);
    }
    mod = await import(pathToFileURL(target).href + `?v=${mtime}`);
  } else {
    delete require.cache[require.resolve(file)];
    mod = require(file);
  }
  const fn = (mod && (mod.default || mod.handler)) || mod;
  return typeof fn === "function" ? fn : null;
}

function readBody(req) {
  return new Promise((resolve) => {
    if (req.method === "GET" || req.method === "HEAD") return resolve(undefined);
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try { resolve(JSON.parse(raw)); } catch (e) { resolve(raw); }
    });
    req.on("error", () => resolve(undefined));
  });
}

module.exports = function (app) {
  app.use("/api", async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const name = url.pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    if (!name || /[^a-zA-Z0-9_-]/.test(name)) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: "API tidak ditemukan" }));
    }

    // bentuk req/res seperti Vercel
    req.query = Object.fromEntries(url.searchParams.entries());
    req.body = await readBody(req);
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(obj)); return res; };
    res.send = (data) => {
      if (Buffer.isBuffer(data)) return res.end(data);
      if (data !== null && typeof data === "object") return res.json(data);
      res.end(data == null ? "" : String(data));
      return res;
    };

    // log tiap request ke terminal `npm start` supaya kelihatan jalan / tidaknya
    const t0 = Date.now();
    res.on("finish", () => console.log(`[api] ${req.method} /${name}${url.search} -> ${res.statusCode} (${Date.now() - t0}ms)`));

    try {
      const handler = await loadHandler(name);
      if (!handler) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ error: `api/${name}.js tidak ada` }));
      }
      await handler(req, res);
    } catch (err) {
      console.error(`[api/${name}]`, err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
      }
      if (!res.writableEnded) res.end(JSON.stringify({ error: err.message || "Server error" }));
    }
  });
};
