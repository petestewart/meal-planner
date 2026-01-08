# QA Test Plan - UI V2 Redesign

## Overview

This test plan validates the UI V2 redesign implementation for the Meal Planner application. The redesign transforms the UI from a generic shadcn/ui implementation to a warm, distinctive "Modern Kitchen Journal" aesthetic.

**Scope:** 27 completed tickets covering:
- Design Foundation (colors, typography, spacing)
- Core UI Components (button, input, card, badge, dialog)
- Layout Components (header, navigation, mobile nav)
- Recipe Components (cards, grid, form, detail page)
- Calendar Components (week grid, meal slots, mobile view)
- Grocery & Pantry
- Dashboard
- Animation & Polish
- Accessibility & Responsiveness

## Test Environment

### Prerequisites
- Node.js installed
- Development server running (`npm run dev` from packages/web)
- Modern browser (Chrome, Firefox, or Safari)
- Access to browser DevTools for responsive testing

### Setup
```bash
cd packages/web
npm run dev
# App runs at http://localhost:3001
```

### Test Data Requirements
- At least 3-5 recipes in the system
- At least one week with planned meals
- Some grocery items generated
- Some pantry items added

---

## Test Cases

### Phase 1: Design Foundation

---

### TC-001: Color System - Light Mode
**Feature:** Kitchen Table Color Palette (Ticket 1.1)
**Priority:** Critical

**Preconditions:**
- App is in light mode (check theme toggle)

**Test Steps:**
1. Navigate to the home page (/)
2. Observe the background color
3. Navigate to the recipes page (/recipes)
4. Click on a recipe card to view detail
5. Navigate to calendar (/calendar)
6. Observe button colors (primary actions)
7. Observe secondary elements (badges, tags)

**Expected Result:**
- Background is warm white (not pure white)
- Primary buttons are terracotta/rust colored
- Secondary accents are sage green
- Golden/amber accents visible on "today" indicators
- Overall aesthetic feels warm, not clinical

**Verification Method:**
- Visual inspection
- DevTools: Check CSS variable `--background` is approximately `42 35% 97%` (HSL)

---

### TC-002: Color System - Dark Mode
**Feature:** Kitchen Table Color Palette - Dark Mode (Ticket 1.1)
**Priority:** Critical

**Preconditions:**
- App is in light mode initially

**Test Steps:**
1. Click the theme toggle in the header (sun/moon icon)
2. Observe the background transition to dark mode
3. Navigate to each main page (/, /recipes, /calendar, /grocery, /pantry)
4. Verify text remains readable against dark backgrounds
5. Check that accent colors (terracotta, sage) are visible but adjusted
6. Toggle back to light mode

**Expected Result:**
- Background is warm dark (not pure black)
- Text has good contrast against backgrounds
- Primary terracotta color is slightly brighter for visibility
- Shadows have subtle warm glow effect
- Transition between modes is smooth

**Verification Method:**
- Visual inspection
- DevTools: Check CSS variable `--background` in dark mode is approximately `30 15% 8%` (HSL)

---

### TC-003: Typography System
**Feature:** Custom Typography with Fraunces & DM Sans (Ticket 1.2)
**Priority:** Critical

**Preconditions:**
- App is loaded and fonts have loaded

**Test Steps:**
1. Navigate to home page (/)
2. Inspect the main heading/greeting
3. Navigate to recipes page (/recipes)
4. Observe recipe card titles
5. Navigate to a recipe detail page
6. Observe the recipe title (hero area) vs. body text
7. Look at any numbers (cook times, servings)

**Expected Result:**
- Headings use Fraunces font (distinctive serif with soft curves)
- Body text uses DM Sans (clean sans-serif)
- Numbers in times/quantities use JetBrains Mono (monospace)
- No flash of unstyled text (fonts load without layout shift)
- Clear visual hierarchy between heading levels

**Verification Method:**
- Visual inspection of font rendering
- DevTools: Inspect computed font-family on headings vs body text

---

### TC-004: Spacing and Layout Tokens
**Feature:** Consistent Spacing System (Ticket 1.3)
**Priority:** High

