import { getPackageName } from "@hero-factory/shared";

export function getAppName(): string {
  return `${getPackageName()}/web`;
}
