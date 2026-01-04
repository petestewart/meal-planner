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

**Milestone 8: Enhancements (T029-T039)** *(Planned)*
- Recipe updates, pantry tracking, ratings, favorites
- Ingredient categorization, audit viewing, history tracking
- MCP server for external agent access
- Goal: Full-featured meal planning system

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
- **Status:** Done
- **Owner:** Agent-T008
- **Scope:** Search recipes by text query using FTS5, filter by tags/cuisine
- **Acceptance Criteria:** Search returns ranked results, filters work
- **Validation Steps:** Test: add 10 recipes, search finds expected matches
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Enhance RecipeRepository.list() to use FTS5 recipes_fts table when search query is provided
    - Key constraints: FTS5 table already exists (001_initial.sql), use MATCH syntax, return ranked results
    - Dependencies: T007 (recipe repo - done), T005 (schema with FTS - done)
    - Estimated complexity: moderate
    - Note: FTS5 triggers already set up for insert/update/delete

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
- **Status:** Done
- **Owner:** Agent-T011
- **Scope:** CRUD for weekly plans and plan items
- **Acceptance Criteria:** Can create plan, add/update/remove meals
- **Validation Steps:** Integration tests for plan lifecycle
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create repos/plan.repo.ts with CRUD for plans and items
    - Key constraints: Handle plan items as nested operations, unique constraint on (plan_id, day_of_week, meal_type)
    - Dependencies: T007 (recipe repo pattern), T010 (plan types)
    - Estimated complexity: moderate
  - Agent-T011 implementation notes:
    - Files created:
      - packages/core/src/repos/plan.repo.ts: PlanRepository class with full CRUD for plans and items
      - packages/core/tests/plan.repo.test.ts: 36 integration tests
    - PlanRepository methods for WeeklyPlan:
      - create(data): Create weekly plan with week, status, notes
      - getById(id): Get plan by ID with items
      - getByWeek(week): Get plan by ISO week string with items
      - list(options?): List plans with optional status filter, limit, offset (ordered by week DESC)
      - update(data): Update plan fields (week, status, notes)
      - delete(id): Delete plan (CASCADE handles items)
      - setStatus(id, status): Change plan status
      - exists(id): Check if plan exists
      - count(options?): Count plans with optional status filter
    - PlanRepository methods for PlanItems:
      - setMeal(planId, dayOfWeek, mealType, recipeId, servings?, notes?): Set/update meal (UPSERT behavior via INSERT OR REPLACE)
      - removeMeal(planId, dayOfWeek, mealType): Remove meal from plan
      - getMeals(planId): Get all meals for a plan (ordered by day, then meal type)
      - getMealBySlot(planId, dayOfWeek, mealType): Get specific meal by slot
      - getMealById(id): Get meal by ID
    - Features:
      - Unique constraint on (plan_id, day_of_week, meal_type) handled via UPSERT
      - setMeal preserves existing item ID when updating (for stable references)
      - getMeals returns items ordered: day ASC, then breakfast/lunch/dinner
      - All get/list methods include items array
      - Cascade delete from weekly_plans to plan_items verified
    - Updated exports:
      - packages/core/src/repos/index.ts: Added PlanRepository and ListPlansOptions
      - packages/core/src/index.ts: Added PlanRepository, ListPlansOptions, and all plan model exports
      - packages/core/package.json: Added plan.repo.test.ts to test script
    - Validation results:
      - `pnpm build`: SUCCESS - all packages compile without TypeScript errors
      - `pnpm test`: SUCCESS - 131/131 tests pass (8 connection + 13 migrate + 68 models + 23 recipe.repo + 19 recipe.service + 36 plan.repo)

### Ticket: T012 Implement plan service
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T012
- **Scope:** Business logic for plans, meal assignment, status transitions
- **Acceptance Criteria:** Service enforces rules (unique meal per slot, valid status)
- **Validation Steps:** Unit tests for business rules
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create services/plan.service.ts wrapping PlanRepository
    - Key constraints: Audit logging for mutations, status transition rules, validate recipe exists
    - Dependencies: T009 (recipe service pattern), T011 (plan repo)
    - Estimated complexity: moderate
  - Agent-T012 implementation notes:
    - Files created:
      - packages/core/src/services/plan.service.ts: PlanService class wrapping PlanRepository with audit logging
      - packages/core/tests/plan.service.test.ts: 27 unit tests covering all service methods and business rules
    - PlanService methods:
      - createPlan(data, actor?): Create plan + audit log entry
      - getPlan(id): Read (no audit logging)
      - getPlanByWeek(week): Read (no audit logging)
      - listPlans(options?): Read (no audit logging)
      - updatePlan(data, actor?): Update plan + audit log entry
      - deletePlan(id, actor?): Delete plan + audit log entry (logs week, status, itemCount)
      - setStatus(id, status, actor?): Change status + audit log entry (logs from/to status)
      - setMeal(planId, dayOfWeek, mealType, recipeId, servings?, notes?, actor?): Set meal + audit log entry
      - removeMeal(planId, dayOfWeek, mealType, actor?): Remove meal + audit log entry
      - planExists(id): Check if plan exists (no audit)
      - countPlans(options?): Count plans (no audit)
      - getPlanAuditLog(planId): Get audit entries for plan
    - Business rules enforced:
      - Validates recipe exists before assigning to meal slot (throws error if not found)
      - Allows null recipeId for meal slots without assigned recipes
      - Returns null for operations on non-existent plans (no audit log created)
      - Status transitions: All transitions allowed (draft/active/completed in any direction) - PLAN.md did not specify restrictions
      - Default actor is 'user' when not specified
      - Supports all actor types: 'user', 'cli', 'api', 'agent:curator', 'agent:planner'
    - Updated exports:
      - packages/core/src/services/index.ts: Added PlanService export
      - packages/core/src/index.ts: Added PlanService to services export
      - packages/core/package.json: Added plan.service.test.ts to test script
    - Validation results:
      - `pnpm build`: SUCCESS - all 4 packages compile without TypeScript errors
      - `pnpm test`: SUCCESS - 194/194 tests pass (8 connection + 13 migrate + 68 models + 23 recipe.repo + 19 recipe.service + 36 plan.repo + 27 plan.service)

### Ticket: T013 Implement meal suggestion algorithm
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T013
- **Scope:** Scoring algorithm for suggesting meals based on heuristics
- **Acceptance Criteria:** Returns ranked suggestions with reasons
- **Validation Steps:** Test with mock recipes, verify variety rules applied
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create services/suggestion.service.ts implementing the scoring algorithm from PLAN.md Deliverable E (lines 1264-1293). Score recipes based on: favorites boost, recently made penalty, cuisine preference match, time constraint match, variety rule violations. Return suggestions with reasoning.
    - Key constraints: Must consider user preferences (from PreferenceService), recent meal history, variety rules (avoid same cuisine/protein consecutive days, max 1 repeat per week)
    - Dependencies: T009 (recipe service - done), T012 (plan service - done), T015 (preference service - done)
    - Estimated complexity: moderate-high
    - Reference: PLAN.md Planning Heuristics section (lines 1264-1293) for scoring algorithm
  - Agent-T013 implementation notes:
    - Files created:
      - packages/core/src/services/suggestion.service.ts: SuggestionService class implementing full scoring algorithm
      - packages/core/tests/suggestion.service.test.ts: 34 unit tests covering all scoring factors and edge cases
    - Files modified:
      - packages/core/src/services/index.ts: Added SuggestionService and type exports
      - packages/core/package.json: Added suggestion.service.test.ts to test script
    - SuggestionService features:
      - scoreRecipe(): Scores individual recipes using PLAN.md algorithm
      - getSuggestions(): Returns ranked suggestions for a day/meal with reasoning
      - getSwapAlternatives(): Get alternatives for swapping a meal (excludes current, considers reason)
      - buildContext(): Builds scoring context from user preferences and plan history
      - Scoring factors implemented:
        - Base score: 1.0 for all recipes
        - Favorite boost: +0.3 for favorite recipes
        - Recent penalty: -0.5 for recipes made in last 2 weeks
        - Cuisine preference match: +0.2 for matching favorite cuisines
        - Time constraint match: +0.1 for recipes within max prep time
        - Variety violation: -0.3 for same cuisine/recipe on consecutive days
      - Integrates with PreferenceService for user preferences
      - Integrates with PlanRepository for recent meal history and plan context
    - Validation results:
      - `pnpm build`: SUCCESS - all 4 packages compile without TypeScript errors
      - `pnpm --filter @meals/core test`: SUCCESS - 34 new suggestion tests + all existing tests pass
      - Mock recipe test confirms variety rules correctly penalize same cuisine on consecutive days

