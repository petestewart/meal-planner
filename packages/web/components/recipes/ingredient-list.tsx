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
    <li
      className={cn(
        'group flex items-center gap-4 py-3 px-4 -mx-4 rounded-lg transition-colors cursor-pointer',
        'hover:bg-muted/50',
        checked && 'bg-muted/30'
      )}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200',
          checked
            ? 'border-primary bg-primary text-primary-foreground scale-100'
            : 'border-muted-foreground/40 hover:border-primary group-hover:border-primary/60 scale-95 hover:scale-100'
        )}
        aria-label={checked ? 'Mark as not used' : 'Mark as used'}
      >
        <Check className={cn(
          'h-3.5 w-3.5 transition-all duration-200',
          checked ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        )} />
      </button>

      <div className={cn(
        'flex-1 flex items-baseline gap-2 transition-opacity duration-200',
        checked && 'opacity-60'
      )}>
        {/* Quantity and unit */}
        {(scaledQuantity !== null || ingredient.unit) && (
          <span className={cn(
            'font-mono text-sm font-semibold text-primary shrink-0',
            checked && 'line-through decoration-muted-foreground/50'
          )}>
            {scaledQuantity !== null && formatQuantity(scaledQuantity)}
            {ingredient.unit && ` ${ingredient.unit}`}
          </span>
        )}

        {/* Ingredient name */}
        <span className={cn(
          'flex-1',
          checked && 'line-through decoration-muted-foreground/50'
        )}>
          {name}
          {ingredient.notes && name !== ingredient.notes && (
            <span className="text-muted-foreground text-sm"> ({ingredient.notes})</span>
          )}
        </span>

        {/* Optional badge */}
        {ingredient.optional && (
          <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            optional
          </span>
        )}
      </div>
    </li>
  );
}

/**
 * Ingredient list component with quantities and checkboxes
 * Supports scaling based on servings adjustment
 * Features:
 * - Interactive checkbox items with hover states
 * - Visual feedback when ingredients are checked off
 * - Accessible keyboard navigation
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

  const checkedCount = checkedIds.size;
  const totalCount = ingredients?.length || 0;

  if (!ingredients || ingredients.length === 0) {
    return (
      <div className={cn('text-muted-foreground italic', className)}>
        No ingredients listed.
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl font-semibold">
          Ingredients
        </h2>
        {checkedCount > 0 && (
          <span className="text-sm text-muted-foreground">
            {checkedCount} of {totalCount} checked
          </span>
        )}
      </div>
      <ul className="space-y-1">
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
