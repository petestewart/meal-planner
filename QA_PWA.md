# QA Test Plan - Meal Planner PWA

## Overview

This document outlines a comprehensive QA test plan for the Meal Planner web application. It covers all implemented UI tickets (U001-U025, excluding P2 tickets U020-U022) through realistic user workflows.

## Prerequisites

Before starting tests:

1. **Start the API server:**
   ```bash
   pnpm --filter @meals/api dev
   ```
   Expected: Server running on http://localhost:3000

2. **Start the Web server:**
   ```bash
   pnpm --filter @meals/web dev
   ```
   Expected: Server running on http://localhost:3001

3. **Verify build passes:**
   ```bash
   pnpm --filter @meals/web build
   ```
   Expected: Build completes with no errors

---

## Test 1: Application Launch & Navigation (U001, U002, U003, U004)

### 1.1 Initial Load
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open http://localhost:3001 in browser | Dashboard page loads without errors |
| 2 | Check browser console | No JavaScript errors |
| 3 | Verify page styling | Tailwind CSS styles applied, no unstyled content flash |

### 1.2 Navigation - Desktop
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Look at left sidebar or top nav | Navigation visible with: Dashboard, Calendar, Recipes, Grocery, Pantry |
| 2 | Click "Calendar" | Navigates to /calendar, link shows active state |
| 3 | Click "Recipes" | Navigates to /recipes, link shows active state |
| 4 | Click "Grocery" | Navigates to /grocery, link shows active state |
| 5 | Click "Pantry" | Navigates to /pantry, link shows active state |
| 6 | Click "Dashboard" or logo | Returns to home page |

### 1.3 Navigation - Mobile (resize to <640px)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Resize browser to mobile width (<640px) | Bottom navigation bar appears |
| 2 | Tap each nav item | Navigates correctly, shows active state |
| 3 | Verify touch targets | Nav items are at least 44px tall |

### 1.4 Header & Theme
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Look at header | App title "Meal Planner" visible |
| 2 | Find theme toggle (sun/moon icon) | Toggle button present |
| 3 | Click theme toggle | Theme switches between light/dark mode |
| 4 | Refresh page | Theme preference persists |

---

## Test 2: Dashboard (U005)

### 2.1 Dashboard Content
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Dashboard (/) | Page loads with welcome message |
| 2 | Look for "This Week at a Glance" | Mini calendar section visible showing current week |
| 3 | Verify current day highlight | Today's date has visual distinction (badge or highlight) |
| 4 | Look for quick action buttons | "Plan Week", "Add Recipe", "Grocery List" buttons visible |
| 5 | Click "Plan Week" | Navigates to /calendar |
| 6 | Return to Dashboard, click "Add Recipe" | Navigates to /recipes or /recipes/new |
| 7 | Return to Dashboard, click "Grocery List" | Navigates to /grocery |

### 2.2 Dashboard Data Sections
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Look for "Recently Added" section | Section visible (may show "No recipes" if empty) |
| 2 | Look for "Expiring Soon" section | Section visible (may show "No items expiring" if pantry empty) |

---

## Test 3: Recipe Library (U009)

### 3.1 Recipe List View
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /recipes | Recipe library page loads |
| 2 | Check for recipe grid | Grid of recipe cards displayed (or empty state) |
| 3 | Look for search bar | Search input field visible |
| 4 | Look for filter options | Cuisine filter and sort dropdown visible |
| 5 | Look for "Add Recipe" button | Button visible to add new recipe |

### 3.2 Recipe Search & Filter
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type in search bar | Results filter in real-time as you type |
| 2 | Clear search | All recipes show again |
| 3 | Select a cuisine filter | Only recipes with that cuisine shown |
| 4 | Change sort order | Recipes reorder accordingly |
| 5 | Click favorites filter (heart icon) | Only favorited recipes shown (if any) |

### 3.3 Empty State
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | If no recipes exist | Empty state message with prompt to add/import |

---

## Test 4: Recipe Import (U011)

### 4.1 Import Flow
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /recipes/import (or click Import button) | Import page loads with URL input |
| 2 | Check for URL input field | Large input field with paste support visible |
| 3 | Enter invalid URL (e.g., "not-a-url") | Error state shown with guidance |
| 4 | Click "Try Again" | Returns to URL input state |