### Ticket: T014 Implement grocery service
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T014
- **Scope:** Aggregate ingredients from plan, group by category
- **Acceptance Criteria:** Generates shopping list with quantities summed
- **Validation Steps:** Test with plan containing overlapping ingredients
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create services/grocery.service.ts that takes a week/plan, fetches all plan items with their recipes, aggregates ingredients by name, sums quantities, groups by category
    - Key constraints: Must handle unit conversion where possible (e.g., 2 cups + 1 cup = 3 cups), group by ingredient category from ingredients table
    - Dependencies: T007 (recipe repo - done), T011 (plan repo - done)
    - Estimated complexity: moderate
    - Reference: PLAN.md Deliverable C (Grocery Endpoints) for output format
  - Agent-T014 implementation notes:
    - Files created:
      - packages/core/src/services/grocery.service.ts: GroceryService class with generateList(), generateListForWeek(), generateListForPlan()
      - packages/core/tests/grocery.service.test.ts: 24 unit tests covering all functionality
    - GroceryService features:
      - Takes week string (ISO week) or plan ID
      - Fetches all plan items with their recipes via PlanRepository and RecipeRepository
      - Aggregates ingredients by ingredientId, sums quantities for same ingredient
      - Scales quantities based on plan_items.servings vs recipe.servings
      - Groups ingredients by category (from ingredients table), "Uncategorized" for null
      - Unit conversions: Handles volume (ml, l, cups, tbsp, tsp) and weight (g, kg, oz, lb)
      - Display unit optimization: Converts large quantities to appropriate units (e.g., 1500g -> 1.5kg)
    - Output format matches PLAN.md Deliverable C specification:
      - { week, groups: [{ name, items: [{ ingredient, totalQuantity, unit, recipes }] }], generatedAt }
    - Updated exports:
      - packages/core/src/services/index.ts: Added GroceryService, GroceryItem, GroceryGroup, GroceryList exports
      - packages/core/src/index.ts: Added GroceryService and type exports
      - packages/core/package.json: Added grocery.service.test.ts to test script
    - Validation results:
      - `pnpm build`: SUCCESS - all 4 packages compile without TypeScript errors
      - `pnpm --filter @meals/core test`: SUCCESS - 218/218 tests pass (8 connection + 13 migrate + 68 models + 23 recipe.repo + 19 recipe.service + 36 plan.repo + 27 plan.service + 24 grocery.service)

### Ticket: T015 Implement preference model and repository
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T015
- **Scope:** Key-value preference storage with typed access
- **Acceptance Criteria:** Can get/set preferences, defaults provided
- **Validation Steps:** Unit tests for preference CRUD
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create models/preference.ts with Zod schema, repos/preference.repo.ts for key-value CRUD, and services/preference.service.ts
    - Key constraints: preferences table stores JSON values, provide typed access with defaults, support all preference keys from PLAN.md Deliverable C
    - Dependencies: T005 (schema with preferences table - done)
    - Estimated complexity: moderate
    - Reference: PLAN.md Deliverable C (Preference Endpoints) for preference structure
  - Agent-T015 implementation notes:
    - Files created:
      - packages/core/src/models/preference.ts: PlanningHeuristicsSchema, UserPreferencesSchema, PreferenceKeyEnum, DEFAULT_PREFERENCES, PreferenceRowSchema, SetPreferenceSchema, PreferenceValueSchemas, helper functions (getDefaultPreference, validatePreferenceValue, parsePreferenceValue)
      - packages/core/src/repos/preference.repo.ts: PreferenceRepository class with get, set, getAll, delete, exists, clearAll, setMany methods
      - packages/core/src/services/preference.service.ts: PreferenceService class with typed access, defaults, audit logging, and convenience methods for all preference keys
      - packages/core/tests/preference.test.ts: 38 unit tests covering model helpers, repository CRUD, and service behavior
    - UserPreferences structure matches PLAN.md Deliverable C exactly:
      - dietaryRestrictions: string[] (default: [])
      - dislikedIngredients: string[] (default: [])
      - favoriteCuisines: string[] (default: [])
      - defaultServings: number (default: 2)
      - maxPrepTimeMinutes: number | null (default: null)
      - planningHeuristics: { preferVariety, balanceCuisines, avoidRepeatInWeek } (all default: true)
    - PreferenceRepository features:
      - Key-value CRUD with JSON-encoded values
      - UPSERT behavior for set operations
      - Atomic setMany using transactions
    - PreferenceService features:
      - getAllPreferences(): Returns full UserPreferences merged with defaults
      - getPreference(key): Returns stored value or default
      - setPreference(key, value): Validates and stores with audit logging
      - clearPreference(key): Removes preference (reverts to default) with audit logging
      - updatePreferences(partial): Updates multiple preferences atomically with audit logging
      - resetAllPreferences(): Clears all with audit logging
      - Convenience typed getters/setters for each preference key
    - All exports added to models/index.ts, repos/index.ts, services/index.ts, and main index.ts
    - Validation results:
      - `pnpm build`: SUCCESS - all 4 packages compile without TypeScript errors
      - `pnpm --filter @meals/core test`: SUCCESS - 256/256 tests pass (8 connection + 13 migrate + 68 models + 23 recipe.repo + 19 recipe.service + 36 plan.repo + 27 plan.service + 24 grocery.service + 38 preference)

### Ticket: T016 Implement audit repository
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T016
- **Scope:** Append-only audit log with query capabilities
- **Acceptance Criteria:** Can log actions, query by actor/entity/timerange
- **Validation Steps:** Integration test logs 100 entries, queries correctly
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Enhance existing AuditRepository (packages/core/src/repos/audit.repo.ts) with getByActor() and getByTimeRange() methods. Add a flexible query() method for combined filters. Create comprehensive integration tests.
    - Key constraints: Basic AuditRepository already exists from T009 with log(), getByEntityId(), getByEntityType(), getRecent(). Add missing query methods: by actor, by timerange.
    - Dependencies: T005 (schema - done), T009 (created basic audit repo - done)
    - Estimated complexity: simple-moderate
    - Existing methods: log(), getByEntityId(), getByEntityType(), getRecent()

### Ticket: T017 Create CLI entry point and structure
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T017
- **Scope:** Set up commander with subcommands, --json flag, output helpers
- **Acceptance Criteria:** `meals --help` shows all commands
- **Validation Steps:** `pnpm --filter @meals/cli build && ./bin/meals --help`
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Install commander, create bin/meals.ts entry point, set up subcommand structure
    - Key constraints: Support --json flag globally, create output.ts for formatting helpers
    - Dependencies: T001-T002 (monorepo/TS setup)
    - Estimated complexity: moderate
    - Reference: PLAN.md Deliverable D (CLI Specification)
  - Agent-T017 implementation notes:
    - Installed commander ^14.0.0 in @meals/cli
    - Files created:
      - packages/cli/src/bin/meals.ts: Main entry point with global options (--json, --quiet, --verbose, --db)
      - packages/cli/src/output.ts: Output helpers (printJson, printTable, printSuccess, printError, printInfo, printWarning, printDebug, getGlobalOptions)
      - packages/cli/src/commands/recipe.ts: Recipe subcommand with list, show, add, import, delete, export
      - packages/cli/src/commands/plan.ts: Plan subcommand with create, show, suggest, set, swap, activate, export
      - packages/cli/src/commands/grocery.ts: Grocery subcommand with generate, export
      - packages/cli/src/commands/prefs.ts: Prefs subcommand with show, set, clear
      - packages/cli/src/commands/db.ts: DB subcommand with migrate, backup, stats
      - packages/cli/src/commands/index.ts: Re-exports all commands
    - All subcommands have placeholder implementations ("Not implemented yet")
    - Global options: --json, --quiet, --verbose, --db <path>
    - output.ts includes TableColumn interface and printTable for formatted table output
    - Validation results:
      - `pnpm --filter @meals/cli build`: SUCCESS
      - `./packages/cli/dist/bin/meals.js --help`: Shows all 5 commands (recipe, plan, grocery, prefs, db)
      - All subcommand --help works correctly
      - Version flag works (0.1.0)

