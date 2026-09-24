import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-line/50 text-ink hover:bg-line/70",
        secondary:
          "border-transparent bg-line/50 text-ink hover:bg-line/70",
        destructive:
          "border-transparent bg-carimbo/20 text-carimbo border-carimbo/30 hover:bg-carimbo/30",
        outline: "text-ink-2 border-line hover:bg-paper-3/50",
        success: "border-transparent bg-verde/20 text-verde-2 border-verde/30 hover:bg-verde-2/30",
        warning: "border-transparent bg-line/30 text-ink-2 border-line/40 hover:bg-line/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
