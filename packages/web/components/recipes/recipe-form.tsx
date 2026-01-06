'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Clock, Users, ChefHat, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TagInput } from '@/components/settings/TagInput';
import { useCreateRecipe, useUpdateRecipe } from '@/lib/queries';
import { cn } from '@/lib/utils';
import type { RecipeWithRelations, CreateRecipeInput, UpdateRecipeInput, Difficulty } from '@/types/api';

/**
 * Form ingredient item - stores ingredient data before submission
 */
interface FormIngredient {
  id: string; // local id for React key
  name: string;
  quantity: string;
  unit: string;
  notes: string;
}

/**
 * Form instruction step
 */
interface FormInstruction {
  id: string;
  text: string;
}

interface RecipeFormProps {
  mode: 'create' | 'edit';
  recipe?: RecipeWithRelations;
  onSuccess?: (recipe: RecipeWithRelations) => void;
  onCancel?: () => void;
  className?: string;
}

// Generate unique IDs for form items
let nextId = 0;
function generateId(): string {
  return `form-item-${nextId++}-${Date.now()}`;
}

// Common cuisines
const CUISINES = [
  'American',
  'Chinese',
  'French',
  'Greek',
  'Indian',
  'Italian',
  'Japanese',
  'Korean',
  'Mediterranean',
  'Mexican',
  'Spanish',
  'Thai',
  'Vietnamese',
];

// Difficulty options
const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

/**
 * Parse embedded ingredients from instructions text
 * Format: "INGREDIENTS:\n- qty unit name (notes)\n...\n\nINSTRUCTIONS:\n..."
 */
function parseEmbeddedIngredients(instructions: string): { ingredients: FormIngredient[]; instructionsOnly: string } {
  // Check if instructions contain our embedded format
  const ingredientsMatch = instructions.match(/^INGREDIENTS:\n([\s\S]*?)\n\nINSTRUCTIONS:\n([\s\S]*)$/);

  if (!ingredientsMatch) {
    // No embedded ingredients, return empty list
    return {
      ingredients: [{ id: generateId(), name: '', quantity: '', unit: '', notes: '' }],
      instructionsOnly: instructions,
    };
  }

  const ingredientsSection = ingredientsMatch[1];
  const instructionsSection = ingredientsMatch[2];

  // Parse ingredient lines: "- qty unit name (notes)"
  const ingredientLines = ingredientsSection.split('\n').filter((line) => line.startsWith('- '));
  const ingredients: FormIngredient[] = ingredientLines.map((line) => {
    // Remove the "- " prefix
    const content = line.substring(2).trim();

    // Try to parse: "qty unit name (notes)" or just "name"
    // Pattern: optional number, optional unit word, rest is name (optional parenthetical notes)
    const match = content.match(/^([\d./]+)?\s*([a-zA-Z]+)?\s*(.+?)(?:\s*\(([^)]+)\))?$/);

    if (match) {
      const [, qty, unit, name, notes] = match;
      // Check if what we captured as "unit" is actually part of the name (no qty)
      if (!qty && unit && name) {
        return {
          id: generateId(),
          quantity: '',
          unit: '',
          name: `${unit} ${name}`.trim(),
          notes: notes || '',
        };
      }
      return {
        id: generateId(),
        quantity: qty || '',
        unit: unit || '',
        name: name?.trim() || '',
        notes: notes || '',
      };
    }

    return {
      id: generateId(),
      quantity: '',
      unit: '',
      name: content,
      notes: '',
    };
  });

  return {
    ingredients: ingredients.length > 0 ? ingredients : [{ id: generateId(), name: '', quantity: '', unit: '', notes: '' }],
    instructionsOnly: instructionsSection,
  };
}

/**
 * Parse existing recipe ingredients into form format
 */
function parseRecipeIngredients(recipe: RecipeWithRelations): FormIngredient[] {
  // First check for database-linked ingredients
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    return recipe.ingredients.map((ing) => ({
      id: generateId(),
      name: ing.notes || '', // Ingredient name is stored in notes for manual recipes
      quantity: ing.quantity?.toString() || '',
      unit: ing.unit || '',
      notes: '',
    }));
  }

  // Fall back to parsing embedded ingredients from instructions
  if (recipe.instructions) {
    const { ingredients } = parseEmbeddedIngredients(recipe.instructions);
    return ingredients;
  }

  return [{ id: generateId(), name: '', quantity: '', unit: '', notes: '' }];
}

/**
 * Parse existing recipe instructions into form format
 */
