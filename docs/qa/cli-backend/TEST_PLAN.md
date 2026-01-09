# QA Test Plan

## Overview
This test plan validates all functionality implemented in the meal planner system, focusing on the recently completed P1 and P2 tickets. The system includes recipe management, meal planning, grocery list generation, pantry tracking, batch cooking, ingredient substitutions, and various enhancements.

## Test Environment

### Prerequisites
- Node.js 20+
- pnpm installed
- Project dependencies installed (`pnpm install`)
- Project built (`pnpm build`)
- Fresh database or clean state

### Setup Commands
```bash
# Build the project
pnpm build

# Verify tests pass
pnpm test

# Start API server (for API tests)
pnpm --filter @meals/api dev
```

---

## Test Cases

### TC-001: Build and Test Suite Verification
**Feature:** Core infrastructure (T028)
**Priority:** Critical

**Preconditions:**
- Fresh clone of repository or clean working directory

**Test Steps:**
1. Run `pnpm build` from project root
2. Run `pnpm test` from project root
3. Run `pnpm test --coverage` to verify coverage metrics

**Expected Result:**
- Build completes without errors
- All tests pass (823+ tests)
- Core package coverage >= 80%

**Verification Method:**
- CLI output shows success messages

---

### TC-002: Recipe CRUD Operations
**Feature:** Recipe management (T009, T018, T029)
**Priority:** Critical

**Preconditions:**
- Database migrated and empty
- CLI available

**Test Steps:**
1. Add a recipe: `meals recipe add --title "Test Pasta" --instructions "Boil pasta. Add sauce." --ingredient "pasta:400 g" --ingredient "tomato sauce:200 ml" --tag dinner`
2. List recipes: `meals recipe list`
3. Show the recipe: `meals recipe show <id>`
4. Update the recipe: `meals recipe update <id> --title "Updated Pasta" --add-ingredient "cheese:100 g"`
5. Show updated recipe: `meals recipe show <id>`
6. Export recipe: `meals recipe export <id>`
7. Delete recipe: `meals recipe delete <id> --force`
8. Verify deletion: `meals recipe list`

**Expected Result:**
- Recipe created with correct ingredients and tags
- Recipe appears in list
- Show displays all fields including ingredients
- Update modifies title and adds ingredient
- Export produces valid markdown
- Recipe deleted successfully
- Recipe no longer in list

**Verification Method:**
- CLI output at each step

---

### TC-003: Recipe Favorites
**Feature:** Recipe favorites (T037)
**Priority:** High

**Preconditions:**
- At least one recipe exists

**Test Steps:**
1. Add a recipe: `meals recipe add --title "Favorite Test" --instructions "Test"`
2. Toggle favorite: `meals recipe favorite <id>`
3. Show recipe: `meals recipe show <id>` (should show favorite status)
4. List favorites only: `meals recipe list --favorites`
5. Toggle favorite off: `meals recipe favorite <id>`
6. List favorites: `meals recipe list --favorites` (should be empty or not include this recipe)

**Expected Result:**
- Favorite toggles on/off correctly
- Recipe show displays favorite status
- --favorites filter works correctly

**Verification Method:**
- CLI output shows [FAVORITE] indicator
- Filtered list returns only favorites

---

### TC-004: Recipe Versioning and Forking
**Feature:** Recipe versioning (T043)
**Priority:** High

**Preconditions:**
- At least one recipe exists

**Test Steps:**
1. Create base recipe: `meals recipe add --title "Chicken Base" --instructions "Cook chicken"`
2. Fork recipe: `meals recipe fork <id> --name "sous vide"`
3. Show forked recipe: `meals recipe show <forked-id>`
4. Update forked recipe: `meals recipe update <forked-id> --instructions "Sous vide at 145F for 2 hours"`
5. List versions: `meals recipe list --versions <original-id>`
6. Verify original unchanged: `meals recipe show <original-id>`

**Expected Result:**
- Fork creates new recipe with version name
- Forked recipe shows parent reference
- Original recipe unchanged after fork modification
- Version list shows both original and fork

**Verification Method:**
- CLI output shows "Version:" and "Based on:" for forked recipe

---

