'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Download, X } from 'lucide-react';
import { useRecipes } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import {
  RecipeFilters,
  RecipeGrid,
  RecipePagination,
  defaultFilters,
  type FilterState,
  type SortOption,
} from '@/components/recipes';
import type { ListRecipesOptions, RecipeWithRelations } from '@/types/api';

// Common cuisines for the filter dropdown
const CUISINES = [
  'american',
  'chinese',
  'french',
  'greek',
  'indian',
  'italian',
  'japanese',
  'korean',
  'mediterranean',
  'mexican',
  'spanish',
  'thai',
  'vietnamese',
];

export default function RecipesPage() {
  // Filter state
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);
  const limit = 12;

  // Build API query options from filter state
  const queryOptions: ListRecipesOptions = useMemo(() => {
    const options: ListRecipesOptions = {
      page,
      limit,
    };

    if (filters.search) {
      options.q = filters.search;
    }

    if (filters.cuisine) {
      options.cuisine = filters.cuisine;
    }

    if (filters.favorites) {
      options.favorites = true;
    }

    return options;
  }, [filters, page, limit]);

  // Fetch recipes
  const { data, isLoading, error } = useRecipes(queryOptions);

  // Sort recipes client-side (API may not support all sort options)
  const sortedRecipes = useMemo(() => {
    if (!data?.recipes) return [];

    const recipes = [...data.recipes];

    switch (filters.sort) {
      case 'name':
        return recipes.sort((a, b) => a.title.localeCompare(b.title));
      case 'date':
        return recipes.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case 'prepTime':
        return recipes.sort((a, b) => {
          const timeA = (a.prepTimeMinutes || 0) + (a.cookTimeMinutes || 0);
          const timeB = (b.prepTimeMinutes || 0) + (b.cookTimeMinutes || 0);
          return timeA - timeB;
        });
      default:
        return recipes;
    }
  }, [data?.recipes, filters.sort]);

  // Handle filter changes - reset to page 1
  const handleFiltersChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    // Scroll to top of recipes section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Count of active filters for badge
  const activeFilterCount = [
    filters.search,
    filters.cuisine,
    filters.favorites,
  ].filter(Boolean).length;

  // Recipe count text
  const recipeCountText = useMemo(() => {
    if (isLoading) return '';
    const total = data?.pagination?.total ?? sortedRecipes.length;
    if (total === 0) return 'No recipes found';
    if (total === 1) return '1 recipe';
    return `${total} recipes`;
  }, [isLoading, data?.pagination?.total, sortedRecipes.length]);

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Recipes</h1>
          <p className="mt-1 text-muted-foreground">
            Browse and manage your recipe collection.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/recipes/new">
              <Plus className="h-4 w-4" />
              Add Recipe
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/recipes/import">
              <Download className="h-4 w-4" />
              Import
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <RecipeFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        cuisines={CUISINES}
        className="mb-4"
      />

      {/* Recipe count and active filters summary */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Recipe count */}
        {recipeCountText && (
          <span className="text-sm text-muted-foreground font-medium">
            {recipeCountText}
          </span>
        )}

        {/* Active filter chips */}
        {activeFilterCount > 0 && (
          <>
            <span className="text-muted-foreground/50">|</span>
            <div className="flex flex-wrap items-center gap-2">
              {filters.search && (
                <FilterChip
                  label={`"${filters.search}"`}
                  onRemove={() =>
                    handleFiltersChange({ ...filters, search: '' })
                  }
                />
              )}
              {filters.cuisine && (
                <FilterChip
                  label={
                    filters.cuisine.charAt(0).toUpperCase() +
                    filters.cuisine.slice(1)
                  }
                  onRemove={() =>
                    handleFiltersChange({ ...filters, cuisine: '' })
                  }
                />
              )}
              {filters.favorites && (
                <FilterChip
                  label="Favorites"
                  onRemove={() =>
                    handleFiltersChange({ ...filters, favorites: false })
                  }
                />
              )}
              {activeFilterCount > 1 && (
                <button
                  onClick={() => handleFiltersChange(defaultFilters)}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive mb-6">
          Failed to load recipes. Please try again.
        </div>
      )}

      {/* Recipe grid */}
      <RecipeGrid recipes={sortedRecipes} isLoading={isLoading} />

      {/* Pagination */}
      {data?.pagination && (
        <RecipePagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

/**
 * Filter chip component for displaying active filters
 */
interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full p-1.5 min-h-[44px] min-w-[44px] -my-1 -mr-1.5 flex items-center justify-center hover:bg-primary/20 transition-colors touch-manipulation"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-4 w-4" />
      </button>
    </span>
  );
}
