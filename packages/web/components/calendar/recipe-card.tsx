'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock } from 'lucide-react';
import { RecipeWithRelations, DayOfWeek, MealType } from '@/types/api';
import { cn } from '@/lib/utils';

/**
 * Data attached to draggable recipe cards
 */
export interface DragData {
  type: 'recipe';
  recipeId: string;
  recipe: RecipeWithRelations;
  sourceDay: DayOfWeek;
  sourceMealType: MealType;
}

interface RecipeCardProps {
  recipe: RecipeWithRelations;
  onClick?: () => void;
  className?: string;
  /** Required for drag-drop functionality */
  day?: DayOfWeek;
  mealType?: MealType;
  /** Whether drag is disabled for this card */
  dragDisabled?: boolean;
  /** Show drag handle on hover */
  showDragHandle?: boolean;
}

/**
 * Compact recipe card for displaying in meal slots
 * Horizontal layout with thumbnail left, title + meta stacked right
 * Supports drag-and-drop when day and mealType are provided
 */
export function RecipeCard({
  recipe,
  onClick,
  className,
  day,
  mealType,
  dragDisabled = false,
  showDragHandle = false,
}: RecipeCardProps) {
  // Create a unique draggable ID
  const draggableId = day && mealType
    ? `recipe-${recipe.id}-${day}-${mealType}`
    : `recipe-${recipe.id}`;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: {
      type: 'recipe',
      recipeId: recipe.id,
      recipe,
      sourceDay: day,
      sourceMealType: mealType,
    } as DragData,
    disabled: dragDisabled || !day || !mealType,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }
    : undefined;

  const totalTime = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);
  const canDrag = day && mealType && !dragDisabled;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/card relative w-full rounded-md border bg-card shadow-sm transition-all duration-200 touch-manipulation',
        'hover:shadow-md hover:border-primary/20',
        isDragging && 'opacity-60 shadow-lg ring-2 ring-primary cursor-grabbing scale-105',
        !isDragging && canDrag && 'cursor-grab',
        className
      )}
    >
      {/* Drag handle - visible on hover */}
      {showDragHandle && canDrag && !isDragging && (
        <div
          {...attributes}
          {...listeners}
          className={cn(
            'absolute -left-1 top-1/2 -translate-y-1/2 z-10',
            'flex h-8 w-4 items-center justify-center rounded-l-md',
            'bg-muted/80 text-muted-foreground',
            'opacity-0 group-hover/card:opacity-100 transition-opacity duration-200',
            'hover:bg-primary/20 hover:text-primary cursor-grab'
          )}
          aria-label="Drag to move"
        >
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        aria-label={`${recipe.title} - click to edit${canDrag ? ' or drag to move' : ''}`}
        className={cn(
          'flex w-full items-stretch gap-3 p-2 text-left',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md'
        )}
        {...(!showDragHandle ? { ...attributes, ...listeners } : {})}
      >
        {/* Thumbnail - placeholder as images not yet supported */}
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
            <span className="text-lg font-semibold text-primary/40">
              {recipe.title.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content - title + meta stacked */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <span className="text-sm font-medium leading-tight line-clamp-2">
            {recipe.title}
          </span>
          {totalTime > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {totalTime} min
            </span>
          )}
        </div>
      </button>
    </div>
  );
}
