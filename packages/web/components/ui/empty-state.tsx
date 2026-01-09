'use client';

import * as React from 'react';
import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost';
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: EmptyStateAction[];
  className?: string;
  children?: React.ReactNode;
}

/**
 * Reusable empty state component for lists/pages with no data
 * Features a friendly, inviting design with clear CTAs
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actions,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 py-12 px-6 text-center',
        className
      )}
    >
      {Icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-h3 font-display">{title}</h3>
      {description && (
        <p className="mt-2 text-body-sm text-muted-foreground max-w-sm">
          {description}
        </p>
      )}
      {actions && actions.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          {actions.map((action, index) => (
            <EmptyStateActionButton key={index} action={action} />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

function EmptyStateActionButton({ action }: { action: EmptyStateAction }) {
  const { label, href, onClick, icon: Icon, variant = 'default' } = action;

  const buttonContent = (
    <>
      {Icon && <Icon className="h-4 w-4" />}
      {label}
    </>
  );

  if (href) {
    return (
      <Button variant={variant} asChild>
        <Link href={href}>{buttonContent}</Link>
      </Button>
    );
  }

  return (
    <Button variant={variant} onClick={onClick}>
      {buttonContent}
    </Button>
  );
}
