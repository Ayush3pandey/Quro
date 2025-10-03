// src/pages/PublicationDetail.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import api from "../services/api";
import BulkBar from "../components/BulkBar";
import { collectPdfLinks, openPdfLinks } from "../utils/pdfLinks";
import Search from "../pages/Search";
/**
 * PublicationDetail
 *
 * - Shows publication metadata
 * - Related area initially shows papers from same category (if available)
 * - Search input is empty by default
 * - Clearing category now loads unfiltered recent publications (and updates heading)
 * - Manual search still supported (scoped by category if present)
 */

const PublicationDetail = () => {
  const { pmcid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // publication metadata
  const [publication, setPublication] = useState(null);
  const [loadingPub, setLoadingPub] = useState(true);
  const [pubError, setPubError] = useState(null);

  // category context: prefer Link state, then query param, else publication's category will be used once loaded
  const qParams = new URLSearchParams(location.search);
  const incomingCategoryFromState = (location.state && location.state.category) ? location.state.category : null;
  const incomingCategoryFromQuery = qParams.get("category") || null;

  // category is the source of truth for scoping related results and search
  const [category, setCategory] = useState(incomingCategoryFromState || incomingCategoryFromQuery || null);

  // search UI
  const [query, setQuery] = useState(""); // initially empty
  const [searchFields, setSearchFields] = useState("title,abstract");

  // results (either related by category, or unfiltered recent, or manual search)
  const [results, setResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // flag: are we currently showing ALL/Recent publications? (true when category cleared and we load unfiltered)
  const [showingAll, setShowingAll] = useState(false);

  // bulk selection
  const [selectedMap, setSelectedMap] = useState({});
  const selectedList = Object.values(selectedMap);

  // fetch publication metadata
  useEffect(() => {
    const loadPublication = async () => {
      setLoadingPub(true);
      setPubError(null);
      try {
        const data = await api.getPublication(pmcid);
        if (!data) throw new Error("Publication not found");
        setPublication(data);

        // If we don't already have an incoming category, prefer the publication's first category
        if (!incomingCategoryFromState && !incomingCategoryFromQuery) {
          const pubCat = (Array.isArray(data.categories) && data.categories.length) ? data.categories[0] : null;
          if (pubCat) {
            setCategory(pubCat);
            setShowingAll(false);
          } else {
            // no category available — load recent publications to populate area
            await loadRecentPublications(1);
            setShowingAll(true);
          }
        } else {
          // If incoming category exists, we'll fetch related in effect below
          setShowingAll(false);
        }
      } catch (err) {
        console.error("Failed to load publication", err);
        setPubError("Publication not found or server error.");
        setPublication(null);
      } finally {
        setLoadingPub(false);
      }
    };

    if (pmcid) loadPublication();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pmcid]);

  // helper: fetch related by category (category-only)
  const fetchRelatedByCategory = useCallback(async (categoryToUse, pageToFetch = 1) => {
    setSearchLoading(true);
    try {
      if (!categoryToUse) {
        setResults([]);
        setTotalResults(0);
        setTotalPages(0);
        setPage(1);
        return;
      }
      const payload = { category: categoryToUse, page: pageToFetch, per_page: perPage };
      const data = await api.filterPublications(payload);
      let pubs = data.publications || [];
      // exclude current pmcid
      pubs = pubs.filter(p => p.pmcid !== pmcid);
      setResults(pubs);
      // adjust total: if API included current paper count, subtract 1 (safe clamp)
      const adjustedTotal = Math.max((data.total || 0) - (data.publications?.some(p => p.pmcid === pmcid) ? 1 : 0), pubs.length);
      setTotalResults(adjustedTotal);
      setTotalPages(data.total_pages || 1);
      setPage(pageToFetch);
      setSelectedMap({});
      setShowingAll(false);
    } catch (err) {
      console.error("Failed to fetch related by category:", err);
      setResults([]);
      setTotalResults(0);
      setTotalPages(0);
      setPage(1);
    } finally {
      setSearchLoading(false);
    }
  }, [pmcid]);

  // helper: load unfiltered recent publications (all)
  const loadRecentPublications = useCallback(async (pageToFetch = 1) => {
    setSearchLoading(true);
    try {
      const data = await api.getPublications(pageToFetch, perPage);
      let pubs = data.publications || [];
      // exclude current pmcid
      pubs = pubs.filter(p => p.pmcid !== pmcid);
      setResults(pubs);
      // API total excludes current? simple clamp to pubs.length if undefined
      setTotalResults(data.total ? Math.max(data.total - 1, pubs.length) : pubs.length);
      setTotalPages(data.total_pages || 1);
      setPage(pageToFetch);
      setSelectedMap({});
      setShowingAll(true);
    } catch (err) {
      console.error("Failed to load recent publications:", err);
      setResults([]);
      setTotalResults(0);
      setTotalPages(0);
      setPage(1);
    } finally {
      setSearchLoading(false);
    }
  }, [pmcid]);

  // whenever category changes (and category is set), fetch related by that category
  useEffect(() => {
    if (category) {
      fetchRelatedByCategory(category, 1);
    } else {
      // if no category and publication loaded, default to recent publications
      // (this keeps related area populated sensibly)
      loadRecentPublications(1);
    }
  }, [category, fetchRelatedByCategory, loadRecentPublications]);

  // manual search triggered by user
  const performManualSearch = async (pageToFetch = 1) => {
    setSearchLoading(true);
    try {
      const payload = {
        query: query?.trim() || undefined,
        search_fields: searchFields,
        page: pageToFetch,
        per_page: perPage
      };
      // maintain category scope if present
      if (category) payload.category = category;

      const data = await api.filterPublications(payload);
      let pubs = data.publications || [];
      pubs = pubs.filter(p => p.pmcid !== pmcid);
      setResults(pubs);
      setTotalResults(Math.max((data.total || 0) - 1, pubs.length));
      setTotalPages(data.total_pages || 1);
      setPage(pageToFetch);
      setSelectedMap({});
      setShowingAll(false); // manual search is not the "all recent" mode
    } catch (err) {
      console.error("Manual search failed:", err);
      setResults([]);
      setTotalResults(0);
      setTotalPages(0);
    } finally {
      setSearchLoading(false);
    }
  };

  // clear category: remove query param and load unfiltered recent publications
  const clearCategory = async () => {
    const params = new URLSearchParams(location.search);
    params.delete("category");
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : "" }, { replace: true });
    setCategory(null);
    // load unfiltered recent publications
    await loadRecentPublications(1);
  };

  // selection helpers
  const toggleSelect = (item) => {
    setSelectedMap(prev => {
      const copy = { ...prev };
      if (copy[item.pmcid]) delete copy[item.pmcid];
      else copy[item.pmcid] = item;
      return copy;
    });
  };

  const clearSelection = () => setSelectedMap({});

  const gotoPage = (p) => {
    if (p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    // three possible modes:
    // 1) user typed a manual query -> performManualSearch
    // 2) showingAll true -> loadRecentPublications
    // 3) otherwise -> fetchRelatedByCategory
    if (query && query.trim().length > 0) performManualSearch(p);
    else if (showingAll) loadRecentPublications(p);
    else fetchRelatedByCategory(category, p);
  };

  const handleOpenPdfs = (items) => {
    const links = collectPdfLinks(items, api.baseURL || "http://localhost:8000");
    if (links.length === 0) {
      window.alert("No PDF links available for selected items.");
      return;
    }
    if (links.length > 8 && !window.confirm(`Open ${links.length} PDF tabs? This may open many browser tabs.`)) return;
    openPdfLinks(links);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="px-3 py-1 border rounded">← Back</button>
          <h1 className="text-2xl font-semibold">Publication</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {loadingPub ? (
            <div className="py-8 text-center text-gray-600">Loading publication…</div>
          ) : pubError ? (
            <div className="py-8 text-center text-red-600">{pubError}</div>
          ) : publication ? (
            <>
              <div className="mb-4">
                <h2 className="text-xl font-bold">{publication.title}</h2>
                <div className="text-sm text-gray-600 mt-1">
                  <span>{publication.journal}</span>
                  {publication.year && <span> • {publication.year}</span>}
                  {publication.pmcid && <span> • {publication.pmcid}</span>}
                </div>
              </div>

              <div className="text-sm text-gray-700 leading-relaxed mb-4">
                {publication.abstract ? publication.abstract : "No abstract available."}
              </div>

              <div className="flex items-center gap-3">
                {publication.pdf_downloaded && (
                  <a href={api.getPdfUrl(publication.pmcid)} target="_blank" rel="noopener noreferrer" className="inline-block px-3 py-2 bg-green-600 text-white rounded">Open PDF</a>
                )}
                <a
                  href={publication.source_url || `https://www.ncbi.nlm.nih.gov/pmc/articles/${publication.pmcid}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline"
                >
                  View Full Page
                </a>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-gray-500">No publication selected.</div>
          )}
        </div>

        {/* compact search bar (EMPTY initially) */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <form onSubmit={(e) => { e.preventDefault(); performManualSearch(1); }}>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Search publications (leave empty to keep category-only related / see recent)"
                className="flex-1 px-4 py-2 border rounded"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />

              <select value={searchFields} onChange={(e) => setSearchFields(e.target.value)} className="px-3 py-2 border rounded">
                <option value="title,abstract">Title & Abstract</option>
                <option value="title,abstract,authors">Title, Abstract & Authors</option>
                <option value="title,abstract,authors,keywords">All fields</option>
                <option value="title">Title only</option>
                <option value="authors">Authors only</option>
              </select>

              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Search</button>
            </div>
          </form>

          {category && (
            <div className="mt-3 flex items-center gap-2">
              <div className="text-sm bg-blue-50 text-blue-800 px-3 py-1 rounded-full">Category: {category}</div>
              <button onClick={clearCategory} className="text-sm text-gray-600 underline">Clear</button>
            </div>
          )}
        </div>

        {/* related / recent / manual-search results */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">
                {query && query.trim().length > 0 ? "Search Results" : (showingAll ? "Recent Publications" : "Related Publications")}
              </h3>
              <div className="text-sm text-gray-600">{totalResults.toLocaleString()} result{totalResults !== 1 ? "s" : ""}</div>
            </div>
          </div>

          {searchLoading ? (
            <div className="py-8 text-center text-gray-600">Loading…</div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-gray-500">{showingAll ? "No recent publications found." : "No related results found."}</div>
          ) : (
            <div className="space-y-4">
              {results.map((pub) => (
                <div key={pub.pmcid} className="border-l-4 border-blue-500 pl-6 py-4 rounded-r-lg">
                  <div className="flex items-start justify-between mb-2">
                    <label className="inline-flex items-center space-x-2">
                      <input type="checkbox" checked={!!selectedMap[pub.pmcid]} onChange={() => toggleSelect(pub)} className="form-checkbox h-4 w-4" />
                      <span className="text-xs text-gray-500">{pub.pmcid}</span>
                    </label>

                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-4">{pub.year}</span>
                  </div>

                  <div className="mb-2">
                    <Link to={`/publication/${pub.pmcid}`} state={category ? { category } : undefined} className="font-semibold text-lg text-gray-900 hover:text-blue-600">{pub.title}</Link>
                  </div>

                  <div className="text-sm text-gray-600 mb-2">
                    <div><strong>Authors:</strong> {pub.authors?.slice(0,4).join(', ')}{pub.authors?.length > 4 && ' et al.'}</div>
                    <div><strong>Journal:</strong> {pub.journal}</div>
                  </div>

                  <p className="text-gray-700">{pub.abstract ? `${pub.abstract.substring(0,200)}...` : 'No abstract available.'}</p>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <div className="text-sm text-gray-700">Page {page} of {totalPages}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => gotoPage(page - 1)} disabled={page === 1} className="px-3 py-2 border rounded disabled:opacity-50">Prev</button>
                <button onClick={() => gotoPage(page + 1)} disabled={page === totalPages} className="px-3 py-2 border rounded disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </div>

        {/* bulk actions */}
        {selectedList.length > 0 && (
          <BulkBar selected={selectedList} onClear={clearSelection} onOpenPdfLinks={handleOpenPdfs} />
        )}
      </div>
    </div>
  );
};

export default PublicationDetail;
