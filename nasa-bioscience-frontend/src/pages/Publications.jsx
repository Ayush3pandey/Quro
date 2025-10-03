// // src/pages/Publications.jsx
// import React, { useEffect, useState, useCallback } from "react";
// import { Link, useLocation, useNavigate } from "react-router-dom";
// import api from "../services/api";
// import BulkBar from "../components/BulkBar";
// import { collectPdfLinks, openPdfLinks } from "../utils/pdfLinks";
// import Search from "../pages/Search";

// const Publications = () => {
//   const location = useLocation();
//   const navigate = useNavigate();
//   const qParams = new URLSearchParams(location.search);

//   // Read incoming category from query param or Link state (state preferred if present)
//   const incomingCategoryFromQuery = qParams.get("category") || null;
//   const incomingCategoryFromState = location.state && location.state.category ? location.state.category : null;
//   // component-level category state (source of truth for filtering within this component)
//   const [category, setCategory] = useState(incomingCategoryFromState || incomingCategoryFromQuery || null);

//   // listing / search state
//   const [query, setQuery] = useState("");
//   const [searchFields, setSearchFields] = useState("title,abstract");
//   const [results, setResults] = useState([]); // publications or search results
//   const [totalResults, setTotalResults] = useState(0);
//   const [totalPages, setTotalPages] = useState(0);
//   const [page, setPage] = useState(1);
//   const perPage = 12;
//   const [loading, setLoading] = useState(true);

//   // bulk selection
//   const [selectedMap, setSelectedMap] = useState({});
//   const selectedList = Object.values(selectedMap);

//   // Helper: fetch either filtered or general publications
//   const fetchPublicationsPayload = useCallback(
//     async (payloadPage = 1, extraPayload = {}) => {
//       setLoading(true);
//       try {
//         if (Object.keys(extraPayload).length > 0) {
//           // if explicit filter/search payload provided, use it
//           const data = await api.filterPublications({ page: payloadPage, per_page: perPage, ...extraPayload });
//           setResults(data.publications || []);
//           setTotalResults(data.total || 0);
//           setTotalPages(data.total_pages || 0);
//           setPage(payloadPage);
//         } else if (category) {
//           // if category is active, use it
//           const data = await api.filterPublications({ category, page: payloadPage, per_page: perPage });
//           setResults(data.publications || []);
//           setTotalResults(data.total || 0);
//           setTotalPages(data.total_pages || 0);
//           setPage(payloadPage);
//         } else {
//           // default: list publications
//           const data = await api.getPublications(payloadPage, perPage);
//           setResults(data.publications || []);
//           setTotalResults(data.total || 0);
//           setTotalPages(data.total_pages || 0);
//           setPage(payloadPage);
//         }
//         setSelectedMap({});
//       } catch (err) {
//         console.error("Failed to fetch publications:", err);
//         setResults([]);
//         setTotalResults(0);
//         setTotalPages(0);
//       } finally {
//         setLoading(false);
//       }
//     },
//     [category]
//   );

//   // Initial fetch and re-sync when URL or state changes.
//   // We also update component category when URL or Link state changes so component remains synced.
//   useEffect(() => {
//     const urlCategory = new URLSearchParams(location.search).get("category");
//     const stateCategory = location.state && location.state.category ? location.state.category : null;
//     const resolved = stateCategory || urlCategory || null;

//     // update component category state only if different
//     setCategory((prev) => (prev !== resolved ? resolved : prev));

//     // fetch using resolved category (fetchPublicationsPayload reads `category` from closure,
//     // but to be robust we pass resolved via extraPayload when resolved differs)
//     if (resolved !== category) {
//       // resolved changed (URL/state), fetch using resolved explicitly
//       fetchPublicationsPayload(1, resolved ? { category: resolved } : {});
//     } else {
//       // resolved equals current category — standard fetch
//       fetchPublicationsPayload(1);
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [location.search, location.state]); // run when URL query or Link state changes

