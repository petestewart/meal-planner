'use client';

/**
 * TanStack Query Hooks for the Meal Planner Web Frontend
 *
 * Provides React Query hooks for all API operations with proper
 * caching, error handling, and loading states.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from '@tanstack/react-query';

import {
  recipeApi,
  planApi,
  groceryApi,
  preferencesApi,
  ApiClientError,
} from './api';

import type {
  RecipeWithRelations,
  RecipeListResponse,
  ListRecipesOptions,
  CreateRecipeInput,
  UpdateRecipeInput,
  ImportRecipeInput,
  FavoriteToggleResponse,
  RecipeModification,
  UpdateModificationsInput,
  WeeklyPlanWithItems,
  PlanItem,
  CreatePlanInput,
  SetMealInput,
  UpdatePlanStatusInput,
  SuggestionsResponse,
  SuggestOptions,
  GroceryList,
  GroceryListResponse,
  GroceryItem,
  GenerateGroceryInput,
  UpdateGroceryItemInput,
  AddGroceryItemInput,
  CheckPantryResponse,
  UserPreferences,
  UpdatePreferencesInput,
  MealType,
} from '@/types/api';

// ==================== Query Keys ====================

/**
 * Query key factory for consistent cache key management
 */
export const queryKeys = {
  // Recipe keys
  recipes: {
    all: ['recipes'] as const,
    lists: () => [...queryKeys.recipes.all, 'list'] as const,
    list: (options: ListRecipesOptions) =>
      [...queryKeys.recipes.lists(), options] as const,
    details: () => [...queryKeys.recipes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.recipes.details(), id] as const,
    modifications: (id: string) =>
      [...queryKeys.recipes.detail(id), 'modifications'] as const,
  },

  // Plan keys
  plans: {
    all: ['plans'] as const,
    details: () => [...queryKeys.plans.all, 'detail'] as const,
    detail: (week: string) => [...queryKeys.plans.details(), week] as const,
    suggestions: (week: string) =>
      [...queryKeys.plans.detail(week), 'suggestions'] as const,
  },

  // Grocery keys
  grocery: {
    all: ['grocery'] as const,
    lists: () => [...queryKeys.grocery.all, 'list'] as const,
    list: (week: string) => [...queryKeys.grocery.lists(), week] as const,
    items: (week: string) =>
      [...queryKeys.grocery.list(week), 'items'] as const,
    item: (week: string, itemId: string) =>
      [...queryKeys.grocery.items(week), itemId] as const,
  },

  // Preferences keys
  preferences: {
    all: ['preferences'] as const,
  },
} as const;

// ==================== Recipe Hooks ====================

/**
 * Hook to fetch recipes with search/filter options
 */
export function useRecipes(
  options: ListRecipesOptions = {},
  queryOptions?: Omit<
    UseQueryOptions<RecipeListResponse, ApiClientError>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.recipes.list(options),
    queryFn: () => recipeApi.list(options),
    ...queryOptions,
  });
}

/**
 * Hook to fetch a single recipe by ID
 */
export function useRecipe(
  id: string,
  queryOptions?: Omit<
    UseQueryOptions<RecipeWithRelations, ApiClientError>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.recipes.detail(id),
    queryFn: () => recipeApi.get(id),
    enabled: !!id,
    ...queryOptions,
  });
}

/**
 * Hook to fetch recipe modifications
 */
export function useRecipeModifications(
  id: string,
  queryOptions?: Omit<
    UseQueryOptions<RecipeModification | null, ApiClientError>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.recipes.modifications(id),
    queryFn: () => recipeApi.getModifications(id),
    enabled: !!id,
    ...queryOptions,
  });
}

/**
 * Hook to create a new recipe
 */
export function useCreateRecipe(
  mutationOptions?: Omit<
    UseMutationOptions<RecipeWithRelations, ApiClientError, CreateRecipeInput>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRecipeInput) => recipeApi.create(input),
    onSuccess: () => {
      // Invalidate recipe lists to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.lists() });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to update an existing recipe
 */
export function useUpdateRecipe(
  mutationOptions?: Omit<
    UseMutationOptions<
      RecipeWithRelations,
      ApiClientError,
      { id: string; input: UpdateRecipeInput }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRecipeInput }) =>
      recipeApi.update(id, input),
    onSuccess: (data) => {
      // Update the recipe in the cache
      queryClient.setQueryData(queryKeys.recipes.detail(data.id), data);
      // Invalidate recipe lists
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.lists() });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to delete a recipe
 */
