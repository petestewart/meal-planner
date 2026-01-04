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
meals recipe add --name "Scrambled Eggs" \
  --description "Simple fluffy scrambled eggs" \
  --servings 2 \
  --prep-time 5 \
  --cook-time 5

# Add a lunch recipe
meals recipe add --name "Grilled Cheese Sandwich" \
  --description "Classic comfort food" \
  --servings 1 \
  --prep-time 5 \
  --cook-time 10

# Add a dinner recipe
meals recipe add --name "Pasta Carbonara" \
  --description "Creamy Italian pasta with bacon and egg" \
  --servings 4 \
  --prep-time 10 \
  --cook-time 20
```

## 3. List Recipes

```bash
meals recipe list
```

## 4. View a Recipe

```bash
meals recipe show 1
```

## 5. Create a Weekly Plan

```bash
meals plan create this-week
```

## 6. Set Meals in the Plan

```bash
# Get the week string (e.g., 2026-W01)
WEEK=$(date +%G-W%V)

# Set Monday breakfast to Scrambled Eggs (recipe 1)
meals plan set $WEEK mon breakfast 1

# Set Monday lunch to Grilled Cheese (recipe 2)
meals plan set $WEEK mon lunch 2

# Set Monday dinner to Pasta Carbonara (recipe 3)
meals plan set $WEEK mon dinner 3
```

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
meals recipe export 1 --output scrambled-eggs.md
cat scrambled-eggs.md
```

## 10. Cleanup (Optional)

```bash
rm -f plan.md scrambled-eggs.md

# To start fresh, delete the database:
rm -f ~/.local/share/meals/meals.db
```

---

**Tip:** Add `--json` to any command for JSON output instead of human-readable text.
