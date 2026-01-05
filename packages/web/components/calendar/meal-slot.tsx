'use client';

import { useDroppable } from '@dnd-kit/core';
import { Plus, Utensils, SkipForward, UtensilsCrossed } from 'lucide-react';
import { PlanItem, MealType, RecipeWithRelations, SlotType, DayOfWeek } from '@/types/api';
import { Button } from '@/components/ui/button';
import { RecipeCard } from './recipe-card';
import { cn } from '@/lib/utils';

/**
 * Data attached to droppable meal slots
 */
export interface DropData {
  type: 'meal-slot';
  day: DayOfWeek;
  mealType: MealType;
  hasRecipe: boolean;
}

interface MealSlotProps {
  day: DayOfWeek; // 1-7 (Mon-Sun)
  mealType: MealType;
  planItem?: PlanItem;
  recipe?: RecipeWithRelations;
  onAddClick?: () => void;
  onSlotClick?: () => void;
  className?: string;
}

/**
 * Represents one cell in the calendar grid
 * Shows either an empty "+" button or a recipe card
 * Supports drop targets for drag-and-drop meal assignment
 */
export function MealSlot({
  day,
  mealType,
  planItem,
  recipe,
  onAddClick,
  onSlotClick,
  className,
}: MealSlotProps) {
  // Create a unique droppable ID
  const droppableId = `slot-${day}-${mealType}`;

  const { setNodeRef, isOver, active } = useDroppable({
    id: droppableId,
    data: {
      type: 'meal-slot',
      day,
      mealType,
      hasRecipe: !!recipe,
    } as DropData,
  });

  // Determine if this slot is a valid drop target
  // It's valid if something is being dragged and it's not the same slot
  const isValidDropTarget = active && (
    !active.data.current ||
    active.data.current.sourceDay !== day ||
    active.data.current.sourceMealType !== mealType
  );

  // Handle non-recipe slot types
  if (planItem && planItem.slotType !== 'recipe') {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[80px] items-center justify-center rounded-md border border-dashed bg-muted/30 p-2 transition-colors',
          isOver && isValidDropTarget && 'border-primary bg-primary/10 border-solid border-2',
          active && isValidDropTarget && !isOver && 'border-primary/50',
          className
        )}
      >
        <button
          type="button"
          onClick={onSlotClick}
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <SlotTypeIcon slotType={planItem.slotType} />
          <span className="text-xs capitalize">{formatSlotType(planItem.slotType)}</span>
        </button>
      </div>
    );
  }

  // Empty slot - show add button
  if (!planItem || !recipe) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[80px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-2 transition-colors',
          isOver && isValidDropTarget && 'border-primary bg-primary/10 border-solid border-2',
          active && isValidDropTarget && !isOver && 'border-primary/50',
          className
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddClick}
          className="h-10 w-10 rounded-full hover:bg-accent"
          aria-label={`Add ${mealType} for day ${day}`}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    );
  }

  // Filled slot - show recipe card
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[80px] p-1 rounded-md transition-colors',
        isOver && isValidDropTarget && 'bg-primary/10 ring-2 ring-primary ring-inset',
        active && isValidDropTarget && !isOver && 'ring-1 ring-primary/50 ring-inset',
        className
      )}
    >
      <RecipeCard
        recipe={recipe}
        onClick={onSlotClick}
        day={day}
        mealType={mealType}
      />
    </div>
  );
}

function SlotTypeIcon({ slotType }: { slotType: SlotType }) {
  switch (slotType) {
    case 'dining_out':
      return <Utensils className="h-5 w-5" />;
    case 'skip':
      return <SkipForward className="h-5 w-5" />;
    case 'leftovers':
      return <UtensilsCrossed className="h-5 w-5" />;
    default:
      return null;
  }
}

function formatSlotType(slotType: SlotType): string {
  switch (slotType) {
    case 'dining_out':
      return 'Dining Out';
    case 'skip':
      return 'Skip';
    case 'leftovers':
      return 'Leftovers';
    default:
      return slotType;
  }
}
