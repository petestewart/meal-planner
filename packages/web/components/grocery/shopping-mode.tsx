'use client';

import * as React from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  X,
  ShoppingBag,
  Leaf,
  Beef,
  Milk,
  Wheat,
  Flame,
  Snowflake,
  Package,
  Fish,
  Croissant,
  UtensilsCrossed,
  Droplets,
  Cookie,
  CircleDot,
  LucideIcon,
  PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GroceryItem as GroceryItemType, GroceryItemStatus } from '@/types/api';
import { useUpdateGroceryItem } from '@/lib/queries';
import { cn } from '@/lib/utils';

// ==================== Category Utilities ====================

/**
 * Get display name for category
 */
function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    produce: 'Produce',
    dairy: 'Dairy',
    proteins: 'Proteins',
    meat: 'Proteins',
    protein: 'Proteins',
    seafood: 'Seafood',
    bakery: 'Bakery',
    frozen: 'Frozen',
    pantry: 'Pantry',
    canned: 'Canned',
    condiments: 'Condiments',
    spices: 'Spices',
    beverages: 'Beverages',
    snacks: 'Snacks',
    grains: 'Grains',
    pasta: 'Pasta',
    oils: 'Oils',
    other: 'Other',
  };

  const lower = category.toLowerCase();
  return categoryMap[lower] || category;
}

/**
 * Get the category icon component
 */
function getCategoryIconComponent(category: string): LucideIcon {
  const categoryMap: Record<string, LucideIcon> = {
    produce: Leaf,
    dairy: Milk,
    proteins: Beef,
    meat: Beef,
    protein: Beef,
    seafood: Fish,
    bakery: Croissant,
    frozen: Snowflake,
    pantry: Package,
    canned: Package,
    condiments: Droplets,
    spices: Flame,
    beverages: Droplets,
    snacks: Cookie,
    grains: Wheat,
    pasta: UtensilsCrossed,
    oils: Droplets,
    other: CircleDot,
  };

  const lower = category.toLowerCase();
  return categoryMap[lower] || CircleDot;
}

/**
 * Get the background color class for a category in shopping mode
 */
function getCategoryBgColor(category: string): string {
  const categoryMap: Record<string, string> = {
    produce: 'bg-category-produce/20',
    dairy: 'bg-category-dairy/30',
    proteins: 'bg-category-protein/20',
    meat: 'bg-category-protein/20',
    protein: 'bg-category-protein/20',
    seafood: 'bg-category-frozen/20',
    frozen: 'bg-category-frozen/20',
    pantry: 'bg-category-pantry/20',
    canned: 'bg-category-pantry/20',
    spices: 'bg-category-spices/20',
    grains: 'bg-category-grains/20',
    bakery: 'bg-category-grains/20',
    pasta: 'bg-category-grains/20',
  };

  const lower = category.toLowerCase();
  return categoryMap[lower] || 'bg-muted/30';
}

/**
 * Get the icon color class for a category
 */
function getCategoryIconColor(category: string): string {
  const categoryMap: Record<string, string> = {
    produce: 'text-category-produce',
    dairy: 'text-category-dairy',
    proteins: 'text-category-protein',
    meat: 'text-category-protein',
    protein: 'text-category-protein',
    seafood: 'text-category-frozen',
    frozen: 'text-category-frozen',
    pantry: 'text-category-pantry',
    canned: 'text-category-pantry',
    spices: 'text-category-spices',
    grains: 'text-category-grains',
    bakery: 'text-category-grains',
    pasta: 'text-category-grains',
  };

  const lower = category.toLowerCase();
  return categoryMap[lower] || 'text-muted-foreground';
}

// ==================== Shopping Mode Item ====================

interface ShoppingItemProps {
  item: GroceryItemType;
  week: string;
}

/**
 * Format quantity with unit for display
 */
function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return '';
  const unitStr = unit ? ` ${unit}` : '';
  if (quantity === 0.5) return `1/2${unitStr}`;
  if (quantity === 0.25) return `1/4${unitStr}`;
  if (quantity === 0.75) return `3/4${unitStr}`;
  if (quantity === 0.33 || quantity === 0.333) return `1/3${unitStr}`;
  if (quantity === 0.67 || quantity === 0.666) return `2/3${unitStr}`;
  const numStr = Number.isInteger(quantity) ? quantity.toString() : quantity.toFixed(1);
  return `${numStr}${unitStr}`;
}

