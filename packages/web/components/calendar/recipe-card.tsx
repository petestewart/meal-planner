'use client';

import { RecipeWithRelations } from '@/types/api';
import { cn } from '@/lib/utils';

interface RecipeCardProps {
  recipe: RecipeWithRelations;
  onClick?: () => void;
  className?: string;
}

/**
 * Mini recipe card for displaying in meal slots
 * Shows recipe title and optional image thumbnail
 */
export function RecipeCard({ recipe, onClick, className }: RecipeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-md border bg-card p-2 transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
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