export function useDeleteRecipe(
  mutationOptions?: Omit<
    UseMutationOptions<{ deleted: boolean }, ApiClientError, string>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recipeApi.delete(id),
    onSuccess: (_, id) => {
      // Remove the recipe from the cache
      queryClient.removeQueries({ queryKey: queryKeys.recipes.detail(id) });
      // Invalidate recipe lists
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.lists() });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to import a recipe from URL
 */
export function useImportRecipe(
  mutationOptions?: Omit<
    UseMutationOptions<RecipeWithRelations, ApiClientError, ImportRecipeInput>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ImportRecipeInput) => recipeApi.import(input),
    onSuccess: () => {
      // Invalidate recipe lists to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.lists() });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to scale a recipe
 */
export function useScaleRecipe(
  mutationOptions?: Omit<
    UseMutationOptions<
      RecipeWithRelations,
      ApiClientError,
      { id: string; servings: number }
    >,
    'mutationFn'
  >
) {
  return useMutation({
    mutationFn: ({ id, servings }: { id: string; servings: number }) =>
      recipeApi.scale(id, servings),
    ...mutationOptions,
  });
}

/**
 * Hook to toggle recipe favorite status
 */
export function useToggleFavorite(
  mutationOptions?: Omit<
    UseMutationOptions<FavoriteToggleResponse, ApiClientError, string>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recipeApi.toggleFavorite(id),
    onSuccess: (data) => {
      // Update the recipe in the cache if it exists
      queryClient.setQueryData<RecipeWithRelations>(
        queryKeys.recipes.detail(data.id),
        (old) => (old ? { ...old, isFavorite: data.isFavorite } : undefined)
      );
      // Invalidate recipe lists to update favorite status
      queryClient.invalidateQueries({ queryKey: queryKeys.recipes.lists() });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to update recipe modifications
 */
export function useUpdateModifications(
  mutationOptions?: Omit<
    UseMutationOptions<
      RecipeModification,
      ApiClientError,
      { id: string; input: UpdateModificationsInput }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateModificationsInput;
    }) => recipeApi.updateModifications(id, input),
    onSuccess: (data) => {
      // Update modifications in the cache
      queryClient.setQueryData(
        queryKeys.recipes.modifications(data.recipeId),
        data
      );
    },
    ...mutationOptions,
  });
}

/**
 * Hook to clear recipe modifications
 */
export function useClearModifications(
  mutationOptions?: Omit<
    UseMutationOptions<{ deleted: boolean }, ApiClientError, string>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => recipeApi.clearModifications(id),
    onSuccess: (_, id) => {
      // Clear modifications from cache
      queryClient.setQueryData(queryKeys.recipes.modifications(id), null);
    },
    ...mutationOptions,
  });
}

// ==================== Plan Hooks ====================

/**
 * Hook to fetch a plan by week
 */
export function usePlan(
  week: string,
  queryOptions?: Omit<
    UseQueryOptions<WeeklyPlanWithItems, ApiClientError>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.plans.detail(week),
    queryFn: () => planApi.get(week),
    enabled: !!week,
    ...queryOptions,
  });
}

/**
 * Hook to fetch meal suggestions for a plan
 */
export function useSuggestions(
  week: string,
  options: SuggestOptions = {},
  queryOptions?: Omit<
    UseQueryOptions<SuggestionsResponse, ApiClientError>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.plans.suggestions(week),
    queryFn: () => planApi.suggest(week, options),
    enabled: !!week,
    ...queryOptions,
  });
}

/**
 * Hook to create a new plan
 */
export function useCreatePlan(
  mutationOptions?: Omit<
    UseMutationOptions<WeeklyPlanWithItems, ApiClientError, CreatePlanInput>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePlanInput) => planApi.create(input),
    onSuccess: (data) => {
      // Add the new plan to the cache
      queryClient.setQueryData(queryKeys.plans.detail(data.week), data);
    },
    ...mutationOptions,
  });
}

/**
 * Hook to set a meal in a plan
 */
