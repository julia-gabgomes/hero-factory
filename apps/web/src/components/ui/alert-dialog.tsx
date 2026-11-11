import type { ReactNode } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { Button } from "./button.js";

export const AlertDialog = AlertDialogPrimitive.Root;

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  confirmVariant?: "solid" | "outline";
  isConfirming?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  confirmVariant = "solid",
  isConfirming = false,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-primary/20" />
        <AlertDialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-modal bg-white p-6 shadow-xl">
          <AlertDialogPrimitive.Title className="text-lg font-bold text-gray-900">
            {title}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-2 text-sm text-gray-600">
            {description}
          </AlertDialogPrimitive.Description>
          <div className="mt-6 flex items-center justify-end gap-3">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline" shape="rect">
                Cancelar
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              variant={confirmVariant}
              shape="rect"
              disabled={isConfirming}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