### Ticket: T018 Implement recipe CLI commands
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T018
- **Scope:** list, show, add, delete, export commands
- **Acceptance Criteria:** All commands work per Deliverable D spec
- **Validation Steps:** Manual test each command, verify JSON output
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Implement recipe subcommands using RecipeService from core
    - Key constraints: Support --json flag, format output nicely for terminal
    - Dependencies: T009 (recipe service), T017 (CLI structure)
    - Estimated complexity: moderate
    - Reference: PLAN.md Deliverable D (Recipe Commands section)
  - Agent-T018 implementation notes:
    - Implemented all 5 recipe commands (list, show, add, delete, export)
    - `recipe list`: Table output with ID (truncated), TITLE, TIME, CUISINE columns; --json for full output
    - `recipe show`: Formatted terminal display with metadata, ingredients, instructions; --json for full object
    - `recipe add`: --title and --instructions required; supports repeatable --ingredient (format "name:quantity unit") and --tag flags
    - `recipe delete`: Confirmation prompt unless --force; shows success/failure message
    - `recipe export`: Outputs markdown format to stdout or --output file
    - All commands support global --json, --db flags via getGlobalOptions()
    - Uses getDb({ dbPath }) + migrate() + RecipeService pattern
    - `pnpm build` succeeds

### Ticket: T019 Implement plan CLI commands
- **Priority:** P0
- **Status:** Done
- **Owner:** Agent-T019
- **Scope:** create, show, suggest, set, swap, activate, export commands
- **Acceptance Criteria:** All commands work per Deliverable D spec
- **Validation Steps:** Manual test plan workflow end-to-end
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Implement plan subcommands using PlanService from core
    - Key constraints: Support --json flag, handle ISO week format, show meals in table
    - Dependencies: T012 (plan service), T017 (CLI structure)
    - Estimated complexity: moderate
    - Note: suggest/swap commands are P1 (meal suggestion algorithm), can be placeholders for now
  - Implementation notes (Agent-T019):
    - All plan commands implemented in packages/cli/src/commands/plan.ts
    - Helper functions: parseWeek (this-week/next-week/YYYY-Wnn), parseDay (mon-sun), parseMealType (breakfast/lunch/dinner), getIsoWeek
    - create: Creates draft plan, checks for existing plan first
    - show: Displays table with recipe titles, falls back to active plan or this-week if no week specified
    - set: Auto-creates plan if needed, validates recipe exists, supports --servings and --notes
    - activate: Changes plan status to active
    - export: Generates markdown with table format, supports --output flag
    - suggest/swap: Placeholders printing "Meal suggestion feature coming soon"
    - All commands support --json flag and global --db option
    - Build succeeds (pnpm build)

### Ticket: T020 Implement grocery and prefs CLI commands
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T020
- **Scope:** grocery generate/export, prefs show/set/clear
- **Acceptance Criteria:** Commands work per Deliverable D spec
- **Validation Steps:** Generate grocery list for a filled plan
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Implement grocery and prefs subcommands in packages/cli/src/commands/ using GroceryService and PreferenceService from core
    - Key constraints: Support --json flag, format output nicely for terminal, follow existing CLI patterns from recipe.ts and plan.ts
    - Dependencies: T014 (grocery service - done), T015 (preference service - done), T017 (CLI structure - done)
    - Estimated complexity: moderate
    - Reference: PLAN.md Deliverable D (Grocery Commands and Preference Commands sections)

### Ticket: T021 Create Fastify API server
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T021
- **Scope:** Server setup with CORS, validation, error handling
- **Acceptance Criteria:** Server starts, health endpoint works
- **Validation Steps:** `curl localhost:3000/health` returns 200
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Install fastify and @fastify/cors in api package, create server.ts with health endpoint, set up error handling and response format per PLAN.md Deliverable C
    - Key constraints: Port 3000, CORS enabled for localhost, JSON responses follow ApiResponse<T> pattern
    - Dependencies: T001-T002 (monorepo/TS setup - done)
    - Estimated complexity: moderate
    - Reference: PLAN.md Deliverable C (API Specification) for response format
  - Agent notes:
    - Installed fastify@5.6.2 and @fastify/cors@11.2.0
    - Created src/types.ts with ApiResponse<T>, ErrorCodes, helper functions
    - Created src/middleware/error-handler.ts with ApiError class and global error handler
    - Created src/server.ts with buildServer() factory, CORS config, health endpoint, not found handler
    - Added dev script with tsx watch for development
    - All validation steps passed: pnpm build succeeds, curl localhost:3000/health returns 200

### Ticket: T022 Implement API routes
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T022
- **Scope:** All endpoints from Deliverable C
- **Acceptance Criteria:** All endpoints return correct shapes
- **Validation Steps:** Integration tests for each endpoint
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create route files in packages/api/src/routes/ for recipes, plans, grocery, preferences. Register them in server.ts. Use core services (RecipeService, PlanService, GroceryService, PreferenceService)
    - Key constraints: Follow ApiResponse format, validate inputs with Zod, use error codes from Deliverable C
    - Dependencies: T021 (API server - done), T009 (recipe service - done), T012 (plan service - done), T014 (grocery service - done), T015 (preference service - done)
    - Estimated complexity: high (many endpoints)
    - Reference: PLAN.md Deliverable C (API Specification) for all endpoint specs

### Ticket: T023 Implement recipe import from URL
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T023
- **Scope:** Fetch URL, parse HTML for recipe data, create recipe
- **Acceptance Criteria:** Can import from common recipe sites
- **Validation Steps:** Test with 3 different recipe site URLs
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create import.service.ts in core that fetches URL, parses HTML using cheerio, extracts JSON-LD schema.org Recipe data or falls back to meta tags, creates recipe via RecipeService
    - Key constraints: Handle schema.org Recipe JSON-LD first (most recipe sites use it), fall back to Open Graph meta tags, limit fetch size to 5MB
    - Dependencies: T009 (recipe service - done)
    - Estimated complexity: moderate-high
    - Reference: PLAN.md mentions schema.org parsing in Open Questions section
    - Packages to install: cheerio for HTML parsing

### Ticket: T024 Define agent tool schemas
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T024
- **Scope:** Zod schemas for all curator and planner tools
- **Acceptance Criteria:** Schemas match Deliverable E specification
- **Validation Steps:** Schema tests for valid/invalid inputs
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create packages/agent-tools/src/schemas/ with Zod schemas for all tool inputs/outputs from Deliverable E
    - Key constraints: Must match exact schemas from PLAN.md Deliverable E, separate curator and planner tools
    - Dependencies: T006 (recipe types - done)
    - Estimated complexity: moderate
    - Reference: PLAN.md Deliverable E (Claude Agent Tool Contract) for all tool definitions

### Ticket: T025 Implement agent tool handlers
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T025
- **Scope:** Handler functions for all tools, with audit logging
- **Acceptance Criteria:** Tools call services correctly, log to audit
- **Validation Steps:** Unit tests for each tool handler
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create tools/curator.tools.ts and tools/planner.tools.ts with handler functions that use core services
    - Key constraints: All mutations must audit log with agent_id, validate inputs with T024 schemas before calling services
    - Dependencies: T024 (schemas - done), core services (all done)
    - Estimated complexity: high (many handlers)
    - Reference: PLAN.md Deliverable E for handler behavior

### Ticket: T026 Create tmux bootstrap script
- **Priority:** P2
- **Status:** Done
- **Owner:** Orchestrator
- **Scope:** start-tmux.sh per Deliverable F
- **Acceptance Criteria:** Script creates session with all windows
- **Validation Steps:** Run script, verify 4 windows exist with correct commands
- **Notes:**
  - Created scripts/start-tmux.sh with 4 windows: api, cli, dev, logs

