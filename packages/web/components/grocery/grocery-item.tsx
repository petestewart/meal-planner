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
    if (!recipesData?.recipes || !item.recipeIds || item.recipeIds.length === 0) return [];
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
        'flex items-center gap-4 rounded-lg border p-4 transition-all duration-200',
        isChecked && 'bg-muted/40 opacity-75',
        !isChecked && 'hover:border-primary/30 hover:shadow-sm',
        className
      )}
    >
      {/* Tri-state checkbox - 44px minimum touch target for mobile */}
      <button
        type="button"
        onClick={handleStatusToggle}
        disabled={updateItem.isPending}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 touch-manipulation',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'active:scale-90',
          isChecked && 'border-success bg-success text-success-foreground scale-100',
          isPartial && 'border-warning bg-warning/20 text-warning-foreground',
          !isChecked && !isPartial && 'border-muted-foreground/30 bg-background hover:border-primary hover:bg-primary/5'
        )}
        aria-label={`Mark ${item.name} as ${getNextStatus(item.status).replace(/_/g, ' ')}`}
      >
        {isChecked && <Check className="h-6 w-6 animate-in zoom-in-50 duration-200" />}
        {isPartial && <Minus className="h-6 w-6" />}
      </button>

      {/* Item content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          {/* Item name - prominent */}
          <span
            className={cn(
              'text-base font-medium leading-tight',
              isChecked && 'text-muted-foreground line-through decoration-2'
            )}
          >
            {item.name}
          </span>

          {/* Quantity - secondary styling */}
          <span
            className={cn(
              'shrink-0 rounded-md bg-muted/50 px-2 py-0.5 font-mono text-sm tabular-nums',
              isChecked ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {formatQuantity(item.quantity, item.unit)}
          </span>
        </div>

        {/* Source recipes */}
        {recipeNames.length > 0 && (
          <p className="mt-1.5 text-sm text-muted-foreground">
            For: {recipeNames.join(', ')}
          </p>
        )}

        {/* Partial quantity indicator */}
        {isPartial && item.haveQuantity !== null && (
          <p className="mt-1.5 text-sm font-medium text-warning-foreground">
            Have {formatQuantity(item.haveQuantity, item.unit)} / Need{' '}
            {formatQuantity(needQuantity, item.unit)} more
          </p>
        )}
      </div>
    </div>
  );
}