function parseRecipeInstructions(recipe: RecipeWithRelations): FormInstruction[] {
  if (!recipe.instructions) {
    return [{ id: generateId(), text: '' }];
  }

  // Check for embedded ingredients format and extract just instructions
  const { instructionsOnly } = parseEmbeddedIngredients(recipe.instructions);
  const textToParse = instructionsOnly || recipe.instructions;

  // Split by newlines or numbered steps
  const steps = textToParse
    .split(/\n+/)
    .map((step) => step.replace(/^\d+\.\s*/, '').trim())
    .filter((step) => step.length > 0 && !step.startsWith('INGREDIENTS:') && !step.startsWith('-'));

  if (steps.length === 0) {
    return [{ id: generateId(), text: '' }];
  }

  return steps.map((text) => ({ id: generateId(), text }));
}

/**
 * Recipe form component for creating and editing recipes
 */
export function RecipeForm({
  mode,
  recipe,
  onSuccess,
  onCancel,
  className,
}: RecipeFormProps) {
  const router = useRouter();
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();

  // Form state
  const [title, setTitle] = useState(recipe?.title || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [imageUrl, setImageUrl] = useState(''); // TODO: source from recipe if we add image support
  const [servings, setServings] = useState(recipe?.servings?.toString() || '4');
  const [prepTime, setPrepTime] = useState(recipe?.prepTimeMinutes?.toString() || '');
  const [cookTime, setCookTime] = useState(recipe?.cookTimeMinutes?.toString() || '');
  const [cuisine, setCuisine] = useState(recipe?.cuisine || '');
  const [difficulty, setDifficulty] = useState<Difficulty | ''>(recipe?.difficulty || '');
  const [tags, setTags] = useState<string[]>(recipe?.tagIds || []);

  // Dynamic lists
  const [ingredients, setIngredients] = useState<FormIngredient[]>(
    recipe ? parseRecipeIngredients(recipe) : [{ id: generateId(), name: '', quantity: '', unit: '', notes: '' }]
  );
  const [instructions, setInstructions] = useState<FormInstruction[]>(
    recipe ? parseRecipeInstructions(recipe) : [{ id: generateId(), text: '' }]
  );

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Loading state
  const isSubmitting = createRecipe.isPending || updateRecipe.isPending;

  // Add new ingredient
  const addIngredient = useCallback(() => {
    setIngredients((prev) => [...prev, { id: generateId(), name: '', quantity: '', unit: '', notes: '' }]);
  }, []);

  // Remove ingredient
  const removeIngredient = useCallback((id: string) => {
    setIngredients((prev) => {
      if (prev.length <= 1) return prev; // Keep at least one
      return prev.filter((ing) => ing.id !== id);
    });
  }, []);

  // Update ingredient field
  const updateIngredient = useCallback((id: string, field: keyof FormIngredient, value: string) => {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing))
    );
  }, []);

  // Add new instruction step
  const addInstruction = useCallback(() => {
    setInstructions((prev) => [...prev, { id: generateId(), text: '' }]);
  }, []);

  // Remove instruction step
  const removeInstruction = useCallback((id: string) => {
    setInstructions((prev) => {
      if (prev.length <= 1) return prev; // Keep at least one
      return prev.filter((inst) => inst.id !== id);
    });
  }, []);

  // Update instruction text
  const updateInstruction = useCallback((id: string, text: string) => {
    setInstructions((prev) =>
      prev.map((inst) => (inst.id === id ? { ...inst, text } : inst))
    );
  }, []);

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }

    // Check that at least one instruction has content
    const hasInstructions = instructions.some((inst) => inst.text.trim());
    if (!hasInstructions) {
      newErrors.instructions = 'At least one instruction is required';
    }

    // Validate servings is a positive number
    const servingsNum = parseInt(servings);
    if (isNaN(servingsNum) || servingsNum < 1) {
      newErrors.servings = 'Servings must be at least 1';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    // Build ingredients list as text (for inclusion in instructions)
    // Since the API requires existing ingredient IDs, we store ingredients as formatted text
    const filteredIngredients = ingredients.filter((ing) => ing.name.trim());
    const ingredientsText = filteredIngredients.length > 0
      ? 'INGREDIENTS:\n' + filteredIngredients
          .map((ing) => {
            let line = '- ';
            if (ing.quantity) line += `${ing.quantity} `;
            if (ing.unit) line += `${ing.unit} `;
            line += ing.name.trim();
            if (ing.notes) line += ` (${ing.notes.trim()})`;
            return line;
          })
          .join('\n') + '\n\nINSTRUCTIONS:\n'
      : '';

    // Build instructions string from steps
    const instructionsText = instructions
      .filter((inst) => inst.text.trim())
      .map((inst, i) => `${i + 1}. ${inst.text.trim()}`)
      .join('\n\n');

    // Combine ingredients and instructions
    const fullInstructions = ingredientsText + instructionsText;

    // Build recipe input
    // Note: We don't pass ingredients array since the API requires existing ingredient IDs
    // Instead, ingredients are included as formatted text at the start of instructions
    const input: CreateRecipeInput = {
      title: title.trim(),
      instructions: fullInstructions,
      description: description.trim() || undefined,
      servings: parseInt(servings) || 4,
      prepTimeMinutes: prepTime ? parseInt(prepTime) : undefined,
      cookTimeMinutes: cookTime ? parseInt(cookTime) : undefined,
      cuisine: cuisine.trim() || undefined,
      difficulty: difficulty || undefined,
      tags: tags.length > 0 ? tags : undefined,
      sourceType: 'manual',
    };

    try {
      let savedRecipe: RecipeWithRelations;

      if (mode === 'create') {
        savedRecipe = await createRecipe.mutateAsync(input);
      } else if (recipe) {
        const updateInput: UpdateRecipeInput = {
          ...input,
          // Ensure null values for cleared optional fields
          description: input.description || null,
          prepTimeMinutes: input.prepTimeMinutes ?? null,
          cookTimeMinutes: input.cookTimeMinutes ?? null,
          cuisine: input.cuisine || null,
          difficulty: input.difficulty || null,
        };
        savedRecipe = await updateRecipe.mutateAsync({ id: recipe.id, input: updateInput });
      } else {
        return;
      }

      if (onSuccess) {
        onSuccess(savedRecipe);
      } else {
        router.push(`/recipes/${savedRecipe.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save recipe';
      setErrors({ submit: message });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      router.back();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-8', className)}>
      {/* Basic Info Section */}
      <Card variant="elevated" className="overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="font-display text-h3">Basic Information</CardTitle>
          <CardDescription>
            Enter the recipe title, description, and other details.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1.5">
              Recipe Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Chicken Parmesan"
              className={cn(errors.title && 'border-destructive')}
            />
            {errors.title && (
              <p className="text-sm text-destructive mt-1">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1.5">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the recipe..."
              rows={3}
              className={cn(
                'flex min-h-[100px] w-full rounded-sm border-[1.5px] border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-y',
                'placeholder:text-muted-foreground placeholder:italic',
                'transition-all duration-200 ease-out',
                'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
                'disabled:cursor-not-allowed disabled:opacity-50'
              )}
            />
          </div>

          {/* Image URL */}
          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium mb-1.5">
              Image URL
            </label>
            <Input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          {/* Time, Servings, Cuisine row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label htmlFor="servings" className="block text-sm font-medium mb-1.5">
                <Users className="inline h-4 w-4 mr-1" />
                Servings
              </label>
              <Input
                id="servings"
                type="number"
                min={1}
                max={24}
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className={cn(errors.servings && 'border-destructive')}
              />
              {errors.servings && (
                <p className="text-sm text-destructive mt-1">{errors.servings}</p>
              )}
            </div>

            <div>
              <label htmlFor="prepTime" className="block text-sm font-medium mb-1.5">
                <Clock className="inline h-4 w-4 mr-1" />
                Prep (min)
              </label>
              <Input
                id="prepTime"
                type="number"
                min={0}
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="cookTime" className="block text-sm font-medium mb-1.5">
                <Clock className="inline h-4 w-4 mr-1" />
                Cook (min)
              </label>
              <Input
                id="cookTime"
                type="number"
                min={0}
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="cuisine" className="block text-sm font-medium mb-1.5">
                <ChefHat className="inline h-4 w-4 mr-1" />
                Cuisine
              </label>
              <select
                id="cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className={cn(
                  'flex h-11 w-full rounded-sm border-[1.5px] border-input bg-transparent px-3 py-2 text-sm shadow-sm appearance-none cursor-pointer',
                  'transition-all duration-200 ease-out',
                  'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
                  'hover:border-primary/50'
                )}
              >
                <option value="">Select...</option>
                {CUISINES.map((c) => (
                  <option key={c} value={c.toLowerCase()}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label id="difficulty-label" className="block text-sm font-medium mb-2.5">
              Difficulty
            </label>
            <div className="flex gap-3" role="group" aria-labelledby="difficulty-label">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDifficulty(difficulty === d.value ? '' : d.value)}
                  aria-pressed={difficulty === d.value}
                  className={cn(
                    'px-4 py-2 rounded-sm border-[1.5px] text-sm font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    difficulty === d.value
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-background border-input hover:border-primary/50 hover:bg-muted/50'
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ingredients Section */}
      <Card variant="elevated" className="overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="font-display text-h3">Ingredients</CardTitle>
          <CardDescription>
            Add the ingredients needed for this recipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {/* Column headers */}
          <div className="hidden sm:flex gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1 border-b border-border/30">
            <div className="w-20">Qty</div>
            <div className="w-24">Unit</div>
            <div className="flex-1">Ingredient</div>
            <div className="w-32">Notes</div>
            <div className="w-10"></div>
          </div>
          {ingredients.map((ing, index) => (
            <div
              key={ing.id}
              className="flex flex-wrap sm:flex-nowrap gap-2 items-center group transition-all duration-200 ease-out p-2 -mx-2 rounded-sm hover:bg-muted/30"
            >
              <div className="w-16 sm:w-20">
                <Input
                  type="text"
                  value={ing.quantity}
                  onChange={(e) => updateIngredient(ing.id, 'quantity', e.target.value)}
                  placeholder="Qty"
                  className="text-center font-mono"
                />
              </div>
              <div className="w-16 sm:w-24">
                <Input
                  type="text"
                  value={ing.unit}
                  onChange={(e) => updateIngredient(ing.id, 'unit', e.target.value)}
                  placeholder="Unit"
                />
              </div>
              <div className="flex-1 min-w-[120px]">
                <Input
                  type="text"
                  value={ing.name}
                  onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                  placeholder="Ingredient name"
                />
              </div>
              <div className="w-32 hidden sm:block">
                <Input
                  type="text"
                  value={ing.notes}
                  onChange={(e) => updateIngredient(ing.id, 'notes', e.target.value)}
                  placeholder="Notes"
                  className="text-muted-foreground"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeIngredient(ing.id)}
                disabled={ingredients.length <= 1}
                className="shrink-0 h-10 w-10 touch-manipulation opacity-50 group-hover:opacity-100 transition-opacity duration-200"
                aria-label={`Remove ingredient ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIngredient}
            className="mt-3"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Ingredient
          </Button>
        </CardContent>
      </Card>

      {/* Instructions Section */}
      <Card variant="elevated" className="overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="font-display text-h3">Instructions</CardTitle>
          <CardDescription>
            Add step-by-step instructions for preparing this recipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {instructions.map((inst, index) => (
            <div
              key={inst.id}
              className="flex gap-3 items-start group transition-all duration-200 ease-out"
            >
              <div className="w-8 h-11 flex items-center justify-center text-sm font-mono font-semibold text-primary bg-primary/10 rounded-sm shrink-0">
                {index + 1}
              </div>
              <div className="flex-1">
                <textarea
                  value={inst.text}
                  onChange={(e) => updateInstruction(inst.id, e.target.value)}
                  placeholder={`Describe step ${index + 1}...`}
                  rows={2}
                  className={cn(
                    'flex min-h-[100px] w-full rounded-sm border-[1.5px] border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-y',
                    'placeholder:text-muted-foreground placeholder:italic',
                    'transition-all duration-200 ease-out',
                    'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
                    'disabled:cursor-not-allowed disabled:opacity-50'
                  )}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeInstruction(inst.id)}
                disabled={instructions.length <= 1}
                className="shrink-0 h-10 w-10 touch-manipulation opacity-50 group-hover:opacity-100 transition-opacity duration-200"
                aria-label={`Remove step ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {errors.instructions && (
            <p className="text-sm text-destructive">{errors.instructions}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addInstruction}
            className="mt-3"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Step
          </Button>
        </CardContent>
      </Card>

      {/* Tags Section */}
      <Card variant="elevated" className="overflow-hidden">
        <CardHeader className="border-b border-border/50 bg-muted/30">
          <CardTitle className="font-display text-h3">Tags</CardTitle>
          <CardDescription>
            Add tags to help categorize and find this recipe.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TagInput
            value={tags}
            onChange={setTags}
            placeholder="Type a tag and press Enter..."
          />
        </CardContent>
      </Card>

      {/* Submit Error */}
      {errors.submit && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {errors.submit}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : mode === 'create' ? (
            'Create Recipe'
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