### Ticket: T027 Create backup script
- **Priority:** P2
- **Status:** Done
- **Owner:** Orchestrator
- **Scope:** backup.sh with rotation, cron setup instructions
- **Acceptance Criteria:** Script copies db, rotates old backups
- **Validation Steps:** Run 35 times, verify only 30 backups remain
- **Notes:**
  - Created scripts/backup.sh with 30-backup rotation

### Ticket: T028 Add vitest and configure testing
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T028
- **Scope:** Set up vitest in all packages with coverage
- **Acceptance Criteria:** `pnpm test` runs all tests, coverage reported
- **Validation Steps:** `pnpm test --coverage` shows >0% coverage
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Install vitest, @vitest/coverage-v8 in root. Create vitest.config.ts files for each package. Migrate existing tsx-based tests to vitest runner. Configure coverage thresholds (>80% on core).
    - Key constraints: Current tests use tsx to run directly. Keep same test files, just change runner to vitest. Ensure all 356+ existing tests pass.
    - Dependencies: None
    - Estimated complexity: moderate
  - Implementation notes:
    - Installed vitest 4.0.16 and @vitest/coverage-v8 in root
    - Created vitest.config.ts in root with workspace configuration
    - Created per-package vitest.config.ts files (core, api, cli, agent-tools)
    - Migrated all 14 test files from custom tsx runner to vitest
    - All 433 tests pass with vitest
    - Coverage reports 42.75% lines overall, core services have good coverage
    - Added scripts: test, test:watch, test:coverage to root package.json

### Ticket: T029 Implement recipe update CLI command
- **Priority:** P2
- **Status:** Done
- **Owner:** Agent-T029
- **Scope:** Add `meals recipe update <id>` command to modify existing recipes
- **Acceptance Criteria:**
  - Can update title, description, instructions, servings, prep/cook time, cuisine, difficulty
  - Can add/remove ingredients with `--add-ingredient` and `--remove-ingredient`
  - Can add/remove tags with `--add-tag` and `--remove-tag`
  - Changes are audit logged
- **Validation Steps:** Update a recipe, verify changes with `meals recipe show`
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Add update subcommand to recipe CLI with options for each field. Use RecipeService.update() method. Audit log changes.
    - Key constraints: Must check recipe exists before updating. Ingredients use format "name:quantity unit". Tags are simple strings.
    - Dependencies: T018 (recipe CLI - done)
    - Estimated complexity: moderate
  - Original notes:
    - Dependencies: T018 (recipe CLI - done)
  - Agent-T029 implementation notes (2026-01-04):
    - Added UPDATE command to packages/cli/src/commands/recipe.ts
    - Supports all field updates: --title, --description, --instructions, --servings, --prep-time, --cook-time, --cuisine, --difficulty
    - Supports ingredient modification: --add-ingredient "name:quantity unit", --remove-ingredient "name"
    - Supports tag modification: --add-tag "tagname", --remove-tag "tagname"
    - Uses RecipeService.updateRecipe() which handles audit logging
    - Properly checks recipe exists before updating
    - All validation steps passed: pnpm build, pnpm test (433 tests), manual CLI testing

### Ticket: T030 Implement ingredient category management
- **Priority:** P2
- **Status:** Done
- **Owner:** Agent-T030
- **Scope:** Add ingredient categorization for better grocery list grouping
- **Acceptance Criteria:**
  - Ingredients have category field (Produce, Dairy, Meat, Pantry, Frozen, Bakery, etc.)
  - Grocery list groups items by category instead of "Uncategorized"
  - CLI command to set ingredient category: `meals ingredient set-category <name> <category>`
  - Common ingredients auto-categorized during creation
- **Validation Steps:** Generate grocery list, verify items grouped by category
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Add category column to ingredients table via migration, create ingredient CLI commands, update grocery service to group by category, add common ingredient auto-categorization mapping
    - Key constraints: Category enum values: Produce, Dairy, Meat, Seafood, Bakery, Frozen, Pantry, Beverages, Condiments, Spices, Other. Default to "Other" if not set.
    - Dependencies: T014 (grocery service - done), T045 (grocery list persistence - done)
    - Estimated complexity: moderate
  - Original notes:
    - Dependencies: T014 (grocery service - done)
    - Category enum: Produce, Dairy, Meat, Seafood, Bakery, Frozen, Pantry, Beverages, Condiments, Spices, Other
  - Agent-T030 implementation notes:
    - Category column already exists in ingredients table from 001_initial.sql migration
    - Added INGREDIENT_CATEGORIES constant with 11 categories: Produce, Dairy, Meat, Seafood, Bakery, Frozen, Pantry, Beverages, Condiments, Spices, Other
    - Added getAutoCategory() function with 150+ common ingredient mappings for auto-categorization
    - Updated getOrCreate() method to auto-categorize ingredients when no category provided
    - Added updateCategory() and updateCategoryByName() methods to IngredientRepository
    - Created CLI ingredient command with set-category, list, and categories subcommands
    - Updated GroceryListItemWithStatus interface to include category field
    - Updated displayPersistentGroceryList() to group items by category within status sections
    - Added 27 new tests in ingredient.repo.test.ts for category functionality
    - All validation steps passed: pnpm build, pnpm test (471 tests), CLI commands work correctly
    - Grocery list now shows items grouped by category (Meat, Dairy, Produce, etc.) instead of just "Uncategorized"

### Ticket: T031 Implement pantry service and CLI
- **Priority:** P2
- **Status:** Done
- **Owner:** Agent-T031
- **Scope:** Track pantry items (raw and prepared) and subtract from grocery lists
- **Acceptance Criteria:**
  - `meals pantry list` - show current pantry items
  - `meals pantry add <ingredient> --quantity <n> --unit <u>` - add item
  - `meals pantry remove <ingredient>` - remove item
  - `meals pantry use <ingredient> --quantity <n>` - decrement quantity
  - `meals grocery generate --exclude-pantry` - subtract pantry from list
  - Expiration date tracking with `--expires <date>`
  - Location tracking: `--location fridge|freezer|pantry`
  - Prepared items: `--prepared --notes "sous vide, Jan 3"` for cooked/prepped items
  - Staple items: `--staple` marks as always-have (auto-checked on grocery lists)
  - `meals pantry expiring` - show items expiring within 7 days
- **Validation Steps:** Add pantry items (raw and prepared), generate grocery list with exclusion
- **Notes:**
  - Orchestrator notes:
    - Intended approach: The pantry_items table already exists from 001_initial.sql. Create 005_pantry_enhancements.sql migration to add is_prepared, preparation_notes, location, is_staple columns. Create PantryService. Create pantry CLI commands. Update grocery service to support --exclude-pantry. Also connect to the check-pantry stub in T045.
    - Key constraints: Use ingredient_id to link to ingredients table. Location enum: fridge, freezer, pantry. Expiration dates stored as ISO date strings.
    - Dependencies: T014 (grocery service - done), T045 (grocery persistence - done)
    - Estimated complexity: high
  - Original notes:
    - Dependencies: T014 (grocery service - done)
  - Schema enhancement needed for pantry_items table:
    ```sql
    ALTER TABLE pantry_items ADD COLUMN is_prepared BOOLEAN DEFAULT FALSE;
    ALTER TABLE pantry_items ADD COLUMN preparation_notes TEXT;
    ALTER TABLE pantry_items ADD COLUMN location TEXT CHECK(location IN ('fridge', 'freezer', 'pantry'));
    ALTER TABLE pantry_items ADD COLUMN is_staple BOOLEAN DEFAULT FALSE;
    ```
  - Prepared items useful for meal prep (e.g., "4 sous vide chicken breasts")
  - **Agent-T031 Implementation Notes:**
    - Created migration 005_pantry_enhancements.sql with columns: is_prepared, preparation_notes, location, is_staple
    - Created PantryItem model at packages/core/src/models/pantry.ts with Zod schemas for validation
    - Created PantryRepository at packages/core/src/repos/pantry.repo.ts with full CRUD operations
    - Created PantryService at packages/core/src/services/pantry.service.ts for business logic
    - Created pantry CLI commands at packages/cli/src/commands/pantry.ts: list, add, remove, use, expiring, update
    - Updated GroceryService with excludePantry option for generateList/generateAndPersist methods
    - Updated GroceryService.checkPantry() to properly query pantry and mark grocery items
    - Updated grocery CLI generate command with --exclude-pantry flag
    - Exported all new types and classes from core and CLI index files
    - All validation steps passed: pnpm build, pnpm test, all CLI commands work correctly

