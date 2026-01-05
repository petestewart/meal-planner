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

  return (
    <div className={className}>
      <h2 className="mb-3 text-lg font-semibold uppercase tracking-wide">
        Instructions
      </h2>
      <div className="border-t border-border" />
      <div className="mt-4 space-y-4">
        {steps.map((step, index) => {
          if (step.type === 'header') {
            return (
              <h3
                key={`header-${index}`}
                className="mt-6 text-base font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {step.content}
              </h3>
            );
          }

          return (
            <div key={`step-${index}`} className="flex gap-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {step.stepNumber}
              </div>
              <p className="flex-1 pt-0.5 leading-relaxed">{step.content}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
