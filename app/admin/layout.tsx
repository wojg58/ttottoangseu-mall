/**
 * @file app/admin/layout.tsx
 * @description 관리자 영역 공통 레이아웃
 *
 * 주요 기능:
 * 1. 사이드바 네비게이션
 * 2. 헤더 (사용자 정보, 알림)
 * 3. 반응형 디자인 (모바일 메뉴)
 *
 * 보안:
 * - 관리자 권한 체크는 middleware.ts에서 처리됨
 * - 이 레이아웃에 도달한 사용자는 이미 관리자 권한이 확인된 상태
 *
 * @dependencies
 * - @clerk/nextjs: 인증 관련
 * - lucide-react: 아이콘
 */

import AdminSidebar from "@/components/admin/admin-sidebar";
import AdminHeader from "@/components/admin/admin-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 관리자 권한 체크는 middleware.ts에서 처리되므로 여기서는 레이아웃만 렌더링
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
