'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Loader2, AlertCircle, CheckCircle2, ClipboardPaste } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useImportRecipe, useUpdateRecipe } from '@/lib/queries';
import { RecipePreview, type RecipePreviewUpdates } from './recipe-preview';
import { cn } from '@/lib/utils';
import type { RecipeWithRelations } from '@/types/api';

type ImportStep = 'input' | 'loading' | 'preview' | 'error' | 'success';

interface RecipeImportFormProps {
  className?: string;
}

/**
 * Multi-step recipe import flow
 * 1. URL Input - User pastes recipe URL
 * 2. Loading - Fetching and parsing recipe
 * 3. Preview - Review and edit parsed recipe
 * 4. Error - Show error with retry options
 * 5. Success - Confirmation with next actions
 */
export function RecipeImportForm({ className }: RecipeImportFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>('input');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importedRecipe, setImportedRecipe] = useState<RecipeWithRelations | null>(null);

  const importRecipe = useImportRecipe();
  const updateRecipe = useUpdateRecipe();

  /**
   * Handle URL paste from clipboard
   */
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text);
      }
    } catch (err) {
      // Clipboard access may be denied - silently fail
      console.warn('Could not read from clipboard');
    }
  };

  /**
   * Validate URL format
   */
  const isValidUrl = (urlString: string): boolean => {
    try {
      const parsed = new URL(urlString);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  /**
   * Start the import process
   */
  const handleImport = async () => {
    if (!url.trim()) return;

    // Validate URL
    if (!isValidUrl(url.trim())) {
      setError('Please enter a valid URL (starting with http:// or https://)');
      setStep('error');
      return;
    }

    setStep('loading');
    setError(null);

    try {
      const recipe = await importRecipe.mutateAsync({ url: url.trim() });
      setImportedRecipe(recipe);
      setStep('preview');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import recipe';
      setError(errorMessage);
      setStep('error');
    }
  };

  /**
   * Save the recipe with any edits
   */
  const handleSave = async (updates: RecipePreviewUpdates) => {
    if (!importedRecipe) return;

    try {
      await updateRecipe.mutateAsync({
        id: importedRecipe.id,
        input: updates,
      });
      setStep('success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save recipe';
      setError(errorMessage);
      setStep('error');
    }
  };

  /**
   * Reset to try again
   */
  const handleRetry = () => {
    setStep('input');
    setError(null);
  };

  /**
   * Cancel and go back to input
   */
  const handleCancel = () => {
    setStep('input');
    setImportedRecipe(null);
    setError(null);
  };

  /**
   * Navigate to the saved recipe
   */
  const handleViewRecipe = () => {
    if (importedRecipe) {
      router.push(`/recipes/${importedRecipe.id}`);
    }
  };

  /**
   * Navigate to add recipe to plan
   */
  const handleAddToPlan = () => {
    // Navigate to plan page - could be enhanced to pre-select the recipe
    router.push('/plan');
  };

  return (
    <div className={cn('w-full max-w-2xl mx-auto', className)}>
      {/* URL Input Step */}
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Import Recipe from URL
            </CardTitle>
            <CardDescription>
              Paste a recipe URL from your favorite cooking website. We&apos;ll
              automatically extract the recipe details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/recipe/..."
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && url.trim()) {
                      handleImport();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Paste from clipboard"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </button>
              </div>
              <Button onClick={handleImport} disabled={!url.trim()}>
                Import
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Works with most recipe websites including AllRecipes, Food Network,
              BBC Good Food, and many more.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading Step */}
      {step === 'loading' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-semibold mb-2">Importing Recipe...</h3>
              <p className="text-muted-foreground">
                Fetching and parsing recipe from the website. This may take a few seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && importedRecipe && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Recipe Imported
            </CardTitle>
            <CardDescription>
              Review and edit the recipe details below. You can fix any parsing
              errors before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecipePreview
              recipe={importedRecipe}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={updateRecipe.isPending}
            />
          </CardContent>
        </Card>
      )}

      {/* Error Step */}
      {step === 'error' && (
        <Card className="border-destructive/50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Import Failed</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {error || 'Something went wrong while importing the recipe.'}
              </p>
              <div className="flex gap-3">
                <Button onClick={handleRetry}>Try Again</Button>
                <Button variant="outline" asChild>
                  <a href="/recipes/new">Enter Manually</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Step */}
      {step === 'success' && importedRecipe && (
        <Card className="border-green-500/50">
          <CardContent className="py-8">
            <div className="flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Recipe Saved!</h3>
              <p className="text-muted-foreground mb-6">
                &quot;{importedRecipe.title}&quot; has been added to your recipe collection.
              </p>
              <div className="flex gap-3">
                <Button onClick={handleViewRecipe}>View Recipe</Button>
                <Button variant="outline" onClick={handleAddToPlan}>
                  Add to Plan
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
