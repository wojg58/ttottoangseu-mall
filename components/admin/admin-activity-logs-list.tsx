/**
 * @file components/admin/admin-activity-logs-list.tsx
 * @description 관리자 활동 로그 목록 컴포넌트
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, ArrowRight, Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdminActivityLog {
  id: string;
  admin_user_id: string;
  admin_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before: any; // JSONB
  after: any; // JSONB
  ip: string | null;
  user_agent: string | null;
  created_at: string;
}

interface AdminActivityLogsListProps {
  logs: AdminActivityLog[];
  total: number;
  totalPages: number;
  currentPage: number;
  filters: {
    action?: string;
    entity_type?: string;
    admin_email?: string;
    period?: string;
  };
}

export default function AdminActivityLogsList({
  logs,
  total,
  totalPages,
  currentPage,
  filters,
}: AdminActivityLogsListProps) {
  const router = useRouter();
  const [actionFilter, setActionFilter] = useState(filters.action || "");
  const [entityTypeFilter, setEntityTypeFilter] = useState(
    filters.entity_type || ""
  );
  const [adminEmailFilter, setAdminEmailFilter] = useState(
    filters.admin_email || ""
  );
  const [periodFilter, setPeriodFilter] = useState(
    filters.period && filters.period !== "" ? filters.period : "all"
  );

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
    if (adminEmailFilter) params.set("admin_email", adminEmailFilter);
    if (periodFilter && periodFilter !== "all") params.set("period", periodFilter);
    params.set("page", "1");
    router.push(`/admin/settings/activity-logs?${params.toString()}`);
  };

  const handleReset = () => {
    setActionFilter("");
    setEntityTypeFilter("");
    setAdminEmailFilter("");
    setPeriodFilter("all");
    router.push("/admin/settings/activity-logs?page=1");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "없음";
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <Label htmlFor="action">액션</Label>
          <Input
            id="action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="예: order_status_changed"
          />
        </div>
        <div>
          <Label htmlFor="entity_type">엔티티 타입</Label>
          <Input
            id="entity_type"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            placeholder="예: order"
          />
        </div>
        <div>
          <Label htmlFor="admin_email">관리자 이메일</Label>
          <Input
            id="admin_email"
            value={adminEmailFilter}
            onChange={(e) => setAdminEmailFilter(e.target.value)}
            placeholder="관리자 이메일"
          />
        </div>
        <div>
          <Label htmlFor="period">기간</Label>
          <Select
            value={periodFilter && periodFilter !== "" ? periodFilter : "all"}
            onValueChange={(value) => {
              setPeriodFilter(value && value !== "" ? value : "all");
            }}
          >
            <SelectTrigger id="period">
              <SelectValue placeholder="전체 기간" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 기간</SelectItem>
              <SelectItem value="7d">최근 7일</SelectItem>
              <SelectItem value="30d">최근 30일</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <Button onClick={handleFilter} variant="outline" className="flex-1">
            필터 적용
          </Button>
          <Button onClick={handleReset} variant="outline" className="flex-1">
            초기화
          </Button>
        </div>
      </div>

      {/* 로그 목록 */}
      {logs.length > 0 ? (
        <>
          <div className="space-y-3">
            {logs.map((log) => {
              const hasChange = log.before && log.after;

              return (
                <div
                  key={log.id}
                  className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-[#ff6b9d]" />
                        <span className="font-semibold text-[#4a3f48]">
                          {log.admin_email || log.admin_user_id || "알 수 없음"}
                        </span>
                        <span className="text-sm text-[#8b7d84]">·</span>
                        <span className="text-sm font-medium text-[#4a3f48]">
                          {log.action}
                        </span>
                        {log.entity_type && (
                          <>
                            <span className="text-sm text-[#8b7d84]">·</span>
                            <span className="text-sm text-[#8b7d84]">
                              {log.entity_type}
                            </span>
                          </>
                        )}
                        {log.entity_id && (
                          <>
                            <span className="text-sm text-[#8b7d84]">·</span>
                            <span className="text-sm text-[#8b7d84]">
                              {log.entity_id.substring(0, 8)}...
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[#8b7d84]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(log.created_at)}
                        </div>
                        {log.ip && (
                          <div>IP: {log.ip}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 변경 전/후 값 비교 */}
                  {hasChange && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                          <div className="text-xs font-medium text-red-800 mb-1">
                            변경 전
                          </div>
                          <div className="text-sm text-red-900 font-mono break-all whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {formatValue(log.before)}
                          </div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <div className="text-xs font-medium text-green-800 mb-1">
                            변경 후
                          </div>
                          <div className="text-sm text-green-900 font-mono break-all whitespace-pre-wrap max-h-40 overflow-y-auto">
                            {formatValue(log.after)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-[#8b7d84]">
                총 {total}개의 로그
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set("page", String(Math.max(1, currentPage - 1)));
                    router.push(`/admin/settings/activity-logs?${params.toString()}`);
                  }}
                  disabled={currentPage === 1}
                >
                  이전
                </Button>
                <span className="text-sm text-[#8b7d84]">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams(window.location.search);
                    params.set(
                      "page",
                      String(Math.min(totalPages, currentPage + 1))
                    );
                    router.push(`/admin/settings/activity-logs?${params.toString()}`);
                  }}
                  disabled={currentPage === totalPages}
                >
                  다음
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-[#8b7d84]">
          <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium text-[#4a3f48] mb-2">
            로그가 없습니다
          </p>
          <p className="text-sm text-[#8b7d84]">
            관리자 활동이 기록되면 여기에 표시됩니다.
          </p>
        </div>
      )}
    </div>
  );
}
