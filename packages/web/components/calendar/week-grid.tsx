'use client';

import { useState, useMemo, useCallback } from 'react';
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
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePreviousWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleNextWeek}
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">
            {formatWeekDisplay(currentWeek)}
          </h2>
          {isThisWeek && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              This Week
            </span>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleTodayClick}
          disabled={isThisWeek}
        >
          Today
        </Button>
      </div>

      {/* Loading State */}
      {isPlanLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error State */}
      {planError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          Failed to load meal plan. Please try again.
        </div>
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
                        'text-center py-2 rounded-md',
                        today && 'bg-primary text-primary-foreground'
                      )}
                    >
                      <div className="text-sm font-medium">{getDayName(date)}</div>
                      <div className={cn('text-xs', today ? 'text-primary-foreground' : 'text-muted-foreground')}>
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
                  <div className="flex items-center justify-end pr-2">
                    <span className="text-sm font-medium capitalize text-muted-foreground">
                      {mealType}
                    </span>
                  </div>

                  {/* Meal Slots */}
                  {weekDates.map((date, index) => {
                    const day = getDayOfWeek(date) as DayOfWeek;
                    const planItem = getPlanItem(day, mealType);
                    const recipe = getRecipe(planItem);

                    return (
                      <MealSlot
                        key={`${day}-${mealType}`}
                        day={day}
                        mealType={mealType}
                        planItem={planItem}
                        recipe={recipe}
                        onAddClick={() => onAddMeal?.(day, mealType)}
                        onSlotClick={() => onSlotClick?.(day, mealType, planItem)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile View - Single/Multi-day cards */}
          <div className="md:hidden space-y-4">
            {weekDates.map((date, index) => {
              const day = getDayOfWeek(date) as DayOfWeek;
              const today = isToday(date);

              return (
                <div
                  key={index}
                  className={cn(
                    'rounded-lg border p-3',
                    today && 'border-primary bg-primary/5'
                  )}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{getDayName(date)}</span>
                      <span className="text-muted-foreground">
                        {formatDayNumber(date)}
                      </span>
                    </div>
                    {today && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Meals for the day */}
                  <div className="space-y-2">
                    {mealTypes.map((mealType) => {
                      const planItem = getPlanItem(day, mealType);
                      const recipe = getRecipe(planItem);

                      return (
                        <div key={mealType} className="flex items-start gap-3">
                          <span className="w-16 text-sm font-medium capitalize text-muted-foreground pt-2">
                            {mealType}
                          </span>
                          <div className="flex-1">
                            <MealSlot
                              day={day}
                              mealType={mealType}
                              planItem={planItem}
                              recipe={recipe}
                              onAddClick={() => onAddMeal?.(day, mealType)}
                              onSlotClick={() => onSlotClick?.(day, mealType, planItem)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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
