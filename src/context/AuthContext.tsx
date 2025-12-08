// authcontext.ts (modified snippet)
"use client";
import { createContext, useContext, useState, useEffect } from "react";

type User = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  // Optionally include validUntil if you want to use it on the client-side:
  validUntil?: string | null;
} | null;

type AuthContextType = {
  user: User;
  setUser: (user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data.user) {
            console.log("Setting user from token:", data.user);
            setUser(data.user);
          }
        })
        .catch((error) => {
          console.error("Error fetching user:", error);
          localStorage.removeItem("token");
          setUser(null);
        });
    }
  }, []);

  const logout = () => {
    console.log("Logging out");
    localStorage.removeItem("token");
    setUser(null);
  };

  console.log("Current user state:", user);

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
