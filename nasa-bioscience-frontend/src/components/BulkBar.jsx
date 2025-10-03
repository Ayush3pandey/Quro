// // src/components/BulkBar.jsx
// import React from 'react';

// /**
//  * props:
//  *  - selected (array) - array of selected items (objects)
//  *  - onClear() - clear selection
//  *  - onExportCSV(selected) - callback to export CSV
//  *  - onOpenPdfLinks(selected) - callback to open pdf links (optional)
//  */
// const BulkBar = ({ selected = [], onClear, onExportCSV, onOpenPdfLinks }) => {
//   const count = selected.length;

//   return (
//     <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
//       <div className="bg-white shadow-lg rounded-xl border px-4 py-3 flex items-center space-x-4">
//         <div className="text-sm text-gray-700">
//           <span className="font-semibold">{count}</span> selected
//         </div>

//         <div className="flex items-center space-x-2">
//           <button
//             onClick={() => onExportCSV && onExportCSV(selected)}
//             className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
//           >
//             Export CSV
//           </button>

//           <button
//             onClick={() => onOpenPdfLinks && onOpenPdfLinks(selected)}
//             className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
//             title="Open PDF links (opens new tabs)"
//           >
//             Open PDFs
//           </button>

//           <button
//             onClick={() => onClear && onClear()}
//             className="px-3 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50"
//           >
//             Clear
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default BulkBar;


// src/components/BulkBar.jsx
import React, { useState } from 'react';
import { exportCsv } from '../utils/exportCsv';
import { exportBibtex } from '../utils/exportBibtex';
import { exportRis } from '../utils/exportRis';

/**
 * BulkBar
 * props:
 *  - selected (array) - array of selected items (objects)
 *  - onClear() - clear selection
 *  - onOpenPdfLinks(selected) - callback to open pdf links
 *
 * The BulkBar handles exporting in CSV / BibTeX / RIS formats.
 */
const BulkBar = ({ selected = [], onClear, onOpenPdfLinks }) => {
  const count = selected.length;
  const [format, setFormat] = useState('csv'); // csv | bibtex | ris
  const filenameBase = `nasa_export_${new Date().toISOString().slice(0,10)}`;

  const handleExport = () => {
    if (!selected || selected.length === 0) return;

    if (format === 'csv') {
      exportCsv(selected, `${filenameBase}.csv`);
    } else if (format === 'bibtex') {
      exportBibtex(selected, `${filenameBase}.bib`);
    } else if (format === 'ris') {
      exportRis(selected, `${filenameBase}.ris`);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white shadow-lg rounded-xl border px-4 py-3 flex items-center space-x-4">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">{count}</span> selected
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="px-2 py-1 border rounded-md text-sm"
            aria-label="Select export format"
          >
            <option value="csv">CSV</option>
            <option value="bibtex">BibTeX</option>
            <option value="ris">RIS</option>
          </select>

          <button
            onClick={handleExport}
            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            title="Export selected items"
          >
            Export
          </button>

          <button
            onClick={() => onOpenPdfLinks && onOpenPdfLinks(selected)}
            className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
            title="Open PDF links (opens new tabs)"
          >
            Open PDFs
          </button>

          <button
            onClick={() => onClear && onClear()}
            className="px-3 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkBar;
