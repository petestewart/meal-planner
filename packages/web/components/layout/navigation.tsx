"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  UtensilsCrossed,
  ShoppingCart,
  Package,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/recipes", label: "Recipes", icon: UtensilsCrossed },
  { href: "/grocery", label: "Grocery", icon: ShoppingCart },
  { href: "/pantry", label: "Pantry", icon: Package },
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Good morning!", emoji: "☀️" };
  if (hour < 17) return { text: "Good afternoon!", emoji: "🌤️" };
  return { text: "Good evening!", emoji: "🌙" };
}

export function Navigation() {
  const pathname = usePathname();
  const greeting = getGreeting();

  return (
    <nav className="hidden md:flex w-60 flex-col border-r bg-[hsl(42,25%,96%)] dark:bg-background p-4" aria-label="Main navigation">
      {/* Greeting section */}
      <div className="px-3 py-2 mb-4">
        <span className="text-sm font-medium text-foreground">
          {greeting.text} {greeting.emoji}
        </span>
      </div>

      {/* Main navigation items */}
      <ul className="space-y-1 flex-1" role="list">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-primary/12 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Divider */}
      <div className="my-4 border-t border-border" />

      {/* Settings link */}
      <ul role="list">
        <li>
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-full px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              pathname === "/settings"
                ? "bg-primary/12 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-current={pathname === "/settings" ? "page" : undefined}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
            Settings
          </Link>
        </li>
      </ul>
    </nav>
  );
}
