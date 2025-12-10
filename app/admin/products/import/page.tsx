/**
 * @file app/admin/products/import/page.tsx
 * @description 상품 데이터 이관 페이지
 *
 * 주요 기능:
 * 1. CSV/엑셀 파일 업로드
 * 2. 파일 파싱 및 미리보기
 * 3. 카테고리 매핑 설정
 * 4. 상품 일괄 이관 실행
 */

import { redirect } from "next/navigation";
import { isAdmin } from "@/actions/admin";
import { getCategories } from "@/actions/products";
import ImportProductsClient from "@/components/import-products-client";

// Next.js 15: Server Action 타임아웃 설정 (5분)
export const maxDuration = 300; // 5분 (기본 10초에서 증가)

export default async function ImportProductsPage() {
  const isAdminUser = await isAdmin();

  if (!isAdminUser) {
    redirect("/");
  }

  // 카테고리 목록 조회 (매핑용)
  const categories = await getCategories();

  return (
    <main className="py-8 bg-gray-50 min-h-screen">
      <div className="shop-container">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#4a3f48] mb-2">
            상품 데이터 이관
          </h1>
          <p className="text-sm text-[#8b7d84]">
            스마트스토어에서 내보낸 CSV 또는 Excel 파일을 업로드하여 상품을 일괄 등록할 수 있습니다.
          </p>
        </div>

        <ImportProductsClient categories={categories} />
      </div>
    </main>
  );
}

