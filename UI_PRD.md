# Meal Planner UI - Product Requirements Document

**Version:** 1.0
**Date:** 2026-01-04
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Conversation Analysis & Requirements Discovery](#conversation-analysis--requirements-discovery)
3. [User Personas](#user-personas)
4. [Core Features](#core-features)
5. [Application Views](#application-views)
6. [User Flows](#user-flows)
7. [Data Model Enhancements](#data-model-enhancements)
8. [Backend API Requirements](#backend-api-requirements)
9. [Technical Considerations](#technical-considerations)
10. [Future Enhancements](#future-enhancements)

---

## Executive Summary

This PRD defines the requirements for a full-featured meal planning web/mobile application built on top of the existing `meal-planner` backend. The requirements are derived from a real meal planning session that revealed the complete spectrum of user needs—from initial preference setup through recipe customization, meal scheduling, and grocery list management.

### Vision

A meal planning app that feels like having a personal meal planning assistant: intelligent enough to understand your preferences, flexible enough to adapt to your reality (what's already in your fridge, dietary restrictions, time constraints), and practical enough to produce actionable grocery lists and prep schedules.

### Key Differentiators

- **Inventory-aware planning**: Plans meals around what you already have
- **Batch cooking intelligence**: Understands that one recipe can serve multiple meals
- **Flexible recipe adaptation**: Easy ingredient substitutions and cooking method adjustments
- **Prep-day focused**: Designed for meal preppers who cook ahead

---

## Conversation Analysis & Requirements Discovery

The following requirements were identified through a real meal planning session. Each requirement is tagged with the conversation context that revealed it.

### 1. User Preferences & Household Setup

**Context:** "lunches and dinners. 2 people. gluten free."

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Household size configuration | P0 | Affects default servings, grocery quantities |
| Meal types to plan (breakfast/lunch/dinner) | P0 | User only wanted lunch + dinner |
| Dietary restrictions | P0 | Gluten-free affected ingredient choices (tamari vs soy sauce) |
| Food preferences | P1 | "non-carb heavy, prefer quinoa, meat and veggies, rice bowls" |
| Variety constraints | P1 | "only one rice meal, only one quinoa meal" |
| Prep style preferences | P1 | Quick reheat lunches vs. more involved dinners |

### 2. Existing Inventory Management

**Context:** "I already have 4 chicken breasts that have been sous vided" and "we already have 4 servings of leftover cornbread, so find a chicken meal that could go with the cornbread"

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Track items currently on hand | P0 | With quantities and preparation state |
| Incorporate inventory into meal suggestions | P0 | "find a meal that goes with cornbread" |
| Prepared items vs. raw ingredients | P1 | Sous vide chicken is different from raw chicken |
| Leftover tracking with portions | P1 | "4 servings cornbread", "2 servings black eyed peas" |

### 3. Recipe Discovery & Import

**Context:** Imported Turkey Chili from URL, searched for various dinner recipes

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Import recipes from URLs | P0 | schema.org JSON-LD support |
| Search/browse recipe library | P0 | By name, cuisine, ingredients, tags |
| Recipe suggestions based on preferences | P1 | Respecting dietary restrictions, variety goals |
| Filter by prep/cook time | P1 | User asked for times "quickest to longest" |
| Cuisine variety awareness | P2 | Don't suggest 5 Asian dishes in a row |

### 4. Recipe Customization

**Context:** "can we not use the chicken breasts instead of thighs?", "i don't have 7 spice blend... what else could be used?"

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Edit recipe ingredients | P0 | Change quantities, swap items |
| Ingredient substitution suggestions | P1 | Lebanese 7 Spice → cumin + paprika |
| Adapt for cooking method | P1 | Raw chicken → sous vide chicken instructions |
| Scale recipe (batch cooking) | P0 | "2x batch" for chili |
| Personal recipe notes | P2 | Track modifications made |

### 5. Meal Calendar & Scheduling

**Context:** "let's change the days up. Mon: sesame chicken, Tue: sea bass..."

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Weekly calendar view | P0 | Visual grid of days × meals |
| Assign recipes to meal slots | P0 | Drag-and-drop or click-to-assign |
| Specify servings per slot | P0 | Different from recipe default |
| "Dining out" / "Skip" option | P1 | Saturday dining out |
| Prep day designation | P1 | Sunday as prep day |
| Re-order/swap meals easily | P1 | Changed day assignments multiple times |

### 6. Batch Cooking & Multi-Meal Recipes

**Context:** "I will make the 2x version of this recipe and we will have chili for a lot of lunches"

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Recipe scaling | P0 | 1x, 2x, custom multiplier |
| Assign one recipe to multiple meal slots | P0 | Chili for Mon-Sat lunches |
| Track servings across assignments | P1 | 16 servings made, 2 per lunch × 6 = 12 used |
| Leftover forecasting | P2 | "4 servings remaining" |

### 7. Side Dishes & Meal Composition

**Context:** "Chilean Sea Bass + Asparagus + Mashed Potatoes", "find a chicken meal that could go with the cornbread"

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Meals can have multiple components | P1 | Main + sides |
| Use leftovers/existing items as sides | P1 | Mashed potatoes for Tue + Wed |
| Side dish suggestions | P2 | "What goes with honey mustard chicken?" |
| Recipe pairing recommendations | P2 | Based on cuisine, flavor profiles |

### 8. Grocery List Generation

**Context:** Generated comprehensive grocery list organized by category

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Auto-generate from meal plan | P0 | Aggregate all recipe ingredients |
| Smart quantity aggregation | P0 | Combine "2 onions" + "1 onion" = "3 onions" |
| Categorize by store section | P0 | Proteins, Produce, Pantry, Dairy, etc. |
| Show which recipe needs each item | P1 | "Onions | 3 | Chili (2), Thu salad (1)" |
| Distinguish: need to buy vs. already have | P0 | Critical user request |
| Handle partial quantities | P1 | "Have 1 cup, need 2 cups, buy 1 cup" |

### 9. Pantry Integration with Grocery List

**Context:** "set which ingredients they already have vs. ones that need to be purchased"

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Check off items already in pantry | P0 | Visual differentiation |
| Partial quantity handling | P1 | Have some, need more |
| Persistent pantry items | P1 | Salt, pepper, olive oil always available |
| "Check pantry first" section | P1 | Spices, staples that might be there |
| Auto-suggest pantry items | P2 | Based on common staples |

### 10. Recipe Instructions Quality

**Context:** "you need to add instructions to all the recipes that are missing them", "make sure they are written for chicken that is already sous vided"

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Structured step-by-step instructions | P0 | Not just a text blob |
| Section headers in instructions | P1 | "PREP:", "COOK:", "SERVE:" |
| Cooking method variations | P2 | Same recipe, different methods |
| Timer integration | P3 | "Cook 15 minutes" → start timer |

### 11. Prep Day Planning

**Context:** Sunday designated as prep day, "Make Turkey Chili (2x batch)"

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Prep day view/checklist | P1 | What to make, in what order |
| Prep task aggregation | P2 | Combine similar prep across recipes |
| Time estimation for prep day | P2 | "Total prep day: ~4 hours" |
| Prep dependencies | P3 | "Salad needs 30 min to drain" |

### 12. Export & Sharing

**Context:** Generated markdown files for viewing

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Print-friendly meal plan view | P1 | For posting on fridge |
| Shareable grocery list | P1 | Text, email, or share with family |
| Export formats | P2 | PDF, markdown, plain text |
| Sync grocery list to apps | P3 | Apple Reminders, Google Keep, etc. |

---

## User Personas

### Primary: "The Weekly Prepper" (Sarah)

- **Profile:** Busy professional, plans meals on Sunday, preps for the week
- **Goals:** Minimize weeknight cooking time, eat healthy, reduce food waste
- **Pain Points:** Hates throwing away unused ingredients, forgets what's in the fridge
- **Key Features:** Batch cooking, inventory tracking, quick-reheat meal suggestions

### Secondary: "The Dietary Restricted" (Mike)

- **Profile:** Has specific dietary needs (gluten-free, allergies, etc.)
- **Goals:** Find recipes that fit restrictions, avoid accidental exposure
- **Pain Points:** Constantly checking ingredients, limited recipe options
- **Key Features:** Dietary filters, ingredient substitution suggestions, clear allergen flagging

### Tertiary: "The Variety Seeker" (Jordan)

- **Profile:** Enjoys cooking, wants diverse cuisines and new recipes
- **Goals:** Try new things, avoid repetition, balance nutrition
- **Pain Points:** Gets stuck in recipe ruts, forgets tried recipes
- **Key Features:** Recipe discovery, variety suggestions, cuisine balancing

---

## Core Features

### F1: User Profile & Preferences

**Description:** Persistent user settings that inform all meal planning decisions.

**Requirements:**
- Household size (number of people)
- Meal types to plan (breakfast, lunch, dinner, snacks)
- Dietary restrictions (multiple select: gluten-free, dairy-free, vegetarian, etc.)
- Allergies (with severity: avoid vs. strict avoid)
- Cuisine preferences (liked, disliked)
- Disliked ingredients
- Prep style preferences (quick weeknight, elaborate weekend, meal prep)
- Default serving sizes

**UI Elements:**
- Settings page with categorized preference sections
- Quick-access dietary badge on header
- Onboarding wizard for new users

---

### F2: Pantry & Inventory Management

**Description:** Track what ingredients and prepared items the user currently has.

**Requirements:**
- Add items to pantry (ingredient, quantity, unit)
- Track prepared/leftover items separately (e.g., "4 sous vide chicken breasts")
- Quantity tracking with various units
- Expiration date tracking (optional)
- Quick-add common pantry staples
- Auto-deduct when marking meals as "prepared"
- Low-stock alerts

**UI Elements:**
- Pantry list view with search/filter
- Quick-add floating action button
- Expiring soon section
- "Common staples" preset button
- Prepared items section with portion tracking

**Data Structure:**
```
PantryItem {
  id, ingredient_id, name, quantity, unit,
  is_prepared (boolean), preparation_notes,
  expiration_date, location (fridge/freezer/pantry),
  created_at, updated_at
}
```

---

### F3: Recipe Library

**Description:** Browsable, searchable collection of recipes.

**Requirements:**
- List view with filtering and sorting
- Search by name, ingredient, tag, cuisine
- Filter by: dietary compatibility, prep time, cook time, cuisine, tags
- Sort by: name, date added, prep time, rating, recently used
- Favorite/bookmark recipes
- Recipe cards showing: name, image, time, servings, dietary badges
- Quick actions: add to plan, scale, view details

**UI Elements:**
- Grid or list view toggle
- Filter sidebar or bottom sheet
- Search bar with autocomplete
- Dietary compatibility badges (GF, DF, V, etc.)
- Empty state with import/create prompts

---

### F4: Recipe Detail & Editing

**Description:** View and modify individual recipes.

**Requirements:**
- Display: name, description, image, servings, prep/cook time, cuisine, tags
- Ingredients list with quantities and units
- Structured instructions with section headers
- Nutrition info (if available)
- Scale recipe (adjust servings, recalculate ingredients)
- Edit mode for all fields
- Ingredient substitution suggestions
- Personal notes section
- "Adapted for" variations (e.g., sous vide version)
- Source URL attribution

**UI Elements:**
- Hero image with overlay info
- Tabs: Ingredients | Instructions | Notes
- Scaling slider or input
- Edit button (pencil icon)
- Substitution suggestions inline or in modal
- "Make it" button → add to plan

---

### F5: Recipe Import

**Description:** Import recipes from external URLs.

**Requirements:**
- Paste URL to import
- Parse schema.org/Recipe JSON-LD
- Preview before saving
- Edit parsed data before import
- Handle import failures gracefully
- Manual entry fallback
- Duplicate detection

**UI Elements:**
- Import modal with URL input
- Loading state with progress
- Preview card with edit capability
- Error state with manual entry option
- Success confirmation with "Add to Plan" prompt

---

### F6: Meal Calendar

**Description:** Weekly view for planning meals.

**Requirements:**
- Week view: 7 days × configured meal types (rows or columns)
- Navigate between weeks
- Current week highlight
- Assign recipes to slots (drag-drop or click-to-select)
- Specify servings per assignment
- "Dining out" / "Skip" / "Leftovers" options
- Prep day designation
- Visual indicators: recipe images, dietary badges, prep time
- Quick recipe preview on hover/tap
- Copy meal to another day
- Clear slot
- Week templates (save/load common patterns)

**UI Elements:**
- Calendar grid (responsive: week view on desktop, day view on mobile)
- Slot states: empty, assigned, dining out, skip
- Recipe mini-cards in slots
- Week navigation arrows
- "Plan this week" CTA for empty weeks
- Batch-assigned recipes show across multiple slots with connection
- Drag handles for reordering

**Slot States:**
```
MealSlot {
  state: 'empty' | 'recipe' | 'dining_out' | 'skip' | 'leftovers',
  recipe_id (if recipe),
  servings (if recipe),
  leftovers_from (if leftovers, reference to source),
  notes
}
```

---

### F7: Recipe Assignment Modal

**Description:** Interface for assigning a recipe to a meal slot.

**Requirements:**
- Triggered from calendar slot or recipe detail
- Recipe search/selection
- Servings adjustment
- Scale factor for batch cooking
- Assign to multiple slots at once (for batch cooking)
- Show which days this recipe is already assigned
- Side dish suggestions

**UI Elements:**
- Modal with recipe search
- Recent/favorites quick-select
- Servings stepper
- "Batch cook" toggle → multi-slot selector
- Assign button

---

### F8: Grocery List

**Description:** Aggregated shopping list from meal plan.

**Requirements:**
- Auto-generate from current week's plan
- Smart aggregation (combine same ingredients across recipes)
- Categorize by store section (Produce, Meat, Dairy, Pantry, etc.)
- Show source recipe(s) for each item
- Three states per item:
  1. Need to buy (default)
  2. Already have (checked off, moves to "Have" section)
  3. Partial (have X, need Y more, buy Z)
- Manual item addition
- Persistent "always have" items (auto-check)
- Sort within category: alphabetical or by recipe
- Quantity editing
- Cross-off while shopping (separate from "already have")

**UI Elements:**
- Categorized accordion/sections
- Checkbox per item (tri-state or separate controls)
- Quantity display with edit capability
- "For: Recipe A, Recipe B" subtitle
- "Already Have" section (collapsible)
- "Add Item" button
- "Check Pantry" button → bulk-check from pantry
- Shopping mode toggle (simplified view, large checkboxes)
- Share/export button

**Item Display:**
```
┌─────────────────────────────────────────────────────────┐
│ ☐ Onions                                    3 | Edit   │
│   For: Chili (2), Thu salad (1)                        │
│   [Have: 1] [Need: 2 more]                             │
└─────────────────────────────────────────────────────────┘
```

---

### F9: Pantry-Grocery Integration

**Description:** Seamlessly connect pantry inventory to grocery needs.

**Requirements:**
- "Check Pantry" action on grocery list
- Auto-mark items in pantry as "already have"
- Handle partial matches (have 1 cup, need 2 cups)
- Suggest pantry items for "check first" section
- After shopping: option to add purchased items to pantry
- Deduct from pantry when marking meals complete

**UI Elements:**
- "Check Pantry" button on grocery list
- Confirmation modal showing what will be marked
- Partial quantity handling UI
- "Add to Pantry" prompt post-shopping

---

### F10: Prep Day View

**Description:** Consolidated view of all prep tasks for a designated prep day.

**Requirements:**
- List all recipes to be prepped
- Order by: prep dependencies, efficiency (similar tasks together)
- Checklist format
- Time estimates per task and total
- Ingredient prep aggregation (e.g., "Dice: 3 onions, 4 peppers")
- Equipment needed list
- Storage instructions

**UI Elements:**
- Prep day header with total time estimate
- Recipe cards with prep checklist
- "Start Prep" mode with step-by-step guidance
- Completion tracking
- Tips/notes section

---

### F11: Meal Planning Wizard

**Description:** Guided flow for creating a new week's meal plan.

**Requirements:**
- Step-by-step flow:
  1. Confirm week and meal types
  2. Review what's in pantry/fridge (use up expiring items)
  3. Select recipes (with smart suggestions)
  4. Assign to days
  5. Review and adjust
  6. Generate grocery list
- Skip steps for experienced users
- Save as template option

**UI Elements:**
- Multi-step wizard with progress indicator
- Back/Next navigation
- "Skip to calendar" escape hatch
- Suggestion cards with accept/reject
- Summary review before completion

---

### F12: Ingredient Substitution Engine

**Description:** Suggest alternatives when user lacks an ingredient.

**Requirements:**
- Detect when recipe ingredient not in pantry
- Suggest common substitutions (structured data)
- Allow user to accept substitution → update recipe instance
- Learn from user choices over time
- Consider dietary restrictions in suggestions

**Example Substitutions:**
- Lebanese 7 Spice → cumin + paprika + cinnamon
- Soy sauce → tamari (for GF)
- Chicken thighs → chicken breast
- Heavy cream → coconut cream (for DF)

**UI Elements:**
- Alert badge on recipe when missing ingredients
- Substitution modal with options
- "I have this instead" user input
- Apply to this instance only vs. save to recipe

---

## Application Views

### V1: Dashboard / Home

**Purpose:** Quick overview and entry points to key actions.

**Components:**
- This week's meal plan summary (mini calendar)
- Quick actions: "Plan This Week", "Add Recipe", "Grocery List"
- Upcoming meals (today, tomorrow)
- Expiring pantry items alert
- Recently added recipes
- Suggested recipes based on pantry

---

### V2: Weekly Calendar

**Purpose:** Primary meal planning interface.

**Layout:**
```
┌──────────────────────────────────────────────────────────────────┐
│  ← Week of Jan 5-11, 2026 →                    [Prep Day: Sun]  │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│   Mon    │   Tue    │   Wed    │   Thu    │   Fri    │   Sat    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ LUNCH    │ LUNCH    │ LUNCH    │ LUNCH    │ LUNCH    │ LUNCH    │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │
│ │Chili │ │ │Chili │ │ │B.E.  │ │ │Chili │ │ │Chili │ │ │Chili │ │
│ │ 2srv │ │ │ 2srv │ │ │Peas  │ │ │ 2srv │ │ │ 2srv │ │ │ 2srv │ │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ DINNER   │ DINNER   │ DINNER   │ DINNER   │ DINNER   │ DINNER   │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │
│ │Sesame│ │ │Sea   │ │ │Honey │ │ │Leban.│ │ │Greek │ │ │🍽️    │ │
│ │Chkn  │ │ │Bass  │ │ │Mustrd│ │ │Quinoa│ │ │Chkn  │ │ │Dining│ │
│ │+Rice │ │ │+Sides│ │ │+Sides│ │ │Bowls │ │ │+Veg  │ │ │ Out  │ │
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘ │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Interactions:**
- Click empty slot → recipe selector modal
- Click filled slot → quick actions (view, edit, remove, swap)
- Drag recipe between slots
- Right-click / long-press → context menu
- Double-click → recipe detail

---

### V3: Recipe Library

**Purpose:** Browse and manage all recipes.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Recipes                                    [+ Add] [↓ Import]   │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search recipes...                                            │
│ Filters: [All Cuisines ▼] [Any Time ▼] [Dietary ▼] [Tags ▼]    │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │   [image]   │ │   [image]   │ │   [image]   │ │   [image]   │ │
│ │ Sesame      │ │ Turkish     │ │ Greek       │ │ Lebanese    │ │
│ │ Chicken     │ │ Chili       │ │ Chicken     │ │ Quinoa      │ │
│ │ ⏱️ 20m [GF] │ │ ⏱️ 4h [GF]  │ │ ⏱️ 40m [GF] │ │ ⏱️ 45m [GF] │ │
│ │ ★★★★☆      │ │ ★★★★★      │ │ ★★★★☆      │ │ ★★★★☆      │ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ │
│ │   ...       │ │   ...       │ │   ...       │ │   ...       │ │
└─────────────────────────────────────────────────────────────────┘
```

---

### V4: Recipe Detail

**Purpose:** View complete recipe information, edit, scale.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back                                         [Edit] [★] [⋮]   │
├─────────────────────────────────────────────────────────────────┤
│                        [Hero Image]                             │
│                                                                 │
│  Sesame Chicken                                          [GF]  │
│  Asian • ⏱️ 10m prep • 10m cook                                │
│                                                                 │
│  Servings: [ 2 ]  [−] [+]              [Add to Plan →]         │
├─────────────────────────────────────────────────────────────────┤
│  [Ingredients]  [Instructions]  [Notes]                        │
├─────────────────────────────────────────────────────────────────┤
│  INGREDIENTS                                                    │
│  ──────────────────────────────────────────────────────────────│
│  • 1 lb chicken breast (sous vide)           [✓ Have]          │
│  • 0.33 cup tamari                           [✓ Have]          │
│  • 3 tbsp honey                              [⚠️ Check]         │
│  • 2 tbsp toasted sesame oil                 [✓ Have]          │
│  • 4 cloves garlic, minced                   [✓ Have]          │
│  • 3 cups cooked white rice                  [✗ Need]          │
│  ...                                                            │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Missing ingredients? [Check Pantry] [Find Substitutes]        │
└─────────────────────────────────────────────────────────────────┘
```

---

### V5: Grocery List

**Purpose:** Shopping list with inventory integration.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Grocery List                          [Check Pantry] [Share ↗]  │
│ Week of Jan 5-11, 2026                                          │
├─────────────────────────────────────────────────────────────────┤
│ [Shopping Mode: OFF 🔘]                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ▼ PROTEINS (3 items)                                           │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ☐ Ground turkey                              4 lbs          ││
│ │   For: Chili (2x batch)                                     ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ ☐ Chilean sea bass                           1 lb           ││
│ │   For: Tue dinner                                           ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ ☐ Halloumi cheese                            8 oz           ││
│ │   For: Thu dinner                                           ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ▼ PRODUCE (12 items)                                           │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ ☐ Onions                                     3              ││
│ │   For: Chili (2), Thu salad (1)                             ││
│ │   [Have 1] → Need to buy: 2                                 ││
│ ├─────────────────────────────────────────────────────────────┤│
│ │ ☑ Garlic                                     2 heads        ││
│ │   Already have ✓                                            ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ▶ ALREADY HAVE (8 items)  ────────────────────────────────────│
│                                                                 │
│ ─────────────────────────────────────────────────────────────  │
│ [+ Add Item]                                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Shopping Mode:**
When enabled, simplifies the view for in-store use:
- Larger checkboxes
- Strikethrough on checked items
- Hides "already have" section
- Groups by store aisle (if configured)

---

### V6: Pantry

**Purpose:** Manage household inventory.

**Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Pantry                                              [+ Add]     │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search pantry...          [Fridge] [Freezer] [Pantry] [All] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ⚠️ EXPIRING SOON                                                │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🥛 Heavy cream              1 cup         Expires: Jan 7    ││
│ │ 🥬 Spinach                  1 bag         Expires: Jan 6    ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ 🍳 PREPARED ITEMS                                               │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ 🍗 Sous vide chicken breast  4 pieces     Prepped: Jan 3    ││
│ │ 🍞 Cornbread                 4 servings   Made: Jan 1       ││
│ │ 🫘 Black eyed peas           2 servings   Made: Jan 1       ││
│ │ 🥔 Mashed potatoes           6 servings   Made: Jan 3       ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ 📦 PANTRY STAPLES                                               │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Olive oil                    ✓ In stock                     ││
│ │ Salt                         ✓ In stock                     ││
│ │ Cumin                        ✓ In stock                     ││
│ │ Tamari                       ~1 cup remaining               ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

### V7: Settings / Preferences

**Purpose:** Configure user profile and app settings.

**Sections:**
1. **Household**
   - Number of people
   - Default servings

2. **Dietary**
   - Restrictions (multi-select)
   - Allergies (with severity)
   - Disliked ingredients

3. **Meal Planning**
   - Meal types to include
   - Prep day preference
   - Variety settings (max same cuisine per week, etc.)

4. **Grocery**
   - Store sections customization
   - Always-have staples
   - Preferred stores

5. **Account**
   - Profile
   - Notifications
   - Data export

---

## User Flows

### UF1: New User Onboarding

```
[Welcome Screen]
       ↓
[Household Size] → "How many people are you cooking for?"
       ↓
[Meal Types] → "Which meals do you want to plan?"
       ↓
[Dietary Restrictions] → "Any dietary restrictions?"
       ↓
[Food Preferences] → "Any foods you dislike or prefer?"
       ↓
[Initial Pantry] → "Add common staples you usually have"
       ↓
[Complete] → Dashboard
```

### UF2: Weekly Meal Planning

```
[Dashboard] → "Plan This Week"
       ↓
[Review Pantry] → "Use up these expiring items?"
       ↓
[Recipe Suggestions] → Based on preferences, pantry, variety
       ↓
[Calendar View] → Drag recipes to slots
       ↓
[Adjust Servings] → Per meal slot
       ↓
[Review Plan] → Summary view
       ↓
[Generate Grocery List] → Auto-created
       ↓
[Check Pantry] → Mark items already have
       ↓
[Ready to Shop]
```

### UF3: Recipe Import

```
[Recipe Library] → [Import]
       ↓
[Paste URL]
       ↓
[Parsing...] → Extract recipe data
       ↓
[Preview & Edit] → Adjust parsed data, add tags
       ↓
[Save to Library]
       ↓
[Add to Plan?] → Optional immediate assignment
```

### UF4: Grocery Shopping

```
[Grocery List] → Review items
       ↓
[Check Pantry] → Auto-mark items in stock
       ↓
[Adjust Quantities] → Partial quantities
       ↓
[Shopping Mode] → Simplified view
       ↓
[At Store] → Check off items as purchased
       ↓
[Done Shopping] → Option to add to pantry
```

### UF5: Ingredient Substitution

```
[Recipe Detail] → See "missing" ingredients
       ↓
[Find Substitutes]
       ↓
[Substitution Modal] → "Lebanese 7 Spice"
       ↓
[Options]:
  - "1/2 tsp cumin + 1/2 tsp paprika"
  - "1 tsp baharat"
  - "Enter custom..."
       ↓
[Apply] → Update recipe ingredients
       ↓
[Scope]: "This meal only" or "Save to recipe"
```

---

## Data Model Enhancements

The existing backend needs these additions to support the full UI:

### New Tables

```sql
-- User preferences
CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  household_size INTEGER DEFAULT 2,
  meal_types TEXT, -- JSON array: ["lunch", "dinner"]
  dietary_restrictions TEXT, -- JSON array: ["gluten-free"]
  allergies TEXT, -- JSON array with severity
  disliked_ingredients TEXT, -- JSON array
  cuisine_preferences TEXT, -- JSON object: {liked: [], disliked: []}
  prep_day TEXT, -- "sunday", "saturday", etc.
  created_at DATETIME,
  updated_at DATETIME
);

-- Pantry items
CREATE TABLE pantry_items (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT REFERENCES ingredients(id),
  name TEXT NOT NULL, -- For custom items not in ingredients
  quantity REAL,
  unit TEXT,
  location TEXT, -- "fridge", "freezer", "pantry"
  is_prepared BOOLEAN DEFAULT FALSE,
  preparation_notes TEXT,
  expiration_date DATE,
  is_staple BOOLEAN DEFAULT FALSE, -- "always have" items
  created_at DATETIME,
  updated_at DATETIME
);

-- Meal slot types enhancement
-- Add to plan_items or create new:
CREATE TABLE meal_slots (
  id TEXT PRIMARY KEY,
  plan_id TEXT REFERENCES plans(id),
  day TEXT NOT NULL, -- "mon", "tue", etc.
  meal TEXT NOT NULL, -- "breakfast", "lunch", "dinner"
  slot_type TEXT DEFAULT 'recipe', -- "recipe", "dining_out", "skip", "leftovers"
  recipe_id TEXT REFERENCES recipes(id),
  servings INTEGER,
  leftovers_source_id TEXT, -- For leftover meals
  notes TEXT,
  created_at DATETIME,
  updated_at DATETIME
);

-- Ingredient substitutions
CREATE TABLE substitutions (
  id TEXT PRIMARY KEY,
  original_ingredient TEXT NOT NULL,
  substitute_ingredients TEXT NOT NULL, -- JSON array
  substitute_description TEXT,
  dietary_tags TEXT, -- JSON array: what restrictions this enables
  created_at DATETIME
);

-- User recipe modifications
CREATE TABLE recipe_modifications (
  id TEXT PRIMARY KEY,
  recipe_id TEXT REFERENCES recipes(id),
  user_notes TEXT,
  ingredient_overrides TEXT, -- JSON: [{original: "", replacement: ""}]
  instruction_notes TEXT,
  created_at DATETIME,
  updated_at DATETIME
);
```

### Existing Table Modifications

```sql
-- Add to recipes table
ALTER TABLE recipes ADD COLUMN is_favorite BOOLEAN DEFAULT FALSE;
ALTER TABLE recipes ADD COLUMN last_used_date DATE;
ALTER TABLE recipes ADD COLUMN use_count INTEGER DEFAULT 0;
ALTER TABLE recipes ADD COLUMN dietary_tags TEXT; -- JSON array

-- Add to ingredients table
ALTER TABLE ingredients ADD COLUMN category TEXT; -- "protein", "produce", etc.
ALTER TABLE ingredients ADD COLUMN store_section TEXT; -- "meat", "dairy", etc.
ALTER TABLE ingredients ADD COLUMN is_common_staple BOOLEAN DEFAULT FALSE;
```

---

## Backend API Requirements

### New Endpoints Needed

```
# User Preferences
GET    /api/preferences
PUT    /api/preferences

# Pantry
GET    /api/pantry
POST   /api/pantry/items
PUT    /api/pantry/items/:id
DELETE /api/pantry/items/:id
POST   /api/pantry/check-against-list  # Compare pantry to grocery list

# Enhanced Grocery List
GET    /api/grocery-list/:week
PUT    /api/grocery-list/:week/items/:id  # Update item status
POST   /api/grocery-list/:week/check-pantry  # Bulk check

# Meal Slots
PUT    /api/plans/:week/slots/:day/:meal
DELETE /api/plans/:week/slots/:day/:meal

# Substitutions
GET    /api/substitutions/:ingredient
POST   /api/substitutions  # User-defined

# Recipe Enhancements
POST   /api/recipes/:id/scale
GET    /api/recipes/:id/substitutions
PUT    /api/recipes/:id/favorite
```

---

## Technical Considerations

### Platform

**Recommended:** Progressive Web App (PWA)
- Works on mobile and desktop
- Offline capability for grocery shopping
- Installable on home screen
- Push notifications for expiring items

**Alternative:** Native apps (React Native / Flutter)
- Better offline support
- Native device integrations
- More complex development

### Frontend Stack Recommendation

```
Framework: Next.js 14+ (App Router)
Styling: Tailwind CSS + shadcn/ui
State: TanStack Query (server state) + Zustand (client state)
Forms: React Hook Form + Zod
Calendar: Custom or @dnd-kit for drag-drop
Mobile: PWA with responsive design
```

### Offline Support

Critical for grocery shopping flow:
- Cache current week's grocery list
- Queue item check-offs for sync
- Service worker for offline access

### Performance

- Recipe images: lazy load, optimize formats (WebP)
- Virtual scrolling for long lists
- Prefetch likely next views
- Cache API responses

---

## Future Enhancements

### Phase 2

- **Nutrition tracking**: Macro/calorie display per meal, daily totals
- **Budget tracking**: Price estimates, cost per serving
- **Recipe scaling AI**: Smarter ingredient scaling for baking
- **Collaborative planning**: Shared household accounts

### Phase 3

- **Smart suggestions**: ML-based recipe recommendations
- **Voice assistant**: "Add chicken to grocery list"
- **Store integration**: Order groceries directly
- **Social features**: Share meal plans, recipe collections

### Phase 4

- **Meal kit mode**: Generate prep-portioned ingredient lists
- **Restaurant mode**: Log dining out meals for tracking
- **Health integrations**: Connect to fitness apps
- **Recipe video support**: Embedded cooking videos

---

## Appendix A: Conversation-Derived Feature Mapping

| Conversation Quote | Feature |
|-------------------|---------|
| "lunches and dinners. 2 people. gluten free." | User preferences (F1) |
| "I already have 4 chicken breasts that have been sous vided" | Pantry - prepared items (F2) |
| "import Turkey Chili from URL" | Recipe import (F5) |
| "2x version of this recipe" | Recipe scaling (F4) |
| "let's change the days up" | Meal calendar reordering (F6) |
| "Saturday we will be dining out" | Dining out slot type (F6) |
| "set which ingredients they already have" | Grocery-pantry integration (F9) |
| "partial quantity of something" | Partial quantity handling (F8) |
| "i don't have 7 spice blend... what else?" | Ingredient substitution (F12) |
| "make sure they are written for sous vide chicken" | Recipe editing - cooking method (F4) |
| "Sunday Prep:" | Prep day view (F10) |
| "only one rice meal, only one quinoa meal" | Variety constraints (F1) |

---

## Appendix B: User Story Mapping

### Epic: Meal Planning

```
As a meal planner, I want to...

- Set my household preferences so the app understands my needs
- See a weekly calendar so I can visualize my meal plan
- Drag recipes to meal slots so planning is intuitive
- Mark days as "dining out" so I don't over-plan
- Scale recipes for batch cooking so I can meal prep
- Copy meals between days so I can reuse favorites
```

### Epic: Recipe Management

```
As a home cook, I want to...

- Import recipes from my favorite websites so I don't retype them
- Edit recipe ingredients so I can customize to my taste
- Get substitution suggestions so I can use what I have
- Scale recipes up/down so I can cook for different group sizes
- See dietary badges so I know what I can eat
- Add personal notes so I remember my modifications
```

### Epic: Grocery Shopping

```
As a grocery shopper, I want to...

- Auto-generate a list from my meal plan so I don't forget ingredients
- See items grouped by store section so shopping is efficient
- Check off items I already have so I don't over-buy
- Handle partial quantities so I buy exactly what I need
- Use shopping mode so the list is easy to use in-store
- Share my list so my partner can shop too
```

### Epic: Inventory Management

```
As a home cook, I want to...

- Track what's in my pantry so I know what I have
- Log prepared items so I remember what's ready to use
- See expiring items so I reduce food waste
- Auto-check pantry against grocery list so I don't double-buy
- Mark staples as "always have" so they're always checked off
```

---

*Document generated: 2026-01-04*
