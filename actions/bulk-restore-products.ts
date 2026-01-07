/**
 * @file actions/bulk-restore-products.ts
 * @description 모든 삭제된 상품 일괄 복구 처리 Server Action
 *
 * 소프트 삭제된 상품들의 deleted_at을 NULL로 설정하여 복구합니다.
 * slug 충돌이 있는 경우 자동으로 slug를 변경합니다.
 */

"use server";

import { isAdmin } from "./admin";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { revalidatePath } from "next/cache";

/**
 * 모든 삭제된 상품을 복구 처리
 */
export async function restoreAllProducts(): Promise<{
  success: boolean;
  message: string;
  restoredCount?: number;
  conflictCount?: number;
}> {
  console.group("[restoreAllProducts] 모든 삭제된 상품 복구 처리 시작");

  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    console.log("관리자 권한 없음");
    console.groupEnd();
    return {
      success: false,
      message: "관리자 권한이 필요합니다.",
    };
  }

  try {
    const supabase = getServiceRoleClient();

    // 복구 전 삭제된 상품 수 확인
    const { data: deletedProducts, error: fetchError } = await supabase
      .from("products")
      .select("id, slug, name")
      .not("deleted_at", "is", null);

    if (fetchError) {
      console.error("삭제된 상품 조회 에러:", fetchError);
      console.groupEnd();
      return {
        success: false,
        message: `삭제된 상품 조회에 실패했습니다: ${fetchError.message}`,
      };
    }

    if (!deletedProducts || deletedProducts.length === 0) {
      console.log("복구할 상품이 없습니다.");
      console.groupEnd();
      return {
        success: false,
        message: "복구할 삭제된 상품이 없습니다.",
      };
    }

    console.log(`복구 전 삭제된 상품 수: ${deletedProducts.length}`);

    // 활성 상품의 slug 목록 조회 (충돌 확인용)
    const { data: activeProducts, error: activeError } = await supabase
      .from("products")
      .select("slug")
      .is("deleted_at", null);

    if (activeError) {
      console.error("활성 상품 조회 에러:", activeError);
      console.groupEnd();
      return {
        success: false,
        message: `활성 상품 조회에 실패했습니다: ${activeError.message}`,
      };
    }

    const activeSlugs = new Set((activeProducts || []).map((p) => p.slug));
    console.log(`활성 상품 slug 수: ${activeSlugs.size}`);

    // 삭제된 상품들 간의 slug 중복도 확인
    const deletedSlugCounts = new Map<string, number>();
    deletedProducts.forEach((p) => {
      deletedSlugCounts.set(p.slug, (deletedSlugCounts.get(p.slug) || 0) + 1);
    });

    let restoredCount = 0;
    let conflictCount = 0;
    const usedSlugs = new Set(activeSlugs); // 이미 사용 중인 slug 추적

    // 각 삭제된 상품을 개별적으로 처리 (slug 충돌 해결)
    for (const deletedProduct of deletedProducts) {
      let finalSlug = deletedProduct.slug;
      let needsSlugUpdate = false;

      // slug 충돌 확인
      // 1. 활성 상품과의 충돌
      // 2. 삭제된 상품들 간의 중복 (같은 slug를 가진 삭제된 상품이 여러 개)
      const hasActiveConflict = activeSlugs.has(deletedProduct.slug);
      const hasDeletedConflict = (deletedSlugCounts.get(deletedProduct.slug) || 0) > 1;
      const isSlugUsed = usedSlugs.has(deletedProduct.slug);

      if (hasActiveConflict || hasDeletedConflict || isSlugUsed) {
        console.log(
          `[restoreAllProducts] slug 충돌 발견: ${deletedProduct.slug} (상품 ID: ${deletedProduct.id})`,
        );
        needsSlugUpdate = true;
        conflictCount++;

        // 고유한 slug 생성 (타임스탬프 + 상품 ID + 랜덤 문자열)
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        finalSlug = `${deletedProduct.slug}-restored-${deletedProduct.id}-${timestamp}-${random}`;

        // 새 slug도 충돌하는지 확인 (최대 10회 재시도)
        let retryCount = 0;
        while (usedSlugs.has(finalSlug) && retryCount < 10) {
          const newRandom = Math.random().toString(36).substring(2, 10);
          finalSlug = `${deletedProduct.slug}-restored-${deletedProduct.id}-${timestamp}-${newRandom}`;
          retryCount++;
        }

        console.log(
          `[restoreAllProducts] slug 변경: ${deletedProduct.slug} -> ${finalSlug}`,
        );
      }

      // 상품 복구 (slug 충돌이 있으면 slug도 함께 업데이트)
      const updateData: { deleted_at: null; updated_at: string; slug?: string } =
        {
          deleted_at: null,
          updated_at: new Date().toISOString(),
        };

      if (needsSlugUpdate) {
        updateData.slug = finalSlug;
      }

      const { error: updateError } = await supabase
        .from("products")
        .update(updateData)
        .eq("id", deletedProduct.id);

      if (updateError) {
        console.error(
          `[restoreAllProducts] 상품 복구 실패 (ID: ${deletedProduct.id}):`,
          updateError,
        );
        // 개별 실패는 로그만 남기고 계속 진행
        continue;
      }

      restoredCount++;
      // 사용된 slug 목록에 추가 (다음 상품 복구 시 충돌 방지)
      usedSlugs.add(finalSlug);
    }

    console.log(`복구된 상품 수: ${restoredCount}`);
    console.log(`slug 충돌로 인해 slug가 변경된 상품 수: ${conflictCount}`);

    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath("/");

    console.log("모든 삭제된 상품 복구 처리 완료");
    console.groupEnd();

    let message = `${restoredCount}개 상품이 복구되었습니다.`;
    if (conflictCount > 0) {
      message += ` (${conflictCount}개 상품의 slug가 충돌로 인해 변경되었습니다)`;
    }

    return {
      success: true,
      message,
      restoredCount,
      conflictCount,
    };
  } catch (error) {
    console.error("에러:", error);
    console.groupEnd();
    return {
      success: false,
      message: `상품 복구에 실패했습니다: ${
        error instanceof Error ? error.message : "알 수 없는 오류"
      }`,
    };
  }
}

