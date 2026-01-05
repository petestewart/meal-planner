'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  UtensilsCrossed,
  ShoppingCart,
  Package,
  ChevronRight,
  Clock,
  AlertTriangle,
  Loader2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { usePlan, useRecipes, usePreferences } from "@/lib/queries";
import {
  getCurrentWeek,
  getWeekDates,
  formatWeekDisplay,
  getDayName,
  formatDayNumber,
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
import { isTomorrow as dateFnsIsTomorrow } from "date-fns";

// Quick action buttons configuration
const quickActions = [
  {
    href: "/calendar",
    title: "Plan Week",
    description: "Plan your meals",
    icon: Calendar,
    variant: "default" as const,
  },
  {
    href: "/recipes",
    title: "Add Recipe",
    description: "Create new recipe",
    icon: Plus,
    variant: "outline" as const,
  },
  {
    href: "/grocery",
    title: "Grocery List",
    description: "View shopping list",
    icon: ShoppingCart,
    variant: "outline" as const,
  },
];

// Helper to check if a date is tomorrow
function isTomorrow(date: Date): boolean {
  return dateFnsIsTomorrow(date);
}

// Default meal types if preferences aren't loaded
const DEFAULT_MEAL_TYPES: MealType[] = ['lunch', 'dinner'];

export default function Home() {
  const currentWeek = getCurrentWeek();

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

  // Recently added recipes (top 6)
  const recentRecipes = recipesData?.recipes?.slice(0, 6) ?? [];

  // Mock expiring pantry items (since pantry API doesn't exist yet)
  // In the future, this would come from a real pantry API
  const expiringItems: { name: string; daysLeft: number }[] = [
    // Example placeholder data - commented out for production
    // { name: "Milk", daysLeft: 2 },
    // { name: "Chicken Breast", daysLeft: 3 },
    // { name: "Spinach", daysLeft: 1 },
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Welcome to Meal Planner</h1>
          <p className="mt-2 text-muted-foreground">
            Plan your meals, organize recipes, and manage your grocery list all in one place.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.href}
                asChild
                variant={action.variant}
                size="lg"
                className="gap-2"
              >
                <Link href={action.href}>
                  <Icon className="h-5 w-5" />
                  {action.title}
                </Link>
              </Button>
            );
          })}
        </div>

        {/* This Week at a Glance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl">This Week at a Glance</CardTitle>
              <CardDescription>{formatWeekDisplay(currentWeek)}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/calendar" className="gap-1">
                View Full Calendar
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isPlanLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {planError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
                Failed to load meal plan. Please try again.
              </div>
            )}

            {!isPlanLoading && !planError && (
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-2 mb-3">
                    {weekDates.map((date, index) => {
                      const today = isToday(date);
                      const tomorrow = isTomorrow(date);
                      return (
                        <div
                          key={index}
                          className={cn(
                            'text-center py-2 px-1 rounded-md',
                            today && 'bg-primary text-primary-foreground',
                            tomorrow && !today && 'bg-accent'
                          )}
                        >
                          <div className="text-sm font-medium">{getDayName(date)}</div>
                          <div className={cn(
                            'text-xs',
                            today ? 'text-primary-foreground' : 'text-muted-foreground'
                          )}>
                            {formatDayNumber(date)}
                          </div>
                          {today && (
                            <Badge variant="secondary" className="mt-1 text-xs">
                              Today
                            </Badge>
                          )}
                          {tomorrow && !today && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Tomorrow
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Meal Rows */}
                  {mealTypes.map((mealType) => (
                    <div key={mealType} className="grid grid-cols-7 gap-2 mb-2">
                      {weekDates.map((date, index) => {
                        const day = getDayOfWeek(date) as DayOfWeek;
                        const planItem = getPlanItem(day, mealType);
                        const recipe = getRecipe(planItem);
                        const today = isToday(date);
                        const tomorrow = isTomorrow(date);
                        const isHighlighted = today || tomorrow;

                        return (
                          <div
                            key={`${day}-${mealType}`}
                            className={cn(
                              'rounded-md border p-2 min-h-[60px]',
                              isHighlighted && 'border-primary/50 bg-primary/5',
                              !recipe && 'border-dashed bg-muted/20'
                            )}
                          >
                            <div className="text-xs text-muted-foreground capitalize mb-1">
                              {mealType}
                            </div>
                            {recipe ? (
                              <div className="text-sm font-medium line-clamp-2">
                                {recipe.title}
                              </div>
                            ) : planItem?.slotType && planItem.slotType !== 'recipe' ? (
                              <div className="text-sm text-muted-foreground capitalize">
                                {planItem.slotType === 'dining_out' ? 'Dining Out' : planItem.slotType}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground italic">
                                Not planned
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Two Column Layout for Alerts and Recent Recipes */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Expiring Pantry Items Alert */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-lg">Expiring Soon</CardTitle>
              </div>
              <CardDescription>Pantry items expiring within 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              {expiringItems.length > 0 ? (
                <ul className="space-y-2">
                  {expiringItems.map((item, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <span className="font-medium">{item.name}</span>
                      <Badge
                        variant={item.daysLeft <= 2 ? "destructive" : "secondary"}
                      >
                        {item.daysLeft === 1
                          ? "Expires tomorrow"
                          : `${item.daysLeft} days left`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <Package className="h-10 w-10 mb-2 opacity-50" />
                  <p>No items expiring soon</p>
                  <Button asChild variant="link" size="sm" className="mt-2">
                    <Link href="/pantry">Manage Pantry</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recently Added Recipes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-lg">Recently Added</CardTitle>
                <CardDescription>Your newest recipes</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/recipes" className="gap-1">
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {isRecipesLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {!isRecipesLoading && recentRecipes.length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                  <UtensilsCrossed className="h-10 w-10 mb-2 opacity-50" />
                  <p>No recipes yet</p>
                  <Button asChild variant="link" size="sm" className="mt-2">
                    <Link href="/recipes/new">Add your first recipe</Link>
                  </Button>
                </div>
              )}

              {!isRecipesLoading && recentRecipes.length > 0 && (
                <ul className="space-y-2">
                  {recentRecipes.slice(0, 4).map((recipe) => (
                    <li key={recipe.id}>
                      <Link
                        href={`/recipes/${recipe.id}`}
                        className="flex items-center justify-between rounded-md border p-2 hover:bg-accent transition-colors"
                      >
                        <span className="font-medium line-clamp-1">{recipe.title}</span>
                        {(recipe.prepTimeMinutes || recipe.cookTimeMinutes) && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>
                              {(recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0)} min
                            </span>
                          </div>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Navigation Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link href="/calendar">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <Calendar className="h-8 w-8 text-primary" />
                <CardTitle className="mt-2">Meal Calendar</CardTitle>
                <CardDescription>Plan your meals for the week</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/recipes">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <UtensilsCrossed className="h-8 w-8 text-primary" />
                <CardTitle className="mt-2">Recipes</CardTitle>
                <CardDescription>Browse your recipe collection</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/grocery">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <ShoppingCart className="h-8 w-8 text-primary" />
                <CardTitle className="mt-2">Grocery List</CardTitle>
                <CardDescription>Manage your shopping list</CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href="/pantry">
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader>
                <Package className="h-8 w-8 text-primary" />
                <CardTitle className="mt-2">Pantry</CardTitle>
                <CardDescription>Track your ingredients</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