### Ticket: T032 Implement audit log viewing
- **Priority:** P3
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** View audit log entries via CLI and API
- **Acceptance Criteria:**
  - `meals audit list` - show recent audit entries
  - `meals audit list --actor agent:planner` - filter by actor
  - `meals audit list --entity recipe` - filter by entity type
  - `meals audit list --since 2024-01-01` - filter by date range
  - API endpoint: `GET /api/audit?actor=&entity=&since=&until=`
- **Validation Steps:** Perform actions, view audit log, verify entries
- **Notes:**
  - Dependencies: T016 (audit repo - done)

### Ticket: T033 Implement database export to JSON
- **Priority:** P3
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Export entire database to JSON for backup/migration
- **Acceptance Criteria:**
  - `meals db export --output backup.json` - export all data
  - `meals db import --input backup.json` - restore from export
  - Export includes: recipes, plans, preferences, ingredients, tags
  - Import validates data before inserting
- **Validation Steps:** Export, delete DB, import, verify data restored
- **Notes:**
  - Dependencies: T003 (SQLite connection - done)

### Ticket: T034 Implement recipe rating system
- **Priority:** P3
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Rate recipes after cooking
- **Acceptance Criteria:**
  - Add `rating` field to recipes (1-5 stars, nullable)
  - `meals recipe rate <id> <rating>` - set rating
  - `meals recipe list --min-rating 4` - filter by rating
  - Suggestion algorithm boosts higher-rated recipes
  - API endpoints for rating
- **Validation Steps:** Rate recipes, verify filtering and suggestion boost
- **Notes:**
  - Dependencies: T009 (recipe service - done), T013 (suggestions - done)
  - Requires migration: `002_add_recipe_rating.sql`

### Ticket: T035 Implement tag management CLI
- **Priority:** P3
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Manage tags independently of recipes
- **Acceptance Criteria:**
  - `meals tag list` - show all tags with usage counts
  - `meals tag add <name> --category <cat>` - create tag
  - `meals tag delete <name>` - delete unused tag
  - `meals tag rename <old> <new>` - rename tag
  - Show tag category in listings
- **Validation Steps:** Create, rename, delete tags, verify recipe associations
- **Notes:**
  - Dependencies: T018 (recipe CLI - done)
  - Categories: meal_type, dietary, cuisine, season, custom

### Ticket: T036 Implement plan completion and history
- **Priority:** P2
- **Status:** Done
- **Owner:** Agent-T036
- **Scope:** Track plan completion and meal history
- **Acceptance Criteria:**
  - `meals plan complete <week>` - mark plan as completed
  - `meals plan history` - show past completed plans
  - Track which meals were actually made vs planned
  - `meals plan mark-made <week> <day> <meal>` - mark meal as cooked
  - History informs suggestion algorithm (recently made penalty)
- **Validation Steps:** Complete a plan, verify history, check suggestion scoring
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Add completed_at timestamp to plans table, add was_made boolean to plan_items table via migration. Add CLI commands for complete, history, mark-made. Update suggestion algorithm to consider recently made recipes.
    - Key constraints: Migration should add columns safely. Plan can only be completed once. mark-made tracks what was actually cooked vs planned.
    - Dependencies: T012 (plan service - done), T013 (suggestions - done)
    - Estimated complexity: moderate
  - Original notes:
    - Dependencies: T012 (plan service - done), T013 (suggestions - done)
  - Implementation notes (Agent-T036):
    - Created migration 004_plan_completion.sql: adds completed_at to weekly_plans and was_made to plan_items
    - Updated WeeklyPlanSchema with completedAt field
    - Updated PlanItemSchema with wasMade field
    - Added plan repository methods: completePlan, getCompletedPlans, markMealAsMade, getMadeMeals, getRecentlyMadeRecipeIds
    - Added plan service methods with audit logging
    - Updated suggestion service to include recently made recipes (from was_made=true) in the penalty scoring
    - Added CLI commands: mark-made, complete, history
    - All validation steps passed: pnpm build, pnpm test, CLI commands tested successfully

### Ticket: T037 Implement recipe favorites
- **Priority:** P3
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Mark recipes as favorites for quick access
- **Acceptance Criteria:**
  - `meals recipe favorite <id>` - toggle favorite status
  - `meals recipe list --favorites` - show only favorites
  - Favorites get boost in suggestion algorithm
  - API endpoints for favoriting
- **Validation Steps:** Favorite recipes, verify filtering and suggestion boost
- **Notes:**
  - Dependencies: T009 (recipe service - done), T013 (suggestions - done)
  - Add `is_favorite` boolean to recipes table

### Ticket: T038 Increase test coverage to 80%
- **Priority:** P2
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Add tests to reach 80% coverage target
- **Acceptance Criteria:**
  - Overall line coverage >= 80%
  - All services have >= 90% coverage
  - All repositories have >= 95% coverage
  - CLI commands have basic coverage
  - API routes have integration tests
- **Validation Steps:** `pnpm test --coverage` shows >= 80%
- **Notes:**
  - Current coverage: ~43%
  - Focus areas: CLI commands, API routes, edge cases

### Ticket: T039 Implement MCP server for agent tools
- **Priority:** P3
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Wrap agent tools as MCP server for external Claude access
- **Acceptance Criteria:**
  - MCP server exposes all agent tools (curator + planner)
  - Can connect from Claude Desktop or other MCP clients
  - Tools properly validate inputs and return structured responses
  - All operations audit logged with agent actor
- **Validation Steps:** Connect MCP client, invoke tools, verify operations
- **Notes:**
  - Dependencies: T024-T025 (agent tools - done)
  - New package: `packages/mcp-server/`

### Ticket: T040 Support dining out, skip, and leftovers meal slots
- **Priority:** P2
- **Status:** Done
- **Owner:** Agent-T040
- **Scope:** Allow marking meal slots as "dining out", "skip", or "leftovers" without requiring a new recipe
- **Acceptance Criteria:**
  - Add `slot_type` field to `plan_items` table: 'recipe' (default), 'dining_out', 'skip', 'leftovers'
  - Add `leftovers_source_id` field to reference original meal for leftovers
  - CLI: `meals plan set <week> <day> <meal> --dining-out` marks slot as dining out
  - CLI: `meals plan set <week> <day> <meal> --skip` marks slot as skip
  - CLI: `meals plan set <week> <day> <meal> --leftovers-from <day> <meal>` marks as leftovers from another meal
  - Plan display shows "Dining Out", "Skip", or "Leftovers (from Mon dinner)" for these slots
  - Grocery list generation ignores dining_out, skip, and leftovers slots
  - Notes field can still be used (e.g., "Dinner at Mario's")
- **Validation Steps:**
  - `meals plan set this-week sat dinner --dining-out --notes "Restaurant TBD"`
  - `meals plan set this-week tue lunch --leftovers-from mon dinner`
  - `meals plan show` displays appropriate labels for each slot type
  - Grocery list excludes non-recipe slots
