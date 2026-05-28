'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Plus, Star, Trash2, Search,
  Home, Moon, Sun, LogOut, ChevronDown, ChevronRight,
  Copy, Settings
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/lib/store';
import type { Page } from '@/lib/supabase';

interface SidebarProps {
  pages: Page[];
  onCreatePage: () => void;
  onDeletePage: (id: string) => void;
  onDuplicatePage: (id: string) => void;
}

export function Sidebar({ pages, onCreatePage, onDeletePage, onDuplicatePage }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { user, searchQuery, setSearchQuery, sidebarOpen } = useAppStore();
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [favoritesExpanded, setFavoritesExpanded] = useState(true);
  const [pagesExpanded, setPagesExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const favorites = pages.filter((p) => p.is_favorite);
  const allPages = pages;

  const filteredPages = searchQuery
    ? allPages.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allPages;

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function handleContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault();
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  if (!sidebarOpen) return null;

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      className="w-64 h-screen bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col flex-shrink-0"
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-white dark:text-slate-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              College Shortlist
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user?.email ?? ''}
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pages..."
            className="flex-1 text-sm bg-transparent text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Nav items */}
      <nav className="px-3 space-y-0.5">
        <button
          onClick={() => router.push('/dashboard')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            pathname === '/dashboard'
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Home className="w-4 h-4" />
          Dashboard
        </button>
        <button
          onClick={() => router.push('/my-profile')}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
            pathname === '/my-profile'
              ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          My Profile
        </button>
      </nav>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div className="mt-4 px-3">
          <button
            onClick={() => setFavoritesExpanded(!favoritesExpanded)}
            className="flex items-center gap-1.5 w-full text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            {favoritesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Favorites
          </button>
          <AnimatePresence>
            {favoritesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-1 space-y-0.5"
              >
                {favorites.map((page) => (
                  <PageItem
                    key={page.id}
                    page={page}
                    isActive={pathname === `/page/${page.id}`}
                    onContextMenu={handleContextMenu}
                    onClick={() => router.push(`/page/${page.id}`)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Pages */}
      <div className="mt-4 px-3 flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-1">
          <button
            onClick={() => setPagesExpanded(!pagesExpanded)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            {pagesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            Pages
          </button>
          <button
            onClick={onCreatePage}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition"
            title="New page"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <AnimatePresence>
          {pagesExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-1 space-y-0.5"
            >
              {filteredPages.length === 0 ? (
                <p className="text-xs text-slate-400 px-3 py-2">No pages yet</p>
              ) : (
                filteredPages.map((page) => (
                  <PageItem
                    key={page.id}
                    page={page}
                    isActive={pathname === `/page/${page.id}`}
                    onContextMenu={handleContextMenu}
                    onClick={() => router.push(`/page/${page.id}`)}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 min-w-[160px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { onDuplicatePage(contextMenu.id); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Copy className="w-3.5 h-3.5" /> Duplicate
            </button>
            <button
              onClick={() => { onDeletePage(contextMenu.id); setContextMenu(null); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        )}
      </div>
    </motion.aside>
  );
}

function PageItem({
  page, isActive, onContextMenu, onClick,
}: {
  page: Page;
  isActive: boolean;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => onContextMenu(e, page.id)}
      className={`group w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition ${
        isActive
          ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
      }`}
    >
      <span className="text-base flex-shrink-0">{page.icon || '📋'}</span>
      <span className="flex-1 text-left truncate">{page.name}</span>
      {page.is_favorite && <Star className="w-3 h-3 text-amber-400 flex-shrink-0" />}
    </button>
  );
}
