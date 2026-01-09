'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface GroceryItemSkeletonProps {
  className?: string;
}

/**
 * Skeleton loader for individual grocery list items
 */
export function GroceryItemSkeleton({ className }: GroceryItemSkeletonProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        className
      )}
    >
      {/* Checkbox */}
      <Skeleton className="h-5 w-5 rounded" />

      {/* Item info */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>

      {/* Quantity */}
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

interface GroceryCategorySkeletonProps {
  itemCount?: number;
  className?: string;
}

/**
 * Skeleton loader for a category group of grocery items
 */
export function GroceryCategorySkeleton({
  itemCount = 4,
  className,
}: GroceryCategorySkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Category header */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-8 rounded-full" />
      </div>

      {/* Items */}
      <div className="space-y-2">
        {Array.from({ length: itemCount }).map((_, i) => (
          <GroceryItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

interface GroceryListSkeletonProps {
  categoryCount?: number;
  className?: string;
}

/**
 * Skeleton loader for the entire grocery list
 */
export function GroceryListSkeleton({
  categoryCount = 3,
  className,
}: GroceryListSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: categoryCount }).map((_, i) => (
        <GroceryCategorySkeleton key={i} itemCount={3 + (i % 2)} />
      ))}
    </div>
  );
}
