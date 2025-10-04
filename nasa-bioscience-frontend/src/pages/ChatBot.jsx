// import React, { useEffect, useState, useRef } from "react";

// // A full-page React component to add to your pages/ folder (Next.js or CRA compatible)
// // - Tailwind CSS assumed
// // - Uses your FastAPI backend endpoints:
// //    GET  /papers, /paper/:pmcid, /search, /stats
// //    POST /api/qurobot/query  { text }
// //    POST /api/qurobot/upload_pdf { pdf_path }
// // - Drop this file into pages/research-assistant.jsx (Next.js) or src/ResearchAssistant.jsx

// export default function ResearchAssistantPage() {
//   const [query, setQuery] = useState("");
//   const [messages, setMessages] = useState([]); // {role: 'user'|'assistant', text, sources: []}
//   const [loading, setLoading] = useState(false);
//   const [papers, setPapers] = useState([]);
//   const [stats, setStats] = useState(null);
//   const [pdfPath, setPdfPath] = useState("");
//   const [mode, setMode] = useState("rag"); // rag or pdf
//   const fileInputRef = useRef(null);
//   const chatEndRef = useRef(null);

//   useEffect(() => {
//     fetchPapers();
//     fetchStats();
//   }, []);

//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [messages]);

//   async function fetchPapers() {
//     try {
//       const res = await fetch("http://127.0.0.1:8000/papers?page=1&per_page=10");
//       const data = await res.json();
//       setPapers(data.publications || []);
//     } catch (e) {
//       console.error(e);
//     }
//   }

//   async function fetchStats() {
//     try {
//       const res = await fetch("http://127.0.0.1:8000/stats");
//       const data = await res.json();
//       setStats(data);
//     } catch (e) {
//       console.error(e);
//     }
//   }

//   async function handleSend() {
//     if (!query.trim()) return;
//     const userMsg = { role: "user", text: query };
//     setMessages((m) => [...m, userMsg]);
//     setQuery("");
//     setLoading(true);

//     try {
//       const payload = { text: query };
//       console.log("Sending request with payload:", payload);
//       const res = await fetch("http://127.0.0.1:8000/api/qurobot/query", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       console.log("Response status:", res.status);
//       console.log("Response ok:", res.ok);

//       if (!res.ok) {
//         const err = await res.json();
//         console.error("API Error:", err);
//         throw new Error(err.detail || "Query failed");
//       }

//       const data = await res.json();
      
//       // Debug logging
//       console.log("API Response:", data);
//       console.log("Reply text:", data.reply);
//       console.log("Meta:", data.meta);

//       // qurobot_api returns { reply: string, meta: {...} }
//       const assistantText = data.reply || "(no reply)";

//       // Try to extract simple sources/links by regex (if backend includes them in reply)
//       const sources = data.meta?.sources || [];

