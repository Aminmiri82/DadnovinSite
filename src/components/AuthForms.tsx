"use client";

import { useState } from "react";
import LoginForm from "./LoginForm";
import SignupForm from "./SignupForm";

export default function AuthForms() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    // Add RTL direction for the whole container
    <div dir="rtl" className="text-right">
      <div className="flex flex-row-reverse justify-center space-x-reverse space-x-4 mb-8">
        <button
          onClick={() => setIsLogin(true)}
          className={`px-4 py-2 rounded transition-colors ${
            isLogin
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          ورود
        </button>
        <button
          onClick={() => setIsLogin(false)}
          className={`px-4 py-2 rounded transition-colors ${
            !isLogin
              ? "bg-blue-500 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          ثبت‌نام
        </button>
      </div>

      {isLogin ? <LoginForm /> : <SignupForm />}
    </div>
  );
}
