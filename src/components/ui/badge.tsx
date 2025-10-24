import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-slate-700/50 text-slate-200 hover:bg-slate-700/70",
        secondary:
          "border-transparent bg-slate-600/50 text-slate-100 hover:bg-slate-600/70",
        destructive:
          "border-transparent bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30",
        outline: "text-slate-300 border-slate-600 hover:bg-slate-800/50",
        success: "border-transparent bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30",
        warning: "border-transparent bg-yellow-500/20 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/30",
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
