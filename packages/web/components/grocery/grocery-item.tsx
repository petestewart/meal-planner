'use client';

import * as React from 'react';
import { Check, Minus, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GroceryItem as GroceryItemType, GroceryItemStatus } from '@/types/api';
import { useUpdateGroceryItem } from '@/lib/queries';
import { useRecipes } from '@/lib/queries';

interface GroceryItemProps {
  item: GroceryItemType;
  week: string;
  className?: string;
}

/**
 * Get the next status in the cycle: need_to_buy -> already_have -> partial -> need_to_buy
 */
function getNextStatus(current: GroceryItemStatus): GroceryItemStatus {
  switch (current) {
    case 'need_to_buy':
      return 'already_have';
    case 'already_have':
      return 'partial';
    case 'partial':
      return 'need_to_buy';
    default:
      return 'need_to_buy';
  }
}

/**
 * Format quantity with unit for display
 */
function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '';
  const unitStr = unit ? ` ${unit}` : '';
  // Format decimal nicely (e.g., 0.5 -> 1/2, 0.25 -> 1/4)
  if (quantity === 0.5) return `1/2${unitStr}`;
  if (quantity === 0.25) return `1/4${unitStr}`;
  if (quantity === 0.75) return `3/4${unitStr}`;
  if (quantity === 0.33 || quantity === 0.333) return `1/3${unitStr}`;
  if (quantity === 0.67 || quantity === 0.666) return `2/3${unitStr}`;
  // Otherwise just show the number
  const numStr = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(1);
  return `${numStr}${unitStr}`;
}

/**
 * Individual grocery list item with tri-state checkbox
 * States: need_to_buy (unchecked), already_have (checked), partial (indeterminate)
 */
export function GroceryItem({ item, week, className }: GroceryItemProps) {
  const updateItem = useUpdateGroceryItem();
  const { data: recipesData } = useRecipes({}, { staleTime: 5 * 60 * 1000 });

  const handleStatusToggle = () => {
    const nextStatus = getNextStatus(item.status);
    updateItem.mutate({
      week,
      itemId: item.id,
      input: {
        status: nextStatus,
        // Reset haveQuantity when cycling to need_to_buy
        haveQuantity: nextStatus === 'need_to_buy' ? null : item.haveQuantity,
      },
    });
  };

  // Get recipe titles for this item
  const recipeNames = React.useMemo(() => {
    if (!recipesData?.recipes || item.recipeIds.length === 0) return [];
    return item.recipeIds
      .map((id) => recipesData.recipes.find((r) => r.id === id)?.title)
      .filter(Boolean) as string[];
  }, [recipesData?.recipes, item.recipeIds]);

  const isChecked = item.status === 'already_have';
  const isPartial = item.status === 'partial';
  const needQuantity = item.quantity !== null && item.haveQuantity !== null
    ? item.quantity - item.haveQuantity
    : item.quantity;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        isChecked && 'bg-muted/50',
        className
      )}
    >
      {/* Tri-state checkbox */}
      <button
        type="button"
        onClick={handleStatusToggle}
        disabled={updateItem.isPending}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          isChecked && 'border-primary bg-primary text-primary-foreground',
          isPartial && 'border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          !isChecked && !isPartial && 'border-input bg-background hover:border-primary/50'
        )}
        aria-label={`Mark ${item.name} as ${getNextStatus(item.status).replace(/_/g, ' ')}`}
      >
        {isChecked && <Check className="h-4 w-4" />}
        {isPartial && <Minus className="h-4 w-4" />}
        {!isChecked && !isPartial && <Square className="h-3 w-3 opacity-0" />}
      </button>

      {/* Item content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          {/* Item name */}
          <span
            className={cn(
              'font-medium leading-tight',
              isChecked && 'text-muted-foreground line-through'
            )}
          >
            {item.name}
          </span>

          {/* Quantity */}
          <span
            className={cn(
              'shrink-0 text-sm tabular-nums',
              isChecked ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {formatQuantity(item.quantity, item.unit)}
          </span>
        </div>

        {/* Source recipes */}
        {recipeNames.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            For: {recipeNames.join(', ')}
          </p>
        )}

        {/* Partial quantity indicator */}
        {isPartial && item.haveQuantity !== null && (
          <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
            Have {formatQuantity(item.haveQuantity, item.unit)} / Need{' '}
            {formatQuantity(needQuantity, item.unit)} more
          </p>
        )}
      </div>
    </div>
  );
}
