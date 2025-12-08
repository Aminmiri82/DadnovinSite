"use client";

import { useState, useEffect } from "react";

interface BuyTimeProps {
  onPurchaseComplete: () => void;
}

export default function BuyTime({ onPurchaseComplete }: BuyTimeProps) {
  const [loadingOptionId, setLoadingOptionId] = useState<number | null>(null);
  const [options, setOptions] = useState<
    { id: number; time: number; price: string }[]
  >([]);

  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch("/api/prices");
        const json = await res.json();
        if (json.success) {
          setOptions(json.prices);
        } else {
          console.error("خطا در دریافت قیمت‌ها:", json.error);
        }
      } catch (error) {
        console.error("خطا در دریافت قیمت‌ها:", error);
      }
    }
    fetchPrices();
  }, []);

  const buyTime = async (id: number, hours: number) => {
    setLoadingOptionId(id);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("توکن احراز هویت یافت نشد");
      }

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hours }),
      });

      if (!response.ok) {
        throw new Error("خطا در شروع فرایند پرداخت");
      }

      const data = await response.json();
      console.log("Payment initiated:", data);

      if (data.paymentUrl && data.id_get) {
        localStorage.setItem("pending_payment_id", data.id_get);
        localStorage.setItem("pending_payment_time", new Date().toISOString());
        window.location.href = data.paymentUrl;
      } else {
        throw new Error("آدرس پرداخت یافت نشد");
      }
    } catch (error: any) {
      console.error("Error initiating payment:", error);
      alert(error.message || "خطا در شروع پرداخت");
    } finally {
      setLoadingOptionId(null);
    }
  };

  return (
    <div dir="rtl" className="mt-6 space-y-4 text-right">
      <h2 className="text-2xl font-bold text-center dark:text-white mb-4">
        خرید بسته
      </h2>

      {options.length > 0 ? (
        // flex-row-reverse makes the first item appear on the right, etc.
        <div className="flex flex-row-reverse flex-wrap gap-4">
          {options.map((option) => {
            const isLoading = loadingOptionId === option.id;
            return (
              <button
                key={option.id}
                onClick={() => buyTime(option.id, option.time)}
                disabled={isLoading}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 w-full sm:w-auto"
              >
                برای {option.time} ساعت - {option.price} تومان
                {isLoading && " (در حال پردازش ...)"}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-red-500 dark:text-red-400">
          هیچ پلنی برای خرید یافت نشد
        </div>
      )}
    </div>
  );
}