/**
 * Shopping mode item with extra-large touch target and high-contrast design
 * Optimized for in-store use on mobile devices
 */
export function ShoppingItem({ item, week }: ShoppingItemProps) {
  const updateItem = useUpdateGroceryItem();
  const [justChecked, setJustChecked] = React.useState(false);

  const handleToggle = () => {
    // Simple toggle between need_to_buy and already_have
    const nextStatus: GroceryItemStatus =
      item.status === 'already_have' ? 'need_to_buy' : 'already_have';

    // Trigger check animation when checking off
    if (nextStatus === 'already_have') {
      setJustChecked(true);
      setTimeout(() => setJustChecked(false), 500);
    }

    updateItem.mutate({
      week,
      itemId: item.id,
      input: {
        status: nextStatus,
        haveQuantity: nextStatus === 'need_to_buy' ? null : item.quantity,
      },
    });
  };

  const isChecked = item.status === 'already_have';

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={updateItem.isPending}
      className={cn(
        // Extra-large touch target (minimum 64px for in-store use)
        'flex w-full items-center gap-5 rounded-2xl p-5 min-h-[72px]',
        'transition-all duration-200 ease-out',
        'focus:outline-none focus:ring-4 focus:ring-primary/50 focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'active:scale-[0.98]',
        isChecked
          ? 'bg-success/15 border-3 border-success/40'
          : 'bg-card border-3 border-border shadow-md hover:border-primary/50 hover:shadow-lg'
      )}
      aria-label={`${isChecked ? 'Uncheck' : 'Check'} ${item.name}`}
    >
      {/* Extra-large checkbox (40px) for easy touch */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-3 transition-all duration-200',
          isChecked
            ? 'border-success bg-success text-success-foreground'
            : 'border-muted-foreground/50 bg-background',
          justChecked && 'animate-check-bounce'
        )}
      >
        {isChecked && <Check className="h-7 w-7" strokeWidth={3} />}
      </div>

      {/* Item content - larger text */}
      <div className="flex-1 text-left">
        <span
          className={cn(
            'text-xl font-semibold leading-tight',
            isChecked && 'text-success line-through decoration-2'
          )}
        >
          {item.name}
        </span>
      </div>

      {/* Quantity - larger and more prominent */}
      {item.quantity !== null && (
        <span
          className={cn(
            'shrink-0 text-lg font-bold tabular-nums px-3 py-1 rounded-lg',
            isChecked
              ? 'text-success/70 bg-success/10'
              : 'text-foreground bg-muted/50'
          )}
        >
          {formatQuantity(item.quantity, item.unit)}
        </span>
      )}
    </button>
  );
}

// ==================== Shopping Mode Category ====================

interface ShoppingCategoryProps {
  category: string;
  items: GroceryItemType[];
  week: string;
  defaultOpen?: boolean;
}

/**
 * Collapsible category section for shopping mode
 * Features category icons and colors for easy identification
 */
