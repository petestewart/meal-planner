'use client';

import Link from 'next/link';
import { Heart, Clock } from 'lucide-react';
import { RecipeWithRelations } from '@/types/api';
import { cn } from '@/lib/utils';
import { useToggleFavorite } from '@/lib/queries';

interface RecipeCardProps {
  recipe: RecipeWithRelations;
  className?: string;
}

/**
 * Recipe card for the recipe library grid
 * Shows image placeholder, title, cuisine, total time, and favorite status
 */
export function RecipeCard({ recipe, className }: RecipeCardProps) {
  const toggleFavorite = useToggleFavorite();

  const totalTime =
    (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate(recipe.id);
  };

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className={cn(
        'group block rounded-xl border bg-card text-card-foreground shadow transition-all',
        'hover:shadow-md hover:border-primary/20',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      {/* Image placeholder */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-muted">
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <span className="text-4xl">
            {recipe.cuisine ? getCuisineEmoji(recipe.cuisine) : ''}
          </span>
        </div>

        {/* Favorite button */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          disabled={toggleFavorite.isPending}
          className={cn(
            'absolute right-2 top-2 rounded-full p-2 transition-colors',
            'bg-background/80 backdrop-blur-sm',
            'hover:bg-background',
            'focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            className={cn(
              'h-5 w-5 transition-colors',
              recipe.isFavorite
                ? 'fill-red-500 text-red-500'
                : 'text-muted-foreground hover:text-red-500'
            )}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {recipe.title}
        </h3>

        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          {totalTime > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {totalTime}m
            </span>
          )}
          {recipe.cuisine && (
            <span className="capitalize">{recipe.cuisine}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Get an emoji for a cuisine type
 */
function getCuisineEmoji(cuisine: string): string {
  const cuisineMap: Record<string, string> = {
    italian: '\uD83C\uDDEE\uD83C\uDDF9',
    mexican: '\uD83C\uDDF2\uD83C\uDDFD',
    chinese: '\uD83C\uDDE8\uD83C\uDDF3',
    japanese: '\uD83C\uDDEF\uD83C\uDDF5',
    indian: '\uD83C\uDDEE\uD83C\uDDF3',
    thai: '\uD83C\uDDF9\uD83C\uDDED',
    french: '\uD83C\uDDEB\uD83C\uDDF7',
    american: '\uD83C\uDDFA\uD83C\uDDF8',
    greek: '\uD83C\uDDEC\uD83C\uDDF7',
    spanish: '\uD83C\uDDEA\uD83C\uDDF8',
    korean: '\uD83C\uDDF0\uD83C\uDDF7',
    vietnamese: '\uD83C\uDDFB\uD83C\uDDF3',
    mediterranean: '\uD83E\uDD57',
  };

  const lower = cuisine.toLowerCase();
  return cuisineMap[lower] || '\uD83C\uDF7D\uFE0F';
}
