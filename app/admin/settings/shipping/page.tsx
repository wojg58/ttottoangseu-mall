/**
 * @file app/admin/settings/shipping/page.tsx
 * @description 배송비 설정 페이지
 *
 * 주요 기능:
 * 1. 배송비 설정 목록 조회
 * 2. 배송비 설정 추가/수정/삭제
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { Truck, Plus, Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import ShippingSettingsForm from "@/components/admin/shipping-settings-form";

export default async function ShippingSettingsPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const supabase = getServiceRoleClient();
  const { data: settings, error } = await supabase
    .from("shipping_settings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ShippingSettingsPage] 배송비 설정 조회 실패:", error);
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
          <h1 className="text-2xl font-bold text-[#4a3f48]">배송비 설정</h1>
        </div>
        <p className="text-sm text-[#8b7d84]">
          기본 배송비, 무료배송 기준 등을 설정할 수 있습니다.
        </p>
      </div>

      <div className="space-y-6">
        {/* 배송비 설정 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Truck className="w-6 h-6 text-[#ff6b9d]" />
              <h2 className="text-xl font-bold text-[#4a3f48]">배송비 설정</h2>
            </div>
            <ShippingSettingsForm mode="create" />
          </div>

          {settings && settings.length > 0 ? (
            <div className="space-y-4">
              {settings.map((setting: any) => (
                <div
                  key={setting.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-[#4a3f48]">
                          {setting.name}
                        </h3>
                        {setting.is_active ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            활성
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            비활성
                          </span>
                        )}
                      </div>
                      {setting.description && (
                        <p className="text-sm text-[#8b7d84] mb-4">
                          {setting.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <ShippingSettingsForm mode="edit" setting={setting} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-[#8b7d84] mb-1">
                        기본 배송비
                      </div>
                      <div className="text-xl font-bold text-[#4a3f48]">
                        {setting.base_shipping_fee.toLocaleString()}원
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-[#8b7d84] mb-1">
                        무료배송 기준
                      </div>
                      <div className="text-xl font-bold text-[#4a3f48]">
                        {setting.free_shipping_threshold
                          ? `${setting.free_shipping_threshold.toLocaleString()}원 이상`
                          : "없음"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[#8b7d84]">
              배송비 설정이 없습니다. 새 설정을 추가해주세요.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
