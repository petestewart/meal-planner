'use client';

import Link from 'next/link';
import { Heart, Clock } from 'lucide-react';
import { RecipeWithRelations } from '@/types/api';
import { cn } from '@/lib/utils';
import { useToggleFavorite } from '@/lib/queries';
import { Badge } from '@/components/ui/badge';

interface RecipeCardProps {
  recipe: RecipeWithRelations;
  className?: string;
}

/**
 * Recipe card for the recipe library grid
 * Features:
 * - 3:4 portrait aspect ratio
 * - Gradient placeholder with cuisine icon
 * - Title positioned at bottom over gradient
 * - Cook time and cuisine chips
 * - Hover lift animation
 * - Animated favorite heart
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

  const cuisineGradient = getCuisineGradient(recipe.cuisine);

  return (
    <Link
      href={`/recipes/${recipe.id}`}
      className={cn(
        'group block rounded-xl overflow-hidden bg-card text-card-foreground shadow-md transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
    >
      {/* Image area with gradient placeholder - 3:4 portrait aspect ratio */}
      <div className={cn(
        'relative aspect-[3/4] w-full overflow-hidden',
        cuisineGradient
      )}>
        {/* Centered cuisine emoji for placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-6xl opacity-60 drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300">
            {getCuisineEmoji(recipe.cuisine)}
          </span>
        </div>

        {/* Gradient overlay at bottom for title readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Favorite button - top right */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          disabled={toggleFavorite.isPending}
          className={cn(
            'absolute right-2 top-2 rounded-full p-2.5 transition-all duration-200 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center',
            'bg-background/80 backdrop-blur-sm',
            'hover:bg-background hover:scale-110',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            toggleFavorite.isPending && 'opacity-50'
          )}
          aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart
            className={cn(
              'h-5 w-5 transition-all duration-300',
              recipe.isFavorite
                ? 'fill-red-500 text-red-500 scale-100'
                : 'text-muted-foreground hover:text-red-500 scale-90 hover:scale-100',
              // Add bounce animation when favorited
              recipe.isFavorite && 'animate-favorite-pop'
            )}
          />
        </button>

        {/* Title and meta positioned at bottom over gradient */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-semibold text-white leading-tight line-clamp-2 text-lg drop-shadow-md">
            {recipe.title}
          </h3>

          {/* Meta row with cook time and cuisine badge */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {totalTime > 0 && (
              <span className="flex items-center gap-1 text-sm text-white/90">
                <Clock className="h-4 w-4" />
                {totalTime}m
              </span>
            )}
            {recipe.cuisine && (
              <Badge
                variant="default"
                className="bg-white/20 text-white border-white/30 backdrop-blur-sm text-[10px]"
              >
                {recipe.cuisine}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/**
 * Get an emoji for a cuisine type
 */
function getCuisineEmoji(cuisine: string | null | undefined): string {
  if (!cuisine) return '\uD83C\uDF7D\uFE0F'; // Default plate emoji

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

/**
 * Get a warm gradient background based on cuisine type
 * Creates visually appealing placeholders that match the design system
 */
function getCuisineGradient(cuisine: string | null | undefined): string {
  if (!cuisine) {
    // Default warm gradient
    return 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500';
  }

  const gradientMap: Record<string, string> = {
    // Italian - tomato reds and warm terracotta
    italian: 'bg-gradient-to-br from-red-400 via-orange-500 to-amber-600',
    // Mexican - vibrant warm colors
    mexican: 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-600',
    // Chinese - rich red and gold
    chinese: 'bg-gradient-to-br from-red-500 via-red-600 to-amber-500',
    // Japanese - subtle warm pinks and coral
    japanese: 'bg-gradient-to-br from-pink-300 via-rose-400 to-orange-400',
    // Indian - warm spice colors
    indian: 'bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-600',
    // Thai - tropical warm tones
    thai: 'bg-gradient-to-br from-lime-400 via-emerald-500 to-teal-500',
    // French - sophisticated warm neutrals
    french: 'bg-gradient-to-br from-amber-200 via-orange-300 to-rose-400',
    // American - classic warm colors
    american: 'bg-gradient-to-br from-amber-400 via-orange-400 to-red-500',
    // Greek - Mediterranean blues with warmth
    greek: 'bg-gradient-to-br from-sky-400 via-blue-400 to-indigo-500',
    // Spanish - warm sunset colors
    spanish: 'bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500',
    // Korean - vibrant warm tones
    korean: 'bg-gradient-to-br from-red-400 via-rose-500 to-pink-500',
    // Vietnamese - fresh herby greens with warmth
    vietnamese: 'bg-gradient-to-br from-emerald-400 via-green-500 to-lime-500',
    // Mediterranean - olive and sun tones
    mediterranean: 'bg-gradient-to-br from-amber-300 via-yellow-400 to-lime-500',
  };

  const lower = cuisine.toLowerCase();
  return gradientMap[lower] || 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500';
}
