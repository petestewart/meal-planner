# Meal Planner - Complete Testing Procedure

This document provides step-by-step instructions to test all key features of the meal planner system.

## Prerequisites

```bash
cd /home/petestewart/Projects/meal-planner

# Build all packages
pnpm build

# Run automated tests (433 tests)
pnpm test

# Run with coverage report
pnpm test --coverage
```

**Expected:** 433 tests pass, ~43% coverage

## Setup

```bash
# Create CLI alias for convenience
alias meals="node packages/cli/dist/bin/meals.js"

# Initialize/migrate database
meals db migrate

# Verify database stats
meals db stats
```

---

## Part 1: Recipe Management

### 1.1 Add Recipes with Full Details

```bash
# Add a quick breakfast recipe (American)
meals recipe add \
  --title "Scrambled Eggs" \
  --description "Simple fluffy scrambled eggs" \
  --instructions "Beat eggs with salt. Cook over medium heat, stirring gently until set." \
  --servings 2 \
  --prep-time 5 \
  --cook-time 5 \
  --cuisine "American" \
  --difficulty "easy" \
  --ingredient "eggs:4" \
  --ingredient "butter:1 tbsp" \
  --ingredient "salt:0.5 tsp" \
  --tag breakfast \
  --tag quick

# Add a lunch recipe (American)
meals recipe add \
  --title "Grilled Cheese Sandwich" \
  --description "Classic comfort food" \
  --instructions "Butter outsides of bread. Add cheese between slices. Grill until golden on both sides." \
  --servings 1 \
  --prep-time 5 \
  --cook-time 10 \
  --cuisine "American" \
  --difficulty "easy" \
  --ingredient "bread:2 slices" \
  --ingredient "cheddar cheese:2 slices" \
  --ingredient "butter:2 tbsp" \
  --tag lunch \
  --tag quick

# Add an Italian dinner recipe
meals recipe add \
  --title "Pasta Carbonara" \
  --description "Creamy Italian pasta with bacon and egg" \
  --instructions "Cook spaghetti. Fry pancetta until crispy. Mix eggs with pecorino. Combine pasta with pancetta off heat, add egg mixture, toss quickly." \
  --servings 4 \
  --prep-time 10 \
  --cook-time 20 \
  --cuisine "Italian" \
  --difficulty "medium" \
  --ingredient "spaghetti:400 g" \
  --ingredient "pancetta:200 g" \
  --ingredient "eggs:4" \
  --ingredient "pecorino cheese:100 g" \
  --ingredient "black pepper:1 tsp" \
  --tag dinner \
  --tag pasta

# Add a Mexican dinner recipe
meals recipe add \
  --title "Chicken Tacos" \
  --description "Seasoned chicken in soft tortillas" \
  --instructions "Season and grill chicken. Warm tortillas. Assemble with toppings." \
  --servings 4 \
  --prep-time 15 \
  --cook-time 15 \
  --cuisine "Mexican" \
  --difficulty "easy" \
  --ingredient "chicken breast:500 g" \
  --ingredient "tortillas:8" \
  --ingredient "onion:1" \
  --ingredient "cilantro:0.5 cup" \
  --ingredient "lime:2" \
  --tag dinner \
  --tag quick

# Add an Asian dinner recipe (vegetarian)
meals recipe add \
  --title "Vegetable Stir Fry" \
  --description "Quick and healthy vegetable dish" \
  --instructions "Heat wok with oil. Stir-fry vegetables in batches. Add sauce, toss to coat." \
  --servings 4 \
  --prep-time 15 \
  --cook-time 10 \
  --cuisine "Asian" \
  --difficulty "easy" \
  --ingredient "broccoli:2 cups" \
  --ingredient "bell pepper:2" \
  --ingredient "carrots:2" \
  --ingredient "soy sauce:3 tbsp" \
  --ingredient "garlic:4 cloves" \
  --ingredient "vegetable oil:2 tbsp" \
  --tag dinner \
  --tag vegetarian \
  --tag quick
```

### 1.2 List and Search Recipes

```bash
# List all recipes
meals recipe list

# Search by query (uses FTS5 full-text search)
meals recipe list --query "chicken"

# Filter by cuisine
meals recipe list --cuisine "Italian"

# Filter by tag
meals recipe list --tag dinner

# JSON output
meals recipe list --json
```

**Expected:** Table output showing recipes with ID, TITLE, TIME, CUISINE columns

