// src/components/MultiSelectCategories.jsx
import React, { useState, useMemo } from 'react';

/**
 * Props:
 *  - categories: [{name, count}]
 *  - selected: array of selected category names
 *  - onChange(selectedArray)
 *  - compact (boolean) - show limited items with "show more"
 */
const MultiSelectCategories = ({ categories = [], selected = [], onChange, compact = true }) => {
  const [showAll, setShowAll] = useState(false);

  const categoriesSorted = useMemo(() => {
    return [...categories].sort((a, b) => b.count - a.count);
  }, [categories]);

  const visible = compact ? categoriesSorted.slice(0, showAll ? 1000 : 8) : categoriesSorted;

  const toggle = (name) => {
    if (selected && selected.includes(name)) {
      onChange(selected.filter((s) => s !== name));
    } else {
      onChange([...(selected || []), name]);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-sm font-medium text-gray-700 mb-2">Categories</div>

      <div className="grid grid-cols-2 gap-2 max-h-56 overflow-auto">
        {visible.map((c) => (
          <label key={c.name} className="inline-flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={selected?.includes(c.name) || false}
              onChange={() => toggle(c.name)}
              className="form-checkbox h-4 w-4"
            />
            <span className="truncate">{c.name}</span>
            <span className="text-xs text-gray-400">({c.count})</span>
          </label>
        ))}
      </div>

      {compact && categoriesSorted.length > visible.length && (
        <div className="mt-3">
          <button onClick={() => setShowAll(s => !s)} className="text-sm text-blue-600">
            {showAll ? 'Show less' : `Show all (${categoriesSorted.length})`}
          </button>
        </div>
      )}
    </div>
  );
};

export default MultiSelectCategories;
