import { cn } from "@/lib/utils";

// v2: bg secondary, radius 4px, pulse
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[4px] bg-secondary", className)}
      {...props}
    />
  );
}

export { Skeleton };
