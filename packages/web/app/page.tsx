"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Moon, Sun } from "lucide-react";

export default function Home() {
  const { theme, setTheme } = useTheme();

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        {/* Header with theme toggle */}
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-foreground">Meal Planner</h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </div>

        <p className="text-lg text-muted-foreground">
          Welcome to the Meal Planner application. This page demonstrates the configured UI components.
        </p>

        {/* Demo Card */}
        <Card>
          <CardHeader>
            <CardTitle>UI Components Demo</CardTitle>
            <CardDescription>
              Tailwind CSS and shadcn/ui are configured and ready to use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="demo-input" className="text-sm font-medium text-foreground">
                Sample Input
              </label>
              <Input
                id="demo-input"
                placeholder="Type something..."
                className="max-w-md"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button>Default Button</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              Click the sun/moon icon above to toggle dark mode.
            </p>
          </CardFooter>
        </Card>

        {/* Tailwind classes demo */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle>Primary Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This card uses primary colors from the theme.</p>
            </CardContent>
          </Card>

          <Card className="bg-secondary text-secondary-foreground">
            <CardHeader>
              <CardTitle>Secondary Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p>This card uses secondary colors from the theme.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