//   // Explicit search / filter triggered by user
//   const performSearch = async (pageToFetch = 1) => {
//     setLoading(true);
//     try {
//       const payload = {
//         query: query?.trim() || undefined,
//         search_fields: searchFields,
//         page: pageToFetch,
//         per_page: perPage
//       };
//       if (category) payload.category = category;

//       const data = await api.filterPublications(payload);
//       setResults(data.publications || []);
//       setTotalResults(data.total || 0);
//       setTotalPages(data.total_pages || 0);
//       setPage(pageToFetch);
//       setSelectedMap({});
//     } catch (err) {
//       console.error("Search failed:", err);
//       setResults([]);
//       setTotalResults(0);
//       setTotalPages(0);
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Clear category: remove query param from URL and update component state & refetch
//   const clearCategory = () => {
//     // Remove category param from URL while preserving other params
//     const params = new URLSearchParams(location.search);
//     params.delete("category");
//     // navigate to same pathname with updated search (replace so back button isn't polluted)
//     const searchString = params.toString();
//     navigate({ pathname: location.pathname, search: searchString ? `?${searchString}` : "" }, { replace: true });

//     // Update local state and refetch unfiltered publications
//     setCategory(null);
//     // fetch default publications (no category)
//     fetchPublicationsPayload(1);
//   };

//   // Selection helpers
//   const toggleSelect = (item) => {
//     setSelectedMap((prev) => {
//       const cp = { ...prev };
//       if (cp[item.pmcid]) delete cp[item.pmcid];
//       else cp[item.pmcid] = item;
//       return cp;
//     });
//   };

//   const clearSelection = () => setSelectedMap({});

//   const handleOpenSelectedPdfs = (items) => {
//     const links = collectPdfLinks(items, api.baseURL || "http://localhost:8000");
//     if (links.length === 0) {
//       window.alert("No PDF links available for selected items.");
//       return;
//     }
//     if (links.length > 8 && !window.confirm(`Open ${links.length} PDF tabs? This may open many browser tabs.`)) return;
//     openPdfLinks(links);
//   };

//   const gotoPage = (p) => {
//     if (p < 1) p = 1;
//     if (p > totalPages) p = totalPages;
//     // If there's an active query (user search) use performSearch; else general fetch
//     if (query && query.trim().length > 0) performSearch(p);
//     else fetchPublicationsPayload(p);
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 p-8">
//       <div className="max-w-7xl mx-auto">
//         <div className="mb-6 flex items-center justify-between">
//           <div>
//             <h1 className="text-4xl font-bold text-gray-900 mb-1">Publications</h1>
//             <p className="text-gray-600">
//               {category ? `Publications in "${category}"` : `Browse ${totalResults.toLocaleString()} research papers`}
//             </p>
//           </div>

//           <div className="flex items-center gap-3">
//             {category && (
//               // now clearCategory actually removes the query param and refetches
//               <button onClick={clearCategory} className="text-sm text-gray-600 underline">
//                 Using category: {category} (click to clear)
//               </button>
//             )}
//             <Link to="/search" className="px-3 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50">
//               Advanced Search
//             </Link>
//           </div>
//         </div>

//         {/* Compact search bar */}
//         <div className="bg-white rounded-lg shadow p-4 mb-6">
//           <form
//             onSubmit={(e) => {
//               e.preventDefault();
//               performSearch(1);
//             }}
//           >
//             <div className="flex gap-3">
//               <input
//                 type="text"
//                 placeholder="Search publications (title, abstract, authors...)"
//                 className="flex-1 px-4 py-2 border rounded"
//                 value={query}
//                 onChange={(e) => setQuery(e.target.value)}
//               />

//               <select
//                 value={searchFields}
//                 onChange={(e) => setSearchFields(e.target.value)}
//                 className="px-3 py-2 border rounded"
//               >
//                 <option value="title,abstract">Title & Abstract</option>
//                 <option value="title,abstract,authors">Title, Abstract & Authors</option>
//                 <option value="title,abstract,authors,keywords">All fields</option>
//                 <option value="title">Title only</option>
//                 <option value="authors">Authors only</option>
//               </select>

