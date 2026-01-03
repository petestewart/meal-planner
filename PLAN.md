# Meal Planner

## 1. Overview

A self-hosted meal planning system that runs persistently on agentbox. The system supports recipe management, weekly meal planning, grocery list generation, and preference-based constraints. Claude agents (curator and planner) drive intelligent recipe curation and plan generation through a controlled tool interface. The core is designed for CLI usage today with a local HTTP API ready for future UI integration.

Success looks like: a stable, always-running system where the user can quickly generate or update weekly meal plans via CLI, search and import recipes, and generate grocery lists—all backed by structured SQLite storage and driven by Claude agents that operate safely through defined tool contracts.

## 2. Non Goals

- Mobile app or hosted web deployment
- Multi-user authentication or access control
- Real-time collaboration features
- Integration with grocery delivery services
- Nutritional analysis or calorie tracking
- Meal prep instructions or cooking timers
- Image storage for recipes (URLs only)
- Complex inventory management beyond basic pantry tracking

## 3. Assumptions

1. **Single user system** - No auth required; runs locally on agentbox
2. **SQLite is sufficient** - Dataset will remain small enough that SQLite handles all queries efficiently
3. **Claude agents are available** - The system assumes Claude Code or similar agent can call tools via MCP or direct function calls
4. **Recipes have standard structure** - Title, ingredients list, instructions, servings, prep/cook time, source URL
5. **Week starts on Monday** - Weekly plans cover Monday through Sunday
6. **Three meals per day** - Breakfast, lunch, dinner as default slots; snacks are out of scope for v1
7. **Ingredients are normalized** - Common ingredient names are used (e.g., "chicken breast" not "boneless skinless chicken breast fillets")
8. **Node.js 20+ available** - Modern Node with native fetch and ES modules
9. **Agentbox provides persistent storage** - SQLite file persists across restarts
10. **No internet required for core ops** - Recipe import needs internet; planning/search work offline

## 4. Constraints

### Technical Constraints
- **Language:** TypeScript (strict mode)
- **Runtime:** Node.js 20+
- **Database:** SQLite via better-sqlite3 (synchronous, simple)
- **No ORM:** Raw SQL with typed query helpers
- **Monorepo:** pnpm workspaces
- **API framework:** Fastify (lightweight, fast, good TypeScript support)
- **CLI framework:** Commander.js
- **Validation:** Zod for runtime validation and type inference

### Architectural Constraints
- Claude agents NEVER access the database directly
- All mutations go through the core API layer
- All operations are logged to audit_log table
- Data stored as structured JSON/SQL; markdown is a view layer only
- IDs are UUIDs (stable, no conflicts)
- All timestamps are ISO 8601 UTC

## 5. Architecture Sketch

### Deliverable A: Architecture

#### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Entry Points                              │
├─────────────┬─────────────┬─────────────────────────────────────┤
│   CLI App   │  HTTP API   │  Claude Agent Tools                 │
│ (commander) │  (fastify)  │  (MCP/function interface)           │
└──────┬──────┴──────┬──────┴──────────────┬──────────────────────┘
       │             │                      │
       └─────────────┴──────────────────────┘
                     │
                     ▼
       ┌─────────────────────────────┐
       │        Core Domain          │
       │  ┌───────────────────────┐  │
       │  │   Service Layer       │  │
       │  │  - RecipeService      │  │
       │  │  - PlanService        │  │
       │  │  - GroceryService     │  │
       │  │  - PreferenceService  │  │
       │  └───────────┬───────────┘  │
       │              │              │
       │  ┌───────────▼───────────┐  │
       │  │   Repository Layer    │  │
       │  │  - RecipeRepo         │  │
       │  │  - PlanRepo           │  │
       │  │  - PreferenceRepo     │  │
       │  │  - AuditRepo          │  │
       │  └───────────┬───────────┘  │
       └──────────────┼──────────────┘
                      │
                      ▼
       ┌─────────────────────────────┐
       │     SQLite Database         │
       │     (better-sqlite3)        │
       └─────────────────────────────┘
```

#### TypeScript Stack

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.3 | Language |
| better-sqlite3 | ^11.0 | SQLite driver (sync, fast) |
| fastify | ^5.0 | HTTP server |
| @fastify/cors | ^10.0 | CORS for future UI |
| commander | ^12.0 | CLI framework |
| zod | ^3.23 | Schema validation |
| uuid | ^10.0 | ID generation |
| turndown | ^7.2 | HTML to markdown (recipe import) |
| cheerio | ^1.0 | HTML parsing (recipe import) |
| pino | ^9.0 | Logging |

**Justification:**
- `better-sqlite3` over `sql.js`: Native performance, sync API simplifies code, no async overhead
- `fastify` over `express`: 2x faster, built-in validation hooks, better TypeScript
- `commander` over `yargs`: Simpler API, less magic, good subcommand support
- `zod` over `joi`/`yup`: Best TypeScript inference, composable schemas

#### Monorepo Layout

```
meal-planner/
├── package.json              # Workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── PLAN.md
├── packages/
│   ├── core/                 # Domain logic + repositories
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── index.ts      # Public exports
│   │   │   ├── db/
│   │   │   │   ├── connection.ts
│   │   │   │   ├── migrations/
│   │   │   │   │   ├── 001_initial.sql
│   │   │   │   │   └── ...
│   │   │   │   └── migrate.ts
│   │   │   ├── models/       # Zod schemas + types
│   │   │   │   ├── recipe.ts
│   │   │   │   ├── plan.ts
│   │   │   │   ├── preference.ts
│   │   │   │   └── index.ts
│   │   │   ├── repos/        # Data access
│   │   │   │   ├── recipe.repo.ts
│   │   │   │   ├── plan.repo.ts
│   │   │   │   ├── preference.repo.ts
│   │   │   │   └── audit.repo.ts
│   │   │   └── services/     # Business logic
│   │   │       ├── recipe.service.ts
│   │   │       ├── plan.service.ts
│   │   │       ├── grocery.service.ts
│   │   │       └── preference.service.ts
│   │   └── tests/
│   ├── api/                  # HTTP server
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── routes/
│   │   │   │   ├── recipes.ts
│   │   │   │   ├── plans.ts
│   │   │   │   ├── grocery.ts
│   │   │   │   └── preferences.ts
│   │   │   └── middleware/
│   │   └── tests/
│   ├── cli/                  # Command-line interface
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts      # Entry point
│   │   │   ├── commands/
│   │   │   │   ├── recipe.ts
│   │   │   │   ├── plan.ts
│   │   │   │   ├── grocery.ts
│   │   │   │   └── prefs.ts
│   │   │   └── output.ts     # Formatting helpers
│   │   └── bin/
│   │       └── meals.ts      # CLI binary
│   └── agent-tools/          # Claude agent interface
│       ├── package.json
│       ├── src/
│       │   ├── index.ts
│       │   ├── tools/
│       │   │   ├── curator.tools.ts
│       │   │   └── planner.tools.ts
│       │   └── schemas/
│       └── tests/
├── data/
│   ├── meals.db              # SQLite database
│   └── exports/              # Markdown exports
├── scripts/
│   ├── start-api.sh
│   ├── start-tmux.sh
│   └── backup.sh
└── logs/
    └── api.log
