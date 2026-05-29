'use client';

import { motion } from 'framer-motion';
import { ArrowDown, ArrowRight, SplitSquareHorizontal } from 'lucide-react';

interface CellContextMenuProps {
  x: number;
  y: number;
  onMergeDown: () => void;
  onMergeRight: () => void;
  onSplit: () => void;
  canMergeDown: boolean;
  canMergeRight: boolean;
  canSplit: boolean;
}

export function CellContextMenu({
  x,
  y,
  onMergeDown,
  onMergeRight,
  onSplit,
  canMergeDown,
  canMergeRight,
  canSplit,
}: CellContextMenuProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{ top: y, left: x }}
      className="fixed z-[60] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 min-w-[200px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-xs text-slate-400 uppercase tracking-wide font-medium">Cell layout</div>
      <button
        disabled={!canMergeDown}
        onClick={onMergeDown}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
      >
        <ArrowDown className="w-3.5 h-3.5" /> Merge down (rowspan)
      </button>
      <button
        disabled={!canMergeRight}
        onClick={onMergeRight}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
      >
        <ArrowRight className="w-3.5 h-3.5" /> Merge right (colspan)
      </button>
      <button
        disabled={!canSplit}
        onClick={onSplit}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
      >
        <SplitSquareHorizontal className="w-3.5 h-3.5" /> Split cell
      </button>
    </motion.div>
  );
}
