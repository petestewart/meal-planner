# Meal Planner - Test Checklist

A comprehensive checklist to verify all features are working as expected.

## Prerequisites

```bash
cd /home/petestewart/Projects/meal-planner
```

---

## 1. Build & Test Verification

### 1.1 Build all packages
```bash
pnpm build
```
- [ ] All 4 packages build successfully (core, api, cli, agent-tools)
- [ ] No TypeScript errors

### 1.2 Run all tests
```bash
pnpm test
```
- [ ] All 433 tests pass
- [ ] No test failures

### 1.3 Run tests with coverage
```bash
pnpm test --coverage
```
- [ ] Coverage report displays
- [ ] Coverage > 40% overall

---

## 2. Database Setup

### 2.1 Run migrations
```bash
pnpm meals db migrate
```
- [ ] Migrations run successfully
- [ ] No errors displayed

### 2.2 Check database stats
```bash
pnpm meals db stats
```
- [ ] Shows table counts
- [ ] Database file exists at `data/meals.db`

---

## 3. Recipe Management (CLI)

### 3.1 Add a recipe manually
```bash
pnpm meals recipe add \
  --title "Test Pasta" \
  --instructions "1. Boil water. 2. Cook pasta. 3. Add sauce." \
  --ingredient "pasta:400g" \
  --ingredient "tomato sauce:200ml" \
  --tag dinner \
  --cuisine Italian \
  --prep-time 10 \
  --cook-time 20 \
  --servings 4
```
- [ ] Recipe created successfully
- [ ] Recipe ID returned

### 3.2 List recipes
```bash
pnpm meals recipe list
```
- [ ] Shows table with recipes
- [ ] Test Pasta appears in list

### 3.3 Search recipes
```bash
pnpm meals recipe list --query "pasta"
```
- [ ] Search returns matching recipes
- [ ] FTS search works

### 3.4 Show recipe details
```bash
pnpm meals recipe show <recipe-id>
```
- [ ] Shows full recipe details
- [ ] Ingredients displayed
- [ ] Instructions displayed

### 3.5 Export recipe to markdown
```bash
pnpm meals recipe export <recipe-id>
```
- [ ] Markdown output displayed
- [ ] Properly formatted

### 3.6 JSON output
```bash
pnpm meals recipe list --json
```
- [ ] Valid JSON returned
- [ ] Contains recipe data

---

## 4. Recipe Import (URL)

### 4.1 Import from recipe website
```bash
pnpm meals recipe import "https://www.allrecipes.com/recipe/23600/worlds-best-lasagna/"
```
- [ ] Recipe imported successfully
- [ ] Title extracted
- [ ] Ingredients parsed
- [ ] Instructions extracted

### 4.2 Verify imported recipe
```bash
pnpm meals recipe list --query "lasagna"
```
- [ ] Imported recipe appears in list

---

## 5. Plan Management (CLI)

### 5.1 Create a weekly plan
```bash
pnpm meals plan create this-week
```
- [ ] Plan created successfully
- [ ] Shows week identifier (e.g., 2026-W01)

### 5.2 Show plan
```bash
pnpm meals plan show
```
- [ ] Displays weekly plan table
- [ ] Shows days and meal slots

### 5.3 Set a meal
```bash
pnpm meals plan set this-week mon dinner <recipe-id>
```
- [ ] Meal assigned successfully
- [ ] Confirmation message shown

### 5.4 Verify meal in plan
```bash
pnpm meals plan show
```
- [ ] Monday dinner shows assigned recipe

### 5.5 Get meal suggestions
```bash
pnpm meals plan suggest
```
- [ ] Suggestions returned
- [ ] Includes reasoning for each suggestion

### 5.6 Activate plan
```bash
pnpm meals plan activate this-week
```
- [ ] Plan status changed to active

### 5.7 Export plan to markdown
```bash
pnpm meals plan export
```
- [ ] Markdown table displayed
- [ ] All meals shown

---

## 6. Grocery List Generation

### 6.1 Generate grocery list
```bash
pnpm meals grocery generate
```
- [ ] Grocery list generated
- [ ] Ingredients grouped by category
- [ ] Quantities aggregated

### 6.2 JSON output
```bash
pnpm meals grocery generate --json
```
- [ ] Valid JSON returned
- [ ] Contains grouped items

### 6.3 Export grocery list
```bash
pnpm meals grocery export --output grocery-test.md
```
- [ ] File created
- [ ] Markdown formatted correctly

---

## 7. Preferences Management

