/**
 * @file app/admin/settings/system/page.tsx
 * @description 시스템 설정 페이지
 *
 * 주요 기능:
 * 1. 시스템 기본 정보 표시
 * 2. 시스템 설정 관리
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { Settings, Info, Server, Database, Clock } from "lucide-react";
import Link from "next/link";

export default async function SystemSettingsPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  // 시스템 정보 (실제로는 환경 변수나 데이터베이스에서 가져올 수 있음)
  const systemInfo = {
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    database: "Supabase (PostgreSQL)",
    lastBackup: "2025-01-15 10:00:00",
  };

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
          <h1 className="text-2xl font-bold text-[#4a3f48]">시스템 설정</h1>
        </div>
        <p className="text-sm text-[#8b7d84]">
          시스템 기본 정보 및 설정을 확인할 수 있습니다.
        </p>
      </div>

      <div className="space-y-6">
        {/* 시스템 정보 */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <Server className="w-6 h-6 text-[#ff6b9d]" />
            <h2 className="text-xl font-bold text-[#4a3f48]">시스템 정보</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-[#8b7d84]" />
                <span className="text-[#4a3f48]">버전</span>
              </div>
              <span className="text-[#8b7d84] font-mono">{systemInfo.version}</span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-[#8b7d84]" />
                <span className="text-[#4a3f48]">환경</span>
              </div>
              <span className="text-[#8b7d84] font-mono">
                {systemInfo.environment}
              </span>
            </div>

            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Database className="w-5 h-5 text-[#8b7d84]" />
                <span className="text-[#4a3f48]">데이터베이스</span>
              </div>
              <span className="text-[#8b7d84]">{systemInfo.database}</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#8b7d84]" />
                <span className="text-[#4a3f48]">마지막 백업</span>
              </div>
              <span className="text-[#8b7d84]">{systemInfo.lastBackup}</span>
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-[#4a3f48] mb-1">
                시스템 설정 안내
              </h3>
              <p className="text-sm text-[#8b7d84]">
                시스템 설정은 현재 읽기 전용으로 제공됩니다. 추가 설정 기능은
                추후 구현 예정입니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
