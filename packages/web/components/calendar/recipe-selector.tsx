'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Utensils,
  SkipForward,
  UtensilsCrossed,
  Clock,
  Star,
  Minus,
  Plus,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRecipes } from '@/lib/queries';
import { RecipeWithRelations, MealType, DayOfWeek, SlotType } from '@/types/api';
import { cn } from '@/lib/utils';

// Day names for display
const DAY_NAMES: Record<DayOfWeek, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

// Meal type display names
const MEAL_TYPE_NAMES: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
};

interface RecipeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (selection: RecipeSelection) => void;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  defaultServings?: number;
}

export interface RecipeSelection {
  recipeId: string | null;
  servings: number;
  slotType: SlotType;
}

interface SpecialOption {
  id: SlotType;
  label: string;
  icon: React.ReactNode;
}

const SPECIAL_OPTIONS: SpecialOption[] = [
  { id: 'dining_out', label: 'Dining Out', icon: <Utensils className="h-4 w-4" /> },
  { id: 'skip', label: 'Skip', icon: <SkipForward className="h-4 w-4" /> },
  { id: 'leftovers', label: 'Leftovers', icon: <UtensilsCrossed className="h-4 w-4" /> },
];

/**
 * Recipe Selector Modal
 * Allows users to select a recipe for a specific meal slot.
 * Features: search, filters, favorites at top, servings selector.
 */
export function RecipeSelector({
  open,
  onOpenChange,
  onSelect,
  dayOfWeek,
  mealType,
  defaultServings = 2,
}: RecipeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithRelations | null>(null);
  const [selectedSlotType, setSelectedSlotType] = useState<SlotType | null>(null);
  const [servings, setServings] = useState(defaultServings);

  // Fetch all recipes
  const { data: recipesData, isLoading: isLoadingRecipes } = useRecipes(
    { limit: 100 },
    { enabled: open }
  );

  // Filter and sort recipes
  const { favorites, otherRecipes } = useMemo(() => {
    if (!recipesData?.recipes) {
      return { favorites: [], otherRecipes: [] };
    }

    const filtered = recipesData.recipes.filter((recipe) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        recipe.title.toLowerCase().includes(query) ||
        recipe.cuisine?.toLowerCase().includes(query) ||
        recipe.description?.toLowerCase().includes(query)
      );
    });

    const favs = filtered.filter((r) => r.isFavorite);
    const others = filtered.filter((r) => !r.isFavorite);

    return { favorites: favs, otherRecipes: others };
  }, [recipesData?.recipes, searchQuery]);

  // Handle recipe selection
  const handleRecipeClick = useCallback((recipe: RecipeWithRelations) => {
    setSelectedRecipe(recipe);
    setSelectedSlotType(null);
    setServings(recipe.servings || defaultServings);
  }, [defaultServings]);

  // Handle special option selection
  const handleSpecialOptionClick = useCallback((slotType: SlotType) => {
    setSelectedSlotType(slotType);
    setSelectedRecipe(null);
  }, []);

  // Handle confirm
  const handleConfirm = useCallback(() => {
    if (selectedRecipe) {
      onSelect({
        recipeId: selectedRecipe.id,
        servings,
        slotType: 'recipe',
      });
    } else if (selectedSlotType) {
      onSelect({
        recipeId: null,
        servings: defaultServings,
        slotType: selectedSlotType,
      });
    }
    // Reset state after selection
    setSearchQuery('');
    setSelectedRecipe(null);
    setSelectedSlotType(null);
    setServings(defaultServings);
  }, [selectedRecipe, selectedSlotType, servings, defaultServings, onSelect]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSearchQuery('');
    setSelectedRecipe(null);
    setSelectedSlotType(null);
    setServings(defaultServings);
    onOpenChange(false);
  }, [defaultServings, onOpenChange]);

  // Handle open change (reset state when closing)
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      setSearchQuery('');
      setSelectedRecipe(null);
      setSelectedSlotType(null);
      setServings(defaultServings);
    }
    onOpenChange(newOpen);
  }, [defaultServings, onOpenChange]);

  // Servings controls
  const decrementServings = useCallback(() => {
    setServings((prev) => Math.max(1, prev - 1));
  }, []);

  const incrementServings = useCallback(() => {
    setServings((prev) => Math.min(20, prev + 1));
  }, []);

  const isConfirmDisabled = !selectedRecipe && !selectedSlotType;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl sm:max-h-[85vh] h-[100dvh] sm:h-auto flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            Select Recipe for {DAY_NAMES[dayOfWeek]} {MEAL_TYPE_NAMES[mealType]}
          </DialogTitle>
          <DialogDescription>
            Choose a recipe or select a special option for this meal slot.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Special Options */}
        <div className="flex gap-2 flex-wrap">
          {SPECIAL_OPTIONS.map((option) => (
            <Button
              key={option.id}
              variant={selectedSlotType === option.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSpecialOptionClick(option.id)}
              className="gap-2"
            >
              {option.icon}
              {option.label}
            </Button>
          ))}
        </div>

        {/* Recipe List */}
        <ScrollArea className="flex-1 min-h-0 border rounded-md">
          <div className="p-2">
            {isLoadingRecipes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Favorites Section */}
                {favorites.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 px-2">
                      FAVORITES
                    </h4>
                    <div className="space-y-1">
                      {favorites.map((recipe) => (
                        <RecipeListItem
                          key={recipe.id}
                          recipe={recipe}
                          isSelected={selectedRecipe?.id === recipe.id}
                          onClick={() => handleRecipeClick(recipe)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* All Recipes Section */}
                {otherRecipes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 px-2">
                      {favorites.length > 0 ? 'ALL RECIPES' : 'RECIPES'}
                    </h4>
                    <div className="space-y-1">
                      {otherRecipes.map((recipe) => (
                        <RecipeListItem
                          key={recipe.id}
                          recipe={recipe}
                          isSelected={selectedRecipe?.id === recipe.id}
                          onClick={() => handleRecipeClick(recipe)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {favorites.length === 0 && otherRecipes.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery
                      ? 'No recipes found matching your search.'
                      : 'No recipes available. Add some recipes first!'}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer with Servings and Actions */}
        <DialogFooter className="flex-col sm:flex-row gap-4 sm:gap-2">
          {/* Servings Selector - only show when a recipe is selected */}
          {selectedRecipe && (
            <div className="flex items-center gap-2 mr-auto">
              <span className="text-sm font-medium">Servings:</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={decrementServings}
                  disabled={servings <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="w-8 text-center font-medium">{servings}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={incrementServings}
                  disabled={servings >= 20}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isConfirmDisabled}
            >
              Confirm
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Recipe list item component
interface RecipeListItemProps {
  recipe: RecipeWithRelations;
  isSelected: boolean;
  onClick: () => void;
}

function RecipeListItem({ recipe, isSelected, onClick }: RecipeListItemProps) {
  const totalTime =
    (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{recipe.title}</span>
          {recipe.isFavorite && (
            <Star
              className={cn(
                'h-3 w-3 flex-shrink-0',
                isSelected
                  ? 'fill-primary-foreground text-primary-foreground'
                  : 'fill-yellow-400 text-yellow-400'
              )}
            />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs mt-0.5">
          {totalTime > 0 && (
            <span
              className={cn(
                'flex items-center gap-1',
                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}
            >
              <Clock className="h-3 w-3" />
              {totalTime}m
            </span>
          )}
          {recipe.cuisine && (
            <span
              className={cn(
                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
              )}
            >
              {recipe.cuisine}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
