'use client';

/**
 * Page Transition Template
 *
 * This template wraps all page content and provides smooth transitions
 * between routes using CSS animations. It uses the View Transitions API
 * where supported for enhanced cross-fade effects.
 *
 * Key features:
 * - Fade + subtle slide animation on page enter
 * - 150ms duration with ease-out timing for smooth feel
 * - No layout shift during transitions (transform-based)
 * - Respects reduced motion preferences
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-transition">
      {children}
    </div>
  );
}
