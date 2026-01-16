/**
 * @file app/admin/settings/page.tsx
 * @description 관리자 설정 페이지
 *
 * 주요 기능:
 * 1. 시스템 설정 (추후 구현)
 * 2. 배송비 설정 (추후 구현)
 * 3. 반품 정책 (추후 구현)
 * 4. 관리자 계정/권한 (추후 구현)
 * 5. 로그 조회 (추후 구현)
 *
 * 현재는 기본 정보만 표시
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { Settings, Info } from "lucide-react";

export default async function SettingsPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">설정</h1>
        <p className="text-sm text-[#8b7d84]">
          시스템 설정 및 관리 옵션을 관리할 수 있습니다.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-8">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-[#ff6b9d]" />
          <h2 className="text-xl font-bold text-[#4a3f48]">시스템 설정</h2>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-[#4a3f48] mb-1">
                  설정 기능 준비 중
                </h3>
                <p className="text-sm text-[#8b7d84]">
                  배송비 설정, 반품 정책, 관리자 계정 관리 등의 기능은 추후
                  구현 예정입니다.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-medium text-[#4a3f48] mb-2">배송비 설정</h3>
              <p className="text-sm text-[#8b7d84]">
                기본 배송비, 무료배송 기준 등을 설정할 수 있습니다. (추후 구현)
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-medium text-[#4a3f48] mb-2">반품 정책</h3>
              <p className="text-sm text-[#8b7d84]">
                반품/교환 정책 및 절차를 설정할 수 있습니다. (추후 구현)
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-medium text-[#4a3f48] mb-2">
                관리자 계정 관리
              </h3>
              <p className="text-sm text-[#8b7d84]">
                관리자 계정 추가/삭제 및 권한 관리를 할 수 있습니다. (추후 구현)
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[#4a3f48] mb-2">시스템 로그</h3>
              <p className="text-sm text-[#8b7d84]">
                시스템 로그 및 활동 이력을 조회할 수 있습니다. (추후 구현)
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