//               <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">
//                 Search
//               </button>
//             </div>
//           </form>
//         </div>

//         {/* Results grid */}
//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
//           {loading ? (
//             <div className="col-span-full text-center py-12 text-gray-500">Loading…</div>
//           ) : results.length === 0 ? (
//             <div className="col-span-full text-center py-12 text-gray-500">No publications found.</div>
//           ) : (
//             results.map((pub) => (
//               <div key={pub.pmcid} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-all duration-200 hover:border-blue-200">
//                 <div className="mb-4">
//                   <div className="flex items-center justify-between mb-3">
//                     <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
//                       {pub.pmcid}
//                     </span>
//                     <div className="flex items-center space-x-2">
//                       <span className="text-xs text-gray-500">{pub.year}</span>
//                       {pub.pdf_downloaded && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">PDF</span>}
//                     </div>
//                   </div>

//                   <h3 className="font-semibold text-gray-900 text-lg mb-3 line-clamp-2 leading-tight">{pub.title}</h3>

//                   <div className="space-y-2 mb-4 text-sm text-gray-600">
//                     <div>
//                       <span className="font-medium">Authors:</span> {pub.authors?.slice(0, 2).join(", ")}{pub.authors?.length > 2 && " et al."}
//                     </div>
//                     <div>
//                       <span className="font-medium">Journal:</span> {pub.journal}
//                     </div>
//                   </div>
//                 </div>

//                 {pub.categories && pub.categories.length > 0 && (
//                   <div className="mb-4">
//                     <div className="flex flex-wrap gap-1">
//                       {pub.categories.slice(0, 2).map((cat, i) => (
//                         <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-medium">{cat}</span>
//                       ))}
//                       {pub.categories.length > 2 && <span className="text-xs text-gray-500 px-2 py-1">+{pub.categories.length - 2} more</span>}
//                     </div>
//                   </div>
//                 )}

//                 <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
//                   <div className="text-xs text-gray-500">{pub.abstract ? `${pub.abstract.substring(0, 50)}...` : "No abstract"}</div>

//                   {/* forward category context when linking to PublicationDetail */}
//                   <Link
//                     to={`/publication/${pub.pmcid}`}
//                     state={category ? { category } : undefined}
//                     className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
//                   >
//                     View Details →
//                   </Link>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>

//         {/* Pagination */}
//         {totalPages > 1 && (
//           <div className="bg-white rounded-lg shadow-sm border p-4">
//             <div className="flex items-center justify-between">
//               <div className="text-sm text-gray-700">Showing page {page} of {totalPages} ({totalResults.toLocaleString()} total)</div>
//               <div className="flex items-center space-x-2">
//                 <button onClick={() => gotoPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 border rounded-md text-sm disabled:opacity-50">Previous</button>

//                 <div className="flex items-center space-x-1">
//                   {[...Array(Math.min(5, totalPages))].map((_, i) => {
//                     const pageNum = Math.max(1, page - 2) + i;
//                     if (pageNum > totalPages) return null;
//                     return (
//                       <button
//                         key={pageNum}
//                         onClick={() => gotoPage(pageNum)}
//                         className={`px-3 py-2 text-sm rounded-md transition-colors ${pageNum === page ? "bg-blue-600 text-white" : "border border-gray-300 hover:bg-gray-50"}`}
//                       >
//                         {pageNum}
//                       </button>
//                     );
//                   })}
//                 </div>

//                 <button onClick={() => gotoPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-4 py-2 border rounded-md text-sm disabled:opacity-50">Next</button>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* BulkBar */}
//         {selectedList.length > 0 && (
//           <BulkBar
//             selected={selectedList}
//             onClear={clearSelection}
//             onOpenPdfLinks={(items) => handleOpenSelectedPdfs(items)}
//           />
//         )}
//       </div>
//     </div>
//   );
// };

// export default Publications;












