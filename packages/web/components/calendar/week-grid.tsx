'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePlan, usePreferences, useSetMeal, queryKeys } from '@/lib/queries';
import { useRecipes } from '@/lib/queries';
import { useQueryClient } from '@tanstack/react-query';
import { MealSlot } from './meal-slot';
import type { DropData } from './meal-slot';
import { RecipeCard, type DragData } from './recipe-card';
import {
  getCurrentWeek,
  getWeekDates,
  formatWeekDisplay,
  getPreviousWeek,
  getNextWeek,
  isCurrentWeek,
  getDayName,
  formatDayNumber,
  isToday,
  getDayOfWeek,
} from '@/lib/week-utils';
import { MealType, DayOfWeek, PlanItem, RecipeWithRelations, WeeklyPlanWithItems } from '@/types/api';
import { cn } from '@/lib/utils';
import { CalendarGridSkeleton, CalendarMobileSkeletonProps } from '@/components/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineError } from '@/components/ui/error-boundary';

interface WeekGridProps {
  initialWeek?: string;
  onWeekChange?: (week: string) => void;
  onSlotClick?: (day: DayOfWeek, mealType: MealType, planItem?: PlanItem) => void;
  onAddMeal?: (day: DayOfWeek, mealType: MealType) => void;
}

// Default meal types if preferences aren't loaded
const DEFAULT_MEAL_TYPES: MealType[] = ['lunch', 'dinner'];

/**
 * Main calendar component displaying a 7-day meal grid
 */
