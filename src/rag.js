
import path from "node:path";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { TextLoader } from "langchain/document_loaders/fs/text";

export const SUPPORTED = [".pdf", ".txt", ".docx", ".csv"];

const loaders = {
  ".pdf": (p) => new PDFLoader(p),
  ".txt": (p) => new TextLoader(p),
  ".docx": (p) => new DocxLoader(p),
  ".csv": (p) => new CSVLoader(p),
};

const embeddings = new GoogleGenerativeAIEmbeddings({
  model: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
});

const llm = new ChatGoogleGenerativeAI({
  model: process.env.CHAT_MODEL || "gemini-3.8-flash",
  temperature: 0,
  maxRetries: 1,
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 150,
});

// One session = one vector store + document list + chat history
const sessions = new Map();

export function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, {
      store: new MemoryVectorStore(embeddings),
      docs: [],
      history: [],
    });
  }

  return sessions.get(id);
}

export async function addDocument(sessionId, filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (!loaders[ext]) {
    throw new Error(
      `Unsupported file type "${ext}". Use ${SUPPORTED.join(", ")}`
    );
  }

  const s = getSession(sessionId);

  if (s.docs.includes(originalName)) {
    throw new Error(`"${originalName}" is already uploaded.`);
  }

  const raw = await loaders[ext](filePath).load();
  const chunks = await splitter.splitDocuments(raw);

  if (!chunks.some((c) => c.pageContent.trim())) {
    throw new Error("No readable text found in this file.");
  }

  chunks.forEach((c) => {
    c.metadata = {
      source: originalName,
      page: c.metadata?.loc?.pageNumber ?? null,
    };
  });

  const start = Date.now();

  await s.store.addDocuments(chunks);

  console.log(
    "Embedding/indexing ms:",
    Date.now() - start,
    "| chunks:",
    chunks.length
  );

  s.docs.push(originalName);

  return {
    name: originalName,
    chunks: chunks.length,
  };
}

export function removeDocument(sessionId, name) {
  const s = getSession(sessionId);

  s.store.memoryVectors = s.store.memoryVectors.filter(
    (v) => v.metadata.source !== name
  );

  s.docs = s.docs.filter((d) => d !== name);
}

export async function ask(sessionId, question) {
  const s = getSession(sessionId);

  if (!s.docs.length) {
    throw new Error("Please upload a document first.");
  }

  // Measure document search time
  const searchStart = Date.now();

  const hits = await s.store.similaritySearch(question, 4);

  console.log("Search ms:", Date.now() - searchStart);

  const context = hits
    .map(
      (h, i) =>
        `[${i + 1}] (${h.metadata.source}${
          h.metadata.page ? `, p.${h.metadata.page}` : ""
        })\n${h.pageContent}`
    )
    .join("\n\n");

  const history = s.history
    .slice(-6)
    .map((m) => `${m.role}: ${m.text}`)
    .join("\n");

  const prompt = `You are a document assistant. Answer ONLY using the context below.
If the answer is not in the context, reply exactly: "I couldn't find that in the uploaded documents."

Context:
${context}

Conversation so far:
${history || "(none)"}

Question: ${question}
Answer:`;

  // Measure Gemini response time
  const llmStart = Date.now();

  const res = await llm.invoke(prompt);

  console.log("Gemini response ms:", Date.now() - llmStart);

  const answer =
    typeof res.content === "string"
      ? res.content
      : res.content.map((c) => c.text ?? "").join("");

  const sources = [
    ...new Map(
      hits.map((h) => [
        `${h.metadata.source}|${h.metadata.page}`,
        {
          source: h.metadata.source,
          page: h.metadata.page,
          snippet: h.pageContent.slice(0, 160) + "…",
        },
      ])
    ).values(),
  ];

  s.history.push(
    { role: "user", text: question },
    { role: "assistant", text: answer }
  );

  return { answer, sources };
}

export function clearHistory(sessionId) {
  getSession(sessionId).history = [];
}
