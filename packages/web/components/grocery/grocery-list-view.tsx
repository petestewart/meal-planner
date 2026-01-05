'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ShoppingCart, Check, ShoppingBag, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { GroceryItem as GroceryItemType, CheckPantryResponse } from '@/types/api';
import { useGroceryList, useGenerateGroceryList, useCheckPantry } from '@/lib/queries';
import {
  getCurrentWeek,
  getNextWeek,
  getPreviousWeek,
  formatWeekDisplay,
} from '@/lib/week-utils';
import { GroceryCategoryGroup } from './grocery-category';
import { GroceryItem } from './grocery-item';
import { ShoppingModeView } from './shopping-mode';
import { CheckPantryDialog } from './check-pantry-dialog';
import { cn } from '@/lib/utils';
import { GroceryListSkeleton } from '@/components/skeletons';
import { InlineError } from '@/components/ui/error-boundary';

interface GroceryListViewProps {
  initialWeek?: string;
  className?: string;
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
 * Main grocery list view component
 * Shows week selector, generate button, categorized items, and "Already Have" section
 */
export function GroceryListView({ initialWeek, className }: GroceryListViewProps) {
  const [week, setWeek] = React.useState(initialWeek || getCurrentWeek());
  const [alreadyHaveOpen, setAlreadyHaveOpen] = React.useState(false);
  const [isShoppingMode, setIsShoppingMode] = React.useState(false);
  const [checkPantryDialogOpen, setCheckPantryDialogOpen] = React.useState(false);
  const [checkPantryResult, setCheckPantryResult] = React.useState<CheckPantryResponse | null>(null);

  const {
    data: groceryList,
    isLoading,
    isError,
    error,
  } = useGroceryList(week);

  const generateList = useGenerateGroceryList();
  const checkPantry = useCheckPantry();

  const handlePreviousWeek = () => setWeek(getPreviousWeek(week));
  const handleNextWeek = () => setWeek(getNextWeek(week));
  const handleCurrentWeek = () => setWeek(getCurrentWeek());

  const handleGenerate = () => {
    generateList.mutate({
      week,
      excludePantry: true,
      groupBy: 'category',
    });
  };

  const handleOpenCheckPantryDialog = () => {
    setCheckPantryResult(null);
    setCheckPantryDialogOpen(true);
  };

  const handleCheckPantryDialogClose = (open: boolean) => {
    setCheckPantryDialogOpen(open);
    if (!open) {
      // Reset result when dialog is closed
      setCheckPantryResult(null);
      checkPantry.reset();
    }
  };

  const handleCheckPantry = () => {
    checkPantry.mutate(week, {
      onSuccess: (result) => {
        setCheckPantryResult(result);
      },
    });
  };

  // Split items into active (need to buy / partial) and already have
  const activeItems = React.useMemo(() => {
    if (!groceryList?.items) return [];
    return groceryList.items.filter(
      (item) => item.status === 'need_to_buy' || item.status === 'partial'
    );
  }, [groceryList?.items]);

  const alreadyHaveItems = React.useMemo(() => {
    if (!groceryList?.items) return [];
    return groceryList.items.filter((item) => item.status === 'already_have');
  }, [groceryList?.items]);

  // Group active items by category
  const categorizedItems = React.useMemo(
    () => groupByCategory(activeItems),
    [activeItems]
  );

  const isCurrentWeek = week === getCurrentWeek();
  const hasItems = groceryList?.items && groceryList.items.length > 0;
  const totalItems = groceryList?.items?.length || 0;
  const checkedItems = alreadyHaveItems.length;

  // Render shopping mode if active
  if (isShoppingMode && groceryList?.items) {
    return (
      <ShoppingModeView
        items={groceryList.items}
        week={week}
        onExit={() => setIsShoppingMode(false)}
      />
    );
  }

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Grocery List</h1>
          <p className="text-muted-foreground">
            Week of {formatWeekDisplay(week)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Check Pantry button - only show when there are active items */}
          {activeItems.length > 0 && (
            <Button
              variant="outline"
              onClick={handleOpenCheckPantryDialog}
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Check Pantry</span>
              <span className="sm:hidden">Pantry</span>
            </Button>
          )}
          {/* Shopping Mode button - only show when there are active items */}
          {activeItems.length > 0 && (
            <Button
              variant="default"
              onClick={() => setIsShoppingMode(true)}
              className="gap-2"
            >
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">Shopping Mode</span>
              <span className="sm:hidden">Shop</span>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generateList.isPending}
          >
            <RefreshCw
              className={cn('h-4 w-4', generateList.isPending && 'animate-spin')}
            />
            {generateList.isPending ? 'Generating...' : 'Generate'}
          </Button>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePreviousWeek}
          aria-label="Previous week"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <Button
          variant={isCurrentWeek ? 'secondary' : 'outline'}
          onClick={handleCurrentWeek}
          className="min-w-[180px]"
        >
          {formatWeekDisplay(week)}
          {isCurrentWeek && (
            <Badge variant="default" className="ml-2">
              This Week
            </Badge>
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextWeek}
          aria-label="Next week"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Progress indicator */}
      {hasItems && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4" />
          <span>
            {checkedItems} of {totalItems} items checked
          </span>
          {checkedItems === totalItems && totalItems > 0 && (
            <Badge variant="default" className="bg-green-600">
              Complete!
            </Badge>
          )}
        </div>
      )}

