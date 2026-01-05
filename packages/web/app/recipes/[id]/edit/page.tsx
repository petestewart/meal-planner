'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecipeForm } from '@/components/recipes';
import { useRecipe } from '@/lib/queries';

/**
 * Loading skeleton for the edit page
 */
function EditRecipeSkeleton() {
  return (
    <div className="container mx-auto max-w-3xl p-6">
      <div className="flex items-center gap-4 mb-6">
        <div className="h-9 w-20 bg-muted rounded animate-pulse" />
        <div className="flex-1">
          <div className="h-7 w-48 bg-muted rounded animate-pulse mb-2" />
          <div className="h-5 w-72 bg-muted rounded animate-pulse" />
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Info Card skeleton */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="h-6 w-40 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
          <div className="space-y-4 pt-4">
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
            <div className="h-24 w-full bg-muted rounded animate-pulse" />
            <div className="grid grid-cols-4 gap-4">
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
              <div className="h-10 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Ingredients Card skeleton */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
          </div>
        </div>

        {/* Instructions Card skeleton */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-16 w-full bg-muted rounded animate-pulse" />
            <div className="h-16 w-full bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Not found state for edit page
 */
function RecipeNotFound() {
  return (
    <div className="container mx-auto max-w-3xl p-6">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ChefHat className="h-16 w-16 text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Recipe Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The recipe you're trying to edit doesn't exist or has been deleted.
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
 * Edit Recipe Page
 * Allows users to edit an existing recipe
 */
export default function EditRecipePage() {
  const params = useParams();
  const recipeId = params.id as string;

  const { data: recipe, isLoading, error } = useRecipe(recipeId);

  // Handle loading state
  if (isLoading) {
    return <EditRecipeSkeleton />;
  }

  // Handle error/not found
  if (error || !recipe) {
    return <RecipeNotFound />;
  }

  return (
    <div className="container mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" asChild>
          <Link href={`/recipes/${recipeId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Edit Recipe</h1>
          <p className="text-muted-foreground">
            Make changes to "{recipe.title}"
          </p>
        </div>
      </div>

      {/* Recipe Form */}
      <RecipeForm mode="edit" recipe={recipe} />
    </div>
  );
}
