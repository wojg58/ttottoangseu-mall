/**
 * @file components/admin/system-logs-list.tsx
 * @description 시스템 로그 목록 컴포넌트
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SystemLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface SystemLogsListProps {
  logs: SystemLog[];
  total: number;
  totalPages: number;
  currentPage: number;
  filters: {
    action?: string;
    entity_type?: string;
  };
}

export default function SystemLogsList({
  logs,
  total,
  totalPages,
  currentPage,
  filters,
}: SystemLogsListProps) {
  const router = useRouter();
  const [actionFilter, setActionFilter] = useState(filters.action || "");
  const [entityTypeFilter, setEntityTypeFilter] = useState(
    filters.entity_type || ""
  );

  const handleFilter = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (entityTypeFilter) params.set("entity_type", entityTypeFilter);
    params.set("page", "1");
    router.push(`/admin/settings/logs?${params.toString()}`);
  };

  const handleReset = () => {
    setActionFilter("");
    setEntityTypeFilter("");
    router.push("/admin/settings/logs?page=1");
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

  return (
    <div className="space-y-4">
      {/* 필터 */}
      <div className="flex items-end gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <Label htmlFor="action">액션</Label>
          <Input
            id="action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="예: order_created"
          />
        </div>
        <div className="flex-1">
          <Label htmlFor="entity_type">엔티티 타입</Label>
          <Input
            id="entity_type"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            placeholder="예: order"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleFilter} variant="outline">
            필터 적용
          </Button>
          <Button onClick={handleReset} variant="outline">
            초기화
          </Button>
        </div>
      </div>

      {/* 로그 목록 */}
      {logs.length > 0 ? (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#4a3f48]">
                        {log.action}
                      </span>
                      {log.entity_type && (
                        <>
                          <span className="text-[#8b7d84]">·</span>
                          <span className="text-sm text-[#8b7d84]">
                            {log.entity_type}
                          </span>
                        </>
                      )}
                      {log.entity_id && (
                        <>
                          <span className="text-[#8b7d84]">·</span>
                          <span className="text-sm font-mono text-[#8b7d84]">
                            {log.entity_id.substring(0, 8)}...
                          </span>
                        </>
                      )}
                    </div>
                    {log.description && (
                      <p className="text-sm text-[#8b7d84] mb-2">
                        {log.description}
                      </p>
                    )}
                    <div className="text-xs text-[#8b7d84]">
                      {formatDate(log.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
                    router.push(`/admin/settings/logs?${params.toString()}`);
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
                    router.push(`/admin/settings/logs?${params.toString()}`);
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
          로그가 없습니다.
        </div>
      )}
    </div>
  );
}
