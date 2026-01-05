'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MealSlotSkeletonProps {
  className?: string;
}

/**
 * Skeleton loader for individual meal slots in the calendar
 */
export function MealSlotSkeleton({ className }: MealSlotSkeletonProps) {
  return (
    <div
      className={cn(
        'min-h-[80px] rounded-md border border-dashed bg-muted/20 p-2',
        className
      )}
    >
      <Skeleton className="h-full w-full min-h-[60px] rounded-md" />
    </div>
  );
}

interface CalendarGridSkeletonProps {
  mealTypesCount?: number;
  className?: string;
}

/**
 * Skeleton loader for the calendar week grid (desktop view)
 */
export function CalendarGridSkeleton({
  mealTypesCount = 2,
  className,
}: CalendarGridSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Day Headers */}
      <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-2">
        <div /> {/* Empty cell for meal type column */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="text-center py-2">
            <Skeleton className="h-5 w-12 mx-auto mb-1" />
            <Skeleton className="h-4 w-8 mx-auto" />
          </div>
        ))}
      </div>

      {/* Meal Rows */}
      {Array.from({ length: mealTypesCount }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1"
        >
          {/* Meal Type Label */}
          <div className="flex items-center justify-end pr-2">
            <Skeleton className="h-4 w-14" />
          </div>

          {/* Meal Slots */}
          {Array.from({ length: 7 }).map((_, slotIndex) => (
            <MealSlotSkeleton key={slotIndex} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton loader for the calendar mobile view
 */
export function CalendarMobileSkeletonProps({
  mealTypesCount = 2,
  className,
}: CalendarGridSkeletonProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: 7 }).map((_, dayIndex) => (
        <div key={dayIndex} className="rounded-lg border p-3">
          {/* Day Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-8" />
            </div>
          </div>

          {/* Meals for the day */}
          <div className="space-y-2">
            {Array.from({ length: mealTypesCount }).map((_, mealIndex) => (
              <div key={mealIndex} className="flex items-start gap-3">
                <Skeleton className="w-16 h-5 mt-2" />
                <div className="flex-1">
                  <MealSlotSkeleton />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
