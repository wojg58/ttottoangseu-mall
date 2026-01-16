/**
 * @file app/admin/settings/audit-logs/page.tsx
 * @description 관리자 활동 로그 (Audit Log) 페이지
 *
 * 주요 기능:
 * 1. 관리자 활동 로그 목록 조회
 * 2. 변경 전/후 값 비교
 * 3. 필터링 및 검색
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { Shield, ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import AuditLogsList from "@/components/admin/audit-logs-list";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    action?: string;
    entity_type?: string;
    admin_email?: string;
  }>;
}) {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const pageSize = 20;

  const supabase = getServiceRoleClient();
  let query = supabase
    .from("admin_activity_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.action) {
    query = query.eq("action", params.action);
  }

  if (params.entity_type) {
    query = query.eq("entity_type", params.entity_type);
  }

  if (params.admin_email) {
    query = query.ilike("admin_email", `%${params.admin_email}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: logs, error, count } = await query;

  if (error) {
    console.error("[AuditLogsPage] 관리자 활동 로그 조회 실패:", error);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / pageSize);

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
          <h1 className="text-2xl font-bold text-[#4a3f48]">관리자 활동 로그</h1>
        </div>
        <p className="text-sm text-[#8b7d84]">
          누가 / 언제 / 무엇을 바꿨는지 추적할 수 있습니다.
        </p>
      </div>

      <div className="space-y-6">
        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-[#4a3f48] mb-1">
                관리자 활동 로그 안내
              </h3>
              <p className="text-sm text-[#8b7d84]">
                주문 상태 변경, 상품 가격 수정, 재고 변경 등 모든 관리자 활동이
                기록됩니다. 사고 추적 및 공동 관리자 작업 확인에 활용하세요.
              </p>
            </div>
          </div>
        </div>

        {/* 관리자 활동 로그 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <ArrowLeftRight className="w-6 h-6 text-[#ff6b9d]" />
            <h2 className="text-xl font-bold text-[#4a3f48]">활동 로그</h2>
          </div>

          <AuditLogsList
            logs={logs || []}
            total={total}
            totalPages={totalPages}
            currentPage={page}
            filters={{
              action: params.action,
              entity_type: params.entity_type,
              admin_email: params.admin_email,
            }}
          />
        </div>
      </div>
    </>
  );
}