export function WeekGrid({
  initialWeek,
  onWeekChange,
  onSlotClick,
  onAddMeal,
}: WeekGridProps) {
  const [currentWeek, setCurrentWeek] = useState(initialWeek || getCurrentWeek());
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const queryClient = useQueryClient();

  // Configure sensors for both pointer (mouse) and touch input
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      // Require a small movement before starting drag
      // This allows clicks to work normally
      distance: 8,
    },
  });

  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      // Delay before touch drag starts (allows scrolling)
      delay: 200,
      tolerance: 5,
    },
  });

  const sensors = useSensors(pointerSensor, touchSensor);

  // Fetch plan data
  const {
    data: plan,
    isLoading: isPlanLoading,
    error: planError,
  } = usePlan(currentWeek);

  // Mutation for updating meal assignments
  const setMealMutation = useSetMeal();

  // Fetch user preferences to get meal types
  const { data: preferences } = usePreferences();

  // Get meal types from preferences or use defaults
  const mealTypes = useMemo(() => {
    if (preferences?.mealTypes && preferences.mealTypes.length > 0) {
      return preferences.mealTypes as MealType[];
    }
    return DEFAULT_MEAL_TYPES;
  }, [preferences]);

  // Get all unique recipe IDs from the plan
  const recipeIds = useMemo(() => {
    if (!plan?.items) return [];
    return [...new Set(plan.items.filter(item => item.recipeId).map(item => item.recipeId!))] as string[];
  }, [plan?.items]);

  // Fetch recipes for the plan items
  const { data: recipesData } = useRecipes(
    { limit: 100 },
    { enabled: recipeIds.length > 0 }
  );

  // Create a map of recipe ID to recipe
  const recipeMap = useMemo(() => {
    const map = new Map<string, RecipeWithRelations>();
    if (recipesData?.recipes) {
      for (const recipe of recipesData.recipes) {
        map.set(recipe.id, recipe);
      }
    }
    return map;
  }, [recipesData?.recipes]);

  // Get week dates
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  // Set selected day to today if it's in the current week, otherwise reset to 0
  useEffect(() => {
    const todayIndex = weekDates.findIndex((date) => isToday(date));
    setSelectedDayIndex(todayIndex >= 0 ? todayIndex : 0);
  }, [weekDates]);

  // Create a map of plan items by day and meal type
  const planItemMap = useMemo(() => {
    const map = new Map<string, PlanItem>();
    if (plan?.items) {
      for (const item of plan.items) {
        const key = `${item.dayOfWeek}-${item.mealType}`;
        map.set(key, item);
      }
    }
    return map;
  }, [plan?.items]);

  // Drag event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'recipe') {
      setActiveDragData(active.data.current as DragData);
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      // Clear the drag overlay
      setActiveDragData(null);

      // If no drop target, cancel the operation
      if (!over) {
        return;
      }

      const dragData = active.data.current as DragData;
      const dropData = over.data.current as DropData;

      // Validate we have proper data
      if (dragData?.type !== 'recipe' || dropData?.type !== 'meal-slot') {
        return;
      }

      const { recipeId, sourceDay, sourceMealType } = dragData;
      const { day: targetDay, mealType: targetMealType } = dropData;

      // If dropping on the same slot, do nothing
      if (sourceDay === targetDay && sourceMealType === targetMealType) {
        return;
      }

      // Optimistic update: modify the cache immediately
      const previousPlan = queryClient.getQueryData<WeeklyPlanWithItems>(
        queryKeys.plans.detail(currentWeek)
      );

      if (previousPlan?.items) {
        // Create optimistic update
        const updatedItems = previousPlan.items.map((item) => {
          // Clear the source slot
          if (item.dayOfWeek === sourceDay && item.mealType === sourceMealType) {
            return { ...item, recipeId: null };
          }
          // Set the target slot
          if (item.dayOfWeek === targetDay && item.mealType === targetMealType) {
            return { ...item, recipeId };
          }
          return item;
        });

        // Check if target slot exists, if not add it
        const targetExists = updatedItems.some(
          (item) => item.dayOfWeek === targetDay && item.mealType === targetMealType
        );
        if (!targetExists) {
          updatedItems.push({
            id: `temp-${Date.now()}`,
            planId: previousPlan.id,
            recipeId,
            dayOfWeek: targetDay,
            mealType: targetMealType,
            servings: 2,
            notes: null,
            slotType: 'recipe',
            wasMade: false,
          });
        }

        queryClient.setQueryData<WeeklyPlanWithItems>(
          queryKeys.plans.detail(currentWeek),
          { ...previousPlan, items: updatedItems }
        );
      }

      try {
        // Clear the source slot
        await setMealMutation.mutateAsync({
          week: currentWeek,
          day: sourceDay,
          mealType: sourceMealType,
          input: { recipeId: null },
        });

        // Set the target slot
        await setMealMutation.mutateAsync({
          week: currentWeek,
          day: targetDay,
          mealType: targetMealType,
          input: { recipeId },
        });

        // Success - meal moved
        console.log(`Meal moved to ${targetMealType}`);
      } catch (error) {
        // Rollback on error
        if (previousPlan) {
          queryClient.setQueryData<WeeklyPlanWithItems>(
            queryKeys.plans.detail(currentWeek),
            previousPlan
          );
        }

        console.error('Failed to move meal:', error);
      }
    },
    [currentWeek, queryClient, setMealMutation]
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragData(null);
  }, []);

  // Navigation handlers
  const handlePreviousWeek = () => {
    const prevWeek = getPreviousWeek(currentWeek);
    setCurrentWeek(prevWeek);
    onWeekChange?.(prevWeek);
  };

  const handleNextWeek = () => {
    const nextWeek = getNextWeek(currentWeek);
    setCurrentWeek(nextWeek);
    onWeekChange?.(nextWeek);
  };

  const handleTodayClick = () => {
    const today = getCurrentWeek();
    setCurrentWeek(today);
    onWeekChange?.(today);
  };

  // Helper to get plan item for a specific slot
  const getPlanItem = (day: DayOfWeek, mealType: MealType): PlanItem | undefined => {
    return planItemMap.get(`${day}-${mealType}`);
  };

  // Helper to get recipe for a plan item
  const getRecipe = (planItem?: PlanItem): RecipeWithRelations | undefined => {
    if (!planItem?.recipeId) return undefined;
    return recipeMap.get(planItem.recipeId);
  };

  const isThisWeek = isCurrentWeek(currentWeek);

  // Mobile swipe handlers for day navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    const threshold = 50; // minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && selectedDayIndex < 6) {
        // Swipe left -> next day
        setSelectedDayIndex((prev) => prev + 1);
      } else if (diff < 0 && selectedDayIndex > 0) {
        // Swipe right -> previous day
        setSelectedDayIndex((prev) => prev - 1);
      }
    }

    touchStartX.current = null;
  }, [selectedDayIndex]);

  // Handle FAB click - add meal for selected day and first meal type
  const handleFabClick = useCallback(() => {
    const selectedDate = weekDates[selectedDayIndex];
    const day = getDayOfWeek(selectedDate) as DayOfWeek;
    // Default to first meal type
    const defaultMealType = mealTypes[0];
    onAddMeal?.(day, defaultMealType);
  }, [weekDates, selectedDayIndex, mealTypes, onAddMeal]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-4">
        {/* Week Navigation Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePreviousWeek}
              aria-label="Previous week"
              className="h-10 w-10"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNextWeek}
              aria-label="Next week"
              className="h-10 w-10"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold font-display">
              {formatWeekDisplay(currentWeek)}
            </h2>
            {isThisWeek && (
              <Badge variant="today">This Week</Badge>
            )}
          </div>

          <Button
            variant="outline"
            size="default"
            onClick={handleTodayClick}
            disabled={isThisWeek}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Today
          </Button>
        </div>

      {/* Loading State - Skeleton */}
      {isPlanLoading && (
        <>
          {/* Desktop skeleton */}
          <div className="hidden md:block">
            <CalendarGridSkeleton mealTypesCount={mealTypes.length} />
          </div>
          {/* Mobile skeleton */}
          <div className="md:hidden">
            <CalendarMobileSkeletonProps mealTypesCount={mealTypes.length} />
          </div>
        </>
      )}

      {/* Error State */}
      {planError && (
        <InlineError
          message="Failed to load meal plan. Please try again."
          onRetry={() => window.location.reload()}
        />
      )}

      {/* Calendar Grid */}
      {!isPlanLoading && !planError && (
        <>
          {/* Desktop Grid (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Day Headers */}
              <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-2">
                <div /> {/* Empty cell for meal type column */}
                {weekDates.map((date, index) => {
                  const dayNum = getDayOfWeek(date) as DayOfWeek;
                  const today = isToday(date);
                  return (
                    <div
                      key={index}
                      className={cn(
                        'text-center py-3 rounded-lg transition-colors',
                        today
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/30'
                      )}
                    >
                      <div className="text-base font-semibold">{getDayName(date)}</div>
                      <div className={cn(
                        'text-sm font-mono',
                        today ? 'text-primary-foreground/90' : 'text-muted-foreground'
                      )}>
                        {formatDayNumber(date)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Meal Rows */}
              {mealTypes.map((mealType) => (
                <div key={mealType} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1 mb-1">
                  {/* Meal Type Label */}
                  <div className="flex items-center justify-end pr-3 h-full">
                    <span className="text-sm font-semibold capitalize text-muted-foreground tracking-wide">
                      {mealType}
                    </span>
                  </div>

                  {/* Meal Slots */}
                  {weekDates.map((date, index) => {
                    const day = getDayOfWeek(date) as DayOfWeek;
                    const planItem = getPlanItem(day, mealType);
                    const recipe = getRecipe(planItem);
                    const today = isToday(date);

                    return (
                      <div
                        key={`${day}-${mealType}`}
                        className={cn(
                          'rounded-lg transition-colors',
                          today && 'bg-primary/5'
                        )}
                      >
                        <MealSlot
                          day={day}
                          mealType={mealType}
                          planItem={planItem}
                          recipe={recipe}
                          onAddClick={() => onAddMeal?.(day, mealType)}
                          onSlotClick={() => onSlotClick?.(day, mealType, planItem)}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile View - Single day with horizontal date picker and swipe */}
          <div className="md:hidden relative">
            {/* Horizontal Date Picker */}
            <div className="flex gap-1 overflow-x-auto pb-3 mb-4 scrollbar-hide -mx-1 px-1">
              {weekDates.map((date, index) => {
                const today = isToday(date);
                const selected = index === selectedDayIndex;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedDayIndex(index)}
                    className={cn(
                      'flex flex-col items-center justify-center min-w-[52px] h-[66px] rounded-xl transition-all duration-200',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      selected
                        ? 'bg-primary text-primary-foreground shadow-md scale-105'
                        : today
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted/40 text-foreground hover:bg-muted'
                    )}
                    aria-label={`Select ${getDayName(date)} ${formatDayNumber(date)}`}
                    aria-pressed={selected}
                  >
                    <span className="text-xs font-medium uppercase tracking-wide">
                      {getDayName(date).slice(0, 3)}
                    </span>
                    <span className="text-lg font-semibold font-mono">
                      {formatDayNumber(date)}
                    </span>
                    {today && !selected && (
                      <span className="h-1 w-1 rounded-full bg-primary mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Day View with swipe */}
            <div
              ref={mobileContainerRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              className="touch-pan-y"
            >
              {(() => {
                const date = weekDates[selectedDayIndex];
                const day = getDayOfWeek(date) as DayOfWeek;
                const today = isToday(date);

                return (
                  <div
                    className={cn(
                      'rounded-xl border p-4 transition-all duration-200',
                      today ? 'border-primary bg-primary/5 shadow-sm' : 'border-border'
                    )}
                  >
                    {/* Day Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold font-display">
                          {getDayName(date)}
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          {formatDayNumber(date)}
                        </span>
                      </div>
                      {today && (
                        <Badge variant="today">Today</Badge>
                      )}
                    </div>

                    {/* Swipe hint */}
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <ChevronLeft className="h-3 w-3" />
                      <span>Swipe to change day</span>
                      <ChevronRight className="h-3 w-3" />
                    </p>

                    {/* Meals for the day - vertical list */}
                    <div className="space-y-3">
                      {mealTypes.map((mealType) => {
                        const planItem = getPlanItem(day, mealType);
                        const recipe = getRecipe(planItem);

                        return (
                          <div key={mealType}>
                            <span className="block text-sm font-semibold capitalize text-muted-foreground mb-2 tracking-wide">
                              {mealType}
                            </span>
                            <MealSlot
                              day={day}
                              mealType={mealType}
                              planItem={planItem}
                              recipe={recipe}
                              onAddClick={() => onAddMeal?.(day, mealType)}
                              onSlotClick={() => onSlotClick?.(day, mealType, planItem)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Day navigation indicators */}
            <div className="flex justify-center gap-1.5 mt-4">
              {weekDates.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setSelectedDayIndex(index)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    index === selectedDayIndex
                      ? 'w-6 bg-primary'
                      : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  )}
                  aria-label={`Go to day ${index + 1}`}
                />
              ))}
            </div>

            {/* Floating Action Button (FAB) for quick meal add */}
            <button
              type="button"
              onClick={handleFabClick}
              className={cn(
                'fixed bottom-20 right-4 z-40',
                'flex h-14 w-14 items-center justify-center rounded-full',
                'bg-primary text-primary-foreground shadow-lg',
                'transition-all duration-200 ease-spring',
                'hover:scale-105 hover:shadow-xl',
                'active:scale-95',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'safe-area-inset-bottom'
              )}
              aria-label="Add meal to selected day"
            >
              <Plus className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>
        </>
      )}

      {/* Drag Overlay - shows the dragged item */}
      <DragOverlay>
        {activeDragData?.recipe ? (
          <div className="opacity-90 shadow-xl">
            <RecipeCard
              recipe={activeDragData.recipe}
              dragDisabled
              className="ring-2 ring-primary"
            />
          </div>
        ) : null}
      </DragOverlay>
    </div>
    </DndContext>
  );
}
