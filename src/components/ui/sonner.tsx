import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      offset={16}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:rounded-[12px] group-[.toaster]:border-0 group-[.toaster]:shadow-none group-[.toaster]:border-l-[3px] group-[.toaster]:border-l-foreground group-[.toaster]:[outline:0.5px_solid_hsl(var(--color-border-tertiary))]",
          success:
            "group-[.toaster]:!border-l-[3px] group-[.toaster]:!border-l-success",
          error:
            "group-[.toaster]:!border-l-[3px] group-[.toaster]:!border-l-danger",
          warning:
            "group-[.toaster]:!border-l-[3px] group-[.toaster]:!border-l-warning",
          info:
            "group-[.toaster]:!border-l-[3px] group-[.toaster]:!border-l-foreground",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md",
          cancelButton: "group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground group-[.toast]:rounded-md",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
