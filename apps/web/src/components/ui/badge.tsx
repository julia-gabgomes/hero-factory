import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn.js";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-gray-100 text-gray-700",
        primary: "bg-primary-soft text-primary",
        success: "bg-green-100 text-green-700",
        danger: "bg-red-100 text-red-700",
        warning: "bg-amber-100 text-amber-700",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  className?: string;
  children: ReactNode;
}

export function Badge({ tone, className, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)}>{children}</span>
  );
}