//       const assistantMsg = { role: "assistant", text: assistantText, sources };
//       console.log("Assistant message:", assistantMsg);
//       setMessages((m) => [...m, assistantMsg]);
//     } catch (e) {
//       console.error(e);
//       setMessages((m) => [...m, { role: "assistant", text: `Error: ${e.message}` }]);
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function handleUploadPdfFile(event) {
//     const file = event.target.files?.[0];
//     if (!file) return;

//     // We'll use a simple approach: upload the file to the server via a temporary endpoint
//     // If your backend expects a server-side path, you can instead request the frontend to
//     // upload the file to some storage and pass the path to /api/qurobot/upload_pdf.

//     // This example POSTs FormData to /upload-temp-pdf (you must implement it server-side)
//     const form = new FormData();
//     form.append("file", file);

//     try {
//       setLoading(true);
//       const res = await fetch("/upload-temp-pdf", {
//         method: "POST",
//         body: form,
//       });
//       if (!res.ok) throw new Error("Upload failed");
//       const json = await res.json();
//       // backend should return { path: "/path/on/server/file.pdf" }
//       const serverPath = json.path;
//       setPdfPath(serverPath || "");

//       // tell qurobot to switch to pdf mode by uploading path
//       const up = await fetch("http://127.0.0.1:8000/api/qurobot/upload_pdf", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ pdf_path: serverPath }),
//       });
//       if (!up.ok) {
//         const err = await up.json();
//         throw new Error(err.detail || "upload_pdf failed");
//       }

//       setMode("pdf");
//       setMessages((m) => [...m, { role: "assistant", text: "PDF uploaded — switched to PDF mode." }]);
//     } catch (e) {
//       console.error(e);
//       setMessages((m) => [...m, { role: "assistant", text: `PDF upload failed: ${e.message}` }]);
//     } finally {
//       setLoading(false);
//       // reset file input so same file can be uploaded again if needed
//       if (fileInputRef.current) fileInputRef.current.value = "";
//     }
//   }

//   function renderMessage(msg, i) {
//     const isUser = msg.role === "user";
//     return (
//       <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
//         <div className={`${isUser ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-900"} p-3 rounded-lg max-w-[75%]`}> 
//           <div className="whitespace-pre-wrap">{msg.text}</div>
//           {msg.sources && msg.sources.length > 0 && (
//             <div className="mt-2 text-xs text-gray-600">
//               Sources:
//               <ul className="list-disc ml-5">
//                 {msg.sources.map((s, idx) => (
//                   <li key={idx}>
//                     <a className="underline" href={s} target="_blank" rel="noreferrer">{s}</a>
//                   </li>
//                 ))}
//               </ul>
//             </div>
//           )}
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen p-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
//       <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">
//         {/* Left column: chat + controls */}
//         <div className="col-span-8 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow">
//           <div className="flex items-center justify-between mb-4">
//             <h1 className="text-2xl font-semibold">Research Assistant</h1>
//             <div className="flex items-center gap-3">
//               <span className="text-sm">Mode:</span>
//               <button
//                 onClick={() => { setMode("rag"); setMessages((m) => [...m, { role: "assistant", text: "Switched to RAG mode." }]); }}
//                 className={`px-3 py-1 rounded ${mode === "rag" ? "bg-sky-600 text-white" : "bg-gray-200"}`}
//               >RAG</button>
//               <button
//                 onClick={() => { setMode("pdf"); setMessages((m) => [...m, { role: "assistant", text: "Please upload a PDF to use PDF mode." }]); }}
//                 className={`px-3 py-1 rounded ${mode === "pdf" ? "bg-sky-600 text-white" : "bg-gray-200"}`}
//               >PDF</button>
//             </div>
//           </div>

//           <div className="h-[60vh] overflow-auto p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-white to-gray-50 dark:from-gray-800 dark:to-gray-800">
//             {messages.length === 0 && (
//               <div className="text-sm text-gray-500">Ask a question about the publications or upload a paper to query a specific PDF.</div>
//             )}
//             <div className="space-y-3">
//               {messages.map((m, i) => renderMessage(m, i))}
//               <div ref={chatEndRef} />
//             </div>
//           </div>

//           <div className="mt-4 flex gap-3">
//             <input
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//               onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
//               placeholder={mode === "pdf" ? "Ask about the uploaded PDF..." : "Ask about the publications database..."}
//               className="flex-1 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700"
//             />
//             <button onClick={handleSend} className="px-4 py-2 rounded-lg bg-sky-600 text-white" disabled={loading}>{loading ? "..." : "Send"}</button>
//             <label className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 cursor-pointer">
//               Upload PDF
//               <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleUploadPdfFile} className="hidden" />
//             </label>
//           </div>

//         </div>

//         {/* Right column: publications list + stats */}
//         <div className="col-span-4 space-y-6">
//           <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
//             <h2 className="text-lg font-medium mb-3">Top Publications</h2>
//             <div className="space-y-3 max-h-60 overflow-auto">
//               {papers.length === 0 && <div className="text-sm text-gray-500">No papers loaded.</div>}
//               {papers.map((p) => (
//                 <div key={p.pmcid} className="p-3 border rounded hover:shadow-sm">
//                   <div className="font-semibold">{p.title}</div>
//                   <div className="text-sm text-gray-500">{(p.authors || []).slice(0,2).join(", ")} {p.year ? `· ${p.year}` : ""}</div>
//                   <div className="mt-2 flex gap-2">
//                     <a className="text-xs underline" href={`/paper/${p.pmcid}`}>Details</a>
//                     {p.pdf_downloaded && <a className="text-xs underline" href={`/pdf/${p.pmcid}`} target="_blank">PDF</a>}
//                     <button
//                       onClick={() => {
//                         setMessages((m) => [...m, { role: "assistant", text: `Showing details for ${p.title}` }]);
//                         setQuery(`Give me a summary of the paper titled \"${p.title}\"`);
//                       }}
//                       className="text-xs px-2 py-1 rounded bg-gray-100"
//                     >Ask</button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>

//           <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
//             <h2 className="text-lg font-medium mb-3">Repository Stats</h2>
//             {stats ? (
//               <div className="text-sm space-y-2">
//                 <div>Total publications: <strong>{stats.total_publications}</strong></div>
//                 <div>PDFs available: <strong>{stats.pdf_statistics?.total_pdfs_downloaded}</strong></div>
//                 <div>Year range: <strong>{stats.year_range?.min} - {stats.year_range?.max}</strong></div>
//                 <div>Top categories:</div>
//                 <ul className="list-disc ml-5 text-sm">
//                   {(stats.top_categories || []).slice(0,5).map((c, i) => <li key={i}>{c.name} ({c.count})</li>)}
//                 </ul>
//               </div>
//             ) : (
//               <div className="text-sm text-gray-500">Loading stats...</div>
//             )}
//           </div>

//           <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow">
//             <h2 className="text-lg font-medium mb-3">Quick Actions</h2>
//             <div className="flex flex-col gap-2">
//               <button onClick={() => { setMessages([]); setMode('rag'); }} className="px-3 py-2 bg-gray-100 rounded">Clear Conversation & Reset to RAG</button>
//               <button onClick={() => fetchPapers()} className="px-3 py-2 bg-gray-100 rounded">Refresh Publications</button>
//               <button onClick={() => fetchStats()} className="px-3 py-2 bg-gray-100 rounded">Refresh Stats</button>
//             </div>
//           </div>
//         </div>

//       </div>
//     </div>
//   );
// }
import React, { useEffect, useState, useRef } from "react";

export default function ResearchAssistantPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [papers, setPapers] = useState([]);
  const [stats, setStats] = useState(null);
  const [pdfPath, setPdfPath] = useState("");
  const [mode, setMode] = useState("rag");
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchPapers();
    fetchStats();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      const res = await fetch("http://127.0.0.1:8000/api/qurobot/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Query failed");
      }

      const data = await res.json();
      const assistantText = data.reply || "(no reply)";
      const sources = data.meta?.sources || [];
      const assistantMsg = { role: "assistant", text: assistantText, sources };
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

    const form = new FormData();
    form.append("file", file);

    try {
      setLoading(true);
      const res = await fetch("/upload-temp-pdf", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const json = await res.json();
      const serverPath = json.path;
      setPdfPath(serverPath || "");

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
      setMessages((m) => [...m, { role: "assistant", text: "PDF uploaded — switched to PDF mode." }]);
    } catch (e) {
      console.error(e);
      setMessages((m) => [...m, { role: "assistant", text: `PDF upload failed: ${e.message}` }]);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function renderMessage(msg, i) {
    const isUser = msg.role === "user";
    return (
      <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div className={`${isUser ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-900"} p-3 rounded-lg max-w-[75%]`}>
          <div className="whitespace-pre-wrap">{msg.text}</div>
          {msg.sources && msg.sources.length > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              Sources:
              <ul className="list-disc ml-5">
                {msg.sources.map((s, idx) => (
                  <li key={idx}>
                    <a className="underline text-blue-600" href={s} target="_blank" rel="noreferrer">{s}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 bg-gray-100 text-gray-900">
      <div className="max-w-7xl mx-auto grid grid-cols-12 gap-6">
        {/* Left column */}
        <div className="col-span-8 bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-semibold text-gray-800">Research Assistant</h1>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">Mode:</span>
              <button
                onClick={() => { setMode("rag"); setMessages((m) => [...m, { role: "assistant", text: "Switched to RAG mode." }]); }}
                className={`px-3 py-1 rounded ${mode === "rag" ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-700"}`}
              >RAG</button>
              <button
                onClick={() => { setMode("pdf"); setMessages((m) => [...m, { role: "assistant", text: "Please upload a PDF to use PDF mode." }]); }}
                className={`px-3 py-1 rounded ${mode === "pdf" ? "bg-gray-700 text-white" : "bg-gray-200 text-gray-700"}`}
              >PDF</button>
            </div>
          </div>

          <div className="h-[60vh] overflow-auto p-4 rounded-lg border border-gray-200 bg-gray-50">
            {messages.length === 0 && (
              <div className="text-sm text-gray-500">
                Ask a question about the publications or upload a paper to query a specific PDF.
              </div>
            )}
            <div className="space-y-3">
              {messages.map((m, i) => renderMessage(m, i))}
              <div ref={chatEndRef} />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              placeholder={mode === "pdf" ? "Ask about the uploaded PDF..." : "Ask about the publications database..."}
              className="flex-1 p-3 rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-gray-400 outline-none"
            />
            <button
              onClick={handleSend}
              className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
              disabled={loading}
            >
              {loading ? "..." : "Send"}
            </button>
            <label className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 cursor-pointer text-gray-800">
              Upload PDF
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleUploadPdfFile} className="hidden" />
            </label>
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-4 space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium mb-3 text-gray-800">Top Publications</h2>
            <div className="space-y-3 max-h-60 overflow-auto">
              {papers.length === 0 && <div className="text-sm text-gray-500">No papers loaded.</div>}
              {papers.map((p) => (
                <div key={p.pmcid} className="p-3 border rounded hover:shadow-sm bg-gray-50">
                  <div className="font-semibold text-gray-800">{p.title}</div>
                  <div className="text-sm text-gray-500">{(p.authors || []).slice(0, 2).join(", ")} {p.year ? `· ${p.year}` : ""}</div>
                  <div className="mt-2 flex gap-2">
                    <a className="text-xs underline text-blue-600" href={`/paper/${p.pmcid}`}>Details</a>
                    {p.pdf_downloaded && <a className="text-xs underline text-blue-600" href={`/pdf/${p.pmcid}`} target="_blank">PDF</a>}
                    <button
                      onClick={() => {
                        setMessages((m) => [...m, { role: "assistant", text: `Showing details for ${p.title}` }]);
                        setQuery(`Give me a summary of the paper titled "${p.title}"`);
                      }}
                      className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >Ask</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium mb-3 text-gray-800">Repository Stats</h2>
            {stats ? (
              <div className="text-sm space-y-2 text-gray-700">
                <div>Total publications: <strong>{stats.total_publications}</strong></div>
                <div>PDFs available: <strong>{stats.pdf_statistics?.total_pdfs_downloaded}</strong></div>
                <div>Year range: <strong>{stats.year_range?.min} - {stats.year_range?.max}</strong></div>
                <div>Top categories:</div>
                <ul className="list-disc ml-5 text-sm">
                  {(stats.top_categories || []).slice(0, 5).map((c, i) => (
                    <li key={i}>{c.name} ({c.count})</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Loading stats...</div>
            )}
          </div>

          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium mb-3 text-gray-800">Quick Actions</h2>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setMessages([]); setMode("rag"); }} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-800">Clear Conversation & Reset to RAG</button>
              <button onClick={() => fetchPapers()} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-800">Refresh Publications</button>
              <button onClick={() => fetchStats()} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-800">Refresh Stats</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
