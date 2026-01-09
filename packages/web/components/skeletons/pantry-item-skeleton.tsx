'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PantryItemSkeletonProps {
  className?: string;
}

/**
 * Skeleton loader for individual pantry items
 */
export function PantryItemSkeleton({ className }: PantryItemSkeletonProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        className
      )}
    >
      {/* Icon placeholder */}
      <Skeleton className="h-8 w-8 rounded-full" />

      {/* Item info */}
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      {/* Actions */}
      <Skeleton className="h-8 w-8 rounded" />
    </div>
  );
}

interface PantryCategorySkeletonProps {
  itemCount?: number;
  className?: string;
}

/**
 * Skeleton loader for a category group of pantry items
 */
export function PantryCategorySkeleton({
  itemCount = 3,
  className,
}: PantryCategorySkeletonProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Category header */}
      <Skeleton className="h-4 w-24" />

      {/* Items */}
      <div className="space-y-2">
        {Array.from({ length: itemCount }).map((_, i) => (
          <PantryItemSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

interface PantryListSkeletonProps {
  categoryCount?: number;
  className?: string;
}

/**
 * Skeleton loader for the entire pantry list
 */
export function PantryListSkeleton({
  categoryCount = 4,
  className,
}: PantryListSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: categoryCount }).map((_, i) => (
        <PantryCategorySkeleton key={i} itemCount={2 + (i % 3)} />
      ))}
    </div>
  );
}
