'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Filter, Eye, X,
  ChevronLeft, ChevronRight, Search, Star, GripVertical,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { CellEditor } from './cell-editor';
import { ColumnHeader } from './column-header';
import { AddColumnModal } from './add-column-modal';
import { CellContextMenu } from './cell-context-menu';
import type { Column, Row, ColumnType, PageLayout, ColumnGroup } from '@/lib/supabase';
import {
  sortByOrder,
  mergeDown,
  mergeRight,
  splitCell,
  getRowspan,
  resolveMergeAnchor,
  getColspan,
  buildColumnHeaderModel,
  buildSerialMap,
  isMergedCell,
  normalizeCellMeta,
  shouldRenderCell,
} from '@/lib/table-layout';
import type { SerialInfo } from '@/lib/table-layout';

const PAGE_SIZE = 25;

interface DataTableProps {
  pageId: string;
}

export function DataTable({ pageId }: DataTableProps) {
  const {
    columns,
    rows,
    selectedRows,
    currentPage,
    addRow,
    updateRow,
    deleteRow,
    addColumn,
    updateColumn,
    deleteColumn,
    setColumns,
    setRows,
    toggleRowSelection,
    clearSelection,
    setSelectedRows,
    setCurrentPage,
  } = useAppStore();

  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [showAddCol, setShowAddCol] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filterCol, setFilterCol] = useState<string | null>(null);
  const [filterVal, setFilterVal] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);
  const [showHiddenPanel, setShowHiddenPanel] = useState(false);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [dragRowId, setDragRowId] = useState<string | null>(null);
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [cellMenu, setCellMenu] = useState<{ rowId: string; colId: string; x: number; y: number } | null>(null);

  const pageLayout = currentPage?.layout;

  const visibleCols = useMemo(
    () => columns.filter((c) => !hiddenCols.includes(c.id)).sort((a, b) => a.order_index - b.order_index),
    [columns, hiddenCols]
  );

  const headerModel = useMemo(
    () => buildColumnHeaderModel(visibleCols, pageLayout),
    [visibleCols, pageLayout]
  );

  const filteredRows = useMemo(() => {
    let result = sortByOrder(rows);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        Object.values(r.data).some((v) => String(v ?? '').toLowerCase().includes(q))
      );
    }
    if (filterCol && filterVal) {
      result = result.filter((r) => {
        const v = r.data[filterCol];
        return String(v ?? '').toLowerCase().includes(filterVal.toLowerCase());
      });
    }
    if (sortCol) {
      result.sort((a, b) => {
        const av = a.data[sortCol];
        const bv = b.data[sortCol];
        const aStr = String(av ?? '');
        const bStr = String(bv ?? '');
        const aNum = Number(av);
        const bNum = Number(bv);
        const numCompare = !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : aStr.localeCompare(bStr);
        return sortDir === 'asc' ? numCompare : -numCompare;
      });
    }
    return result;
  }, [rows, search, filterCol, filterVal, sortCol, sortDir]);

  const paginatedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const hasGroupedHeaders = (pageLayout?.column_groups?.length ?? 0) > 0;

  const serialMap = useMemo(
    () => buildSerialMap(filteredRows, visibleCols),
    [filteredRows, visibleCols]
  );

  useEffect(() => {
    const close = () => setCellMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  async function persistAllRows(fullRows: Row[], rowsToSave?: Row[]) {
    setRows(fullRows);
    const saves = rowsToSave ?? fullRows;
    await Promise.all(
      saves.map((r) =>
        supabase.from('rows').update({
          cell_meta: r.cell_meta ?? {},
          updated_at: new Date().toISOString(),
        }).eq('id', r.id)
      )
    );
  }

  async function persistPageLayout(layout: PageLayout) {
    if (!currentPage) return;
    const updated = { ...currentPage, layout, updated_at: new Date().toISOString() };
    setCurrentPage(updated);
    await supabase.from('pages').update({ layout, updated_at: updated.updated_at }).eq('id', pageId);
  }

  async function saveRowPatch(row: Row) {
    updateRow(row.id, { cell_meta: row.cell_meta });
    await supabase.from('rows').update({
      cell_meta: row.cell_meta ?? {},
      updated_at: new Date().toISOString(),
    }).eq('id', row.id);
  }

  function handleSort(colId: string) {
    if (sortCol === colId) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  }

  async function handleAddRow() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: newRow } = await supabase.from('rows').insert({
      page_id: pageId,
      user_id: user.id,
      data: {},
      order_index: rows.length,
    }).select().single();
    if (newRow) addRow(newRow);
  }

  async function handleCellChange(rowId: string, colId: string, value: unknown) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    const newData = { ...row.data, [colId]: value };
    updateRow(rowId, { data: newData });
    await supabase.from('rows').update({ data: newData, updated_at: new Date().toISOString() }).eq('id', rowId);
  }

  async function handleDeleteSelectedRows() {
    if (!selectedRows.length) return;
    await supabase.from('rows').delete().in('id', selectedRows);
    selectedRows.forEach((id) => deleteRow(id));
    clearSelection();
  }

  async function handleDeleteRow(id: string) {
    await supabase.from('rows').delete().eq('id', id);
    deleteRow(id);
  }

  async function handleToggleFavoriteRow(row: Row) {
    const newVal = !row.is_favorite;
    updateRow(row.id, { is_favorite: newVal });
    await supabase.from('rows').update({ is_favorite: newVal }).eq('id', row.id);
  }

  async function handleAddColumn(name: string, type: ColumnType, options: string[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: col } = await supabase.from('columns').insert({
      page_id: pageId,
      user_id: user.id,
      name,
      type,
      options,
      order_index: columns.length,
      width: 200,
    }).select().single();
    if (col) addColumn(col);
  }

  async function handleRenameColumn(colId: string, name: string) {
    updateColumn(colId, { name });
    await supabase.from('columns').update({ name, updated_at: new Date().toISOString() }).eq('id', colId);
  }

  async function handleDeleteColumn(colId: string) {
    deleteColumn(colId);
    await supabase.from('columns').delete().eq('id', colId);
  }

  async function handleTypeChange(colId: string, type: ColumnType) {
    updateColumn(colId, { type });
    await supabase.from('columns').update({ type, updated_at: new Date().toISOString() }).eq('id', colId);
  }

  function toggleHideCol(id: string) {
    setHiddenCols((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function applyMerge(
    fn: (all: Row[], rowId: string, colId: string, cols: Column[]) => Row[],
    rowId: string,
    colId: string
  ) {
    const merged = fn(rows, rowId, colId, visibleCols);
    const next = normalizeCellMeta(merged, visibleCols);
    const changed = next.filter((r) => {
      const old = rows.find((o) => o.id === r.id);
      return JSON.stringify(old?.cell_meta ?? {}) !== JSON.stringify(r.cell_meta ?? {});
    });
    setRows(next);
    await Promise.all(changed.map((r) => saveRowPatch(r)));
    setCellMenu(null);
  }

  async function handleGroupWithNext(colId: string) {
    const sorted = sortByOrder(visibleCols);
    const idx = sorted.findIndex((c) => c.id === colId);
    if (idx < 0 || idx >= sorted.length - 1) return;

    const a = sorted[idx];
    const b = sorted[idx + 1];
    const groups: ColumnGroup[] = [...(pageLayout?.column_groups ?? [])];

    const existing = groups.find((g) => g.column_ids.includes(a.id));
    if (existing) {
      if (!existing.column_ids.includes(b.id)) {
        existing.column_ids.push(b.id);
      }
    } else {
      groups.push({
        id: crypto.randomUUID(),
        label: `${a.name} group`,
        column_ids: [a.id, b.id],
      });
    }

    await persistPageLayout({ ...pageLayout, column_groups: groups });
  }

  async function reorderRows(fromId: string, toId: string) {
    if (fromId === toId) return;
    const sorted = sortByOrder(rows);
    const fromIdx = sorted.findIndex((r) => r.id === fromId);
    const toIdx = sorted.findIndex((r) => r.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...sorted];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const reindexed = next.map((r, i) => ({ ...r, order_index: i }));

    setRows(reindexed);
    await Promise.all(
      reindexed.map((r) =>
        supabase.from('rows').update({ order_index: r.order_index, updated_at: new Date().toISOString() }).eq('id', r.id)
      )
    );
  }

  async function reorderColumns(fromId: string, toId: string) {
    if (fromId === toId) return;
    const sorted = sortByOrder(columns);
    const fromIdx = sorted.findIndex((c) => c.id === fromId);
    const toIdx = sorted.findIndex((c) => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const next = [...sorted];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const reindexed = next.map((c, i) => ({ ...c, order_index: i }));

    setColumns(reindexed);
    await Promise.all(
      reindexed.map((c) =>
        supabase.from('columns').update({ order_index: c.order_index, updated_at: new Date().toISOString() }).eq('id', c.id)
      )
    );
  }

  const allSelected = paginatedRows.length > 0 && paginatedRows.every((r) => selectedRows.includes(r.id));
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedRows(selectedRows.filter((id) => !paginatedRows.some((r) => r.id === id)));
    } else {
      const combined = selectedRows.concat(paginatedRows.map((r) => r.id));
      setSelectedRows(combined.filter((v, i, arr) => arr.indexOf(v) === i));
    }
  }

  const menuRow = cellMenu ? rows.find((r) => r.id === cellMenu.rowId) : null;
  const sortedAll = sortByOrder(rows);
  const menuRowIdx = menuRow ? sortedAll.findIndex((r) => r.id === menuRow.id) : -1;
  const menuColIdx = cellMenu ? visibleCols.findIndex((c) => c.id === cellMenu.colId) : -1;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 flex-wrap">
        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search records..."
            className="text-sm bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none w-40"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterCol ?? ''}
            onChange={(e) => { setFilterCol(e.target.value || null); setPage(0); }}
            className="text-sm bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none"
          >
            <option value="">Filter by...</option>
            {visibleCols.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {filterCol && (
            <input
              value={filterVal}
              onChange={(e) => { setFilterVal(e.target.value); setPage(0); }}
              placeholder="Value..."
              className="text-sm bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none w-24 border-l border-slate-200 dark:border-slate-700 pl-2"
            />
          )}
          {(filterCol || filterVal) && (
            <button onClick={() => { setFilterCol(null); setFilterVal(''); }} className="text-slate-400 hover:text-slate-700">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowHiddenPanel(!showHiddenPanel)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <Eye className="w-3.5 h-3.5" />
          Fields {hiddenCols.length > 0 && <span className="text-xs bg-slate-200 dark:bg-slate-700 rounded px-1">{hiddenCols.length} hidden</span>}
        </button>

        <span className="text-xs text-slate-400 hidden md:inline">
          Right-click a cell to merge/split · Drag row/column handles to reorder
        </span>

        {selectedRows.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleDeleteSelectedRows}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete {selectedRows.length} row{selectedRows.length > 1 ? 's' : ''}
          </motion.button>
        )}

        <AnimatePresence>
          {showHiddenPanel && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 min-w-[220px]"
            >
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Column visibility</p>
              {columns.map((col) => (
                <div key={col.id} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-slate-700 dark:text-slate-200">{col.name}</span>
                  <button
                    onClick={() => toggleHideCol(col.id)}
                    className={`w-8 h-4 rounded-full transition-colors ${hiddenCols.includes(col.id) ? 'bg-slate-200 dark:bg-slate-700' : 'bg-slate-900 dark:bg-white'}`}
                  >
                    <div className={`w-3 h-3 rounded-full bg-white dark:bg-slate-900 transition-transform mx-0.5 ${hiddenCols.includes(col.id) ? 'translate-x-0' : 'translate-x-4'}`} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            {hasGroupedHeaders ? (
              <>
                <tr>
                  <th rowSpan={2} className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-800 w-10" />
                  <th rowSpan={2} className="bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-800 w-12 text-xs text-slate-400">#</th>
                  <th rowSpan={2} className="bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-800 w-10" />
                  {headerModel.ungrouped.map((col) => (
                    <th
                      key={col.id}
                      rowSpan={2}
                      style={{ minWidth: col.width || 160 }}
                      className="bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-800 px-3 py-2.5 text-left align-middle"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => dragColId && reorderColumns(dragColId, col.id)}
                    >
                      <ColumnHeader
                        column={col}
                        sortDir={sortCol === col.id ? sortDir : null}
                        onSort={() => handleSort(col.id)}
                        onRename={(name) => handleRenameColumn(col.id, name)}
                        onDelete={() => handleDeleteColumn(col.id)}
                        onHide={() => toggleHideCol(col.id)}
                        onTypeChange={(type) => handleTypeChange(col.id, type)}
                        onGroupWithNext={() => handleGroupWithNext(col.id)}
                        draggable
                        onDragStart={() => setDragColId(col.id)}
                        onDragEnd={() => setDragColId(null)}
                      />
                    </th>
                  ))}
                  {headerModel.groups.map((group) => (
                    <th
                      key={group.id}
                      colSpan={group.column_ids.length}
                      className="bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-2 text-center text-sm font-semibold text-slate-700 dark:text-slate-200"
                    >
                      {group.label}
                    </th>
                  ))}
                  <th rowSpan={2} className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 w-12" />
                </tr>
                <tr>
                  {headerModel.groups.flatMap((group) =>
                    group.column_ids
                      .map((cid) => visibleCols.find((c) => c.id === cid))
                      .filter(Boolean)
                      .map((col) => (
                        <th
                          key={col!.id}
                          style={{ minWidth: col!.width || 160 }}
                          className="bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-800 px-3 py-2 text-left"
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => dragColId && reorderColumns(dragColId, col!.id)}
                        >
                          <ColumnHeader
                            column={col!}
                            sortDir={sortCol === col!.id ? sortDir : null}
                            onSort={() => handleSort(col!.id)}
                            onRename={(name) => handleRenameColumn(col!.id, name)}
                            onDelete={() => handleDeleteColumn(col!.id)}
                            onHide={() => toggleHideCol(col!.id)}
                            onTypeChange={(type) => handleTypeChange(col!.id, type)}
                            onGroupWithNext={() => handleGroupWithNext(col!.id)}
                            draggable
                            onDragStart={() => setDragColId(col!.id)}
                            onDragEnd={() => setDragColId(null)}
                          />
                        </th>
                      ))
                  )}
                </tr>
              </>
            ) : (
              <tr>
                <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-800 w-10 px-3">
                  <div
                    className={`w-4 h-4 rounded border-2 cursor-pointer flex items-center justify-center ${allSelected && paginatedRows.length > 0 ? 'bg-slate-900 dark:bg-white border-transparent' : 'border-slate-300 dark:border-slate-600'}`}
                    onClick={toggleSelectAll}
                  >
                    {allSelected && paginatedRows.length > 0 && (
                      <svg className="w-2.5 h-2.5 text-white dark:text-slate-900" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </th>
                <th className="bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-800 w-12 px-3 py-2 text-xs text-slate-400 font-medium text-right">#</th>
                <th className="bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-800 w-10" />
                {visibleCols.map((col) => (
                  <th
                    key={col.id}
                    style={{ minWidth: col.width || 160, maxWidth: col.width || 300 }}
                    className="bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-2.5 text-center"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => dragColId && reorderColumns(dragColId, col.id)}
                  >
                    <ColumnHeader
                      column={col}
                      sortDir={sortCol === col.id ? sortDir : null}
                      onSort={() => handleSort(col.id)}
                      onRename={(name) => handleRenameColumn(col.id, name)}
                      onDelete={() => handleDeleteColumn(col.id)}
                      onHide={() => toggleHideCol(col.id)}
                      onTypeChange={(type) => handleTypeChange(col.id, type)}
                      onGroupWithNext={() => handleGroupWithNext(col.id)}
                      draggable
                      onDragStart={() => setDragColId(col.id)}
                      onDragEnd={() => setDragColId(null)}
                    />
                  </th>
                ))}
                <th className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 w-12 px-2">
                  <button
                    onClick={() => setShowAddCol(true)}
                    className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
                    title="Add column"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </th>
              </tr>
            )}
          </thead>

          <tbody>
            {paginatedRows.map((row) => {
              const rowIndex = filteredRows.findIndex((r) => r.id === row.id);
              return (
              <TableRow
                key={row.id}
                row={row}
                rowIndex={rowIndex}
                allRows={filteredRows}
                serial={serialMap.get(row.id) ?? { display: null, rowspan: 1 }}
                columns={visibleCols}
                isSelected={selectedRows.includes(row.id)}
                editingCell={editingCell}
                isDragging={dragRowId === row.id}
                onToggleSelect={() => toggleRowSelection(row.id)}
                onCellChange={handleCellChange}
                onStartEdit={(colId) => setEditingCell({ rowId: row.id, colId })}
                onEndEdit={() => setEditingCell(null)}
                onDelete={() => handleDeleteRow(row.id)}
                onToggleFavorite={() => handleToggleFavoriteRow(row)}
                onCellContextMenu={(colId, e) => {
                  e.preventDefault();
                  setCellMenu({ rowId: row.id, colId, x: e.clientX, y: e.clientY });
                }}
                onDragStart={() => setDragRowId(row.id)}
                onDragEnd={() => setDragRowId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragRowId && reorderRows(dragRowId, row.id)}
              />
            );
            })}

            <tr>
              <td colSpan={visibleCols.length + 4} className="border-b border-slate-100 dark:border-slate-800/50">
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5 w-full px-4 py-2 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900 transition"
                >
                  <Plus className="w-3.5 h-3.5" /> New record
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        {filteredRows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-slate-400 text-sm">No records found</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between bg-white dark:bg-slate-950">
        <span className="text-xs text-slate-400">
          {filteredRows.length} record{filteredRows.length !== 1 ? 's' : ''}
          {selectedRows.length > 0 && ` · ${selectedRows.length} selected`}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-slate-500">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-900 transition"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showAddCol && (
        <AddColumnModal onAdd={handleAddColumn} onClose={() => setShowAddCol(false)} />
      )}

      {cellMenu && menuRow && (
        <CellContextMenu
          x={cellMenu.x}
          y={cellMenu.y}
          canMergeDown={(() => {
            const anchor = resolveMergeAnchor(rows, cellMenu.rowId, cellMenu.colId);
            if (!anchor) return false;
            const idx = sortByOrder(rows).findIndex((r) => r.id === anchor.id);
            const span = getRowspan(anchor, cellMenu.colId);
            return idx >= 0 && idx + span < sortByOrder(rows).length;
          })()}
          canMergeRight={(() => {
            const anchor = resolveMergeAnchor(rows, cellMenu.rowId, cellMenu.colId);
            if (!anchor) return false;
            const colIdx = visibleCols.findIndex((c) => c.id === cellMenu.colId);
            return colIdx >= 0 && colIdx + getColspan(anchor, cellMenu.colId) < visibleCols.length;
          })()}
          canSplit={(() => {
            const anchor = resolveMergeAnchor(rows, cellMenu.rowId, cellMenu.colId) ?? menuRow;
            return (
              getRowspan(anchor, cellMenu.colId) > 1 ||
              getColspan(anchor, cellMenu.colId) > 1 ||
              !shouldRenderCell(sortedAll, menuRowIdx, cellMenu.colId, visibleCols)
            );
          })()}
          onMergeDown={() => applyMerge(mergeDown, cellMenu.rowId, cellMenu.colId)}
          onMergeRight={() => applyMerge(mergeRight, cellMenu.rowId, cellMenu.colId)}
          onSplit={async () => {
            const next = splitCell(rows, cellMenu.rowId, cellMenu.colId, visibleCols);
            const changed = next.filter((r) => {
              const old = rows.find((o) => o.id === r.id);
              return JSON.stringify(old?.cell_meta ?? {}) !== JSON.stringify(r.cell_meta ?? {});
            });
            await persistAllRows(next, changed);
            setCellMenu(null);
          }}
        />
      )}
    </div>
  );
}

interface TableRowProps {
  row: Row;
  rowIndex: number;
  allRows: Row[];
  serial: SerialInfo;
  columns: Column[];
  isSelected: boolean;
  isDragging: boolean;
  editingCell: { rowId: string; colId: string } | null;
  onToggleSelect: () => void;
  onCellChange: (rowId: string, colId: string, value: unknown) => void;
  onStartEdit: (colId: string) => void;
  onEndEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onCellContextMenu: (colId: string, e: React.MouseEvent) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

function TableRow({
  row,
  rowIndex,
  allRows,
  serial,
  columns,
  isSelected,
  isDragging,
  editingCell,
  onToggleSelect,
  onCellChange,
  onStartEdit,
  onEndEdit,
  onDelete,
  onToggleFavorite,
  onCellContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: TableRowProps) {
  const ROW_HEIGHT = 40;

  return (
    <tr
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group transition ${isDragging ? 'opacity-50' : ''} ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : 'even:bg-slate-50/70 odd:bg-white dark:even:bg-slate-900/40 dark:odd:bg-slate-950 hover:bg-slate-100/80 dark:hover:bg-slate-900/60'}`}
    >
      <td className="sticky left-0 z-10 border-b border-r border-slate-100 dark:border-slate-800 w-10 px-2 bg-inherit">
        <div className="flex items-center gap-1">
          <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500 opacity-0 group-hover:opacity-100"
            title="Drag to reorder row"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </span>
          <div
            className={`w-4 h-4 rounded border-2 cursor-pointer flex items-center justify-center transition ${isSelected ? 'bg-blue-600 border-transparent' : 'border-slate-300 dark:border-slate-600 opacity-0 group-hover:opacity-100'}`}
            onClick={onToggleSelect}
          >
            {isSelected && (
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </td>

      {serial.display !== null && (
        <td
          rowSpan={serial.rowspan > 1 ? serial.rowspan : undefined}
          className="border-b border-r border-slate-100 dark:border-slate-800 w-12 px-3 text-xs text-slate-400 text-center align-middle"
        >
          <span className="group-hover:hidden inline-block w-full text-center">{serial.display}</span>
          <button onClick={onDelete} className="hidden group-hover:block text-red-400 hover:text-red-600 mx-auto">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      )}

      <td className="border-b border-r border-slate-100 dark:border-slate-800 w-10 px-2">
        <button
          onClick={onToggleFavorite}
          className={`transition ${row.is_favorite ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700 opacity-0 group-hover:opacity-100 hover:text-amber-300'}`}
        >
          <Star className="w-3.5 h-3.5" fill={row.is_favorite ? 'currentColor' : 'none'} />
        </button>
      </td>

      {columns.map((col) => {
        if (!shouldRenderCell(allRows, rowIndex, col.id, columns)) return null;

        const isEditing = editingCell?.rowId === row.id && editingCell?.colId === col.id;
        const rowspan = getRowspan(row, col.id);
        const colspan = getColspan(row, col.id);
        const merged = isMergedCell(row, col.id);

        return (
          <td
            key={col.id}
            rowSpan={rowspan > 1 ? rowspan : undefined}
            colSpan={colspan > 1 ? colspan : undefined}
            style={{
              height: merged && rowspan > 1 ? ROW_HEIGHT * rowspan : ROW_HEIGHT,
              minWidth: col.width || 160,
              maxWidth: col.width || 300,
            }}
            className={`border-b border-r border-slate-200 dark:border-slate-700 text-center align-middle p-2 ${
              isEditing ? 'ring-2 ring-inset ring-blue-400 z-10 relative' : ''
            } ${merged ? 'bg-slate-50 dark:bg-slate-900/60' : ''}`}
            onContextMenu={(e) => onCellContextMenu(col.id, e)}
          >
            <div className="flex h-full min-h-[2.5rem] w-full items-center justify-center text-center">
            <CellEditor
              column={col}
              value={row.data[col.id]}
              onChange={(v) => onCellChange(row.id, col.id, v)}
              onBlur={onEndEdit}
              editing={isEditing}
              onStartEdit={() => onStartEdit(col.id)}
            />
            </div>
          </td>
        );
      })}

      <td className="border-b border-slate-100 dark:border-slate-800 w-12" />
    </tr>
  );
}