**Test Steps:**
1. Navigate through all main pages
2. Observe padding and margins on cards
3. Check button padding and sizes
4. Verify consistent gap spacing in grids

**Expected Result:**
- Consistent spacing throughout the app
- Cards have appropriate padding (~16-24px)
- Buttons have comfortable touch targets
- Grid gaps are uniform

**Verification Method:**
- Visual inspection for consistency
- DevTools: Check spacing uses CSS variables (--space-*)

---

### Phase 2: Core UI Components

---

### TC-005: Button Component - Variants
**Feature:** Button Redesign (Ticket 2.1)
**Priority:** High

**Preconditions:**
- Navigate to a page with multiple button types (e.g., /recipes/new)

**Test Steps:**
1. Navigate to /recipes/new (Add Recipe form)
2. Observe the primary "Save" button appearance
3. Find secondary/outline buttons
4. Hover over each button type
5. Click and hold a button (observe active state)
6. Tab to buttons to check focus state

**Expected Result:**
- Primary button: Terracotta background, white text
- Secondary button: Sage green styling
- Hover: Slight scale increase (1.02x), darker shade
- Active/Press: Scale down slightly (0.98x)
- Focus: Clear ring outline visible
- All buttons have minimum 44px height

**Verification Method:**
- Visual inspection and interaction testing
- Measure button heights in DevTools

---

### TC-006: Input Component
**Feature:** Input Redesign (Ticket 2.2)
**Priority:** High

**Test Steps:**
1. Navigate to /recipes/new
2. Observe input field styling (name, description fields)
3. Click into an input to focus it
4. Observe placeholder text styling
5. Type in the input
6. Tab between inputs

**Expected Result:**
- Inputs are 44px tall
- Border is 1.5px with warm color
- Focus state shows subtle glow (ring around input)
- Placeholder text is italic and muted
- Smooth transition on focus

**Verification Method:**
- Visual inspection
- DevTools: Check height is 44px (h-11 = 2.75rem)

---

### TC-007: Card Component Variants
**Feature:** Card Variants (Ticket 2.3)
**Priority:** High

**Test Steps:**
1. Navigate to /recipes to see recipe cards
2. Hover over a recipe card
3. Navigate to home page (/) to see dashboard cards
4. Observe different card styles (elevated, flat, interactive)

**Expected Result:**
- Cards have warm-tinted shadows
- Interactive cards lift on hover (-translate-y-0.5)
- Shadow increases on hover
- Border color may shift subtly on hover
- Elevated cards have larger shadow

**Verification Method:**
- Visual inspection of hover states
- DevTools: Check transform on hover

---

### TC-008: Badge Component
**Feature:** Badge Update (Ticket 2.4)
**Priority:** Medium

**Test Steps:**
1. Navigate to /calendar
2. Find the "This Week" or "Today" badge
3. Navigate to /recipes
4. Look at cuisine badges on recipe cards
5. Navigate to recipe detail to see difficulty/time badges

**Expected Result:**
- Badges are pill-shaped (fully rounded)
- "Today" badge has golden/saffron color with subtle pulse
- Other badges use appropriate color variants
- Text is uppercase with letter-spacing
- Font size is smaller (11px overline style)

**Verification Method:**
- Visual inspection

---

### TC-009: Dialog/Modal
**Feature:** Dialog Redesign (Ticket 2.5)
**Priority:** Medium

**Test Steps:**
1. Navigate to /pantry
2. Click "Add Item" to open the pantry item form dialog
3. Observe the dialog appearance
4. Check the overlay (background dimming)
5. Close the dialog

**Expected Result:**
- Dialog has larger border radius (16px)
- Overlay has warm tint with backdrop blur
- Open animation is smooth (scale + fade)
- Padding is 24px
- Close animation is smooth

**Verification Method:**
- Visual inspection and interaction

---

### Phase 3: Layout Components

---

### TC-010: Header
**Feature:** Header Redesign (Ticket 3.1)
**Priority:** High

**Test Steps:**
1. View the app header on desktop (> 768px width)
2. Check the logo/app name on the left
3. View header on mobile (< 768px width)
4. Scroll down a page with content and observe header behavior
5. Click the theme toggle