### 4.2 Successful Import (requires valid recipe URL)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Paste valid recipe URL (e.g., from allrecipes.com) | Loading state shows "Importing recipe..." |
| 2 | Wait for import to complete | Preview of parsed recipe appears |
| 3 | Verify editable fields | Title, description, servings, times are editable |
| 4 | Edit the title | Title updates |
| 5 | Click "Save Recipe" | Recipe saved, redirects to recipe detail or shows success |

---

## Test 5: Recipe Form - Manual Entry (U012)

### 5.1 New Recipe Form
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /recipes/new | Recipe form loads |
| 2 | Check form fields | Title, description, servings, prep time, cook time, cuisine, image URL visible |
| 3 | Leave title empty and try to save | Validation error shown for required field |

### 5.2 Add Ingredients
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find ingredients section | Ingredient input fields visible |
| 2 | Add an ingredient (qty, unit, name) | Ingredient added to list |
| 3 | Click "Add Ingredient" | New empty ingredient row appears |
| 4 | Click remove on an ingredient | Ingredient removed from list |

### 5.3 Add Instructions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find instructions section | Instruction step inputs visible |
| 2 | Type an instruction | Text entered |
| 3 | Click "Add Step" | New step input appears |
| 4 | Remove a step | Step removed |

### 5.4 Save Recipe
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill in all required fields | Form valid |
| 2 | Click "Save Recipe" | Recipe saved, redirects to recipe detail |
| 3 | Verify recipe in library | New recipe appears in /recipes list |

---

## Test 6: Recipe Detail (U010)

### 6.1 View Recipe
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click on a recipe card in library | Recipe detail page loads at /recipes/[id] |
| 2 | Verify title displayed | Recipe title shown prominently |
| 3 | Verify metadata | Servings, prep time, cook time, cuisine displayed |
| 4 | Verify ingredients list | All ingredients shown with quantities |
| 5 | Verify instructions | Step-by-step instructions displayed |

### 6.2 Serving Scaler
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find serving scaler | +/- buttons or input for servings |
| 2 | Increase servings | Ingredient quantities scale up proportionally |
| 3 | Decrease servings | Ingredient quantities scale down proportionally |

### 6.3 Recipe Actions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find action buttons | Edit, Favorite, Add to Plan buttons visible |
| 2 | Click Favorite (heart icon) | Heart fills in, recipe marked as favorite |
| 3 | Click Favorite again | Heart unfills, favorite removed |
| 4 | Click Edit | Navigates to /recipes/[id]/edit with form pre-filled |

### 6.4 Edit Recipe
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On edit page, change title | Title updates |
| 2 | Click Save | Changes saved, redirects to detail page |
| 3 | Verify changes persisted | Updated title shown |

---

## Test 7: Weekly Calendar (U006)

### 7.1 Calendar View
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /calendar | Weekly calendar grid loads |
| 2 | Verify 7 days shown | Monday through Sunday columns visible |
| 3 | Verify meal rows | Rows for configured meal types (e.g., Breakfast, Lunch, Dinner) |
| 4 | Verify current week shown | Week containing today's date displayed |
| 5 | Check week navigation | Previous/Next week arrows visible |

### 7.2 Week Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Next Week" arrow | Calendar advances one week |
| 2 | Click "Previous Week" arrow | Calendar goes back one week |
| 3 | Verify date range updates | Header shows correct week dates |

### 7.3 Empty Meal Slots
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find an empty meal slot | "+" or "Add" button visible |
| 2 | Click on empty slot | Recipe selector modal opens |

---

## Test 8: Recipe Selector Modal (U008)

### 8.1 Modal Opening
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click empty meal slot on calendar | Modal opens with recipe list |
| 2 | Verify modal contents | Search bar, recipe list, special options visible |
| 3 | Verify special options | "Dining Out", "Skip Meal", "Leftovers" options at top |

### 8.2 Search & Select Recipe
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Type in search field | Recipes filter as you type |
| 2 | Click on a recipe | Recipe selected, servings selector may appear |
| 3 | Adjust servings if prompted | Servings update |
| 4 | Click "Add" or confirm | Modal closes, recipe appears in meal slot |

### 8.3 Special Options (U019)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open recipe selector | Modal opens |
| 2 | Click "Dining Out" | Notes input appears for restaurant name |
| 3 | Enter restaurant name | Text entered |
| 4 | Confirm selection | Slot shows "Dining Out" with restaurant name |
| 5 | Open another empty slot | Modal opens |
| 6 | Click "Skip Meal" | Slot marked as skipped |

