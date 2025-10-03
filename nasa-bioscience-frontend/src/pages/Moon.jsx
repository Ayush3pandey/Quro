// // src/pages/Moon.jsx
// import React, { useEffect, useState, useCallback } from 'react';
// import { Link } from 'react-router-dom';
// import api from '../services/api';

// /**
//  * Moon.jsx
//  * Planet-focused page showing:
//  * - Planet-scoped search
//  * - Planet publication stats
//  * - Grid of publications filtered by the planet
//  * - Placeholder for Knowledge Snapshot (RAG)
//  */

// const PlanetPage = ({ planetName }) => {
//   const [query, setQuery] = useState('');
//   const [searchFields, setSearchFields] = useState('title,abstract');
//   const [results, setResults] = useState([]);
//   const [page, setPage] = useState(1);
//   const perPage = 12;
//   const [total, setTotal] = useState(0);
//   const [totalPages, setTotalPages] = useState(0);
//   const [loading, setLoading] = useState(true);

//   const [statsLoading, setStatsLoading] = useState(true);
//   const [topCategories, setTopCategories] = useState([]);
//   const [timeline, setTimeline] = useState({}); // year -> count

//   // Fetch publications filtered by planet (either empty query or user query but always scoped to planet)
//   const fetchPublications = useCallback(async ({ q = '', p = 1 }) => {
//     setLoading(true);
//     try {
//       const payload = {
//         query: q || undefined,
//         search_fields: searchFields,
//         category: undefined, // we will use query match for planet to handle text in title/abstract/categories
//         page: p,
//         per_page: perPage
//       };

//       // Use backend's filter: include planet keyword in query to scope (so "mars" or "moon" appears)
//       // If user typed something, include both: e.g. "mars AND cell growth" -> we append planet to query.
//       const effectiveQuery = q && q.trim().length ? `${planetName} ${q}` : planetName;
//       payload.query = effectiveQuery;
//       const data = await api.filterPublications(payload);
//       setResults(data.publications || []);
//       setTotal(data.total || 0);
//       setTotalPages(data.total_pages || 0);
//       setPage(p);
//     } catch (err) {
//       console.error('Failed to fetch planet publications', err);
//       setResults([]);
//       setTotal(0);
//       setTotalPages(0);
//     } finally {
//       setLoading(false);
//     }
//   }, [planetName, searchFields]);

//   // For the stats panel we sample a larger page (first N results) and compute top categories and timeline buckets.
//   const fetchPlanetStats = useCallback(async () => {
//     setStatsLoading(true);
//     try {
//       // request a sample large page to compute aggregates (adjust per your dataset / backend limits)
//       const samplePerPage = 200;
//       const payload = {
//         query: planetName,
//         search_fields: 'title,abstract,keywords,categories',
//         page: 1,
//         per_page: samplePerPage
//       };
//       const data = await api.filterPublications(payload);
//       const pubs = data.publications || [];

//       // aggregate categories and years
//       const catCounts = {};
//       const yearCounts = {};
//       pubs.forEach((p) => {
//         (p.categories || []).forEach((c) => {
//           const key = (c || '').trim();
//           if (!key) return;
//           catCounts[key] = (catCounts[key] || 0) + 1;
//         });
//         const y = p.year || 'Unknown';
//         yearCounts[y] = (yearCounts[y] || 0) + 1;
//       });

//       // top categories sorted
//       const topCats = Object.entries(catCounts)
//         .sort((a, b) => b[1] - a[1])
//         .slice(0, 8)
//         .map(([name, count]) => ({ name, count }));

//       setTopCategories(topCats);

//       // timeline: convert to array of {year, count} sorted
//       const years = Object.entries(yearCounts)
//         .filter(([yr]) => yr !== 'Unknown')
//         .map(([yr, c]) => ({ year: Number(yr), count: c }))
//         .sort((a, b) => a.year - b.year);

//       setTimeline(years);
//     } catch (err) {
//       console.error('Failed to load planet stats', err);
//       setTopCategories([]);
//       setTimeline([]);
//     } finally {
//       setStatsLoading(false);
//     }
//   }, [planetName]);

//   useEffect(() => {
//     // initial load: show planet-scope publications page 1
//     fetchPublications({ q: '', p: 1 });
//     fetchPlanetStats();
//   }, [fetchPublications, fetchPlanetStats]);

//   const onSearchSubmit = (e) => {
//     e.preventDefault();
//     // perform search; query will be combined with planet keyword inside fetchPublications
//     fetchPublications({ q: query, p: 1 });
//   };

//   const gotoPage = (p) => {
//     if (p < 1) p = 1;
//     if (p > totalPages) p = totalPages;
//     fetchPublications({ q: query, p });
//   };

//   // Helper: forward planet context when linking to publication detail
//   const linkState = { category: planetName };

//   return (
//     <div className="min-h-screen bg-gray-50 p-6">
//       <div className="max-w-6xl mx-auto">
//         <header className="mb-6">
//           <h1 className="text-3xl font-bold">{planetName} Bioscience Hub</h1>
//           <p className="text-gray-600 mt-1">
//             Curated research and analytics about biological experiments relevant to {planetName}.
//           </p>
//         </header>

//         {/* Stats + Snapshot */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
//           <div className="col-span-2 bg-white rounded-lg p-4 shadow-sm">
//             <div className="flex items-center justify-between mb-3">
//               <div>
//                 <h3 className="text-lg font-semibold">{planetName} Publications</h3>
//                 <div className="text-sm text-gray-600">Total (matching): {total.toLocaleString()}</div>
//               </div>