**Expected Result:**
- Desktop header height: 64px
- Mobile header height: 56px
- Logo shows fork/knife icon (Utensils) in terracotta
- App name "Meal Planner" in Fraunces font
- Backdrop blur on scroll
- Theme toggle has sun/moon animation

**Verification Method:**
- Visual inspection
- DevTools: Check header height

---

### TC-011: Desktop Navigation (Sidebar)
**Feature:** Desktop Navigation Redesign (Ticket 3.2)
**Priority:** High

**Preconditions:**
- View on desktop (width > 768px)

**Test Steps:**
1. Observe the left sidebar navigation
2. Check the greeting at the top
3. Click on each navigation item
4. Observe active state styling
5. Check hover states on nav items

**Expected Result:**
- Sidebar has warm tinted background
- Greeting shows time-appropriate message (Good morning/afternoon/evening)
- Active nav item has pill shape with primary tint
- Hover shows subtle background change
- Icons are consistently 20px
- Settings has divider above it

**Verification Method:**
- Visual inspection

---

### TC-012: Mobile Navigation (Bottom Bar)
**Feature:** Mobile Navigation Redesign (Ticket 3.3)
**Priority:** High

**Preconditions:**
- View on mobile (width < 768px) or use DevTools responsive mode

**Test Steps:**
1. Resize browser to mobile width (< 768px)
2. Observe the bottom navigation bar
3. Check which icon is currently active
4. Tap on different navigation items
5. Observe the tap animation

**Expected Result:**
- Nav bar is 64px tall + safe area
- Active item shows filled icon (not outline)
- Active item has dot indicator below icon
- Inactive items show outlined icons
- Tap animation provides spring feedback (scale-95)
- Background is card color

**Verification Method:**
- Visual inspection in responsive mode
- Check for dot indicator on active item

---

### Phase 4: Recipe Components

---

### TC-013: Recipe Card
**Feature:** Recipe Card Redesign (Ticket 4.1)
**Priority:** High

**Preconditions:**
- At least 2-3 recipes exist in the system

**Test Steps:**
1. Navigate to /recipes
2. Observe recipe card layout
3. Check cards with and without images
4. Hover over a recipe card
5. Click the heart/favorite icon
6. Unfavorite and favorite again

**Expected Result:**
- Cards are 3:4 portrait aspect ratio
- Image area (or gradient placeholder) covers top portion
- Gradient overlay at bottom for title readability
- Title positioned at bottom over gradient
- Cook time chip visible
- Cuisine badge shows
- Hover: Card lifts with shadow increase
- Favorite animation: Heart pops with scale bounce

**Verification Method:**
- Visual inspection
- Check aspect ratio in DevTools

---

### TC-014: Recipe Grid Layout
**Feature:** Recipe Grid (Ticket 4.2)
**Priority:** Medium

**Preconditions:**
- Multiple recipes in system

**Test Steps:**
1. Navigate to /recipes
2. Check the grid layout at different widths:
   - Mobile (< 640px): 1 column
   - Small (640-1023px): 2 columns
   - Large (1024-1279px): 3 columns
   - XL (> 1280px): 4 columns
3. Observe loading skeleton if slow connection
4. Check recipe count display in header

**Expected Result:**
- Grid is responsive with correct column counts
- Consistent gap spacing between cards
- Loading skeletons have shimmer animation
- Recipe count shown (e.g., "12 recipes")

**Verification Method:**
- Resize browser and count columns
- DevTools Network throttling for skeleton

---

### TC-015: Recipe Form
**Feature:** Recipe Form Improvements (Ticket 4.3)
**Priority:** Medium

**Test Steps:**
1. Navigate to /recipes/new
2. Observe card section styling
3. Check section headers (Basic Info, Ingredients, Instructions, Tags)
4. Add an ingredient row
5. Hover over an ingredient row
6. Click difficulty selector buttons
7. Fill out form and observe validation

