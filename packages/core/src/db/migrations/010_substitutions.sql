-- 010_substitutions.sql
-- Add ingredient substitution engine for suggesting alternatives

-- Create substitutions table
CREATE TABLE substitutions (
  id TEXT PRIMARY KEY,
  original_ingredient TEXT NOT NULL,
  substitute_ingredients TEXT NOT NULL,
  substitute_description TEXT,
  dietary_tags TEXT,  -- JSON array like '["gluten-free", "vegan"]'
  is_user_defined INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Create index for fast lookup by ingredient name (case-insensitive search via LOWER)
CREATE INDEX idx_substitutions_original ON substitutions(original_ingredient);

-- Seed common substitutions
-- Format: id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined

-- Gluten-free substitutions
INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-001', 'soy sauce', 'tamari', 'Use equal amount of tamari for a gluten-free alternative', '["gluten-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-002', 'soy sauce', 'coconut aminos', 'Use equal amount; slightly sweeter and lower sodium', '["gluten-free", "soy-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-003', 'all-purpose flour', 'almond flour', 'Use 1:1 ratio; adds nutty flavor and protein', '["gluten-free", "grain-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-004', 'all-purpose flour', 'oat flour', 'Use 1:1 ratio; slightly denser texture', '["gluten-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-005', 'breadcrumbs', 'crushed gluten-free crackers', 'Process crackers until fine crumbs', '["gluten-free"]', 0);

-- Dairy-free substitutions
INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-006', 'butter', 'coconut oil', 'Use equal amount; adds subtle coconut flavor', '["vegan", "dairy-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-007', 'butter', 'olive oil', 'Use 3/4 amount; works best for savory dishes', '["vegan", "dairy-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-008', 'milk', 'almond milk', 'Use equal amount; unsweetened for savory dishes', '["dairy-free", "vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-009', 'milk', 'oat milk', 'Use equal amount; creamier texture than almond milk', '["dairy-free", "vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-010', 'milk', 'coconut milk', 'Use equal amount; adds richness and slight coconut flavor', '["dairy-free", "vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-011', 'heavy cream', 'coconut cream', 'Use equal amount; works great in curries and desserts', '["dairy-free", "vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-012', 'heavy cream', 'cashew cream', 'Blend soaked cashews with water until smooth', '["dairy-free", "vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-013', 'sour cream', 'coconut yogurt', 'Use equal amount; slightly sweeter', '["dairy-free", "vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-014', 'cream cheese', 'cashew cream cheese', 'Use equal amount; similar texture and tanginess', '["dairy-free", "vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-015', 'parmesan cheese', 'nutritional yeast', 'Use 2 tbsp nutritional yeast per 1/4 cup parmesan; adds umami flavor', '["dairy-free", "vegan"]', 0);

-- Vegan substitutions
INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-016', 'eggs', 'flax egg', '1 tbsp ground flax + 3 tbsp water, let sit 5 minutes; works for baking', '["vegan", "egg-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-017', 'eggs', 'chia egg', '1 tbsp chia seeds + 3 tbsp water, let sit 5 minutes; works for baking', '["vegan", "egg-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-018', 'eggs', 'mashed banana', '1/4 cup mashed banana per egg; adds sweetness, best for sweet recipes', '["vegan", "egg-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-019', 'eggs', 'applesauce', '1/4 cup unsweetened applesauce per egg; works for moist baked goods', '["vegan", "egg-free"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-020', 'honey', 'maple syrup', 'Use equal amount; slightly different flavor profile', '["vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-021', 'honey', 'agave nectar', 'Use equal amount; sweeter than honey, use slightly less', '["vegan"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-022', 'chicken broth', 'vegetable broth', 'Use equal amount; lighter flavor', '["vegan", "vegetarian"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-023', 'beef broth', 'mushroom broth', 'Use equal amount; adds umami depth', '["vegan", "vegetarian"]', 0);

-- Spice blends
INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-024', 'Lebanese 7 Spice', 'cumin, coriander, paprika, black pepper, cinnamon, allspice, cloves', 'Mix equal parts of each spice; adjust to taste', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-025', 'garam masala', 'cumin, coriander, cardamom, cinnamon, cloves', 'Mix 2 parts cumin, 2 parts coriander, 1 part each cardamom, cinnamon, cloves', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-026', 'Italian seasoning', 'basil, oregano, thyme, rosemary', 'Mix equal parts of dried herbs', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-027', 'herbes de Provence', 'thyme, rosemary, oregano, marjoram, lavender', 'Mix equal parts; lavender optional', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-028', 'taco seasoning', 'chili powder, cumin, paprika, oregano, garlic powder, onion powder', 'Mix 2 parts chili powder, 1 part cumin, 1/2 part each of the rest', '[]', 0);

-- Fish sauce alternatives
INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-029', 'fish sauce', 'soy sauce + lime juice', 'Mix 1 tbsp soy sauce with 1/2 tsp lime juice per tbsp fish sauce', '["vegetarian"]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-030', 'fish sauce', 'coconut aminos + seaweed', 'Add a small piece of nori to coconut aminos for umami', '["vegan", "vegetarian"]', 0);

-- Common ingredient swaps
INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-031', 'lemon juice', 'lime juice', 'Use equal amount; slightly different citrus profile', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-032', 'lemon juice', 'white wine vinegar', 'Use half the amount; adds acidity without citrus flavor', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-033', 'white wine', 'chicken broth + lemon juice', 'Use equal amount broth with splash of lemon', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-034', 'red wine', 'beef broth + red wine vinegar', 'Use equal amount broth with splash of vinegar', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-035', 'buttermilk', 'milk + lemon juice', 'Add 1 tbsp lemon juice to 1 cup milk, let sit 5 minutes', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-036', 'buttermilk', 'milk + white vinegar', 'Add 1 tbsp vinegar to 1 cup milk, let sit 5 minutes', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-037', 'Greek yogurt', 'sour cream', 'Use equal amount; slightly higher fat content', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-038', 'mayonnaise', 'Greek yogurt', 'Use equal amount; lighter with more tang', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-039', 'ricotta cheese', 'cottage cheese', 'Blend until smooth for similar texture', '[]', 0);

INSERT INTO substitutions (id, original_ingredient, substitute_ingredients, substitute_description, dietary_tags, is_user_defined)
VALUES ('sub-040', 'fresh herbs', 'dried herbs', 'Use 1/3 amount of dried herbs; less flavorful but works', '[]', 0);
