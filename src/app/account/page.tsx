"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthForms from "@/components/AuthForms";
import BuyTime from "@/components/BuyTime";

export default function AccountPage() {
  const { user, logout, setUser } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>("");
  const [expirationDateTime, setExpirationDateTime] = useState<string>("");

  const handlePurchaseComplete = useCallback(() => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.user) {
            setUser({
              ...data.user,
              validUntil: data.validUntil,
            });
          }
        })
        .catch(console.error);
    }
  }, [setUser]);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const isVerifying = queryParams.get("verify");
    const transId = queryParams.get("trans_id");
    const idGet = queryParams.get("id_get");

    async function verifyPayment(transId: string, idGet: string) {
      try {
        console.log("Starting payment verification for:", { transId, idGet });
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("No authentication token found");
        }
        const response = await fetch("/api/payments/verify-bitpay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ transId, idGet }),
        });
        const result = await response.json();
        console.log("Payment verification result:", result);
        if (result.success) {
          handlePurchaseComplete();
        }
        localStorage.removeItem("pending_payment_id");
        localStorage.removeItem("pending_payment_time");
      } catch (error) {
        console.error("Payment verification error:", error);
      } finally {
        window.history.replaceState({}, "", "/account");
      }
    }

    if (isVerifying && transId && idGet) {
      verifyPayment(transId, idGet);
    }
  }, [handlePurchaseComplete]);

  useEffect(() => {
    if (user?.validUntil) {
      const validUntil = new Date(user.validUntil);

      // زمان فعلی ایران
      const iranTime = new Date().toLocaleString("en-US", {
        timeZone: "Asia/Tehran",
      });
      const currentIranTime = new Date(iranTime);

      // فرمت تاریخ با Europe/London برای جلوگیری از بهم‌ریختگی زمان
      const formattedDateTime = validUntil.toLocaleString("en-US", {
        timeZone: "Europe/London",
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      setExpirationDateTime(formattedDateTime);

      if (validUntil < currentIranTime) {
        setSubscriptionStatus("منقضی شده");
      } else {
        const remainingTime = validUntil.getTime() - currentIranTime.getTime();
        const remainingDays = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
        const remainingHours = Math.floor(
          (remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        );

        let statusText = "";
        if (remainingDays > 0) {
          statusText += `${remainingDays} روز`;
        }
        if (remainingHours > 0 || remainingDays > 0) {
          if (remainingDays > 0) statusText += " و ";
          statusText += `${remainingHours} ساعت`;
        }
        statusText += " باقی‌مانده";
        setSubscriptionStatus(statusText);
      }
    } else {
      setSubscriptionStatus("بدون اشتراک");
      setExpirationDateTime("");
    }
  }, [user?.validUntil]);

  // وضعیت بارگذاری کاربر
  if (user === undefined) {
    return (
      <div dir="rtl" className="text-right px-4 py-8">
        در حال بارگذاری...
      </div>
    );
  }

  return (
    // کل صفحه: راست به چپ
    <div className="flex flex-col min-h-screen" dir="rtl">
      {/* Navbar با چیدمان چپ به راست */}
      <div dir="ltr">
        <Navbar />
      </div>

      <main className="flex-grow flex flex-col items-center justify-center px-4 py-4 sm:px-8 sm:py-8 text-right">
        <div className="w-full max-w-2xl">
          {user ? (
            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg">
              <h1 className="text-2xl sm:text-4xl font-bold mb-8 dark:text-white">
                حساب کاربری
              </h1>
              <div className="space-y-4 text-base sm:text-lg">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
                  <p className="dark:text-white">
                    <span className="font-bold ml-2">نام:</span>
                    {user.firstName} {user.lastName}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded">
                  <p className="dark:text-white">
                    <span className="font-bold ml-2">ایمیل:</span>
                    {user.email}
                  </p>
                </div>

                <div className="flex justify-center mt-6">
                  <button
                    onClick={logout}
                    className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 transition-colors"
                  >
                    خروج از حساب
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-lg shadow-lg">
              <h1 className="text-2xl sm:text-4xl font-bold mb-8 dark:text-white">
                ورود به حساب
              </h1>
              <AuthForms />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