      {/* Loading state - Skeleton */}
      {isLoading && <GroceryListSkeleton categoryCount={3} />}

      {/* Error state */}
      {isError && (
        <InlineError
          message={error?.message || 'Failed to load grocery list'}
          onRetry={handleGenerate}
        />
      )}

      {/* Empty state */}
      {!isLoading && !isError && !hasItems && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No grocery list yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate a grocery list from your meal plan for this week.
          </p>
          <Button className="mt-4" onClick={handleGenerate} disabled={generateList.isPending}>
            <RefreshCw
              className={cn('h-4 w-4 mr-2', generateList.isPending && 'animate-spin')}
            />
            Generate Grocery List
          </Button>
        </div>
      )}

      {/* Grocery list content */}
      {!isLoading && !isError && hasItems && (
        <>
          {/* Active items by category */}
          {activeItems.length > 0 && (
            <GroceryCategoryGroup
              categories={categorizedItems}
              week={week}
              defaultOpenAll={true}
            />
          )}

          {/* "Already Have" section - collapsed by default */}
          {alreadyHaveItems.length > 0 && (
            <Collapsible
              open={alreadyHaveOpen}
              onOpenChange={setAlreadyHaveOpen}
              className="rounded-lg border"
            >
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex w-full items-center justify-between p-4 hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base font-semibold uppercase tracking-wide text-muted-foreground">
                      Already Have
                    </span>
                    <Badge variant="secondary" className="font-normal">
                      {alreadyHaveItems.length}{' '}
                      {alreadyHaveItems.length === 1 ? 'item' : 'items'}
                    </Badge>
                  </div>
                  <ChevronRight
                    className={cn(
                      'h-5 w-5 text-muted-foreground transition-transform',
                      alreadyHaveOpen && 'rotate-90'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="flex flex-col gap-2">
                  {alreadyHaveItems.map((item) => (
                    <GroceryItem key={item.id} item={item} week={week} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* All items checked state */}
          {activeItems.length === 0 && alreadyHaveItems.length > 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg bg-green-50 py-8 text-center dark:bg-green-950/20">
              <Check className="h-12 w-12 text-green-600" />
              <h3 className="mt-4 text-lg font-semibold text-green-700 dark:text-green-400">
                Shopping complete!
              </h3>
              <p className="mt-2 text-sm text-green-600 dark:text-green-500">
                You have all {alreadyHaveItems.length} items.
              </p>
            </div>
          )}
        </>
      )}

      {/* Check Pantry Dialog */}
      <CheckPantryDialog
        open={checkPantryDialogOpen}
        onOpenChange={handleCheckPantryDialogClose}
        isPending={checkPantry.isPending}
        isError={checkPantry.isError}
        errorMessage={checkPantry.error?.message}
        result={checkPantryResult}
        onCheck={handleCheckPantry}
      />
    </div>
  );
}
