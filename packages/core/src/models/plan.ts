import { z } from 'zod';

/**
 * ISO week format validation regex.
 * Format: YYYY-Www where ww is 01-53 (weeks)
 * Examples: 2025-W01, 2025-W52, 2024-W53
 */
export const ISO_WEEK_REGEX = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

/**
 * ISO week schema for validating week strings like "2025-W02".
 */
export const IsoWeekSchema = z.string().regex(
  ISO_WEEK_REGEX,
  'Invalid ISO week format. Expected YYYY-Www (e.g., 2025-W02)'
);
export type IsoWeek = z.infer<typeof IsoWeekSchema>;

/**
 * Helper function to validate ISO week format.
 * @param week - The week string to validate
 * @returns true if valid ISO week format, false otherwise
 */
export function isValidIsoWeek(week: string): boolean {
  return ISO_WEEK_REGEX.test(week);
}

/**
 * Valid plan status values as defined in the database schema.
 */
export const PlanStatusEnum = z.enum(['draft', 'active', 'completed']);
export type PlanStatus = z.infer<typeof PlanStatusEnum>;

/**
 * Valid meal type values as defined in the database schema.
 */
export const MealTypeEnum = z.enum(['breakfast', 'lunch', 'dinner']);
export type MealType = z.infer<typeof MealTypeEnum>;

/**
 * Valid slot type values for plan items.
 * - 'recipe': A regular meal with a recipe
 * - 'dining_out': Eating out (no recipe needed)
 * - 'skip': Skipping this meal
 * - 'leftovers': Eating leftovers from another meal
 */
export const SlotTypeEnum = z.enum(['recipe', 'dining_out', 'skip', 'leftovers']);
export type SlotType = z.infer<typeof SlotTypeEnum>;

/**
 * Day of week validation (1=Monday through 7=Sunday).
 */
export const DayOfWeekSchema = z.number().int().min(1).max(7);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

/**
 * WeeklyPlan schema matching the database `weekly_plans` table.
 *
 * Represents a weekly meal plan with status and notes.
 */
export const WeeklyPlanSchema = z.object({
  id: z.string().min(1, 'WeeklyPlan ID is required'),
  week: IsoWeekSchema,
  status: PlanStatusEnum.default('draft'),
  notes: z.string().nullable(),
  createdAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)),
  updatedAt: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)),
});

export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>;

/**
 * Schema for creating a new weekly plan (without id and timestamps).
 */
export const CreateWeeklyPlanSchema = WeeklyPlanSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type CreateWeeklyPlan = z.infer<typeof CreateWeeklyPlanSchema>;

/**
 * Schema for updating a weekly plan (all fields optional except id).
 */
export const UpdateWeeklyPlanSchema = WeeklyPlanSchema.omit({
  createdAt: true,
  updatedAt: true,
}).partial().required({ id: true });
export type UpdateWeeklyPlan = z.infer<typeof UpdateWeeklyPlanSchema>;

/**
 * PlanItem schema matching the database `plan_items` table.
 *
 * Represents a single meal entry within a weekly plan.
 */
export const PlanItemSchema = z.object({
  id: z.string().min(1, 'PlanItem ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  recipeId: z.string().min(1).nullable(),
  dayOfWeek: DayOfWeekSchema,
  mealType: MealTypeEnum,
  servings: z.number().int().positive().default(2),
  notes: z.string().nullable(),
  slotType: SlotTypeEnum.default('recipe'),
  leftoversSourceId: z.string().nullable().optional(),
});

export type PlanItem = z.infer<typeof PlanItemSchema>;

/**
 * Schema for creating a new plan item (without id).
 */
export const CreatePlanItemSchema = PlanItemSchema.omit({ id: true });
export type CreatePlanItem = z.infer<typeof CreatePlanItemSchema>;

/**
 * Schema for updating a plan item (all fields optional except id).
 */
export const UpdatePlanItemSchema = PlanItemSchema.partial().required({ id: true });
export type UpdatePlanItem = z.infer<typeof UpdatePlanItemSchema>;

/**
 * Weekly plan with all its plan items.
 * Used when loading a complete weekly plan from the database.
 */
export const WeeklyPlanWithItemsSchema = WeeklyPlanSchema.extend({
  items: z.array(PlanItemSchema).optional(),
});

export type WeeklyPlanWithItems = z.infer<typeof WeeklyPlanWithItemsSchema>;
