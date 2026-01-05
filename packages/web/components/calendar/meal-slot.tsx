'use client';

import { Plus, Utensils, SkipForward, UtensilsCrossed } from 'lucide-react';
import { PlanItem, MealType, RecipeWithRelations, SlotType } from '@/types/api';
import { Button } from '@/components/ui/button';
import { RecipeCard } from './recipe-card';
import { cn } from '@/lib/utils';

interface MealSlotProps {
  day: number; // 1-7 (Mon-Sun)
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
  // Handle non-recipe slot types
  if (planItem && planItem.slotType !== 'recipe') {
    return (
      <div
        className={cn(
          'flex min-h-[80px] items-center justify-center rounded-md border border-dashed bg-muted/30 p-2',
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
        className={cn(
          'flex min-h-[80px] items-center justify-center rounded-md border border-dashed bg-muted/20 p-2',
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
    <div className={cn('min-h-[80px] p-1', className)}>
      <RecipeCard recipe={recipe} onClick={onSlotClick} />
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
