'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecipeIngredient, Ingredient } from '@/types/api';

interface IngredientListProps {
  ingredients: RecipeIngredient[];
  /** Map of ingredient IDs to their details (name, category) */
  ingredientDetails?: Map<string, Ingredient>;
  scaleFactor?: number;
  className?: string;
}

/**
 * Format a quantity for display
 * Handles fractions and decimal formatting
 */
function formatQuantity(quantity: number): string {
  // Handle common fractions
  const fractionMap: Record<number, string> = {
    0.125: '1/8',
    0.25: '1/4',
    0.333: '1/3',
    0.375: '3/8',
    0.5: '1/2',
    0.625: '5/8',
    0.666: '2/3',
    0.75: '3/4',
    0.875: '7/8',
  };

  // Check if it's a whole number
  if (Number.isInteger(quantity)) {
    return quantity.toString();
  }

  // Check if close to a common fraction
  const roundedTwoDecimals = Math.round(quantity * 1000) / 1000;
  for (const [decimal, fraction] of Object.entries(fractionMap)) {
    if (Math.abs(roundedTwoDecimals - parseFloat(decimal)) < 0.02) {
      return fraction;
    }
  }

  // Check for mixed numbers (e.g., 1.5 = 1 1/2)
  const whole = Math.floor(quantity);
  const remainder = quantity - whole;
  if (whole > 0) {
    for (const [decimal, fraction] of Object.entries(fractionMap)) {
      if (Math.abs(remainder - parseFloat(decimal)) < 0.02) {
        return `${whole} ${fraction}`;
      }
    }
  }

  // Default to 2 decimal places if needed
  const formatted = quantity.toFixed(2);
  // Remove trailing zeros
  return parseFloat(formatted).toString();
}

/**
 * Get the display name for an ingredient
 */
function getIngredientName(
  ingredient: RecipeIngredient,
  details?: Map<string, Ingredient>
): string {
  // First try to get from the details map
  if (details && details.has(ingredient.ingredientId)) {
    return details.get(ingredient.ingredientId)!.name;
  }

  // Fall back to notes if available (often contains preparation instructions that hint at ingredient)
  if (ingredient.notes) {
    return ingredient.notes;
  }

  // Last resort: show truncated ID (this shouldn't happen in production)
  // TODO: API should return ingredient names with recipe
  return `Ingredient`;
}

interface IngredientItemProps {
  ingredient: RecipeIngredient;
  ingredientDetails?: Map<string, Ingredient>;
  scaleFactor: number;
  checked: boolean;
  onToggle: () => void;
}

function IngredientItem({
  ingredient,
  ingredientDetails,
  scaleFactor,
  checked,
  onToggle,
}: IngredientItemProps) {
  const name = getIngredientName(ingredient, ingredientDetails);
  const scaledQuantity = ingredient.quantity
    ? ingredient.quantity * scaleFactor
    : null;

  return (
    <li className="flex items-start gap-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/30 hover:border-primary'
        )}
        aria-label={checked ? 'Mark as not used' : 'Mark as used'}
      >
        {checked && <Check className="h-3 w-3" />}
      </button>
      <span className={cn('flex-1', checked && 'text-muted-foreground line-through')}>
        {scaledQuantity !== null && (
          <span className="font-medium">{formatQuantity(scaledQuantity)}</span>
        )}
        {ingredient.unit && (
          <span className="font-medium"> {ingredient.unit}</span>
        )}
        {(scaledQuantity !== null || ingredient.unit) && ' '}
        <span>{name}</span>
        {ingredient.notes && name !== ingredient.notes && (
          <span className="text-muted-foreground"> ({ingredient.notes})</span>
        )}
        {ingredient.optional && (
          <span className="ml-1 text-xs text-muted-foreground">(optional)</span>
        )}
      </span>
    </li>
  );
}

/**
 * Ingredient list component with quantities and checkboxes
 * Supports scaling based on servings adjustment
 */
export function IngredientList({
  ingredients,
  ingredientDetails,
  scaleFactor = 1,
  className,
}: IngredientListProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleIngredient = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (!ingredients || ingredients.length === 0) {
    return (
      <div className={cn('text-muted-foreground italic', className)}>
        No ingredients listed.
      </div>
    );
  }

  return (
    <div className={className}>
      <h2 className="mb-3 text-lg font-semibold uppercase tracking-wide">
        Ingredients
      </h2>
      <div className="border-t border-border" />
      <ul className="divide-y divide-border/50">
        {ingredients.map((ingredient) => (
          <IngredientItem
            key={ingredient.id}
            ingredient={ingredient}
            ingredientDetails={ingredientDetails}
            scaleFactor={scaleFactor}
            checked={checkedIds.has(ingredient.id)}
            onToggle={() => toggleIngredient(ingredient.id)}
          />
        ))}
      </ul>
    </div>
  );
}
