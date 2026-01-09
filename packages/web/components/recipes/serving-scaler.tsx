'use client';

import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ServingScalerProps {
  servings: number;
  originalServings: number;
  onServingsChange: (servings: number) => void;
  className?: string;
  minServings?: number;
  maxServings?: number;
}

/**
 * Serving scaler component with +/- buttons
 * Allows adjusting serving count which affects ingredient quantities
 */
export function ServingScaler({
  servings,
  originalServings,
  onServingsChange,
  className,
  minServings = 1,
  maxServings = 20,
}: ServingScalerProps) {
  const handleDecrease = () => {
    if (servings > minServings) {
      onServingsChange(servings - 1);
    }
  };

  const handleIncrease = () => {
    if (servings < maxServings) {
      onServingsChange(servings + 1);
    }
  };

  const isScaled = servings !== originalServings;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-sm font-medium text-muted-foreground">Servings:</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleDecrease}
          disabled={servings <= minServings}
          aria-label="Decrease servings"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span
          className={cn(
            'min-w-[2rem] text-center font-semibold',
            isScaled && 'text-primary'
          )}
        >
          {servings}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleIncrease}
          disabled={servings >= maxServings}
          aria-label="Increase servings"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {isScaled && (
        <button
          type="button"
          onClick={() => onServingsChange(originalServings)}
          className="text-xs text-muted-foreground hover:text-foreground underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          aria-label={`Reset servings to ${originalServings}`}
        >
          Reset
        </button>
      )}
    </div>
  );
}
