# Meal Planner UI

## 1. Overview

A Progressive Web App (PWA) frontend for the meal planning system that provides an intuitive interface for weekly meal planning, recipe management, grocery list generation, and pantry tracking. The UI consumes the existing HTTP API from the `@meals/api` backend.

Success looks like: A responsive, mobile-friendly web application where users can plan their weekly meals through a visual calendar, manage recipes with easy import and editing, generate actionable grocery lists with pantry integration, and track what's in their fridge/pantry. The app should work offline for grocery shopping and feel fast and intuitive.

## 2. Non Goals

- Native mobile apps (iOS/Android) - PWA covers mobile use cases
- User authentication or multi-user support - single-user system
- Real-time collaboration features
- Recipe video embedding or playback
- Nutritional analysis or calorie tracking visualization
- Voice assistant integration
- Integration with grocery delivery services
- Backend API development (covered in PLAN.md)

## 3. Assumptions

1. **Backend API is complete** - All endpoints from PLAN.md are implemented and working
2. **Single user** - No authentication required, app serves one household
3. **Modern browsers** - Target Chrome, Firefox, Safari, Edge (last 2 versions)
4. **Responsive design** - Mobile-first approach, works on phones through desktops
5. **Offline capability needed** - Grocery list must work without internet in stores
6. **API runs on localhost:3000** - Development against local backend
7. **No server-side rendering required** - Client-side SPA is sufficient
8. **Design system** - Using shadcn/ui components for consistent, accessible UI

## 4. Constraints

### Technical Constraints
- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** TanStack Query (server state) + Zustand (client state)
- **Forms:** React Hook Form + Zod
- **Drag & Drop:** @dnd-kit/core
- **PWA:** next-pwa for service worker and offline support
- **Testing:** Vitest + React Testing Library

### Platform Constraints
- **Location:** New `packages/web/` directory in existing monorepo
- **Build:** Must integrate with existing pnpm workspace
- **Port:** Development server on port 3001 (API on 3000)

### Design Constraints
- **Mobile-first:** All views must work on 375px width
- **Accessibility:** WCAG 2.1 AA compliance
- **Performance:** Core Web Vitals green scores
- **Offline:** Grocery list fully functional without network

## 5. Architecture Sketch

### Component Architecture

```
packages/web/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Dashboard (home)
│   ├── calendar/
│   │   └── page.tsx        # Weekly meal calendar
│   ├── recipes/
│   │   ├── page.tsx        # Recipe library
│   │   ├── [id]/
│   │   │   └── page.tsx    # Recipe detail
│   │   └── import/
│   │       └── page.tsx    # Import from URL
│   ├── grocery/
│   │   └── page.tsx        # Grocery list
│   ├── pantry/
│   │   └── page.tsx        # Pantry management
│   └── settings/
│       └── page.tsx        # User preferences
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── calendar/           # Calendar-specific components
│   │   ├── WeekGrid.tsx
│   │   ├── MealSlot.tsx
│   │   ├── RecipeCard.tsx
│   │   └── RecipeSelector.tsx
│   ├── recipes/            # Recipe-specific components
│   │   ├── RecipeCard.tsx
│   │   ├── RecipeForm.tsx
│   │   ├── IngredientList.tsx
│   │   └── InstructionSteps.tsx
│   ├── grocery/            # Grocery-specific components
│   │   ├── GroceryCategory.tsx
│   │   ├── GroceryItem.tsx
│   │   └── ShoppingMode.tsx
│   └── layout/             # Layout components
│       ├── Header.tsx
│       ├── Navigation.tsx
│       └── MobileNav.tsx
├── lib/
│   ├── api.ts              # API client wrapper
│   ├── queries.ts          # TanStack Query hooks
│   └── utils.ts            # Utility functions
├── stores/
│   └── ui.store.ts         # Zustand UI state
└── types/
    └── index.ts            # Shared TypeScript types
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js App                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   Calendar   │    │   Recipes    │    │   Grocery    │      │
│  │     View     │    │    Library   │    │     List     │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             │                                    │
│                    ┌────────▼────────┐                          │
│                    │  TanStack Query │  ← Cache + Sync          │
│                    │    + Zustand    │                          │
│                    └────────┬────────┘                          │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    API Client     │
                    │  (fetch wrapper)  │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  @meals/api       │
                    │  localhost:3000   │
                    └───────────────────┘
```

