/**
 * @file app/admin/settings/returns/page.tsx
 * @description 반품 정책 페이지
 *
 * 주요 기능:
 * 1. 반품 정책 목록 조회
 * 2. 반품 정책 추가/수정/삭제
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { RotateCcw, Plus } from "lucide-react";
import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import ReturnPolicyForm from "@/components/admin/return-policy-form";

export default async function ReturnPolicyPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const supabase = getServiceRoleClient();
  const { data: policies, error } = await supabase
    .from("return_policies")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[ReturnPolicyPage] 반품 정책 조회 실패:", error);
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
          <h1 className="text-2xl font-bold text-[#4a3f48]">반품 정책</h1>
        </div>
        <p className="text-sm text-[#8b7d84]">
          반품/교환 정책 및 절차를 설정할 수 있습니다.
        </p>
      </div>

      <div className="space-y-6">
        {/* 반품 정책 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <RotateCcw className="w-6 h-6 text-[#ff6b9d]" />
              <h2 className="text-xl font-bold text-[#4a3f48]">반품 정책</h2>
            </div>
            <ReturnPolicyForm mode="create" />
          </div>

          {policies && policies.length > 0 ? (
            <div className="space-y-4">
              {policies.map((policy: any) => (
                <div
                  key={policy.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-[#4a3f48]">
                          {policy.title}
                        </h3>
                        {policy.is_active ? (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                            활성
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                            비활성
                          </span>
                        )}
                      </div>
                      <div className="prose max-w-none text-sm text-[#8b7d84] whitespace-pre-line mb-4">
                        {policy.content}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ReturnPolicyForm mode="edit" policy={policy} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-[#8b7d84] mb-1">
                        반품 가능 기간
                      </div>
                      <div className="text-xl font-bold text-[#4a3f48]">
                        {policy.return_period_days}일
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-[#8b7d84] mb-1">
                        교환 가능 기간
                      </div>
                      <div className="text-xl font-bold text-[#4a3f48]">
                        {policy.exchange_period_days}일
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-[#8b7d84] mb-1">
                        반품 배송비
                      </div>
                      <div className="text-xl font-bold text-[#4a3f48]">
                        {policy.return_shipping_fee.toLocaleString()}원
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[#8b7d84]">
              반품 정책이 없습니다. 새 정책을 추가해주세요.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
