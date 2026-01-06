import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const cardVariants = cva(
  "border bg-card text-card-foreground transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default: "shadow-md",
        interactive: "shadow-md hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20 cursor-pointer",
        elevated: "shadow-lg",
        flat: "shadow-none border-transparent",
      },
      size: {
        default: "rounded-md",
        lg: "rounded-lg",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardVariants({ variant, size, className }))}
      {...props}
    />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

// Specialized card variant for recipe cards with image support
const RecipeCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { aspectRatio?: "portrait" | "landscape" }
>(({ className, aspectRatio = "portrait", ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      cardVariants({ variant: "interactive", size: "default" }),
      "overflow-hidden",
      aspectRatio === "portrait" ? "aspect-[3/4]" : "aspect-[4/3]",
      className
    )}
    {...props}
  />
))
RecipeCard.displayName = "RecipeCard"

// Image container for recipe cards
const RecipeCardImage = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative h-[60%] w-full overflow-hidden bg-muted",
      className
    )}
    {...props}
  />
))
RecipeCardImage.displayName = "RecipeCardImage"

// Specialized card for meal slots
const MealSlotCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { empty?: boolean }
>(({ className, empty, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      empty
        ? "border-2 border-dashed border-primary/30 bg-transparent hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-all duration-200"
        : cardVariants({ variant: "interactive", size: "default" }),
      "min-h-[80px]",
      className
    )}
    {...props}
  />
))
MealSlotCard.displayName = "MealSlotCard"

// Navigation card for dashboard quick actions
const NavCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      cardVariants({ variant: "interactive", size: "default" }),
      "flex items-center justify-center p-6 text-center",
      className
    )}
    {...props}
  />
))
NavCard.displayName = "NavCard"

// Stat card for dashboard statistics
const StatCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      cardVariants({ variant: "elevated", size: "default" }),
      "p-4",
      className
    )}
    {...props}
  />
))
StatCard.displayName = "StatCard"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants,
  RecipeCard,
  RecipeCardImage,
  MealSlotCard,
  NavCard,
  StatCard
}
