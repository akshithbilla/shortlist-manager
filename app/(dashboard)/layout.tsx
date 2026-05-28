'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { Sidebar } from '@/components/sidebar';
import type { Page } from '@/lib/supabase';
import { COLLEGE_COLUMNS, SAMPLE_COLLEGES } from '@/lib/college-template';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser, setWorkspace, setPages, pages, sidebarOpen, setSidebarOpen } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session?.user) {
        router.push('/login');
        return;
      }
      const u = data.session.user;
      setUser(u);

      // Get or create workspace
      let { data: ws } = await supabase.from('workspaces').select('*').eq('user_id', u.id).maybeSingle();
      if (!ws) {
        const name = u.user_metadata?.full_name ? `${u.user_metadata.full_name}'s Workspace` : 'My Workspace';
        const { data: newWs } = await supabase.from('workspaces').insert({ user_id: u.id, name }).select().single();
        ws = newWs;
      }
      if (ws) setWorkspace(ws);

      // Load pages
      const { data: pagesData } = await supabase
        .from('pages')
        .select('*')
        .eq('user_id', u.id)
        .order('order_index');
      setPages(pagesData ?? []);

      setLoading(false);
    });
  }, [router, setUser, setWorkspace, setPages]);

  async function handleCreatePage() {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const { data: ws } = await supabase.from('workspaces').select('id').eq('user_id', u.id).maybeSingle();
    if (!ws) return;

    const { data: page } = await supabase.from('pages').insert({
      workspace_id: ws.id,
      user_id: u.id,
      name: 'Untitled',
      icon: '📋',
      order_index: pages.length,
    }).select().single();

    if (page) {
      setPages([...pages, page]);
      router.push(`/page/${page.id}`);
    }
  }

  async function handleCreateCollegePage() {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const { data: ws } = await supabase.from('workspaces').select('id').eq('user_id', u.id).maybeSingle();
    if (!ws) return;

    const { data: page } = await supabase.from('pages').insert({
      workspace_id: ws.id,
      user_id: u.id,
      name: 'My College Shortlist',
      icon: '🎓',
      order_index: pages.length,
    }).select().single();

    if (!page) return;

    // Create columns
    const columnInserts = COLLEGE_COLUMNS.map((col, i) => ({
      page_id: page.id,
      user_id: u.id,
      name: col.name,
      type: col.type,
      options: col.options ?? [],
      order_index: i,
      width: col.width ?? 200,
    }));
    const { data: createdCols } = await supabase.from('columns').insert(columnInserts).select();

    // Create sample rows
    if (createdCols) {
      const colMap: Record<string, string> = {};
      createdCols.forEach((c: { name: string; id: string }) => {
        colMap[c.name] = c.id;
      });

      const rowInserts = SAMPLE_COLLEGES.map((college, i) => {
        const data: Record<string, unknown> = {};
        Object.entries(college).forEach(([key, val]) => {
          if (colMap[key]) data[colMap[key]] = val;
        });
        return { page_id: page.id, user_id: u.id, data, order_index: i };
      });

      await supabase.from('rows').insert(rowInserts);
    }

    setPages([...pages, page]);
    router.push(`/page/${page.id}`);
  }

  async function handleDeletePage(id: string) {
    await supabase.from('pages').delete().eq('id', id);
    const updated = pages.filter((p) => p.id !== id);
    setPages(updated);
    if (window.location.pathname === `/page/${id}`) {
      router.push('/dashboard');
    }
  }

  async function handleDuplicatePage(id: string) {
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const original = pages.find((p) => p.id === id);
    if (!original) return;

    const { data: newPage } = await supabase.from('pages').insert({
      workspace_id: original.workspace_id,
      user_id: u.id,
      name: `${original.name} (Copy)`,
      icon: original.icon,
      order_index: pages.length,
    }).select().single();

    if (!newPage) return;

    // Duplicate columns
    const { data: cols } = await supabase.from('columns').select('*').eq('page_id', id);
    if (cols?.length) {
      const colMap: Record<string, string> = {};
      const colInserts = cols.map(({ id: _, created_at: __, updated_at: ___, page_id: ____, ...rest }) => ({
        ...rest,
        page_id: newPage.id,
        user_id: u.id,
      }));
      const { data: newCols } = await supabase.from('columns').insert(colInserts).select();
      if (newCols) {
        cols.forEach((c, i) => { colMap[c.id] = newCols[i]?.id ?? ''; });
      }

      // Duplicate rows
      const { data: rowsData } = await supabase.from('rows').select('*').eq('page_id', id);
      if (rowsData?.length && Object.keys(colMap).length) {
        const rowInserts = rowsData.map(({ id: _, created_at: __, updated_at: ___, page_id: ____, user_id: _____, ...rest }) => {
          const newData: Record<string, unknown> = {};
          Object.entries(rest.data as Record<string, unknown>).forEach(([colId, val]) => {
            if (colMap[colId]) newData[colMap[colId]] = val;
          });
          return { ...rest, page_id: newPage.id, user_id: u.id, data: newData };
        });
        await supabase.from('rows').insert(rowInserts);
      }
    }

    setPages([...pages, newPage]);
    router.push(`/page/${newPage.id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-slate-300 dark:border-slate-600 border-t-slate-900 dark:border-t-white rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-950">
      <Sidebar
        pages={pages}
        onCreatePage={handleCreatePage}
        onDeletePage={handleDeletePage}
        onDuplicatePage={handleDuplicatePage}
      />
      <main className="flex-1 overflow-auto">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-3 left-3 z-40 md:hidden w-8 h-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center shadow-sm"
        >
          <Menu className="w-4 h-4" />
        </button>
        {children}
      </main>
    </div>
  );
}
