// src/utils/exportBibtex.js
// Utility to build a BibTeX file from selected items and trigger download.

function sanitizeField(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/[\n\r]+/g, ' ').trim();
}

function formatAuthorsForBibtex(authors = []) {
  // BibTeX expects "Last, First and Last2, First2"
  // Our authors likely are "First Last" strings; keep them as-is joined by " and "
  // If authors are objects, adapt accordingly.
  if (!Array.isArray(authors)) return sanitizeField(authors);
  return authors.map(a => sanitizeField(a)).join(' and ');
}

function createBibEntry(item) {
  // Use pmcid as key if available + year
  const keyBase = (item.pmcid || item.doi || item.title || 'item').replace(/[^a-zA-Z0-9]/g, '');
  const year = item.year || 'n.d.';
  const key = `${keyBase}_${year}`;

  const entryType = 'article'; // default
  // Build fields commonly used
  const fields = {
    title: sanitizeField(item.title),
    author: formatAuthorsForBibtex(item.authors),
    journal: sanitizeField(item.journal),
    year: sanitizeField(item.year),
    volume: sanitizeField(item.volume),
    number: sanitizeField(item.issue || item.number),
    pages: sanitizeField(item.pages),
    doi: sanitizeField(item.doi),
    url: sanitizeField(item.url || item.pdf_url || item.pdf_file_path)
  };

  // Build BibTeX block
  let bib = `@${entryType}{${key},\n`;
  for (const [k, v] of Object.entries(fields)) {
    if (v) {
      bib += `  ${k} = {${v}},\n`;
    }
  }
  bib = bib.replace(/,\n$/, '\n'); // remove trailing comma
  bib += '}\n\n';
  return bib;
}

export function exportBibtex(items = [], filename = 'export.bib') {
  if (!items || items.length === 0) return;

  let content = '';
  items.forEach(item => {
    content += createBibEntry(item);
  });

  const blob = new Blob([content], { type: 'application/x-bibtex;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
