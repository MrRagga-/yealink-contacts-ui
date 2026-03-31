import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AUTH_UNAUTHORIZED_EVENT, ApiError, api } from "../../lib/api";
import type { AuthenticatedAdmin } from "../../types/api";

const AUTH_QUERY_KEY = ["auth", "me"] as const;

type AuthContextValue = {
  user: AuthenticatedAdmin | null;
  error: ApiError | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const clearAuth = () => {
    queryClient.setQueryData<AuthenticatedAdmin | null>(AUTH_QUERY_KEY, null);
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "auth",
    });
  };
  const authQuery = useQuery<AuthenticatedAdmin | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: api.getCurrentAdmin,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    const onUnauthorized = () => {
      clearAuth();
      void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
    };
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, onUnauthorized);
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user: authQuery.data ?? null,
        error: (authQuery.error as ApiError | null) ?? null,
        isLoading: authQuery.isPending,
        clearAuth,
        refresh: async () => {
          await queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