### 7.1 Show preferences
```bash
pnpm meals prefs show
```
- [ ] All preferences displayed
- [ ] Shows defaults for unset values

### 7.2 Set dietary restrictions
```bash
pnpm meals prefs set dietary-restrictions vegetarian
```
- [ ] Preference saved

### 7.3 Set favorite cuisines
```bash
pnpm meals prefs set favorite-cuisines Italian,Mexican,Thai
```
- [ ] Preference saved

### 7.4 Set max prep time
```bash
pnpm meals prefs set max-prep-time 30
```
- [ ] Preference saved

### 7.5 Verify preferences
```bash
pnpm meals prefs show
```
- [ ] All set preferences displayed correctly

### 7.6 Clear a preference
```bash
pnpm meals prefs clear max-prep-time
```
- [ ] Preference cleared
- [ ] Reverts to default

---

## 8. API Server

### 8.1 Start the API server
```bash
pnpm --filter @meals/api dev &
```
- [ ] Server starts on port 3000
- [ ] No startup errors

### 8.2 Health check
```bash
curl http://localhost:3000/health
```
- [ ] Returns `{"status":"ok"}`

### 8.3 List recipes via API
```bash
curl http://localhost:3000/api/recipes
```
- [ ] Returns JSON with recipes
- [ ] Pagination info included

### 8.4 Get single recipe
```bash
curl http://localhost:3000/api/recipes/<recipe-id>
```
- [ ] Returns full recipe with ingredients

### 8.5 Get preferences via API
```bash
curl http://localhost:3000/api/preferences
```
- [ ] Returns preferences object

### 8.6 Create plan via API
```bash
curl -X POST http://localhost:3000/api/plans \
  -H "Content-Type: application/json" \
  -d '{"week":"2026-W02"}'
```
- [ ] Plan created
- [ ] Returns plan object

### 8.7 Stop the API server
```bash
pkill -f "@meals/api"
```

---

## 9. Meal Suggestion Algorithm

### 9.1 Verify suggestions consider preferences
1. Set favorite cuisine: `pnpm meals prefs set favorite-cuisines Italian`
2. Add Italian recipe
3. Run: `pnpm meals plan suggest`
- [ ] Italian recipes rank higher in suggestions
- [ ] Reasoning mentions cuisine preference

### 9.2 Verify variety rules
1. Set Monday dinner to Italian recipe
2. Run suggestions for Tuesday dinner
- [ ] Italian recipes penalized for consecutive days
- [ ] Reasoning mentions variety

### 9.3 Verify time constraints
1. Set max prep time: `pnpm meals prefs set max-prep-time 20`
2. Run suggestions
- [ ] Quick recipes rank higher
- [ ] Reasoning mentions time constraint

---

## 10. Audit Log

### 10.1 Verify audit logging
```bash
sqlite3 data/meals.db "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 10;"
```
- [ ] Recent actions logged
- [ ] Actor types correct (user, cli, api)
- [ ] Entity types and IDs recorded

---

## 11. Backup & Scripts

### 11.1 Test backup script
```bash
./scripts/backup.sh
```
- [ ] Backup created in ~/backups/meals/
- [ ] File named with timestamp

### 11.2 Test tmux script (optional)
```bash
./scripts/start-tmux.sh
```
- [ ] Tmux session created
- [ ] 4 windows: api, cli, dev, logs

---

## 12. Delete Test Data (Cleanup)

### 12.1 Delete test recipe
```bash
pnpm meals recipe delete <test-recipe-id> --force
```
- [ ] Recipe deleted

### 12.2 Clear test preferences
```bash
pnpm meals prefs clear dietary-restrictions
pnpm meals prefs clear favorite-cuisines
```
- [ ] Preferences cleared

---

## Summary

| Category | Tests | Status |
|----------|-------|--------|
| Build & Test | 3 | |
| Database | 2 | |
| Recipe CLI | 6 | |
| Recipe Import | 2 | |
| Plan CLI | 7 | |
| Grocery | 3 | |
| Preferences | 6 | |
| API Server | 7 | |
| Suggestions | 3 | |
| Audit Log | 1 | |
| Scripts | 2 | |
| **Total** | **42** | |

---

## Troubleshooting

### Build fails
```bash
pnpm install
pnpm build
```

### Database errors
```bash
rm data/meals.db
pnpm meals db migrate
```

### Tests fail
```bash
pnpm test --reporter=verbose
```

### API won't start
Check if port 3000 is in use:
```bash
lsof -i :3000
```
