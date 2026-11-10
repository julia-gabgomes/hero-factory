import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  {
    variants: {
      variant: {
        solid: "bg-primary text-white hover:bg-primary/90",
        outline: "border border-border bg-white text-gray-900 hover:bg-gray-50",
      },
      shape: {
        pill: "rounded-full px-6 py-2.5",
        rect: "rounded-md px-5 py-2",
      },
    },
    defaultVariants: {
      variant: "solid",
      shape: "rect",
    },
  },
);

export interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, shape, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, shape }), className)}
      {...props}
    />
  );
}
