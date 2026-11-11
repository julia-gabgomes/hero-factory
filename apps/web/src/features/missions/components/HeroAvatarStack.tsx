import { UserPlus } from "lucide-react";
import { formatAssignedHeroesLabel } from "../hero-avatar.js";
import { HeroAvatarCircle } from "./HeroAvatarCircle.js";

export interface HeroAvatarStackProps {
  heroes: { id: string; nickname: string }[];
  total: number;
}

export function HeroAvatarStack({ heroes, total }: HeroAvatarStackProps) {
  if (total === 0) {
    return (
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-300">
          <UserPlus className="size-4" aria-hidden="true" />
        </span>
        <p className="text-sm text-gray-500">Nenhum herói escalado</p>
      </div>
    );
  }

  const extra = total - heroes.length;

  return (
    <div className="flex items-center gap-3">
      <div className="flex -space-x-2">
        {heroes.map((hero) => (
          <span key={hero.id} className="ring-2 ring-white rounded-full">
            <HeroAvatarCircle id={hero.id} nickname={hero.nickname} size="size-8" />
          </span>
        ))}
        {extra > 0 ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600 ring-2 ring-white">
            +{extra}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-gray-500">{formatAssignedHeroesLabel(total)}</p>
    </div>
  );
}
