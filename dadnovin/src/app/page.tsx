"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Link from "next/link";

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar remains LTR if that's your desired layout */}
      <Navbar />

      <main className="flex-grow" dir="rtl">
        <section
          // Increase height on larger screens
          className="relative min-h-[70vh] lg:min-h-[80vh] flex items-center justify-center"
        >
          {/* Background image & overlay */}
          <div className="absolute inset-0">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: "url('/assets/background.jpg')",
                backgroundPosition: "center center",
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
              }}
            />
            <div className="absolute inset-0 bg-black/30" />
          </div>

          {/* Foreground content with text shadow */}
          <div
            className="relative text-center text-white p-5 z-10 space-y-6 max-w-xl mx-auto bg-black/50 rounded-lg"
            style={{ textShadow: "2px 2px 4px rgba(0, 0, 0, 0.8)" }}
          >
            {/* Responsive heading sizes for mobile vs. desktop */}
            <h1 className="text-4xl sm:text-6xl mb-2 font-bold">
            سامانه های هوش مصنوعی ایرانی
            </h1>

            {user ? (
              // If logged in, show a fun icon or a greeting
              <div className="text-6xl sm:text-8xl animate-bounce">
                خوش آمدید
              </div>
            ) : (
              // If not logged in, invite user to log in / sign up
              <div className="space-y-4">
                <p className="text-lg sm:text-2xl font-light">
                  برای شروع لطفاً وارد حساب کاربری خود شوید یا ثبت‌نام کنید
                </p>
                <Link
                  href="/account"
                  className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors text-base sm:text-lg"
                >
                  ورود / ثبت‌نام
                </Link>
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
