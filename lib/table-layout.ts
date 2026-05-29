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

/** Find the anchor row for merge actions (walk up if cell is skipped). */
export function resolveMergeAnchor(rows: Row[], rowId: string, colId: string): Row | null {
  const sorted = sortByOrder(rows);
  let idx = sorted.findIndex((r) => r.id === rowId);
  if (idx < 0) return null;
  while (idx > 0 && isCellSkipped(sorted[idx], colId)) {
    idx -= 1;
  }
  return sorted[idx] ?? null;
}

/**
 * Whether this cell should render a <td> (not covered by rowspan above or colspan from the left).
 */
export function shouldRenderCell(
  rows: Row[],
  rowIndex: number,
  colId: string,
  columns: Column[]
): boolean {
  const sorted = sortByOrder(rows);
  const sortedCols = sortByOrder(columns);
  const row = sorted[rowIndex];
  const colIdx = sortedCols.findIndex((c) => c.id === colId);
  if (!row || colIdx < 0) return false;

  if (isCellSkipped(row, colId)) return false;

  for (let i = rowIndex - 1; i >= 0; i--) {
    const above = sorted[i];
    if (isCellSkipped(above, colId)) continue;
    const span = getRowspan(above, colId);
    if (rowIndex - i < span) return false;
    break;
  }

  for (let j = colIdx - 1; j >= 0; j--) {
    const leftCol = sortedCols[j];
    if (isCellSkipped(row, leftCol.id)) continue;
    const span = getColspan(row, leftCol.id);
    if (colIdx - j < span) return false;
    break;
  }

  return true;
}

/** Fix rowspan/skip mismatches saved in the database. */
export function normalizeCellMeta(rows: Row[], columns: Column[]): Row[] {
  const sortedCols = sortByOrder(columns);

  let result = rows.map((r) => {
    let next = r;
    for (const col of sortedCols) {
      if (getCellMeta(next, col.id)?.skip) {
        next = patchRowMeta(next, col.id, null);
      }
    }
    return next;
  });

  const sorted = sortByOrder(result);
  for (const col of sortedCols) {
    for (let i = 0; i < sorted.length; i++) {
      const anchor = sorted[i];
      const span = getRowspan(anchor, col.id);
      if (span <= 1) continue;
      for (let j = 1; j < span && i + j < sorted.length; j++) {
        const targetId = sorted[i + j].id;
        result = result.map((r) =>
          r.id === targetId ? patchRowMeta(r, col.id, { skip: true }) : r
        );
      }
    }
  }

  return result;
}

export function mergeDown(rows: Row[], rowId: string, colId: string): Row[] {
  const anchor = resolveMergeAnchor(rows, rowId, colId);
  if (!anchor) return rows;

  const sorted = sortByOrder(rows);
  const idx = sorted.findIndex((r) => r.id === anchor.id);
  const currentSpan = getRowspan(anchor, colId);
  const absorbIdx = idx + currentSpan;

  if (idx < 0 || absorbIdx >= sorted.length) return rows;

  const absorbRow = sorted[absorbIdx];
  const newRowspan = currentSpan + 1;

  return rows.map((r) => {
    if (r.id === anchor.id) {
      return patchRowMeta(r, colId, {
        rowspan: newRowspan,
        colspan: getColspan(r, colId),
      });
    }
    if (r.id === absorbRow.id) {
      return patchRowMeta(r, colId, { skip: true });
    }
    return r;
  });
}

export function mergeRight(rows: Row[], rowId: string, colId: string, columns: Column[]): Row[] {
  const sortedCols = sortByOrder(columns);
  const anchor = resolveMergeAnchor(rows, rowId, colId);
  if (!anchor) return rows;

  const row = anchor;
  const colIdx = sortedCols.findIndex((c) => c.id === colId);
  if (colIdx < 0) return rows;

  const span = getColspan(row, colId);
  const rightIdx = colIdx + span;
  if (rightIdx >= sortedCols.length) return rows;

  const rightColId = sortedCols[rightIdx].id;
  const colspan = span + 1;

  return rows.map((r) => {
    if (r.id !== anchor.id) return r;
    let next = patchRowMeta(r, colId, {
      rowspan: getRowspan(r, colId),
      colspan,
    });
    next = patchRowMeta(next, rightColId, { skip: true });
    return next;
  });
}

export function splitCell(rows: Row[], rowId: string, colId: string, columns: Column[]): Row[] {
  const anchor = resolveMergeAnchor(rows, rowId, colId) ?? rows.find((r) => r.id === rowId);
  if (!anchor) return rows;

  const sorted = sortByOrder(rows);
  const sortedCols = sortByOrder(columns);
  const rowIdx = sorted.findIndex((r) => r.id === anchor.id);
  const colIdx = sortedCols.findIndex((c) => c.id === colId);
  if (rowIdx < 0 || colIdx < 0) return rows;

  const rowspan = getRowspan(anchor, colId);
  const colspan = getColspan(anchor, colId);

  const affectedRowIds = new Set(sorted.slice(rowIdx, rowIdx + rowspan).map((r) => r.id));
  const affectedColIds = new Set(sortedCols.slice(colIdx, colIdx + colspan).map((c) => c.id));

  let result = rows.map((r) => {
    if (!affectedRowIds.has(r.id)) return r;
    let next = r;
    Array.from(affectedColIds).forEach((cid) => {
      next = patchRowMeta(next, cid, null);
    });
    return next;
  });

  return normalizeCellMeta(result, columns);
}

export type SerialInfo = {
  display: number | null;
  rowspan: number;
};

/**
 * Serial numbers follow logical rows using the first column as the primary grouping key.
 */
export function buildSerialMap(rows: Row[], columns: Column[]): Map<string, SerialInfo> {
  const sorted = sortByOrder(rows);
  const sortedCols = sortByOrder(columns);
  const primaryColId = sortedCols[0]?.id;
  const map = new Map<string, SerialInfo>();
  let serial = 0;

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i];
    const isContinuation =
      primaryColId &&
      !shouldRenderCell(sorted, i, primaryColId, sortedCols);

    if (isContinuation) {
      map.set(row.id, { display: null, rowspan: 1 });
      continue;
    }

    serial += 1;
    let span = 1;
    if (primaryColId) {
      const anchorSpan = getRowspan(row, primaryColId);
      if (anchorSpan > 1) {
        span = anchorSpan;
      } else {
        for (let j = i + 1; j < sorted.length; j++) {
          if (!shouldRenderCell(sorted, j, primaryColId, sortedCols)) {
            span += 1;
          } else {
            break;
          }
        }
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