export function useSetMeal(
  mutationOptions?: Omit<
    UseMutationOptions<
      PlanItem,
      ApiClientError,
      { week: string; day: number; mealType: MealType; input: SetMealInput }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      week,
      day,
      mealType,
      input,
    }: {
      week: string;
      day: number;
      mealType: MealType;
      input: SetMealInput;
    }) => planApi.setMeal(week, day, mealType, input),
    onSuccess: (_, { week }) => {
      // Invalidate the plan to refetch with updated items
      queryClient.invalidateQueries({ queryKey: queryKeys.plans.detail(week) });
      // Also invalidate suggestions as they may change
      queryClient.invalidateQueries({
        queryKey: queryKeys.plans.suggestions(week),
      });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to update plan status
 */
export function useUpdatePlanStatus(
  mutationOptions?: Omit<
    UseMutationOptions<
      WeeklyPlanWithItems,
      ApiClientError,
      { week: string; input: UpdatePlanStatusInput }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      week,
      input,
    }: {
      week: string;
      input: UpdatePlanStatusInput;
    }) => planApi.updateStatus(week, input),
    onSuccess: (data) => {
      // Update the plan in the cache
      queryClient.setQueryData(queryKeys.plans.detail(data.week), data);
    },
    ...mutationOptions,
  });
}

// ==================== Grocery Hooks ====================

/**
 * Hook to fetch a grocery list by week
 */
export function useGroceryList(
  week: string,
  status?: string,
  queryOptions?: Omit<
    UseQueryOptions<GroceryList, ApiClientError>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.grocery.list(week),
    queryFn: () => groceryApi.get(week, status),
    enabled: !!week,
    ...queryOptions,
  });
}

/**
 * Hook to generate a grocery list
 */
export function useGenerateGroceryList(
  mutationOptions?: Omit<
    UseMutationOptions<GroceryListResponse, ApiClientError, GenerateGroceryInput>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: GenerateGroceryInput) => groceryApi.generate(input),
    onSuccess: (data) => {
      // Update the grocery list in the cache
      queryClient.setQueryData(queryKeys.grocery.list(data.week), data);
    },
    ...mutationOptions,
  });
}

/**
 * Hook to update a grocery item
 */
export function useUpdateGroceryItem(
  mutationOptions?: Omit<
    UseMutationOptions<
      GroceryItem,
      ApiClientError,
      { week: string; itemId: string; input: UpdateGroceryItemInput }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      week,
      itemId,
      input,
    }: {
      week: string;
      itemId: string;
      input: UpdateGroceryItemInput;
    }) => groceryApi.updateItem(week, itemId, input),
    onSuccess: (_, { week }) => {
      // Invalidate the grocery list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.grocery.list(week) });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to add a manual item to the grocery list
 */
export function useAddGroceryItem(
  mutationOptions?: Omit<
    UseMutationOptions<
      GroceryItem,
      ApiClientError,
      { week: string; input: AddGroceryItemInput }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      week,
      input,
    }: {
      week: string;
      input: AddGroceryItemInput;
    }) => groceryApi.addItem(week, input),
    onSuccess: (_, { week }) => {
      // Invalidate the grocery list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.grocery.list(week) });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to delete a grocery item
 */
export function useDeleteGroceryItem(
  mutationOptions?: Omit<
    UseMutationOptions<
      void,
      ApiClientError,
      { week: string; itemId: string }
    >,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ week, itemId }: { week: string; itemId: string }) =>
      groceryApi.deleteItem(week, itemId),
    onSuccess: (_, { week }) => {
      // Invalidate the grocery list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.grocery.list(week) });
    },
    ...mutationOptions,
  });
}

/**
 * Hook to check pantry items
 */
export function useCheckPantry(
  mutationOptions?: Omit<
    UseMutationOptions<CheckPantryResponse, ApiClientError, string>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (week: string) => groceryApi.checkPantry(week),
    onSuccess: (_, week) => {
      // Invalidate the grocery list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.grocery.list(week) });
    },
    ...mutationOptions,
  });
}

// ==================== Preferences Hooks ====================

/**
 * Hook to fetch user preferences
 */
export function usePreferences(
  queryOptions?: Omit<
    UseQueryOptions<UserPreferences, ApiClientError>,
    'queryKey' | 'queryFn'
  >
) {
  return useQuery({
    queryKey: queryKeys.preferences.all,
    queryFn: () => preferencesApi.get(),
    ...queryOptions,
  });
}

/**
 * Hook to update user preferences
 */
export function useUpdatePreferences(
  mutationOptions?: Omit<
    UseMutationOptions<UserPreferences, ApiClientError, UpdatePreferencesInput>,
    'mutationFn'
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePreferencesInput) => preferencesApi.update(input),
    onSuccess: (data) => {
      // Update preferences in the cache
      queryClient.setQueryData(queryKeys.preferences.all, data);
    },
    ...mutationOptions,
  });
}