### 8.4 Cancel
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open recipe selector | Modal opens |
| 2 | Click outside modal or X button | Modal closes without changes |

---

## Test 9: Drag and Drop (U007)

### 9.1 Move Recipe Between Slots
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure at least one recipe is on calendar | Recipe card visible in a slot |
| 2 | Click and hold on recipe card | Card becomes draggable, cursor changes |
| 3 | Drag to another empty slot | Drop zones highlight on hover |
| 4 | Release on valid slot | Recipe moves to new slot |
| 5 | Verify original slot | Original slot is now empty |
| 6 | Verify API update | Page doesn't show error, change persists on refresh |

### 9.2 Invalid Drop
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Start dragging a recipe | Card in drag state |
| 2 | Drop outside calendar | Recipe returns to original position |
| 3 | Drop on same slot | No change (should be prevented) |

### 9.3 Touch Drag (Mobile)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On touch device or emulation | Touch and hold recipe card |
| 2 | After delay (~200ms) | Drag activates |
| 3 | Drag to new slot | Works same as mouse drag |

---

## Test 10: Grocery List (U013)

### 10.1 View Grocery List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /grocery | Grocery list page loads |
| 2 | If no plan exists | Empty state or prompt to generate |
| 3 | If plan exists | Grocery items grouped by category |

### 10.2 Generate Grocery List
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find "Generate" or "Refresh" button | Button visible |
| 2 | Click generate | List generated from current week's meal plan |
| 3 | Verify categories | Items grouped (Produce, Dairy, Meat, etc.) |

### 10.3 Item Interactions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find a grocery item | Item with checkbox visible |
| 2 | Click checkbox | Item marked as "already have", visual change |
| 3 | Click again | Cycles through states or unchecks |
| 4 | Verify persistence | Refresh page, state persisted |

### 10.4 Check Pantry Integration (U016)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find "Check Pantry" button | Button visible in header |
| 2 | Click "Check Pantry" | Dialog opens asking to check |
| 3 | Confirm | API checks pantry, shows results |
| 4 | Close dialog | Matching items may be marked |

---

## Test 11: Shopping Mode (U014)

### 11.1 Enter Shopping Mode
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | On grocery page, find "Shopping Mode" button | Button visible |
| 2 | Click "Shopping Mode" | UI transforms to simplified view |
| 3 | Verify larger touch targets | Checkboxes and items are larger |
| 4 | Verify "already have" items hidden | Only items to buy shown |

### 11.2 Shopping Mode Interactions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Tap an item checkbox | Item checked with strikethrough |
| 2 | Verify item hides or fades | Checked items visually distinct |
| 3 | Find progress indicator | Shows X of Y items complete |
| 4 | Check all items | "Shopping Complete" state shown |

### 11.3 Category Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find category jump buttons | Horizontal scroll of category names |
| 2 | Tap a category | Scrolls to or expands that category |
| 3 | Tap category header | Category collapses/expands |

### 11.4 Exit Shopping Mode
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find exit button | "Exit" or "Done" button visible |
| 2 | Click exit | Returns to normal grocery view |
| 3 | Verify checked items persisted | Items remain checked |

---

## Test 12: Pantry Management (U015)

### 12.1 View Pantry
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /pantry | Pantry page loads |
| 2 | Check for location tabs | "All", "Fridge", "Freezer", "Pantry" tabs visible |
| 3 | Check for empty state | If empty, shows "No items" message |

### 12.2 Add Pantry Item
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find "Add Item" button | Button visible |
| 2 | Click "Add Item" | Form/dialog opens |
| 3 | Enter ingredient name | Text entered |
| 4 | Enter quantity and unit | Numbers/text entered |
| 5 | Select location (fridge/freezer/pantry) | Location selected |
| 6 | Optionally set expiration date | Date picker works |
| 7 | Click Save/Add | Item added to list |

### 12.3 Filter by Location
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click "Fridge" tab | Only fridge items shown |
| 2 | Click "Freezer" tab | Only freezer items shown |
| 3 | Click "Pantry" tab | Only pantry items shown |
| 4 | Click "All" tab | All items shown |

