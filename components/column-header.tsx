'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Type, Hash, Calendar, ChevronDown, CheckSquare, Star as StarIcon,
  Link, Tag, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Trash2,
  EyeOff, GripVertical, MoreHorizontal
} from 'lucide-react';
import type { Column, ColumnType } from '@/lib/supabase';

const TYPE_ICONS: Record<ColumnType, React.ReactNode> = {
  text: <Type className="w-3.5 h-3.5" />,
  number: <Hash className="w-3.5 h-3.5" />,
  date: <Calendar className="w-3.5 h-3.5" />,
  dropdown: <ChevronDown className="w-3.5 h-3.5" />,
  checkbox: <CheckSquare className="w-3.5 h-3.5" />,
  rating: <StarIcon className="w-3.5 h-3.5" />,
  url: <Link className="w-3.5 h-3.5" />,
  tags: <Tag className="w-3.5 h-3.5" />,
};

interface ColumnHeaderProps {
  column: Column;
  sortDir: 'asc' | 'desc' | null;
  onSort: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onHide: () => void;
  onTypeChange: (type: ColumnType) => void;
  onGroupWithNext?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export function ColumnHeader({
  column,
  sortDir,
  onSort,
  onRename,
  onDelete,
  onHide,
  onTypeChange,
  onGroupWithNext,
  draggable,
  onDragStart,
  onDragEnd,
}: ColumnHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameVal, setNameVal] = useState(column.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming && inputRef.current) inputRef.current.focus();
  }, [renaming]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function commitRename() {
    if (nameVal.trim()) onRename(nameVal.trim());
    setRenaming(false);
  }

  return (
    <div className="flex items-center gap-1 w-full group select-none relative" ref={menuRef}>
      {draggable && (
        <span
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            onDragStart?.();
          }}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing text-slate-300 dark:text-slate-600 hover:text-slate-500"
          title="Drag to reorder column"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>
      )}
      <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">
        {TYPE_ICONS[column.type]}
      </span>

      {renaming ? (
        <input
          ref={inputRef}
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
          className="flex-1 bg-transparent text-sm font-medium text-slate-900 dark:text-white focus:outline-none border-b border-blue-400"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-200 truncate cursor-pointer"
          onClick={onSort}
        >
          {column.name}
        </span>
      )}

      {sortDir && (
        <span className="text-slate-400 dark:text-slate-500 flex-shrink-0">
          {sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
        </span>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white opacity-0 group-hover:opacity-100 transition rounded hover:bg-slate-200 dark:hover:bg-slate-700"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 min-w-[180px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-xs text-slate-400 font-medium uppercase tracking-wide">Column type</div>
            {(Object.keys(TYPE_ICONS) as ColumnType[]).map((t) => (
              <button
                key={t}
                onClick={() => { onTypeChange(t); setMenuOpen(false); }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm transition ${
                  column.type === t
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white font-medium'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {TYPE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
            <button
              onClick={() => { setRenaming(true); setMenuOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Pencil className="w-3.5 h-3.5" /> Rename
            </button>
            {onGroupWithNext && (
              <button
                onClick={() => { onGroupWithNext(); setMenuOpen(false); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <GripVertical className="w-3.5 h-3.5" /> Group with next column
              </button>
            )}
            <button
              onClick={() => { onHide(); setMenuOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <EyeOff className="w-3.5 h-3.5" /> Hide column
            </button>
            <button
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete column
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
