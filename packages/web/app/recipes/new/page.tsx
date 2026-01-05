'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecipeForm } from '@/components/recipes';

/**
 * New Recipe Page
 * Allows users to manually create a new recipe
 */
export default function NewRecipePage() {
  return (
    <div className="container mx-auto max-w-3xl p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" asChild>
          <Link href="/recipes">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Add New Recipe</h1>
          <p className="text-muted-foreground">
            Create a recipe manually by filling out the form below.
          </p>
        </div>
      </div>

      {/* Recipe Form */}
      <RecipeForm mode="create" />
    </div>
  );
}
