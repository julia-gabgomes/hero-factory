import { useState } from "react";
import type { HeroResponse } from "@hero-factory/shared";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Switch } from "../../../components/ui/switch.js";
import { Tooltip } from "../../../components/ui/tooltip.js";
import { cn } from "../../../lib/cn.js";

export interface HeroCardMenuProps {
  hero: HeroResponse;
  onEdit: () => void;
  onRequestDelete: () => void;
  onRequestToggleActive: () => void;
}

export function HeroCardMenu({
  hero,
  onEdit,
  onRequestDelete,
  onRequestToggleActive,
}: HeroCardMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Mais ações"
          className={cn(
            "rounded-md p-1.5 text-gray-500 hover:bg-gray-100",
            open && "bg-primary-soft text-primary",
          )}
        >
          <MoreVertical className="size-5" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role="menu"
          side="bottom"
          align="start"
          sideOffset={4}
          className="flex flex-col items-center gap-1 rounded-xl bg-white p-2 shadow-lg"
        >
          <Tooltip content="Excluir herói">
            <button
              type="button"
              role="menuitem"
              aria-label="Excluir herói"
              onClick={() => {
                setOpen(false);
                onRequestDelete();
              }}
              className="rounded-md p-2 text-danger hover:bg-red-50"
            >
              <Trash2 className="size-5" aria-hidden="true" />
            </button>
          </Tooltip>

          {hero.is_active ? (
            <Tooltip content="Editar herói">
              <button
                type="button"
                role="menuitem"
                aria-label="Editar herói"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                className="rounded-md p-2 text-primary hover:bg-primary-soft"
              >
                <Pencil className="size-5" aria-hidden="true" />
              </button>
            </Tooltip>
          ) : null}

          <Tooltip content={hero.is_active ? "Inativar herói" : "Ativar herói"}>
            <span className="flex justify-center p-2">
              <Switch
                aria-label={hero.is_active ? "Inativar herói" : "Ativar herói"}
                checked={hero.is_active}
                onCheckedChange={() => {
                  setOpen(false);
                  onRequestToggleActive();
                }}
              />
            </span>
          </Tooltip>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
