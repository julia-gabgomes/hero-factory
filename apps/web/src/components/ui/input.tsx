import { type InputHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn.js";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: "bordered" | "bare";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "bordered", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-full px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-2 focus:outline-offset-2 focus:outline-primary",
          variant === "bordered" && "border border-border bg-white",
          variant === "bare" && "bg-white",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
