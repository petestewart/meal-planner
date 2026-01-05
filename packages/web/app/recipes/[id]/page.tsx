'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useParams, notFound } from 'next/navigation';
import { ArrowLeft, Clock, Users, ChefHat } from 'lucide-react';
import { useRecipe } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import {
  IngredientList,
  InstructionSteps,
  ServingScaler,
  RecipeActions,
  AddToPlanButton,
} from '@/components/recipes';
import { cn } from '@/lib/utils';

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
    <div className="container mx-auto max-w-4xl p-6 animate-pulse">
      {/* Back button skeleton */}
      <div className="h-9 w-24 bg-muted rounded mb-6" />

      {/* Hero skeleton */}
      <div className="relative mb-6 aspect-[21/9] w-full overflow-hidden rounded-xl bg-muted" />

      {/* Title skeleton */}
      <div className="h-8 w-3/4 bg-muted rounded mb-4" />

      {/* Metadata skeleton */}
      <div className="flex gap-4 mb-6">
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
        <div className="h-5 w-24 bg-muted rounded" />
      </div>

      {/* Controls skeleton */}
      <div className="flex gap-4 mb-8">
        <div className="h-9 w-32 bg-muted rounded" />
        <div className="h-9 w-32 bg-muted rounded" />
      </div>

      {/* Ingredients skeleton */}
      <div className="h-6 w-32 bg-muted rounded mb-4" />
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-5 w-full bg-muted rounded" />
        ))}
      </div>

      {/* Instructions skeleton */}
      <div className="h-6 w-32 bg-muted rounded mt-8 mb-4" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 w-full bg-muted rounded" />
        ))}
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
 */
export default function RecipeDetailPage() {
  const params = useParams();
  const recipeId = params.id as string;

  const { data: recipe, isLoading, error } = useRecipe(recipeId);
  const [servings, setServings] = useState<number | null>(null);

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

  return (
    <div className="container mx-auto max-w-4xl p-6">
      {/* Header with back button and actions */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" asChild>
          <Link href="/recipes">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <RecipeActions recipeId={recipe.id} isFavorite={recipe.isFavorite} />
      </div>

      {/* Hero image placeholder */}
      <div className="relative mb-6 aspect-[21/9] w-full overflow-hidden rounded-xl bg-muted">
        <div className="flex h-full items-center justify-center">
          <span className="text-6xl">
            {recipe.cuisine ? getCuisineEmoji(recipe.cuisine) : '\uD83C\uDF7D\uFE0F'}
          </span>
        </div>
        {/* Title overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-6">
          <h1 className="text-3xl font-bold text-white">{recipe.title}</h1>
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-4 mb-2">
        {recipe.cuisine && (
          <span className="capitalize text-muted-foreground">{recipe.cuisine}</span>
        )}
        {recipe.prepTimeMinutes && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {recipe.prepTimeMinutes}m prep
          </span>
        )}
        {recipe.cookTimeMinutes && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            {recipe.cookTimeMinutes}m cook
          </span>
        )}
        {totalTime > 0 && (
          <span className="text-muted-foreground">
            ({totalTime}m total)
          </span>
        )}
        {recipe.difficulty && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              recipe.difficulty === 'easy' && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
              recipe.difficulty === 'medium' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
              recipe.difficulty === 'hard' && 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            )}
          >
            {recipe.difficulty}
          </span>
        )}
      </div>

      {/* Dietary badges */}
      {dietaryBadges.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {dietaryBadges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
            >
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Description */}
      {recipe.description && (
        <p className="text-muted-foreground mb-6">{recipe.description}</p>
      )}

      {/* Servings scaler and Add to Plan */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-4 border-b">
        <ServingScaler
          servings={currentServings}
          originalServings={recipe.servings}
          onServingsChange={setServings}
        />
        <AddToPlanButton recipeId={recipe.id} />
      </div>

      {/* Ingredients section */}
      <IngredientList
        ingredients={recipe.ingredients || []}
        scaleFactor={scaleFactor}
        className="mb-8"
      />

      {/* Instructions section */}
      <InstructionSteps instructions={recipe.instructions} className="mb-8" />

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
  );
}
