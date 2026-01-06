'use client';

import * as React from 'react';
import {
  Plus,
  AlertTriangle,
  ChefHat,
  Package,
  Refrigerator,
  Snowflake,
  Archive,
  Leaf,
  Beef,
  Milk,
  Wheat,
  Flame,
  Fish,
  Croissant,
  Droplets,
  Cookie,
  CircleDot,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { PantryListSkeleton } from '@/components/skeletons';
import { InlineError } from '@/components/ui/error-boundary';
import {
  usePantryItems,
  useExpiringItems,
  usePantryStaples,
  useAddPantryItem,
} from '@/lib/queries';
import type { PantryItemWithIngredient, PantryLocation } from '@/types/api';
import { PantryItem } from './PantryItem';
import { PantryItemForm } from './PantryItemForm';

/**
 * Get the category icon component
 */
function getCategoryIconComponent(category: string): LucideIcon {
  const categoryMap: Record<string, LucideIcon> = {
    produce: Leaf,
    dairy: Milk,
    proteins: Beef,
    meat: Beef,
    protein: Beef,
    seafood: Fish,
    bakery: Croissant,
    frozen: Snowflake,
    pantry: Package,
    canned: Package,
    condiments: Droplets,
    spices: Flame,
    beverages: Droplets,
    snacks: Cookie,
    grains: Wheat,
    pasta: Droplets,
    oils: Droplets,
    other: CircleDot,
  };

  const lower = category.toLowerCase();
  return categoryMap[lower] || CircleDot;
}

/**
 * Get the border color class for a category
 */
function getCategoryBorderColor(category: string): string {
  const categoryMap: Record<string, string> = {
    produce: 'border-l-category-produce',
    dairy: 'border-l-category-dairy',
    proteins: 'border-l-category-protein',
    meat: 'border-l-category-protein',
    protein: 'border-l-category-protein',
    seafood: 'border-l-category-frozen',
    frozen: 'border-l-category-frozen',
    pantry: 'border-l-category-pantry',
    canned: 'border-l-category-pantry',
    spices: 'border-l-category-spices',
    grains: 'border-l-category-grains',
    bakery: 'border-l-category-grains',
    pasta: 'border-l-category-grains',
  };

  const lower = category.toLowerCase();
  return categoryMap[lower] || 'border-l-muted-foreground';
}

/**
 * Get the icon color class for a category
 */
function getCategoryIconColor(category: string): string {
  const categoryMap: Record<string, string> = {
    produce: 'text-category-produce',
    dairy: 'text-category-dairy',
    proteins: 'text-category-protein',
    meat: 'text-category-protein',
    protein: 'text-category-protein',
    seafood: 'text-category-frozen',
    frozen: 'text-category-frozen',
    pantry: 'text-category-pantry',
    canned: 'text-category-pantry',
    spices: 'text-category-spices',
    grains: 'text-category-grains',
    bakery: 'text-category-grains',
    pasta: 'text-category-grains',
  };

  const lower = category.toLowerCase();
  return categoryMap[lower] || 'text-muted-foreground';
}

type LocationFilter = 'all' | PantryLocation;

const LOCATION_TABS: { value: LocationFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Package className="h-4 w-4" /> },
  { value: 'fridge', label: 'Fridge', icon: <Refrigerator className="h-4 w-4" /> },
  { value: 'freezer', label: 'Freezer', icon: <Snowflake className="h-4 w-4" /> },
  { value: 'pantry', label: 'Pantry', icon: <Archive className="h-4 w-4" /> },
];

interface PantryListViewProps {
  className?: string;
}

/**
 * Group items by category
 */
function groupByCategory(items: PantryItemWithIngredient[]): Map<string, PantryItemWithIngredient[]> {
  const groups = new Map<string, PantryItemWithIngredient[]>();

  for (const item of items) {
    const category = item.ingredientCategory || 'Other';
    const existing = groups.get(category) || [];
    existing.push(item);
    groups.set(category, existing);
  }

  // Sort categories alphabetically, but keep "Other" at the end
  const sortedGroups = new Map(
    [...groups.entries()].sort((a, b) => {
      if (a[0] === 'Other') return 1;
      if (b[0] === 'Other') return -1;
      return a[0].localeCompare(b[0]);
    })
  );

  return sortedGroups;
}

/**
 * Main pantry list view component
 */
