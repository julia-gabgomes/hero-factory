export const AVATAR_COLORS = [
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

export function getHeroAvatarColor(id: string): string {
  const index = hashString(id) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? "bg-blue-600";
}

export function getHeroInitials(nickname: string): string {
  const words = nickname.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

export function formatAssignedHeroesLabel(total: number): string {
  return total === 1 ? "1 herói escalado" : `${String(total)} heróis escalados`;
}
