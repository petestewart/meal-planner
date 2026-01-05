'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface RecipeCardSkeletonProps {
  className?: string;
}

/**
 * Skeleton loader for recipe cards in the recipe grid
 */
export function RecipeCardSkeleton({ className }: RecipeCardSkeletonProps) {
  return (
    <div className={cn('rounded-xl border bg-card shadow', className)}>
      {/* Image placeholder */}
      <Skeleton className="aspect-[4/3] w-full rounded-t-xl rounded-b-none" />

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />

        {/* Meta info (time, cuisine) */}
        <div className="flex gap-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

interface RecipeGridSkeletonProps {
  count?: number;
  className?: string;
}

/**
 * Skeleton loader for the entire recipe grid
 */
export function RecipeGridSkeleton({ count = 8, className }: RecipeGridSkeletonProps) {
  return (
    <div
      className={cn(
        'grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <RecipeCardSkeleton key={i} />
      ))}
    </div>
  );
}
