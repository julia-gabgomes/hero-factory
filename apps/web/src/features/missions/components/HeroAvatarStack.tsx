import { UserPlus } from "lucide-react";

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-purple-600",
  "bg-emerald-700",
  "bg-amber-700",
  "bg-rose-700",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-orange-700",
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function avatarColorFor(id: string): string {
  const index = hashString(id) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? "bg-blue-600";
}

function initialsFor(nickname: string): string {
  const words = nickname.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

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
          <span
            key={hero.id}
            title={hero.nickname}
            className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white ${avatarColorFor(hero.id)}`}
          >
            {initialsFor(hero.nickname)}
          </span>
        ))}
        {extra > 0 ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-600 ring-2 ring-white">
            +{extra}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-gray-500">
        {total === 1 ? "1 herói escalado" : `${String(total)} heróis escalados`}
      </p>
    </div>
  );
}
