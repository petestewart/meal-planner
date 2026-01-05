'use client';

import { useState } from 'react';
import { Clock, Users, ChefHat } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RecipeWithRelations } from '@/types/api';

interface RecipePreviewProps {
  recipe: RecipeWithRelations;
  onSave: (updates: RecipePreviewUpdates) => void;
  onCancel: () => void;
  isSaving?: boolean;
  className?: string;
}

export interface RecipePreviewUpdates {
  title: string;
  description: string | null;
  servings: number;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  cuisine: string | null;
}

/**
 * Editable preview of an imported recipe
 * Allows users to fix parsing errors before saving
 */
export function RecipePreview({
  recipe,
  onSave,
  onCancel,
  isSaving = false,
  className,
}: RecipePreviewProps) {
  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description || '');
  const [servings, setServings] = useState(recipe.servings);
  const [prepTime, setPrepTime] = useState(recipe.prepTimeMinutes || 0);
  const [cookTime, setCookTime] = useState(recipe.cookTimeMinutes || 0);
  const [cuisine, setCuisine] = useState(recipe.cuisine || '');

  const handleSave = () => {
    onSave({
      title,
      description: description || null,
      servings,
      prepTimeMinutes: prepTime || null,
      cookTimeMinutes: cookTime || null,
      cuisine: cuisine || null,
    });
  };

  const totalTime = prepTime + cookTime;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Editable fields section */}
      <div className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1.5">
            Recipe Title
          </label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Recipe title"
            className="text-lg font-semibold"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium mb-1.5">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the recipe"
            rows={3}
            className={cn(
              'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        </div>

        {/* Time and servings row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label htmlFor="servings" className="block text-sm font-medium mb-1.5">
              <Users className="inline h-4 w-4 mr-1" />
              Servings
            </label>
            <Input
              id="servings"
              type="number"
              min={1}
              value={servings}
              onChange={(e) => setServings(parseInt(e.target.value) || 1)}
            />
          </div>

          <div>
            <label htmlFor="prepTime" className="block text-sm font-medium mb-1.5">
              <Clock className="inline h-4 w-4 mr-1" />
              Prep (min)
            </label>
            <Input
              id="prepTime"
              type="number"
              min={0}
              value={prepTime}
              onChange={(e) => setPrepTime(parseInt(e.target.value) || 0)}
            />
          </div>

          <div>
            <label htmlFor="cookTime" className="block text-sm font-medium mb-1.5">
              <Clock className="inline h-4 w-4 mr-1" />
              Cook (min)
            </label>
            <Input
              id="cookTime"
              type="number"
              min={0}
              value={cookTime}
              onChange={(e) => setCookTime(parseInt(e.target.value) || 0)}
            />
          </div>

          <div>
            <label htmlFor="cuisine" className="block text-sm font-medium mb-1.5">
              <ChefHat className="inline h-4 w-4 mr-1" />
              Cuisine
            </label>
            <Input
              id="cuisine"
              value={cuisine}
              onChange={(e) => setCuisine(e.target.value)}
              placeholder="e.g., Italian"
            />
          </div>
        </div>

        {totalTime > 0 && (
          <p className="text-sm text-muted-foreground">
            Total time: {totalTime} minutes
          </p>
        )}
      </div>

      {/* Read-only sections */}
      <div className="space-y-4 border-t pt-4">
        {/* Ingredients preview */}
        <div>
          <h3 className="text-sm font-medium mb-2">Ingredients</h3>
          {recipe.ingredients && recipe.ingredients.length > 0 ? (
            <ul className="text-sm text-muted-foreground space-y-1 max-h-48 overflow-y-auto">
              {recipe.ingredients.map((ing, index) => (
                <li key={ing.id || index} className="flex gap-2">
                  <span className="text-muted-foreground/50">-</span>
                  <span>
                    {ing.quantity && `${ing.quantity} `}
                    {ing.unit && `${ing.unit} `}
                    {ing.notes || 'Ingredient'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No ingredients parsed. You can add them after saving.
            </p>
          )}
        </div>

        {/* Instructions preview */}
        <div>
          <h3 className="text-sm font-medium mb-2">Instructions</h3>
          {recipe.instructions ? (
            <div className="text-sm text-muted-foreground max-h-48 overflow-y-auto whitespace-pre-wrap">
              {recipe.instructions}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No instructions parsed. You can add them after saving.
            </p>
          )}
        </div>
      </div>

      {/* Source URL */}
      {recipe.sourceUrl && (
        <div className="text-sm text-muted-foreground border-t pt-4">
          Source:{' '}
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {new URL(recipe.sourceUrl).hostname}
          </a>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <Button
          onClick={handleSave}
          disabled={!title.trim() || isSaving}
          className="flex-1 sm:flex-none"
        >
          {isSaving ? 'Saving...' : 'Save Recipe'}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 sm:flex-none"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
