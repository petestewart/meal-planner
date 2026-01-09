/**
 * API Client for the Meal Planner Web Frontend
 *
 * Typed API client wrapper with error handling for all backend endpoints.
 * Uses NEXT_PUBLIC_API_URL environment variable for the base URL.
 */

import type {
  ApiResponse,
  ApiError,
  Recipe,
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
  PantryItemWithIngredient,
  PantryListResponse,
  AddPantryItemInput,
  AddPantryItemResponse,
  UpdatePantryItemInput,
  ListPantryOptions,
} from '@/types/api';

// ==================== Configuration ====================

/**
 * Base URL for API requests
 * Falls back to localhost:3000/api if not set
 */
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// ==================== Error Handling ====================

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.details = error.details;
  }
}

// ==================== Core Fetch Wrapper ====================

/**
 * Type-safe fetch wrapper with error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  // Handle 204 No Content responses
  if (response.status === 204) {
    return undefined as T;
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new ApiClientError(data.error);
  }

  return data.data;
}

// ==================== Recipe API ====================

/**
 * Build query string from options object
 */
function buildQueryString(
  params: { [key: string]: string | number | boolean | undefined | null }
): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Recipe API methods
 */
export const recipeApi = {
  /**
   * List/search recipes with pagination
   */
  list: (options: ListRecipesOptions = {}): Promise<RecipeListResponse> => {
    const queryString = buildQueryString(options);
    return apiFetch<RecipeListResponse>(`/recipes${queryString}`);
  },

  /**
   * Get a single recipe by ID
   */
  get: (id: string): Promise<RecipeWithRelations> => {
    return apiFetch<RecipeWithRelations>(`/recipes/${encodeURIComponent(id)}`);
  },

  /**
   * Create a new recipe
   */
  create: (input: CreateRecipeInput): Promise<RecipeWithRelations> => {
    return apiFetch<RecipeWithRelations>('/recipes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update an existing recipe
   */
  update: (
    id: string,
    input: UpdateRecipeInput
  ): Promise<RecipeWithRelations> => {
    return apiFetch<RecipeWithRelations>(
      `/recipes/${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );
  },

  /**
   * Delete a recipe
   */
  delete: (id: string): Promise<{ deleted: boolean }> => {
    return apiFetch<{ deleted: boolean }>(
      `/recipes/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
  },

  /**
   * Import a recipe from a URL
   */
  import: (input: ImportRecipeInput): Promise<RecipeWithRelations> => {
    return apiFetch<RecipeWithRelations>('/recipes/import', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Scale a recipe to specified servings (returns a copy, does not modify stored recipe)
   */
  scale: (
    id: string,
    servings: number
  ): Promise<RecipeWithRelations> => {
    return apiFetch<RecipeWithRelations>(
      `/recipes/${encodeURIComponent(id)}/scale`,
      {
        method: 'POST',
        body: JSON.stringify({ servings }),
      }
    );
  },

  /**
   * Toggle recipe favorite status
   */
  toggleFavorite: (id: string): Promise<FavoriteToggleResponse> => {
    return apiFetch<FavoriteToggleResponse>(
      `/recipes/${encodeURIComponent(id)}/favorite`,
      {
        method: 'POST',
      }
    );
  },

  /**
   * Get recipe modifications (personal notes)
   */
  getModifications: (id: string): Promise<RecipeModification | null> => {
    return apiFetch<RecipeModification | null>(
      `/recipes/${encodeURIComponent(id)}/modifications`
    );
  },

  /**
   * Update recipe modifications
   */
  updateModifications: (
    id: string,
    input: UpdateModificationsInput
  ): Promise<RecipeModification> => {
    return apiFetch<RecipeModification>(
      `/recipes/${encodeURIComponent(id)}/modifications`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );
  },

  /**
   * Clear recipe modifications
   */
  clearModifications: (id: string): Promise<{ deleted: boolean }> => {
    return apiFetch<{ deleted: boolean }>(
      `/recipes/${encodeURIComponent(id)}/modifications`,
      {
        method: 'DELETE',
      }
    );
  },
};

// ==================== Plan API ====================

/**
 * Plan API methods
 */
export const planApi = {
  /**
   * Create a new weekly plan
   */
  create: (input: CreatePlanInput): Promise<WeeklyPlanWithItems> => {
    return apiFetch<WeeklyPlanWithItems>('/plans', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Get a plan by week
   */
  get: (week: string): Promise<WeeklyPlanWithItems> => {
    return apiFetch<WeeklyPlanWithItems>(
      `/plans/${encodeURIComponent(week)}`
    );
  },

  /**
   * Set a meal for a specific day/meal slot
   */
  setMeal: (
    week: string,
    day: number,
    mealType: string,
    input: SetMealInput
  ): Promise<PlanItem> => {
    return apiFetch<PlanItem>(
      `/plans/${encodeURIComponent(week)}/meals/${day}/${encodeURIComponent(mealType)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );
  },

  /**
   * Update plan status
   */
  updateStatus: (
    week: string,
    input: UpdatePlanStatusInput
  ): Promise<WeeklyPlanWithItems> => {
    return apiFetch<WeeklyPlanWithItems>(
      `/plans/${encodeURIComponent(week)}/status`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );
  },

  /**
   * Get meal suggestions for empty slots
   */
  suggest: (
    week: string,
    options: SuggestOptions = {}
  ): Promise<SuggestionsResponse> => {
    return apiFetch<SuggestionsResponse>(
      `/plans/${encodeURIComponent(week)}/suggest`,
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    );
  },
};

// ==================== Grocery API ====================

/**
 * Grocery API methods
 */
export const groceryApi = {
  /**
   * Generate and persist a grocery list for a week
   */
  generate: (input: GenerateGroceryInput): Promise<GroceryListResponse> => {
    return apiFetch<GroceryListResponse>('/grocery/generate', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Get a persistent grocery list by week
   */
  get: (week: string, status?: string): Promise<GroceryList> => {
    const queryString = status ? `?status=${encodeURIComponent(status)}` : '';
    return apiFetch<GroceryList>(
      `/grocery-list/${encodeURIComponent(week)}${queryString}`
    );
  },

  /**
   * Get a specific grocery item
   */
  getItem: (week: string, itemId: string): Promise<GroceryItem> => {
    return apiFetch<GroceryItem>(
      `/grocery-list/${encodeURIComponent(week)}/items/${encodeURIComponent(itemId)}`
    );
  },

  /**
   * Update a grocery item
   */
  updateItem: (
    week: string,
    itemId: string,
    input: UpdateGroceryItemInput
  ): Promise<GroceryItem> => {
    return apiFetch<GroceryItem>(
      `/grocery-list/${encodeURIComponent(week)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );
  },

  /**
   * Add a manual item to the grocery list
   */
  addItem: (week: string, input: AddGroceryItemInput): Promise<GroceryItem> => {
    return apiFetch<GroceryItem>(
      `/grocery-list/${encodeURIComponent(week)}/items`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
  },

  /**
   * Delete a grocery item
   */
  deleteItem: (week: string, itemId: string): Promise<void> => {
    return apiFetch<void>(
      `/grocery-list/${encodeURIComponent(week)}/items/${encodeURIComponent(itemId)}`,
      {
        method: 'DELETE',
      }
    );
  },

  /**
   * Bulk check items from pantry
   */
  checkPantry: (week: string): Promise<CheckPantryResponse> => {
    return apiFetch<CheckPantryResponse>(
      `/grocery-list/${encodeURIComponent(week)}/check-pantry`,
      {
        method: 'POST',
      }
    );
  },
};

// ==================== Preferences API ====================

/**
 * Preferences API methods
 */
export const preferencesApi = {
  /**
   * Get all user preferences
   */
  get: (): Promise<UserPreferences> => {
    return apiFetch<UserPreferences>('/preferences');
  },

  /**
   * Update user preferences (partial update)
   */
  update: (input: UpdatePreferencesInput): Promise<UserPreferences> => {
    return apiFetch<UserPreferences>('/preferences', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
};

// ==================== Pantry API ====================

/**
 * Pantry API methods
 */
export const pantryApi = {
  /**
   * List all pantry items
   */
  list: (options: ListPantryOptions = {}): Promise<PantryListResponse> => {
    const queryString = buildQueryString(options);
    return apiFetch<PantryListResponse>(`/pantry${queryString}`);
  },

  /**
   * List items expiring within 7 days
   */
  listExpiring: (): Promise<PantryListResponse> => {
    return apiFetch<PantryListResponse>('/pantry/expiring');
  },

  /**
   * List staple items
   */
  listStaples: (): Promise<PantryListResponse> => {
    return apiFetch<PantryListResponse>('/pantry/staples');
  },

  /**
   * Add an item to the pantry
   */
  add: (input: AddPantryItemInput): Promise<AddPantryItemResponse> => {
    return apiFetch<AddPantryItemResponse>('/pantry', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update a pantry item
   */
  update: (
    ingredientName: string,
    input: UpdatePantryItemInput
  ): Promise<PantryItemWithIngredient> => {
    return apiFetch<PantryItemWithIngredient>(
      `/pantry/${encodeURIComponent(ingredientName)}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );
  },

  /**
   * Remove an item from the pantry
   */
  remove: (ingredientName: string): Promise<{ deleted: boolean }> => {
    return apiFetch<{ deleted: boolean }>(
      `/pantry/${encodeURIComponent(ingredientName)}`,
      {
        method: 'DELETE',
      }
    );
  },

  /**
   * Use (decrement) a pantry item quantity
   */
  use: (
    ingredientName: string,
    quantity: number
  ): Promise<PantryItemWithIngredient> => {
    return apiFetch<PantryItemWithIngredient>(
      `/pantry/${encodeURIComponent(ingredientName)}/use`,
      {
        method: 'POST',
        body: JSON.stringify({ quantity }),
      }
    );
  },
};

// ==================== Combined API Client ====================

/**
 * Combined API client with all methods
 */
export const api = {
  recipes: recipeApi,
  plans: planApi,
  grocery: groceryApi,
  preferences: preferencesApi,
  pantry: pantryApi,
};

export default api;
