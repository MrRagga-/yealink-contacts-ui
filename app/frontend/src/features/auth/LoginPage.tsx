import { useMutation } from "@tanstack/react-query";
import { startAuthentication } from "@simplewebauthn/browser";
import { useState } from "react";

import { useToast } from "../../hooks/useToast";
import { api } from "../../lib/api";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const toast = useToast();
  const { refresh } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: async () => {
      await refresh();
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const passkeyMutation = useMutation({
    mutationFn: async () => {
      const { options } = await api.getPasskeyAuthenticationOptions();
      const credential = await startAuthentication({
        optionsJSON: options,
      });
      return api.verifyPasskeyAuthentication({ credential });
    },
    onSuccess: async () => {
      await refresh();
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="eyebrow">Admin access</span>
        <h1>Sign in to Yealink Contacts Sync</h1>
        <p className="subtle">
          Use the bootstrap account to get in, then change the password immediately and add passkeys for future sign-ins.
        </p>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            loginMutation.mutate({ username, password });
          }}
        >
          <label>
            <span>Username</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </button>
            <button type="button" className="ghost-button" onClick={() => passkeyMutation.mutate()} disabled={passkeyMutation.isPending}>
              {passkeyMutation.isPending ? "Waiting for passkey..." : "Sign in with passkey"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
