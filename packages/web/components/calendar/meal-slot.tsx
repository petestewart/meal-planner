'use client';

import { useDroppable } from '@dnd-kit/core';
import { Plus, UtensilsCrossed, X, Package } from 'lucide-react';
import { PlanItem, MealType, RecipeWithRelations, SlotType, DayOfWeek } from '@/types/api';
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

  // Handle non-recipe slot types (special slots)
  if (planItem && planItem.slotType !== 'recipe') {
    const slotConfig = getSlotConfig(planItem.slotType);
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'group relative min-h-[80px] rounded-md border-2 p-3 transition-all duration-200',
          slotConfig.containerClass,
          isOver && isValidDropTarget && 'border-primary bg-primary/10 ring-2 ring-primary/30 scale-[1.02]',
          active && isValidDropTarget && !isOver && 'border-primary/50 bg-primary/5',
          className
        )}
      >
        <button
          type="button"
          onClick={onSlotClick}
          className="flex items-center gap-3 w-full text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md transition-colors"
          aria-label={`${formatSlotType(planItem.slotType)} - click to edit`}
        >
          <div className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            slotConfig.iconBgClass
          )}>
            <SlotTypeIcon slotType={planItem.slotType} className={slotConfig.iconClass} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className={cn('text-sm font-medium', slotConfig.textClass)}>
              {formatSlotType(planItem.slotType)}
            </span>
            {planItem.slotType === 'dining_out' && planItem.notes && (
              <span className="text-xs text-muted-foreground truncate">{planItem.notes}</span>
            )}
          </div>
        </button>
      </div>
    );
  }

  // Empty slot - show add button with inviting dashed border
  if (!planItem || !recipe) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'group flex min-h-[80px] items-center justify-center rounded-md border-2 border-dashed border-primary/30 bg-primary/5 p-2 transition-all duration-200',
          'hover:border-primary/50 hover:bg-primary/10',
          isOver && isValidDropTarget && 'border-primary border-solid bg-primary/15 ring-2 ring-primary/30 scale-[1.02]',
          active && isValidDropTarget && !isOver && 'border-primary/60 bg-primary/10',
          className
        )}
      >
        <button
          type="button"
          onClick={onAddClick}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200',
            'text-primary/50 hover:text-primary hover:bg-primary/20',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'group-hover:scale-110'
          )}
          aria-label={`Add ${mealType} for day ${day}`}
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  // Filled slot - show recipe card
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'group min-h-[80px] rounded-md transition-all duration-200',
        isOver && isValidDropTarget && 'bg-primary/10 ring-2 ring-primary scale-[1.02]',
        active && isValidDropTarget && !isOver && 'ring-1 ring-primary/50',
        className
      )}
    >
      <RecipeCard
        recipe={recipe}
        onClick={onSlotClick}
        day={day}
        mealType={mealType}
        showDragHandle
      />
    </div>
  );
}

interface SlotConfig {
  containerClass: string;
  iconBgClass: string;
  iconClass: string;
  textClass: string;
}

function getSlotConfig(slotType: SlotType): SlotConfig {
  switch (slotType) {
    case 'dining_out':
      return {
        containerClass: 'border-amber-300/50 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-950/30',
        iconBgClass: 'bg-amber-100 dark:bg-amber-900/50',
        iconClass: 'text-amber-600 dark:text-amber-400',
        textClass: 'text-amber-700 dark:text-amber-300',
      };
    case 'skip':
      return {
        containerClass: 'border-slate-300/50 bg-slate-50/50 dark:border-slate-700/50 dark:bg-slate-900/30',
        iconBgClass: 'bg-slate-100 dark:bg-slate-800/50',
        iconClass: 'text-slate-500 dark:text-slate-400',
        textClass: 'text-slate-600 dark:text-slate-400',
      };
    case 'leftovers':
      return {
        containerClass: 'border-emerald-300/50 bg-emerald-50/50 dark:border-emerald-700/50 dark:bg-emerald-950/30',
        iconBgClass: 'bg-emerald-100 dark:bg-emerald-900/50',
        iconClass: 'text-emerald-600 dark:text-emerald-400',
        textClass: 'text-emerald-700 dark:text-emerald-300',
      };
    default:
      return {
        containerClass: 'border-muted bg-muted/30',
        iconBgClass: 'bg-muted',
        iconClass: 'text-muted-foreground',
        textClass: 'text-muted-foreground',
      };
  }
}

function SlotTypeIcon({ slotType, className }: { slotType: SlotType; className?: string }) {
  switch (slotType) {
    case 'dining_out':
      return <UtensilsCrossed className={cn('h-5 w-5', className)} />;
    case 'skip':
      return <X className={cn('h-5 w-5', className)} />;
    case 'leftovers':
      return <Package className={cn('h-5 w-5', className)} />;
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
