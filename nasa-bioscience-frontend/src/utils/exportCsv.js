// src/utils/exportCsv.js
export function exportCsv(items = [], filename = 'export.csv') {
  if (!items || items.length === 0) return;

  const rows = items.map(it => ({
    pmcid: it.pmcid || '',
    title: (it.title || '').replace(/\r?\n|\r/g, ' '),
    authors: (it.authors || []).join('; '),
    journal: it.journal || '',
    year: it.year || '',
    doi: it.doi || '',
    pdf_available: !!it.pdf_downloaded
  }));

  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const val = r[h] === null || r[h] === undefined ? '' : String(r[h]);
        // escape quotes
        return `"${val.replace(/"/g, '""')}"`
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
