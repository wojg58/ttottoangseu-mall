/**
 * @file components/admin/admin-sidebar.tsx
 * @description 관리자 사이드바 네비게이션
 *
 * 주요 기능:
 * 1. 관리자 메뉴 네비게이션
 * 2. 현재 페이지 하이라이트
 * 3. 반응형 모바일 메뉴
 *
 * @dependencies
 * - next/navigation: 라우팅
 * - lucide-react: 아이콘
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  Boxes,
  Users,
  MessageSquare,
  Tag,
  BarChart3,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const menuItems = [
  {
    title: "대시보드",
    href: "/admin",
    icon: LayoutDashboard,
    priority: "P0",
  },
  {
    title: "주문 관리",
    href: "/admin/orders",
    icon: ShoppingCart,
    priority: "P0",
  },
  {
    title: "상품 관리",
    href: "/admin/products",
    icon: Package,
    priority: "P0",
  },
  {
    title: "배송/출고",
    href: "/admin/fulfillment",
    icon: Truck,
    priority: "P1",
  },
  {
    title: "재고 관리",
    href: "/admin/inventory",
    icon: Boxes,
    priority: "P1",
  },
  {
    title: "고객/회원",
    href: "/admin/customers",
    icon: Users,
    priority: "P1",
  },
  {
    title: "리뷰/문의",
    href: "/admin/support",
    icon: MessageSquare,
    priority: "P2",
  },
  {
    title: "프로모션",
    href: "/admin/promotions",
    icon: Tag,
    priority: "P2",
  },
  {
    title: "통계",
    href: "/admin/analytics",
    icon: BarChart3,
    priority: "P2",
  },
  {
    title: "설정",
    href: "/admin/settings",
    icon: Settings,
    priority: "P2",
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // P0 + P1 메뉴 필터링 (현재 구현된 메뉴)
  const visibleMenuItems = menuItems.filter(
    (item) => item.priority === "P0" || item.priority === "P1"
  );

  return (
    <>
      {/* 모바일 메뉴 버튼 */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md text-[#4a3f48] hover:bg-[#ffeef5] transition-colors"
        aria-label="메뉴 열기"
      >
        {isMobileMenuOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <Menu className="w-6 h-6" />
        )}
      </button>

      {/* 사이드바 */}
      <aside
        className={`
          fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-40
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="p-6">
          {/* 로고/제목 */}
          <div className="mb-8">
            <Link href="/admin" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#ffeef5] rounded-xl flex items-center justify-center">
                <LayoutDashboard className="w-6 h-6 text-[#ff6b9d]" />
              </div>
              <h1 className="text-xl font-bold text-[#4a3f48]">관리자</h1>
            </Link>
          </div>

          {/* 메뉴 목록 */}
          <nav className="space-y-1">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${
                      isActive
                        ? "bg-[#ffeef5] text-[#ff6b9d] font-medium"
                        : "text-[#4a3f48] hover:bg-gray-50"
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* 모바일 오버레이 */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
