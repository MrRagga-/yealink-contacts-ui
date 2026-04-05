export function AccessDeniedPage() {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="eyebrow">Access denied</span>
        <h1>This IP range is blocked</h1>
        <p className="subtle">
          The backend rejected this request before login. Localhost is always allowed. If you locked yourself out remotely,
          set <code>ADMIN_ALLOWED_CIDRS_OVERRIDE</code> in the backend environment, restart the backend, and then fix the
          saved admin CIDR allowlist.
        </p>
      </section>
    </main>
  );
}