```

#### Data Flow

**Path 1: CLI to Core**
```
User runs: meals plan suggest --week 2025-W02

CLI (commander)
  │
  ├─ Parse args, validate with Zod
  │
  ├─ Import core services directly (same process)
  │     const { planService } = await import('@meals/core')
  │
  ├─ Call service method
  │     const suggestions = planService.suggestWeek('2025-W02')
  │
  ├─ Format output (human or JSON based on --json flag)
  │
  └─ Print to stdout
```

**Path 2: HTTP API to Core**
```
Client sends: POST /api/plans/suggest { week: "2025-W02" }

Fastify Server
  │
  ├─ Route handler validates request body (Zod schema)
  │
  ├─ Call injected service
  │     const suggestions = await planService.suggestWeek(body.week)
  │
  ├─ Return JSON response
  │     { suggestions: [...] }
  │
  └─ Log request to pino
```

**Path 3: Claude Agent to Core via Tools**
```
Agent calls tool: suggest_weekly_plan({ week: "2025-W02", constraints: {...} })

Agent Tool Layer
  │
  ├─ Validate input against tool schema (Zod)
  │
  ├─ Log to audit_log with agent_id and action
  │
  ├─ Call core service
  │     const result = planService.suggestWeek(week, constraints)
  │
  ├─ Format response per tool output schema
  │
  └─ Return structured result to agent
```

### Deliverable B: Data Model and Storage

#### SQLite Schema

```sql
-- 001_initial.sql

-- Recipes table
CREATE TABLE recipes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,
  servings INTEGER NOT NULL DEFAULT 4,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  source_url TEXT,
  source_type TEXT CHECK(source_type IN ('manual', 'imported', 'agent_curated')),
  cuisine TEXT,
  difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ingredients table (normalized)
CREATE TABLE ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  default_unit TEXT
);

-- Recipe ingredients junction
CREATE TABLE recipe_ingredients (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity REAL,
  unit TEXT,
  notes TEXT,
  optional INTEGER NOT NULL DEFAULT 0
);

-- Tags table
CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT CHECK(category IN ('meal_type', 'dietary', 'cuisine', 'season', 'custom'))
);

-- Recipe tags junction
CREATE TABLE recipe_tags (
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, tag_id)
);

-- Weekly plans
CREATE TABLE weekly_plans (
  id TEXT PRIMARY KEY,
  week TEXT NOT NULL UNIQUE,  -- ISO week: 2025-W02
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'completed')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Plan items (meals)
CREATE TABLE plan_items (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 1 AND 7),  -- 1=Monday
  meal_type TEXT NOT NULL CHECK(meal_type IN ('breakfast', 'lunch', 'dinner')),
  servings INTEGER NOT NULL DEFAULT 2,
  notes TEXT,
  UNIQUE(plan_id, day_of_week, meal_type)
);

-- Pantry items (optional tracking)
CREATE TABLE pantry_items (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
  quantity REAL,
  unit TEXT,
  expires_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- User preferences
CREATE TABLE preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,  -- JSON encoded
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audit log
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  actor TEXT NOT NULL,  -- 'user', 'cli', 'api', 'agent:curator', 'agent:planner'
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT  -- JSON
);

-- Indexes
CREATE INDEX idx_recipes_title ON recipes(title);
CREATE INDEX idx_recipes_cuisine ON recipes(cuisine);
CREATE INDEX idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
CREATE INDEX idx_recipe_tags_recipe ON recipe_tags(recipe_id);
CREATE INDEX idx_recipe_tags_tag ON recipe_tags(tag_id);
CREATE INDEX idx_plan_items_plan ON plan_items(plan_id);
CREATE INDEX idx_plan_items_recipe ON plan_items(recipe_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_actor ON audit_log(actor);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Full-text search for recipes
CREATE VIRTUAL TABLE recipes_fts USING fts5(
  title,
  description,
  instructions,
  content='recipes',
  content_rowid='rowid'
);

-- FTS triggers
CREATE TRIGGER recipes_ai AFTER INSERT ON recipes BEGIN
  INSERT INTO recipes_fts(rowid, title, description, instructions)
  VALUES (NEW.rowid, NEW.title, NEW.description, NEW.instructions);
END;

CREATE TRIGGER recipes_ad AFTER DELETE ON recipes BEGIN
  INSERT INTO recipes_fts(recipes_fts, rowid, title, description, instructions)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.instructions);
END;

CREATE TRIGGER recipes_au AFTER UPDATE ON recipes BEGIN
  INSERT INTO recipes_fts(recipes_fts, rowid, title, description, instructions)
  VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.instructions);
  INSERT INTO recipes_fts(rowid, title, description, instructions)
  VALUES (NEW.rowid, NEW.title, NEW.description, NEW.instructions);
END;
```

#### Migration Strategy

Migrations are numbered SQL files in `packages/core/src/db/migrations/`:

```
001_initial.sql
002_add_recipe_rating.sql
003_add_grocery_list.sql
```

Migration runner (`packages/core/src/db/migrate.ts`):

```typescript
import Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export function migrate(db: Database.Database, migrationsDir: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all()
      .map((row: any) => row.version)
  );

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (applied.has(version)) continue;

    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
    })();
    console.log(`Applied migration ${file}`);
  }
}
```

### Deliverable C: API Specification

Base URL: `http://localhost:3000/api`

All responses follow:
```typescript
type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};
```

#### Recipe Endpoints

**GET /recipes**
Search and list recipes with pagination.

Request:
```
GET /recipes?q=chicken&tags=dinner,easy&cuisine=italian&page=1&limit=20
```

Response:
```typescript
{
  success: true,
  data: {
    items: Recipe[],
    pagination: {
      page: number,
      limit: number,
      total: number,
      totalPages: number
    }
  }
}
```

**GET /recipes/:id**

Response:
```typescript
{
  success: true,
  data: {
    id: string,
    title: string,
    description: string | null,
    instructions: string,
    servings: number,
    prepTimeMinutes: number | null,
    cookTimeMinutes: number | null,
    sourceUrl: string | null,
    sourceType: 'manual' | 'imported' | 'agent_curated',
    cuisine: string | null,
    difficulty: 'easy' | 'medium' | 'hard' | null,
    ingredients: {
      id: string,
      name: string,
      quantity: number | null,
      unit: string | null,
      notes: string | null,
      optional: boolean
    }[],
    tags: { id: string, name: string, category: string }[],
    createdAt: string,
    updatedAt: string
  }
}
```

**POST /recipes**
Create a new recipe.

Request:
```typescript
{
  title: string,
  description?: string,
  instructions: string,
  servings?: number,
  prepTimeMinutes?: number,
  cookTimeMinutes?: number,
  sourceUrl?: string,
  cuisine?: string,
  difficulty?: 'easy' | 'medium' | 'hard',
  ingredients: {
    name: string,
    quantity?: number,
    unit?: string,
    notes?: string,
    optional?: boolean
  }[],
  tags?: string[]  // tag names, created if not exist
}
```

Response: Same as GET /recipes/:id

**PUT /recipes/:id**
Full update of a recipe.

Request: Same as POST /recipes
Response: Same as GET /recipes/:id

