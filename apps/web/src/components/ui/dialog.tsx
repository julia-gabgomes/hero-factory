import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/cn.js";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;

export function DialogContent({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/20 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-modal bg-white shadow-xl",
          className,
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({
  title,
  onClose,
}: {
  title: ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5">
      <DialogPrimitive.Title className="text-xl font-bold text-gray-900">
        {title}
      </DialogPrimitive.Title>
      <DialogPrimitive.Close
        aria-label="Fechar"
        onClick={onClose}
        className="rounded-full p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
      >
        <X className="size-5" aria-hidden="true" />
      </DialogPrimitive.Close>
    </div>
  );
}

export function DialogBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-6 py-5", className)}>
      {children}
    </div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-3 border-t border-border px-6 py-4">
      {children}
    </div>
  );
}
