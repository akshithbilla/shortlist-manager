import type { Column, Row } from './supabase';

export function exportToCSV(columns: Column[], rows: Row[], filename = 'export') {
  const visibleCols = columns.filter((c) => c.is_visible).sort((a, b) => a.order_index - b.order_index);
  const header = visibleCols.map((c) => c.name).join(',');
  const body = rows.map((r) => {
    return visibleCols.map((c) => {
      const val = r.data[c.id];
      if (val === null || val === undefined) return '';
      if (Array.isArray(val)) return `"${(val as string[]).join('; ')}"`;
      const str = String(val);
      return str.includes(',') ? `"${str}"` : str;
    }).join(',');
  });
  const csv = [header, ...body].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportToExcel(columns: Column[], rows: Row[], filename = 'export') {
  // Dynamic import to avoid SSR issues
  import('xlsx').then((XLSX) => {
    const visibleCols = columns.filter((c) => c.is_visible).sort((a, b) => a.order_index - b.order_index);
    const data = [
      visibleCols.map((c) => c.name),
      ...rows.map((r) =>
        visibleCols.map((c) => {
          const val = r.data[c.id];
          if (Array.isArray(val)) return (val as string[]).join(', ');
          return val ?? '';
        })
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

  const visibleCols = columns.filter((c) => c.is_visible).sort((a, b) => a.order_index - b.order_index);
  const head = [visibleCols.map((c) => c.name)];
  const body = rows.map((r) =>
    visibleCols.map((c) => {
      const val = r.data[c.id];
      if (val === null || val === undefined) return '';
      if (Array.isArray(val)) return (val as string[]).join(', ');
      return String(val);
    })
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

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
