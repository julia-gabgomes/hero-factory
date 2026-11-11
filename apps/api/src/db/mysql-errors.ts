const ER_DUP_ENTRY = "ER_DUP_ENTRY";

function hasDuplicateEntryCode(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === ER_DUP_ENTRY
  );
}

export function isDuplicateEntryError(error: unknown): boolean {
  if (hasDuplicateEntryCode(error)) {
    return true;
  }
  if (error instanceof Error && "cause" in error) {
    return hasDuplicateEntryCode((error as { cause?: unknown }).cause);
  }
  return false;
}
