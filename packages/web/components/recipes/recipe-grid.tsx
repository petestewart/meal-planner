'use client';

import Link from 'next/link';
import { BookOpen, Plus, Download, Loader2 } from 'lucide-react';
import { RecipeWithRelations } from '@/types/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RecipeCard } from './recipe-card';

interface RecipeGridProps {
  recipes: RecipeWithRelations[];
  isLoading?: boolean;
  className?: string;
}

/**
 * Recipe grid layout with loading skeletons and empty state
 */
export function RecipeGrid({ recipes, isLoading, className }: RecipeGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <div
        className={cn(
          'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
          className
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <RecipeCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (recipes.length === 0) {
    return <RecipeEmptyState className={className} />;
  }

  // Grid of recipe cards
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}
    >
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}

/**
 * Loading skeleton for recipe card
 */
function RecipeCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card shadow animate-pulse">
      {/* Image placeholder */}
      <div className="aspect-[4/3] w-full rounded-t-xl bg-muted" />

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="h-5 w-3/4 rounded bg-muted" />

        {/* Meta */}
        <div className="flex gap-3">
          <div className="h-4 w-12 rounded bg-muted" />
          <div className="h-4 w-16 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}

/**
 * Empty state when no recipes exist
 */
function RecipeEmptyState({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-12 text-center',
        className
      )}
    >
      <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold">No recipes yet</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        Start building your collection by adding recipes manually or importing from the web.
      </p>
      <div className="mt-6 flex flex-wrap gap-3 justify-center">
        <Button asChild>
          <Link href="/recipes/new">
            <Plus className="h-4 w-4" />
            Add Recipe
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/recipes/import">
            <Download className="h-4 w-4" />
            Import from URL
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Pagination component for recipe list
 */
interface RecipePaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function RecipePagination({
  page,
  totalPages,
  onPageChange,
  isLoading,
}: RecipePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || isLoading}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground px-2">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || isLoading}
      >
        Next
      </Button>
    </div>
  );
}

/**
 * Loading indicator for recipe operations
 */
export function RecipeLoadingIndicator() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}