**Expected Result:**
- Card sections have elevated styling
- Headers use Fraunces font
- Ingredient rows have column headers on desktop
- Trash icon fades in on row hover
- Difficulty buttons show clear selected state with shadow
- Form spacing is comfortable (space-y-8)
- Quantity inputs use monospace font

**Verification Method:**
- Visual inspection and interaction

---

### TC-016: Recipe Detail Page
**Feature:** Recipe Detail Page (Ticket 4.4)
**Priority:** High

**Preconditions:**
- At least one recipe exists

**Test Steps:**
1. Navigate to /recipes
2. Click on a recipe to view detail (/recipes/[id])
3. Observe the hero area at top
4. Check meta chips (time, servings, difficulty)
5. Scroll to ingredients section
6. Click ingredient checkboxes
7. Check instruction steps layout
8. On mobile: Check sticky action bar at bottom

**Expected Result:**
- Hero area has cuisine-specific gradient background
- Large emoji decorates hero
- Title over gradient at bottom
- Meta chips show with distinct icons/colors
- Difficulty chip color-coded (green/yellow/red)
- Ingredients have checkboxes with progress counter
- Instructions have large numbered circles
- Mobile: Sticky bar with favorite/edit/"Add to Plan"

**Verification Method:**
- Visual inspection at desktop and mobile widths

---

### Phase 5: Calendar Components

---

### TC-017: Week Grid - Desktop
**Feature:** Week Grid Redesign (Ticket 5.1)
**Priority:** High

**Preconditions:**
- View on desktop width (> 768px)
- Some meals planned for the week

**Test Steps:**
1. Navigate to /calendar
2. Observe the week navigation controls
3. Click previous/next week arrows
4. Click "Today" button
5. Observe the day column headers
6. Check today's column highlighting
7. Observe meal type labels (Breakfast, Lunch, Dinner)

**Expected Result:**
- Week nav buttons are large (40px)
- "Today" button has calendar icon
- Week heading uses Fraunces font
- "This Week" badge uses golden "today" variant with pulse
- Day headers: Large day name, monospace date below
- Today's column has primary/5 background tint
- Meal type labels are bold with tracking

**Verification Method:**
- Visual inspection

---

### TC-018: Meal Slot
**Feature:** Meal Slot Redesign (Ticket 5.2)
**Priority:** High

**Test Steps:**
1. Navigate to /calendar
2. Find an empty meal slot
3. Hover over empty slot
4. Find a filled meal slot
5. Hover over filled slot to see drag handle
6. Find or create special slots (dining out, skip, leftovers if possible)

**Expected Result:**
- Empty slots: Dashed border, primary tint, + icon centered
- Empty hover: Border darkens, background intensifies, icon scales up
- Filled slots: Compact card with thumbnail (56x56)
- Drag handle appears on hover (GripVertical icon)
- Special slots have distinct colors:
  - Dining out: Amber
  - Skip: Slate
  - Leftovers: Emerald

**Verification Method:**
- Visual inspection and hover interaction

---

### TC-019: Mobile Calendar View
**Feature:** Mobile Calendar (Ticket 5.3)
**Priority:** High

**Preconditions:**
- View on mobile width (< 768px)

**Test Steps:**
1. Navigate to /calendar on mobile
2. Observe horizontal date picker at top
3. Tap on different days
4. Try swiping left/right to change days
5. Check the FAB (floating action button) in bottom right
6. Observe the day indicator dots at bottom

**Expected Result:**
- Horizontal date picker with 7 day buttons
- Selected day has primary styling with shadow
- Today indicator dot when not selected
- Swipe gesture changes days (50px threshold)
- Single day view shows meals vertically
- FAB is 56px, primary color, bottom-right
- Pagination dots show current position

**Verification Method:**
- Visual inspection in mobile responsive mode
- Test swipe on touch device or DevTools touch simulation

---

### Phase 6: Grocery & Pantry

---

### TC-020: Grocery List
**Feature:** Grocery List Redesign (Ticket 6.1)
**Priority:** Medium

**Preconditions:**
- Generate a grocery list from meal plan, or have items existing

