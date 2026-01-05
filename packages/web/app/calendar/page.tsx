'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { WeekGrid } from '@/components/calendar';
import { RecipeSelector, RecipeSelection } from '@/components/calendar/recipe-selector';
import { getCurrentWeek } from '@/lib/week-utils';
import { DayOfWeek, MealType, PlanItem } from '@/types/api';
import { useSetMeal, usePreferences, useCreatePlan } from '@/lib/queries';
import { Skeleton } from '@/components/ui/skeleton';

interface SelectedSlot {
  day: DayOfWeek;
  mealType: MealType;
}

function CalendarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get week from URL or use current week
  const week = searchParams.get('week') || getCurrentWeek();

  // Modal state
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  // Fetch preferences for default servings
  const { data: preferences } = usePreferences();
  const defaultServings = preferences?.defaultServings || 2;

  // API mutations
  const setMealMutation = useSetMeal();
  const createPlanMutation = useCreatePlan();

  // Handle week change - update URL
  const handleWeekChange = useCallback(
    (newWeek: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('week', newWeek);
      router.push(`/calendar?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Handle slot click - open selector to change meal
  const handleSlotClick = useCallback(
    (day: DayOfWeek, mealType: MealType, planItem?: PlanItem) => {
      setSelectedSlot({ day, mealType });
      setSelectorOpen(true);
    },
    []
  );

  // Handle add meal click - open selector
  const handleAddMeal = useCallback(
    (day: DayOfWeek, mealType: MealType) => {
      setSelectedSlot({ day, mealType });
      setSelectorOpen(true);
    },
    []
  );

  // Handle recipe selection
  const handleRecipeSelect = useCallback(
    async (selection: RecipeSelection) => {
      if (!selectedSlot) return;

      try {
        // Try to set the meal - if plan doesn't exist, create it first
        await setMealMutation.mutateAsync({
          week,
          day: selectedSlot.day,
          mealType: selectedSlot.mealType,
          input: {
            recipeId: selection.recipeId,
            servings: selection.servings,
          },
        });
      } catch (error: unknown) {
        // If the plan doesn't exist (404), create it first then retry
        if (error instanceof Error && error.message.includes('not found')) {
          await createPlanMutation.mutateAsync({ week });
          await setMealMutation.mutateAsync({
            week,
            day: selectedSlot.day,
            mealType: selectedSlot.mealType,
            input: {
              recipeId: selection.recipeId,
              servings: selection.servings,
            },
          });
        } else {
          console.error('Failed to set meal:', error);
        }
      }

      setSelectorOpen(false);
      setSelectedSlot(null);
    },
    [selectedSlot, week, setMealMutation, createPlanMutation]
  );

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Meal Calendar</h1>
        <p className="mt-2 text-muted-foreground">
          Plan your meals for the week ahead.
        </p>
      </div>

      <WeekGrid
        initialWeek={week}
        onWeekChange={handleWeekChange}
        onSlotClick={handleSlotClick}
        onAddMeal={handleAddMeal}
      />

      {/* Recipe Selector Modal */}
      {selectedSlot && (
        <RecipeSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          onSelect={handleRecipeSelect}
          dayOfWeek={selectedSlot.day}
          mealType={selectedSlot.mealType}
          defaultServings={defaultServings}
        />
      )}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Meal Calendar</h1>
        <p className="mt-2 text-muted-foreground">
          Plan your meals for the week ahead.
        </p>
      </div>

      {/* Week navigation skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-9" />
        </div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-9 w-16" />
      </div>

      {/* Calendar grid skeleton */}
      <div className="space-y-4">
        {/* Day headers */}
        <div className="grid grid-cols-[80px_repeat(7,1fr)] gap-1">
          <div />
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="text-center py-2">
              <Skeleton className="h-5 w-12 mx-auto mb-1" />
              <Skeleton className="h-4 w-8 mx-auto" />
            </div>
          ))}
        </div>

        {/* Meal rows */}
        {[1, 2].map((row) => (
          <div key={row} className="grid grid-cols-[80px_repeat(7,1fr)] gap-1">
            <div className="flex items-center justify-end pr-2">
              <Skeleton className="h-4 w-14" />
            </div>
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="min-h-[80px] rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<CalendarSkeleton />}>
      <CalendarContent />
    </Suspense>
  );
}
