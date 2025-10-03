// src/components/SearchBar.jsx
import React from "react";

const SearchBar = ({ query, setQuery, searchFields, setSearchFields, onSubmit, loading }) => {
  return (
    <form onSubmit={onSubmit} className="w-full">
      <div className="flex gap-3 items-center">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search publications, authors, keywords..."
          className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={searchFields}
          onChange={(e) => setSearchFields(e.target.value)}
          className="px-3 py-2 border rounded-lg"
        >
          <option value="title,abstract">Title & Abstract</option>
          <option value="title,abstract,authors">Title, Abstract & Authors</option>
          <option value="title,abstract,authors,keywords">All Fields</option>
          <option value="title">Title Only</option>
          <option value="abstract">Abstract Only</option>
          <option value="authors">Authors Only</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
