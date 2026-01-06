'use client';

import Link from 'next/link';
import { BookOpen, Plus, Download } from 'lucide-react';
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
 * Responsive grid classes for recipe layout:
 * - 1 column on mobile (< 640px)
 * - 2 columns on small tablets (>= 640px)
 * - 3 columns on large tablets (>= 1024px)
 * - 4 columns on desktop (>= 1280px)
 */
const gridClasses =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6';

/**
 * Recipe grid layout with loading skeletons and empty state
 */
export function RecipeGrid({ recipes, isLoading, className }: RecipeGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className={cn(gridClasses, className)}>
        {Array.from({ length: 8 }).map((_, i) => (
          <RecipeCardSkeleton key={i} index={i} />
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
    <div className={cn(gridClasses, className)}>
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  );
}

interface RecipeCardSkeletonProps {
  index?: number;
}

/**
 * Loading skeleton for recipe card with shimmer animation
 * Uses staggered animation delay for visual interest
 */
function RecipeCardSkeleton({ index = 0 }: RecipeCardSkeletonProps) {
  // Stagger animation delay based on index (0-400ms)
  const animationDelay = `${(index % 4) * 100}ms`;

  return (
    <div
      className="rounded-xl border bg-card shadow-sm overflow-hidden"
      style={{ animationDelay }}
    >
      {/* Image placeholder - 3:4 aspect ratio to match recipe cards */}
      <div
        className="aspect-[3/4] w-full animate-shimmer"
        style={{ animationDelay }}
      />

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <div
          className="h-5 w-3/4 rounded animate-shimmer"
          style={{ animationDelay }}
        />

        {/* Meta row */}
        <div className="flex gap-3">
          <div
            className="h-4 w-14 rounded animate-shimmer"
            style={{ animationDelay }}
          />
          <div
            className="h-4 w-16 rounded animate-shimmer"
            style={{ animationDelay }}
          />
        </div>

        {/* Tags row */}
        <div className="flex gap-2 pt-1">
          <div
            className="h-6 w-16 rounded-full animate-shimmer"
            style={{ animationDelay }}
          />
          <div
            className="h-6 w-20 rounded-full animate-shimmer"
            style={{ animationDelay }}
          />
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
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 py-12 px-6 text-center',
        className
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
        <BookOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-h3 font-display">No recipes yet</h3>
      <p className="mt-2 text-body-sm text-muted-foreground max-w-sm">
        Your recipe collection is waiting to be filled! Add your favorite dishes manually or import them from your favorite cooking websites.
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
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
