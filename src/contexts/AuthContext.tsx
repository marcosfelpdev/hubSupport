import React, { createContext, useContext, useEffect, useState } from "react";
import { api, UserProfile, getToken, removeToken } from "../services/api";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await api.auth.me();
        setUser(data.user);
      } catch (err) {
        console.error("[AuthContext] Falha ao restaurar sessão:", err);
        removeToken();
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  async function login(email: string, password: string) {
    const res = await api.auth.login(email, password);
    setUser(res.user);
  }

  async function logout() {
    await api.auth.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return context;
}
