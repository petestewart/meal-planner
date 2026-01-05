'use client';

import * as React from 'react';
import { Check, ChevronDown, ChevronUp, X, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GroceryItem as GroceryItemType, GroceryItemStatus } from '@/types/api';
import { useUpdateGroceryItem } from '@/lib/queries';
import { cn } from '@/lib/utils';

// ==================== Shopping Mode Item ====================

interface ShoppingItemProps {
  item: GroceryItemType;
  week: string;
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
 * Shopping mode item with large touch target and simple check/uncheck
 * Optimized for in-store use on mobile devices
 */
export function ShoppingItem({ item, week }: ShoppingItemProps) {
  const updateItem = useUpdateGroceryItem();

  const handleToggle = () => {
    // Simple toggle between need_to_buy and already_have
    const nextStatus: GroceryItemStatus =
      item.status === 'already_have' ? 'need_to_buy' : 'already_have';

    updateItem.mutate({
      week,
      itemId: item.id,
      input: {
        status: nextStatus,
        haveQuantity: nextStatus === 'need_to_buy' ? null : item.quantity,
      },
    });
  };

  const isChecked = item.status === 'already_have';

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={updateItem.isPending}
      className={cn(
        // Large touch target (minimum 44px, using 56px for comfort)
        'flex w-full items-center gap-4 rounded-xl p-4 min-h-[56px]',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'active:scale-[0.98]',
        isChecked
          ? 'bg-muted/80 border-2 border-transparent'
          : 'bg-card border-2 border-border shadow-sm hover:border-primary/30'
      )}
      aria-label={`${isChecked ? 'Uncheck' : 'Check'} ${item.name}`}
    >
      {/* Large checkbox */}
      <div
        className={cn(
          // Large checkbox for easy touch (28px)
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 transition-colors',
          isChecked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-background'
        )}
      >
        {isChecked && <Check className="h-5 w-5" strokeWidth={3} />}
      </div>

      {/* Item content */}
      <div className="flex-1 text-left">
        <span
          className={cn(
            'text-lg font-medium leading-tight',
            isChecked && 'text-muted-foreground line-through'
          )}
        >
          {item.name}
        </span>
      </div>

      {/* Quantity */}
      {item.quantity !== null && (
        <span
          className={cn(
            'shrink-0 text-base font-medium tabular-nums',
            isChecked ? 'text-muted-foreground' : 'text-foreground'
          )}
        >
          {formatQuantity(item.quantity, item.unit)}
        </span>
      )}
    </button>
  );
}

// ==================== Shopping Mode Category ====================

interface ShoppingCategoryProps {
  category: string;
  items: GroceryItemType[];
  week: string;
  defaultOpen?: boolean;
}

/**
 * Get display name for category
 */
function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    produce: 'Produce',
    dairy: 'Dairy',
    proteins: 'Proteins',
    meat: 'Proteins',
    seafood: 'Seafood',
    bakery: 'Bakery',
    frozen: 'Frozen',
    pantry: 'Pantry',
    canned: 'Canned',
    condiments: 'Condiments',
    spices: 'Spices',
    beverages: 'Beverages',
    snacks: 'Snacks',
    grains: 'Grains',
    pasta: 'Pasta',
    oils: 'Oils',
    other: 'Other',
  };

  const lower = category.toLowerCase();
  return categoryMap[lower] || category;
}

/**
 * Collapsible category section for shopping mode
 * Large header for easy tap to collapse/expand
 */
