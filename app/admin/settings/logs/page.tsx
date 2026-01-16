/**
 * @file app/admin/settings/logs/page.tsx
 * @description 시스템 로그 페이지
 *
 * 주요 기능:
 * 1. 시스템 로그 목록 조회
 * 2. 로그 필터링 및 검색
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { FileText, Search } from "lucide-react";
import Link from "next/link";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import SystemLogsList from "@/components/admin/system-logs-list";

export default async function SystemLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; action?: string; entity_type?: string }>;
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
    .from("system_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.action) {
    query = query.eq("action", params.action);
  }

  if (params.entity_type) {
    query = query.eq("entity_type", params.entity_type);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data: logs, error, count } = await query;

  if (error) {
    console.error("[SystemLogsPage] 시스템 로그 조회 실패:", error);
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
          <h1 className="text-2xl font-bold text-[#4a3f48]">시스템 로그</h1>
        </div>
        <p className="text-sm text-[#8b7d84]">
          시스템 로그 및 활동 이력을 조회할 수 있습니다.
        </p>
      </div>

      <div className="space-y-6">
        {/* 시스템 로그 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-6 h-6 text-[#ff6b9d]" />
            <h2 className="text-xl font-bold text-[#4a3f48]">시스템 로그</h2>
          </div>

          <SystemLogsList
            logs={logs || []}
            total={total}
            totalPages={totalPages}
            currentPage={page}
            filters={{
              action: params.action,
              entity_type: params.entity_type,
            }}
          />
        </div>
      </div>
    </>
  );
}
