'use client';

import { Search, Plus } from 'lucide-react';
import type { LibraryToolbarProps, ScopeFilter } from '@/types/address-selector';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const SCOPES: { value: ScopeFilter; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'all', label: 'All' },
  { value: 'mine', label: 'Mine' },
];

export function LibraryToolbar({
  searchQuery,
  onSearchChange,
  activeScope,
  onScopeChange,
  onCreateNew,
}: LibraryToolbarProps) {
  return (
    <div className="space-y-2.5">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search saved addresses"
          aria-label="Search saved addresses"
          className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-200"
        />
      </div>

      {/* Scope chips + New address button */}
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Address scope filter"
          className="flex gap-1.5 overflow-x-auto scrollbar-none"
        >
          {SCOPES.map((scope) => (
            <button
              key={scope.value}
              type="button"
              role="tab"
              aria-selected={activeScope === scope.value}
              onClick={() => onScopeChange(scope.value)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                activeScope === scope.value
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              )}
            >
              {scope.label}
            </button>
          ))}
        </div>

        {/* Desktop: inline button */}
        <Button
          type="button"
          size="sm"
          onClick={onCreateNew}
          className="hidden sm:flex h-8 shrink-0 gap-1.5 bg-brand-400 px-3 text-xs font-semibold text-neutral-900 hover:bg-brand-500 active:bg-brand-600"
        >
          <Plus className="h-3.5 w-3.5" />
          New address
        </Button>
      </div>

      {/* Mobile: sticky full-width button */}
      <div className="sm:hidden">
        <Button
          type="button"
          size="sm"
          onClick={onCreateNew}
          className="h-9 w-full gap-1.5 bg-brand-400 text-xs font-semibold text-neutral-900 hover:bg-brand-500 active:bg-brand-600"
        >
          <Plus className="h-3.5 w-3.5" />
          New address
        </Button>
      </div>
    </div>
  );
}
