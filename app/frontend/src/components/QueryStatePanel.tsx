import type { ReactNode } from "react";

type QueryStateTone = "loading" | "error" | "empty";

export function QueryStatePanel({
  title,
  message,
  tone = "empty",
  action,
}: {
  title: string;
  message: string;
  tone?: QueryStateTone;
  action?: ReactNode;
}) {
  return (
    <div className={`query-state query-state-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <strong>{title}</strong>
      <p>{message}</p>
      {action ? <div className="button-row">{action}</div> : null}
    </div>
  );
}
