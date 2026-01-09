'use client';

import { GroceryListView } from '@/components/grocery';

/**
 * Grocery List Page
 *
 * Displays a categorized grocery list for the current week with:
 * - Week navigation
 * - Generate list button
 * - Items grouped by store section
 * - Tri-state checkboxes (need to buy, already have, partial)
 * - Collapsed "Already Have" section
 */
export default function GroceryPage() {
  return (
    <div className="container mx-auto p-6">
      <GroceryListView />
    </div>
  );
}