### 1.3 View Recipe Details

```bash
# Get a recipe ID from the list above, then:
meals recipe show <recipe-id>

# JSON output
meals recipe show <recipe-id> --json
```

**Expected:** Full recipe with ingredients, tags, and instructions

### 1.4 Export Recipe to Markdown

```bash
meals recipe export <recipe-id> --output test-recipe.md
cat test-recipe.md
```

**Expected:** Formatted markdown with recipe details

### 1.5 Delete a Recipe

```bash
# With confirmation prompt
meals recipe delete <recipe-id>

# Skip confirmation
meals recipe delete <recipe-id> --force
```

---

## Part 2: Weekly Plan Management

### 2.1 Create a Plan

```bash
# Create plan for current week
meals plan create this-week

# Or create for next week
meals plan create next-week

# Or specify exact week (ISO format)
meals plan create 2026-W02
```

**Expected:** "Created plan for YYYY-Wnn (draft)"

### 2.2 Set Meals in Plan

```bash
# Get current week string
WEEK=$(date +%G-W%V)

# First, note recipe IDs from: meals recipe list
# Then set meals (replace <id> with actual UUIDs):

# Set Monday meals
meals plan set $WEEK mon breakfast <scrambled-eggs-id>
meals plan set $WEEK mon lunch <grilled-cheese-id>
meals plan set $WEEK mon dinner <pasta-carbonara-id>

# Set Tuesday dinner
meals plan set $WEEK tue dinner <chicken-tacos-id>

# Set Wednesday dinner
meals plan set $WEEK wed dinner <vegetable-stir-fry-id>

# Set with custom servings
meals plan set $WEEK thu dinner <pasta-carbonara-id> --servings 2

# Set with notes
meals plan set $WEEK fri dinner <chicken-tacos-id> --notes "Use corn tortillas"
```

**Expected:** "Set [day] [meal] to [recipe title]"

### 2.3 View Plan

```bash
# Show current week's plan
meals plan show

# Show specific week
meals plan show $WEEK

# JSON output
meals plan show --json
```

**Expected:** Table showing all 7 days with breakfast/lunch/dinner columns

### 2.4 Activate Plan

```bash
meals plan activate $WEEK
meals plan show  # Status should now be 'active'
```

### 2.5 Export Plan to Markdown

```bash
meals plan export --output test-plan.md
cat test-plan.md
```

**Expected:** Markdown table with weekly meal schedule

---

## Part 3: Meal Suggestions

The suggestion algorithm (T013) scores recipes based on:
- **Favorites boost:** +0.3 for recipes from favorite cuisines
- **Recently made penalty:** -0.5 for recipes made in last 2 weeks
- **Cuisine preference match:** +0.2 for matching favorite cuisines
- **Time constraint match:** +0.1 for recipes within max prep time
- **Variety violation:** -0.3 for same cuisine on consecutive days

### 3.1 Set Preferences First

```bash
# Set favorite cuisines (affects suggestion scoring)
meals prefs set favorite-cuisines Italian,Mexican

# Set max prep time (minutes) - recipes under this get a boost
meals prefs set max-prep-time 30

# View all preferences
meals prefs show
```

### 3.2 Get Meal Suggestions

```bash
# Get suggestions for empty slots in current week
meals plan suggest

# Get suggestions for specific week
meals plan suggest $WEEK
```

**Expected:** Ranked list of suggestions with:
- Recipe name
- Score (higher is better)
- Reasoning (why suggested)

### 3.3 Swap a Meal

```bash
# Get alternatives for an existing meal
meals plan swap $WEEK mon dinner --reason "want something simpler"
```

**Expected:** Alternative recipes considering the swap reason

---

## Part 4: Grocery List Generation

### 4.1 Generate Grocery List

```bash
# Generate for current week
meals grocery generate

# Generate for specific week
meals grocery generate $WEEK

# JSON output
meals grocery generate --json
```

**Expected:** Ingredients grouped by category with:
- Aggregated quantities (same ingredient combined)
- Scaled by servings
- Source recipes listed

### 4.2 Export Grocery List

```bash
# Export to markdown
meals grocery export --output groceries.md
cat groceries.md

# Export to JSON
meals grocery export --format json --output groceries.json

# Export to plain text
meals grocery export --format txt --output groceries.txt
```

---

## Part 5: Preferences Management

### 5.1 View All Preferences

```bash
meals prefs show
meals prefs show --json
```

