# QA Documentation

Quality assurance test plans and reports organized by testing scope.

## Structure

```
docs/qa/
├── cli-backend/     # CLI and backend API testing
│   ├── TEST_PLAN.md
│   └── REPORT.md
├── ui-pwa/          # Original PWA/Web UI testing
│   └── TEST_PLAN.md
└── ui-v2/           # UI V2 "Modern Kitchen Journal" redesign
    ├── TEST_PLAN.md
    └── REPORT.md
```

## Scopes

### cli-backend
Tests for the command-line interface and backend API functionality:
- Recipe CRUD operations
- Meal planning workflows
- Grocery list generation
- Pantry management
- API endpoints

### ui-pwa
Tests for the original Progressive Web App UI implementation:
- Core UI workflows (U001-U025)
- Basic user interactions

### ui-v2
Tests for the UI V2 redesign with "Modern Kitchen Journal" aesthetic:
- Design foundation (colors, typography, spacing)
- Core UI components
- Layout components
- Recipe, calendar, grocery, pantry pages
- Dark mode and responsive design
- Accessibility

## Adding New Test Scopes

When creating a new test scope:

1. Create a new directory: `docs/qa/<scope-name>/`
2. Add `TEST_PLAN.md` with test cases
3. After execution, add `REPORT.md` with results

## File Naming Convention

- `TEST_PLAN.md` - Test plan document with test cases
- `REPORT.md` - Execution report with results