- **Notes:**
  - Implementation complete (Agent-T040):
    - Created migration 003_slot_types.sql with slot_type and leftovers_source_id columns
    - Updated PlanItem model with SlotTypeEnum and new fields
    - Updated plan repository setMeal method to support slot_type and leftovers_source_id
    - Updated plan service setMeal to validate leftovers source exists
    - Updated grocery service to exclude non-recipe slot types from grocery list generation
    - Updated CLI plan set command with --dining-out, --skip, and --leftovers-from flags
    - Updated plan show display to show "Dining Out", "Skip", and "Leftovers (from Day meal)" labels
  - Orchestrator notes:
    - Intended approach: Add migration for slot_type and leftovers_source_id columns, update PlanItem model, update plan CLI set command with --dining-out, --skip, --leftovers-from flags, update plan show to display slot types, update grocery service to exclude non-recipe slots
    - Key constraints: Migration must add columns safely. slot_type defaults to 'recipe'. Leftovers must reference a valid plan_item. Grocery list should only include 'recipe' slot types.
    - Dependencies: T012 (plan service - done), T014 (grocery service - done)
    - Estimated complexity: moderate-high
  - Original notes:
    - Migration needed (see schema below)
    - Update PlanItem model and schema
    - Leftovers tracking helps with meal prep planning
  - Schema:
    ```sql
    ALTER TABLE plan_items ADD COLUMN slot_type TEXT DEFAULT 'recipe'
      CHECK(slot_type IN ('recipe', 'dining_out', 'skip', 'leftovers'));
    ALTER TABLE plan_items ADD COLUMN leftovers_source_id TEXT REFERENCES plan_items(id);
    ```