**Test Steps:**
1. Navigate to /grocery
2. Observe the header with progress visualization
3. Check week selector styling
4. Observe category sections (Produce, Protein, etc.)
5. Note the colored left border on categories
6. Check category icons
7. Click to collapse/expand a category
8. Check off some items

**Expected Result:**
- Progress bar shows visual completion
- Week selector has rounded-full styling
- Categories have colored left border (border-l-4)
- Each category has distinct icon (Leaf, Beef, Milk, etc.)
- Accordion animation is smooth
- Category icon has matching color background
- Items have large checkboxes (28px -> now 44px for touch)

**Verification Method:**
- Visual inspection and interaction

---

### TC-021: Grocery Item Interaction
**Feature:** Grocery Item (Ticket 6.1)
**Priority:** Medium

**Test Steps:**
1. Navigate to /grocery with items
2. Observe unchecked item styling
3. Click checkbox to check an item
4. Observe the animation on check
5. Check quantity display

**Expected Result:**
- Checkboxes are 44px for good touch target
- Check animation: Scale bounce, zoom-in icon
- Checked items use success color
- Quantity in subtle badge with monospace font
- Hover state on unchecked items

**Verification Method:**
- Visual inspection and interaction

---

### TC-022: Shopping Mode
**Feature:** Shopping Mode Enhancement (Ticket 6.2)
**Priority:** Low

**Test Steps:**
1. Navigate to /grocery
2. Find and click "Shopping Mode" button
3. Observe the full-screen interface
4. Check text and checkbox sizes
5. Check off all items if possible
6. Observe completion celebration

**Expected Result:**
- Full-screen high-contrast mode
- Larger text and checkboxes (for in-store use)
- Category navigation available
- Completion triggers celebration animation

**Verification Method:**
- Visual inspection

---

### TC-023: Pantry List
**Feature:** Pantry Improvements (Ticket 6.3)
**Priority:** Low

**Test Steps:**
1. Navigate to /pantry
2. Observe heading typography
3. Check "Expiring Soon" section if items exist
4. Check category sections with colored borders
5. Observe item cards
6. Click to edit/delete an item
7. Add a new item via dialog

**Expected Result:**
- "Pantry" heading uses Fraunces font
- Category sections have Cards with colored left border
- Category icons match grocery (Leaf, Beef, etc.)
- Item count badges on categories
- Items have 44px action buttons on mobile
- Quantity uses monospace font
- Add/Edit dialog uses new typography

**Verification Method:**
- Visual inspection

---

### Phase 7: Dashboard

---

### TC-024: Dashboard Home Page
**Feature:** Dashboard Redesign (Ticket 7.1)
**Priority:** High

**Test Steps:**
1. Navigate to home page (/)
2. Check the time-based greeting
3. Observe "Today's Meals" horizontal scroll widget
4. Scroll the widget horizontally if multiple meals
5. Check quick action tiles (2x2 grid)
6. Hover over action tiles
7. Check week overview with progress bar

**Expected Result:**
- Greeting changes based on time:
  - Morning: Sun icon, "Good morning"
  - Afternoon: Sunset icon, "Good afternoon"
  - Evening: Moon icon, "Good evening"
- Today's meals in horizontal scroll with snap
- Quick actions: 4 large tiles (Plan, Add Recipe, Grocery, Browse)
- Each tile has distinct color, icon, title, description
- Tiles have spring hover animation
- Week overview: Progress bar + day indicators
- Today highlighted with ring

**Verification Method:**
- Visual inspection at different times of day (or modify system time)

---

### Phase 8: Animation & Polish

---

### TC-025: Micro-interactions
**Feature:** Micro-interactions (Ticket 8.1)
**Priority:** Medium

**Test Steps:**
1. Hover over various buttons throughout the app
2. Click/press buttons and observe feedback
3. Hover over cards
4. Check checkboxes in ingredients or grocery
5. Observe drag states in calendar (if testing drag)

**Expected Result:**
- Buttons: hover scale 1.02x, active scale 0.98x
- Cards: hover lift (-translate-y-0.5) + shadow increase
- Checkboxes: Smooth transition, scale bounce on check
- Drag states: Scale 1.02x, ring-2 outline
- All animations at 60fps (smooth)