### TC-005: Recipe Personal Notes and Modifications
**Feature:** Recipe notes and overrides (T047)
**Priority:** Medium

**Preconditions:**
- At least one recipe with ingredients exists

**Test Steps:**
1. Create recipe: `meals recipe add --title "Note Test" --instructions "Basic" --ingredient "butter:100 g"`
2. Add note: `meals recipe note <id> "Always double the butter"`
3. Show note: `meals recipe note <id> --show`
4. Add ingredient override: `meals recipe override <id> --ingredient "butter" --replace "coconut oil"`
5. Show recipe: `meals recipe show <id>`
6. List overrides: `meals recipe override <id> --list`
7. Remove override: `meals recipe override <id> --remove "butter"`
8. Clear note: `meals recipe note <id> --clear`

**Expected Result:**
- Note added and displayed correctly
- Override shown in recipe display with [was: butter]
- Overrides listed correctly
- Remove/clear operations work

**Verification Method:**
- CLI output shows MY NOTES section and ingredient overrides

---

### TC-006: Recipe Scaling
**Feature:** Recipe scaling API (T048)
**Priority:** Medium

**Preconditions:**
- Recipe with multiple ingredients exists

**Test Steps:**
1. Create recipe: `meals recipe add --title "Scale Test" --instructions "Mix" --servings 4 --ingredient "flour:500 g" --ingredient "milk:200 ml"`
2. Show scaled to 8 servings: `meals recipe show <id> --servings 8`
3. Verify original unchanged: `meals recipe show <id>`

**Expected Result:**
- Scaled recipe shows doubled quantities (1kg flour, 400ml milk)
- Original recipe unchanged (500g flour, 200ml milk)
- Unit conversions applied (500g x 2 = 1kg)

**Verification Method:**
- CLI output shows scaled quantities

---

### TC-007: Weekly Plan Creation and Meal Assignment
**Feature:** Plan management (T012, T019)
**Priority:** Critical

**Preconditions:**
- At least 3 recipes exist

**Test Steps:**
1. Create plan: `meals plan create this-week`
2. Show empty plan: `meals plan show`
3. Set Monday dinner: `meals plan set this-week mon dinner <recipe-id>`
4. Set Tuesday dinner: `meals plan set this-week tue dinner <recipe-id>`
5. Show plan with meals: `meals plan show`
6. Export plan: `meals plan export --output /tmp/plan.md`

**Expected Result:**
- Plan created in draft status
- Meals assigned to correct slots
- Plan display shows recipe titles
- Export creates valid markdown

**Verification Method:**
- CLI output shows table with meals

---

### TC-008: Dining Out, Skip, and Leftovers Slots
**Feature:** Special slot types (T040)
**Priority:** High

**Preconditions:**
- Weekly plan exists with at least one meal set

**Test Steps:**
1. Set dining out: `meals plan set this-week sat dinner --dining-out --notes "Restaurant TBD"`
2. Set skip: `meals plan set this-week sun breakfast --skip`
3. Set leftovers: `meals plan set this-week tue lunch --leftovers-from mon dinner`
4. Show plan: `meals plan show`

**Expected Result:**
- Saturday dinner shows "Dining Out"
- Sunday breakfast shows "Skip"
- Tuesday lunch shows "Leftovers (from Mon dinner)"
- Notes displayed where applicable

**Verification Method:**
- CLI output shows special slot types correctly

---

### TC-009: Plan Completion and History
**Feature:** Plan history (T036)
**Priority:** Medium

**Preconditions:**
- Weekly plan exists with meals assigned

**Test Steps:**
1. Mark meal as made: `meals plan mark-made this-week mon dinner`
2. Complete plan: `meals plan complete this-week`
3. View history: `meals plan history`
4. Create next week plan: `meals plan create next-week`

**Expected Result:**
- Meal marked as made
- Plan status changed to completed
- History shows completed plan
- Can create new plan for next week

**Verification Method:**
- CLI output shows completion status and history

---

### TC-010: Meal Side Dishes
**Feature:** Side dish support (T050)
**Priority:** Medium

**Preconditions:**
- Weekly plan with a main dish set
- Additional recipe for side dish