### Ticket: T041 Support batch cooking and meal prep tracking
- **Priority:** P2
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Track when multiple meals come from the same batch/prep session
- **Acceptance Criteria:**
  - Add `prep_batches` table: id, recipe_id, prep_date, total_servings, notes
  - Add `batch_id` nullable foreign key to `plan_items`
  - CLI: `meals prep create <recipe-id> --servings 16 --date sunday` creates a batch
  - CLI: `meals plan set ... --batch <batch-id>` links meal to batch
  - CLI: `meals prep list` shows active batches with remaining servings
  - Plan display can optionally show batch info
  - Grocery list aggregates by batch (don't duplicate ingredients for same batch)
- **Validation Steps:**
  - Create chili batch with 16 servings
  - Assign 5 lunches to that batch
  - Verify grocery list shows chili ingredients once (for 16 servings)
  - `meals prep list` shows 6 servings remaining
- **Notes:**
  - Useful for meal prep workflows (Sunday cooking for the week)
  - Could integrate with suggestion service to prefer using existing batches

### Ticket: T042 Headless browser fallback for recipe import
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T042
- **Scope:** Use headless browser to import recipes from sites that block automated requests
- **Acceptance Criteria:**
  - Add `puppeteer` or `playwright` as optional dependency to `@meals/core`
  - Modify `ImportService.fetchHtml()` to try native fetch first
  - If fetch returns 403/blocking response, fall back to headless browser
  - Headless browser renders page and extracts HTML for JSON-LD parsing
  - CLI `meals recipe import <url>` works seamlessly with blocking sites (e.g., Food Network)
  - Add `--no-browser` flag to skip headless fallback if needed
- **Validation Steps:**
  - `meals recipe import https://www.foodnetwork.com/recipes/...` succeeds
  - Import still works for non-blocking sites without launching browser
  - `--no-browser` flag causes 403 error on blocking sites (expected)
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Add playwright as optional dependency. Modify ImportService.fetchHtml() to try native fetch first, then fall back to playwright if 403/blocking detected. Use dynamic import to lazy-load playwright. Update CLI recipe import command with --no-browser flag.
    - Key constraints: Playwright is preferred over puppeteer (smaller, more reliable). Lazy-load to avoid startup penalty. Must handle Cloudflare and similar protection. Consider user-agent spoofing before browser fallback.
    - Dependencies: T023 (import service - done)
    - Estimated complexity: moderate-high
  - Original notes:
    - Puppeteer/Playwright adds ~150MB for browser binaries
    - Consider lazy-loading the browser dependency
    - May need to handle cookie consent dialogs on some sites
  - Agent-T042 implementation notes (2026-01-04):
    - Added playwright ^1.57.0 as optional dependency in packages/core/package.json
    - Implemented fetchHtmlNative() for native fetch with browser-like User-Agent
    - Implemented fetchHtmlWithBrowser() using playwright chromium for blocked sites
    - Dynamic import used for playwright to avoid startup penalty (loads in ~164ms without playwright)
    - Detection includes HTTP status codes (403, 503, 429) and content patterns (Cloudflare, etc.)
    - Added --no-browser flag to CLI recipe import command
    - Exported ImportOptions type from @meals/core
    - All tests pass, build succeeds
    - Tested: BBC Good Food works with native fetch, AllRecipes detected as blocking

### Ticket: T043 Recipe versioning and variations
- **Priority:** P2
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Allow recipes to be modified and saved as named versions/variations
- **Acceptance Criteria:**
  - Add `parent_recipe_id` and `version_name` columns to recipes table
  - Original recipe remains unchanged; variations link back to parent
  - CLI: `meals recipe fork <id> --name "sous vide"` creates a new version
  - CLI: `meals recipe show <id>` displays version name and link to parent if applicable
  - CLI: `meals recipe list --versions <id>` shows all versions of a recipe
  - CLI: `meals recipe edit <id>` (from T029) works on any version
  - Versions inherit source_url from parent but have source_type "variation"
  - Recipe search includes all versions by default
- **Validation Steps:**
  - Fork "Chicken and Rice" as "sous vide" version
  - Modify the forked recipe's instructions and ingredients
  - `meals recipe show` on fork shows "Version: sous vide" and "Based on: Chicken and Rice"
  - `meals recipe list --versions <parent-id>` shows original + all forks
  - Both original and fork appear in search results
- **Notes:**
  - Use cases: cooking method variations (sous vide, instant pot), dietary variations (low-carb, dairy-free), ingredient substitutions
  - Consider whether versions should be independently deletable or cascade
  - Future: could add diff view between versions

### Ticket: T044 Enhanced user preferences
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T044
- **Scope:** Extend user preferences to support full meal planning configuration
- **Acceptance Criteria:**
  - Add new preference keys: `householdSize`, `mealTypes`, `allergies`, `prepDay`, `cuisinePreferences`
  - `householdSize`: number (default: 2) - affects default servings calculations
  - `mealTypes`: string[] (default: ["lunch", "dinner"]) - which meals to plan
  - `allergies`: { ingredient: string, severity: "avoid" | "strict" }[] - with severity levels
  - `prepDay`: string | null (default: null) - preferred prep day ("sunday", "saturday", etc.)
  - `cuisinePreferences`: { liked: string[], disliked: string[] } - more granular than current
  - CLI: `meals prefs set household-size 2`
  - CLI: `meals prefs set meal-types lunch,dinner`
  - CLI: `meals prefs set allergies "peanuts:strict,shellfish:avoid"`
  - API: Enhanced PATCH /preferences endpoint
- **Validation Steps:**
  - Set all new preferences via CLI and API
  - Verify suggestion algorithm respects allergies and cuisine preferences
- **Notes:**
  - Agent-T044 implementation notes:
    - Files modified:
      - packages/core/src/models/preference.ts: Added AllergySeverityEnum, AllergyEntrySchema, CuisinePreferencesSchema, PrepDayEnum. Extended UserPreferencesSchema and DEFAULT_PREFERENCES with new keys.
      - packages/core/src/services/preference.service.ts: Added typed getters/setters for householdSize, mealTypes, allergies, prepDay, cuisinePreferences
      - packages/cli/src/commands/prefs.ts: Added CLI key mapping, parseAllergies(), parseCuisinePreferences(), updated parseValue/formatValue
      - packages/api/src/routes/preferences.ts: Extended UpdatePreferencesBodySchema with new fields
      - packages/core/tests/preference.test.ts: Added comprehensive tests for new preferences
    - Validation results:
      - pnpm build: SUCCESS
      - pnpm test: SUCCESS (444 tests pass)
      - All CLI commands work correctly with proper formatting

### Ticket: T045 Grocery list persistence and state tracking
- **Priority:** P1
- **Status:** Done
- **Owner:** Agent-T045
- **Scope:** Persist grocery lists with item states for shopping workflow
- **Acceptance Criteria:**
  - New tables: `grocery_lists` and `grocery_list_items`
  - Item states: `need_to_buy` (default), `already_have`, `partial`
  - Partial state tracks `have_quantity` vs `need_quantity`
  - Manual item addition (items not from recipes)
  - `meals grocery generate` creates/updates persistent list
  - `meals grocery list` shows current list with states
  - `meals grocery check <item>` marks item as already_have
  - `meals grocery check <item> --partial <qty>` marks as partial
  - `meals grocery add <item> --quantity <n>` adds manual item
  - `meals grocery check-pantry` bulk-marks items from pantry
  - API: GET/PUT /api/grocery-list/:week/items/:id
  - API: POST /api/grocery-list/:week/items (manual add)
  - API: POST /api/grocery-list/:week/check-pantry
- **Validation Steps:**
  - Generate list, mark items, verify state persists
  - Add manual item, verify it appears in list
  - Check pantry, verify matching items marked
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create migration 002_grocery_list_persistence.sql with new tables, create GroceryListRepository for persistence, update GroceryService to use persistent storage, add CLI commands (list, check, add), add API endpoints
    - Key constraints: Migration must handle existing deployments gracefully. Item states: need_to_buy (default), already_have, partial. Partial state needs have_quantity tracking. check-pantry feature depends on T031 which is not done - implement as stub that returns empty/warning for now.
    - Dependencies: T014 (grocery service - done)
    - Estimated complexity: high (migration + repo + service updates + CLI + API)
  - Original notes:
    - Migration: 002_grocery_list_persistence.sql
    - Integrates with T031 (pantry) for check-pantry feature
  - **Agent-T045 Implementation Notes:**
    - Created migration 002_grocery_list_persistence.sql with grocery_lists and grocery_list_items tables
    - Created GroceryListRepository at packages/core/src/repos/grocery-list.repo.ts
    - Extended GroceryService with persistent storage methods: generateAndPersist(), getPersistentList(), addManualItem(), checkItem(), checkItemPartial(), uncheckItem(), checkPantry()
    - Updated CLI grocery commands: generate (now persists), list, check, uncheck, add, check-pantry
    - Added API endpoints: GET/PUT/DELETE /api/grocery-list/:week/items/:id, POST /api/grocery-list/:week/items, POST /api/grocery-list/:week/check-pantry
    - check-pantry implemented as stub returning warning since T031 (pantry service) is not done
    - All validation steps pass: pnpm build, pnpm test, CLI commands work correctly
  - Schema:
    ```sql
    CREATE TABLE grocery_lists (
      id TEXT PRIMARY KEY,
      week TEXT NOT NULL UNIQUE,
      generated_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE grocery_list_items (
      id TEXT PRIMARY KEY,
      grocery_list_id TEXT REFERENCES grocery_lists(id) ON DELETE CASCADE,
      ingredient_id TEXT REFERENCES ingredients(id),
      name TEXT,
      quantity REAL,
      unit TEXT,
      status TEXT DEFAULT 'need_to_buy' CHECK(status IN ('need_to_buy', 'already_have', 'partial')),
      have_quantity REAL,
      is_manual BOOLEAN DEFAULT FALSE,
      recipes TEXT
    );
    ```

### Ticket: T046 Ingredient substitution engine
- **Priority:** P2
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Suggest ingredient alternatives when user lacks an ingredient
- **Acceptance Criteria:**
  - New table: `substitutions` with common substitution mappings
  - Seed data for common substitutions (Lebanese 7 Spice → cumin+paprika, soy sauce → tamari, etc.)
  - `meals substitution list <ingredient>` shows alternatives
  - `meals substitution add <original> <substitute> --description "..."` adds user-defined
  - API: GET /api/substitutions/:ingredient
  - API: POST /api/substitutions (user-defined)
  - Substitutions include dietary_tags (e.g., tamari enables "gluten-free")
  - RecipeService can suggest substitutions for missing ingredients
- **Validation Steps:**
  - Query substitutions for "soy sauce", verify tamari suggested
  - Add custom substitution, verify it's returned
  - Check dietary tags are correctly applied
- **Notes:**
  - Migration: 003_substitutions.sql
  - Seed common substitutions via migration or seed script
  - Schema:
    ```sql
    CREATE TABLE substitutions (
      id TEXT PRIMARY KEY,
      original_ingredient TEXT NOT NULL,
      substitute_ingredients TEXT NOT NULL,
      substitute_description TEXT,
      dietary_tags TEXT,
      is_user_defined BOOLEAN DEFAULT FALSE,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_substitutions_original ON substitutions(original_ingredient);
    ```

### Ticket: T047 Recipe personal notes and modifications
- **Priority:** P2
- **Status:** Done
- **Owner:** Agent-T047
- **Scope:** Allow users to add personal notes and ingredient overrides to recipes without modifying original
- **Acceptance Criteria:**
  - New table: `recipe_modifications` for per-recipe user customizations
  - `meals recipe note <id> "Always double the garlic"` adds/updates note
  - `meals recipe note <id> --show` displays current notes
  - `meals recipe override <id> --ingredient "chicken thighs" --replace "chicken breast"` adds override
  - Recipe show command displays modifications if present
  - Modifications are applied when displaying recipe but don't change stored recipe
  - API: GET/PUT /api/recipes/:id/modifications
- **Validation Steps:**
  - Add note to recipe, verify displayed with recipe
  - Add ingredient override, verify shown in recipe display
  - Verify original recipe data unchanged
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Create migration 006_recipe_modifications.sql, create RecipeModificationRepository, add note and override CLI commands, update recipe show to display modifications, add API endpoints.
    - Key constraints: Don't modify original recipe. ingredient_overrides stored as JSON array of {original, replacement} pairs.
    - Dependencies: T009 (recipe service - done)
    - Estimated complexity: moderate
  - Original notes:
    - Migration: 006_recipe_modifications.sql (note: migrations 002-005 already exist)
    - Useful for tracking personal tweaks without forking recipes
  - Schema:
    ```sql
    CREATE TABLE recipe_modifications (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      user_notes TEXT,
      ingredient_overrides TEXT,
      instruction_notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(recipe_id)
    );
    ```
  - **Subagent implementation notes:**
    - Created 006_recipe_modifications.sql migration with schema as specified
    - Created RecipeModificationRepository in packages/core/src/repos/recipe-modification.repo.ts
    - Added modification methods to RecipeService (setRecipeNote, addIngredientOverride, getModifications, etc.)
    - Added CLI commands: `meals recipe note <id> [note]` with --show/--clear options
    - Added CLI commands: `meals recipe override <id>` with --ingredient/--replace/--list/--remove/--clear options
    - Updated `recipe show` to display modifications (MY NOTES section, ingredient overrides marked with [was: original])
    - Added API endpoints: GET/PUT/DELETE /api/recipes/:id/modifications
    - All validation tests pass: build succeeds, 433 tests pass, CLI commands work as specified

### Ticket: T048 Recipe scaling API
- **Priority:** P2
- **Status:** Done
- **Owner:** Agent-T048
- **Scope:** API endpoint to return recipe with ingredients scaled to specified servings
- **Acceptance Criteria:**
  - API: POST /api/recipes/:id/scale with body { servings: number }
  - Returns recipe with all ingredient quantities multiplied by (newServings / originalServings)
  - Handles unit conversions for readability (e.g., 1500g → 1.5kg)
  - CLI: `meals recipe show <id> --servings 8` displays scaled recipe
  - Does not modify stored recipe
- **Validation Steps:**
  - Scale 4-serving recipe to 8 servings, verify quantities doubled
  - Scale down, verify fractions handled correctly
  - Verify unit conversions applied (large quantities simplified)
- **Notes:**
  - Orchestrator notes:
    - Intended approach: Add scaleRecipe method to RecipeService that takes recipe and target servings, scales all ingredient quantities. Add API endpoint POST /api/recipes/:id/scale. Add --servings flag to CLI recipe show command.
    - Key constraints: Don't modify stored recipe - return scaled copy. Handle fractional quantities nicely. Consider unit simplification for large quantities.
    - Dependencies: T009 (recipe service - done)
    - Estimated complexity: moderate
  - Original notes:
    - Builds on existing unit conversion logic in GroceryService
    - Useful for batch cooking calculations
  - Agent notes:
    - Implementation complete: Added scaleRecipe method to RecipeService with unit conversion support (g->kg, ml->l)
    - Added POST /api/recipes/:id/scale endpoint with validation
    - Added --servings/-s flag to CLI recipe show command
    - Verified: build passes, all tests pass, CLI scaling works correctly
    - Unit conversions verified: 500g @ 4x scale = 2kg, 400ml @ 4x scale = 1.6l

### Ticket: T049 Ingredient store sections
- **Priority:** P2
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Categorize ingredients by grocery store section for better list organization
- **Acceptance Criteria:**
  - Add `store_section` column to ingredients table
  - Sections: Produce, Meat, Seafood, Dairy, Bakery, Frozen, Pantry, Beverages, Condiments, Spices, Other
  - `meals ingredient set-section <name> <section>` sets ingredient section
  - Grocery list groups by store_section instead of ingredient category
  - Auto-assign common ingredients during import/creation
  - API: PATCH /api/ingredients/:id with store_section
- **Validation Steps:**
  - Set sections for ingredients, verify grocery list grouped correctly
  - Import recipe, verify common ingredients auto-categorized
- **Notes:**
  - Migration: 005_ingredient_store_sections.sql
  - Extends T030 (ingredient categories) - store_section is for physical store layout
  - Could add user-customizable section ordering

### Ticket: T050 Meal side dish support
- **Priority:** P2
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Allow meals to have multiple components (main dish + sides)
- **Acceptance Criteria:**
  - Add `is_side_dish` and `main_item_id` columns to plan_items
  - `meals plan set <week> <day> <meal> <recipe-id> --side` marks as side dish
  - `meals plan add-side <week> <day> <meal> <recipe-id>` adds side to existing meal
  - Plan display shows main dish with sides listed below
  - Grocery list includes ingredients from all components
  - Can have multiple sides per meal
  - API: Enhanced PUT /api/plans/:week/meals/:day/:mealType with sides support
- **Validation Steps:**
  - Set main dish, add two sides, verify display
  - Generate grocery list, verify all ingredients included
  - Remove side, verify main dish unaffected
- **Notes:**
  - Migration: 006_meal_sides.sql
  - Enables: "Chilean Sea Bass + Asparagus + Mashed Potatoes" as single meal
  - Sides can be leftovers (e.g., mashed potatoes from previous prep)

### Ticket: T051 Prep day aggregation service
- **Priority:** P2
- **Status:** Pending
- **Owner:** Unassigned
- **Scope:** Aggregate and organize prep tasks for designated prep day
- **Acceptance Criteria:**
  - `meals plan prep <week>` shows aggregated prep tasks
  - Groups similar tasks (e.g., "Dice: 3 onions, 4 peppers")
  - Orders tasks by dependencies and efficiency
  - Shows total estimated prep time
  - Lists equipment needed
  - API: GET /api/plans/:week/prep-day
  - Considers which recipes need full prep vs just assembly
- **Validation Steps:**
  - Create week plan, run prep command
  - Verify ingredients aggregated, time estimated
  - Verify logical task ordering
- **Notes:**
  - Uses prep_time_minutes from recipes for time estimates
  - Could integrate with T041 (batch cooking) to show batch prep first
  - Future: step-by-step guided prep mode

## 8. Completion Summary

**Project Status:** MVP Complete - Enhancement Phase

### Completed Tickets (28 total)

| Ticket | Description | Status |
|--------|-------------|--------|
| T001 | Initialize monorepo structure | Done |
| T002 | Configure TypeScript | Done |
| T003 | Set up SQLite connection | Done |
| T004 | Implement migration system | Done |
| T005 | Create initial schema migration | Done |
| T006 | Implement recipe model and types | Done |
| T007 | Implement recipe repository | Done |
| T008 | Implement recipe search with FTS | Done |
| T009 | Implement recipe service | Done |
| T010 | Implement plan model and types | Done |
| T011 | Implement plan repository | Done |
| T012 | Implement plan service | Done |
| T013 | Implement meal suggestion algorithm | Done |
| T014 | Implement grocery service | Done |
| T015 | Implement preference model and repository | Done |
| T016 | Implement audit repository | Done |
| T017 | Create CLI entry point and structure | Done |
| T018 | Implement recipe CLI commands | Done |
| T019 | Implement plan CLI commands | Done |
| T020 | Implement grocery and prefs CLI commands | Done |
| T021 | Create Fastify API server | Done |
| T022 | Implement API routes | Done |
| T023 | Implement recipe import from URL | Done |
| T024 | Define agent tool schemas | Done |
| T025 | Implement agent tool handlers | Done |
| T026 | Create tmux bootstrap script | Done |
| T027 | Create backup script | Done |
| T028 | Add vitest and configure testing | Done |

### Pending Tickets (23 total)

| Ticket | Description | Priority | Status |
|--------|-------------|----------|--------|
| T042 | Headless browser fallback for recipe import | P1 | Pending |
| T044 | Enhanced user preferences | P1 | Pending |
| T045 | Grocery list persistence and state tracking | P1 | Pending |
| T029 | Implement recipe update CLI command | P2 | Pending |
| T030 | Implement ingredient category management | P2 | Pending |
| T031 | Implement pantry service and CLI | P2 | Pending |
| T036 | Implement plan completion and history | P2 | Pending |
| T038 | Increase test coverage to 80% | P2 | Pending |
| T040 | Support dining out and skip meal slots | P2 | Pending |
| T041 | Support batch cooking and meal prep tracking | P2 | Pending |
| T043 | Recipe versioning and variations | P2 | Pending |
| T046 | Ingredient substitution engine | P2 | Pending |
| T047 | Recipe personal notes and modifications | P2 | Pending |
| T048 | Recipe scaling API | P2 | Pending |
| T049 | Ingredient store sections | P2 | Pending |
| T050 | Meal side dish support | P2 | Pending |
| T051 | Prep day aggregation service | P2 | Pending |
| T032 | Implement audit log viewing | P3 | Pending |
| T033 | Implement database export to JSON | P3 | Pending |
| T034 | Implement recipe rating system | P3 | Pending |
| T035 | Implement tag management CLI | P3 | Pending |
| T037 | Implement recipe favorites | P3 | Pending |
| T039 | Implement MCP server for agent tools | P3 | Pending |

### Definition of Done Verification

| Criterion | Status |
|-----------|--------|
| `pnpm build` succeeds | ✅ PASS |
| `pnpm test` passes | ✅ PASS (433 tests) |
| `pnpm test --coverage` works | ✅ PASS (42.75% coverage) |
| API starts, health check works | ✅ PASS |
| CLI commands work as specified | ✅ PASS |
| Validation workflow complete | ✅ PASS |

### Test Coverage Summary

- **Core package:** 356 tests (connection, migration, models, repos, services)
- **Agent-tools package:** 77 tests (schemas, tool handlers)
- **Total:** 433 tests passing
- **Coverage:** 42.75% lines overall, models at 100%, repos at 94%

### Known Limitations

1. **Pantry tracking:** Schema exists but not implemented → See T031
2. **Recipe updates:** Can add but not edit recipes → See T029
3. **Ingredient categories:** All shown as "Uncategorized" → See T030
4. **Test coverage:** Currently ~43%, target is 80% → See T038

## 9. Follow-Up Work

### Planned Enhancements (Milestone 8)

| Priority | Tickets | Features |
|----------|---------|----------|
| P1 | T042, T044, T045 | Headless browser recipe import, enhanced user preferences, grocery list persistence |
| P2 | T029, T030, T031, T036, T038, T040, T041, T043, T046, T047, T048, T049, T050, T051 | Recipe update/versioning, ingredient categories, pantry, plan history, test coverage, dining out, batch cooking, substitutions, recipe notes, scaling API, store sections, side dishes, prep day |
| P3 | T032, T033, T034, T035, T037, T039 | Audit viewing, JSON export, ratings, tags, favorites, MCP server |

### Future Considerations (Not Yet Ticketed)

1. **Ingredient normalization:** Use Claude agent to normalize ingredient names during import
2. **Protein tracking:** Add protein type to recipe model for same-protein variety rule
3. **Meal prep integration:** Link multiple meals that share prep work
4. **Shopping list sync:** Export to Reminders/Todoist/etc
5. **Recipe scaling:** Automatically scale ingredients when changing servings

### Technical Debt

1. Add integration tests for API endpoints (covered in T038)
2. Add E2E tests for CLI workflow (covered in T038)

## 10. Open Questions

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