### Key Views

| View | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | Week overview, quick actions, expiring items |
| Calendar | `/calendar` | Weekly meal planning grid |
| Recipe Library | `/recipes` | Browse, search, filter recipes |
| Recipe Detail | `/recipes/[id]` | View/edit recipe, scale servings |
| Import Recipe | `/recipes/import` | Import from URL |
| Grocery List | `/grocery` | Shopping list with states |
| Pantry | `/pantry` | Inventory management |
| Settings | `/settings` | User preferences |

### Offline Strategy

1. **Service Worker:** Cache app shell, API responses
2. **Grocery List:** Store in IndexedDB, sync when online
3. **Queue Mutations:** Store offline changes, replay on reconnect
4. **Stale-While-Revalidate:** Show cached data, update in background

## 6. Definition of Done

- [ ] Build: `pnpm --filter @meals/web build` succeeds with no errors
- [ ] Test: `pnpm --filter @meals/web test` passes with >70% coverage
- [ ] Run: App starts on port 3001, connects to API on port 3000
- [ ] Validation: Complete this workflow:
  1. View dashboard with week overview
  2. Navigate to calendar, drag recipe to meal slot
  3. View recipe detail, scale to different servings
  4. Import a recipe from URL
  5. Generate grocery list, mark items as "already have"
  6. Add item to pantry
  7. Disconnect network, verify grocery list still works
  8. Reconnect, verify changes synced

## 7. Task Backlog

### Ticket: U001 Initialize Next.js project in monorepo
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create packages/web with Next.js 14, configure pnpm workspace integration
- **Acceptance Criteria:**
  - Next.js 14 with App Router initialized in packages/web
  - TypeScript configured extending base tsconfig
  - pnpm workspace recognizes package as @meals/web
  - Dev server starts on port 3001
- **Validation Steps:**
  - `pnpm install` succeeds
  - `pnpm --filter @meals/web dev` starts server
  - Visit http://localhost:3001 shows Next.js default page
- **Notes:**

### Ticket: U002 Configure Tailwind CSS and shadcn/ui
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Set up Tailwind CSS, install and configure shadcn/ui component library
- **Acceptance Criteria:**
  - Tailwind CSS configured with custom theme
  - shadcn/ui initialized with default components
  - Dark mode support configured
  - Base components available: Button, Card, Input, Dialog, etc.
- **Validation Steps:**
  - Import and render a Button component
  - Tailwind classes apply correctly
  - Dark mode toggle works
- **Notes:**
  - Use shadcn/ui CLI to add components as needed
  - Agent-U002 implementation notes:
    - Installed Tailwind CSS 3.4.x, PostCSS, autoprefixer, tailwindcss-animate
    - Configured tailwind.config.js with custom theme colors using CSS variables
    - Created globals.css with Tailwind directives and light/dark mode CSS variables
    - Initialized shadcn/ui with components.json (new-york style, CSS variables)
    - Added components: Button, Card, Input, Dialog
    - Created lib/utils.ts with cn() utility function
    - Installed next-themes, created ThemeProvider component
    - Updated layout.tsx with ThemeProvider (attribute="class", enableSystem)
    - Updated page.tsx with demo showcasing all button variants, cards, input, and theme toggle
    - Build succeeds, TypeScript types check, dev server runs on port 3001

### Ticket: U003 Create API client and TanStack Query setup
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create typed API client wrapper, configure TanStack Query provider
- **Acceptance Criteria:**
  - API client with typed methods for all backend endpoints
  - TanStack Query provider in root layout
  - Query hooks for recipes, plans, grocery, preferences
  - Error handling and loading states
- **Validation Steps:**
  - `useRecipes()` hook returns recipe list from API
  - Loading and error states render correctly
  - Mutations invalidate related queries
- **Notes:**
  - API base URL configurable via environment variable

### Ticket: U004 Implement app layout and navigation
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create responsive layout with header, navigation, and mobile bottom nav
- **Acceptance Criteria:**
  - Header with app title and settings access
  - Desktop: side navigation or top nav
  - Mobile: bottom navigation bar
  - Active route highlighting
  - Responsive breakpoints work correctly
- **Validation Steps:**
  - Navigate between all main routes
  - Mobile nav appears on small screens
  - Desktop nav appears on large screens
- **Notes:**
  - Navigation items: Dashboard, Calendar, Recipes, Grocery, Pantry

