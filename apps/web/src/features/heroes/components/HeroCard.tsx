import { useState } from "react";
import type { HeroResponse } from "@hero-factory/shared";
import { User } from "lucide-react";
import { cn } from "../../../lib/cn.js";
import { HeroCardMenu } from "./HeroCardMenu.js";

export interface HeroCardProps {
  hero: HeroResponse;
  onOpenDetails: (id: string) => void;
  onEdit: (hero: HeroResponse) => void;
  onRequestDelete: (hero: HeroResponse) => void;
  onRequestToggleActive: (hero: HeroResponse) => void;
}

export function HeroCard({
  hero,
  onOpenDetails,
  onEdit,
  onRequestDelete,
  onRequestToggleActive,
}: HeroCardProps) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatarImage = hero.avatar_url !== null && !avatarFailed;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-3 rounded-card bg-white p-5 pt-4 shadow-sm",
        !hero.is_active && "grayscale opacity-60",
      )}
    >
      <div className="absolute right-3 top-3">
        <HeroCardMenu
          hero={hero}
          onEdit={() => {
            onEdit(hero);
          }}
          onRequestDelete={() => {
            onRequestDelete(hero);
          }}
          onRequestToggleActive={() => {
            onRequestToggleActive(hero);
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          onOpenDetails(hero.id);
        }}
        className="flex w-full flex-col items-center gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-gray-100">
          {showAvatarImage ? (
            <img
              src={hero.avatar_url ?? undefined}
              alt=""
              className="size-full object-cover"
              onError={() => {
                setAvatarFailed(true);
              }}
            />
          ) : (
            <User className="size-10 text-gray-400" aria-hidden="true" />
          )}
        </span>
        <span
          className="w-full truncate text-center font-medium text-gray-900"
          title={hero.nickname}
        >
          {hero.nickname}
        </span>
      </button>
    </div>
  );
}
