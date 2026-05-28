import type { Column, Row } from './supabase';

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
  const header = visibleCols.map((c) => c.name).join(',');
  const body = rows.map((r) => {
    return visibleCols.map((c) => {
      const str = formatCellValue(r.data[c.id]);
      return str.includes(',') ? `"${str}"` : str;
    }).join(',');
  });
  const csv = [header, ...body].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportToExcel(columns: Column[], rows: Row[], filename = 'export') {
  // Dynamic import to avoid SSR issues
  import('xlsx').then((XLSX) => {
    const visibleCols = getExportColumns(columns);
    const data = [
      visibleCols.map((c) => c.name),
      ...rows.map((r) =>
        visibleCols.map((c) => formatCellValue(r.data[c.id]))
      ),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
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
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

  const visibleCols = getExportColumns(columns);
  const head = [visibleCols.map((c) => c.name)];
  const body = rows.map((r) =>
    visibleCols.map((c) => formatCellValue(r.data[c.id]))
  );

  autoTable(doc, {
    head,
    body,
    startY: 36,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  doc.save(`${filename}.pdf`);
}

export function printTable(columns: Column[], rows: Row[], title: string) {
  const visibleCols = getExportColumns(columns);
  const generated = new Date().toLocaleString();
  const headers = visibleCols.map((col) => `<th>${escapeHtml(col.name)}</th>`).join('');
  const body = rows.map((row) => {
    const cells = visibleCols
      .map((col) => `<td>${escapeHtml(formatCellValue(row.data[col.id]))}</td>`)
      .join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const html = `
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
          h1 { margin: 0 0 8px; font-size: 22px; }
          .meta { margin-bottom: 16px; color: #555; font-size: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; text-align: left; }
          th { background: #f3f4f6; font-weight: 600; }
          tr:nth-child(even) td { background: #fafafa; }
          @media print { body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">Generated: ${escapeHtml(generated)} | Rows: ${rows.length} | Columns: ${visibleCols.length}</div>
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
