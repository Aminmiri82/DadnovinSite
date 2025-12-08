"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentCallback() {
  const router = useRouter();

  useEffect(() => {
    // Get the parameters from the URL
    const params = new URLSearchParams(window.location.search);
    const transId = params.get("trans_id");
    const idGet = params.get("id_get");

    if (transId && idGet) {
      // Redirect to account page with verification parameters
      router.replace(
        `/account?verify=true&trans_id=${transId}&id_get=${idGet}`
      );
    } else {
      // If no parameters, just go back to account
      router.replace("/account");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h1 className="text-2xl font-bold mb-4 dark:text-white">
          در حال پردازش پرداخت
        </h1>
        <p className="text-gray-600 dark:text-gray-300">لطفا صبر کنید...</p>
      </div>
    </div>
  );
}