**DELETE /recipes/:id**

Response:
```typescript
{ success: true, data: { deleted: true } }
```

**POST /recipes/import**
Import recipe from URL.

Request:
```typescript
{
  url: string,
  normalize?: boolean  // default true, use agent to normalize
}
```

Response: Same as GET /recipes/:id

#### Plan Endpoints

**POST /plans**
Create a weekly plan.

Request:
```typescript
{
  week: string  // ISO week: "2025-W02"
}
```

Response:
```typescript
{
  success: true,
  data: {
    id: string,
    week: string,
    status: 'draft' | 'active' | 'completed',
    items: PlanItem[],
    createdAt: string,
    updatedAt: string
  }
}
```

**GET /plans/:week**

Response: Same as POST /plans

**POST /plans/:week/suggest**
Get AI-suggested meals for empty slots.

Request:
```typescript
{
  constraints?: {
    maxPrepTime?: number,
    cuisines?: string[],
    excludeRecipes?: string[],
    preferVariety?: boolean
  }
}
```

Response:
```typescript
{
  success: true,
  data: {
    suggestions: {
      dayOfWeek: number,
      mealType: string,
      recipe: Recipe,
      reason: string
    }[]
  }
}
```

**PUT /plans/:week/meals/:day/:mealType**
Set a specific meal.

Request:
```typescript
{
  recipeId: string,
  servings?: number,
  notes?: string
}
```

Response:
```typescript
{
  success: true,
  data: PlanItem
}
```

**POST /plans/:week/meals/:day/:mealType/swap**
Swap a meal with alternatives.

Request:
```typescript
{
  reason?: string,  // why swapping (don't like it, missing ingredients, etc.)
  constraints?: object
}
```

Response:
```typescript
{
  success: true,
  data: {
    alternatives: {
      recipe: Recipe,
      reason: string
    }[]
  }
}
```

**PUT /plans/:week/status**

Request:
```typescript
{
  status: 'draft' | 'active' | 'completed'
}
```

#### Grocery Endpoints

**POST /grocery/generate**
Generate grocery list for a plan.

Request:
```typescript
{
  week: string,
  excludePantry?: boolean,  // default true
  groupBy?: 'category' | 'recipe' | 'aisle'  // default 'category'
}
```

Response:
```typescript
{
  success: true,
  data: {
    week: string,
    groups: {
      name: string,
      items: {
        ingredient: string,
        totalQuantity: number,
        unit: string,
        recipes: string[]  // recipe titles that need this
      }[]
    }[],
    generatedAt: string
  }
}
```

#### Preference Endpoints

**GET /preferences**

Response:
```typescript
{
  success: true,
  data: {
    dietaryRestrictions: string[],
    dislikedIngredients: string[],
    favoriteCuisines: string[],
    defaultServings: number,
    maxPrepTimeMinutes: number | null,
    planningHeuristics: {
      preferVariety: boolean,
      balanceCuisines: boolean,
      avoidRepeatInWeek: boolean
    }
  }
}
```

**PATCH /preferences**

Request: Partial preferences object
Response: Full preferences object

#### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request body failed validation |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource already exists (e.g., duplicate week) |
| IMPORT_FAILED | 422 | Could not parse recipe from URL |
| INTERNAL_ERROR | 500 | Unexpected server error |

### Deliverable D: CLI Specification

Binary: `meals` (installed globally or via npx)

#### Commands

```
meals recipe <subcommand>     Recipe management
meals plan <subcommand>       Weekly plan management
meals grocery <subcommand>    Grocery list generation
meals prefs <subcommand>      Preferences management
meals db <subcommand>         Database utilities
```

#### Recipe Commands

```bash
# List/search recipes
meals recipe list [--query <text>] [--tag <tag>...] [--cuisine <cuisine>] [--limit <n>] [--json]

# Show recipe details
meals recipe show <id> [--json]

# Add a recipe manually
meals recipe add --title "Pasta Carbonara" --instructions "..." --ingredient "pasta:400g" --tag dinner

# Import from URL
meals recipe import <url> [--no-normalize]

# Delete a recipe
meals recipe delete <id> [--force]

# Export recipe to markdown
meals recipe export <id> [--output <file>]
```

**Examples:**

```bash
$ meals recipe list --query "chicken" --tag dinner
Found 12 recipes:

  ID                                    TITLE                    TIME    CUISINE
  550e8400-e29b-41d4-a716-446655440000  Chicken Tikka Masala     45m     Indian
  550e8400-e29b-41d4-a716-446655440001  Grilled Lemon Chicken    30m     Mediterranean
  ...

$ meals recipe show 550e8400-e29b-41d4-a716-446655440000
# Chicken Tikka Masala

**Servings:** 4  |  **Prep:** 15m  |  **Cook:** 30m  |  **Cuisine:** Indian

## Ingredients
- 500g chicken breast, cubed
- 200ml coconut cream
- 2 tbsp tikka paste
...

## Instructions
1. Marinate chicken in yogurt and spices...
...

$ meals recipe list --json | jq '.items[0].title'
"Chicken Tikka Masala"
```

#### Plan Commands

```bash
# Create a new weekly plan
meals plan create <week>   # week format: 2025-W02 or "this-week" or "next-week"

# Show current plan
meals plan show [<week>] [--json]

# Get AI suggestions to fill empty slots
meals plan suggest [<week>] [--max-prep <minutes>] [--cuisine <cuisine>...]

# Set a specific meal
meals plan set <week> <day> <meal> <recipe-id>
# day: mon|tue|wed|thu|fri|sat|sun
# meal: breakfast|lunch|dinner

# Swap a meal (get alternatives)
meals plan swap <week> <day> <meal> [--reason <text>]

# Mark plan as active
meals plan activate <week>

# Export plan to markdown
meals plan export [<week>] [--output <file>]
```

**Examples:**

```bash
$ meals plan create next-week
Created plan for 2025-W03 (draft)

$ meals plan suggest
Suggesting meals for 2025-W03...

  DAY   MEAL      SUGGESTION              REASON
  Mon   dinner    Chicken Stir Fry        Quick weeknight meal, uses pantry staples
  Tue   dinner    Beef Tacos              Different cuisine from Monday
  Wed   dinner    Pasta Primavera         Vegetarian variety
  ...

Apply suggestions? [y/N]

$ meals plan set 2025-W03 mon dinner 550e8400-e29b-41d4-a716-446655440000
Set Monday dinner to "Chicken Tikka Masala"

$ meals plan show
# Week 2025-W03 (draft)

| Day | Breakfast | Lunch | Dinner |
|-----|-----------|-------|--------|
| Mon | - | - | Chicken Tikka Masala |
| Tue | - | - | Beef Tacos |
...
```

#### Grocery Commands

```bash
# Generate grocery list
meals grocery generate [<week>] [--include-pantry] [--group-by <category|recipe|aisle>] [--json]

# Export to markdown/text
meals grocery export [<week>] [--output <file>] [--format <md|txt|json>]
```

**Examples:**

