"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setUser } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "خطا در ورود به حساب");
      }

      // Store the token
      localStorage.setItem("token", data.token);

      // Fetch user data
      const userRes = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${data.token}`,
        },
      });

      if (!userRes.ok) {
        throw new Error("خطا در دریافت اطلاعات کاربر");
      }

      const userData = await userRes.json();
      setUser({
        ...userData.user,
        validUntil: userData.validUntil,
      });

      router.push("/");
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "خطایی در ورود به حساب رخ داده است");
    }
  };

  return (
    <div
      dir="rtl"
      className="max-w-md w-full mx-auto mt-8 p-6 rounded-lg shadow-lg auth-card text-right"
    >
      <h2 className="text-2xl font-bold mb-6">ورود به حساب</h2>

      {error && <div className="auth-error mb-4 text-red-500">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* ایمیل */}
        <div className="mb-4">
          <label className="block auth-label mb-2" htmlFor="email">
            ایمیل
          </label>
          <input
            type="email"
            id="email"
            className="w-full p-2 rounded auth-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* رمز عبور */}
        <div className="mb-4">
          <label className="block auth-label mb-2" htmlFor="password">
            رمز عبور
          </label>
          <input
            type="password"
            id="password"
            className="w-full p-2 rounded auth-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          ورود
        </button>
      </form>
    </div>
  );
}
