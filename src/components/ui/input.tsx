import * as React from "react";

import { cn } from "@/lib/utils";

// v2 input: 40px, radius 8px, 0.5px border-tertiary, focus #1a1a1a
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[8px] border-[0.5px] border-[hsl(var(--color-border-tertiary))]",
          "bg-[hsl(var(--background-surface))] px-3 py-2 text-[14px] text-foreground",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:border-foreground focus-visible:outline-none",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-danger",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
