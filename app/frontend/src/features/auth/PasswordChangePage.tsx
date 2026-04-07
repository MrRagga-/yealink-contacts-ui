import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "../../hooks/useToast";
import { api } from "../../lib/api";
import { markBootstrapPasswordChanged } from "./bootstrapState";
import { useAuth } from "./AuthProvider";

export function PasswordChangePage() {
  const toast = useToast();
  const { user, refresh } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("admin");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changeMutation = useMutation({
    mutationFn: api.changePassword,
    onSuccess: async () => {
      markBootstrapPasswordChanged();
      toast.push("success", "Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await refresh();
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <span className="eyebrow">First login</span>
        <h1>Change the bootstrap password</h1>
        <p className="subtle">
          Signed in as <strong>{user?.username}</strong>. The admin UI stays locked until this password is replaced.
        </p>
        <form
          className="auth-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (newPassword !== confirmPassword) {
              toast.push("error", "The new passwords do not match.");
              return;
            }
            changeMutation.mutate({ current_password: currentPassword, new_password: newPassword });
          }}
        >
          <label>
            <span>Current password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label>
            <span>New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            <span>Confirm new password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="primary-button" disabled={changeMutation.isPending}>
            {changeMutation.isPending ? "Saving..." : "Change password"}
          </button>
        </form>
      </section>
    </main>
  );
}
