// src/pages/Publications.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import BulkBar from "../components/BulkBar";
import { collectPdfLinks, openPdfLinks } from "../utils/pdfLinks";
import Search from "../pages/Search";
import { useProgress } from "../context/ProgressContext";

const Publications = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const qParams = new URLSearchParams(location.search);

  const incomingCategoryFromQuery = qParams.get("category") || null;
  const incomingCategoryFromState = location.state && location.state.category ? location.state.category : null;

  // Progress context
  const { progress, updateProgress } = useProgress();

  // savedSelectedIdsRef will hold restored selected ids until results arrive
  const restoredSelectedIdsRef = useRef(null);

  const [category, setCategory] = useState(incomingCategoryFromState || incomingCategoryFromQuery || null);

  const [query, setQuery] = useState("");
  const [searchFields, setSearchFields] = useState("title,abstract");
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [loading, setLoading] = useState(true);

  const [selectedMap, setSelectedMap] = useState({});
  const selectedList = Object.values(selectedMap);

  // Fetching function (same as before)
  const fetchPublicationsPayload = useCallback(
    async (payloadPage = 1, extraPayload = {}) => {
      setLoading(true);
      try {
        let data;
        if (Object.keys(extraPayload).length > 0) {
          data = await api.filterPublications({ page: payloadPage, per_page: perPage, ...extraPayload });
        } else if (category) {
          data = await api.filterPublications({ category, page: payloadPage, per_page: perPage });
        } else {
          data = await api.getPublications(payloadPage, perPage);
        }

        setResults(data.publications || []);
        setTotalResults(data.total || 0);
        setTotalPages(data.total_pages || 0);
        setPage(payloadPage);

        // If we restored selected ids earlier, rebuild selectedMap when results load
        if (restoredSelectedIdsRef.current && restoredSelectedIdsRef.current.length > 0) {
          const ids = new Set(restoredSelectedIdsRef.current);
          const rebuilt = {};
          (data.publications || []).forEach((p) => {
            if (ids.has(String(p.pmcid))) rebuilt[p.pmcid] = p;
          });
          setSelectedMap((prev) => ({ ...prev, ...rebuilt }));
          restoredSelectedIdsRef.current = null; // we've consumed the restore
        } else {
          // reset selection on new fetch
          setSelectedMap({});
        }
      } catch (err) {
        console.error("Failed to fetch publications:", err);
        setResults([]);
        setTotalResults(0);
        setTotalPages(0);
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  // On first mount: try to restore saved publications progress
  useEffect(() => {
    try {
      const saved = progress?.publications;
      if (saved) {
        if (typeof saved.category === "string") setCategory(saved.category || null);
        if (typeof saved.query === "string") setQuery(saved.query);
        if (typeof saved.searchFields === "string") setSearchFields(saved.searchFields);
        if (typeof saved.page === "number") setPage(saved.page);
        if (Array.isArray(saved.selectedIds)) {
          // store selected ids temporarily until results arrive (so we can rebuild selectedMap)
          restoredSelectedIdsRef.current = saved.selectedIds.map(String);
        }
        if (Array.isArray(saved.results) && saved.results.length > 0) {
          // restore results immediately for instant UI — they may be slightly stale
          setResults(saved.results);
          setTotalResults(saved.totalResults || saved.results.length);
          setTotalPages(saved.totalPages || 1);
        }
      }
    } catch (e) {
      // ignore restore errors
      // console.error("Failed to restore publications progress", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // When location/search changes, sync category and fetch
  useEffect(() => {
    const urlCategory = new URLSearchParams(location.search).get("category");
    const stateCategory = location.state && location.state.category ? location.state.category : null;
    const resolved = stateCategory || urlCategory || null;

    setCategory((prev) => (prev !== resolved ? resolved : prev));

    if (resolved !== category) {
      fetchPublicationsPayload(1, resolved ? { category: resolved } : {});
    } else {
      fetchPublicationsPayload(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.state]);

  const clearCategory = () => {
    const params = new URLSearchParams(location.search);
    params.delete("category");
    const searchString = params.toString();
    navigate({ pathname: location.pathname, search: searchString ? `?${searchString}` : "" }, { replace: true });
    setCategory(null);
    fetchPublicationsPayload(1);

    // clear persisted category & page
    try {
      updateProgress({ publications: { ...(progress?.publications || {}), category: null, page: 1 } });
    } catch (e) {}
  };

  const toggleSelect = (item) => {
    setSelectedMap((prev) => {
      const cp = { ...prev };
      if (cp[item.pmcid]) delete cp[item.pmcid];
      else cp[item.pmcid] = item;
      return cp;
    });
  };

  const clearSelection = () => {
    setSelectedMap({});
    // reflect in persisted state
    try {
      updateProgress({ publications: { ...(progress?.publications || {}), selectedIds: [] } });
    } catch (e) {}
  };

  const handleOpenSelectedPdfs = (items) => {
    const links = collectPdfLinks(items, api.baseURL || "http://localhost:8000");
    if (links.length === 0) {
      window.alert("No PDF links available for selected items.");
      return;
    }
    if (links.length > 8 && !window.confirm(`Open ${links.length} PDF tabs? This may open many browser tabs.`)) return;
    openPdfLinks(links);
  };

  const gotoPage = (p) => {
    if (p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    if (query && query.trim().length > 0) {
      fetchPublicationsPayload(p, { query: query.trim(), search_fields: searchFields, per_page: perPage });
    } else fetchPublicationsPayload(p);
  };

  const handleSearchResults = (data) => {
    setResults(data.publications || []);
    setTotalResults(data.total || 0);
    setTotalPages(data.total_pages || 0);
    setPage(data.page || 1);
    setSelectedMap({});
    setLoading(false);
  };

  // Persist key bits of state to progress (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        // store only ids for selections to keep payload small
        const selectedIds = Object.keys(selectedMap).map(String);
        updateProgress({
          publications: {
            category: category || null,
            query: query || "",
            searchFields: searchFields || "",
            page: page || 1,
            selectedIds,
            // optionally store results for faster restore (may be large)
            results: results || [],
            totalResults,
            totalPages,
          },
        });
      } catch (e) {
        console.error("Failed to save publications progress", e);
      }
    }, 700);

    return () => clearTimeout(t);
  }, [category, query, searchFields, page, selectedMap, results, totalResults, totalPages, updateProgress, progress]);

  // When results update, ensure selectedMap is consistent with saved selectedIds if any
  useEffect(() => {
    // If there was a restored selectedIds list waiting, try to reconstruct selectedMap
    if (restoredSelectedIdsRef.current && restoredSelectedIdsRef.current.length > 0 && results && results.length > 0) {
      const ids = new Set(restoredSelectedIdsRef.current);
      const rebuilt = {};
      results.forEach((p) => {
        if (ids.has(String(p.pmcid))) rebuilt[p.pmcid] = p;
      });
      setSelectedMap((prev) => ({ ...prev, ...rebuilt }));
      restoredSelectedIdsRef.current = null;
    }
  }, [results]);

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header Section - Responsive */}
        <div className="mb-6 sm:mb-8">
          <div className="border-b border-gray-200 pb-4 sm:pb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold text-gray-900 tracking-tight">Publications</h1>
            <p className="mt-2 text-xs sm:text-sm text-gray-600">
              {category ? `Filtered by category: "${category}"` : `Explore ${totalResults.toLocaleString()} research publications`}
            </p>
          </div>
        </div>

        {/* Search Section */}
        <div className="mb-6 sm:mb-8">
          <Search embed={true} initialCategory={category} initialQuery={query} initialSearchFields={searchFields} onResults={(data) => handleSearchResults(data)} />
        </div>

        {/* Results Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 mb-6 sm:mb-8">
          {loading ? (
            <div className="col-span-full text-center py-12 sm:py-16">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-4 text-sm text-gray-600">Loading publications...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="col-span-full text-center py-12 sm:py-16">
              <p className="text-sm sm:text-base text-gray-600">No publications found matching your criteria.</p>
            </div>
          ) : (
            results.map((pub) => (
              <div key={pub.pmcid} className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 lg:p-6 hover:border-gray-300 transition-colors duration-150">
                <div className="mb-3 sm:mb-4">
                  {/* Card Header - Responsive */}
                  <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
                    <span className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
                      {pub.pmcid}
                    </span>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 font-medium">{pub.year}</span>
                      {pub.pdf_downloaded && (
                        <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          PDF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title - Responsive */}
                  <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-2 sm:mb-3 line-clamp-2 leading-snug">{pub.title}</h3>

                  {/* Metadata - Responsive */}
                  <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                    <div className="text-xs sm:text-sm text-gray-600">
                      <span className="font-medium text-gray-700">Authors:</span>{" "}
                      <span className="text-gray-600">
                        {pub.authors?.slice(0, 2).join(", ")}
                        {pub.authors?.length > 2 && " et al."}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                      <span className="font-medium text-gray-700">Journal:</span> <span className="text-gray-600">{pub.journal}</span>
                    </div>
                  </div>
                </div>

                {/* Categories - Responsive */}
                {pub.categories && pub.categories.length > 0 && (
                  <div className="mb-3 sm:mb-4">
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {pub.categories.slice(0, 2).map((cat, i) => (
                        <span key={i} className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200">
                          {cat}
                        </span>
                      ))}
                      {pub.categories.length > 2 && (
                        <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs text-gray-500">+{pub.categories.length - 2}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer - Responsive */}
                <div className="pt-3 sm:pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="text-xs text-gray-500 line-clamp-2 sm:line-clamp-1 flex-1">
                    {pub.abstract ? `${pub.abstract.substring(0, 60)}...` : "No abstract available"}
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/publication/${pub.pmcid}`}
                      state={category ? { category } : undefined}
                      className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap sm:ml-4 self-end sm:self-auto"
                    >
                      View Details
                    </Link>

                    <button
                      onClick={() => toggleSelect(pub)}
                      className={`text-xs px-2 py-1 rounded ${selectedMap[pub.pmcid] ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"}`}
                    >
                      {selectedMap[pub.pmcid] ? "Selected" : "Select"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination - Responsive */}
        {totalPages > 1 && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
              {/* Page Info - Responsive */}
              <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">
                <span className="inline sm:inline">Page {page} of {totalPages}</span>
                <span className="hidden sm:inline"> </span>
                <span className="block sm:inline text-gray-500 mt-0.5 sm:mt-0">({totalResults.toLocaleString()} total results)</span>
              </div>
              
              {/* Pagination Controls - Responsive */}
              <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-center">
                <button
                  onClick={() => gotoPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </button>

                {/* Page Numbers - Hidden on mobile, shown on tablet+ */}
                <div className="hidden md:flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = Math.max(1, page - 2) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => gotoPage(pageNum)}
                        className={`min-w-[2.5rem] px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                          pageNum === page ? "bg-blue-600 text-white" : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                {/* Current Page Indicator - Shown on mobile only */}
                <div className="md:hidden flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded-md">
                  {page} / {totalPages}
                </div>

                <button
                  onClick={() => gotoPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BulkBar */}
        {selectedList.length > 0 && (
          <BulkBar selected={selectedList} onClear={clearSelection} onOpenPdfLinks={(items) => handleOpenSelectedPdfs(items)} />
        )}
      </div>
    </div>
  );
};

export default Publications;
