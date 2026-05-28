'use client';

import { create } from 'zustand';
import type { User, Workspace, Page, Column, Row } from './supabase';

interface AppState {
  user: User | null;
  workspace: Workspace | null;
  pages: Page[];
  currentPage: Page | null;
  columns: Column[];
  rows: Row[];
  selectedRows: string[];
  searchQuery: string;
  sidebarOpen: boolean;
  theme: 'light' | 'dark';

  setUser: (user: User | null) => void;
  setWorkspace: (workspace: Workspace | null) => void;
  setPages: (pages: Page[]) => void;
  setCurrentPage: (page: Page | null) => void;
  setColumns: (columns: Column[]) => void;
  setRows: (rows: Row[]) => void;
  addRow: (row: Row) => void;
  updateRow: (id: string, data: Partial<Row>) => void;
  deleteRow: (id: string) => void;
  addColumn: (column: Column) => void;
  updateColumn: (id: string, data: Partial<Column>) => void;
  deleteColumn: (id: string) => void;
  toggleRowSelection: (id: string) => void;
  clearSelection: () => void;
  setSelectedRows: (ids: string[]) => void;
  setSearchQuery: (q: string) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  workspace: null,
  pages: [],
  currentPage: null,
  columns: [],
  rows: [],
  selectedRows: [],
  searchQuery: '',
  sidebarOpen: true,
  theme: 'light',

  setUser: (user) => set({ user }),
  setWorkspace: (workspace) => set({ workspace }),
  setPages: (pages) => set({ pages }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setColumns: (columns) => set({ columns }),
  setRows: (rows) => set({ rows }),
  addRow: (row) => set((s) => ({ rows: [...s.rows, row] })),
  updateRow: (id, data) =>
    set((s) => ({ rows: s.rows.map((r) => (r.id === id ? { ...r, ...data } : r)) })),
  deleteRow: (id) => set((s) => ({ rows: s.rows.filter((r) => r.id !== id) })),
  addColumn: (column) => set((s) => ({ columns: [...s.columns, column] })),
  updateColumn: (id, data) =>
    set((s) => ({ columns: s.columns.map((c) => (c.id === id ? { ...c, ...data } : c)) })),
  deleteColumn: (id) => set((s) => ({ columns: s.columns.filter((c) => c.id !== id) })),
  toggleRowSelection: (id) =>
    set((s) => ({
      selectedRows: s.selectedRows.includes(id)
        ? s.selectedRows.filter((r) => r !== id)
        : [...s.selectedRows, id],
    })),
  clearSelection: () => set({ selectedRows: [] }),
  setSelectedRows: (ids) => set({ selectedRows: ids }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),
}));
