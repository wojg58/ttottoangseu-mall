/**
 * @file app/admin/settings/admins/page.tsx
 * @description 관리자 계정 관리 페이지
 *
 * 주요 기능:
 * 1. 관리자 계정 목록 조회
 * 2. 관리자 계정 정보 표시
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { Users, Shield } from "lucide-react";
import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export default async function AdminAccountsPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const supabase = getServiceRoleClient();
  const { data: admins, error } = await supabase
    .from("users")
    .select("*")
    .eq("role", "admin")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[AdminAccountsPage] 관리자 계정 조회 실패:", error);
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href="/admin/settings"
            className="text-[#8b7d84] hover:text-[#4a3f48] transition-colors"
          >
            설정
          </Link>
          <span className="text-[#8b7d84]">/</span>
          <h1 className="text-2xl font-bold text-[#4a3f48]">
            관리자 계정 관리
          </h1>
        </div>
        <p className="text-sm text-[#8b7d84]">
          관리자 계정 목록을 확인할 수 있습니다.
        </p>
      </div>

      <div className="space-y-6">
        {/* 관리자 계정 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-[#ff6b9d]" />
            <h2 className="text-xl font-bold text-[#4a3f48]">관리자 계정</h2>
          </div>

          {admins && admins.length > 0 ? (
            <div className="space-y-4">
              {admins.map((admin: any) => (
                <div
                  key={admin.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Shield className="w-5 h-5 text-[#ff6b9d]" />
                        <h3 className="text-lg font-semibold text-[#4a3f48]">
                          {admin.name || "이름 없음"}
                        </h3>
                        <span className="px-2 py-1 text-xs font-medium bg-[#ffeef5] text-[#ff6b9d] rounded-full">
                          관리자
                        </span>
                      </div>
                      <div className="space-y-2 text-sm text-[#8b7d84]">
                        <div>
                          <span className="font-medium">이메일:</span>{" "}
                          {admin.email}
                        </div>
                        {admin.phone && (
                          <div>
                            <span className="font-medium">전화번호:</span>{" "}
                            {admin.phone}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">가입일:</span>{" "}
                          {new Date(admin.created_at).toLocaleDateString(
                            "ko-KR"
                          )}
                        </div>
                        <div>
                          <span className="font-medium">Clerk ID:</span>{" "}
                          <span className="font-mono text-xs">
                            {admin.clerk_user_id}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[#8b7d84]">
              관리자 계정이 없습니다.
            </div>
          )}
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-[#4a3f48] mb-1">
                관리자 계정 관리 안내
              </h3>
              <p className="text-sm text-[#8b7d84]">
                관리자 계정은 Clerk 대시보드에서 관리할 수 있습니다. Clerk
                대시보드에서 사용자에게 &apos;admin&apos; role을 부여하면 자동으로 관리자
                권한이 부여됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