```bash
$ meals grocery generate
# Grocery List for 2025-W03

## Produce
- [ ] Chicken breast (1.5 kg) - Tikka Masala, Stir Fry
- [ ] Onions (4) - Tikka Masala, Tacos, Primavera
- [ ] Bell peppers (3) - Stir Fry, Primavera

## Dairy
- [ ] Greek yogurt (500ml) - Tikka Masala
...

$ meals grocery generate --json | jq '.groups[0].items | length'
8
```

#### Preference Commands

```bash
# Show all preferences
meals prefs show [--json]

# Set preferences
meals prefs set dietary-restrictions vegetarian,gluten-free
meals prefs set disliked-ingredients cilantro,olives
meals prefs set default-servings 2
meals prefs set max-prep-time 30

# Clear a preference
meals prefs clear <key>
```

#### Database Commands

```bash
# Run pending migrations
meals db migrate

# Backup database
meals db backup [--output <file>]

# Show stats
meals db stats
```

#### Global Flags

- `--json` - Output as JSON instead of human-readable
- `--quiet` - Suppress non-essential output
- `--verbose` - Show debug information
- `--db <path>` - Use alternate database file

### Deliverable E: Claude Agent Tool Contract

#### Tool Definitions

All tools follow this pattern:
```typescript
interface ToolDefinition<TInput, TOutput> {
  name: string;
  description: string;
  inputSchema: ZodSchema<TInput>;
  outputSchema: ZodSchema<TOutput>;
  handler: (input: TInput, context: AgentContext) => Promise<TOutput>;
}

interface AgentContext {
  agentId: string;  // 'curator' | 'planner'
  sessionId: string;
}
```

#### Curator Agent Tools

**1. search_recipes**
```typescript
// Input
{
  query?: string,
  tags?: string[],
  cuisine?: string,
  limit?: number  // default 20, max 100
}

// Output
{
  recipes: {
    id: string,
    title: string,
    cuisine: string | null,
    tags: string[],
    prepTimeMinutes: number | null,
    cookTimeMinutes: number | null
  }[],
  total: number
}
```

**2. get_recipe**
```typescript
// Input
{ id: string }

// Output
{
  recipe: Recipe  // full recipe with ingredients
}
```

**3. import_recipe**
```typescript
// Input
{
  url: string
}

// Output
{
  success: boolean,
  recipe?: Recipe,
  error?: string
}
```

**4. normalize_recipe**
```typescript
// Input
{
  id: string,
  updates: {
    title?: string,
    ingredients?: { name: string, quantity?: number, unit?: string }[],
    tags?: string[],
    cuisine?: string,
    difficulty?: 'easy' | 'medium' | 'hard'
  }
}

// Output
{
  recipe: Recipe
}
```

**5. create_recipe**
```typescript
// Input
{
  title: string,
  description?: string,
  instructions: string,
  servings?: number,
  prepTimeMinutes?: number,
  cookTimeMinutes?: number,
  ingredients: { name: string, quantity?: number, unit?: string, optional?: boolean }[],
  tags?: string[],
  cuisine?: string,
  difficulty?: 'easy' | 'medium' | 'hard'
}

// Output
{
  recipe: Recipe
}
```

#### Planner Agent Tools

**1. get_preferences**
```typescript
// Input: {}

// Output
{
  preferences: Preferences
}
```

**2. get_week_plan**
```typescript
// Input
{
  week: string  // ISO week
}

// Output
{
  plan: WeeklyPlan | null,
  filledSlots: number,
  emptySlots: { dayOfWeek: number, mealType: string }[]
}
```

**3. suggest_meals**
```typescript
// Input
{
  week: string,
  slots: { dayOfWeek: number, mealType: string }[],  // which slots to fill
  constraints?: {
    maxPrepTime?: number,
    cuisines?: string[],
    excludeRecipes?: string[],
    preferVariety?: boolean,
    considerPantry?: boolean
  }
}

// Output
{
  suggestions: {
    dayOfWeek: number,
    mealType: string,
    recipeId: string,
    recipeTitle: string,
    score: number,  // 0-100 confidence
    reasoning: string
  }[]
}
```

**4. set_meal**
```typescript
// Input
{
  week: string,
  dayOfWeek: number,  // 1-7
  mealType: 'breakfast' | 'lunch' | 'dinner',
  recipeId: string,
  servings?: number
}

// Output
{
  planItem: PlanItem
}
```

**5. swap_meal**
```typescript
// Input
{
  week: string,
  dayOfWeek: number,
  mealType: string,
  reason: string,  // required for audit
  newRecipeId: string
}

// Output
{
  oldRecipe: { id: string, title: string },
  newRecipe: { id: string, title: string },
  planItem: PlanItem
}
```

**6. get_swap_alternatives**
```typescript
// Input
{
  week: string,
  dayOfWeek: number,
  mealType: string,
  reason?: string,
  count?: number  // default 3
}

// Output
{
  currentRecipe: { id: string, title: string },
  alternatives: {
    recipeId: string,
    recipeTitle: string,
    reasoning: string,
    score: number
  }[]
}
```

**7. generate_grocery_list**
```typescript
// Input
{
  week: string,
  excludePantry?: boolean
}

// Output
{
  items: {
    ingredient: string,
    quantity: number,
    unit: string,
    category: string,
    recipes: string[]
  }[],
  totalItems: number
}
```

#### Safety Rules and Invariants

1. **No Direct DB Access**
   - All tools route through service layer
   - Database connection is not exposed to tool handlers
   - SQL injection impossible by design (parameterized queries only)

2. **Idempotency Expectations**
   - `set_meal` is idempotent: calling twice with same params = same result
   - `swap_meal` is NOT idempotent: each call creates audit entry
   - `create_recipe` is NOT idempotent: generates new UUID each time
   - `import_recipe` checks for duplicate source URLs

3. **Audit Log Requirements**
   - Every mutation tool logs to `audit_log`
   - Log entry includes: timestamp, agent_id, action, entity_type, entity_id, details (JSON)
   - Read-only tools do not log
   - Audit log is append-only (no deletes/updates)

4. **Rate Limiting**
   - Max 100 tool calls per minute per agent
   - Max 10 recipe imports per minute (external fetches)

5. **Validation**
   - All inputs validated against Zod schemas before handler execution
   - Invalid input returns structured error, not exception

#### Agent Descriptions

**Curator Agent**
- **Purpose:** Import, normalize, and maintain recipe quality
- **Capabilities:**
  - Search existing recipes to avoid duplicates
  - Import recipes from URLs
  - Normalize ingredient names and quantities
  - Tag recipes appropriately
  - Create new recipes from descriptions
- **Invocation:** User says "import this recipe" or "add a recipe for X" or periodic curation runs
- **Behavior:**
  1. When importing: fetch URL, extract recipe data, normalize ingredients to standard names
  2. Check for duplicate titles/URLs before creating
  3. Infer tags based on ingredients and instructions (e.g., "vegetarian" if no meat)
  4. Set difficulty based on prep time and technique complexity

**Planner Agent**
- **Purpose:** Build and refine weekly meal plans
- **Capabilities:**
  - Generate meal suggestions based on preferences and constraints
  - Fill empty plan slots
  - Handle swap requests with good alternatives
  - Consider variety, nutrition balance, and prep time
- **Invocation:** User says "plan next week", "suggest meals", "swap this meal"
- **Behavior:**
  1. Load user preferences first
  2. Check current plan state (what's filled, what's empty)
  3. Apply planning heuristics (see below)
  4. Present suggestions with reasoning
  5. Apply selections via set_meal

