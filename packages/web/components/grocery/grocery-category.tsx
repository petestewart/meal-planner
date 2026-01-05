'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { GroceryItem as GroceryItemType } from '@/types/api';
import { GroceryItem } from './grocery-item';
import { cn } from '@/lib/utils';

interface GroceryCategoryProps {
  category: string;
  items: GroceryItemType[];
  week: string;
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Category icons for common store sections
 */
function getCategoryIcon(category: string): string {
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
 * Accordion section for a category of grocery items
 * Shows category name with item count badge
 */
export function GroceryCategory({
  category,
  items,
  week,
  defaultOpen = true,
  className,
}: GroceryCategoryProps) {
  const displayName = getCategoryIcon(category);
  const itemCount = items.length;

  // Count items by status
  const needToBuyCount = items.filter((i) => i.status === 'need_to_buy').length;
  const partialCount = items.filter((i) => i.status === 'partial').length;
  const checkedCount = items.filter((i) => i.status === 'already_have').length;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? category : undefined}
      className={cn(className)}
    >
      <AccordionItem value={category} className="border rounded-lg">
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold uppercase tracking-wide">
              {displayName}
            </span>
            <Badge variant="secondary" className="font-normal">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Badge>
            {partialCount > 0 && (
              <Badge
                variant="outline"
                className="border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              >
                {partialCount} partial
              </Badge>
            )}
            {checkedCount > 0 && checkedCount < itemCount && (
              <span className="text-sm text-muted-foreground">
                ({checkedCount}/{itemCount} done)
              </span>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="flex flex-col gap-2">
            {items.map((item) => (
              <GroceryItem key={item.id} item={item} week={week} />
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

interface GroceryCategoryGroupProps {
  categories: Map<string, GroceryItemType[]>;
  week: string;
  defaultOpenAll?: boolean;
  className?: string;
}

/**
 * Display multiple category accordions
 * Categories are sorted alphabetically, with "Other" at the end
 */
export function GroceryCategoryGroup({
  categories,
  week,
  defaultOpenAll = true,
  className,
}: GroceryCategoryGroupProps) {
  // Sort categories, putting "Other" last
  const sortedCategories = Array.from(categories.entries()).sort(([a], [b]) => {
    if (a.toLowerCase() === 'other') return 1;
    if (b.toLowerCase() === 'other') return -1;
    return a.localeCompare(b);
  });

  if (sortedCategories.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {sortedCategories.map(([category, items]) => (
        <GroceryCategory
          key={category}
          category={category}
          items={items}
          week={week}
          defaultOpen={defaultOpenAll}
        />
      ))}
    </div>
  );
}