**Test Steps:**
1. Create side recipe: `meals recipe add --title "Garlic Bread" --instructions "Toast bread with garlic butter"`
2. Add side to meal: `meals plan add-side this-week mon dinner <side-recipe-id>`
3. Show plan: `meals plan show`
4. Remove side: `meals plan remove-side this-week mon dinner <side-recipe-id>`

**Expected Result:**
- Side dish added to meal
- Plan shows main dish with indented side ("  + Garlic Bread")
- Side removal works without affecting main dish

**Verification Method:**
- CLI output shows side dishes indented under main

---

### TC-011: Batch Cooking and Prep
**Feature:** Batch cooking (T041)
**Priority:** High

**Preconditions:**
- Recipe exists suitable for batch cooking

**Test Steps:**
1. Create batch: `meals prep create <recipe-id> --servings 16 --date sunday`
2. List batches: `meals prep list`
3. Set meal from batch: `meals plan set this-week mon lunch <recipe-id> --batch <batch-id>`
4. Set another meal from same batch: `meals plan set this-week tue lunch <recipe-id> --batch <batch-id>`
5. List batches again: `meals prep list` (should show remaining servings)

**Expected Result:**
- Batch created with 16 servings
- Meals linked to batch
- Remaining servings calculated correctly (16 - servings used)

**Verification Method:**
- CLI output shows batch info and remaining servings

---

### TC-012: Prep Day Aggregation
**Feature:** Prep day service (T051)
**Priority:** Medium

**Preconditions:**
- Weekly plan with multiple meals set

**Test Steps:**
1. Run prep command: `meals plan prep this-week`
2. Run with JSON output: `meals plan prep this-week --json`

**Expected Result:**
- Shows aggregated prep tasks
- Groups similar tasks (e.g., "Dice: 3 onions, 4 peppers")
- Shows total estimated prep time
- Lists equipment needed

**Verification Method:**
- CLI output shows organized prep list

---

### TC-013: Grocery List Generation and Persistence
**Feature:** Grocery list (T014, T045)
**Priority:** Critical

**Preconditions:**
- Weekly plan with multiple meals set

**Test Steps:**
1. Generate list: `meals grocery generate this-week`
2. Show list: `meals grocery list`
3. Check an item: `meals grocery check "pasta"`
4. Show updated list: `meals grocery list`
5. Uncheck item: `meals grocery uncheck "pasta"`
6. Add manual item: `meals grocery add "paper towels" --quantity 2`
7. Show list with manual item: `meals grocery list`

**Expected Result:**
- List generated with ingredients from all meals
- Items grouped by store section
- Check marks item as already_have
- Uncheck reverts to need_to_buy
- Manual item appears in list

**Verification Method:**
- CLI output shows items with status indicators

---

### TC-014: Grocery List Excludes Special Slots
**Feature:** Grocery list + slot types (T040, T045)
**Priority:** High

**Preconditions:**
- Plan with recipe meal, dining_out slot, skip slot, and leftovers slot

**Test Steps:**
1. Set up plan with various slot types
2. Generate grocery list: `meals grocery generate this-week`
3. Verify list contents

**Expected Result:**
- Only ingredients from recipe slots included
- Dining out, skip, and leftovers slots excluded

**Verification Method:**
- CLI output only shows ingredients from actual recipe meals

---

### TC-015: Ingredient Categories and Store Sections
**Feature:** Ingredient management (T030, T049)
**Priority:** Medium

**Preconditions:**
- Some ingredients exist in database

**Test Steps:**
1. List ingredients: `meals ingredient list`
2. Show categories: `meals ingredient categories`
3. Set category: `meals ingredient set-category "chicken breast" "Meat"`
4. Show sections: `meals ingredient sections`
5. Set store section: `meals ingredient set-section "chicken breast" "meat"`
6. Generate grocery list and verify grouping

**Expected Result:**
- Ingredients listed with categories
- Category updated successfully
- Store section updated successfully
- Grocery list grouped by store section

**Verification Method:**
- CLI output shows categories and sections

---

### TC-016: Pantry Management
**Feature:** Pantry tracking (T031)
**Priority:** High

**Preconditions:**
- Some ingredients exist