#### Planning Heuristics

```typescript
interface PlanningHeuristics {
  // Variety rules
  avoidSameCuisineConsecutiveDays: boolean;  // default true
  avoidSameProteinConsecutiveDays: boolean;  // default true
  maxRepeatRecipePerWeek: number;            // default 1

  // Balance rules
  targetVegetarianMealsPerWeek: number;      // default 2
  balanceCuisineDistribution: boolean;       // default true

  // Practical rules
  quickMealsOnWeekdays: boolean;             // default true (< 30min prep)
  longerMealsOnWeekends: boolean;            // default true

  // Preference weighting
  favoriteRecipeBoost: number;               // 0-1, default 0.3
  recentlyMadeRecipePenalty: number;         // 0-1, default 0.5
}
```

**Scoring Algorithm:**
```
score = baseScore
  + (isFavorite ? favoriteBoost : 0)
  - (madeWithinLast2Weeks ? recentPenalty : 0)
  + (matchesCuisinePreference ? 0.2 : 0)
  + (meetsTimeConstraint ? 0.1 : 0)
  - (violatesVarietyRule ? 0.3 : 0)
```

#### Swap Meal Behavior

Swap is a first-class operation, not just delete + add:

1. User requests swap with optional reason
2. System calls `get_swap_alternatives` which:
   - Excludes current recipe
   - Considers reason (e.g., "missing ingredients" suggests simpler recipes)
   - Applies all planning heuristics
   - Returns 3 alternatives with scores and reasoning
3. User selects alternative
4. System calls `swap_meal` which:
   - Updates plan_item in single transaction
   - Logs swap with old/new recipe and reason
   - Returns updated plan item

### Deliverable F: Tmux Operational Workflow

#### Session Layout

Session name: `meals`

```
┌─────────────────────────────────────────────────────────────┐
│ Window 0: api                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ API server logs (pino-pretty)                           │ │
│ │ $ pnpm --filter @meals/api start                        │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Window 1: cli                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Interactive CLI usage                                    │ │
│ │ $ meals plan show                                        │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Window 2: dev                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Development work (editing, git, tests)                   │ │
│ │ $ pnpm test                                              │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ Window 3: logs                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ $ tail -f logs/api.log | pino-pretty                     │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Bootstrap Script

`scripts/start-tmux.sh`:
```bash
#!/bin/bash
set -e

SESSION="meals"
PROJECT_DIR="$HOME/Projects/meal-planner"

# Kill existing session if present
tmux kill-session -t $SESSION 2>/dev/null || true

# Create new session with api window
tmux new-session -d -s $SESSION -n api -c $PROJECT_DIR

# Start API server in window 0
tmux send-keys -t $SESSION:api "pnpm --filter @meals/api start 2>&1 | tee -a logs/api.log | pnpm exec pino-pretty" Enter

# Create cli window
tmux new-window -t $SESSION -n cli -c $PROJECT_DIR
tmux send-keys -t $SESSION:cli "# CLI ready. Try: meals plan show" Enter

# Create dev window
tmux new-window -t $SESSION -n dev -c $PROJECT_DIR
tmux send-keys -t $SESSION:dev "# Dev window. Run tests: pnpm test" Enter

# Create logs window
tmux new-window -t $SESSION -n logs -c $PROJECT_DIR
tmux send-keys -t $SESSION:logs "tail -f logs/api.log 2>/dev/null | pnpm exec pino-pretty || echo 'No logs yet'" Enter

# Select cli window
tmux select-window -t $SESSION:cli

echo "Tmux session '$SESSION' started. Attach with: tmux attach -t $SESSION"
```

#### Logging Strategy

1. **API logs:** JSON to `logs/api.log` via pino, pretty-printed in tmux
2. **Log rotation:** Use `logrotate` or simple daily rotation script
3. **Log levels:** `debug` in dev, `info` in production
4. **Structured logging:** All logs include timestamp, level, module, message, and context

```typescript
// packages/api/src/server.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined
});
```

#### Process Restart

Simple approach using a wrapper script:

`scripts/start-api.sh`:
```bash
#!/bin/bash
cd "$(dirname "$0")/.."

while true; do
  echo "[$(date)] Starting API server..."
  pnpm --filter @meals/api start
  EXIT_CODE=$?
  echo "[$(date)] API server exited with code $EXIT_CODE"

  if [ $EXIT_CODE -eq 0 ]; then
    echo "Clean exit, not restarting."
    break
  fi

  echo "Restarting in 5 seconds..."
  sleep 5
done
```

Update tmux to use this:
```bash
tmux send-keys -t $SESSION:api "./scripts/start-api.sh 2>&1 | tee -a logs/api.log" Enter
```

### Deliverable G: Implementation Plan

See Task Backlog (Section 7) for detailed tickets.

#### Milestones

**Milestone 1: Foundation (T001-T005)**
- Project setup, database schema, basic models
- Goal: `pnpm build` works, migrations run

**Milestone 2: Recipe Core (T006-T009)**
- Recipe CRUD, search, import
- Goal: Can add and find recipes via CLI

**Milestone 3: Planning Core (T010-T013)**
- Weekly plans, meal assignment
- Goal: Can create and view weekly plan

**Milestone 4: Grocery & Preferences (T014-T016)**
- Grocery list generation, user preferences
- Goal: Can generate shopping list

**Milestone 5: API Layer (T017-T019)**
- HTTP API with all endpoints
- Goal: All CLI features available via HTTP

**Milestone 6: Agent Tools (T020-T023)**
- Tool definitions, curator agent, planner agent
- Goal: Claude agents can manage recipes and plans

**Milestone 7: Polish (T024-T025)**
- Tmux setup, backup strategy, documentation
- Goal: System is production-ready

#### What to Build First (v1 MVP)

1. Database + migrations
2. Recipe model + repo + service
3. Recipe CLI commands (add, list, show)
4. Plan model + repo + service
5. Plan CLI commands (create, show, set)
6. Grocery generation
7. Basic API server

This gives a usable system for manual meal planning within the first milestone.

#### Testing Strategy

- **Unit tests:** Vitest for services and repos
- **Integration tests:** Test API endpoints against real SQLite (in-memory)
- **No E2E tests:** CLI commands tested via unit tests on underlying services
- **Coverage target:** 80% on core package

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test --coverage

# Run specific package
pnpm --filter @meals/core test
```

#### Backup Strategy

1. **Automatic daily backup:**
   ```bash
   # scripts/backup.sh
   #!/bin/bash
   BACKUP_DIR="$HOME/backups/meals"
   mkdir -p "$BACKUP_DIR"
   DATE=$(date +%Y%m%d_%H%M%S)
   cp data/meals.db "$BACKUP_DIR/meals_$DATE.db"

   # Keep last 30 backups
   ls -t "$BACKUP_DIR"/meals_*.db | tail -n +31 | xargs rm -f 2>/dev/null
   ```

2. **Cron job:** `0 2 * * * /home/user/Projects/meal-planner/scripts/backup.sh`

3. **Export to JSON:** `meals db export --output backups/meals_export.json`

