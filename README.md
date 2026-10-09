# DocChat – Responsive RAG Document Chatbot

Upload PDF / TXT / DOCX / CSV files and ask questions answered **only** from their content.

**Stack:** Node.js, Express, LangChain.js, Bootstrap 5, `MemoryVectorStore`, Google Gemini free tier (chat + embeddings).

## Setup
1. Install Node.js 18 or newer.
2. Get a free API key at https://aistudio.google.com/apikey
3. Run:
```bash
   npm install --legacy-peer-deps
```
4. Create a file named `.env` in the project root (see `.env.example`) and add your key:
```
   GOOGLE_API_KEY=your_key_here
   CHAT_MODEL=gemini-3.8-flash
   EMBEDDING_MODEL=gemini-embedding-001
   PORT=3000
```
5. Start the app:
```bash
   npm start
```
6. Open http://localhost:3000

## How it works (RAG)
1. **Upload**: the file is loaded by a format-specific LangChain loader.
2. **Split**: `RecursiveCharacterTextSplitter` (1000 characters, 150 overlap).
3. **Embed and store**: Gemini embeddings are saved in an in-memory vector store (one per browser session).
4. **Ask**: the top 4 similar chunks are retrieved, then the prompt tells the LLM to answer only from them. The answer and its source files and pages are returned.

## Features
- Responsive Bootstrap chat interface
- Upload PDF, TXT, DOCX, CSV
- Multiple documents, and removing documents
- Conversation history during the session
- Loading indicator while the answer is generated
- Source file and page shown for each answer
- Dark / light mode
- Clear chat
- Upload new documents without restarting
- Error handling for unsupported files, empty files and empty questions

## Project structure
```
server.js        Express API (upload, chat, clear, documents)
src/rag.js       Loaders, splitter, vector store, retrieval and LLM
public/          index.html, style.css, app.js
```

## Notes
- Data is stored in memory. Restarting the server clears all documents.
- Scanned (image-only) PDFs have no text and cannot be read.
- If Google retires a model, change `CHAT_MODEL` or `EMBEDDING_MODEL` in `.env`.