**Expected output structure:**
```
Dietary Restrictions: (none)
Disliked Ingredients: (none)
Favorite Cuisines: Italian, Mexican
Default Servings: 2
Max Prep Time: 30 minutes
Planning Heuristics:
  - Prefer variety: true
  - Balance cuisines: true
  - Avoid repeat in week: true
```

### 5.2 Set Preferences

```bash
# Dietary restrictions (comma-separated)
meals prefs set dietary-restrictions vegetarian,gluten-free

# Disliked ingredients
meals prefs set disliked-ingredients cilantro,olives

# Default servings for new plan items
meals prefs set default-servings 2

# Max prep time in minutes
meals prefs set max-prep-time 45

# Favorite cuisines (used by suggestion algorithm)
meals prefs set favorite-cuisines Italian,Mexican,Asian
```

### 5.3 Clear Preferences

```bash
# Clear a specific preference (reverts to default)
meals prefs clear max-prep-time

# Verify it's cleared
meals prefs show
```

---

## Part 6: Database Management

### 6.1 Run Migrations

```bash
meals db migrate
```

### 6.2 View Database Stats

```bash
meals db stats
```

**Expected:** Count of recipes, plans, ingredients, etc.

### 6.3 Backup Database

```bash
meals db backup --output backup.db
ls -la backup.db
```

---

## Part 7: API Server Testing

### 7.1 Start API Server

```bash
# In a separate terminal
pnpm --filter @meals/api dev

# Or use the start script
pnpm --filter @meals/api start
```

### 7.2 Test Health Endpoint

```bash
curl http://localhost:3000/health
```

**Expected:** `{"status":"ok"}`

### 7.3 Test Recipe Endpoints

```bash
# List recipes
curl http://localhost:3000/api/recipes | jq

# Search recipes
curl "http://localhost:3000/api/recipes?q=chicken&cuisine=Mexican" | jq

# Get single recipe
curl http://localhost:3000/api/recipes/<recipe-id> | jq

# Create recipe
curl -X POST http://localhost:3000/api/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Recipe",
    "instructions": "Test instructions",
    "servings": 2,
    "cuisine": "Italian"
  }' | jq

# Delete recipe
curl -X DELETE http://localhost:3000/api/recipes/<recipe-id> | jq
```

### 7.4 Test Plan Endpoints

```bash
# Create plan
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d '{"week":"2026-W05"}' | jq

# Get plan
curl http://localhost:3000/api/plans/2026-W05 | jq

# Set meal
curl -X PUT "http://localhost:3000/api/plans/2026-W05/meals/1/dinner" \
  -H "Content-Type: application/json" \
  -d '{"recipeId":"<recipe-id>","servings":4}' | jq

# Get suggestions
curl -X POST "http://localhost:3000/api/plans/2026-W05/suggest" \
  -H "Content-Type: application/json" \
  -d '{}' | jq
```

### 7.5 Test Grocery Endpoint

```bash
curl -X POST http://localhost:3000/api/grocery/generate \
  -H "Content-Type: application/json" \
  -d '{"week":"2026-W01"}' | jq
```

### 7.6 Test Preference Endpoints

```bash
# Get preferences
curl http://localhost:3000/api/preferences | jq

# Update preferences
curl -X PATCH http://localhost:3000/api/preferences \
  -H "Content-Type: application/json" \
  -d '{"defaultServings":4,"favoriteCuisines":["Italian","Thai"]}' | jq
```

### 7.7 Test Recipe Import

```bash
curl -X POST http://localhost:3000/api/recipes/import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/"}' | jq
```

**Note:** Import success depends on the website having schema.org Recipe JSON-LD markup.

---

## Part 8: Automated Test Suite

### 8.1 Run All Tests

```bash
pnpm test
```

**Expected:** 433 tests passing across 14 test files

### 8.2 Run with Coverage

```bash
pnpm test --coverage
```

**Expected coverage breakdown:**
- Models: 100%
- Repositories: ~94%
- Services: ~66%
- Overall: ~43%

### 8.3 Run Specific Package Tests

```bash
# Core package only (356 tests)
pnpm --filter @meals/core test

# Agent tools only (77 tests)
pnpm --filter @meals/agent-tools test
```

### 8.4 Watch Mode (Development)

```bash
pnpm test:watch
```

---

## Part 9: Audit Log Verification

All mutations are logged to the audit_log table. The audit repository (T016) supports flexible querying.

### 9.1 View Audit Entries via API

