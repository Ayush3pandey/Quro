// src/components/FilterChips.jsx
import React from 'react';

/**
 * props:
 *  - filters: object { query, category, year, journal, author, has_pdf }
 *  - onRemove(key, value?) - called when a chip removed; if value provided remove just that value (for multi-category)
 */
const prettyVal = (k, v) => {
  if (k === 'has_pdf') return v ? 'Has PDF' : 'No PDF';
  if (k === 'category') {
    if (Array.isArray(v)) return v.join(', ');
    return v;
  }
  return String(v);
};

const FilterChips = ({ filters = {}, onRemove }) => {
  const chips = [];

  if (filters.query) chips.push({ key: 'query', label: `Q: ${filters.query}` });
  if (filters.category) {
    if (Array.isArray(filters.category)) {
      filters.category.forEach((c) => chips.push({ key: 'category', value: c, label: `Category: ${c}` }));
    } else {
      chips.push({ key: 'category', label: `Category: ${filters.category}` });
    }
  }
  if (filters.year) chips.push({ key: 'year', label: `Year: ${filters.year}` });
  if (filters.journal) chips.push({ key: 'journal', label: `Journal: ${filters.journal}` });
  if (filters.author) chips.push({ key: 'author', label: `Author: ${filters.author}` });
  if (filters.has_pdf !== null && filters.has_pdf !== undefined) chips.push({ key: 'has_pdf', label: prettyVal('has_pdf', filters.has_pdf) });

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {chips.map((chip, idx) => (
        <div
          key={`${chip.key}-${chip.value ?? idx}`}
          className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full text-sm"
        >
          <span className="text-gray-700">{chip.label}</span>
          <button
            onClick={() => onRemove(chip.key, chip.value)}
            className="w-5 h-5 rounded-full inline-flex items-center justify-center hover:bg-gray-200"
            aria-label={`Remove ${chip.label}`}
            title={`Remove ${chip.label}`}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default FilterChips;
