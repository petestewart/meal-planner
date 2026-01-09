'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { ArrowLeft, Clock, Users, ChefHat, Gauge, Heart, Pencil, Trash2, CalendarPlus } from 'lucide-react';
import { useRecipe, useToggleFavorite, useDeleteRecipe } from '@/lib/queries';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  IngredientList,
  InstructionSteps,
  ServingScaler,
  RecipeActions,
  AddToPlanButton,
} from '@/components/recipes';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Get an emoji for a cuisine type
 */
function getCuisineEmoji(cuisine: string | null | undefined): string {
  if (!cuisine) {
    return '\uD83C\uDF7D\uFE0F';
  }
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

/**
 * Get dietary/allergy badges based on tags or recipe properties
 */
function getDietaryBadges(recipe: { tagIds?: string[]; description?: string | null }): string[] {
  const badges: string[] = [];

  // Common dietary tags to look for
  const dietaryTags = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo'];

  if (recipe.tagIds) {
    for (const tagId of recipe.tagIds) {
      const lowerTag = tagId.toLowerCase();
      for (const dietary of dietaryTags) {
        if (lowerTag.includes(dietary.replace('-', ''))) {
          badges.push(dietary.toUpperCase());
        }
      }
    }
  }

  // Check description for common dietary indicators
  if (recipe.description) {
    const desc = recipe.description.toLowerCase();
    if (desc.includes('gluten-free') || desc.includes('gluten free')) {
      if (!badges.includes('GLUTEN-FREE')) badges.push('GF');
    }
    if (desc.includes('vegetarian') && !badges.includes('VEGETARIAN')) {
      badges.push('VEG');
    }
    if (desc.includes('vegan') && !badges.includes('VEGAN')) {
      badges.push('VG');
    }
  }

  return badges;
}

/**
 * Loading skeleton for recipe detail page
 */
function RecipeDetailSkeleton() {
  return (
    <div className="min-h-screen pb-24 md:pb-6">
      {/* Hero skeleton */}
      <div className="relative h-[50vh] min-h-[300px] max-h-[500px] w-full">
        <Skeleton className="absolute inset-0" />
        {/* Back button skeleton */}
        <div className="absolute left-4 top-4">
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {/* Title overlay skeleton */}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <Skeleton className="h-10 w-3/4 mb-2" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-6">
        {/* Meta chips skeleton */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>

        {/* Controls skeleton */}
        <div className="flex gap-4 mb-8 pb-4 border-b">
          <Skeleton className="h-9 w-32" />
        </div>

        {/* Ingredients skeleton */}
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>

        {/* Instructions skeleton */}
        <Skeleton className="h-6 w-32 mt-8 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Not found state for recipe detail page
 */
function RecipeNotFound() {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ChefHat className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Recipe Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The recipe you're looking for doesn't exist or has been deleted.
        </p>
        <Button asChild>
          <Link href="/recipes">
            <ArrowLeft className="h-4 w-4" />
            Back to Recipes
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * Recipe detail page component
 * Displays full recipe with ingredients, instructions, and actions
 * Features:
 * - Full-bleed hero area with gradient background
 * - Meta chips bar for time, servings, difficulty
 * - Improved ingredients with checkbox style
 * - Improved instructions with numbered steps
 * - Sticky action bar on mobile
 */
export default function RecipeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recipeId = params.id as string;

  const { data: recipe, isLoading, error } = useRecipe(recipeId);
  const [servings, setServings] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const toggleFavorite = useToggleFavorite();
  const deleteRecipe = useDeleteRecipe({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      router.push('/recipes');
    },
  });

  // Calculate scale factor when servings change
  const scaleFactor = useMemo(() => {
    if (!recipe || servings === null) return 1;
    return servings / recipe.servings;
  }, [recipe, servings]);

  // Initialize servings from recipe when loaded
  const currentServings = servings ?? recipe?.servings ?? 4;

  // Handle loading state
  if (isLoading) {
    return <RecipeDetailSkeleton />;
  }

  // Handle error/not found
  if (error || !recipe) {
    return <RecipeNotFound />;
  }

  const totalTime = (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);
  const dietaryBadges = getDietaryBadges(recipe);
  const cuisineGradient = getCuisineGradient(recipe.cuisine);

  const handleFavoriteClick = () => {
    toggleFavorite.mutate(recipe.id);
  };

  const handleDelete = () => {
    deleteRecipe.mutate(recipe.id);
  };

  return (
    <div className="min-h-screen pb-24 md:pb-6">
      {/* Hero Area - Full width with gradient background */}
      <div className={cn(
        'relative h-[50vh] min-h-[300px] max-h-[500px] w-full overflow-hidden',
        cuisineGradient
      )}>
        {/* Centered cuisine emoji */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-8xl opacity-40 drop-shadow-lg">
            {getCuisineEmoji(recipe.cuisine)}
          </span>
        </div>

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Back button - top left */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background touch-manipulation"
          asChild
        >
          <Link href="/recipes" aria-label="Back to recipes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>

        {/* Desktop actions - top right (hidden on mobile) */}
        <div className="absolute right-4 top-4 hidden md:flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleFavoriteClick}
            disabled={toggleFavorite.isPending}
            aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background touch-manipulation"
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-colors',
                recipe.isFavorite
                  ? 'fill-red-500 text-red-500'
                  : 'text-muted-foreground hover:text-red-500'
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background touch-manipulation"
            asChild
            aria-label="Edit recipe"
          >
            <Link href={`/recipes/${recipe.id}/edit`}>
              <Pencil className="h-5 w-5" />
            </Link>
          </Button>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete recipe"
                className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background text-muted-foreground hover:text-destructive touch-manipulation"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Recipe</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this recipe? This action cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                  disabled={deleteRecipe.isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteRecipe.isPending}
                >
                  {deleteRecipe.isPending ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Title and cuisine overlay - positioned at bottom */}
        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="container mx-auto max-w-4xl">
            {recipe.cuisine && (
              <Badge
                variant="default"
                className="mb-3 bg-white/20 text-white border-white/30 backdrop-blur-sm"
              >
                {recipe.cuisine}
              </Badge>
            )}
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white drop-shadow-lg leading-tight">
              {recipe.title}
            </h1>
            {recipe.description && (
              <p className="mt-2 text-white/90 text-sm md:text-base line-clamp-2 max-w-2xl">
                {recipe.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto max-w-4xl px-4 py-6">
        {/* Meta chips bar - time, servings, difficulty */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {totalTime > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-sm font-medium">{totalTime}m</span>
              {recipe.prepTimeMinutes && recipe.cookTimeMinutes && (
                <span className="text-xs text-muted-foreground">
                  ({recipe.prepTimeMinutes}m prep + {recipe.cookTimeMinutes}m cook)
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-full bg-muted px-4 py-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-medium">{recipe.servings}</span>
            <span className="text-xs text-muted-foreground">servings</span>
          </div>

          {recipe.difficulty && (
            <div className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2',
              recipe.difficulty === 'easy' && 'bg-green-100 dark:bg-green-900/30',
              recipe.difficulty === 'medium' && 'bg-yellow-100 dark:bg-yellow-900/30',
              recipe.difficulty === 'hard' && 'bg-red-100 dark:bg-red-900/30'
            )}>
              <Gauge className={cn(
                'h-4 w-4',
                recipe.difficulty === 'easy' && 'text-green-600 dark:text-green-400',
                recipe.difficulty === 'medium' && 'text-yellow-600 dark:text-yellow-400',
                recipe.difficulty === 'hard' && 'text-red-600 dark:text-red-400'
              )} />
              <span className={cn(
                'text-sm font-medium capitalize',
                recipe.difficulty === 'easy' && 'text-green-700 dark:text-green-300',
                recipe.difficulty === 'medium' && 'text-yellow-700 dark:text-yellow-300',
                recipe.difficulty === 'hard' && 'text-red-700 dark:text-red-300'
              )}>
                {recipe.difficulty}
              </span>
            </div>
          )}
        </div>

        {/* Dietary badges */}
        {dietaryBadges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {dietaryBadges.map((badge) => (
              <Badge key={badge} variant="primary">
                {badge}
              </Badge>
            ))}
          </div>
        )}

        {/* Servings scaler */}
        <div className="mb-8 pb-6 border-b">
          <ServingScaler
            servings={currentServings}
            originalServings={recipe.servings}
            onServingsChange={setServings}
          />
        </div>

        {/* Ingredients section */}
        <IngredientList
          ingredients={recipe.ingredients || []}
          scaleFactor={scaleFactor}
          className="mb-10"
        />

        {/* Instructions section */}
        <InstructionSteps instructions={recipe.instructions} className="mb-10" />

        {/* Source link if available */}
        {recipe.sourceUrl && (
          <div className="mt-8 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Source:{' '}
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {new URL(recipe.sourceUrl).hostname}
              </a>
            </p>
          </div>
        )}
      </div>

      {/* Sticky action bar - mobile only */}
      <div className="fixed bottom-0 inset-x-0 md:hidden bg-background/95 backdrop-blur-sm border-t shadow-lg safe-area-inset-bottom z-50">
        <div className="flex items-center justify-between p-4 max-w-4xl mx-auto">
          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleFavoriteClick}
              disabled={toggleFavorite.isPending}
              aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              className="h-11 w-11 touch-manipulation"
            >
              <Heart
                className={cn(
                  'h-6 w-6 transition-colors',
                  recipe.isFavorite
                    ? 'fill-red-500 text-red-500'
                    : 'text-muted-foreground'
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 touch-manipulation"
              asChild
              aria-label="Edit recipe"
            >
              <Link href={`/recipes/${recipe.id}/edit`}>
                <Pencil className="h-6 w-6" />
              </Link>
            </Button>
          </div>

          {/* Primary action - Add to Plan */}
          <Button className="h-11 px-6 text-base font-semibold" asChild>
            <Link href={`/planner?addRecipe=${recipe.id}`}>
              <CalendarPlus className="h-5 w-5" />
              Add to Plan
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