// src/pages/Publications.jsx
import React, { useEffect, useState, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import BulkBar from "../components/BulkBar";
import { collectPdfLinks, openPdfLinks } from "../utils/pdfLinks";
import Search from "../pages/Search";

const Publications = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const qParams = new URLSearchParams(location.search);

  // Read incoming category from query param or Link state (state preferred if present)
  const incomingCategoryFromQuery = qParams.get("category") || null;
  const incomingCategoryFromState = location.state && location.state.category ? location.state.category : null;
  // component-level category state (source of truth for filtering within this component)
  const [category, setCategory] = useState(incomingCategoryFromState || incomingCategoryFromQuery || null);

  // listing / search state
  const [query, setQuery] = useState("");
  const [searchFields, setSearchFields] = useState("title,abstract");
  const [results, setResults] = useState([]); // publications or search results
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const perPage = 12;
  const [loading, setLoading] = useState(true);

  // bulk selection
  const [selectedMap, setSelectedMap] = useState({});
  const selectedList = Object.values(selectedMap);

  // Helper: fetch either filtered or general publications
  const fetchPublicationsPayload = useCallback(
    async (payloadPage = 1, extraPayload = {}) => {
      setLoading(true);
      try {
        if (Object.keys(extraPayload).length > 0) {
          // if explicit filter/search payload provided, use it
          const data = await api.filterPublications({ page: payloadPage, per_page: perPage, ...extraPayload });
          setResults(data.publications || []);
          setTotalResults(data.total || 0);
          setTotalPages(data.total_pages || 0);
          setPage(payloadPage);
        } else if (category) {
          // if category is active, use it
          const data = await api.filterPublications({ category, page: payloadPage, per_page: perPage });
          setResults(data.publications || []);
          setTotalResults(data.total || 0);
          setTotalPages(data.total_pages || 0);
          setPage(payloadPage);
        } else {
          // default: list publications
          const data = await api.getPublications(payloadPage, perPage);
          setResults(data.publications || []);
          setTotalResults(data.total || 0);
          setTotalPages(data.total_pages || 0);
          setPage(payloadPage);
        }
        setSelectedMap({});
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

  // Initial fetch and re-sync when URL or state changes.
  // We also update component category when URL or Link state changes so component remains synced.
  useEffect(() => {
    const urlCategory = new URLSearchParams(location.search).get("category");
    const stateCategory = location.state && location.state.category ? location.state.category : null;
    const resolved = stateCategory || urlCategory || null;

    // update component category state only if different
    setCategory((prev) => (prev !== resolved ? resolved : prev));

    // fetch using resolved category (fetchPublicationsPayload reads `category` from closure,
    // but to be robust we pass resolved via extraPayload when resolved differs)
    if (resolved !== category) {
      // resolved changed (URL/state), fetch using resolved explicitly
      fetchPublicationsPayload(1, resolved ? { category: resolved } : {});
    } else {
      // resolved equals current category — standard fetch
      fetchPublicationsPayload(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, location.state]); // run when URL query or Link state changes

  // Explicit search / filter triggered by user
  const performSearch = async (pageToFetch = 1) => {
    setLoading(true);
    try {
      const payload = {
        query: query?.trim() || undefined,
        search_fields: searchFields,
        page: pageToFetch,
        per_page: perPage
      };
      if (category) payload.category = category;

      const data = await api.filterPublications(payload);
      setResults(data.publications || []);
      setTotalResults(data.total || 0);
      setTotalPages(data.total_pages || 0);
      setPage(pageToFetch);
      setSelectedMap({});
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
      setTotalResults(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  // Clear category: remove query param from URL and update component state & refetch
  const clearCategory = () => {
    // Remove category param from URL while preserving other params
    const params = new URLSearchParams(location.search);
    params.delete("category");
    // navigate to same pathname with updated search (replace so back button isn't polluted)
    const searchString = params.toString();
    navigate({ pathname: location.pathname, search: searchString ? `?${searchString}` : "" }, { replace: true });

    // Update local state and refetch unfiltered publications
    setCategory(null);
    // fetch default publications (no category)
    fetchPublicationsPayload(1);
  };

  // Selection helpers
  const toggleSelect = (item) => {
    setSelectedMap((prev) => {
      const cp = { ...prev };
      if (cp[item.pmcid]) delete cp[item.pmcid];
      else cp[item.pmcid] = item;
      return cp;
    });
  };

  const clearSelection = () => setSelectedMap({});

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
    // If there's an active query (user search) use performSearch; else general fetch
    if (query && query.trim().length > 0) performSearch(p);
    else fetchPublicationsPayload(p);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">Publications</h1>
            <p className="text-gray-600">
              {category ? `Publications in "${category}"` : `Browse ${totalResults.toLocaleString()} research papers`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {category && (
              // now clearCategory actually removes the query param and refetches
              <button onClick={clearCategory} className="text-sm text-gray-600 underline">
                Using category: {category} (click to clear)
              </button>
            )}
            <Link to="/search" className="px-3 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50">
              Advanced Search
            </Link>
          </div>
        </div>

        {/* Compact search bar */}
<div className="bg-white rounded-lg shadow p-4 mb-6">
<Search
// props you should pass from Publications page state/controllers
query={query}
setQuery={setQuery}
searchFields={searchFields}
setSearchFields={setSearchFields}
onSearch={(page) => performSearch(page)}
loading={loading}
// If your Search component expects other props (filters, handlers), pass them here
// e.g. filters, setFilters, onClearFilters, categories, etc.
/>
</div>

        {/* Results grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {loading ? (
            <div className="col-span-full text-center py-12 text-gray-500">Loading…</div>
          ) : results.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-500">No publications found.</div>
          ) : (
            results.map((pub) => (
              <div key={pub.pmcid} className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-all duration-200 hover:border-blue-200">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                      {pub.pmcid}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-500">{pub.year}</span>
                      {pub.pdf_downloaded && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">PDF</span>}
                    </div>
                  </div>

                  <h3 className="font-semibold text-gray-900 text-lg mb-3 line-clamp-2 leading-tight">{pub.title}</h3>

                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Authors:</span> {pub.authors?.slice(0, 2).join(", ")}{pub.authors?.length > 2 && " et al."}
                    </div>
                    <div>
                      <span className="font-medium">Journal:</span> {pub.journal}
                    </div>
                  </div>
                </div>

                {pub.categories && pub.categories.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {pub.categories.slice(0, 2).map((cat, i) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-medium">{cat}</span>
                      ))}
                      {pub.categories.length > 2 && <span className="text-xs text-gray-500 px-2 py-1">+{pub.categories.length - 2} more</span>}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-xs text-gray-500">{pub.abstract ? `${pub.abstract.substring(0, 50)}...` : "No abstract"}</div>

                  {/* forward category context when linking to PublicationDetail */}
                  <Link
                    to={`/publication/${pub.pmcid}`}
                    state={category ? { category } : undefined}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">Showing page {page} of {totalPages} ({totalResults.toLocaleString()} total)</div>
              <div className="flex items-center space-x-2">
                <button onClick={() => gotoPage(Math.max(1, page - 1))} disabled={page === 1} className="px-4 py-2 border rounded-md text-sm disabled:opacity-50">Previous</button>

                <div className="flex items-center space-x-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = Math.max(1, page - 2) + i;
                    if (pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => gotoPage(pageNum)}
                        className={`px-3 py-2 text-sm rounded-md transition-colors ${pageNum === page ? "bg-blue-600 text-white" : "border border-gray-300 hover:bg-gray-50"}`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button onClick={() => gotoPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-4 py-2 border rounded-md text-sm disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        )}

        {/* BulkBar */}
        {selectedList.length > 0 && (
          <BulkBar
            selected={selectedList}
            onClear={clearSelection}
            onOpenPdfLinks={(items) => handleOpenSelectedPdfs(items)}
          />
        )}
      </div>
    </div>
  );
};

export default Publications;