**Verification Method:**
- Visual inspection and feel

---

### TC-026: Loading States (Skeletons)
**Feature:** Loading & Empty States (Ticket 8.2)
**Priority:** Medium

**Test Steps:**
1. Throttle network in DevTools (Slow 3G)
2. Navigate to /recipes and observe loading
3. Navigate to /calendar and observe loading
4. Clear browser cache and reload pages

**Expected Result:**
- Skeleton elements have shimmer animation
- Shimmer moves left to right
- Skeleton shapes match content layout
- No layout shift when content loads

**Verification Method:**
- DevTools Network throttling

---

### TC-027: Empty States
**Feature:** Empty States (Ticket 8.2)
**Priority:** Medium

**Preconditions:**
- Clear data or test with empty states

**Test Steps:**
1. View empty recipes page (if no recipes)
2. View empty grocery list (if no items)
3. View empty pantry (if no items)
4. Check messaging and CTAs

**Expected Result:**
- Empty states have rounded icon containers
- Headings use Fraunces font
- Friendly, inviting copy
- Clear CTAs with relevant actions
- Visual is helpful, not sad

**Verification Method:**
- Visual inspection (may need to clear data)

---

### TC-028: Page Transitions
**Feature:** Page Transitions (Ticket 8.3)
**Priority:** Low

**Test Steps:**
1. Navigate between pages using the navigation
2. Observe the transition as page changes
3. Navigate quickly between pages

**Expected Result:**
- Fade + slide up transition (opacity + translateY)
- Duration ~150ms
- No jarring content jumps
- No layout shift during transition

**Verification Method:**
- Visual inspection of navigation

---

### TC-029: Dark Mode Consistency
**Feature:** Dark Mode Refinement (Ticket 8.4)
**Priority:** Medium

**Test Steps:**
1. Switch to dark mode
2. Navigate through ALL pages:
   - Home (/)
   - Recipes (/recipes)
   - Recipe detail (/recipes/[id])
   - Recipe form (/recipes/new)
   - Calendar (/calendar)
   - Grocery (/grocery)
   - Pantry (/pantry)
   - Settings (/settings)
3. Check for any elements that look wrong
4. Check button visibility
5. Check badge visibility
6. Check shadows

**Expected Result:**
- All pages maintain warm dark aesthetic
- No elements with poor contrast
- Buttons and badges are visible
- Shadows have subtle warm glow (not pure black)
- Text is readable throughout
- No visual bugs

**Verification Method:**
- Thorough visual inspection in dark mode

---

### Phase 9: Accessibility & Responsiveness

---

### TC-030: Keyboard Navigation
**Feature:** Accessibility (Ticket 9.1)
**Priority:** Critical

**Test Steps:**
1. Start at home page, press Tab repeatedly
2. Navigate through all interactive elements
3. Verify focus is always visible
4. Press Enter/Space to activate buttons
5. Use Tab to navigate forms
6. Use Escape to close dialogs

**Expected Result:**
- All interactive elements are focusable
- Focus ring (ring-2) is always visible
- Logical tab order
- Buttons activate with Enter/Space
- Form inputs are accessible
- Dialogs trap focus and close with Escape

**Verification Method:**
- Keyboard-only navigation testing

---

### TC-031: Screen Reader Basics
**Feature:** Accessibility (Ticket 9.1)
**Priority:** High

**Test Steps:**
1. Use screen reader or browser accessibility tree
2. Check navigation has aria-label
3. Check buttons have aria-label or visible text
4. Check form inputs have labels
5. Check images/icons have alt text or aria-hidden

**Expected Result:**
- Navigation announced correctly
- Icon-only buttons have aria-label
- Form labels properly associated
- Decorative icons hidden from AT
- Dialogs have proper title/description

**Verification Method:**
- DevTools Accessibility panel
- Screen reader testing (VoiceOver/NVDA)

---

### TC-032: Reduced Motion
**Feature:** Accessibility (Ticket 9.1)
**Priority:** Medium

**Preconditions:**
- Enable "Reduce motion" in OS accessibility settings