4. **Git-tracked exports:** Markdown exports in `data/exports/` can be committed

#### Security Considerations

1. **SQLite file permissions:** `chmod 600 data/meals.db`
2. **No auth needed:** Single-user local system
3. **Input validation:** All inputs validated with Zod before processing
4. **URL imports:** Sanitize HTML, limit fetch size (5MB max)
5. **No secrets in logs:** Pino configured to redact sensitive fields
6. **CORS:** Restrict to localhost in production

## 6. Definition of Done

- [ ] **Build:** `pnpm build` succeeds with no TypeScript errors
- [ ] **Test:** `pnpm test` passes with >80% coverage on core package
- [ ] **Run:** API starts with `pnpm --filter @meals/api start` and responds to health check
- [ ] **CLI:** All documented commands work as specified
- [ ] **Validation:** Can complete this workflow:
  1. Import 5 recipes from URLs
  2. Create a weekly plan
  3. Fill all dinner slots with suggestions
  4. Swap one meal
  5. Generate grocery list
  6. Export plan to markdown

## 7. Task Backlog

### Ticket: T001 Initialize monorepo structure
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T001
- **Scope:** Create pnpm workspace with package.json files for root, core, api, cli, agent-tools
- **Acceptance Criteria:** `pnpm install` works, packages can import each other
- **Validation Steps:** `pnpm install && pnpm build` (should succeed even if empty)
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create root package.json with pnpm workspaces config, pnpm-workspace.yaml, and package.json for each of the 4 packages (core, api, cli, agent-tools)
    - Key constraints: Follow monorepo layout from PLAN.md section 5 exactly. Use @meals/ scope for packages.
    - Dependencies: None - this is the first ticket
    - Estimated complexity: simple
  - Agent-T001 implementation notes:
    - Files created: package.json (root), pnpm-workspace.yaml, tsconfig.base.json, packages/{core,api,cli,agent-tools}/package.json, packages/{core,api,cli,agent-tools}/tsconfig.json, packages/{core,api,cli,agent-tools}/src/index.ts
    - Directories created: packages/, data/exports/, scripts/, logs/
    - Installed pnpm globally (was not available)
    - Added basic tsconfig files to enable build validation
    - Validation results:
      * pnpm install: Success (5 workspace projects, typescript 5.9.3 installed)
      * pnpm build: Success (all 4 packages built, dist/ created in each)
      * Workspace links verified: api, cli, agent-tools all link to @meals/core

### Ticket: T002 Configure TypeScript
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T002
- **Scope:** Create tsconfig.base.json and per-package tsconfig.json with strict mode
- **Acceptance Criteria:** TypeScript compiles all packages, path aliases work
- **Validation Steps:** `pnpm build` produces dist/ in each package
- **Notes:**
  - Orchestrator notes:
    - Intended approach: T001 already created basic tsconfig files. Verify strict mode is enabled and add path aliases if needed for cross-package imports.
    - Key constraints: Must use ESM (type: module), strict mode required
    - Dependencies: T001 (done)
    - Estimated complexity: simple
    - Note: Basic tsconfig files already exist from T001 - enhance them if needed, verify they meet acceptance criteria
  - Agent-T002 implementation notes:
    - Reviewed existing TypeScript configuration created by T001
    - tsconfig.base.json already has strict: true enabled
    - All packages use ESM (module: NodeNext, moduleResolution: NodeNext)
    - Added @meals/core imports to api, cli, and agent-tools to validate cross-package imports
    - Validation results:
      * `pnpm build`: SUCCESS - all 4 packages compiled (core, api, cli, agent-tools)
      * dist/ directories created in all packages with .js, .d.ts, .d.ts.map, .js.map files
      * Strict mode: VERIFIED - "strict": true in tsconfig.base.json
      * Cross-package imports: VERIFIED - all packages successfully import and re-export from @meals/core at runtime
      * Runtime test: node import of each package's dist/index.js shows coreVersion from @meals/core

### Ticket: T003 Set up SQLite connection
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T003
- **Scope:** Create database connection module in core with better-sqlite3
- **Acceptance Criteria:** Can open/close database, handle missing file gracefully
- **Validation Steps:** Unit test creates temp db, runs query, closes
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Install better-sqlite3 in core package, create db/connection.ts with getDb() function
    - Key constraints: Sync API (better-sqlite3 is synchronous), handle db file creation if missing
    - Dependencies: T001 (done), T002 (done)
    - Estimated complexity: simple
  - Agent-T003 implementation notes:
    - Installed better-sqlite3 ^12.5.0 and @types/better-sqlite3 ^7.6.13 in @meals/core
    - Created packages/core/src/db/connection.ts with:
      - getDb(options): Opens/returns database connection, creates file and parent dirs if missing
      - closeDb(db?): Closes database connection
      - isDbOpen(): Checks if singleton connection is open
      - Singleton pattern for default path (data/meals.db)
      - WAL mode enabled for file-based databases
      - Foreign keys enabled
    - Exported from packages/core/src/index.ts
    - Created tests/connection.test.ts with 8 passing tests
    - Added tsx ^4.21.0 for running TypeScript tests
    - Updated root package.json to allow better-sqlite3 and esbuild builds
    - Validation results:
      * Unit tests: 8/8 PASS (temp db creation, queries, WAL mode, foreign keys, etc.)
      * better-sqlite3 installed: VERIFIED in @meals/core dependencies
      * pnpm build: SUCCESS - all 4 packages compile without errors

### Ticket: T004 Implement migration system
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T004
- **Scope:** Create migrate.ts and schema_migrations table tracking
- **Acceptance Criteria:** Migrations run in order, skip already-applied, transactional
- **Validation Steps:** Run migrate twice, second run does nothing
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create db/migrate.ts per PLAN.md spec (section 5, Migration Strategy)
    - Key constraints: Read SQL files from migrations/ dir, track in schema_migrations table, transactional
    - Dependencies: T003 (done)
    - Estimated complexity: moderate
    - Reference: See PLAN.md lines 400-446 for migrate.ts implementation example
  - Agent-T004 implementation notes:
    - Created packages/core/src/db/migrate.ts with:
      - migrate(db, migrationsDir): Main function - runs pending migrations in order
      - getAppliedMigrations(db): Returns list of applied migrations with timestamps
      - getDefaultMigrationsDir(): Returns path to default migrations directory
    - Created packages/core/src/db/migrations/ directory
    - Created 001_test.sql test migration (creates test_table)
    - Exported migrate, getAppliedMigrations, getDefaultMigrationsDir from index.ts
    - Created tests/migrate.test.ts with 8 passing tests covering:
      - Creates schema_migrations table
      - Applies migrations in order (sorted by filename)
      - Skips already-applied migrations (second run does nothing)
      - Transactional rollback on failure
      - Handles missing migrations directory gracefully
      - Skips files without version number prefix
      - getAppliedMigrations returns empty array when table doesn't exist
      - getAppliedMigrations returns migrations in order with timestamps
    - Validation results:
      * `pnpm build`: SUCCESS - all 4 packages compile without TypeScript errors
      * Migration tests: 8/8 PASS
      * Connection tests: 8/8 PASS (no regressions)