**Test Steps:**
1. Add pantry item: `meals pantry add "olive oil" --quantity 500 --unit ml`
2. Add expiring item: `meals pantry add "milk" --quantity 1 --unit l --expires 2026-01-10`
3. Add prepared item: `meals pantry add "cooked chicken" --quantity 500 --unit g --prepared --notes "shredded, Jan 5"`
4. Add staple: `meals pantry add "salt" --quantity 1 --unit box --staple`
5. List pantry: `meals pantry list`
6. Check expiring: `meals pantry expiring`
7. Use some: `meals pantry use "olive oil" --quantity 100`
8. List again: `meals pantry list` (should show 400ml)
9. Generate grocery with exclusion: `meals grocery generate this-week --exclude-pantry`

**Expected Result:**
- Items added with correct attributes
- Expiring items shown
- Use decrements quantity
- Grocery list excludes pantry items

**Verification Method:**
- CLI output shows pantry items and modifications

---

### TC-017: Ingredient Substitutions
**Feature:** Substitution engine (T046)
**Priority:** Medium

**Preconditions:**
- Database migrated (seed substitutions exist)

**Test Steps:**
1. List substitutions for ingredient: `meals substitution list "soy sauce"`
2. Search substitutions: `meals substitution search "gluten-free"`
3. Add custom substitution: `meals substitution add "butter" "vegan butter" --description "1:1 replacement for baking"`
4. List ingredients with substitutions: `meals substitution ingredients`
5. List dietary substitutions: `meals substitution dietary`

**Expected Result:**
- Soy sauce shows tamari as substitute
- Gluten-free search returns relevant substitutions
- Custom substitution added
- Various list commands work

**Verification Method:**
- CLI output shows substitution options

---

### TC-018: Enhanced User Preferences
**Feature:** User preferences (T015, T044)
**Priority:** High

**Preconditions:**
- None

**Test Steps:**
1. Show all preferences: `meals prefs show`
2. Set household size: `meals prefs set household-size 4`
3. Set meal types: `meals prefs set meal-types lunch,dinner`
4. Set allergies: `meals prefs set allergies "peanuts:strict,shellfish:avoid"`
5. Set cuisine preferences: `meals prefs set cuisine-preferences "liked:italian,mexican;disliked:british"`
6. Show preferences: `meals prefs show`
7. Clear a preference: `meals prefs clear household-size`

**Expected Result:**
- All preferences shown with defaults
- Each preference set correctly
- Allergies parsed with severity levels
- Cuisine preferences have liked/disliked arrays
- Clear reverts to default

**Verification Method:**
- CLI output shows preference values

---

### TC-019: API Health and Recipe Endpoints
**Feature:** API server (T021, T022)
**Priority:** Critical

**Preconditions:**
- API server running on port 3000

**Test Steps:**
1. Health check: `curl http://localhost:3000/health`
2. List recipes: `curl http://localhost:3000/api/recipes`
3. Create recipe: `curl -X POST http://localhost:3000/api/recipes -H "Content-Type: application/json" -d '{"title":"API Test","instructions":"Test"}'`
4. Get recipe: `curl http://localhost:3000/api/recipes/<id>`
5. Favorite recipe: `curl -X POST http://localhost:3000/api/recipes/<id>/favorite`
6. Scale recipe: `curl -X POST http://localhost:3000/api/recipes/<id>/scale -H "Content-Type: application/json" -d '{"servings":8}'`

**Expected Result:**
- Health returns 200 OK
- CRUD operations work via API
- Favorite toggle works
- Scaling returns scaled recipe

**Verification Method:**
- HTTP responses with correct status codes and data

---

### TC-020: API Plan and Grocery Endpoints
**Feature:** API routes (T022)
**Priority:** High

**Preconditions:**
- API server running
- Some recipes exist

**Test Steps:**
1. Create plan: `curl -X POST http://localhost:3000/api/plans -H "Content-Type: application/json" -d '{"week":"2026-W02"}'`
2. Get plan: `curl http://localhost:3000/api/plans/2026-W02`
3. Set meal: `curl -X PUT http://localhost:3000/api/plans/2026-W02/meals/1/dinner -H "Content-Type: application/json" -d '{"recipeId":"<id>"}'`
4. Generate grocery: `curl -X POST http://localhost:3000/api/grocery/generate -H "Content-Type: application/json" -d '{"week":"2026-W02"}'`
5. Get prep day: `curl http://localhost:3000/api/plans/2026-W02/prep-day`