### Ticket: U005 Build dashboard/home page
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create dashboard with week overview, quick actions, and alerts
- **Acceptance Criteria:**
  - Mini calendar showing current week's meals
  - Quick action buttons: Plan Week, Add Recipe, View Grocery List
  - Today's and tomorrow's meals highlighted
  - Expiring pantry items alert (if pantry has items)
  - Recently added recipes section
- **Validation Steps:**
  - Dashboard loads and shows current week
  - Quick actions navigate to correct pages
  - Expiring items show when pantry has items expiring within 7 days
- **Notes:**

### Ticket: U006 Build weekly calendar view
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create interactive 7-day meal calendar grid with recipe slots
- **Acceptance Criteria:**
  - 7-day grid view (Mon-Sun)
  - Rows for each meal type (breakfast/lunch/dinner based on preferences)
  - Empty slots show "+" button to add meal
  - Filled slots show recipe card with image/title
  - Week navigation (previous/next week)
  - Current week highlighted
- **Validation Steps:**
  - Grid displays correct days for selected week
  - Week navigation changes displayed week
  - Meal slots reflect data from API
- **Notes:**
  - Mobile: may need to show 1-day or 3-day view with swipe

### Ticket: U007 Implement drag-and-drop meal assignment
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Add drag-and-drop support for moving recipes between meal slots
- **Acceptance Criteria:**
  - Drag recipe card from one slot to another
  - Visual feedback during drag (drop zones highlight)
  - API call to update meal assignment on drop
  - Optimistic update with rollback on error
  - Touch support for mobile devices
- **Validation Steps:**
  - Drag recipe from Monday dinner to Tuesday dinner
  - API is called, both slots update correctly
  - Dragging to invalid area cancels operation
- **Notes:**
  - Use @dnd-kit/core for drag-drop implementation

### Ticket: U008 Build recipe selector modal
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create modal for selecting a recipe to assign to a meal slot
- **Acceptance Criteria:**
  - Opens when clicking empty slot or "change" on filled slot
  - Search bar to filter recipes
  - Filter by cuisine, tags, prep time
  - Recipe cards with quick info (title, time, image)
  - Recently used and favorites at top
  - Servings selector before confirming
- **Validation Steps:**
  - Open modal, search for recipe, select it
  - Recipe appears in selected meal slot
  - Cancel closes modal without changes
- **Notes:**
  - Include "Dining Out" and "Skip" options in modal

### Ticket: U009 Build recipe library page
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create browsable recipe library with search, filters, and grid view
- **Acceptance Criteria:**
  - Grid of recipe cards (image, title, time, cuisine)
  - Search bar with real-time filtering
  - Filter sidebar/dropdown: cuisine, tags, prep time, favorites
  - Sort options: name, date added, prep time
  - Pagination or infinite scroll
  - Empty state with import/add prompts
- **Validation Steps:**
  - Search returns matching recipes
  - Filters combine correctly
  - Click recipe card navigates to detail page
- **Notes:**

### Ticket: U010 Build recipe detail page
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create recipe detail view with ingredients, instructions, and actions
- **Acceptance Criteria:**
  - Hero image (or placeholder) with title overlay
  - Metadata: servings, prep time, cook time, cuisine
  - Ingredients list with quantities
  - Step-by-step instructions
  - Serving scaler (change servings, ingredients recalculate)
  - Actions: Add to Plan, Favorite, Edit, Delete
  - Dietary/allergy badges
- **Validation Steps:**
  - Recipe displays all data correctly
  - Serving scaler updates ingredient quantities
  - Add to Plan opens recipe selector context
- **Notes:**
  - Instructions should have numbered steps, section headers

### Ticket: U011 Build recipe import flow
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create UI for importing recipes from URLs
- **Acceptance Criteria:**
  - URL input field with paste support
  - Loading state while parsing
  - Preview of parsed recipe before saving
  - Edit capability on preview (fix parsed errors)
  - Error state with retry or manual entry option
  - Success confirmation with "Add to Plan" prompt
- **Validation Steps:**
  - Paste valid recipe URL, see preview
  - Edit title, save recipe
  - Invalid URL shows error with guidance
- **Notes:**
  - Show supported sites or "works with most recipe sites"