### Ticket: T005 Create initial schema migration
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T005
- **Scope:** Write 001_initial.sql with all tables, indexes, FTS
- **Acceptance Criteria:** All tables from Deliverable B exist after migration
- **Validation Steps:** `meals db migrate` then `.schema` in sqlite3 shows all tables
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create 001_initial.sql with full schema from PLAN.md Deliverable B (lines 256-398)
    - Key constraints: Must include all tables (recipes, ingredients, recipe_ingredients, tags, recipe_tags, weekly_plans, plan_items, pantry_items, preferences, audit_log), indexes, and FTS5 triggers
    - Dependencies: T004 (done)
    - Estimated complexity: moderate (large SQL file)
    - Note: Replace the test 001_test.sql with actual 001_initial.sql
  - Agent-T005 notes:
    - COMPLETE: Deleted 001_test.sql and created 001_initial.sql with full schema
    - All 10 tables created: recipes, ingredients, recipe_ingredients, tags, recipe_tags, weekly_plans, plan_items, pantry_items, preferences, audit_log
    - All 11 indexes created: idx_recipes_title, idx_recipes_cuisine, idx_recipe_ingredients_recipe, idx_recipe_ingredients_ingredient, idx_recipe_tags_recipe, idx_recipe_tags_tag, idx_plan_items_plan, idx_plan_items_recipe, idx_audit_log_timestamp, idx_audit_log_actor, idx_audit_log_entity
    - FTS5 virtual table recipes_fts created with triggers: recipes_ai, recipes_ad, recipes_au
    - Added 6 new tests to migrate.test.ts verifying all tables, indexes, FTS, and trigger functionality
    - All tests pass (13 passed), build passes

### Ticket: T006 Implement recipe model and types
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T006
- **Scope:** Create Zod schemas for Recipe, Ingredient, RecipeIngredient, Tag
- **Acceptance Criteria:** Types exported from @meals/core, validation works
- **Validation Steps:** Unit tests for schema validation pass/fail cases
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create models/ directory with Zod schemas matching DB schema
    - Key constraints: Use Zod for runtime validation, export inferred types
    - Dependencies: T005 (done) - schema defines the data model
    - Estimated complexity: moderate
    - Files to create: models/recipe.ts, models/ingredient.ts, models/tag.ts, models/index.ts
  - Agent-T006 notes:
    - COMPLETE: All Zod schemas created and exported from @meals/core
    - Installed zod ^4.3.4 in @meals/core
    - Files created:
      - packages/core/src/models/ingredient.ts: IngredientSchema, CreateIngredientSchema, UpdateIngredientSchema
      - packages/core/src/models/tag.ts: TagSchema, TagCategoryEnum, RecipeTagSchema, CreateTagSchema, UpdateTagSchema
      - packages/core/src/models/recipe.ts: RecipeSchema, RecipeIngredientSchema, SourceTypeEnum, DifficultyEnum, CreateRecipeSchema, UpdateRecipeSchema, CreateRecipeIngredientSchema, RecipeWithRelationsSchema
      - packages/core/src/models/index.ts: Re-exports all schemas and types
    - All schemas include:
      - Runtime validation with meaningful error messages
      - Nullable optional fields (matching DB schema)
      - Enum constraints matching CHECK constraints in SQL
      - Create/Update variants where appropriate
    - tests/models.test.ts: 33 tests covering pass/fail validation cases
    - Validation results:
      - `pnpm --filter @meals/core test`: 54/54 PASS (8 connection + 13 migrate + 33 models)
      - `pnpm --filter @meals/core build`: SUCCESS - all .d.ts and .js files generated

### Ticket: T007 Implement recipe repository
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T007
- **Scope:** CRUD operations for recipes with ingredients and tags
- **Acceptance Criteria:** Can create, read, update, delete recipes with relations
- **Validation Steps:** Integration tests against in-memory SQLite
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create repos/recipe.repo.ts with CRUD methods using raw SQL
    - Key constraints: No ORM, parameterized queries only, handle relations (ingredients, tags)
    - Dependencies: T005 (schema), T006 (types)
    - Estimated complexity: moderate-high
    - Must handle: recipe_ingredients junction, recipe_tags junction
  - Agent-T007 implementation notes:
    - Installed uuid ^13.0.0 and @types/uuid ^11.0.0 in @meals/core
    - Files created:
      - packages/core/src/repos/recipe.repo.ts: RecipeRepository class with full CRUD
      - packages/core/src/repos/index.ts: Re-exports RecipeRepository and types
      - packages/core/tests/recipe.repo.test.ts: 23 integration tests
    - RecipeRepository methods:
      - create(data, ingredients?, tagIds?): Create recipe with optional relations
      - getById(id): Get recipe with ingredients and tags
      - list(options?): List recipes with filters (cuisine, difficulty, tagIds, search, limit, offset)
      - update(data, ingredients?, tagIds?): Update recipe, optionally replace relations
      - delete(id): Delete recipe (CASCADE handles relations)
      - exists(id): Check if recipe exists
      - count(options?): Count recipes with optional filters
    - Handles recipe_ingredients and recipe_tags junctions correctly
    - Uses transactions for create/update with relations
    - All raw SQL with parameterized queries (no ORM)
    - Validation results:
      - `pnpm build`: SUCCESS - all packages compile without errors
      - `pnpm test`: SUCCESS - 77/77 tests pass (8 connection + 13 migrate + 33 models + 23 recipe.repo)

### Ticket: T008 Implement recipe search with FTS
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Search recipes by text query using FTS5, filter by tags/cuisine
- **Acceptance Criteria:** Search returns ranked results, filters work
- **Validation Steps:** Test: add 10 recipes, search finds expected matches
- **Notes:**

### Ticket: T009 Implement recipe service
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T009
- **Scope:** Business logic layer for recipes with audit logging
- **Acceptance Criteria:** Service methods call repo, log to audit_log
- **Validation Steps:** Unit tests mock repo, verify audit entries
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create services/recipe.service.ts that wraps RecipeRepository
    - Key constraints: All mutations must log to audit_log table, use AuditRepository
    - Dependencies: T007 (recipe repo), T016 (audit repo - not done yet, may need to implement basic audit inline)
    - Estimated complexity: moderate
    - Actor types: 'user', 'cli', 'api', 'agent:curator', 'agent:planner'
  - Agent-T009 implementation notes:
    - Files created:
      - packages/core/src/repos/audit.repo.ts: AuditRepository class with log(), getByEntityId(), getByEntityType(), getRecent() methods
      - packages/core/src/services/recipe.service.ts: RecipeService class wrapping RecipeRepository with audit logging
      - packages/core/src/services/index.ts: Re-exports RecipeService
      - packages/core/tests/recipe.service.test.ts: 19 unit tests covering service behavior and audit logging
    - RecipeService methods:
      - createRecipe(data, ingredients?, tagIds?, actor?): Create recipe + audit log entry
      - getRecipe(id): Read (no audit logging)
      - listRecipes(options?): Read (no audit logging)
      - updateRecipe(data, ingredients?, tagIds?, actor?): Update recipe + audit log entry (with details of what changed)
      - deleteRecipe(id, actor?): Delete recipe + audit log entry (with title in details)
      - recipeExists(id): Read (no audit logging)
      - countRecipes(options?): Read (no audit logging)
      - getRecipeAuditLog(recipeId): Get audit entries for a recipe
    - Audit logging:
      - All mutations (create, update, delete) log to audit_log table
      - Default actor is 'user' when not specified
      - Supports all actor types: 'user', 'cli', 'api', 'agent:curator', 'agent:planner'
      - Details include relevant info (title, ingredient count, tag count, changed fields, etc.)
      - Non-existent entities do not create audit entries (update/delete return null/false without logging)
    - Updated exports:
      - packages/core/src/repos/index.ts: Added AuditRepository and types
      - packages/core/src/index.ts: Added AuditRepository exports and RecipeService export
      - packages/core/package.json: Added recipe.service.test.ts to test script
    - Validation results:
      - `pnpm build`: SUCCESS - all packages compile without errors
      - `pnpm test`: SUCCESS - 96/96 tests pass (8 connection + 13 migrate + 33 models + 23 recipe.repo + 19 recipe.service)

