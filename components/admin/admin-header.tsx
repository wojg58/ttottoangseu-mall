/**
 * @file components/admin/admin-header.tsx
 * @description 관리자 헤더
 *
 * 주요 기능:
 * 1. 사용자 정보 표시
 * 2. 알림 (추후)
 * 3. 로그아웃
 *
 * @dependencies
 * - @clerk/nextjs: 인증 관련
 * - lucide-react: 아이콘
 */

"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { User, LogOut } from "lucide-react";

export default function AdminHeader() {
  const { user } = useUser();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="shop-container">
        <div className="flex items-center justify-between h-16">
          {/* 좌측: 빈 공간 (사이드바가 있으므로) */}
          <div className="w-64 hidden lg:block" />

          {/* 우측: 사용자 정보 */}
          <div className="flex items-center gap-4 ml-auto">
            {user && (
              <>
                <div className="flex items-center gap-2 text-sm text-[#4a3f48]">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    {user.emailAddresses[0]?.emailAddress || "관리자"}
                  </span>
                </div>
                <SignOutButton>
                  <button className="flex items-center gap-2 px-4 py-2 text-sm text-[#8b7d84] hover:text-[#ff6b9d] transition-colors">
                    <LogOut className="w-4 h-4" />
                    <span className="hidden sm:inline">로그아웃</span>
                  </button>
                </SignOutButton>
              </>
            )}
            <Link
              href="/"
              className="text-sm text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
            >
              쇼핑몰로
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
