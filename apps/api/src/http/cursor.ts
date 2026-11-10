export interface HeroListCursor {
  created_at: string;
  id: string;
}

export function encodeCursor(cursor: HeroListCursor): string {
  const raw = `${cursor.created_at}|${cursor.id}`;

  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodeCursor(value: string): HeroListCursor | null {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const raw = Buffer.from(base64, "base64").toString("utf8");
    const separatorIndex = raw.indexOf("|");

    if (separatorIndex === -1) {
      return null;
    }

    const created_at = raw.slice(0, separatorIndex);
    const id = raw.slice(separatorIndex + 1);

    if (created_at === "" || id === "") {
      return null;
    }

    return { created_at, id };
  } catch {
    return null;
  }
}
