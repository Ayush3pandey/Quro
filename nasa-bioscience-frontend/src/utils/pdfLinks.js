// src/utils/pdfLinks.js
export function collectPdfLinks(items = [], apiBase = 'http://localhost:8000') {
  // Returns an array of download URLs (only for items with pdf_downloaded truthy)
  return items
    .filter(it => it && it.pdf_downloaded)
    .map(it => `${apiBase.replace(/\/$/, '')}/pdf/${it.pmcid}`);
}

export function openPdfLinks(links = []) {
  links.forEach(link => {
    try {
      window.open(link, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.warn('Failed to open pdf link', link, err);
    }
  });
}
