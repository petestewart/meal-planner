'use client';

import * as React from 'react';
import { Plus, AlertTriangle, ChefHat, Package, Refrigerator, Snowflake, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  usePantryItems,
  useExpiringItems,
  usePantryStaples,
  useAddPantryItem,
} from '@/lib/queries';
import type { PantryItemWithIngredient, PantryLocation } from '@/types/api';
import { PantryItem } from './PantryItem';
import { PantryItemForm } from './PantryItemForm';

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
          <h1 className="text-3xl font-bold">Pantry</h1>
          <p className="text-muted-foreground">
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
      <div className="flex gap-2 border-b">
        {LOCATION_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setLocationFilter(tab.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              locationFilter === tab.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Expiring Soon Alert Section */}
      {expiringItems.length > 0 && locationFilter === 'all' && (
        <Collapsible
          open={expiringOpen}
          onOpenChange={setExpiringOpen}
          className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex w-full items-center justify-between p-4 hover:bg-amber-100 dark:hover:bg-amber-900/20"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                <span className="text-base font-semibold text-amber-700 dark:text-amber-300">
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
      )}

      {/* Prepared Items Section */}
      {preparedItems.length > 0 && (
        <Collapsible
          open={preparedOpen}
          onOpenChange={setPreparedOpen}
          className="rounded-lg border"
        >
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="flex w-full items-center justify-between p-4 hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <ChefHat className="h-5 w-5 text-muted-foreground" />
                <span className="text-base font-semibold">Prepared Items</span>
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
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-muted-foreground">Loading pantry...</p>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive">
            {error?.message || 'Failed to load pantry items'}
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No items in pantry</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Start tracking your pantry inventory by adding items.
          </p>
          <Button className="mt-4" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Item
          </Button>
        </div>
      )}

      {/* Main items list by category */}
      {!isLoading && !isError && regularItems.length > 0 && (
        <div className="space-y-6">
          {Array.from(categorizedItems.entries()).map(([category, categoryItems]) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h3>
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
          ))}
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
