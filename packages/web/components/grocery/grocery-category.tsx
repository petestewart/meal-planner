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
import {
  Leaf,
  Beef,
  Milk,
  Wheat,
  Flame,
  Snowflake,
  Package,
  Fish,
  Croissant,
  UtensilsCrossed,
  Droplets,
  Cookie,
  LucideIcon,
  CircleDot,
} from 'lucide-react';

interface GroceryCategoryProps {
  category: string;
  items: GroceryItemType[];
  week: string;
  defaultOpen?: boolean;
  className?: string;
}

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
    pasta: UtensilsCrossed,
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

/**
 * Get display name for category
 */
function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    produce: 'Produce',
    dairy: 'Dairy',
    proteins: 'Proteins',
    meat: 'Proteins',
    protein: 'Proteins',
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
 * Shows category name with colored border, icon, and item count badge
 */
export function GroceryCategory({
  category,
  items,
  week,
  defaultOpen = true,
  className,
}: GroceryCategoryProps) {
  const displayName = getCategoryDisplayName(category);
  const IconComponent = getCategoryIconComponent(category);
  const borderColor = getCategoryBorderColor(category);
  const iconColor = getCategoryIconColor(category);
  const itemCount = items.length;

  // Count items by status
  const partialCount = items.filter((i) => i.status === 'partial').length;
  const checkedCount = items.filter((i) => i.status === 'already_have').length;

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue={defaultOpen ? category : undefined}
      className={cn(className)}
    >
      <AccordionItem
        value={category}
        className={cn(
          'overflow-hidden rounded-lg border border-l-4 transition-all duration-200',
          borderColor
        )}
      >
        <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/30 transition-colors">
          <div className="flex items-center gap-3">
            {/* Category Icon */}
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/50', iconColor)}>
              <IconComponent className="h-5 w-5" />
            </div>
            {/* Category Name */}
            <span className="text-base font-semibold uppercase tracking-wide">
              {displayName}
            </span>
            {/* Item Count Badge */}
            <Badge variant="secondary" className="font-normal">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Badge>
            {/* Partial Badge */}
            {partialCount > 0 && (
              <Badge variant="warning">
                {partialCount} partial
              </Badge>
            )}
            {/* Progress indicator */}
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
