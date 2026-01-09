'use client';

import * as React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
  className?: string;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the whole app.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error | null;
  onReset?: () => void;
  onGoHome?: () => void;
  title?: string;
  description?: string;
  showHomeButton?: boolean;
  className?: string;
}

/**
 * Default error fallback UI with retry and navigation options
 */
export function ErrorFallback({
  error,
  onReset,
  onGoHome,
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  showHomeButton = true,
  className,
}: ErrorFallbackProps) {
  const handleGoHome = () => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 p-8 text-center',
        className
      )}
    >
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h3 className="text-lg font-semibold text-destructive">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>

      {error && process.env.NODE_ENV === 'development' && (
        <pre className="mt-4 max-w-full overflow-auto rounded bg-muted p-2 text-xs text-left">
          {error.message}
        </pre>
      )}

      <div className="mt-6 flex gap-3">
        {onReset && (
          <Button variant="default" onClick={onReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
        {showHomeButton && (
          <Button variant="outline" onClick={handleGoHome}>
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </Button>
        )}
      </div>
    </div>
  );
}

interface InlineErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Inline error display for smaller components or sections
 */
export function InlineError({
  message = 'Failed to load. Please try again.',
  onRetry,
  className,
}: InlineErrorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive',
        className
      )}
    >
      <AlertCircle className="h-5 w-5 flex-shrink-0" />
      <span className="flex-1 text-sm">{message}</span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
