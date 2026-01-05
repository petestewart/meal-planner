'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { TagInput } from '@/components/settings/TagInput';
import { usePreferences, useUpdatePreferences } from '@/lib/queries';
import type { PrepDay, UpdatePreferencesInput } from '@/types/api';

const MEAL_TYPE_OPTIONS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

const DIETARY_RESTRICTION_OPTIONS = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-Free' },
  { id: 'dairy-free', label: 'Dairy-Free' },
  { id: 'nut-free', label: 'Nut-Free' },
  { id: 'keto', label: 'Keto' },
  { id: 'paleo', label: 'Paleo' },
  { id: 'low-carb', label: 'Low-Carb' },
];

const CUISINE_OPTIONS = [
  { id: 'italian', label: 'Italian' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'asian', label: 'Asian' },
  { id: 'american', label: 'American' },
  { id: 'mediterranean', label: 'Mediterranean' },
  { id: 'indian', label: 'Indian' },
  { id: 'french', label: 'French' },
  { id: 'thai', label: 'Thai' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'chinese', label: 'Chinese' },
];

const PREP_DAY_OPTIONS: { id: PrepDay; label: string }[] = [
  { id: 'sunday', label: 'Sunday' },
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
  { id: 'saturday', label: 'Saturday' },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data: preferences, isLoading, error } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  // Debounced update function
  const debouncedUpdateRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleUpdate = React.useCallback(
    (updates: UpdatePreferencesInput) => {
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
      }
      debouncedUpdateRef.current = setTimeout(() => {
        updatePreferences.mutate(updates);
      }, 500);
    },
    [updatePreferences]
  );

  // Cleanup debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debouncedUpdateRef.current) {
        clearTimeout(debouncedUpdateRef.current);
      }
    };
  }, []);

  const handleMealTypeToggle = (mealType: string, checked: boolean) => {
    if (!preferences) return;
    const newMealTypes = checked
      ? [...preferences.mealTypes, mealType]
      : preferences.mealTypes.filter((t) => t !== mealType);
    handleUpdate({ mealTypes: newMealTypes });
  };

  const handleDietaryToggle = (restriction: string, checked: boolean) => {
    if (!preferences) return;
    const newRestrictions = checked
      ? [...preferences.dietaryRestrictions, restriction]
      : preferences.dietaryRestrictions.filter((r) => r !== restriction);
    handleUpdate({ dietaryRestrictions: newRestrictions });
  };

  const handleCuisineToggle = (cuisine: string, checked: boolean) => {
    if (!preferences) return;
    const newCuisines = checked
      ? [...preferences.favoriteCuisines, cuisine]
      : preferences.favoriteCuisines.filter((c) => c !== cuisine);
    handleUpdate({ favoriteCuisines: newCuisines });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          Failed to load preferences: {error.message}
        </div>
      </div>
    );
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Configure your meal planner preferences.
        </p>
        {updatePreferences.isPending && (
          <p className="mt-2 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* Appearance Section */}
        <SettingsSection
          title="Appearance"
          description="Customize how the app looks"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Dark Mode</p>
              <p className="text-sm text-muted-foreground">
                Switch between light and dark themes
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </SettingsSection>

        {/* Household Section */}
        <SettingsSection
          title="Household"
          description="Set your household size and default servings"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="householdSize" className="text-sm font-medium">
                Household Size
              </label>
              <Input
                id="householdSize"
                type="number"
                min={1}
                max={12}
                value={preferences.householdSize}
                onChange={(e) => {
                  const value = Math.min(12, Math.max(1, parseInt(e.target.value) || 1));
                  handleUpdate({ householdSize: value });
                }}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Number of people in your household (1-12)
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="defaultServings" className="text-sm font-medium">
                Default Servings
              </label>
              <Input
                id="defaultServings"
                type="number"
                min={1}
                max={12}
                value={preferences.defaultServings}
                onChange={(e) => {
                  const value = Math.min(12, Math.max(1, parseInt(e.target.value) || 1));
                  handleUpdate({ defaultServings: value });
                }}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Default number of servings for meals (1-12)
              </p>
            </div>
          </div>
        </SettingsSection>

        {/* Meal Types Section */}
        <SettingsSection
          title="Meal Types"
          description="Select which meals you want to plan"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {MEAL_TYPE_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-center space-x-3">
                <Checkbox
                  id={`meal-${option.id}`}
                  checked={preferences.mealTypes.includes(option.id)}
                  onCheckedChange={(checked) =>
                    handleMealTypeToggle(option.id, checked === true)
                  }
                />
                <label
                  htmlFor={`meal-${option.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Dietary Restrictions Section */}
        <SettingsSection
          title="Dietary Restrictions"
          description="Select any dietary restrictions to consider when planning meals"
        >
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {DIETARY_RESTRICTION_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-center space-x-3">
                <Checkbox
                  id={`dietary-${option.id}`}
                  checked={preferences.dietaryRestrictions.includes(option.id)}
                  onCheckedChange={(checked) =>
                    handleDietaryToggle(option.id, checked === true)
                  }
                />
                <label
                  htmlFor={`dietary-${option.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Disliked Ingredients Section */}
        <SettingsSection
          title="Disliked Ingredients"
          description="Add ingredients you want to avoid in your meal plans"
        >
          <TagInput
            value={preferences.dislikedIngredients}
            onChange={(value) => handleUpdate({ dislikedIngredients: value })}
            placeholder="Type an ingredient and press Enter..."
          />
        </SettingsSection>

        {/* Favorite Cuisines Section */}
        <SettingsSection
          title="Favorite Cuisines"
          description="Select your preferred cuisine types"
        >
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {CUISINE_OPTIONS.map((option) => (
              <div key={option.id} className="flex items-center space-x-3">
                <Checkbox
                  id={`cuisine-${option.id}`}
                  checked={preferences.favoriteCuisines.includes(option.id)}
                  onCheckedChange={(checked) =>
                    handleCuisineToggle(option.id, checked === true)
                  }
                />
                <label
                  htmlFor={`cuisine-${option.id}`}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </SettingsSection>

        {/* Cooking Preferences Section */}
        <SettingsSection
          title="Cooking Preferences"
          description="Set your cooking time preferences and prep schedule"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="maxPrepTime" className="text-sm font-medium">
                Maximum Prep Time (minutes)
              </label>
              <Input
                id="maxPrepTime"
                type="number"
                min={0}
                max={240}
                value={preferences.maxPrepTimeMinutes ?? ''}
                onChange={(e) => {
                  const value = e.target.value
                    ? Math.min(240, Math.max(0, parseInt(e.target.value)))
                    : null;
                  handleUpdate({ maxPrepTimeMinutes: value });
                }}
                placeholder="No limit"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Maximum time you want to spend on meal prep (0-240 minutes)
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="prepDay" className="text-sm font-medium">
                Prep Day
              </label>
              <select
                id="prepDay"
                value={preferences.prepDay ?? ''}
                onChange={(e) => {
                  const value = e.target.value as PrepDay | '';
                  handleUpdate({ prepDay: value || null });
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">No specific day</option>
                {PREP_DAY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Day you typically do meal prep
              </p>
            </div>
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
