/**
 * @file app/admin/settings/page.tsx
 * @description 관리자 설정 페이지
 *
 * 주요 기능:
 * 1. 시스템 설정 링크
 * 2. 배송비 설정 링크
 * 3. 반품 정책 링크
 * 4. 관리자 계정/권한 링크
 * 5. 로그 조회 링크
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { Settings, ArrowRight, Star } from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const settingsItems = [
    {
      title: "시스템 설정",
      description: "기본 시스템 설정 및 정보를 관리할 수 있습니다.",
      href: "/admin/settings/system",
      icon: Settings,
    },
    {
      title: "배송비 설정",
      description: "기본 배송비, 무료배송 기준 등을 설정할 수 있습니다.",
      href: "/admin/settings/shipping",
      icon: Settings,
    },
    {
      title: "반품 정책",
      description: "반품/교환 정책 및 절차를 설정할 수 있습니다.",
      href: "/admin/settings/returns",
      icon: Settings,
    },
    {
      title: "관리자 계정 관리",
      description: "관리자 계정 추가/삭제 및 권한 관리를 할 수 있습니다.",
      href: "/admin/settings/admins",
      icon: Settings,
    },
    {
      title: "관리자 활동 로그",
      description: "누가 / 언제 / 무엇을 바꿨는지 추적할 수 있습니다. (주문 상태 변경, 상품 가격 수정 등)",
      href: "/admin/settings/activity-logs",
      icon: Settings,
      highlight: true,
    },
    {
      title: "시스템 로그",
      description: "시스템 로그 및 활동 이력을 조회할 수 있습니다.",
      href: "/admin/settings/logs",
      icon: Settings,
    },
  ];

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

        <div className="space-y-4">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block border-b border-gray-100 pb-4 last:border-b-0 last:pb-0 hover:bg-gray-50 -mx-4 px-4 py-3 rounded-lg transition-colors ${
                  item.highlight ? "bg-blue-50 border-blue-200" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-5 h-5 text-[#ff6b9d]" />
                      <h3 className="font-medium text-[#4a3f48]">
                        {item.title}
                      </h3>
                      {item.highlight && (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          <Star className="w-3 h-3 fill-yellow-600" />
                          강력 추천
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#8b7d84]">{item.description}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-[#8b7d84] flex-shrink-0 mt-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
