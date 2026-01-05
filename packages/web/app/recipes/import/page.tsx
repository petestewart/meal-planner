'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RecipeImportForm } from '@/components/recipes';

/**
 * Recipe import page
 * Allows users to import recipes from URLs
 */
export default function RecipeImportPage() {
  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/recipes">
            <ArrowLeft className="h-4 w-4" />
            Back to Recipes
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Import Recipe</h1>
        <p className="mt-1 text-muted-foreground">
          Import a recipe from any cooking website by pasting its URL.
        </p>
      </div>

      {/* Import form */}
      <RecipeImportForm />
    </div>
  );
}
