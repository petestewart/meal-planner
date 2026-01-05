'use client';

import * as React from 'react';
import { Package, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CheckPantryResponse, GroceryItem } from '@/types/api';
import { cn } from '@/lib/utils';

interface CheckPantryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  result: CheckPantryResponse | null;
  onCheck: () => void;
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
 * Render a single updated item in the results list
 */
function UpdatedItemRow({ item }: { item: GroceryItem }) {
  const isPartial = item.status === 'partial';
  const isAlreadyHave = item.status === 'already_have';

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-3',
        isAlreadyHave && 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900',
        isPartial && 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded-full',
            isAlreadyHave && 'bg-green-600 text-white',
            isPartial && 'bg-amber-500 text-white'
          )}
        >
          <Check className="h-3 w-3" />
        </div>
        <div>
          <span className="font-medium">{item.name}</span>
          {item.quantity !== null && (
            <span className="ml-2 text-sm text-muted-foreground">
              ({formatQuantity(item.quantity, item.unit)})
            </span>
          )}
        </div>
      </div>
      <Badge
        variant="secondary"
        className={cn(
          isAlreadyHave && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
          isPartial && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300'
        )}
      >
        {isAlreadyHave ? 'Have It' : 'Partial'}
      </Badge>
    </div>
  );
}

/**
 * Dialog for checking pantry items against the grocery list.
 * Shows results after the check-pantry mutation completes.
 */
export function CheckPantryDialog({
  open,
  onOpenChange,
  isPending,
  isError,
  errorMessage,
  result,
  onCheck,
}: CheckPantryDialogProps) {
  // Initial state - prompt to check
  const showPrompt = !isPending && !isError && !result;
  // Loading state
  const showLoading = isPending;
  // Results state
  const showResults = !isPending && !isError && result;
  // Error state
  const showError = !isPending && isError;

  const hasUpdates = result && result.checkedCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Check Pantry
          </DialogTitle>
          <DialogDescription>
            {showPrompt && 'Check your pantry to automatically mark items you already have.'}
            {showLoading && 'Checking your pantry...'}
            {showResults && (hasUpdates
              ? `Found ${result.checkedCount} item${result.checkedCount === 1 ? '' : 's'} in your pantry.`
              : 'No matching items found in your pantry.')}
            {showError && 'Failed to check pantry.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Loading state */}
          {showLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                Comparing grocery list with pantry...
              </p>
            </div>
          )}

          {/* Prompt state */}
          {showPrompt && (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                We will check your grocery list against your pantry and automatically mark any items you already have.
              </p>
            </div>
          )}

          {/* Results state */}
          {showResults && (
            <div className="space-y-3">
              {hasUpdates ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    The following items have been marked based on your pantry:
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {result.updatedItems.map((item) => (
                      <UpdatedItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    None of the items on your grocery list match what is in your pantry.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error state */}
          {showError && (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <AlertCircle className="h-12 w-12 text-destructive/50" />
              <p className="mt-4 text-sm text-destructive">
                {errorMessage || 'An error occurred while checking your pantry.'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {showPrompt && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onCheck}>
                <Package className="mr-2 h-4 w-4" />
                Check Pantry
              </Button>
            </>
          )}
          {showLoading && (
            <Button variant="outline" disabled>
              Checking...
            </Button>
          )}
          {(showResults || showError) && (
            <Button onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