### Ticket: U012 Build recipe form (add/edit)
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create form for manually adding or editing recipes
- **Acceptance Criteria:**
  - Fields: title, description, servings, prep/cook time, cuisine
  - Ingredients list with add/remove, quantity/unit/name
  - Instructions textarea or step-by-step editor
  - Tags multi-select
  - Image URL field (or placeholder selection)
  - Validation with error messages
  - Save and cancel buttons
- **Validation Steps:**
  - Add new recipe with all fields
  - Edit existing recipe, verify changes saved
  - Required field validation shows errors
- **Notes:**
  - Consider rich text for instructions

### Ticket: U013 Build grocery list page
- **Priority:** P0
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create grocery list view with categorized items and state tracking
- **Acceptance Criteria:**
  - Items grouped by store section (Produce, Dairy, etc.)
  - Each item shows: name, quantity, unit, source recipes
  - Three states per item: need to buy, already have, partial
  - Checkbox to mark items (cycles through states)
  - Quantity badge shows "Have X / Need Y" for partial
  - "Already Have" section collapsed by default
- **Validation Steps:**
  - Generate list for current week
  - Mark items, verify state persists on reload
  - Partial quantity shows correct numbers
- **Notes:**

### Ticket: U014 Implement shopping mode for grocery list
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create simplified shopping mode optimized for in-store use
- **Acceptance Criteria:**
  - Toggle to enter shopping mode
  - Larger checkboxes and touch targets
  - Strikethrough on checked items
  - Hide "already have" section
  - Keep screen awake (if supported)
  - Quick category jump/collapse
- **Validation Steps:**
  - Enter shopping mode, check items easily
  - Exit shopping mode, normal view returns
  - Works well on mobile screen
- **Notes:**
  - Consider "done shopping" button to exit and prompt pantry update

### Ticket: U015 Build pantry management page
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create pantry inventory management interface
- **Acceptance Criteria:**
  - List of pantry items with quantity, unit, location
  - Add item form (ingredient, quantity, unit, location, expiration)
  - Edit/remove items
  - Expiring soon section (7 days)
  - Prepared items section (with prep notes)
  - Filter by location (fridge/freezer/pantry)
  - Quick-add staples button
- **Validation Steps:**
  - Add item to pantry, appears in list
  - Edit quantity, change persists
  - Expiring items show in alert section
- **Notes:**

### Ticket: U016 Implement pantry-grocery integration
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Connect pantry to grocery list for auto-checking
- **Acceptance Criteria:**
  - "Check Pantry" button on grocery list
  - Shows modal with items that match pantry
  - Bulk mark matching items as "already have"
  - Handle partial matches (have some, need more)
  - After shopping: prompt to add purchases to pantry
- **Validation Steps:**
  - Add onions to pantry, generate grocery list needing onions
  - Click Check Pantry, onions suggested for marking
  - Accept, onions marked as "already have"
- **Notes:**

### Ticket: U017 Build settings/preferences page
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create settings page for user preferences
- **Acceptance Criteria:**
  - Household size setting
  - Meal types to plan (checkboxes)
  - Dietary restrictions (multi-select)
  - Disliked ingredients (tag input)
  - Favorite cuisines (multi-select)
  - Default servings
  - Max prep time
  - Prep day selection
  - Dark mode toggle
- **Validation Steps:**
  - Change household size, verify saved to API
  - Toggle dietary restriction, verify persisted
  - Settings survive page reload
- **Notes:**

### Ticket: U018 Implement offline support with service worker
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Add PWA capabilities with offline grocery list support
- **Acceptance Criteria:**
  - Service worker caches app shell
  - Grocery list data cached in IndexedDB
  - Offline banner when disconnected
  - Grocery list fully functional offline
  - Mutations queued and synced on reconnect
  - Install prompt on supported browsers
- **Validation Steps:**
  - Load app, go offline, grocery list still works
  - Check items offline, reconnect, changes sync
  - App installable as PWA
- **Notes:**
  - Use next-pwa or workbox

### Ticket: U019 Implement meal slot special states
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Support "Dining Out", "Skip", and "Leftovers" meal slot states
- **Acceptance Criteria:**
  - Recipe selector includes "Dining Out" and "Skip" options
  - "Leftovers from..." option with meal selector
  - Calendar displays appropriate labels/icons for each state
  - Notes field for dining out (restaurant name)
  - Grocery list excludes non-recipe slots
- **Validation Steps:**
  - Mark Saturday dinner as "Dining Out"
  - Calendar shows dining out icon/label
  - Grocery list doesn't include Saturday dinner
