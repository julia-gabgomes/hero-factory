import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-16 text-center text-gray-500">
      <p className="font-medium text-gray-700">{title}</p>
      {description ? <p className="text-sm">{description}</p> : null}
    </div>
  );
}
