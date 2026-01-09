"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  UtensilsCrossed,
  ShoppingCart,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/recipes", label: "Recipes", icon: UtensilsCrossed },
  { href: "/grocery", label: "Grocery", icon: ShoppingCart },
  { href: "/pantry", label: "Pantry", icon: Package },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card md:hidden safe-area-inset-bottom" aria-label="Mobile navigation">
      <ul className="flex h-16 items-center justify-around" role="list">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 h-16 py-2 text-xs font-medium transition-all duration-150 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:scale-95",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={{ transitionTimingFunction: "var(--spring)" }}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn("h-6 w-6", isActive && "text-primary")}
                  aria-hidden="true"
                  fill={isActive ? "currentColor" : "none"}
                  strokeWidth={isActive ? 1.5 : 2}
                />
                <span>{item.label}</span>
                {/* Dot indicator for active item */}
                {isActive && (
                  <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
