export function AccessDeniedPage() {
  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="eyebrow">Access denied</span>
        <h1>This IP range is blocked</h1>
        <p className="subtle">
          The backend rejected this request before login. Update the admin CIDR allowlist or access the UI from an allowed network.
        </p>
      </section>
    </main>
  );
}
