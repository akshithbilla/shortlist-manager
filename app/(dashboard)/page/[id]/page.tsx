'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Star, StarOff, MoreHorizontal, Download, FileText,
  Table2, Printer, Pencil, Check, Loader2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { DataTable } from '@/components/data-table';
import { exportToCSV, exportToExcel, exportToPDF } from '@/lib/export';
import type { Page } from '@/lib/supabase';

const PAGE_ICONS = ['📋', '🎓', '📊', '📌', '🔍', '💡', '📁', '🗂️', '✨', '🏆', '🎯', '📚'];

export default function PageView() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { pages, setPages, setColumns, setRows, columns, rows } = useAppStore();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const loadPage = useCallback(async () => {
    setLoading(true);
    const { data: pageData } = await supabase.from('pages').select('*').eq('id', id).maybeSingle();
    if (!pageData) { router.push('/dashboard'); return; }
    setPage(pageData);
    setNameVal(pageData.name);

    const [{ data: colsData }, { data: rowsData }] = await Promise.all([
      supabase.from('columns').select('*').eq('page_id', id).order('order_index'),
      supabase.from('rows').select('*').eq('page_id', id).order('order_index'),
    ]);

    setColumns(colsData ?? []);
    setRows(rowsData ?? []);
    setLoading(false);
  }, [id, router, setColumns, setRows]);

  useEffect(() => { loadPage(); }, [loadPage]);

  async function handleSaveName() {
    if (!nameVal.trim() || !page) return;
    const updated = { ...page, name: nameVal.trim() };
    setPage(updated);
    setPages(pages.map((p) => p.id === id ? updated : p));
    await supabase.from('pages').update({ name: nameVal.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    setEditingName(false);
  }

  async function handleToggleFavorite() {
    if (!page) return;
    const updated = { ...page, is_favorite: !page.is_favorite };
    setPage(updated);
    setPages(pages.map((p) => p.id === id ? updated : p));
    await supabase.from('pages').update({ is_favorite: updated.is_favorite }).eq('id', id);
  }

  async function handleIconChange(icon: string) {
    if (!page) return;
    const updated = { ...page, icon };
    setPage(updated);
    setPages(pages.map((p) => p.id === id ? updated : p));
    await supabase.from('pages').update({ icon }).eq('id', id);
    setShowIconPicker(false);
  }

  async function handleExport(format: 'csv' | 'xlsx' | 'pdf') {
    setExportLoading(true);
    setShowMenu(false);
    const filename = page?.name ?? 'export';
    try {
      if (format === 'csv') exportToCSV(columns, rows, filename);
      else if (format === 'xlsx') exportToExcel(columns, rows, filename);
      else await exportToPDF(columns, rows, page?.name ?? 'Report', filename);
    } finally {
      setExportLoading(false);
    }
  }

  function handlePrint() {
    window.print();
    setShowMenu(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 dark:border-slate-600 border-t-slate-900 dark:border-t-white rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading page...</p>
        </div>
      </div>
    );
  }

  if (!page) return null;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Page header */}
      <div className="px-8 pt-8 pb-4 border-b border-slate-100 dark:border-slate-800">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
          {/* Icon */}
          <div className="relative">
            <button
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="text-4xl hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl p-1 transition"
              title="Change icon"
            >
              {page.icon || '📋'}
            </button>
            {showIconPicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-3 grid grid-cols-6 gap-1"
              >
                {PAGE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => handleIconChange(icon)}
                    className="text-xl p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    {icon}
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Name */}
          <div className="flex-1 min-w-0">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameVal}
                  onChange={(e) => setNameVal(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="text-3xl font-bold bg-transparent text-slate-900 dark:text-white focus:outline-none border-b-2 border-blue-400 flex-1"
                />
                <button onClick={handleSaveName} className="text-green-600">
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white truncate">{page.name}</h1>
                <button
                  onClick={() => setEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            )}
            <p className="text-sm text-slate-400 mt-1">
              {rows.length} records · {columns.length} columns · Updated {new Date(page.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleToggleFavorite}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition ${
                page.is_favorite
                  ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-500'
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:border-slate-300 hover:text-amber-400'
              }`}
              title={page.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Star className="w-4 h-4" fill={page.is_favorite ? 'currentColor' : 'none'} />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white transition"
              >
                {exportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
              </button>

              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute right-0 mt-1 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl py-1 min-w-[180px]"
                  onMouseLeave={() => setShowMenu(false)}
                >
                  <div className="px-3 py-1.5 text-xs text-slate-400 uppercase tracking-wide font-medium">Export</div>
                  <button onClick={() => handleExport('csv')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <FileText className="w-3.5 h-3.5" /> Export as CSV
                  </button>
                  <button onClick={() => handleExport('xlsx')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Table2 className="w-3.5 h-3.5" /> Export as Excel
                  </button>
                  <button onClick={() => handleExport('pdf')} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Download className="w-3.5 h-3.5" /> Export as PDF
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                  <button onClick={handlePrint} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-hidden">
        <DataTable pageId={id} />
      </div>
    </div>
  );
}