export function ShoppingCategory({
  category,
  items,
  week,
  defaultOpen = true,
}: ShoppingCategoryProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  const displayName = getCategoryDisplayName(category);
  const IconComponent = getCategoryIconComponent(category);
  const bgColor = getCategoryBgColor(category);
  const iconColor = getCategoryIconColor(category);
  const uncheckedCount = items.filter((i) => i.status !== 'already_have').length;

  // Only show items that need to be bought (filter out already_have)
  const activeItems = items.filter((i) => i.status !== 'already_have');

  // If all items in this category are checked, don't show it
  if (activeItems.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl overflow-hidden shadow-md" id={`category-${category.toLowerCase()}`}>
      {/* Category header - large touch target with icon */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between p-5 min-h-[64px]',
          bgColor,
          'hover:brightness-95 transition-all duration-200',
          'focus:outline-none focus:ring-4 focus:ring-inset focus:ring-primary/50'
        )}
        aria-expanded={isOpen}
        aria-controls={`category-content-${category}`}
      >
        <div className="flex items-center gap-4">
          {/* Category Icon */}
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/80', iconColor)}>
            <IconComponent className="h-7 w-7" />
          </div>
          <span className="text-xl font-bold uppercase tracking-wide">
            {displayName}
          </span>
          <Badge variant="secondary" className="text-base font-bold px-3 py-1">
            {uncheckedCount}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="h-8 w-8 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-8 w-8 text-muted-foreground" />
        )}
      </button>

      {/* Category items */}
      {isOpen && (
        <div
          id={`category-content-${category}`}
          className="flex flex-col gap-3 p-4 bg-background/50"
        >
          {activeItems.map((item) => (
            <ShoppingItem key={item.id} item={item} week={week} />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Celebration Animation ====================

interface ConfettiProps {
  show: boolean;
}

/**
 * Confetti celebration animation component
 */
function Confetti({ show }: ConfettiProps) {
  const [particles, setParticles] = React.useState<Array<{
    id: number;
    x: number;
    delay: number;
    color: string;
    size: number;
  }>>([]);

  React.useEffect(() => {
    if (show) {
      const colors = [
        'bg-success',
        'bg-primary',
        'bg-accent',
        'bg-category-produce',
        'bg-category-protein',
        'bg-category-dairy',
      ];
      const newParticles = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
      }));
      setParticles(newParticles);
    } else {
      setParticles([]);
    }
  }, [show]);

  if (!show || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={cn(
            particle.color,
            'absolute rounded-full animate-confetti-fall'
          )}
          style={{
            left: `${particle.x}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ==================== Shopping Mode View ====================

interface ShoppingModeViewProps {
  items: GroceryItemType[];
  week: string;
  onExit: () => void;
}

/**
 * Group items by their category
 */
function groupByCategory(items: GroceryItemType[]): Map<string, GroceryItemType[]> {
  const groups = new Map<string, GroceryItemType[]>();

  for (const item of items) {
    const category = item.category || 'Other';
    const existing = groups.get(category) || [];
    existing.push(item);
    groups.set(category, existing);
  }

  return groups;
}

/**
 * Custom hook for Wake Lock API
 * Keeps screen awake while shopping mode is active
 */
function useWakeLock() {
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null);
  const [isSupported, setIsSupported] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);

  React.useEffect(() => {
    setIsSupported('wakeLock' in navigator);
  }, []);

  const request = React.useCallback(async () => {
    if (!isSupported || wakeLockRef.current) return;

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setIsActive(true);

      wakeLockRef.current.addEventListener('release', () => {
        setIsActive(false);
        wakeLockRef.current = null;
      });
    } catch (err) {
      // Wake lock request failed (e.g., low battery, tab not visible)
      console.warn('Wake lock request failed:', err);
    }
  }, [isSupported]);

  const release = React.useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsActive(false);
      } catch (err) {
        console.warn('Wake lock release failed:', err);
      }
    }
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // Re-acquire wake lock when page becomes visible again
  React.useEffect(() => {
    if (!isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive && !wakeLockRef.current) {
        request();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isSupported, isActive, request]);

  return { isSupported, isActive, request, release };
}

/**
 * Shopping mode view optimized for in-store use
 * Features:
 * - Full-screen high-contrast mode
 * - Extra-large touch targets (64px+ items, 40px checkboxes)
 * - Large text (xl/2xl) for easy reading
 * - Category icons and colors for quick navigation
 * - Wake lock to keep screen on
 * - Celebration animation on completion
 */
export function ShoppingModeView({ items, week, onExit }: ShoppingModeViewProps) {
  const wakeLock = useWakeLock();
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [hasShownCelebration, setHasShownCelebration] = React.useState(false);

  // Request wake lock when component mounts
  React.useEffect(() => {
    wakeLock.request();
    return () => {
      wakeLock.release();
    };
  }, [wakeLock.request, wakeLock.release]);

  // Filter out already_have items for shopping mode
  const activeItems = React.useMemo(
    () => items.filter((item) => item.status !== 'already_have'),
    [items]
  );

  // Group by category
  const categorizedItems = React.useMemo(
    () => groupByCategory(activeItems),
    [activeItems]
  );

  // Sort categories, putting "Other" last
  const sortedCategories = React.useMemo(() => {
    return Array.from(categorizedItems.entries()).sort(([a], [b]) => {
      if (a.toLowerCase() === 'other') return 1;
      if (b.toLowerCase() === 'other') return -1;
      return a.localeCompare(b);
    });
  }, [categorizedItems]);

  // Calculate progress
  const totalItems = items.length;
  const checkedItems = items.filter((i) => i.status === 'already_have').length;
  const remainingItems = totalItems - checkedItems;
  const progressPercent = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  // Trigger celebration when all items are checked
  React.useEffect(() => {
    if (remainingItems === 0 && totalItems > 0 && !hasShownCelebration) {
      setShowCelebration(true);
      setHasShownCelebration(true);
      // Hide confetti after animation
      setTimeout(() => setShowCelebration(false), 3500);
    }
  }, [remainingItems, totalItems, hasShownCelebration]);

  // Scroll to category
  const scrollToCategory = (category: string) => {
    const element = document.getElementById(`category-${category.toLowerCase()}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Confetti celebration */}
      <Confetti show={showCelebration} />

      {/* Header - sticky with high contrast */}
      <div className="sticky top-0 z-10 bg-card border-b-2 border-border shadow-lg">
        <div className="flex items-center justify-between p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Shopping Mode</h1>
              <p className="text-lg text-muted-foreground font-medium">
                {remainingItems} of {totalItems} remaining
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onExit}
            className="h-14 w-14 rounded-2xl hover:bg-destructive/10"
            aria-label="Exit shopping mode"
          >
            <X className="h-8 w-8" />
          </Button>
        </div>

        {/* Progress bar - larger and more visible */}
        <div className="h-3 bg-muted">
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out',
              progressPercent === 100 ? 'bg-success' : 'bg-primary'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Quick category jump - horizontal scroll with icons */}
        {sortedCategories.length > 1 && (
          <div className="flex gap-3 p-4 overflow-x-auto scrollbar-hide bg-muted/30">
            {sortedCategories.map(([category, categoryItems]) => {
              const uncheckedCount = categoryItems.filter(
                (i) => i.status !== 'already_have'
              ).length;
              if (uncheckedCount === 0) return null;
              const IconComponent = getCategoryIconComponent(category);
              const iconColor = getCategoryIconColor(category);
              return (
                <button
                  key={category}
                  onClick={() => scrollToCategory(category)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl',
                    'bg-card hover:bg-card/80 transition-colors shadow-sm',
                    'text-base font-semibold whitespace-nowrap',
                    'focus:outline-none focus:ring-4 focus:ring-primary/50',
                    'min-h-[52px]'
                  )}
                >
                  <IconComponent className={cn('h-6 w-6', iconColor)} />
                  {getCategoryDisplayName(category)}
                  <Badge variant="secondary" className="text-sm font-bold">
                    {uncheckedCount}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main content - scrollable */}
      <div className="flex-1 overflow-y-auto pb-28">
        {remainingItems === 0 ? (
          // All done state with celebration
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <div className={cn(
              'rounded-full bg-success/20 p-8 mb-8',
              showCelebration && 'animate-celebration-burst'
            )}>
              <div className="rounded-full bg-success/30 p-6">
                <Check className="h-20 w-20 text-success animate-check-bounce" strokeWidth={3} />
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <PartyPopper className="h-10 w-10 text-accent" />
              <h2 className="text-3xl font-bold text-success">
                Shopping Complete!
              </h2>
              <PartyPopper className="h-10 w-10 text-accent scale-x-[-1]" />
            </div>
            <p className="text-xl text-muted-foreground mb-10">
              You got all {totalItems} items. Great job!
            </p>
            <Button size="lg" onClick={onExit} className="min-w-[240px] h-16 text-xl font-bold rounded-2xl">
              Done Shopping
            </Button>
          </div>
        ) : (
          // Category list
          <div className="flex flex-col gap-4 p-5">
            {sortedCategories.map(([category, categoryItems]) => (
              <ShoppingCategory
                key={category}
                category={category}
                items={categoryItems}
                week={week}
                defaultOpen={true}
              />
            ))}
          </div>
        )}
      </div>

      {/* Done Shopping button - fixed at bottom with high contrast */}
      {remainingItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-card border-t-2 border-border shadow-xl safe-area-inset-bottom">
          <Button
            size="lg"
            onClick={onExit}
            variant="outline"
            className="w-full h-16 text-xl font-bold rounded-2xl border-2"
          >
            Exit Shopping Mode
          </Button>
        </div>
      )}
    </div>
  );
}