export function PantryListView({ className }: PantryListViewProps) {
  const [locationFilter, setLocationFilter] = React.useState<LocationFilter>('all');
  const [formOpen, setFormOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<PantryItemWithIngredient | null>(null);
  const [preparedOpen, setPreparedOpen] = React.useState(true);
  const [expiringOpen, setExpiringOpen] = React.useState(true);

  // Query options based on filter
  const queryOptions = locationFilter === 'all' ? {} : { location: locationFilter };

  const {
    data: pantryData,
    isLoading,
    isError,
    error,
  } = usePantryItems(queryOptions);

  const { data: expiringData } = useExpiringItems();
  const { data: staplesData } = usePantryStaples();
  const addItem = useAddPantryItem();

  const items = pantryData?.items || [];
  const expiringItems = expiringData?.items || [];
  const staples = staplesData?.items || [];

  // Separate prepared items
  const preparedItems = React.useMemo(
    () => items.filter((item) => item.isPrepared),
    [items]
  );

  const regularItems = React.useMemo(
    () => items.filter((item) => !item.isPrepared),
    [items]
  );

  // Group regular items by category
  const categorizedItems = React.useMemo(
    () => groupByCategory(regularItems),
    [regularItems]
  );

  const handleEdit = (item: PantryItemWithIngredient) => {
    setEditItem(item);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditItem(null);
    }
  };

  const handleQuickAddStaples = () => {
    // Add each staple that isn't already in pantry
    const currentNames = new Set(items.map((i) => i.ingredientName.toLowerCase()));
    const staplesToAdd = staples.filter(
      (s) => !currentNames.has(s.ingredientName.toLowerCase())
    );

    if (staplesToAdd.length === 0) {
      alert('All staples are already in your pantry!');
      return;
    }

    // Add staples one by one
    staplesToAdd.forEach((staple) => {
      addItem.mutate({
        ingredientName: staple.ingredientName,
        location: staple.location,
        isStaple: true,
      });
    });
  };

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 font-display">Pantry</h1>
          <p className="text-body-sm text-muted-foreground">
            Track your pantry inventory and available ingredients.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {staples.length > 0 && (
            <Button
              variant="outline"
              onClick={handleQuickAddStaples}
              disabled={addItem.isPending}
            >
              Quick-add Staples
            </Button>
          )}
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      {/* Location filter tabs */}
      <div className="flex gap-1 sm:gap-2 border-b overflow-x-auto">
        {LOCATION_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setLocationFilter(tab.value)}
            aria-pressed={locationFilter === tab.value}
            aria-label={`Filter by ${tab.label}`}
            className={cn(
              'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px touch-manipulation min-h-[44px] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              locationFilter === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
            )}
          >
            {tab.icon}
            <span className="hidden xs:inline sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Expiring Soon Alert Section */}
      {expiringItems.length > 0 && locationFilter === 'all' && (
        <Card className="overflow-hidden border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <Collapsible open={expiringOpen} onOpenChange={setExpiringOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between p-4 hover:bg-amber-100 dark:hover:bg-amber-900/20 min-h-[56px]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-200/50 dark:bg-amber-800/30">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <span className="text-base font-display font-semibold text-amber-700 dark:text-amber-300">
                    Expiring Soon
                  </span>
                  <Badge variant="secondary" className="font-normal">
                    {expiringItems.length} {expiringItems.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                <span className="text-sm text-amber-600 dark:text-amber-400">
                  {expiringOpen ? 'Hide' : 'Show'}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <div className="flex flex-col gap-2">
                {expiringItems.map((item) => (
                  <PantryItem
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Prepared Items Section */}
      {preparedItems.length > 0 && (
        <Card className="overflow-hidden">
          <Collapsible open={preparedOpen} onOpenChange={setPreparedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="flex w-full items-center justify-between p-4 hover:bg-muted/50 min-h-[56px]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50 text-muted-foreground">
                    <ChefHat className="h-5 w-5" />
                  </div>
                  <span className="text-base font-display font-semibold">Prepared Items</span>
                  <Badge variant="secondary" className="font-normal">
                    {preparedItems.length} {preparedItems.length === 1 ? 'item' : 'items'}
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  {preparedOpen ? 'Hide' : 'Show'}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              <div className="flex flex-col gap-2">
                {preparedItems.map((item) => (
                  <PantryItem
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Loading state - Skeleton */}
      {isLoading && <PantryListSkeleton categoryCount={4} />}

      {/* Error state */}
      {isError && (
        <InlineError
          message={error?.message || 'Failed to load pantry items'}
          onRetry={() => window.location.reload()}
        />
      )}

      {/* Empty state */}
      {!isLoading && !isError && items.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-12 px-6 text-center border-2 border-dashed bg-muted/30 shadow-none">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-h3 font-display">Your pantry is empty</h3>
          <p className="mt-2 text-body-sm text-muted-foreground max-w-sm">
            Keep track of what you have on hand. Add ingredients to your pantry and we will help you skip items you already have when building grocery lists.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Your First Item
            </Button>
            {staples.length > 0 && (
              <Button variant="outline" onClick={handleQuickAddStaples} disabled={addItem.isPending}>
                Quick-add Staples
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Main items list by category */}
      {!isLoading && !isError && regularItems.length > 0 && (
        <div className="space-y-4">
          {Array.from(categorizedItems.entries()).map(([category, categoryItems]) => {
            const IconComponent = getCategoryIconComponent(category);
            const borderColor = getCategoryBorderColor(category);
            const iconColor = getCategoryIconColor(category);

            return (
              <Card
                key={category}
                className={cn(
                  'overflow-hidden border-l-4 transition-all duration-200',
                  borderColor
                )}
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50', iconColor)}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-display font-semibold uppercase tracking-wide">
                      {category}
                    </h3>
                    <Badge variant="secondary" className="font-normal">
                      {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {categoryItems.map((item) => (
                      <PantryItem
                        key={item.id}
                        item={item}
                        onEdit={handleEdit}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit form dialog */}
      <PantryItemForm
        open={formOpen}
        onOpenChange={handleFormClose}
        editItem={editItem}
      />
    </div>
  );
}
