import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { startRegistration } from "@simplewebauthn/browser";
import { useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { useToast } from "../../hooks/useToast";
import { api } from "../../lib/api";

export function useSettingsPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({ queryKey: ["app-settings"], queryFn: api.getAppSettings });
  const passkeysQuery = useQuery({
    queryKey: ["auth", "passkeys"],
    queryFn: api.listPasskeys,
  });
  const [passkeyLabel, setPasskeyLabel] = useState("This device");

  const updateMutation = useMutation({
    mutationFn: api.updateAppSettings,
    onSuccess: async () => {
      toast.push("success", "Settings saved.");
      await queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const registerPasskeyMutation = useMutation({
    mutationFn: async () => {
      const { options } = await api.getPasskeyRegistrationOptions({ label: passkeyLabel });
      const credential = await startRegistration({
        optionsJSON: options,
      });
      return api.verifyPasskeyRegistration({ credential });
    },
    onSuccess: async () => {
      toast.push("success", "Passkey added.");
      setPasskeyLabel("This device");
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
      await refresh();
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  const deletePasskeyMutation = useMutation({
    mutationFn: api.deletePasskey,
    onSuccess: async () => {
      toast.push("success", "Passkey removed.");
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
      await refresh();
    },
    onError: (error: Error) => toast.push("error", error.message),
  });

  return {
    deletePasskeyMutation,
    passkeyLabel,
    passkeys: passkeysQuery.data ?? [],
    registerPasskeyMutation,
    setPasskeyLabel,
    settings: settingsQuery.data,
    settingsQuery,
    updateMutation,
    user,
  };
}
