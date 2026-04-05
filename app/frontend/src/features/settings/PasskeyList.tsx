import type { PasskeyCredential } from "../../types/api";

export function PasskeyList({
  passkeys,
  onDelete,
}: {
  passkeys: PasskeyCredential[];
  onDelete: (id: string) => void;
}) {
  if (!passkeys.length) {
    return <div className="info-box">No passkeys registered yet.</div>;
  }

  return (
    <div className="stack">
      {passkeys.map((passkey) => (
        <article key={passkey.id} className="list-card compact-card">
          <div className="list-card-header">
            <div>
              <strong>{passkey.label}</strong>
              <p className="subtle">
                Added {new Date(passkey.created_at).toLocaleString()}
                {passkey.last_used_at ? ` • Last used ${new Date(passkey.last_used_at).toLocaleString()}` : ""}
              </p>
            </div>
            <button type="button" className="danger-button" onClick={() => onDelete(passkey.id)}>
              Remove
            </button>
          </div>
          <div className="chip-row">
            {passkey.transports.length ? (
              passkey.transports.map((transport) => (
                <span key={transport} className="chip">
                  {transport}
                </span>
              ))
            ) : (
              <span className="chip">transport not reported</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
