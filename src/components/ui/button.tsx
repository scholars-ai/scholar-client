import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        default: "border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] hover:border-[#9aa5b1]",
        primary: "border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[#c94d31] hover:border-[#c94d31]",
        danger: "border-[var(--line)] bg-[var(--panel)] text-[#ad3a2c] hover:border-[#d6a19b] hover:bg-[#fff8f7]",
        outline: "border-[var(--line)] bg-transparent text-[var(--ink)] hover:bg-[#f7f8fa]",
        ghost: "border-transparent bg-transparent text-[var(--muted)] hover:bg-[#f1f3f5] hover:text-[var(--ink)]",
      },
      size: {
        default: "min-h-10 px-3.5 py-2.5",
        sm: "min-h-9 px-3 py-2 text-xs",
        lg: "min-h-11 px-4 py-3",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
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
