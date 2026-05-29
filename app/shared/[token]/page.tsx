'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { Column, Row, PageLayout } from '@/lib/supabase';
import { buildColumnHeaderModel, getColspan, getRowspan, shouldRenderCell } from '@/lib/table-layout';

type SharedPayload = {
  page: { id: string; name: string; icon?: string; updated_at?: string; layout?: PageLayout };
  columns: Column[];
  rows: Row[];
};

export default function SharedPageView() {
  const { token } = useParams() as { token: string };
  const [data, setData] = useState<SharedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch(`/api/share/${token}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error ?? 'Failed to load shared page.');
        return body as SharedPayload;
      })
      .then((payload) => {
        if (!mounted) return;
        setData(payload);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load shared page.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  const visibleColumns = useMemo(() => {
    const columns = data?.columns ?? [];
    const sorted = [...columns].sort((a, b) => a.order_index - b.order_index);
    const visible = sorted.filter((c) => c.is_visible !== false);
    return visible.length > 0 ? visible : sorted;
  }, [data]);

  const headerModel = useMemo(
    () => buildColumnHeaderModel(visibleColumns, data?.page?.layout),
    [visibleColumns, data?.page?.layout]
  );
  const hasGroupedHeaders = (data?.page?.layout?.column_groups?.length ?? 0) > 0;

  const sortedRows = useMemo(
    () => [...(data?.rows ?? [])].sort((a, b) => a.order_index - b.order_index),
    [data?.rows]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading shared page...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-lg text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">Link unavailable</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{error || 'This shared page is not available.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-white/90 dark:bg-slate-900/70 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {data.page.icon || '📋'} {data.page.name}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Read-only shared page · {data.rows.length} rows · {visibleColumns.length} columns
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-auto">
            <table className="min-w-full border-separate border-spacing-0">
            <thead>
              {hasGroupedHeaders ? (
                <>
                  <tr>
                    {headerModel.ungrouped.map((col) => (
                      <th
                        key={col.id}
                        rowSpan={2}
                        className="sticky top-0 z-10 bg-slate-900 text-white text-center text-xs font-semibold px-3 py-3 border-b border-r border-slate-700 whitespace-nowrap"
                      >
                        {col.name}
                      </th>
                    ))}
                    {headerModel.groups.map((group) => (
                      <th
                        key={group.id}
                        colSpan={group.column_ids.length}
                        className="sticky top-0 z-10 bg-slate-800 text-white text-center text-xs font-semibold px-3 py-3 border-b border-slate-700 whitespace-nowrap"
                      >
                        {group.label}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {headerModel.groups.flatMap((group) =>
                      group.column_ids
                        .map((cid) => visibleColumns.find((c) => c.id === cid))
                        .filter(Boolean)
                        .map((col) => (
                          <th
                            key={col!.id}
                            className="sticky top-0 z-10 bg-slate-900 text-white text-center text-xs font-semibold px-3 py-3 border-b border-r border-slate-700 whitespace-nowrap"
                          >
                            {col!.name}
                          </th>
                        ))
                    )}
                  </tr>
                </>
              ) : (
                <tr>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.id}
                      className="sticky top-0 z-10 bg-slate-900 text-white text-center text-xs font-semibold px-3 py-3 border-b border-slate-700 whitespace-nowrap"
                    >
                      {col.name}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {sortedRows.map((row, rowIndex) => (
                <tr key={row.id} className={rowIndex % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50 dark:bg-slate-900/40'}>
                  {visibleColumns.map((col) => {
                    if (!shouldRenderCell(sortedRows, rowIndex, col.id, visibleColumns)) return null;
                    const rowspan = getRowspan(row, col.id);
                    const colspan = getColspan(row, col.id);
                    return (
                      <td
                        key={`${row.id}-${col.id}`}
                        rowSpan={rowspan > 1 ? rowspan : undefined}
                        colSpan={colspan > 1 ? colspan : undefined}
                        className="px-3 py-2 text-sm border-b border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 align-middle text-center whitespace-nowrap"
                      >
                        {formatCell(row.data[col.id])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