### 12.4 Edit/Remove Pantry Item
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find edit button on item | Edit icon/button visible |
| 2 | Click edit | Edit form opens with current values |
| 3 | Change quantity | Quantity updates |
| 4 | Save | Changes persisted |
| 5 | Find delete/remove button | Remove icon/button visible |
| 6 | Click remove | Confirmation may appear |
| 7 | Confirm removal | Item removed from list |

### 12.5 Use Item
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find "Use" button on item | Button visible (may be "-1" or "Use") |
| 2 | Click Use | Quantity decrements by 1 |
| 3 | If quantity reaches 0 | Item removed or shows 0 |

### 12.6 Expiring Items
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Add item with expiration date within 7 days | Item added |
| 2 | Check "Expiring Soon" section | Section visible with item |
| 3 | Verify visual indicator | Item shows expiration warning |

---

## Test 13: Settings & Preferences (U017)

### 13.1 View Settings
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to /settings | Settings page loads |
| 2 | Verify sections visible | Household, Meals, Dietary, Cuisines, etc. |

### 13.2 Household Settings
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find "Household Size" input | Number input visible |
| 2 | Change value | Value updates |
| 3 | Find "Default Servings" input | Number input visible |
| 4 | Change value | Value updates |

### 13.3 Meal Type Preferences
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find meal type checkboxes | Breakfast, Lunch, Dinner, Snacks options |
| 2 | Toggle a checkbox | Checkbox state changes |
| 3 | Verify auto-save | "Saving..." indicator may flash |

### 13.4 Dietary Restrictions
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find dietary restrictions section | Multiple checkbox options |
| 2 | Select "Vegetarian" | Checkbox checked |
| 3 | Select another restriction | Multiple can be selected |

### 13.5 Disliked Ingredients
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find disliked ingredients input | Tag input field |
| 2 | Type an ingredient and press Enter | Tag added |
| 3 | Click X on a tag | Tag removed |

### 13.6 Favorite Cuisines
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find favorite cuisines section | Multiple checkbox options |
| 2 | Select multiple cuisines | Checkboxes checked |

### 13.7 Prep Day & Max Prep Time
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find prep day dropdown | Dropdown with days of week |
| 2 | Select a day | Selection saved |
| 3 | Find max prep time input | Number input (minutes) |
| 4 | Enter a value | Value saved |

### 13.8 Dark Mode Toggle
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find dark mode toggle | Toggle button visible |
| 2 | Click toggle | Theme switches |
| 3 | Verify persistence | Refresh page, theme persists |

### 13.9 Settings Persistence
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Make several changes | Changes applied |
| 2 | Refresh page | All settings persisted |
| 3 | Navigate away and back | Settings still correct |

---

## Test 14: Loading States & Skeletons (U023)

### 14.1 Skeleton Loaders
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open DevTools, Network tab | Network visible |
| 2 | Throttle to "Slow 3G" | Network slowed |
| 3 | Navigate to /recipes | Skeleton cards shown while loading |
| 4 | Navigate to /calendar | Skeleton grid shown while loading |
| 5 | Navigate to /grocery | Skeleton list shown while loading |
| 6 | Navigate to /pantry | Skeleton items shown while loading |

### 14.2 Error States
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Stop API server | Server offline |
| 2 | Navigate to /recipes | Error message shown with retry button |
| 3 | Click retry | Attempts to reload data |
| 4 | Restart API server | Data loads on retry |

### 14.3 Empty States
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure no recipes exist | Recipe library empty |
| 2 | Navigate to /recipes | Empty state with prompt to add/import |
| 3 | Ensure no pantry items | Pantry empty |
| 4 | Navigate to /pantry | Empty state message shown |

---

## Test 15: Responsive Design (U024)

### 15.1 Mobile View (375px)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set viewport to 375px width | Mobile layout activates |
| 2 | Check navigation | Bottom nav bar visible, side nav hidden |
| 3 | Check recipe grid | Single column layout |
| 4 | Check calendar | May show day view or horizontal scroll |
| 5 | Check forms | Fields stack vertically, no horizontal scroll |
| 6 | Check modals | Full-screen on mobile |
| 7 | Check touch targets | All buttons at least 44px |

### 15.2 Tablet View (768px)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set viewport to 768px width | Tablet layout |
| 2 | Check recipe grid | 2 columns |
| 3 | Check navigation | May show side nav or top nav |

