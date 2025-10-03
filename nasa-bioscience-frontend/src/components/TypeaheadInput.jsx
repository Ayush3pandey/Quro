// src/components/TypeaheadInput.jsx
import React, { useEffect, useState, useRef } from 'react';

/**
 * Props:
 *  - fetchSuggestions(term) => Promise<[{name, count}]>
 *  - value, onChange
 *  - placeholder
 *  - minChars (default 1)
 *  - debounceMs (default 300)
 */
const TypeaheadInput = ({ fetchSuggestions, value, onChange, placeholder = '', minChars = 1, debounceMs = 300 }) => {
  const [term, setTerm] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => setTerm(value || ''), [value]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!term || term.length < minChars) {
      setSuggestions([]);
      return;
    }

    timer.current = setTimeout(async () => {
      try {
        const res = await fetchSuggestions(term);
        // normalize shape: array of { name, count } or strings
        const normalized = (res?.authors || res?.journals || res || []).map(item => {
          if (typeof item === 'string') return { name: item };
          if (item && item.name) return item;
          return { name: String(item) };
        });
        setSuggestions(normalized);
        setOpen(true);
      } catch (err) {
        setSuggestions([]);
      }
    }, debounceMs);

    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const handleSelect = (item) => {
    const val = item.name ?? item;
    onChange(val);
    setTerm(val);
    setOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        className="w-full px-3 py-2 border rounded"
        placeholder={placeholder}
        value={term}
        onChange={(e) => { setTerm(e.target.value); onChange && onChange(e.target.value); }}
        onFocus={() => { if (suggestions.length) setOpen(true); }}
      />
      {open && suggestions && suggestions.length > 0 && (
        <div className="absolute z-40 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center"
              type="button"
            >
              <span className="truncate">{s.name || s}</span>
              {s.count !== undefined && <span className="text-xs text-gray-400 ml-3">({s.count})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TypeaheadInput;
