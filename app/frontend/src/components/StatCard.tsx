import type { ReactNode } from "react";

export function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: ReactNode;
  description?: string;
}) {
  return (
    <article className="stat-card">
      <span className="eyebrow">{title}</span>
      <strong>{value}</strong>
      {description ? <p>{description}</p> : null}
    </article>
  );
}
