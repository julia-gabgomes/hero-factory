import { getPackageName } from "@hero-factory/shared";

export function getServerName(): string {
  return `${getPackageName()}/api`;
}
