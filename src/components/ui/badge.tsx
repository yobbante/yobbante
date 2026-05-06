import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// v2 pill: radius 20px, 11px, padding 3px 10px
const badgeVariants = cva(
  "inline-flex items-center rounded-full px-[10px] py-[3px] text-[11px] font-medium leading-none transition-colors",
  {
    variants: {
      variant: {
        default:     "bg-foreground text-background",
        secondary:   "bg-secondary text-muted-foreground",
        neutral:     "bg-secondary text-muted-foreground",
        outline:     "border-[0.5px] border-[hsl(var(--color-border-tertiary))] text-foreground",
        success:     "bg-[#E1F5EE] text-[#085041]",
        warning:     "bg-[#FAEEDA] text-[#633806]",
        danger:      "bg-[#FFE4E4] text-[#A32D2D]",
        destructive: "bg-[#FFE4E4] text-[#A32D2D]",
        info:        "bg-[#EFF6FF] text-[#1D4ED8]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
