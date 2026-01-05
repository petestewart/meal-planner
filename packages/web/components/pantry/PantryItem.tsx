'use client';

import * as React from 'react';
import { Pencil, Trash2, Minus, ChefHat, Star, MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRemovePantryItem, useUsePantryItem } from '@/lib/queries';
import type { PantryItemWithIngredient } from '@/types/api';

interface PantryItemProps {
  item: PantryItemWithIngredient;
  onEdit: (item: PantryItemWithIngredient) => void;
  className?: string;
}

/**
 * Format quantity with unit for display
 */
function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '';
  const unitStr = unit ? ` ${unit}` : '';
  if (quantity === 0.5) return `1/2${unitStr}`;
  if (quantity === 0.25) return `1/4${unitStr}`;
  if (quantity === 0.75) return `3/4${unitStr}`;
  if (quantity === 0.33 || quantity === 0.333) return `1/3${unitStr}`;
  if (quantity === 0.67 || quantity === 0.666) return `2/3${unitStr}`;
  const numStr = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(1);
  return `${numStr}${unitStr}`;
}

/**
 * Get location display info
 */
function getLocationInfo(location: string | null): { label: string; color: string } {
  switch (location) {
    case 'fridge':
      return { label: 'Fridge', color: 'text-blue-600 dark:text-blue-400' };
    case 'freezer':
      return { label: 'Freezer', color: 'text-cyan-600 dark:text-cyan-400' };
    case 'pantry':
      return { label: 'Pantry', color: 'text-amber-600 dark:text-amber-400' };
    default:
      return { label: '', color: '' };
  }
}

/**
 * Check if date is within days from now
 */
function isExpiringSoon(expiresAt: string | null, days: number = 7): boolean {
  if (!expiresAt) return false;
  const expDate = new Date(expiresAt);
  const now = new Date();
  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays <= days && diffDays >= 0;
}

/**
 * Check if date is expired
 */
function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const expDate = new Date(expiresAt);
  const now = new Date();
  return expDate < now;
}

/**
 * Format expiration date
 */
function formatExpirationDate(expiresAt: string | null): string {
  if (!expiresAt) return '';
  const date = new Date(expiresAt);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Individual pantry item display with edit/delete actions
 */
export function PantryItem({ item, onEdit, className }: PantryItemProps) {
  const removeItem = useRemovePantryItem();
  const useItem = useUsePantryItem();

  const handleRemove = () => {
    if (confirm(`Remove "${item.ingredientName}" from pantry?`)) {
      removeItem.mutate(item.ingredientName);
    }
  };

  const handleUse = () => {
    // Decrement by 1 (or remove if quantity is 1 or less)
    if (item.quantity !== null && item.quantity <= 1) {
      handleRemove();
    } else {
      useItem.mutate({ ingredientName: item.ingredientName, quantity: 1 });
    }
  };

  const locationInfo = getLocationInfo(item.location);
  const expiringSoon = isExpiringSoon(item.expiresAt);
  const expired = isExpired(item.expiresAt);
  const isPending = removeItem.isPending || useItem.isPending;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border p-3 transition-colors',
        expired && 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/20',
        expiringSoon && !expired && 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20',
        className
      )}
    >
      {/* Item content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          {/* Item name with badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium leading-tight">{item.ingredientName}</span>
            {item.isPrepared && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <ChefHat className="h-3 w-3" />
                Prepared
              </Badge>
            )}
            {item.isStaple && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Star className="h-3 w-3" />
                Staple
              </Badge>
            )}
          </div>

          {/* Quantity */}
          <span className="shrink-0 text-sm tabular-nums font-medium">
            {formatQuantity(item.quantity, item.unit)}
          </span>
        </div>

        {/* Meta info row */}
        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {item.location && (
            <span className={cn('flex items-center gap-1', locationInfo.color)}>
              <MapPin className="h-3 w-3" />
              {locationInfo.label}
            </span>
          )}
          {item.expiresAt && (
            <span
              className={cn(
                'flex items-center gap-1',
                expired && 'font-medium text-red-600 dark:text-red-400',
                expiringSoon && !expired && 'font-medium text-amber-600 dark:text-amber-400'
              )}
            >
              <Clock className="h-3 w-3" />
              {expired ? 'Expired ' : expiringSoon ? 'Expires ' : 'Exp '}
              {formatExpirationDate(item.expiresAt)}
            </span>
          )}
          {item.ingredientCategory && (
            <span className="text-xs">{item.ingredientCategory}</span>
          )}
        </div>

        {/* Preparation notes */}
        {item.isPrepared && item.preparationNotes && (
          <p className="mt-1 text-sm text-muted-foreground italic">
            {item.preparationNotes}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        {item.quantity !== null && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 sm:h-9 sm:w-9 touch-manipulation"
            onClick={handleUse}
            disabled={isPending}
            title="Use 1"
          >
            <Minus className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-9 sm:w-9 touch-manipulation"
          onClick={() => onEdit(item)}
          disabled={isPending}
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 sm:h-9 sm:w-9 text-destructive hover:text-destructive touch-manipulation"
          onClick={handleRemove}
          disabled={isPending}
          title="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