### 15.3 Desktop View (1024px+)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set viewport to 1024px+ | Desktop layout |
| 2 | Check recipe grid | 3-4 columns |
| 3 | Check calendar | Full week view visible |
| 4 | Check navigation | Side navigation visible |

### 15.4 No Horizontal Scroll
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | At each breakpoint | Check all pages |
| 2 | Verify no horizontal scrollbar | Page fits within viewport width |

---

## Test 16: Accessibility (U025)

### 16.1 Keyboard Navigation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press Tab from top of page | Focus moves to skip link (if visible) or first interactive element |
| 2 | Continue tabbing | Focus moves through all interactive elements in logical order |
| 3 | Verify focus indicators | Blue/ring outline visible on focused elements |
| 4 | Press Enter on buttons | Buttons activate |
| 5 | Press Enter on links | Links navigate |
| 6 | Press Escape on modals | Modals close |

### 16.2 Skip Link
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Press Tab once on page load | "Skip to main content" link appears |
| 2 | Press Enter on skip link | Focus jumps to main content area |

### 16.3 Screen Reader (optional)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enable screen reader (VoiceOver/NVDA) | Reads page content |
| 2 | Navigate through recipe library | Recipes announced with titles |
| 3 | Open recipe selector modal | Modal announced |
| 4 | Check form inputs | Labels read for each input |

### 16.4 ARIA Labels
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Inspect icon-only buttons in DevTools | aria-label attribute present |
| 2 | Check navigation | aria-current="page" on active link |
| 3 | Check filter toggles | aria-pressed attribute present |

---

## Test 17: PWA & Offline Support (U018)

### 17.1 PWA Installation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app in Chrome | App loads |
| 2 | Look for install prompt in address bar | Install icon or prompt visible |
| 3 | Click install | App installs to device |
| 4 | Open installed app | App opens in standalone window |

### 17.2 Offline Indicator
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open DevTools > Network | Network panel visible |
| 2 | Check "Offline" checkbox | Network disabled |
| 3 | Observe page | Amber "You're offline" banner appears |
| 4 | Uncheck "Offline" | Network restored |
| 5 | Observe page | "Back online" message may flash |

### 17.3 Offline Grocery List (Production Build Only)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Build production: `pnpm --filter @meals/web build` | Build completes |
| 2 | Start production: `pnpm --filter @meals/web start` | Server starts |
| 3 | Open app and navigate to /grocery | Page loads |
| 4 | Go offline (DevTools or disconnect) | Offline banner appears |
| 5 | Try to view grocery list | Cached data may still display |
| 6 | Go back online | App syncs |

### 17.4 Service Worker (Production Build Only)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open DevTools > Application | Application panel visible |
| 2 | Check "Service Workers" section | Service worker registered |
| 3 | Check "Cache Storage" | App assets cached |

---

## Test Summary Checklist

| Test Area | Tickets Covered | Status |
|-----------|-----------------|--------|
| App Launch & Navigation | U001, U002, U003, U004 | |
| Dashboard | U005 | |
| Recipe Library | U009 | |
| Recipe Import | U011 | |
| Recipe Form | U012 | |
| Recipe Detail | U010 | |
| Weekly Calendar | U006 | |
| Recipe Selector Modal | U008 | |
| Meal Slot Special States | U019 | |
| Drag and Drop | U007 | |
| Grocery List | U013 | |
| Shopping Mode | U014 | |
| Pantry Management | U015 | |
| Pantry-Grocery Integration | U016 | |
| Settings & Preferences | U017 | |
| Loading States & Skeletons | U023 | |
| Responsive Design | U024 | |
| Accessibility | U025 | |
| PWA & Offline | U018 | |

---

## Notes for QA Agent

1. **Test order matters**: Follow tests in order as some tests depend on data created in earlier tests (e.g., recipes must exist before testing calendar)

2. **API must be running**: Most tests require the API server on port 3000

3. **Browser DevTools**: Many tests require browser developer tools for:
   - Network throttling (loading states)
   - Offline simulation (PWA tests)
   - Viewport resizing (responsive tests)
   - Console checking (error detection)

4. **Data cleanup**: Some tests may benefit from starting with fresh data. The database is at `packages/core/meals.db`

5. **PWA tests require production build**: Service worker only activates in production mode

6. **Report format**: For each failed test, document:
   - Test number and step
   - Expected result
   - Actual result
   - Screenshot if applicable
   - Browser console errors
