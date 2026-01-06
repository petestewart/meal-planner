'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Heart, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SortOption = 'name' | 'date' | 'prepTime';

export interface FilterState {
  search: string;
  cuisine: string;
  favorites: boolean;
  sort: SortOption;
}

interface RecipeFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  cuisines?: string[];
  className?: string;
}

/**
 * Recipe filter controls with search, cuisine filter, favorites toggle, and sort
 */
export function RecipeFilters({
  filters,
  onFiltersChange,
  cuisines = [],
  className,
}: RecipeFiltersProps) {
  // Local search state for debouncing
  const [searchInput, setSearchInput] = useState(filters.search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput });
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput, filters, onFiltersChange]);

  // Sync local state when external filters change
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  const handleCuisineChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ ...filters, cuisine: e.target.value });
    },
    [filters, onFiltersChange]
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({ ...filters, sort: e.target.value as SortOption });
    },
    [filters, onFiltersChange]
  );

  const handleFavoritesToggle = useCallback(() => {
    onFiltersChange({ ...filters, favorites: !filters.favorites });
  }, [filters, onFiltersChange]);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          type="text"
          placeholder="Search recipes..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
          aria-label="Search recipes"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Cuisine filter */}
        <div className="relative">
          <select
            value={filters.cuisine}
            onChange={handleCuisineChange}
            aria-label="Filter by cuisine"
            className={cn(
              'h-11 appearance-none rounded-sm border-[1.5px] border-input bg-background px-3 pr-8 text-sm',
              'transition-all duration-200 ease-out',
              'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
              'hover:border-primary/50',
              'cursor-pointer'
            )}
          >
            <option value="">All Cuisines</option>
            {cuisines.map((cuisine) => (
              <option key={cuisine} value={cuisine}>
                {cuisine.charAt(0).toUpperCase() + cuisine.slice(1)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>

        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={filters.sort}
            onChange={handleSortChange}
            aria-label="Sort recipes"
            className={cn(
              'h-11 appearance-none rounded-sm border-[1.5px] border-input bg-background px-3 pr-8 text-sm',
              'transition-all duration-200 ease-out',
              'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
              'hover:border-primary/50',
              'cursor-pointer'
            )}
          >
            <option value="name">Sort: Name</option>
            <option value="date">Sort: Date Added</option>
            <option value="prepTime">Sort: Prep Time</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        </div>

        {/* Favorites toggle - uses default size for 44px touch target */}
        <Button
          variant={filters.favorites ? 'default' : 'outline'}
          onClick={handleFavoritesToggle}
          className="gap-1.5"
          aria-pressed={filters.favorites}
        >
          <Heart
            className={cn(
              'h-4 w-4',
              filters.favorites && 'fill-current'
            )}
            aria-hidden="true"
          />
          Favorites
        </Button>
      </div>
    </div>
  );
}

export const defaultFilters: FilterState = {
  search: '',
  cuisine: '',
  favorites: false,
  sort: 'name',
};
