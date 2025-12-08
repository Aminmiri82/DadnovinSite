"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function SignupForm() {
  const { setUser } = useAuth();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      // 1. Send signup request
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const signupData = await signupRes.json();
      if (!signupRes.ok) {
        throw new Error(signupData.error || "خطا در ثبت‌نام");
      }
      console.log("ثبت‌نام موفق بود. در حال ورود به حساب...");

      // 2. Login
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const loginData = await loginRes.json();
      if (!loginRes.ok) {
        throw new Error(loginData.error || "خطا در ورود به حساب پس از ثبت‌نام");
      }
      console.log("ورود موفق. تنظیم توکن...");

      localStorage.setItem("token", loginData.token);

      // 3. Fetch user data
      const userRes = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${loginData.token}`,
        },
      });

      const userData = await userRes.json();
      if (!userRes.ok) {
        throw new Error(userData.error || "خطا در دریافت اطلاعات کاربر");
      }

      console.log("دریافت اطلاعات کاربر موفقیت‌آمیز:", userData.user);
      setUser(userData.user);
    } catch (err: any) {
      console.error("Signup process error:", err);
      setError(err.message);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div
      dir="rtl"
      className="max-w-md w-full mx-auto mt-8 p-6 rounded-lg shadow-lg auth-card text-right"
    >
      <h2 className="text-2xl font-bold mb-6">ثبت‌نام</h2>

      {error && <div className="auth-error mb-4 text-red-500">{error}</div>}

      <form onSubmit={handleSubmit}>
        {/* نام */}
        <div className="mb-4">
          <label className="block auth-label mb-2" htmlFor="firstName">
            نام
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            className="w-full p-2 rounded auth-input"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>

        {/* نام خانوادگی */}
        <div className="mb-4">
          <label className="block auth-label mb-2" htmlFor="lastName">
            نام خانوادگی
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            className="w-full p-2 rounded auth-input"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>

        {/* ایمیل */}
        <div className="mb-4">
          <label className="block auth-label mb-2" htmlFor="email">
            ایمیل
          </label>
          <input
            type="email"
            id="email"
            name="email"
            className="w-full p-2 rounded auth-input"
            value={formData.email}
            onChange={handleChange}
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
            name="password"
            className="w-full p-2 rounded auth-input"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          ثبت‌نام
        </button>
      </form>
    </div>
  );
}