```bash
# After performing some operations, check audit log via database
# (Audit log API endpoint not yet implemented, verify via tests)
```

### 9.2 Test Audit Queries Programmatically

```bash
# Run the audit repo tests to verify query capabilities
pnpm --filter @meals/core test -- --grep "audit"
```

**Expected:** 34 audit repository tests passing, including:
- Query by actor
- Query by entity type
- Query by time range
- Query with combined filters
- Count queries

---

## Part 10: Complete Workflow Test

Run this end-to-end test to verify all features work together:

```bash
#!/bin/bash
set -e

cd /home/petestewart/Projects/meal-planner

echo "=== Building project ==="
pnpm build

echo "=== Running automated tests ==="
pnpm test

echo "=== Setting up CLI ==="
alias meals="node packages/cli/dist/bin/meals.js"
MEALS="node packages/cli/dist/bin/meals.js"

echo "=== Migrating database ==="
$MEALS db migrate

echo "=== Adding test recipes ==="
$MEALS recipe add --title "Test Breakfast" --instructions "Make breakfast" --servings 2 --prep-time 10 --cuisine American
$MEALS recipe add --title "Test Lunch" --instructions "Make lunch" --servings 2 --prep-time 15 --cuisine Italian
$MEALS recipe add --title "Test Dinner" --instructions "Make dinner" --servings 4 --prep-time 20 --cuisine Mexican

echo "=== Listing recipes ==="
$MEALS recipe list

echo "=== Getting recipe IDs ==="
RECIPES=$($MEALS recipe list --json)
echo "$RECIPES" | head -20

echo "=== Setting preferences ==="
$MEALS prefs set favorite-cuisines Italian,Mexican
$MEALS prefs set max-prep-time 30
$MEALS prefs show

echo "=== Creating weekly plan ==="
WEEK=$(date +%G-W%V)
$MEALS plan create $WEEK || echo "Plan may already exist"

echo "=== Viewing plan ==="
$MEALS plan show

echo "=== Getting meal suggestions ==="
$MEALS plan suggest

echo "=== Generating grocery list ==="
$MEALS grocery generate

echo "=== Exporting plan ==="
$MEALS plan export --output /tmp/test-plan.md
cat /tmp/test-plan.md

echo "=== Database stats ==="
$MEALS db stats

echo ""
echo "=== ALL TESTS PASSED ==="
```

---

## Quick Validation Checklist

| Feature | Command | Expected Result |
|---------|---------|-----------------|
| Build | `pnpm build` | All 4 packages build |
| Tests | `pnpm test` | 433 tests pass |
| Coverage | `pnpm test --coverage` | >40% coverage reported |
| DB migrate | `meals db migrate` | Applied migrations |
| Add recipe | `meals recipe add --title "X" --instructions "Y"` | Recipe created with UUID |
| List recipes | `meals recipe list` | Table with recipes |
| Search recipes | `meals recipe list --query "X"` | Filtered results |
| Create plan | `meals plan create this-week` | Plan created (draft) |
| Set meal | `meals plan set <week> mon dinner <id>` | Meal assigned |
| Show plan | `meals plan show` | Table with 7 days |
| Suggestions | `meals plan suggest` | Ranked suggestions |
| Grocery list | `meals grocery generate` | Grouped ingredients |
| Preferences | `meals prefs show` | All preferences |
| Set pref | `meals prefs set favorite-cuisines Italian` | Preference saved |
| API health | `curl localhost:3000/health` | `{"status":"ok"}` |
| API recipes | `curl localhost:3000/api/recipes` | JSON array |

---

## Cleanup

```bash
# Remove test files
rm -f test-recipe.md test-plan.md groceries.md groceries.json groceries.txt backup.db /tmp/test-plan.md

# Reset database (start completely fresh)
rm -f data/meals.db
meals db migrate
```

---

## Troubleshooting

### "Command not found: meals"
```bash
alias meals="node packages/cli/dist/bin/meals.js"
```

### "Database locked"
Close any other connections to the SQLite database (other CLI instances, API server, etc.)

### "Recipe not found"
Run `meals recipe list` to get valid recipe UUIDs.

### "Plan not found"
Create a plan first: `meals plan create this-week`

### Tests failing
```bash
pnpm build  # Rebuild first
pnpm test   # Then run tests
```

### API not responding
```bash
# Check if server is running
lsof -i :3000

# Start the server
pnpm --filter @meals/api dev
```
