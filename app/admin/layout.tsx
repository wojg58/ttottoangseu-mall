/**
 * @file app/admin/layout.tsx
 * @description 관리자 영역 공통 레이아웃
 *
 * 주요 기능:
 * 1. 관리자 권한 확인
 * 2. 사이드바 네비게이션
 * 3. 헤더 (사용자 정보, 알림)
 * 4. 반응형 디자인 (모바일 메뉴)
 *
 * @dependencies
 * - @clerk/nextjs: 인증 관련
 * - lucide-react: 아이콘
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import AdminSidebar from "@/components/admin/admin-sidebar";
import AdminHeader from "@/components/admin/admin-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 lg:ml-64">
          <div className="py-8">
            <div className="shop-container">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
