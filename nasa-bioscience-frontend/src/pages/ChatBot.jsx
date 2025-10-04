import React, { useEffect, useState, useRef } from "react";

// A full-page React component to add to your pages/ folder (Next.js or CRA compatible)
// - Tailwind CSS assumed
// - Uses your FastAPI backend endpoints:
//    GET  /papers, /paper/:pmcid, /search, /stats
//    POST /api/qurobot/query  { text }
//    POST /api/qurobot/upload_pdf { pdf_path }
// - Drop this file into pages/research-assistant.jsx (Next.js) or src/ResearchAssistant.jsx

export default function ResearchAssistantPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]); // {role: 'user'|'assistant', text, sources: []}
  const [loading, setLoading] = useState(false);
  const [papers, setPapers] = useState([]);
  const [stats, setStats] = useState(null);
  const [pdfPath, setPdfPath] = useState("");
  const [mode, setMode] = useState("rag"); // rag or pdf
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchPapers();
    fetchStats();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function fetchPapers() {
    try {
      const res = await fetch("http://127.0.0.1:8000/papers?page=1&per_page=10");
      const data = await res.json();
      setPapers(data.publications || []);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch("http://127.0.0.1:8000/stats");
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSend() {
    if (!query.trim()) return;
    const userMsg = { role: "user", text: query };
    setMessages((m) => [...m, userMsg]);
    setQuery("");
    setLoading(true);

    try {
      const payload = { text: query };
      console.log("Sending request with payload:", payload);
      const res = await fetch("http://127.0.0.1:8000/api/qurobot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("Response status:", res.status);
      console.log("Response ok:", res.ok);

      if (!res.ok) {
        const err = await res.json();
        console.error("API Error:", err);
        throw new Error(err.detail || "Query failed");
      }

      const data = await res.json();
      
      // Debug logging
      console.log("API Response:", data);
      console.log("Reply text:", data.reply);
      console.log("Meta:", data.meta);

      // qurobot_api returns { reply: string, meta: {...} }
      const assistantText = data.reply || "(no reply)";

      // Try to extract simple sources/links by regex (if backend includes them in reply)
      const sources = data.meta?.sources || [];

      const assistantMsg = { role: "assistant", text: assistantText, sources };
      console.log("Assistant message:", assistantMsg);
      setMessages((m) => [...m, assistantMsg]);
    } catch (e) {
      console.error(e);
      setMessages((m) => [...m, { role: "assistant", text: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadPdfFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      setMessages((m) => [...m, { role: "assistant", text: "Please select a PDF file." }]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Upload the file to the server via the temporary endpoint
    const form = new FormData();
    form.append("file", file);

    try {
      setLoading(true);
      
      // First, upload the file to the server
      const res = await fetch("http://127.0.0.1:8000/upload-temp-pdf", {
        method: "POST",
        body: form,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: "Upload failed" }));
        throw new Error(errorData.detail || "Upload failed");
      }
      
      const json = await res.json();
      // backend returns { path: "/path/on/server/file.pdf" }
      const serverPath = json.path;
      setPdfPath(serverPath || "");

      // Now tell qurobot to switch to pdf mode by uploading the server path
      const up = await fetch("http://127.0.0.1:8000/api/qurobot/upload_pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf_path: serverPath }),
      });
      
      if (!up.ok) {
        const err = await up.json();
        throw new Error(err.detail || "upload_pdf failed");
      }

      setMode("pdf");
      setMessages((m) => [...m, { role: "assistant", text: "PDF uploaded successfully — switched to PDF mode. You can now ask questions about the document." }]);
    } catch (e) {
      console.error(e);
      setMessages((m) => [...m, { role: "assistant", text: `PDF upload failed: ${e.message}` }]);
    } finally {
      setLoading(false);
      // reset file input so same file can be uploaded again if needed
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function renderMessage(msg, i) {
    const isUser = msg.role === "user";
    return (
      <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`${isUser ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-900"} p-3 rounded-lg max-w-[75%]`}> 
          <div className="whitespace-pre-wrap">{msg.text}</div>
          {msg.sources && msg.sources.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              Sources:
              <ul className="list-disc ml-5">
                {msg.sources.map((s, idx) => (
                  <li key={idx}>
                    <a className="underline" href={s} target="_blank" rel="noreferrer">{s}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderLoadingIndicator() {
    return (
      <div className="flex justify-start">
        <div className="bg-gray-100 text-gray-900 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-sm text-gray-500">Thinking...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        {/* Left column: chat + controls */}
        <div className="lg:col-span-8 bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-6 shadow">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h1 className="text-xl md:text-2xl font-semibold">Research Assistant</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm">Mode:</span>
              <button
                onClick={() => { setMode("rag"); setMessages((m) => [...m, { role: "assistant", text: "Switched to RAG mode." }]); }}
                className={`px-3 py-1 rounded text-sm ${mode === "rag" ? "bg-sky-600 text-white" : "bg-gray-200"}`}
              >RAG</button>
              <button
                onClick={() => { setMode("pdf"); setMessages((m) => [...m, { role: "assistant", text: "Please upload a PDF to use PDF mode." }]); }}
                className={`px-3 py-1 rounded text-sm ${mode === "pdf" ? "bg-sky-600 text-white" : "bg-gray-200"}`}
              >PDF</button>
            </div>
          </div>

          <div className="h-[50vh] sm:h-[55vh] md:h-[60vh] overflow-auto p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-800">
            {messages.length === 0 && !loading && (
              <div className="text-sm text-gray-500">Ask a question about the publications or upload a paper to query a specific PDF.</div>
            )}
            <div className="space-y-3">
              {messages.map((m, i) => renderMessage(m, i))}
              {loading && renderLoadingIndicator()}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder={mode === "pdf" ? "Ask about the uploaded PDF..." : "Ask about the publications database..."}
              className="flex-1 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700 text-sm md:text-base"
              disabled={loading}
            />
            <div className="flex gap-3">
              <button onClick={handleSend} className="flex-1 sm:flex-none px-4 py-2 rounded-lg bg-sky-600 text-white text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading}>{loading ? "..." : "Send"}</button>
              <label className={`flex-1 sm:flex-none px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-center text-sm md:text-base ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                Upload PDF
                <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleUploadPdfFile} className="hidden" disabled={loading} />
              </label>
            </div>
          </div>

        </div>

        {/* Right column: publications list + stats */}
        <div className="lg:col-span-4 space-y-4 md:space-y-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
            <h2 className="text-base md:text-lg font-medium mb-3">Top Publications</h2>
            <div className="space-y-3 max-h-60 overflow-auto">
              {papers.length === 0 && <div className="text-sm text-gray-500">No papers loaded.</div>}
              {papers.map((p) => (
                <div key={p.pmcid} className="p-3 border rounded hover:shadow-sm">
                  <div className="font-semibold text-sm md:text-base">{p.title}</div>
                  <div className="text-xs md:text-sm text-gray-500">{(p.authors || []).slice(0,2).join(", ")} {p.year ? `· ${p.year}` : ""}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <a className="text-xs underline" href={`/paper/${p.pmcid}`}>Details</a>
                    {p.pdf_downloaded && <a className="text-xs underline" href={`/pdf/${p.pmcid}`} target="_blank">PDF</a>}
                    <button
                      onClick={() => {
                        setMessages((m) => [...m, { role: "assistant", text: `Showing details for ${p.title}` }]);
                        setQuery(`Give me a summary of the paper titled \"${p.title}\"`);
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-100"
                    >Ask</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
            <h2 className="text-base md:text-lg font-medium mb-3">Repository Stats</h2>
            {stats ? (
              <div className="text-xs md:text-sm space-y-2">
                <div>Total publications: <strong>{stats.total_publications}</strong></div>
                <div>PDFs available: <strong>{stats.pdf_statistics?.total_pdfs_downloaded}</strong></div>
                <div>Year range: <strong>{stats.year_range?.min} - {stats.year_range?.max}</strong></div>
                <div>Top categories:</div>
                <ul className="list-disc ml-5 text-xs md:text-sm">
                  {(stats.top_categories || []).slice(0,5).map((c, i) => <li key={i}>{c.name} ({c.count})</li>)}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Loading stats...</div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
            <h2 className="text-base md:text-lg font-medium mb-3">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setMessages([]); setMode('rag'); }} className="px-3 py-2 bg-gray-100 rounded text-sm md:text-base text-left">Clear Conversation & Reset to RAG</button>
              <button onClick={() => fetchPapers()} className="px-3 py-2 bg-gray-100 rounded text-sm md:text-base text-left">Refresh Publications</button>
              <button onClick={() => fetchStats()} className="px-3 py-2 bg-gray-100 rounded text-sm md:text-base text-left">Refresh Stats</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}