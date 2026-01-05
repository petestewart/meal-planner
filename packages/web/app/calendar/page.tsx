'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import { WeekGrid } from '@/components/calendar';
import { getCurrentWeek } from '@/lib/week-utils';
import { DayOfWeek, MealType, PlanItem } from '@/types/api';
import { Loader2 } from 'lucide-react';

function CalendarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Get week from URL or use current week
  const week = searchParams.get('week') || getCurrentWeek();

  // Handle week change - update URL
  const handleWeekChange = useCallback(
    (newWeek: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('week', newWeek);
      router.push(`/calendar?${params.toString()}`);
    },
    [router, searchParams]
  );

  // Handle slot click - for now just log
  const handleSlotClick = useCallback(
    (day: DayOfWeek, mealType: MealType, planItem?: PlanItem) => {
      console.log('Slot clicked:', { day, mealType, planItem });
      // TODO: Open recipe detail or edit modal
    },
    []
  );

  // Handle add meal click - for now just log
  const handleAddMeal = useCallback(
    (day: DayOfWeek, mealType: MealType) => {
      console.log('Add meal clicked:', { day, mealType });
      // TODO: Open recipe selector modal
    },
    []
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
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Meal Calendar</h1>
            <p className="mt-2 text-muted-foreground">
              Plan your meals for the week ahead.
            </p>
          </div>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      }
    >
      <CalendarContent />
    </Suspense>
  );
}