**Test Steps:**
1. Enable reduced motion preference
2. Navigate through the app
3. Hover over buttons and cards
4. Check page transitions
5. Check checkbox animations

**Expected Result:**
- Animations are disabled or minimal
- No transform-based hover effects
- Essential feedback preserved via opacity
- App remains usable and pleasant

**Verification Method:**
- System accessibility settings
- Check @media (prefers-reduced-motion) behavior

---

### TC-033: Responsive Breakpoints
**Feature:** Responsive Testing (Ticket 9.2)
**Priority:** High

**Test Steps:**
1. Test at 375px width (mobile)
2. Test at 640px width (sm breakpoint)
3. Test at 768px width (md breakpoint)
4. Test at 1024px width (lg breakpoint)
5. Test at 1280px width (xl breakpoint)
6. Check for horizontal overflow at each

**Expected Result:**
- No horizontal scrollbar at any width
- Layout adapts appropriately
- Navigation switches desktop/mobile at 768px
- Recipe grid columns adjust correctly
- All content accessible at all widths

**Verification Method:**
- DevTools responsive mode at each width

---

### TC-034: Touch Targets
**Feature:** Responsive Testing (Ticket 9.2)
**Priority:** High

**Test Steps:**
1. View on mobile (< 768px)
2. Check button sizes (should be 44px min)
3. Check checkbox sizes in grocery/ingredients
4. Check navigation tap targets
5. Check filter chip remove buttons
6. Check dialog close buttons

**Expected Result:**
- All interactive elements are 44px or larger
- Easy to tap without mis-taps
- Adequate spacing between targets
- Mobile nav items are easily tappable

**Verification Method:**
- DevTools measure element sizes
- Test on actual mobile device if possible

---

## Edge Cases and Error Handling

---

### EC-001: Very Long Recipe Name
**Feature:** Text Overflow
**Priority:** Low

**Test Steps:**
1. Create recipe with very long name (50+ characters)
2. View in recipe card
3. View in recipe detail
4. View in meal slot

**Expected Result:**
- Text truncates appropriately with ellipsis
- No layout breaking
- Full title visible on detail page

---

### EC-002: No Recipes in System
**Feature:** Empty State
**Priority:** Medium

**Test Steps:**
1. Delete all recipes or test on fresh install
2. Navigate to /recipes
3. Navigate to /calendar
4. Check grocery list generation

**Expected Result:**
- Recipes page shows friendly empty state
- Calendar shows empty slots (not broken)
- Grocery shows empty state with helpful CTA
- No errors in console

---

### EC-003: Large Number of Recipes
**Feature:** Performance
**Priority:** Medium

**Test Steps:**
1. Add 50+ recipes if possible
2. Navigate to /recipes
3. Scroll through the grid
4. Test filtering

**Expected Result:**
- Page loads without excessive delay
- Scrolling is smooth (60fps)
- Filtering is responsive
- No memory issues

---

### EC-004: Rapid Theme Toggling
**Feature:** Theme Transition
**Priority:** Low

**Test Steps:**
1. Click theme toggle rapidly 10+ times
2. Observe for any glitches or stuck states

**Expected Result:**
- Theme transitions correctly each time
- No visual glitches
- Final state matches last click
- No console errors

---

## Summary

- **Total Test Cases:** 34 (30 main + 4 edge cases)
- **Critical:** 4 (TC-001, TC-002, TC-003, TC-030)
- **High:** 16 (TC-004, TC-005, TC-006, TC-007, TC-010, TC-011, TC-012, TC-013, TC-016, TC-017, TC-018, TC-019, TC-024, TC-031, TC-033, TC-034)
- **Medium:** 11 (TC-008, TC-009, TC-014, TC-015, TC-020, TC-021, TC-025, TC-026, TC-027, TC-029, TC-032)
- **Low:** 3 (TC-022, TC-023, TC-028)

---

## Test Execution Notes

- Execute test cases in order (Critical first, then High, Medium, Low)
- For UI tests, visual inspection is the primary verification method
- Use DevTools responsive mode for mobile testing
- Network throttling required for loading state tests
- Take screenshots of any failures
