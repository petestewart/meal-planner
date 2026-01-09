'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  UtensilsCrossed,
  ShoppingCart,
  ChevronRight,
  Clock,
  Loader2,
  Plus,
  Sun,
  Sunset,
  Moon,
  CheckCircle2,
  Circle,
} from "lucide-react";
import Link from "next/link";
import { usePlan, useRecipes, usePreferences } from "@/lib/queries";
import {
  getCurrentWeek,
  getWeekDates,
  formatWeekDisplay,
  getDayName,
  isToday,
  getDayOfWeek,
} from "@/lib/week-utils";
import {
  DayOfWeek,
  MealType,
  PlanItem,
  RecipeWithRelations,
} from "@/types/api";
import { cn } from "@/lib/utils";

// Helper to get time-based greeting (similar to navigation.tsx)
function getGreeting(): { text: string; subtext: string; icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { text: "Good morning", subtext: "Ready to plan your day?", icon: Sun };
  }
  if (hour < 17) {
    return { text: "Good afternoon", subtext: "What's cooking today?", icon: Sunset };
  }
  return { text: "Good evening", subtext: "Time to unwind with a meal", icon: Moon };
}

// Quick action tiles configuration
const quickActionTiles = [
  {
    href: "/calendar",
    title: "Plan Meals",
    description: "Organize your week",
    icon: Calendar,
    color: "bg-primary/10 text-primary hover:bg-primary/20",
  },
  {
    href: "/recipes/new",
    title: "Add Recipe",
    description: "Save a new dish",
    icon: Plus,
    color: "bg-secondary/10 text-secondary hover:bg-secondary/20",
  },
  {
    href: "/grocery",
    title: "Grocery List",
    description: "View shopping items",
    icon: ShoppingCart,
    color: "bg-accent/30 text-accent-foreground hover:bg-accent/40",
  },
  {
    href: "/recipes",
    title: "Browse Recipes",
    description: "Find something to cook",
    icon: UtensilsCrossed,
    color: "bg-muted text-muted-foreground hover:bg-muted/80",
  },
];

// Default meal types if preferences aren't loaded
const DEFAULT_MEAL_TYPES: MealType[] = ['lunch', 'dinner'];

