import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// v2 spec: primary noir #1a1a1a, radius 8px, height 40px, 13px/500
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-foreground text-background hover:bg-foreground/90",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
        outline:     "border-[0.5px] border-[hsl(var(--color-border-tertiary))] bg-transparent text-foreground hover:bg-secondary",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:       "hover:bg-secondary hover:text-foreground",
        link:        "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm:      "h-8 rounded-[8px] px-3 text-[12px]",
        lg:      "h-11 rounded-[8px] px-7",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