export function ShoppingCategory({
  category,
  items,
  week,
  defaultOpen = true,
}: ShoppingCategoryProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const displayName = getCategoryDisplayName(category);
  const uncheckedCount = items.filter((i) => i.status !== 'already_have').length;
  const totalCount = items.length;

  // Only show items that need to be bought (filter out already_have)
  const activeItems = items.filter((i) => i.status !== 'already_have');

  // If all items in this category are checked, don't show it
  if (activeItems.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl overflow-hidden" id={`category-${category.toLowerCase()}`}>
      {/* Category header - large touch target */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between p-4 min-h-[52px]',
          'bg-muted/50 hover:bg-muted/70 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary'
        )}
        aria-expanded={isOpen}
        aria-controls={`category-content-${category}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold uppercase tracking-wide">
            {displayName}
          </span>
          <Badge variant="secondary" className="text-sm font-semibold">
            {uncheckedCount}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="h-6 w-6 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-6 w-6 text-muted-foreground" />
        )}
      </button>

      {/* Category items */}
      {isOpen && (
        <div
          id={`category-content-${category}`}
          className="flex flex-col gap-2 p-2 bg-background"
        >
          {activeItems.map((item) => (
            <ShoppingItem key={item.id} item={item} week={week} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Shopping Mode View ====================

interface ShoppingModeViewProps {
  items: GroceryItemType[];
  week: string;
  onExit: () => void;
}

/**
 * Group items by their category
 */
function groupByCategory(items: GroceryItemType[]): Map<string, GroceryItemType[]> {
  const groups = new Map<string, GroceryItemType[]>();

  for (const item of items) {
    const category = item.category || 'Other';
    const existing = groups.get(category) || [];
    existing.push(item);
    groups.set(category, existing);
  }

  return groups;
}

/**
 * Custom hook for Wake Lock API
 * Keeps screen awake while shopping mode is active
 */
function useWakeLock() {
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const [isSupported, setIsSupported] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);

  React.useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  const request = React.useCallback(async () => {
    if (!isSupported || wakeLockRef.current) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      // Wake lock request failed (e.g., low battery, tab not visible)
      console.warn('Wake lock request failed:', err);
    }
  }, [isSupported]);

  const release = React.useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
      } catch (err) {
        console.warn('Wake lock release failed:', err);
      }
    }
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Re-acquire wake lock when page becomes visible again
  React.useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLockRef.current) {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSupported, isActive, request]);

  return { isSupported, isActive, request, release };
}

/**
 * Shopping mode view optimized for in-store use
 * Features:
 * - Large touch targets (44px minimum)
 * - Simplified UI (no filters/search)
 * - Hide "already have" items
 * - Category collapse/expand
 * - Wake lock to keep screen on
 * - Quick category jump
 */
export function ShoppingModeView({ items, week, onExit }: ShoppingModeViewProps) {
  const wakeLock = useWakeLock();

  // Request wake lock when component mounts
  React.useEffect(() => {
    wakeLock.request();
    return () => {
      wakeLock.release();
    };
  }, [wakeLock.request, wakeLock.release]);

  // Filter out already_have items for shopping mode
  const activeItems = React.useMemo(
    () => items.filter((item) => item.status !== 'already_have'),
    [items]
  );

  // Group by category
  const categorizedItems = React.useMemo(
    () => groupByCategory(activeItems),
    [activeItems]
  );

  // Sort categories, putting "Other" last
  const sortedCategories = React.useMemo(() => {
    return Array.from(categorizedItems.entries()).sort(([a], [b]) => {
      if (a.toLowerCase() === 'other') return 1;
      if (b.toLowerCase() === 'other') return -1;
      return a.localeCompare(b);
    });
  }, [categorizedItems]);

  // Calculate progress
  const totalItems = items.length;
  const checkedItems = items.filter((i) => i.status === 'already_have').length;
  const remainingItems = totalItems - checkedItems;

  // Scroll to category
  const scrollToCategory = (category: string) => {
    const element = document.getElementById(`category-${category.toLowerCase()}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header - sticky */}
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Shopping Mode</h1>
              <p className="text-sm text-muted-foreground">
                {remainingItems} of {totalItems} remaining
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onExit}
            className="h-12 w-12"
            aria-label="Exit shopping mode"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${totalItems > 0 ? (checkedItems / totalItems) * 100 : 0}%` }}
          />
        </div>

        {/* Quick category jump - horizontal scroll */}
        {sortedCategories.length > 1 && (
          <div className="flex gap-2 p-3 overflow-x-auto scrollbar-hide">
            {sortedCategories.map(([category, categoryItems]) => {
              const uncheckedCount = categoryItems.filter(
                (i) => i.status !== 'already_have'
              ).length;
              if (uncheckedCount === 0) return null;
              return (
                <button
                  key={category}
                  onClick={() => scrollToCategory(category)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-full',
                    'bg-muted hover:bg-muted/80 transition-colors',
                    'text-sm font-medium whitespace-nowrap',
                    'focus:outline-none focus:ring-2 focus:ring-primary'
                  )}
                >
                  {getCategoryDisplayName(category)}
                  <Badge variant="secondary" className="text-xs">
                    {uncheckedCount}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-y-auto pb-24">
        {remainingItems === 0 ? (
          // All done state
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-6 mb-6">
              <Check className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
              Shopping Complete!
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              You got all {totalItems} items.
            </p>
            <Button size="lg" onClick={onExit} className="min-w-[200px]">
              Done Shopping
            </Button>
          </div>
        ) : (
          // Category list
          <div className="flex flex-col gap-3 p-4">
            {sortedCategories.map(([category, categoryItems]) => (
              <ShoppingCategory
                key={category}
                category={category}
                items={categoryItems}
                week={week}
                defaultOpen={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Done Shopping button - fixed at bottom */}
      {remainingItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg">
          <Button
            size="lg"
            onClick={onExit}
            variant="outline"
            className="w-full h-14 text-lg font-semibold"
          >
            Exit Shopping Mode
          </Button>
        </div>
      )}
    </div>
  );
}
