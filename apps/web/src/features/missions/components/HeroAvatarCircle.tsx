import { getHeroAvatarColor, getHeroInitials } from "../hero-avatar.js";

export interface HeroAvatarCircleProps {
  id: string;
  nickname: string;
  size?: string;
}

export function HeroAvatarCircle({
  id,
  nickname,
  size = "size-10",
}: HeroAvatarCircleProps) {
  return (
    <span
      title={nickname}
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${getHeroAvatarColor(id)}`}
    >
      {getHeroInitials(nickname)}
    </span>
  );
}
