'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus, GraduationCap, FileText, Star, Clock, Trash2,
  ArrowRight, BarChart3, BookOpen, Target, TrendingUp
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import { COLLEGE_COLUMNS, SAMPLE_COLLEGES } from '@/lib/college-template';
import type { Page } from '@/lib/supabase';

const ICONS = ['📋', '🎓', '📊', '📌', '🔍', '💡', '📁', '🗂️', '✨', '🏆'];

export default function DashboardPage() {
  const router = useRouter();
  const { user, pages, setPages } = useAppStore();
  const [recentPages, setRecentPages] = useState<Page[]>([]);
  const [stats, setStats] = useState({ total: 0, favorites: 0, recent: 0 });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setRecentPages([...pages].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6));
    setStats({
      total: pages.length,
      favorites: pages.filter((p) => p.is_favorite).length,
      recent: pages.filter((p) => {
        const d = new Date(p.updated_at);
        return Date.now() - d.getTime() < 7 * 24 * 60 * 60 * 1000;
      }).length,
    });
  }, [pages]);

  async function createBlankPage() {
    setCreating(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const { data: ws } = await supabase.from('workspaces').select('id').eq('user_id', u.id).maybeSingle();
    if (!ws) return;

    const { data: page } = await supabase.from('pages').insert({
      workspace_id: ws.id, user_id: u.id, name: 'Untitled',
      icon: ICONS[Math.floor(Math.random() * ICONS.length)], order_index: pages.length,
    }).select().single();

    if (page) { setPages([...pages, page]); router.push(`/page/${page.id}`); }
    setCreating(false);
  }

  async function createCollegePage() {
    setCreating(true);
    const { data: { user: u } } = await supabase.auth.getUser();
    if (!u) return;
    const { data: ws } = await supabase.from('workspaces').select('id').eq('user_id', u.id).maybeSingle();
    if (!ws) return;

    const { data: page } = await supabase.from('pages').insert({
      workspace_id: ws.id, user_id: u.id, name: 'My College Shortlist',
      icon: '🎓', order_index: pages.length,
    }).select().single();

    if (!page) { setCreating(false); return; }

    const columnInserts = COLLEGE_COLUMNS.map((col, i) => ({
      page_id: page.id, user_id: u.id, name: col.name, type: col.type,
      options: col.options ?? [], order_index: i, width: col.width ?? 200,
    }));
    const { data: createdCols } = await supabase.from('columns').insert(columnInserts).select();

    if (createdCols) {
      const colMap: Record<string, string> = {};
      createdCols.forEach((c: { name: string; id: string }) => {
        colMap[c.name] = c.id;
      });
      const rowInserts = SAMPLE_COLLEGES.map((college, i) => {
        const data: Record<string, unknown> = {};
        Object.entries(college).forEach(([key, val]) => { if (colMap[key]) data[colMap[key]] = val; });
        return { page_id: page.id, user_id: u.id, data, order_index: i };
      });
      await supabase.from('rows').insert(rowInserts);
    }

    setPages([...pages, page]);
    router.push(`/page/${page.id}`);
    setCreating(false);
  }

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 px-8 py-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
          {greeting}, {name}! 👋
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-lg">
          Your college research workspace is ready.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10"
      >
        <StatCard icon={<FileText className="w-5 h-5" />} label="Total Pages" value={stats.total} color="blue" />
        <StatCard icon={<Star className="w-5 h-5" />} label="Favorites" value={stats.favorites} color="amber" />
        <StatCard icon={<Clock className="w-5 h-5" />} label="Updated This Week" value={stats.recent} color="green" />
      </motion.div>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-10"
      >
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Start</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={createCollegePage}
            disabled={creating}
            className="group flex items-start gap-4 p-5 bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-800 dark:to-slate-700 text-white rounded-2xl hover:from-slate-800 hover:to-slate-600 transition shadow-lg"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-base">College Shortlist</p>
              <p className="text-white/70 text-sm mt-0.5">Pre-filled template with IIT/NIT/BITS data and all relevant columns</p>
            </div>
            <ArrowRight className="w-4 h-4 ml-auto mt-1 opacity-0 group-hover:opacity-100 transition" />
          </button>

          <button
            onClick={createBlankPage}
            disabled={creating}
            className="group flex items-start gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-400 dark:hover:border-slate-600 transition"
          >
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
              <Plus className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-base text-slate-900 dark:text-white">Blank Page</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Start fresh with an empty table — add your own columns</p>
            </div>
            <ArrowRight className="w-4 h-4 ml-auto mt-1 text-slate-400 opacity-0 group-hover:opacity-100 transition" />
          </button>
        </div>
      </motion.div>

      {/* Recent pages */}
      {recentPages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Recent Pages</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentPages.map((page, i) => (
              <motion.button
                key={page.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                onClick={() => router.push(`/page/${page.id}`)}
                className="group flex items-start gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-md transition text-left"
              >
                <span className="text-2xl flex-shrink-0">{page.icon || '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white truncate">{page.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(page.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                {page.is_favorite && <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {pages.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-20"
        >
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-medium text-lg">No pages yet</p>
          <p className="text-slate-400 text-sm mt-1">Create your first page to get started</p>
        </motion.div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400',
    amber: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
    green: 'bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400',
  }[color] ?? '';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors}`}>
        {icon}
      </div>
      <p className="text-3xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{label}</p>
    </div>
  );
}
