import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, UtensilsCrossed, ShoppingCart, Package } from "lucide-react";
import Link from "next/link";

const quickLinks = [
  {
    href: "/calendar",
    title: "Meal Calendar",
    description: "Plan your meals for the week",
    icon: Calendar,
  },
  {
    href: "/recipes",
    title: "Recipes",
    description: "Browse your recipe collection",
    icon: UtensilsCrossed,
  },
  {
    href: "/grocery",
    title: "Grocery List",
    description: "Manage your shopping list",
    icon: ShoppingCart,
  },
  {
    href: "/pantry",
    title: "Pantry",
    description: "Track your ingredients",
    icon: Package,
  },
];

export default function Home() {
  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Welcome to Meal Planner</h1>
          <p className="mt-2 text-muted-foreground">
            Plan your meals, organize recipes, and manage your grocery list all in one place.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Card className="h-full transition-colors hover:bg-accent">
                  <CardHeader>
                    <Icon className="h-8 w-8 text-primary" />
                    <CardTitle className="mt-2">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
