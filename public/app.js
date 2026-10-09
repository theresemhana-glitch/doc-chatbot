const $ = (s) => document.querySelector(s);
const sid = sessionStorage.sid || (sessionStorage.sid = crypto.randomUUID());
const headers = { "x-session-id": sid };

// ---- theme ----
const setTheme = (t) => {
  document.documentElement.dataset.bsTheme = t;
  localStorage.theme = t;
  $("#themeBtn i").className = t === "dark" ? "bi bi-sun" : "bi bi-moon-stars";
};
setTheme(localStorage.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
$("#themeBtn").onclick = () => setTheme(document.documentElement.dataset.bsTheme === "dark" ? "light" : "dark");

// ---- helpers ----
function showError(msg) {
  $("#alertBox").innerHTML = `<div class="alert alert-danger alert-dismissible py-2 mb-2">${msg.replace(/</g, "&lt;")}<button class="btn-close" data-bs-dismiss="alert"></button></div>`;
}
function addMessage(role, text, sources = []) {
  $("#empty")?.remove();
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  el.append(bubble);
  if (sources.length) {
    const s = document.createElement("div");
    s.className = "sources text-body-secondary";
    s.innerHTML = "<i class='bi bi-journal-text'></i> Sources: ";
    sources.forEach((src) => {
      const b = document.createElement("span");
      b.className = "badge text-bg-secondary me-1";
      b.textContent = src.source + (src.page ? ` · p.${src.page}` : "");
      b.title = src.snippet;
      s.append(b);
    });
    el.append(s);
  }
  $("#messages").append(el);
  $("#messages").scrollTop = $("#messages").scrollHeight;
  return el;
}
async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---- documents ----
function renderDocs(docs) {
  $("#docList").innerHTML = "";
  docs.forEach((name) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center px-0 bg-transparent";
    li.innerHTML = `<span class="text-truncate"><i class="bi bi-file-earmark me-1"></i></span>`;
    li.firstChild.append(name);
    const del = document.createElement("button");
    del.className = "btn btn-sm text-danger";
    del.innerHTML = "<i class='bi bi-x-lg'></i>";
    del.onclick = async () => renderDocs((await api(`/api/documents/${encodeURIComponent(name)}`, { method: "DELETE" })).documents);
    li.append(del);
    $("#docList").append(li);
  });
}
$("#fileInput").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  $("#uploadStatus").innerHTML = `<span class="spinner-border spinner-border-sm"></span> Processing ${file.name}…`;
  try {
    const data = await api("/api/upload", { method: "POST", body: fd });
    renderDocs(data.documents);
    $("#uploadStatus").innerHTML = `<span class="text-success">✓ ${data.chunks} chunks indexed</span>`;
  } catch (err) {
    $("#uploadStatus").textContent = "";
    showError(err.message);
  }
  e.target.value = "";
};

// ---- chat ----
$("#chatForm").onsubmit = async (e) => {
  e.preventDefault();
  const q = $("#question").value.trim();
  if (!q) return showError("Please enter a question.");
  $("#alertBox").innerHTML = "";
  addMessage("user", q);
  $("#question").value = "";
  $("#sendBtn").disabled = true;
  const loader = addMessage("ai", "");
  loader.querySelector(".bubble").innerHTML = "<div class='typing'><span></span><span></span><span></span></div>";
  try {
    const data = await api("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
    loader.remove();
    addMessage("ai", data.answer, data.sources);
  } catch (err) {
    loader.remove();
    showError(err.message);
  } finally {
    $("#sendBtn").disabled = false;
    $("#question").focus();
  }
};

$("#clearBtn").onclick = async () => {
  await api("/api/clear", { method: "POST" });
  $("#messages").innerHTML = `<div class="text-center text-body-secondary mt-5" id="empty"><i class="bi bi-chat-dots fs-1"></i><p>Chat cleared. Ask a new question.</p></div>`;
};

api("/api/documents").then((d) => renderDocs(d.documents));