### Ticket: T010 Implement plan model and types
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T010
- **Scope:** Zod schemas for WeeklyPlan, PlanItem
- **Acceptance Criteria:** Types exported, ISO week validation works
- **Validation Steps:** Unit tests for week format validation
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create models/plan.ts with Zod schemas matching DB
    - Key constraints: ISO week format (YYYY-Www), day_of_week 1-7, meal_type enum
    - Dependencies: T006 (recipe model pattern)
    - Estimated complexity: simple
  - Agent notes:
    - Implementation complete: Created `/packages/core/src/models/plan.ts`
    - Exported all types from `/packages/core/src/models/index.ts`
    - Added 35 unit tests for plan schemas to `/packages/core/tests/models.test.ts`
    - ISO week regex: `/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/`
    - Helper function `isValidIsoWeek()` exported for convenience
    - All tests pass (68 model tests total), `pnpm build` succeeds

### Ticket: T011 Implement plan repository
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** CRUD for weekly plans and plan items
- **Acceptance Criteria:** Can create plan, add/update/remove meals
- **Validation Steps:** Integration tests for plan lifecycle
- **Notes:**

### Ticket: T012 Implement plan service
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Business logic for plans, meal assignment, status transitions
- **Acceptance Criteria:** Service enforces rules (unique meal per slot, valid status)
- **Validation Steps:** Unit tests for business rules
- **Notes:**

### Ticket: T013 Implement meal suggestion algorithm
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Scoring algorithm for suggesting meals based on heuristics
- **Acceptance Criteria:** Returns ranked suggestions with reasons
- **Validation Steps:** Test with mock recipes, verify variety rules applied
- **Notes:**

### Ticket: T014 Implement grocery service
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Aggregate ingredients from plan, group by category
- **Acceptance Criteria:** Generates shopping list with quantities summed
- **Validation Steps:** Test with plan containing overlapping ingredients
- **Notes:**

### Ticket: T015 Implement preference model and repository
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Key-value preference storage with typed access
- **Acceptance Criteria:** Can get/set preferences, defaults provided
- **Validation Steps:** Unit tests for preference CRUD
- **Notes:**

### Ticket: T016 Implement audit repository
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Append-only audit log with query capabilities
- **Acceptance Criteria:** Can log actions, query by actor/entity/timerange
- **Validation Steps:** Integration test logs 100 entries, queries correctly
- **Notes:**

### Ticket: T017 Create CLI entry point and structure
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Set up commander with subcommands, --json flag, output helpers
- **Acceptance Criteria:** `meals --help` shows all commands
- **Validation Steps:** `pnpm --filter @meals/cli build && ./bin/meals --help`
- **Notes:**

### Ticket: T018 Implement recipe CLI commands
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** list, show, add, delete, export commands
- **Acceptance Criteria:** All commands work per Deliverable D spec
- **Validation Steps:** Manual test each command, verify JSON output
- **Notes:**

### Ticket: T019 Implement plan CLI commands
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** create, show, suggest, set, swap, activate, export commands
- **Acceptance Criteria:** All commands work per Deliverable D spec
- **Validation Steps:** Manual test plan workflow end-to-end
- **Notes:**

### Ticket: T020 Implement grocery and prefs CLI commands
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** grocery generate/export, prefs show/set/clear
- **Acceptance Criteria:** Commands work per Deliverable D spec
- **Validation Steps:** Generate grocery list for a filled plan
- **Notes:**

### Ticket: T021 Create Fastify API server
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Server setup with CORS, validation, error handling
- **Acceptance Criteria:** Server starts, health endpoint works
- **Validation Steps:** `curl localhost:3000/health` returns 200
- **Notes:**

### Ticket: T022 Implement API routes
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** All endpoints from Deliverable C
- **Acceptance Criteria:** All endpoints return correct shapes
- **Validation Steps:** Integration tests for each endpoint
- **Notes:**

### Ticket: T023 Implement recipe import from URL
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Fetch URL, parse HTML for recipe data, create recipe
- **Acceptance Criteria:** Can import from common recipe sites
- **Validation Steps:** Test with 3 different recipe site URLs
- **Notes:**

### Ticket: T024 Define agent tool schemas
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Zod schemas for all curator and planner tools
- **Acceptance Criteria:** Schemas match Deliverable E specification
- **Validation Steps:** Schema tests for valid/invalid inputs
- **Notes:**

### Ticket: T025 Implement agent tool handlers
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Handler functions for all tools, with audit logging
- **Acceptance Criteria:** Tools call services correctly, log to audit
- **Validation Steps:** Unit tests for each tool handler
- **Notes:**

### Ticket: T026 Create tmux bootstrap script
- **Priority:** P2
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** start-tmux.sh per Deliverable F
- **Acceptance Criteria:** Script creates session with all windows
- **Validation Steps:** Run script, verify 4 windows exist with correct commands
- **Notes:**

### Ticket: T027 Create backup script
- **Priority:** P2
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** backup.sh with rotation, cron setup instructions
- **Acceptance Criteria:** Script copies db, rotates old backups
- **Validation Steps:** Run 35 times, verify only 30 backups remain
- **Notes:**

### Ticket: T028 Add vitest and configure testing
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Set up vitest in all packages with coverage
- **Acceptance Criteria:** `pnpm test` runs all tests, coverage reported
- **Validation Steps:** `pnpm test --coverage` shows >0% coverage
- **Notes:**

## 8. Open Questions

| Question | Context | Decision |
|----------|---------|----------|
| MCP vs direct function calls for agents? | Agent tools can be exposed via MCP server or direct import. MCP adds complexity but enables external agent usage. | Pending - start with direct import, add MCP wrapper later if needed |
| Recipe schema.org parsing? | Many recipe sites use JSON-LD with schema.org Recipe type. Worth parsing? | Pending - implement as primary import strategy |
| Pantry tracking scope? | Marked optional in spec. How much to implement? | Pending - skip for v1, add in v2 |
| Ingredient normalization strategy? | How to map "chicken breasts" to "chicken breast"? | Pending - simple lowercase + singular for v1, agent normalization for v2 |

## 9. Discovered Issues Log

> _New issues must be appended here with a timestamp and brief context._

<!-- Example:
- **2025-01-03 14:30** - Issue description and context
-->
