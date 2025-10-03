// src/services/api.js
// NOTE: this file extends your existing publication API helpers
// with small Graph API wrappers used by the Analytics / Graph UI.

const api = {
  // default to localhost but allow overriding in runtime (useful for deployed env)
  baseURL:
    typeof process !== "undefined" && process.env.REACT_APP_API_URL
      ? process.env.REACT_APP_API_URL
      : "http://localhost:8000",

  // --- existing publication endpoints (unchanged) ---
  async getStats(params = {}) {
    try {
      const url = new URL(`${this.baseURL}/stats`);
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        url.searchParams.append(k, String(v));
      });
      const response = await fetch(url.toString());
      if (!response.ok) {
        console.error("getStats response not ok", response.status);
        return null;
      }
      return response.json();
    } catch (error) {
      console.error("API Error (getStats):", error);
      return null;
    }
  },

  async getCategories() {
    try {
      const response = await fetch(`${this.baseURL}/categories`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      console.error("API Error (getCategories):", error);
      return { categories: [] };
    }
  },

  async getJournals() {
    try {
      const response = await fetch(`${this.baseURL}/journals`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      console.error("API Error (getJournals):", error);
      return { journals: [] };
    }
  },

  async getAuthors(limit = 100) {
    try {
      const response = await fetch(`${this.baseURL}/authors?limit=${limit}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      console.error("API Error (getAuthors):", error);
      return { authors: [] };
    }
  },

  async getPublications(opts = {}) {
    try {
      const { page = 1, perPage = 12, category, year, journal, author, has_pdf, query, search_fields } = opts;
      const url = new URL(`${this.baseURL}/papers`);
      url.searchParams.append("page", page);
      url.searchParams.append("per_page", perPage);

      if (category) url.searchParams.append("category", category);
      if (year) url.searchParams.append("year", year);
      if (journal) url.searchParams.append("journal", journal);
      if (author) url.searchParams.append("author", author);
      if (typeof has_pdf === "boolean") url.searchParams.append("has_pdf", has_pdf);
      if (query) url.searchParams.append("query", query);
      if (search_fields) url.searchParams.append("search_fields", search_fields);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      console.error("API Error (getPublications):", error);
      return { publications: [], total: 0, total_pages: 0 };
    }
  },

  async searchPublications(query, page = 1, perPage = 20, searchFields = "title,abstract") {
    try {
      const response = await fetch(
        `${this.baseURL}/search?query=${encodeURIComponent(query)}&page=${page}&per_page=${perPage}&search_fields=${encodeURIComponent(
          searchFields
        )}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      console.error("API Error (searchPublications):", error);
      return { publications: [], total: 0 };
    }
  },

  async filterPublications({ category, year, journal, author, has_pdf, query, search_fields = "title,abstract", page = 1, per_page = 20 } = {}) {
    try {
      const params = new URLSearchParams();

      if (Array.isArray(category)) {
        category.forEach((c) => {
          if (c) params.append("category", c);
        });
      } else if (category) {
        params.append("category", category);
      }

      if (year) params.append("year", year);
      if (journal) params.append("journal", journal);
      if (author) params.append("author", author);
      if (typeof has_pdf === "boolean") params.append("has_pdf", has_pdf);
      if (query) params.append("query", query);
      if (search_fields) params.append("search_fields", search_fields);

      params.append("page", page);
      params.append("per_page", per_page);

      const url = `${this.baseURL}/filter?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      console.error("API Error (filterPublications):", error);
      return { publications: [], total: 0, total_pages: 0 };
    }
  },

  async getPublication(pmcid) {
    try {
      const response = await fetch(`${this.baseURL}/paper/${pmcid}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      console.error("API Error (getPublication):", error);
      return null;
    }
  },

  async getPdfInfo(pmcid) {
    try {
      const response = await fetch(`${this.baseURL}/pdf/info/${pmcid}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      console.error("API Error (getPdfInfo):", error);
      return { pdf_downloaded: false };
    }
  },

  getPdfUrl(pmcid) {
    return `${this.baseURL}/pdf/${pmcid}`;
  },

  // ---- Graph API (primary wrappers) ----

  /**
   * Search graph nodes by name or paper_title
   * backend endpoint: GET /api/search?q=...&limit=...
   * returns: { results: [ { id, name, label, props } ] }
   */
  async search(q, limit = 25) {
    try {
      if (!q) return { results: [] };
      const url = `${this.baseURL}/api/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`;
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error("API Error (graph.search):", error);
      // keep same return shape for UI code
      return { results: [] , error: String(error) };
    }
  },

  /**
   * Get subgraph around a node name:
   * backend endpoint: GET /api/graph/{node_name}?depth=1&max_nodes=300&min_degree=0&labels=...
   * returns: { nodes: [...], links: [...] }
   */
  async getGraph(nodeName, opts = { depth: 1, max_nodes: 300, min_degree: 0, labels: undefined }) {
    try {
      if (!nodeName) return { nodes: [], links: [] };
      const params = new URLSearchParams();
      if (opts.depth !== undefined) params.set("depth", String(opts.depth));
      if (opts.max_nodes !== undefined) params.set("max_nodes", String(opts.max_nodes));
      if (opts.min_degree !== undefined) params.set("min_degree", String(opts.min_degree));
      if (opts.labels) params.set("labels", opts.labels);

      const url = `${this.baseURL}/api/graph/${encodeURIComponent(nodeName)}?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error("API Error (graph.getGraph):", error);
      return { nodes: [], links: [], error: String(error) };
    }
  },

  /**
   * Expand a node by internal id
   * backend endpoint: GET /api/expand/{node_id}
   * returns: { center: {...}, nodes: [...], links: [...] }
   */
  async expand(nodeId) {
    try {
      if (nodeId === undefined || nodeId === null) return { nodes: [], links: [] };
      const url = `${this.baseURL}/api/expand/${encodeURIComponent(nodeId)}`;
      const response = await fetch(url);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      return response.json();
    } catch (error) {
      console.error("API Error (graph.expand):", error);
      return { center: null, nodes: [], links: [], error: String(error) };
    }
  },
};

// export the object
export default api;
