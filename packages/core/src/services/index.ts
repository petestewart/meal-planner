// Service exports

export {
  RecipeService,
  type IngredientWithSubstitutions,
  type RecipeSubstitutionSuggestions,
} from './recipe.service.js';
export { PlanService } from './plan.service.js';
export {
  GroceryService,
  type GroceryItem,
  type GroceryGroup,
  type GroceryList,
  type GroceryListItemWithStatus,
  type PersistentGroceryList,
  type CheckPantryResult,
  type GenerateListOptions,
} from './grocery.service.js';

export {
  PantryService,
  type AddPantryItemInput,
  type AddPantryItemResult,
} from './pantry.service.js';
export { PreferenceService } from './preference.service.js';
export {
  ImportService,
  type ImportedRecipeData,
  type ImportResult,
  type SaveImportResult,
  type ImportOptions,
} from './import.service.js';
export {
  SuggestionService,
  type SuggestionReason,
  type RecipeSuggestion,
  type SuggestionContext,
  type GetSuggestionsOptions,
  SCORING_WEIGHTS,
  RECENT_DAYS_THRESHOLD,
} from './suggestion.service.js';

export { PrepBatchService } from './prep-batch.service.js';

export {
  SubstitutionService,
  type SubstitutionSuggestion,
  type GetSubstitutionSuggestionsOptions,
} from './substitution.service.js';

export {
  PrepDayService,
  type PrepTaskItem,
  type PrepTask,
  type PrepDayBatch,
  type RecipeSummary,
  type PrepDaySummary,
} from './prep-day.service.js';