**Expected Result:**
- Plan created and retrieved
- Meal set successfully
- Grocery list generated
- Prep day info returned

**Verification Method:**
- HTTP responses with correct data

---

### TC-021: API Substitution Endpoints
**Feature:** Substitution API (T046)
**Priority:** Medium

**Preconditions:**
- API server running

**Test Steps:**
1. Get substitutions: `curl http://localhost:3000/api/substitutions/soy%20sauce`
2. Add substitution: `curl -X POST http://localhost:3000/api/substitutions -H "Content-Type: application/json" -d '{"originalIngredient":"cream","substituteIngredient":"cashew cream","description":"Vegan alternative"}'`

**Expected Result:**
- Substitutions returned for ingredient
- Custom substitution added

**Verification Method:**
- HTTP responses

---

### TC-022: Recipe Import (with browser fallback)
**Feature:** Recipe import (T023, T042)
**Priority:** High

**Preconditions:**
- Network access available
- Playwright may or may not be installed

**Test Steps:**
1. Import from non-blocking site: `meals recipe import "https://www.bbcgoodfood.com/recipes/easy-pasta-salad" --no-browser`
2. Show imported recipe: `meals recipe show <id>`
3. (Optional) Import from blocking site: `meals recipe import "https://www.allrecipes.com/recipe/..."` (will use browser if available)

**Expected Result:**
- Recipe imported with title, ingredients, instructions
- JSON-LD data extracted correctly
- Browser fallback used for blocking sites (if playwright available)

**Verification Method:**
- CLI output shows imported recipe details

---

## Edge Cases and Error Handling

### EC-001: Invalid Week Format
**Feature:** Plan validation
**Priority:** Medium

**Test Steps:**
1. Try invalid week: `meals plan create invalid-week`
2. Try future year: `meals plan create 2030-W01`

**Expected Result:**
- Invalid format rejected with clear error
- Future weeks allowed (valid use case)

**Verification Method:**
- Error message shown for invalid format

---

### EC-002: Non-existent Recipe Reference
**Feature:** Plan meal assignment
**Priority:** Medium

**Test Steps:**
1. Try to set meal with fake ID: `meals plan set this-week mon dinner fake-id-12345`

**Expected Result:**
- Clear error message: "Recipe not found"

**Verification Method:**
- Error message in CLI output

---

### EC-003: Duplicate Plan Creation
**Feature:** Plan uniqueness
**Priority:** Low

**Test Steps:**
1. Create plan: `meals plan create this-week`
2. Try to create again: `meals plan create this-week`

**Expected Result:**
- Either error "Plan already exists" or updates existing plan

**Verification Method:**
- CLI output

---

### EC-004: Delete Recipe with Plan Reference
**Feature:** Referential integrity
**Priority:** High

**Test Steps:**
1. Create recipe
2. Assign to plan
3. Try to delete recipe: `meals recipe delete <id> --force`
4. Show plan

**Expected Result:**
- Recipe deleted (ON DELETE SET NULL)
- Plan shows empty slot where recipe was

**Verification Method:**
- Plan display shows slot without recipe

---

### EC-005: Pantry Use Exceeds Quantity
**Feature:** Pantry tracking
**Priority:** Low

**Test Steps:**
1. Add pantry item: `meals pantry add "flour" --quantity 100 --unit g`
2. Use more than available: `meals pantry use "flour" --quantity 200`

**Expected Result:**
- Error or reduces to 0 (graceful handling)

**Verification Method:**
- CLI output

---

## Summary

- **Total Test Cases:** 22 (TC-001 to TC-022)
- **Edge Cases:** 5 (EC-001 to EC-005)
- **Critical:** 5 (TC-001, TC-002, TC-007, TC-013, TC-019)
- **High:** 10 (TC-003, TC-004, TC-008, TC-011, TC-014, TC-016, TC-018, TC-020, TC-022, EC-004)
- **Medium:** 10 (TC-005, TC-006, TC-009, TC-010, TC-012, TC-015, TC-017, TC-021, EC-001, EC-002)
- **Low:** 2 (EC-003, EC-005)
