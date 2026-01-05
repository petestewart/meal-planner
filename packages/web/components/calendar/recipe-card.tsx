'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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
}

/**
 * Mini recipe card for displaying in meal slots
 * Shows recipe title and optional image thumbnail
 * Supports drag-and-drop when day and mealType are provided
 */
export function RecipeCard({
  recipe,
  onClick,
  className,
  day,
  mealType,
  dragDisabled = false,
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

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onClick}
      style={style}
      {...attributes}
      {...listeners}
      aria-label={`${recipe.title} - click to edit or drag to move`}
      className={cn(
        'w-full text-left rounded-md border bg-card p-2 transition-colors touch-manipulation',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary cursor-grabbing',
        !isDragging && day && mealType && !dragDisabled && 'cursor-grab',
        className
      )}
    >
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium line-clamp-2 leading-tight">
          {recipe.title}
        </span>
        {recipe.prepTimeMinutes && recipe.cookTimeMinutes && (
          <span className="text-xs text-muted-foreground">
            {recipe.prepTimeMinutes + recipe.cookTimeMinutes} min
          </span>
        )}
      </div>
    </button>
  );
}
