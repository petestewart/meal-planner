'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Download } from 'lucide-react';
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
        className="mb-6"
      />

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
