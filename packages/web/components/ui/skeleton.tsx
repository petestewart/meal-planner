import { cn } from "@/lib/utils"

/**
 * Skeleton loader component with shimmer animation
 * Used to show loading states for content that's being fetched
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-shimmer rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
