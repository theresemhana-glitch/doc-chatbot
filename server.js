import "dotenv/config";
import express from "express";
import multer from "multer";
import os from "node:os";
import fs from "node:fs/promises";
import path from "node:path";
import { addDocument, removeDocument, ask, clearHistory, getSession, SUPPORTED } from "./src/rag.js";

if (!process.env.GOOGLE_API_KEY) {
  console.error("Missing GOOGLE_API_KEY in .env");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(express.static("public"));

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    SUPPORTED.includes(ext) ? cb(null, true) : cb(new Error(`Unsupported file type "${ext}". Use ${SUPPORTED.join(", ")}`));
  },
});

const sid = (req) => req.get("x-session-id") || "default";
const fail = (res, e, code = 400) => res.status(code).json({ error: e.message || "Something went wrong" });

app.get("/api/documents", (req, res) => res.json({ documents: getSession(sid(req)).docs }));

app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err) return fail(res, err);
    if (!req.file) return fail(res, new Error("No file uploaded."));
    try {
      const doc = await addDocument(sid(req), req.file.path, req.file.originalname);
      res.json({ ...doc, documents: getSession(sid(req)).docs });
    } catch (e) { fail(res, e); }
    finally { fs.unlink(req.file.path).catch(() => {}); }
  });
});

app.delete("/api/documents/:name", (req, res) => {
  removeDocument(sid(req), req.params.name);
  res.json({ documents: getSession(sid(req)).docs });
});

app.post("/api/chat", async (req, res) => {
  const question = (req.body?.question || "").trim();
  if (!question) return fail(res, new Error("Please enter a question."));
  try { res.json(await ask(sid(req), question)); }
  catch (e) { fail(res, e, e.message.startsWith("Please upload") ? 400 : 500); }
});

app.post("/api/clear", (req, res) => { clearHistory(sid(req)); res.json({ ok: true }); });

app.listen(process.env.PORT || 3000, () => console.log(`Running on http://localhost:${process.env.PORT || 3000}`));