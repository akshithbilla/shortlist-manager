import type { Column, Row } from './supabase';
import { getColspan, getRowspan, normalizeCellMeta, shouldRenderCell, sortByOrder } from './table-layout';

const CELL_STYLE = 'text-align:center;vertical-align:middle;padding:10px 8px;';
const DATA_CELL_CLASS = 'data-cell';

function getExportColumns(columns: Column[]) {
  const sorted = [...columns].sort((a, b) => a.order_index - b.order_index);
  const visible = sorted.filter((c) => c.is_visible !== false);
  return visible.length > 0 ? visible : sorted;
}

function formatCellValue(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return (value as unknown[]).map((v) => String(v)).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function exportToCSV(columns: Column[], rows: Row[], filename = 'export') {
  const visibleCols = getExportColumns(columns);
  const sorted = sortByOrder(rows);
  const header = visibleCols.map((c) => c.name).join(',');
  const body = sorted.map((r, ri) => {
    return visibleCols.map((c) => {
      if (!shouldRenderCell(sorted, ri, c.id, visibleCols)) return '';
      const str = formatCellValue(r.data[c.id]);
      return str.includes(',') ? `"${str}"` : str;
    }).join(',');
  });
  const csv = [header, ...body].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

function buildHtmlDataCell(
  rows: Row[],
  rowIndex: number,
  row: Row,
  col: Column,
  columns: Column[],
  colIndex: number
) {
  if (!shouldRenderCell(rows, rowIndex, col.id, columns)) return '';
  const rs = getRowspan(row, col.id);
  const cs = getColspan(row, col.id);
  const attrs = [
    rs > 1 ? `rowspan="${rs}"` : '',
    cs > 1 ? `colspan="${cs}"` : '',
    `class="${DATA_CELL_CLASS} col-${colIndex % 2}"`,
    `style="${CELL_STYLE}"`,
  ].filter(Boolean).join(' ');
  return `<td ${attrs}>${escapeHtml(formatCellValue(row.data[col.id]))}</td>`;
}

export function exportToExcel(columns: Column[], rows: Row[], filename = 'export') {
  import('xlsx').then((XLSX) => {
    const visibleCols = getExportColumns(columns);
    const sorted = sortByOrder(rows);
    const data = [
      visibleCols.map((c) => c.name),
      ...sorted.map((r, ri) =>
        visibleCols.map((c) =>
          shouldRenderCell(sorted, ri, c.id, visibleCols) ? formatCellValue(r.data[c.id]) : ''
        )
      ),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
    const rowOffset = 1;

    sorted.forEach((row, ri) => {
      visibleCols.forEach((col, ci) => {
        if (!shouldRenderCell(sorted, ri, col.id, visibleCols)) return;
        const rs = getRowspan(row, col.id);
        const cs = getColspan(row, col.id);
        if (rs > 1 || cs > 1) {
          merges.push({
            s: { r: rowOffset + ri, c: ci },
            e: { r: rowOffset + ri + rs - 1, c: ci + cs - 1 },
          });
        }
      });
    });

    if (merges.length) ws['!merges'] = merges;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  });
}

export async function exportToPDF(columns: Column[], rows: Row[], title: string, filename = 'export') {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(18);
  doc.text(title, 14, 22);
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  const visibleCols = getExportColumns(columns);
  const sorted = normalizeCellMeta(sortByOrder(rows), visibleCols);
  const head = [visibleCols.map((c) => c.name)];
  // PDF export: preserve merged layout (rowSpan/colSpan) like the UI.
  // Covered cells are emitted as `null` so autoTable doesn't draw extra grid lines.
  const body = sorted.map((r, ri) =>
    visibleCols.map((c) => {
      if (!shouldRenderCell(sorted, ri, c.id, visibleCols)) return null;
      const rs = getRowspan(r, c.id);
      const cs = getColspan(r, c.id);
      const content = formatCellValue(r.data[c.id]);
      if (rs === 1 && cs === 1) return content;
      return {
        content,
        rowSpan: rs > 1 ? rs : undefined,
        colSpan: cs > 1 ? cs : undefined,
        styles: {
          halign: 'center' as const,
          valign: 'middle' as const,
          cellPadding: 6,
        },
      };
    })
  );

  autoTable(doc, {
    head,
    body,
    startY: 36,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 5,
      halign: 'center',
      valign: 'middle',
      lineColor: [51, 65, 85],
      lineWidth: 0.4,
      textColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      halign: 'center',
      valign: 'middle',
      fontStyle: 'bold',
      lineColor: [15, 23, 42],
      lineWidth: 0.6,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        data.cell.styles.halign = 'center';
        data.cell.styles.valign = 'middle';
        data.cell.styles.cellPadding = 5;
        if (data.row.index % 2 === 0) {
          data.cell.styles.fillColor = data.column.index % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
        }
      }
    },
  });

  doc.save(`${filename}.pdf`);
}

export function printTable(columns: Column[], rows: Row[], title: string) {
  const visibleCols = getExportColumns(columns);
  const generated = new Date().toLocaleString();
  const sorted = sortByOrder(rows);
  const headers = visibleCols
    .map((col, i) => `<th class="col-${i % 2}">${escapeHtml(col.name)}</th>`)
    .join('');
  const body = sorted
    .map((row, rowIndex) => {
      const cells = visibleCols
        .map((col, colIndex) =>
          buildHtmlDataCell(sorted, rowIndex, row, col, visibleCols, colIndex)
        )
        .join('');
      const rowClass = rowIndex % 2 === 0 ? 'row-even' : 'row-odd';
      return `<tr class="${rowClass}">${cells}</tr>`;
    })
    .join('');

  const html = `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 24px; color: #1e293b; background: #fff; }
          h1 { margin: 0 0 6px; font-size: 22px; color: #0f172a; }
          .meta { margin-bottom: 18px; color: #64748b; font-size: 12px; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            border: 2px solid #334155;
          }
          thead th {
            background: #1e293b;
            color: #fff;
            font-weight: 700;
            padding: 12px 10px;
            border: 1px solid #0f172a;
            text-align: center;
            vertical-align: middle;
          }
          tbody td {
            border: 1px solid #94a3b8;
            padding: 10px 8px;
            text-align: center;
            vertical-align: middle;
            color: #1e293b;
          }
          tbody tr.row-even td { background: #ffffff; }
          tbody tr.row-odd td { background: #f1f5f9; }
          tbody td.col-0 { background-color: inherit; }
          tbody tr.row-even td.col-1 { background: #f8fafc; }
          tbody tr.row-odd td.col-1 { background: #e2e8f0; }
          tbody tr.row-even td.col-0 { background: #ffffff; }
          tbody tr.row-odd td.col-0 { background: #f1f5f9; }
          thead th.col-0 { background: #1e293b; }
          thead th.col-1 { background: #334155; }
          @media print {
            body { margin: 10mm; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Generated: ${escapeHtml(generated)} | Rows: ${sorted.length} | Columns: ${visibleCols.length}</div>
        <table>
          <thead><tr>${headers}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </body>
    </html>
  `;

  const printWindow = window.open('about:blank', '_blank');
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
