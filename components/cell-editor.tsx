'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Star, ExternalLink, Check } from 'lucide-react';
import { STATUS_COLORS } from '@/lib/college-template';
import type { Column } from '@/lib/supabase';

interface CellEditorProps {
  column: Column;
  value: unknown;
  onChange: (val: unknown) => void;
  onBlur: () => void;
  editing: boolean;
  onStartEdit: () => void;
}

export function CellEditor({ column, value, onChange, onBlur, editing, onStartEdit }: CellEditorProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' || e.key === 'Enter') onBlur();
  }

  if (column.type === 'checkbox') {
    return (
      <div
        className="flex items-center justify-center h-full cursor-pointer"
        onClick={() => onChange(!value)}
      >
        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${
          value ? 'bg-slate-900 dark:bg-white border-slate-900 dark:border-white' : 'border-slate-300 dark:border-slate-600'
        }`}>
          {!!value && <Check className="w-2.5 h-2.5 text-white dark:text-slate-900" />}
        </div>
      </div>
    );
  }

  if (column.type === 'rating') {
    const num = Number(value) || 0;
    return (
      <div className="flex items-center gap-0.5 px-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onChange(star === num ? 0 : star)}
            className={`text-lg transition ${star <= num ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700 hover:text-amber-300'}`}
          >
            ★
          </button>
        ))}
      </div>
    );
  }

  if (column.type === 'dropdown') {
    if (editing) {
      return (
        <select
          autoFocus
          value={String(value ?? '')}
          onChange={(e) => { onChange(e.target.value); onBlur(); }}
          onBlur={onBlur}
          className="w-full h-full px-2 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white border border-blue-400 rounded focus:outline-none"
        >
          <option value="">-- None --</option>
          {(column.options as string[]).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    const statusClass = STATUS_COLORS[String(value)] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    return (
      <div className="px-2 flex items-center h-full" onClick={onStartEdit}>
        {value ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
            {String(value)}
          </span>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
        )}
      </div>
    );
  }

  if (column.type === 'tags') {
    const tags = Array.isArray(value) ? (value as string[]) : [];
    if (editing) {
      return (
        <TagsEditor
          tags={tags}
          options={column.options as string[]}
          onChange={onChange}
          onBlur={onBlur}
        />
      );
    }
    return (
      <div className="px-2 flex items-center gap-1 flex-wrap h-full overflow-hidden" onClick={onStartEdit}>
        {tags.length > 0 ? tags.map((t) => (
          <span key={t} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-xs">
            {t}
          </span>
        )) : <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>}
      </div>
    );
  }

  if (column.type === 'url') {
    if (editing) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="url"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full px-2 text-sm bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-400 rounded focus:outline-none"
          placeholder="https://..."
        />
      );
    }
    return (
      <div className="px-2 flex items-center gap-1.5 h-full group" onClick={onStartEdit}>
        {value ? (
          <>
            <span className="text-blue-600 dark:text-blue-400 text-sm truncate">{String(value)}</span>
            <a
              href={String(value)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition"
            >
              <ExternalLink className="w-3 h-3 text-blue-500" />
            </a>
          </>
        ) : (
          <span className="text-slate-300 dark:text-slate-600 text-sm">—</span>
        )}
      </div>
    );
  }

  if (column.type === 'number') {
    if (editing) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          onBlur={onBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full px-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-blue-400 rounded focus:outline-none text-right"
        />
      );
    }
    return (
      <div className="px-2 flex items-center justify-end h-full" onClick={onStartEdit}>
        <span className={`text-sm ${value !== null && value !== undefined ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
          {value !== null && value !== undefined ? String(value) : '—'}
        </span>
      </div>
    );
  }

  if (column.type === 'date') {
    if (editing) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="w-full h-full px-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-blue-400 rounded focus:outline-none"
        />
      );
    }
    return (
      <div className="px-2 flex items-center h-full" onClick={onStartEdit}>
        <span className={`text-sm ${value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
          {value ? new Date(String(value)).toLocaleDateString('en-IN') : '—'}
        </span>
      </div>
    );
  }

  // Text (default)
  if (editing) {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        className="w-full h-full px-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-blue-400 rounded focus:outline-none"
      />
    );
  }

  return (
    <div className="px-2 flex items-center h-full" onClick={onStartEdit}>
      <span className={`text-sm truncate ${value ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'}`}>
        {value ? String(value) : '—'}
      </span>
    </div>
  );
}

function TagsEditor({
  tags, options, onChange, onBlur,
}: { tags: string[]; options: string[]; onChange: (v: unknown) => void; onBlur: () => void }) {
  const [open, setOpen] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onBlur();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onBlur]);

  function toggle(opt: string) {
    onChange(tags.includes(opt) ? tags.filter((t) => t !== opt) : [...tags, opt]);
  }

  return (
    <div ref={ref} className="relative w-full h-full">
      <div className="flex flex-wrap gap-1 px-2 py-1 items-center h-full">
        {tags.map((t) => (
          <span key={t} className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs text-slate-700 dark:text-slate-200">
            {t}
          </span>
        ))}
      </div>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 min-w-[160px] max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => toggle(opt)}
              className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition ${
                tags.includes(opt)
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${tags.includes(opt) ? 'bg-slate-900 dark:bg-white border-transparent' : 'border-slate-300'}`}>
                {tags.includes(opt) && <Check className="w-2.5 h-2.5 text-white dark:text-slate-900" />}
              </div>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
