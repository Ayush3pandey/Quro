// src/pages/Search.jsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import FilterChips from '../components/FilterChips';
import TypeaheadInput from '../components/TypeaheadInput';
import MultiSelectCategories from '../components/MultiSelectCategories';
import BulkBar from '../components/BulkBar';
import { exportCsv } from '../utils/exportCsv';
import { collectPdfLinks, openPdfLinks } from '../utils/pdfLinks';

/**
 * Props:
 * - embed (bool) -> if true, hide page-level header/outer spacing and the internal results box
 * - initialCategory (string or array) -> pre-fill filters.category on mount
 * - onResults (function) -> called with data { publications, total, total_pages, page } after each search
 */
const Search = ({ embed = false, initialCategory = null, onResults = null }) => {
  const [query, setQuery] = useState('');
  const [searchFields, setSearchFields] = useState('title,abstract');
  const [results, setResults] = useState([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: null,
    year: null,
    journal: null,
    author: null,
    has_pdf: null
  });

  const [categories, setCategories] = useState([]);
  const [journals, setJournals] = useState([]);
  const [authors, setAuthors] = useState([]);

  const [page, setPage] = useState(1);
  const perPage = 20;

  // selection (bulk)
  const [selectedMap, setSelectedMap] = useState({});
  const selectedList = Object.values(selectedMap);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [catRes, jourRes, authRes] = await Promise.all([api.getCategories(), api.getJournals(), api.getAuthors(200)]);
        setCategories(catRes?.categories || []);
        setJournals(jourRes?.journals || []);
        setAuthors(authRes?.authors || []);
      } catch (err) {
        console.error('Failed to load meta:', err);
      }
    };
    loadMeta();
  }, []);

  // apply initialCategory when provided (either string or array)
  useEffect(() => {
    if (initialCategory) {
      setFilters(prev => ({ ...prev, category: initialCategory }));
      setShowFilters(true);
    }
  }, [initialCategory]);

  const clearFilters = () => {
    setFilters({ category: null, year: null, journal: null, author: null, has_pdf: null });
  };

  const performSearch = async (pageToFetch = 1) => {
    setLoading(true);
    setHasSearched(true);
    setPage(pageToFetch);

    try {
      const payload = {
        category: filters.category,
        year: filters.year,
        journal: filters.journal,
        author: filters.author,
        has_pdf: filters.has_pdf,
        query: query?.trim() || undefined,
        search_fields: searchFields,
        page: pageToFetch,
        per_page: perPage
      };

      const data = await api.filterPublications(payload);

      setResults(data.publications || []);
      setTotalResults(data.total || 0);
      setTotalPages(data.total_pages || Math.ceil((data.total || 0) / perPage) || 1);
      setSelectedMap({});

      // Notify parent (Publications.jsx) so it can render results in its grid when embedded
      if (typeof onResults === 'function') {
        onResults({
          publications: data.publications || [],
          total: data.total || 0,
          total_pages: data.total_pages || Math.ceil((data.total || 0) / perPage) || 1,
          page: pageToFetch
        });
      }
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
      setTotalResults(0);
      setTotalPages(1);
      if (typeof onResults === 'function') {
        onResults({ publications: [], total: 0, total_pages: 1, page: pageToFetch });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    await performSearch(1);
  };

  const gotoPage = (p) => {
    if (p < 1) p = 1;
    if (p > totalPages) p = totalPages;
    performSearch(p);
  };

  const toggleSelect = (item) => {
    setSelectedMap(prev => {
      const copy = { ...prev };
      if (copy[item.pmcid]) delete copy[item.pmcid];
      else copy[item.pmcid] = item;
      return copy;
    });
  };

  const clearSelection = () => setSelectedMap({});

  const handleRemoveChip = (key, value) => {
    if (key === "query") {
      setQuery("");
    } else if (key === "category") {
      setFilters((prev) => {
        const prevCat = prev.category;
        if (Array.isArray(prevCat)) {
          const remaining = prevCat.filter((c) => c !== value);
          return { ...prev, category: remaining.length ? remaining : null };
        }
        return { ...prev, category: null };
      });
    } else if (key === "year") {
      setFilters((prev) => ({ ...prev, year: null }));
    } else if (key === "journal") {
      setFilters((prev) => ({ ...prev, journal: null }));
    } else if (key === "author") {
      setFilters((prev) => ({ ...prev, author: null }));
    } else if (key === "has_pdf") {
      setFilters((prev) => ({ ...prev, has_pdf: null }));
    }

    if (hasSearched) {
      performSearch(1);
    }
  };

  // re-run search when filters or query change (but only if user has searched before)
  useEffect(() => {
    if (hasSearched) {
      performSearch(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.category, filters.year, filters.journal, filters.author, filters.has_pdf, query]);

  return (
    <div className={embed ? "" : "min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8"}>
      <div className={embed ? "" : "max-w-7xl mx-auto"}>
        {!embed && (
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Advanced Search</h1>
            <p className="text-sm sm:text-base text-gray-600">Search NASA bioscience publications – enhanced with typeahead, chips & multi-select categories</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className={embed ? "mb-4" : "mb-4"}>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search publications, authors, keywords..."
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
            />

            <select
              value={searchFields}
              onChange={(e) => setSearchFields(e.target.value)}
              className="px-3 py-2 sm:py-3 border rounded-lg text-sm sm:text-base"
            >
              <option value="title,abstract">Title & Abstract</option>
              <option value="title,abstract,authors">Title, Abstract & Authors</option>
              <option value="title,abstract,authors,keywords">All Fields</option>
              <option value="title">Title Only</option>
              <option value="abstract">Abstract Only</option>
              <option value="authors">Authors Only</option>
            </select>

            <div className="flex gap-2 sm:gap-3">
              <button type="submit" disabled={loading} className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm sm:text-base">
                {loading ? 'Searching…' : 'Search'}
              </button>

              <button type="button" onClick={() => setShowFilters(s => !s)} className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border rounded-lg text-sm sm:text-base whitespace-nowrap">
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </button>

              {!embed && (
                <Link to="/search" className="hidden sm:flex px-3 py-2 border rounded text-sm text-gray-700 hover:bg-gray-50 items-center">
                  Open Search Page
                </Link>
              )}
            </div>
          </div>
        </form>

        {/* filter chips */}
        <FilterChips filters={{ ...filters, query: query?.trim() || undefined }} onRemove={handleRemoveChip} />

        {showFilters && (
          <>
            <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Advanced Filters</h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categories (multi-select)</label>
                    <MultiSelectCategories
                      categories={categories}
                      selected={Array.isArray(filters.category) ? filters.category : (filters.category ? [filters.category] : [])}
                      onChange={(sel) => setFilters(prev => ({ ...prev, category: sel && sel.length ? sel : null }))}
                      compact={true}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                      <input
                        type="number"
                        placeholder="e.g. 2022"
                        value={filters.year || ''}
                        onChange={(e) => setFilters(prev => ({ ...prev, year: e.target.value ? Number(e.target.value) : null }))}
                        className="w-full px-3 py-2 border rounded text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Journal</label>
                      <TypeaheadInput
                        placeholder="Search journals..."
                        value={filters.journal || ''}
                        onChange={(val) => setFilters(prev => ({ ...prev, journal: val || null }))}
                        fetchSuggestions={async (term) => {
                          const res = await api.getJournals();
                          const list = res.journals || [];
                          return list.filter(j => j.name.toLowerCase().includes(term.toLowerCase()));
                        }}
                        debounceMs={250}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                      <TypeaheadInput
                        placeholder="Search authors..."
                        value={filters.author || ''}
                        onChange={(val) => setFilters(prev => ({ ...prev, author: val || null }))}
                        fetchSuggestions={async (term) => {
                          const res = await api.getAuthors(100);
                          const list = res.authors || [];
                          return list.filter(a => a.name.toLowerCase().includes(term.toLowerCase()));
                        }}
                        debounceMs={250}
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        id="has_pdf"
                        type="checkbox"
                        checked={filters.has_pdf === true}
                        onChange={(e) => setFilters(prev => ({ ...prev, has_pdf: e.target.checked ? true : null }))}
                        className="form-checkbox h-4 w-4"
                      />
                      <label htmlFor="has_pdf" className="text-sm text-gray-700">Only show publications with PDFs</label>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quick filters</label>
                    <div className="space-y-2">
                      <button type="button" className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50 text-sm sm:text-base" onClick={() => {
                        const top = categories.slice(0,3).map(c => c.name);
                        setFilters(prev => ({ ...prev, category: top }));
                      }}>
                        Top categories
                      </button>
                      <button type="button" className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50 text-sm sm:text-base" onClick={() => {
                        setFilters(prev => ({ ...prev, has_pdf: true }));
                      }}>Only PDFs</button>
                      <button type="button" className="w-full text-left px-3 py-2 border rounded hover:bg-gray-50 text-sm sm:text-base" onClick={() => {
                        setFilters(prev => ({ ...prev, year: new Date().getFullYear() }));
                      }}>
                        This year
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Active counts</label>
                    <div className="text-xs sm:text-sm text-gray-500">
                      <div>Categories available: {categories.length}</div>
                      <div>Journals available: {journals.length}</div>
                      <div>Top authors (fetched): {authors.length}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6">
              <button onClick={() => performSearch(1)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm sm:text-base">Apply Filters</button>
              <button onClick={() => clearFilters()} className="px-4 py-2 border rounded-lg text-sm sm:text-base">Clear Filters</button>
            </div>
          </>
        )}

        {/* ----- IMPORTANT: hide the results card when embedded ----- */}
        {!embed && (
          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
            {loading && (
              <div className="text-center py-8 sm:py-12">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-sm sm:text-base text-gray-600">Searching publications...</p>
              </div>
            )}

            {!loading && hasSearched && (
              <>
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Results</h2>
                    <p className="text-sm sm:text-base text-gray-600">Found {totalResults.toLocaleString()} result{totalResults !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {results.length === 0 ? (
                  <div className="text-center py-8 sm:py-12">
                    <div className="text-4xl sm:text-6xl mb-4">🔍</div>
                    <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
                    <p className="text-sm sm:text-base text-gray-600">Try adjusting your search terms or filters.</p>
                  </div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {results.map(pub => (
                      <div key={pub.pmcid} className="border-l-4 border-blue-500 pl-3 sm:pl-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors rounded-r-lg">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={!!selectedMap[pub.pmcid]}
                              onChange={() => toggleSelect(pub)}
                              className="form-checkbox h-4 w-4 flex-shrink-0"
                            />
                            <span className="text-xs text-gray-500 break-all">{pub.pmcid}</span>
                          </label>

                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex-shrink-0">
                            {pub.year}
                          </span>
                        </div>

                        <div className="mb-2">
                          <Link to={`/publication/${pub.pmcid}`} className="font-semibold text-base sm:text-lg text-gray-900 hover:text-blue-600 break-words">
                            {pub.title}
                          </Link>
                        </div>

                        <div className="space-y-1 mb-3 text-xs sm:text-sm text-gray-600">
                          <p className="break-words"><span className="font-medium">Authors:</span> {pub.authors?.slice(0,4).join(', ')}{pub.authors?.length > 4 && ' et al.'}</p>
                          <p className="break-words"><span className="font-medium">Journal:</span> {pub.journal}</p>
                        </div>

                        <p className="text-sm sm:text-base text-gray-700 leading-relaxed mb-3 break-words">{pub.abstract ? `${pub.abstract.substring(0,300)}...` : 'No abstract available.'}</p>

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                            {pub.pdf_downloaded && <span className="text-green-600 font-medium">📄 PDF Available</span>}
                            {pub.keywords?.length > 0 && <span>{pub.keywords.length} keywords</span>}
                          </div>
                          <Link to={`/publication/${pub.pmcid}`} className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 whitespace-nowrap">View Full Details →</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-xs sm:text-sm text-gray-700 text-center sm:text-left">Page {page} of {totalPages} ({totalResults} total)</div>
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => gotoPage(page - 1)} disabled={page === 1} className="px-3 py-2 border rounded disabled:opacity-50 text-sm">Prev</button>
                      <button onClick={() => gotoPage(page + 1)} disabled={page === totalPages} className="px-3 py-2 border rounded disabled:opacity-50 text-sm">Next</button>
                    </div>
                  </div>
                )}
              </>
            )}

            {!hasSearched && (
              <div className="text-center py-8 sm:py-12 text-sm sm:text-base text-gray-500">Enter a search term or open filters to begin.</div>
            )}
          </div>
        )}

        {selectedList.length > 0 && (
          <BulkBar
            selected={selectedList}
            onClear={clearSelection}
            onExportCSV={(items) => exportCsv(items, `search_export_${new Date().toISOString().slice(0,10)}.csv`)}
            onOpenPdfLinks={(items) => {
              const links = collectPdfLinks(items, api.baseURL || 'http://localhost:8000');
              if (links.length === 0) {
                alert('No PDF links available for selected items.');
                return;
              }
              if (links.length > 8 && !window.confirm(`Open ${links.length} PDF tabs? This may open many browser tabs.`)) return;
              openPdfLinks(links);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default Search;