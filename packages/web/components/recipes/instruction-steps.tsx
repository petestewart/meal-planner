'use client';

import { cn } from '@/lib/utils';

interface InstructionStepsProps {
  instructions: string;
  className?: string;
}

interface ParsedStep {
  type: 'step' | 'header';
  content: string;
  stepNumber?: number;
}

/**
 * Parse instructions text into structured steps
 * Handles:
 * - Numbered steps (1. Step one, 2. Step two)
 * - Section headers (lines starting with ##)
 * - Plain text lines
 */
function parseInstructions(instructions: string): ParsedStep[] {
  const lines = instructions.split('\n').filter((line) => line.trim());
  const steps: ParsedStep[] = [];
  let stepCounter = 1;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers (## Header or # Header)
    if (trimmed.startsWith('##') || (trimmed.startsWith('#') && !trimmed.startsWith('#.'))) {
      const headerContent = trimmed.replace(/^#+\s*/, '');
      if (headerContent) {
        steps.push({
          type: 'header',
          content: headerContent,
        });
      }
      continue;
    }

    // Check for numbered steps (1. Step, 2) Step, etc.)
    const numberedMatch = trimmed.match(/^\d+[.)]\s*/);
    if (numberedMatch) {
      steps.push({
        type: 'step',
        content: trimmed.slice(numberedMatch[0].length),
        stepNumber: stepCounter++,
      });
      continue;
    }

    // Check for bullet points
    const bulletMatch = trimmed.match(/^[-*]\s*/);
    if (bulletMatch) {
      steps.push({
        type: 'step',
        content: trimmed.slice(bulletMatch[0].length),
        stepNumber: stepCounter++,
      });
      continue;
    }

    // Plain text line - treat as a step
    if (trimmed) {
      steps.push({
        type: 'step',
        content: trimmed,
        stepNumber: stepCounter++,
      });
    }
  }

  return steps;
}

/**
 * Instruction steps component
 * Parses and displays recipe instructions with numbered steps
 * Supports section headers (lines starting with ##)
 * Features:
 * - Large, readable step numbers
 * - Clear visual hierarchy with connecting line
 * - Section headers for complex recipes
 */
export function InstructionSteps({
  instructions,
  className,
}: InstructionStepsProps) {
  const steps = parseInstructions(instructions);

  if (steps.length === 0) {
    return (
      <div className={cn('text-muted-foreground italic', className)}>
        No instructions provided.
      </div>
    );
  }

  // Count only actual steps (not headers)
  const totalSteps = steps.filter((s) => s.type === 'step').length;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-semibold">
          Instructions
        </h2>
        <span className="text-sm text-muted-foreground">
          {totalSteps} {totalSteps === 1 ? 'step' : 'steps'}
        </span>
      </div>

      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[18px] top-8 bottom-4 w-0.5 bg-border hidden sm:block" />

        <div className="space-y-6">
          {steps.map((step, index) => {
            if (step.type === 'header') {
              return (
                <div key={`header-${index}`} className="relative">
                  <h3 className="ml-12 sm:ml-14 text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 mb-4 mt-4">
                    {step.content}
                  </h3>
                </div>
              );
            }

            return (
              <div
                key={`step-${index}`}
                className="group relative flex gap-4 sm:gap-5"
              >
                {/* Step number circle */}
                <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-sm font-bold shadow-sm transition-transform group-hover:scale-110">
                  {step.stepNumber}
                </div>

                {/* Step content */}
                <div className="flex-1 pt-1.5 pb-2">
                  <p className="leading-relaxed text-foreground/90">
                    {step.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
