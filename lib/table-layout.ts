import type { Column, Row, CellMeta, PageLayout } from './supabase';

export function sortByOrder<T extends { order_index: number }>(items: T[]) {
  return [...items].sort((a, b) => a.order_index - b.order_index);
}

export function getCellMeta(row: Row, colId: string): CellMeta | undefined {
  return row.cell_meta?.[colId];
}

export function isCellSkipped(row: Row, colId: string) {
  return Boolean(getCellMeta(row, colId)?.skip);
}

export function getRowspan(row: Row, colId: string) {
  const rs = getCellMeta(row, colId)?.rowspan ?? 1;
  return Math.max(1, rs);
}

export function getColspan(row: Row, colId: string) {
  const cs = getCellMeta(row, colId)?.colspan ?? 1;
  return Math.max(1, cs);
}

function patchRowMeta(row: Row, colId: string, meta: CellMeta | null): Row {
  const next = { ...(row.cell_meta ?? {}) };
  if (!meta || (!meta.rowspan && !meta.colspan && !meta.skip)) {
    delete next[colId];
  } else {
    next[colId] = meta;
  }
  return { ...row, cell_meta: Object.keys(next).length ? next : undefined };
}

export function mergeDown(rows: Row[], rowId: string, colId: string): Row[] {
  const sorted = sortByOrder(rows);
  const idx = sorted.findIndex((r) => r.id === rowId);
  if (idx < 0 || idx >= sorted.length - 1) return rows;

  const anchor = sorted[idx];
  const below = sorted[idx + 1];
  const rowspan = getRowspan(anchor, colId) + 1;

  return rows.map((r) => {
    if (r.id === anchor.id) {
      return patchRowMeta(r, colId, { rowspan, colspan: getColspan(r, colId) });
    }
    if (r.id === below.id) {
      return patchRowMeta(r, colId, { skip: true });
    }
    return r;
  });
}

export function mergeRight(rows: Row[], rowId: string, colId: string, columns: Column[]): Row[] {
  const sortedCols = sortByOrder(columns);
  const row = rows.find((r) => r.id === rowId);
  if (!row || isCellSkipped(row, colId)) return rows;

  const colIdx = sortedCols.findIndex((c) => c.id === colId);
  if (colIdx < 0) return rows;

  const span = getColspan(row, colId);
  const rightIdx = colIdx + span;
  if (rightIdx >= sortedCols.length) return rows;

  const rightColId = sortedCols[rightIdx].id;
  const colspan = span + 1;

  return rows.map((r) => {
    if (r.id !== rowId) return r;
    let next = patchRowMeta(r, colId, { rowspan: getRowspan(r, colId), colspan });
    next = patchRowMeta(next, rightColId, { skip: true });
    return next;
  });
}

export function splitCell(rows: Row[], rowId: string, colId: string, columns: Column[]): Row[] {
  const sorted = sortByOrder(rows);
  const sortedCols = sortByOrder(columns);
  const rowIdx = sorted.findIndex((r) => r.id === rowId);
  const colIdx = sortedCols.findIndex((c) => c.id === colId);
  if (rowIdx < 0 || colIdx < 0) return rows;

  const anchor = sorted[rowIdx];
  const rowspan = getRowspan(anchor, colId);
  const colspan = getColspan(anchor, colId);

  const affectedRowIds = new Set(sorted.slice(rowIdx, rowIdx + rowspan).map((r) => r.id));
  const affectedColIds = new Set(sortedCols.slice(colIdx, colIdx + colspan).map((c) => c.id));

  return rows.map((r) => {
    if (!affectedRowIds.has(r.id)) return r;
    let next = r;
    Array.from(affectedColIds).forEach((cid) => {
      next = patchRowMeta(next, cid, null);
    });
    return next;
  });
}

export type SerialInfo = {
  display: number | null;
  rowspan: number;
};

/** Serial numbers follow logical rows: merged-down continuation rows share one # and do not increment. */
export function buildSerialMap(rows: Row[], columns: Column[]): Map<string, SerialInfo> {
  const sorted = sortByOrder(rows);
  const map = new Map<string, SerialInfo>();
  let serial = 0;

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const isContinuation = columns.some((col) => isCellSkipped(row, col.id));

    if (isContinuation) {
      map.set(row.id, { display: null, rowspan: 1 });
      continue;
    }

    serial += 1;
    let span = 1;
    for (let j = i + 1; j < sorted.length; j++) {
      const next = sorted[j];
      if (columns.some((col) => isCellSkipped(next, col.id))) {
        span += 1;
      } else {
        break;
      }
    }
    map.set(row.id, { display: serial, rowspan: span });
  }

  return map;
}

export function isMergedCell(row: Row, colId: string) {
  return getRowspan(row, colId) > 1 || getColspan(row, colId) > 1;
}

export function buildColumnHeaderModel(columns: Column[], layout?: PageLayout) {
  const sorted = sortByOrder(columns);
  const groups = layout?.column_groups ?? [];
  const groupedIds = new Set(groups.flatMap((g) => g.column_ids));
  const ungrouped = sorted.filter((c) => !groupedIds.has(c.id));

  return { sorted, groups, ungrouped };
}
