// src/components/PlanetPage.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

/**
 * Reusable PlanetPage component
 * - Search removed
 * - Sorting removed (always shows newest first from backend)
 */
export default function PlanetPage({ planetName }) {
  const [searchFields] = useState("title,abstract");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  // filters / controls
  const [selectedCategory, setSelectedCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [hasPdfOnly, setHasPdfOnly] = useState(false);

  // stats
  const [statsLoading, setStatsLoading] = useState(true);
  const [topCategories, setTopCategories] = useState([]);
  const [timeline, setTimeline] = useState([]);

  const buildPayload = ({ p = 1 }) => {
    const effectiveQuery = planetName;
    const payload = {
      query: effectiveQuery,
      search_fields: searchFields,
      category: selectedCategory || undefined,
      page: p,
      per_page: perPage,
    };
    if (hasPdfOnly) payload.has_pdf = true;
    return payload;
  };

  const fetchPublications = useCallback(
    async ({ p = 1 } = {}) => {
      setLoading(true);
      try {
        const payload = buildPayload({ p });
        const data = await api.filterPublications(payload);
        const pubs = data.publications || [];

        setResults(pubs);
        setTotal(data.total || pubs.length || 0);
        setTotalPages(data.total_pages || Math.ceil((data.total || pubs.length || 0) / perPage) || 1);
        setPage(p);
      } catch (err) {
        console.error("Failed to fetch planet publications", err);
        setResults([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    [planetName, searchFields, selectedCategory, hasPdfOnly]
  );

  const fetchPlanetStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const samplePerPage = 200;
      const data = await api.filterPublications({
        query: planetName,
        search_fields: "title,abstract,keywords,categories",
        page: 1,
        per_page: samplePerPage,
      });
      const pubs = data.publications || [];

      const catCounts = {};
      const yearCounts = {};
      pubs.forEach((p) => {
        (p.categories || []).forEach((c) => {
          const key = (c || "").trim();
          if (!key) return;
          catCounts[key] = (catCounts[key] || 0) + 1;
        });
        const y = p.year || "Unknown";
        yearCounts[y] = (yearCounts[y] || 0) + 1;
      });

      const topCats = Object.entries(catCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));
      setTopCategories(topCats);

      const years = Object.entries(yearCounts)
        .filter(([yr]) => yr !== "Unknown")
        .map(([yr, c]) => ({ year: Number(yr), count: c }))
        .sort((a, b) => a.year - b.year);
      setTimeline(years);
    } catch (err) {
      console.error("Failed to load planet stats", err);
      setTopCategories([]);
      setTimeline([]);
    } finally {
      setStatsLoading(false);
    }
  }, [planetName]);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      try {
        if (api.getCategories) {
          const catsRes = await api.getCategories();
          if (mounted) setCategories((catsRes.categories || []).map((c) => c.name));
        } else {
          const r = await fetch("/categories");
          const json = await r.json();
          if (mounted) setCategories((json.categories || []).map((c) => c.name));
        }
      } catch (err) {
        console.warn("Failed to bootstrap categories", err);
      }
    };
    boot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    fetchPublications({ p: 1 });
    fetchPlanetStats();
  }, [fetchPublications, fetchPlanetStats]);

  const gotoPage = (p) => {
    if (p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    fetchPublications({ p });
  };

  const clearFilters = () => {
    setSelectedCategory("");
    setHasPdfOnly(false);
    fetchPublications({ p: 1 });
  };

  const handleDownloadPdf = (pmcidOrId) => {
    const pdfUrl = `/pdf/${pmcidOrId}`;
    window.open(pdfUrl, "_blank");
  };

  const exportResultsCsv = () => {
    if (!results || results.length === 0) {
      window.alert("No results to export");
      return;
    }
    const rows = results.map((r) => ({
      pmcid: r.pmcid,
      title: r.title,
      journal: r.journal,
      year: r.year,
      authors: (r.authors || []).join("; "),
      categories: (r.categories || []).join("; "),
      has_pdf: r.pdf_downloaded ? "yes" : "no",
      pdf_path: r.pdf_file_path || "",
    }));
    const header = Object.keys(rows[0]);
    const csv = [
      header.join(","),
      ...rows.map((row) =>
        header
          .map((h) => {
            const val = row[h] ?? "";
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${planetName}_publications_page${page}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const totalText = useMemo(() => (total || 0).toLocaleString(), [total]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold">{planetName} Bioscience Hub</h1>
          <p className="text-gray-600 mt-1">
            Curated research and analytics about biological experiments relevant to {planetName}.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="col-span-2 bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold">{planetName} Publications</h3>
                <div className="text-sm text-gray-600">Total (matching): {totalText}</div>
              </div>

              <div className="flex gap-2">
                <button
                  className="px-3 py-1 border rounded text-sm"
                  onClick={() => window.alert("RAG summary is not yet implemented — placeholder.")}
                >
                  Generate Knowledge Snapshot
                </button>
              </div>
            </div>

            <div className="flex gap-4">
              <div>
                <div className="text-sm text-gray-500">Top categories</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {statsLoading ? (
                    <div className="text-sm text-gray-500">Loading…</div>
                  ) : topCategories.length ? (
                    topCategories.map((c) => (
                      <button
                        key={c.name}
                        className="text-xs bg-gray-100 px-2 py-1 rounded"
                        onClick={() => {
                          setSelectedCategory(c.name);
                          fetchPublications({ p: 1 });
                        }}
                      >
                        {c.name} ({c.count})
                      </button>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500">No categories found</div>
                  )}
                </div>
              </div>

              <div className="ml-auto text-sm text-gray-500">
                <div>Timeline (sample)</div>
                <div className="mt-2">
                  {statsLoading ? (
                    <div>Loading…</div>
                  ) : timeline.length ? (
                    <div className="text-xs text-gray-600">{timeline.map((t) => `${t.year}:${t.count}`).join(" • ")}</div>
                  ) : (
                    <div className="text-xs text-gray-600">No timeline data</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <aside className="bg-white rounded-lg p-4 shadow-sm">
            <div className="font-semibold mb-2">Knowledge Snapshot</div>
            <p className="text-sm text-gray-600 mb-3">Short AI summaries and gap analyses will appear here when RAG is available.</p>
            <div className="text-sm">
              <button className="px-3 py-1 border rounded text-sm" disabled>
                Request snapshot (coming)
              </button>
            </div>
          </aside>
        </div>

        {/* FILTER BAR (search removed, only filters) */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                fetchPublications({ p: 1 });
              }}
              className="px-3 py-2 border rounded"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasPdfOnly}
                onChange={(e) => {
                  setHasPdfOnly(e.target.checked);
                  fetchPublications({ p: 1 });
                }}
              />
              Has PDF only
            </label>

            <button
              type="button"
              className="px-3 py-1 border rounded text-sm"
              onClick={clearFilters}
            >
              Clear filters
            </button>

            <div className="ml-auto">
              <button
                onClick={exportResultsCsv}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >
                Export page CSV
              </button>
            </div>
          </div>

          <div className="mt-3 text-sm text-gray-500">
            Showing publications for <strong>{planetName}</strong>.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-600">
              Loading publications…
            </div>
          ) : results.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-600">
              No publications found for this query.
            </div>
          ) : (
            results.map((pub) => (
              <article
                key={pub.pmcid || pub.pmid || pub.title}
                className="bg-white p-4 rounded-lg shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-md">{pub.title}</h4>
                    <div className="text-xs text-gray-500 mt-1">
                      {pub.journal} • {pub.year}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {pub.pmcid || pub.pmid}
                  </div>
                </div>

                <p className="text-sm text-gray-700 mt-3 line-clamp-3">
                  {pub.abstract ? pub.abstract : "No abstract available."}
                </p>

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    {pub.authors?.slice(0, 2).join(", ")}
                    {pub.authors?.length > 2 && " et al."}
                  </div>

                  <div className="flex items-center gap-3">
                    <a
                      href={
                        pub.source_url ||
                        `https://www.ncbi.nlm.nih.gov/pmc/articles/${pub.pmcid}/`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 underline"
                    >
                      View Full Page
                    </a>

                    <Link
                      to={`/publication/${pub.pmcid || pub.pmid}`}
                      state={{ category: planetName }}
                      className="text-sm text-gray-600"
                    >
                      Details
                    </Link>

                    {pub.pdf_downloaded ? (
                      <button
                        onClick={() =>
                          handleDownloadPdf(pub.pmcid || pub.pmid)
                        }
                        className="text-sm px-2 py-1 border rounded"
                      >
                        Download PDF
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">PDF N/A</span>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Page {page} of {totalPages} — {totalText} results
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => gotoPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded"
              >
                Prev
              </button>
              <button
                onClick={() => gotoPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
