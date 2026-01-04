# MVP Testing Procedure

## Setup

```bash
cd /home/petestewart/Projects/meal-planner

# Create an alias for convenience (optional)
alias meals="node packages/cli/dist/bin/meals.js"
```

## 1. Initialize Database

```bash
meals db migrate
```

## 2. Add Some Recipes

```bash
# Add a breakfast recipe
meals recipe add --title "Scrambled Eggs" \
  --description "Simple fluffy scrambled eggs" \
  --instructions "Beat eggs, cook over medium heat while stirring" \
  --servings 2 \
  --prep-time 5 \
  --cook-time 5

# Add a lunch recipe
meals recipe add --title "Grilled Cheese Sandwich" \
  --description "Classic comfort food" \
  --instructions "Butter bread, add cheese, grill until golden" \
  --servings 1 \
  --prep-time 5 \
  --cook-time 10

# Add a dinner recipe
meals recipe add --title "Pasta Carbonara" \
  --description "Creamy Italian pasta with bacon and egg" \
  --instructions "Cook pasta, fry bacon, mix egg and parmesan, combine" \
  --servings 4 \
  --prep-time 10 \
  --cook-time 20
```

## 3. List Recipes

```bash
meals recipe list
```

> **Note:** Recipe IDs are UUIDs shown in the first column of the `recipe list` output. Copy these IDs for use in subsequent commands.

## 4. View a Recipe

```bash
# Use the UUID from 'recipe list' output
meals recipe show <recipe-uuid>
```

## 5. Create a Weekly Plan

```bash
meals plan create this-week
```

## 6. Set Meals in the Plan

```bash
# Get the week string (e.g., 2026-W01)
WEEK=$(date +%G-W%V)

# First, get the recipe UUIDs from 'meals recipe list'
# Then use them in the commands below:

# Set Monday breakfast to Scrambled Eggs
meals plan set $WEEK mon breakfast <scrambled-eggs-uuid>

# Set Monday lunch to Grilled Cheese
meals plan set $WEEK mon lunch <grilled-cheese-uuid>

# Set Monday dinner to Pasta Carbonara
meals plan set $WEEK mon dinner <pasta-carbonara-uuid>
```

> **Tip:** Run `meals recipe list` to see all recipes with their UUIDs in the first column.

## 7. View the Plan

```bash
meals plan show
```

## 8. Export Plan to Markdown

```bash
meals plan export --output plan.md
cat plan.md
```

## 9. Export a Recipe

```bash
# Use the UUID for "Scrambled Eggs" from 'recipe list'
meals recipe export <scrambled-eggs-uuid> --output scrambled-eggs.md
cat scrambled-eggs.md
```

## 10. Cleanup (Optional)

```bash
rm -f plan.md scrambled-eggs.md

# To start fresh, delete the database:
rm -f packages/data/meals.db
```

---

**Tip:** Add `--json` to any command for JSON output instead of human-readable text.