//               <div>
//                 <button
//                   className="px-3 py-1 bg-blue-600 text-white rounded"
//                   onClick={() => {
//                     // placeholder for RAG-generation — currently no backend for RAG
//                     window.alert('RAG summary is not yet implemented — placeholder.');
//                   }}
//                 >
//                   Generate Knowledge Snapshot
//                 </button>
//               </div>
//             </div>

//             <div className="flex gap-4">
//               <div>
//                 <div className="text-sm text-gray-500">Top categories</div>
//                 <div className="mt-2 flex flex-wrap gap-2">
//                   {statsLoading ? <div className="text-sm text-gray-500">Loading…</div> :
//                     (topCategories.length ? topCategories.map((c) => (
//                       <span key={c.name} className="text-xs bg-gray-100 px-2 py-1 rounded">{c.name} ({c.count})</span>
//                     )) : <div className="text-sm text-gray-500">No categories found</div>)
//                   }
//                 </div>
//               </div>

//               <div className="ml-auto text-sm text-gray-500">
//                 <div>Timeline (sample)</div>
//                 <div className="mt-2">
//                   {statsLoading ? <div>Loading…</div> :
//                     (timeline.length ? <div className="text-xs text-gray-600">{timeline.map(t => `${t.year}:${t.count}`).join(' • ')}</div> :
//                       <div className="text-xs text-gray-600">No timeline data</div>)
//                   }
//                 </div>
//               </div>
//             </div>
//           </div>

//           {/* Quick highlights / placeholder */}
//           <aside className="bg-white rounded-lg p-4 shadow-sm">
//             <div className="font-semibold mb-2">Knowledge Snapshot</div>
//             <p className="text-sm text-gray-600 mb-3">Short AI summaries and gap analyses will appear here when RAG is available.</p>
//             <div className="text-sm">
//               <button className="px-3 py-1 border rounded text-sm" disabled>Request snapshot (coming)</button>
//             </div>
//           </aside>
//         </div>

//         {/* Search bar scoped to planet */}
//         <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
//           <form onSubmit={onSearchSubmit} className="flex gap-3">
//             <input
//               className="flex-1 border px-3 py-2 rounded"
//               placeholder={`${planetName} research — add keywords to refine (e.g. "plant", "radiation")`}
//               value={query}
//               onChange={(e) => setQuery(e.target.value)}
//             />
//             <select value={searchFields} onChange={(e) => setSearchFields(e.target.value)} className="px-3 py-2 border rounded">
//               <option value="title,abstract">Title & Abstract</option>
//               <option value="title,abstract,authors">Title, Abstract & Authors</option>
//               <option value="title,abstract,authors,keywords">All fields</option>
//               <option value="title">Title only</option>
//             </select>
//             <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Search</button>
//           </form>
//           <div className="mt-3 text-sm text-gray-500">Search is scoped to <strong>{planetName}</strong> by default.</div>
//         </div>

//         {/* Results grid */}
//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
//           {loading ? (
//             <div className="col-span-full text-center py-12 text-gray-600">Loading publications…</div>
//           ) : results.length === 0 ? (
//             <div className="col-span-full text-center py-12 text-gray-600">No publications found for this query.</div>
//           ) : results.map((pub) => (
//             <article key={pub.pmcid} className="bg-white p-4 rounded-lg shadow-sm">
//               <div className="flex justify-between items-start">
//                 <div>
//                   <h4 className="font-semibold text-md">{pub.title}</h4>
//                   <div className="text-xs text-gray-500 mt-1">{pub.journal} • {pub.year}</div>
//                 </div>
//                 <div className="text-xs text-gray-400">{pub.pmcid}</div>
//               </div>

//               <p className="text-sm text-gray-700 mt-3 line-clamp-3">{pub.abstract ? pub.abstract : 'No abstract available.'}</p>

//               <div className="mt-4 flex items-center justify-between">
//                 <div className="text-sm text-gray-600">
//                   {pub.authors?.slice(0,2).join(', ')}{pub.authors?.length > 2 && ' et al.'}
//                 </div>

//                 <div className="flex items-center gap-3">
//                   {/* Open external PMC */}
//                   <a
//                     href={pub.source_url || `https://www.ncbi.nlm.nih.gov/pmc/articles/${pub.pmcid}/`}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="text-sm text-blue-600 underline"
//                   >
//                     View Full Page
//                   </a>

//                   {/* Link to internal publication detail and pass planet context */}
//                   <Link to={`/publication/${pub.pmcid}`} state={{ category: planetName }} className="text-sm text-gray-600">Details</Link>
//                 </div>
//               </div>
//             </article>
//           ))}
//         </div>

//         {/* Pagination */}
//         {totalPages > 1 && (
//           <div className="mt-6 bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
//             <div className="text-sm text-gray-700">Page {page} of {totalPages} — {total.toLocaleString()} results</div>
//             <div className="flex items-center gap-2">
//               <button onClick={() => gotoPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 border rounded">Prev</button>
//               <button onClick={() => gotoPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded">Next</button>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// };

// export default function Moon() {
//   return <PlanetPage planetName="Moon" />;
// }



// src/pages/Moon.jsx
import React from "react";
import PlanetPage from "../components/PlanetPage";

export default function Moon() {
  return <PlanetPage planetName="Moon" />;
}