export default function Home() {
  const currentWeek = getCurrentWeek();
  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  // Fetch current week's plan
  const {
    data: plan,
    isLoading: isPlanLoading,
    error: planError,
  } = usePlan(currentWeek);

  // Fetch user preferences to get meal types
  const { data: preferences } = usePreferences();

  // Fetch recently added recipes (sorted by createdAt descending)
  const {
    data: recipesData,
    isLoading: isRecipesLoading,
  } = useRecipes({ limit: 6 });

  // Get meal types from preferences or use defaults
  const mealTypes = useMemo(() => {
    if (preferences?.mealTypes && preferences.mealTypes.length > 0) {
      return preferences.mealTypes as MealType[];
    }
    return DEFAULT_MEAL_TYPES;
  }, [preferences]);

  // Get week dates for current week
  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek]);

  // Get all unique recipe IDs from the plan
  const recipeIds = useMemo(() => {
    if (!plan?.items) return [];
    return [...new Set(plan.items.filter(item => item.recipeId).map(item => item.recipeId!))] as string[];
  }, [plan?.items]);

  // Fetch recipes for the plan items
  const { data: planRecipesData } = useRecipes(
    { limit: 100 },
    { enabled: recipeIds.length > 0 }
  );

  // Create a map of recipe ID to recipe
  const recipeMap = useMemo(() => {
    const map = new Map<string, RecipeWithRelations>();
    if (planRecipesData?.recipes) {
      for (const recipe of planRecipesData.recipes) {
        map.set(recipe.id, recipe);
      }
    }
    return map;
  }, [planRecipesData?.recipes]);

  // Create a map of plan items by day and meal type
  const planItemMap = useMemo(() => {
    const map = new Map<string, PlanItem>();
    if (plan?.items) {
      for (const item of plan.items) {
        const key = `${item.dayOfWeek}-${item.mealType}`;
        map.set(key, item);
      }
    }
    return map;
  }, [plan?.items]);

  // Helper to get plan item for a specific slot
  const getPlanItem = (day: DayOfWeek, mealType: MealType): PlanItem | undefined => {
    return planItemMap.get(`${day}-${mealType}`);
  };

  // Helper to get recipe for a plan item
  const getRecipe = (planItem?: PlanItem): RecipeWithRelations | undefined => {
    if (!planItem?.recipeId) return undefined;
    return recipeMap.get(planItem.recipeId);
  };

  // Get today's date and day of week
  const todayDate = weekDates.find(d => isToday(d));
  const todayDayOfWeek = todayDate ? getDayOfWeek(todayDate) as DayOfWeek : null;

  // Get today's meals
  const todayMeals = useMemo(() => {
    if (!todayDayOfWeek) return [];
    return mealTypes.map(mealType => {
      const planItem = getPlanItem(todayDayOfWeek, mealType);
      const recipe = getRecipe(planItem);
      return {
        mealType,
        planItem,
        recipe,
      };
    });
  }, [todayDayOfWeek, mealTypes, planItemMap, recipeMap]);

  // Calculate week progress (how many slots are filled vs total)
  const weekProgress = useMemo(() => {
    const totalSlots = weekDates.length * mealTypes.length;
    let filledSlots = 0;

    for (const date of weekDates) {
      const day = getDayOfWeek(date) as DayOfWeek;
      for (const mealType of mealTypes) {
        const planItem = getPlanItem(day, mealType);
        if (planItem?.recipeId || (planItem?.slotType && planItem.slotType !== 'recipe')) {
          filledSlots++;
        }
      }
    }

    return { filled: filledSlots, total: totalSlots, percentage: Math.round((filledSlots / totalSlots) * 100) };
  }, [weekDates, mealTypes, planItemMap]);

  // Recently added recipes (top 4)
  const recentRecipes = recipesData?.recipes?.slice(0, 4) ?? [];

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-8">
        {/* Greeting Section */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <GreetingIcon className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-display font-display text-foreground">
              {greeting.text}
            </h1>
            <p className="text-body text-muted-foreground mt-1">
              {greeting.subtext}
            </p>
          </div>
        </div>

        {/* Today's Meals - Horizontal Scroll Widget */}
        <section aria-labelledby="todays-meals-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="todays-meals-heading" className="text-h2 font-display">Today&apos;s Meals</h2>
            <Link
              href="/calendar"
              className="text-body-sm text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
            >
              View week
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {isPlanLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : planError ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
              Failed to load meal plan. Please try again.
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory">
              {todayMeals.map(({ mealType, planItem, recipe }) => (
                <Link
                  key={mealType}
                  href="/calendar"
                  className="snap-start shrink-0 w-[200px] sm:w-[240px]"
                >
                  <Card
                    variant="interactive"
                    className={cn(
                      "h-full min-h-[140px]",
                      !recipe && !planItem?.slotType && "border-dashed"
                    )}
                  >
                    <CardHeader className="pb-2">
                      <Badge variant="today" className="w-fit capitalize">
                        {mealType}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      {recipe ? (
                        <>
                          <p className="text-h3 font-display line-clamp-2">{recipe.title}</p>
                          {(recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
                            <div className="flex items-center gap-1 text-caption text-muted-foreground mt-2">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min</span>
                            </div>
                          )}
                        </>
                      ) : planItem?.slotType && planItem.slotType !== 'recipe' ? (
                        <p className="text-body text-muted-foreground capitalize">
                          {planItem.slotType === 'dining_out' ? 'Dining Out' : planItem.slotType}
                        </p>
                      ) : (
                        <p className="text-body text-muted-foreground italic">
                          Not planned yet
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Quick Actions - Large Tappable Tiles */}
        <section aria-labelledby="quick-actions-heading">
          <h2 id="quick-actions-heading" className="text-h2 font-display mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {quickActionTiles.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 p-6 rounded-lg min-h-[120px] transition-all duration-200 ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "active:scale-[0.98]",
                    action.color
                  )}
                  style={{ minHeight: '120px' }}
                >
                  <Icon className="h-8 w-8" />
                  <div className="text-center">
                    <p className="text-body font-medium">{action.title}</p>
                    <p className="text-caption text-inherit opacity-70">{action.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Week at a Glance - Simplified Visual Progress */}
        <section aria-labelledby="week-overview-heading">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-h3 font-display">Week Overview</CardTitle>
                <CardDescription>{formatWeekDisplay(currentWeek)}</CardDescription>
              </div>
              <Link
                href="/calendar"
                className="text-body-sm text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
              >
                Plan
                <ChevronRight className="h-4 w-4" />
              </Link>
            </CardHeader>
            <CardContent>
              {isPlanLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-body-sm">
                      <span className="text-muted-foreground">
                        {weekProgress.filled} of {weekProgress.total} meals planned
                      </span>
                      <span className="font-medium text-primary">{weekProgress.percentage}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${weekProgress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Day Summary - Visual Dots */}
                  <div className="flex justify-between gap-1 pt-2">
                    {weekDates.map((date, index) => {
                      const day = getDayOfWeek(date) as DayOfWeek;
                      const today = isToday(date);

                      // Count filled slots for this day
                      let filledCount = 0;
                      for (const mealType of mealTypes) {
                        const planItem = getPlanItem(day, mealType);
                        if (planItem?.recipeId || (planItem?.slotType && planItem.slotType !== 'recipe')) {
                          filledCount++;
                        }
                      }

                      const isComplete = filledCount === mealTypes.length;
                      const isPartial = filledCount > 0 && filledCount < mealTypes.length;

                      return (
                        <div
                          key={index}
                          className={cn(
                            "flex flex-col items-center gap-1.5 flex-1",
                            today && "relative"
                          )}
                        >
                          <span className={cn(
                            "text-caption",
                            today ? "font-semibold text-primary" : "text-muted-foreground"
                          )}>
                            {getDayName(date).slice(0, 3)}
                          </span>
                          <div className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                            today && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                          )}>
                            {isComplete ? (
                              <CheckCircle2 className="h-5 w-5 text-secondary" />
                            ) : isPartial ? (
                              <div className="w-3 h-3 rounded-full bg-accent" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground/30" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Recently Added Recipes - Compact */}
        {recentRecipes.length > 0 && (
          <section aria-labelledby="recent-recipes-heading">
            <Card variant="flat" className="bg-muted/30">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-h3 font-display">Recent Recipes</CardTitle>
                <Link
                  href="/recipes"
                  className="text-body-sm text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                >
                  View all
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </CardHeader>
              <CardContent>
                {isRecipesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {recentRecipes.map((recipe) => (
                      <li key={recipe.id}>
                        <Link
                          href={`/recipes/${recipe.id}`}
                          className="flex items-center justify-between rounded-md p-3 min-h-[44px] hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="text-body font-medium line-clamp-1">{recipe.title}</span>
                          {(recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
                            <div className="flex items-center gap-1 text-caption text-muted-foreground shrink-0 ml-2">
                              <Clock className="h-3.5 w-3.5" />
                              <span>{(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min</span>
                            </div>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </div>
  );
}
