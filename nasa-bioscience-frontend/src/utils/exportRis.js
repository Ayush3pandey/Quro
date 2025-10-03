// src/utils/exportRis.js
// Utility to build an RIS file from selected items and trigger download.

function sanitize(val) {
  if (val === undefined || val === null) return '';
  return String(val).replace(/[\r\n]+/g, ' ').trim();
}

function authorsToRis(authors = []) {
  if (!Array.isArray(authors)) return [sanitize(authors)];
  return authors.map(a => sanitize(a));
}

function createRisEntry(item) {
  // Use TY - JOUR (journal article) by default
  const lines = [];
  lines.push('TY  - JOUR');
  if (item.title) lines.push(`TI  - ${sanitize(item.title)}`);

  const authors = authorsToRis(item.authors || []);
  authors.forEach(a => lines.push(`AU  - ${a}`));

  if (item.journal) lines.push(`JO  - ${sanitize(item.journal)}`);
  if (item.year) lines.push(`PY  - ${sanitize(item.year)}`);
  if (item.volume) lines.push(`VL  - ${sanitize(item.volume)}`);
  if (item.issue) lines.push(`IS  - ${sanitize(item.issue)}`);
  if (item.pages) lines.push(`SP  - ${sanitize(item.pages)}`);
  if (item.doi) lines.push(`DO  - ${sanitize(item.doi)}`);
  if (item.url) lines.push(`UR  - ${sanitize(item.url)}`);
  // you can add more RIS tags if available: PB (publisher), SN (ISSN), AB (abstract)
  if (item.abstract) lines.push(`AB  - ${sanitize(item.abstract)}`);

  lines.push('ER  - ');
  return lines.join('\n') + '\n\n';
}

export function exportRis(items = [], filename = 'export.ris') {
  if (!items || items.length === 0) return;

  let content = '';
  items.forEach(item => {
    content += createRisEntry(item);
  });

  const blob = new Blob([content], { type: 'application/x-research-info-systems;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
