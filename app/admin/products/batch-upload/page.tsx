/**
 * @file app/admin/products/batch-upload/page.tsx
 * @description 이미지 일괄 업로드 페이지
 *
 * 주요 기능:
 * 1. 여러 이미지 파일 선택 (드래그 앤 드롭 또는 파일 선택)
 * 2. 이미지 압축 및 업로드 진행률 표시
 * 3. 업로드된 이미지 URL 목록 표시
 * 4. 실패한 이미지 목록 표시
 */

import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/actions/admin";
import BatchUploadClient from "@/components/batch-upload-client";

export default async function BatchUploadPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/products"
            className="text-[#8b7d84] hover:text-[#ff6b9d] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#4a3f48]">
              이미지 일괄 업로드
            </h1>
            <p className="text-sm text-[#8b7d84] mt-1">
              여러 이미지를 선택하여 압축 후 Supabase Storage에 업로드합니다.
              (품질 90%, WebP 변환)
            </p>
          </div>
        </div>

        <BatchUploadClient />
      </div>
    </main>
  );
}

