"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Navbar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAccountPage = pathname === "/account";
  const accountLinkProps = {
    href: isAccountPage ? "/" : "/account",
    className:
      "block md:inline-block text-lg bg-white dark:bg-gray-200 text-black dark:text-gray-900 px-4 py-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-300 transition-colors",
  };

  const accountLinkText = user
    ? isAccountPage
      ? "بازگشت به خانه"
      : user.firstName
    : isAccountPage
    ? "بازگشت به خانه"
    : "حساب کاربری";

  return (
    <header className="w-full bg-black text-white px-6 py-3">
      {/* The inner div now spans the full width */}
      <div className="w-full flex items-center justify-between">
        {/* Logo / Brand */}
        <div>
          {/* <Link href="/" className="text-2xl font-bold">
            مجموعه سامانه داد
          </Link> */}
        </div>

        {/* Hamburger Icon (visible on mobile) */}
        <button
          className="md:hidden text-white focus:outline-none"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {/* Simple "Hamburger" icon (3 lines) */}
          <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
            {mobileOpen ? (
              // Close icon if menu open
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.225 4.811A1 1 0 017.64 3.395L12 7.757l4.36-4.362a1 1 0 011.414 1.416L13.414 9.17l4.36 4.362a1 1 0 01-1.416 1.414L12 10.586l-4.362 4.36a1 1 0 01-1.414-1.415l4.36-4.36-4.36-4.36z"
              />
            ) : (
              // Hamburger icon if menu closed
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"
              />
            )}
          </svg>
        </button>

        {/* Desktop Nav Items */}
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/dadafarin_assistant" className="text-lg">
            سامانه دادآفرین
          </Link>
          <Link {...accountLinkProps}>{accountLinkText}</Link>
        </nav>
      </div>

      {/* Mobile Nav Items (collapsible) */}
      {mobileOpen && (
        <nav className="flex flex-col gap-4 mt-3 md:hidden">
          <Link
            href="/dadafarin_assistant"
            className="text-lg px-4 py-2 hover:bg-gray-700 transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            سامانه دادآفرین
          </Link>

          <Link {...accountLinkProps} onClick={() => setMobileOpen(false)}>
            {accountLinkText}
          </Link>
        </nav>
      )}
    </header>
  );
}