- **Notes:**
  - Depends on backend T040 being complete

### Ticket: U020 Build substitution suggestions UI
- **Priority:** P2
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Show ingredient substitution suggestions when viewing recipes
- **Acceptance Criteria:**
  - "Missing ingredients" badge on recipe if not in pantry
  - Substitution suggestions shown inline or in modal
  - Accept substitution updates recipe instance for this meal
  - "I have this instead" free-form input
  - Dietary info shown for each substitution
- **Validation Steps:**
  - View recipe missing ingredient
  - See substitution suggestion
  - Accept substitution, recipe updates
- **Notes:**
  - Depends on backend T046 being complete

### Ticket: U021 Implement recipe favorites and quick access
- **Priority:** P2
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Add favorite functionality with quick access in recipe selector
- **Acceptance Criteria:**
  - Heart/star icon on recipe cards to toggle favorite
  - Favorites filter in recipe library
  - Favorites section at top of recipe selector modal
  - Recently used recipes also shown in selector
- **Validation Steps:**
  - Favorite a recipe, verify icon filled
  - Favorites appear in filter and selector
  - Unfavorite, recipe removed from favorites section
- **Notes:**
  - Depends on backend T037 being complete

### Ticket: U022 Build prep day view
- **Priority:** P2
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Create aggregated prep day task view
- **Acceptance Criteria:**
  - Accessible from calendar on designated prep day
  - Lists all recipes to prep
  - Aggregated ingredient prep (e.g., "Dice: 3 onions, 4 peppers")
  - Estimated total prep time
  - Checklist format for tracking progress
  - Equipment needed list
- **Validation Steps:**
  - View prep day for week with multiple recipes
  - See aggregated tasks and time estimate
  - Check off tasks as completed
- **Notes:**
  - Depends on backend T051 being complete

### Ticket: U023 Add loading states and skeletons
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Implement consistent loading states across all views
- **Acceptance Criteria:**
  - Skeleton loaders for recipe cards, calendar slots
  - Loading spinners for actions (save, delete)
  - Optimistic updates where appropriate
  - Error boundaries with retry options
  - Empty states for lists with no data
- **Validation Steps:**
  - Slow network shows skeleton loaders
  - Actions show loading indicator
  - Errors show recovery options
- **Notes:**

### Ticket: U024 Implement responsive design polish
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Ensure all views work well on mobile through desktop
- **Acceptance Criteria:**
  - All views usable at 375px width
  - Touch targets minimum 44x44px on mobile
  - Calendar adapts (day view on mobile, week on desktop)
  - Recipe detail scrolls appropriately
  - Forms don't require horizontal scrolling
  - Modal sizes appropriate for screen
- **Validation Steps:**
  - Test all views at 375px, 768px, 1024px, 1440px
  - Touch interactions work on mobile
  - No horizontal scroll on any view
- **Notes:**

### Ticket: U025 Add keyboard navigation and accessibility
- **Priority:** P1
- **Status:** Todo
- **Owner:** Unassigned
- **Scope:** Ensure WCAG 2.1 AA compliance and keyboard navigation
- **Acceptance Criteria:**
  - All interactive elements focusable via Tab
  - Focus indicators visible
  - ARIA labels on icons and actions
  - Screen reader tested on main flows
  - Color contrast meets AA standards
  - Semantic HTML throughout
- **Validation Steps:**
  - Navigate entire app via keyboard only
  - Lighthouse accessibility score > 90
  - VoiceOver/NVDA can navigate main flows
- **Notes:**
  - shadcn/ui provides good baseline accessibility

## 8. Open Questions

| Question | Context | Decision |
|----------|---------|----------|
| Recipe images? | Imported recipes may have image URLs. Store or proxy? | Pending - use URLs directly, add placeholder for missing |
| Authentication future? | Single-user now, but may want multi-user later | Pending - design with auth hooks possible but don't implement |
| Recipe serving scaler | Should scaling be visual only or persist? | Pending - visual only for now, persist via batch cooking |
| Calendar week start | Some users prefer Sunday, others Monday | Pending - default Monday, add preference if needed |
| Grocery list sharing | How to share with family member? | Pending - simple "Copy to clipboard" for v1 |

## 9. Discovered Issues Log

> _New issues must be appended here with a timestamp and brief context._

<!-- Example:
- **2026-01-04 14:30** - Issue description and context
-->
