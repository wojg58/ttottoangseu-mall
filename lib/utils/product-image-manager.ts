/**
 * @file lib/utils/product-image-manager.ts
 * @description 상품 이미지 관리 유틸리티
 *
 * 상품 이미지의 추가, 업데이트, 삭제 로직을 담당합니다.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  extractFilePathFromUrl,
  extractBucketFromUrl,
} from "@/lib/utils/storage-url";

export interface ImageInput {
  id?: string;
  image_url: string;
  is_primary: boolean;
  sort_order: number;
  alt_text?: string | null;
}

/**
 * 상품 이미지 업데이트
 */
export async function updateProductImages(
  supabase: SupabaseClient,
  productId: string,
  images: ImageInput[],
  deletedImageIds?: string[],
): Promise<void> {
  logger.debug("[updateProductImages] 이미지 업데이트 시작");
  logger.debug("[updateProductImages] 전달된 이미지 수:", images.length);
  logger.debug(
    "[updateProductImages] 명시적으로 삭제할 이미지 ID 목록:",
    deletedImageIds || [],
  );

  // 기존 이미지 목록 가져오기 (image_url 포함)
  const { data: existingImages } = await supabase
    .from("product_images")
    .select("id, image_url")
    .eq("product_id", productId);

  logger.debug(
    "[updateProductImages] 기존 이미지 수:",
    existingImages?.length || 0,
  );

  // 전달된 이미지 중 기존 이미지 ID 추출
  const existingImageIds = images
    .map((img) => img.id)
    .filter((id): id is string => !!id);

  // 삭제할 이미지 ID 결정
  let imagesToDelete: Array<{ id: string; image_url: string }> = [];

  if (deletedImageIds && deletedImageIds.length > 0) {
    // 명시적으로 삭제할 이미지 ID 사용
    logger.debug(
      "[updateProductImages] 명시적 삭제 모드: 삭제할 이미지 ID 목록 사용",
    );
    imagesToDelete =
      existingImages?.filter((img) => deletedImageIds.includes(img.id)) || [];
  } else {
    // 기존 로직: 기존에 있지만 전달되지 않은 이미지
    logger.debug(
      "[updateProductImages] 자동 삭제 모드: 전달되지 않은 이미지 삭제",
    );
    imagesToDelete =
      existingImages?.filter((img) => !existingImageIds.includes(img.id)) ||
      [];
  }

  logger.debug(
    "[updateProductImages] 삭제 대상 이미지 수:",
    imagesToDelete.length,
  );

  // 삭제할 이미지가 있으면 삭제
  if (imagesToDelete.length > 0) {
    await deleteProductImages(supabase, productId, imagesToDelete);
  }

  // 대표 이미지로 설정하는 경우, 기존 대표 이미지 해제
  const hasPrimaryImage = images.some((img) => img.is_primary);
  if (hasPrimaryImage) {
    await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId)
      .eq("is_primary", true);
  }

  // 새로 추가할 이미지와 업데이트할 이미지 분리
  const imagesToInsert: Array<{
    product_id: string;
    image_url: string;
    is_primary: boolean;
    sort_order: number;
    alt_text: string | null;
  }> = [];
  const imagesToUpdate: Array<{
    id: string;
    is_primary?: boolean;
    sort_order?: number;
    alt_text?: string | null;
  }> = [];

  images.forEach((img) => {
    if (img.id) {
      // 기존 이미지 업데이트
      imagesToUpdate.push({
        id: img.id,
        is_primary: img.is_primary,
        sort_order: img.sort_order,
        alt_text: img.alt_text ?? null,
      });
    } else {
      // 새 이미지 추가
      imagesToInsert.push({
        product_id: productId,
        image_url: img.image_url,
        is_primary: img.is_primary,
        sort_order: img.sort_order,
        alt_text: img.alt_text ?? null,
      });
    }
  });

  // 기존 이미지 업데이트
  if (imagesToUpdate.length > 0) {
    logger.debug(
      `[updateProductImages] 업데이트할 이미지 수: ${imagesToUpdate.length}`,
    );
    for (const img of imagesToUpdate) {
      const { error: updateError } = await supabase
        .from("product_images")
        .update({
          is_primary: img.is_primary,
          sort_order: img.sort_order,
          alt_text: img.alt_text,
        })
        .eq("id", img.id);

      if (updateError) {
        logger.error(
          `[updateProductImages] 이미지 ${img.id} 업데이트 에러:`,
          updateError,
        );
      } else {
        logger.debug(`[updateProductImages] 이미지 ${img.id} 업데이트 성공`);
      }
    }
    logger.info(
      `[updateProductImages] 기존 이미지 ${imagesToUpdate.length}개 업데이트 완료`,
    );
  }

  // 새 이미지 추가
  if (imagesToInsert.length > 0) {
    logger.debug(
      `[updateProductImages] 추가할 이미지 수: ${imagesToInsert.length}`,
    );
    const { error: insertImageError } = await supabase
      .from("product_images")
      .insert(imagesToInsert);

    if (insertImageError) {
      logger.error("이미지 추가 에러:", insertImageError);
    } else {
      logger.info(`새 이미지 ${imagesToInsert.length}개 추가 완료`);
    }
  }

  logger.info("[updateProductImages] 이미지 업데이트 완료");
}

/**
 * 상품 이미지 삭제 (Storage 파일 및 DB 레코드)
 */
async function deleteProductImages(
  supabase: SupabaseClient,
  productId: string,
  imagesToDelete: Array<{ id: string; image_url: string }>,
): Promise<void> {
  const deleteIds = imagesToDelete.map((img) => img.id);

  logger.group(`[deleteProductImages] ${deleteIds.length}개 이미지 삭제 시작`);

  // Storage에서 파일 삭제
  let storageDeleteSuccessCount = 0;
  let storageDeleteFailCount = 0;

  for (const imageToDelete of imagesToDelete) {
    if (imageToDelete.image_url) {
      logger.debug(
        `[deleteProductImages] 삭제 대상 이미지 URL: ${imageToDelete.image_url}`,
      );

      const filePath = extractFilePathFromUrl(imageToDelete.image_url);
      const bucketName = extractBucketFromUrl(imageToDelete.image_url);

      logger.debug(`[deleteProductImages] 추출된 정보:`, {
        filePath,
        bucketName,
      });

      if (filePath && bucketName) {
        try {
          logger.debug(
            `[deleteProductImages] Storage 파일 삭제 시도: ${bucketName}/${filePath}`,
          );
          const { data, error: storageError } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);

          if (storageError) {
            logger.error(
              `[deleteProductImages] Storage 파일 삭제 실패 (${bucketName}/${filePath}):`,
              storageError,
            );
            storageDeleteFailCount++;
            // Storage 삭제 실패해도 계속 진행 (이미 삭제된 파일일 수 있음)
          } else {
            logger.debug(
              `[deleteProductImages] Storage 파일 삭제 성공: ${bucketName}/${filePath}`,
            );
            logger.debug(`[deleteProductImages] 삭제 결과:`, data);
            storageDeleteSuccessCount++;
          }
        } catch (error) {
          logger.error(
            `[deleteProductImages] Storage 파일 삭제 중 예외 발생:`,
            error,
          );
          storageDeleteFailCount++;
        }
      } else {
        // 외부 URL인 경우 (네이버 스마트스토어 등) - Storage에 없으므로 삭제할 필요 없음
        const isSupabaseUrl = imageToDelete.image_url.includes(
          "supabase.co/storage",
        );
        const isExternalUrl =
          !isSupabaseUrl &&
          (imageToDelete.image_url.includes("shop-phinf.pstatic.net") ||
            imageToDelete.image_url.startsWith("http://") ||
            imageToDelete.image_url.startsWith("https://"));

        if (isExternalUrl) {
          logger.debug(
            `[deleteProductImages] 외부 URL이므로 Storage 삭제 건너뜀: ${imageToDelete.image_url}`,
          );
          storageDeleteSuccessCount++; // 외부 URL은 성공으로 간주
        } else {
          logger.warn(
            `[deleteProductImages] 파일 경로 또는 버킷 추출 실패: ${imageToDelete.image_url}`,
          );
          storageDeleteFailCount++;
        }
      }
    }
  }

  logger.info(
    `[deleteProductImages] Storage 삭제 결과: 성공 ${storageDeleteSuccessCount}개, 실패 ${storageDeleteFailCount}개`,
  );

  // 데이터베이스에서 이미지 레코드 삭제 (Storage 삭제 실패해도 DB는 삭제)
  // ⚠️ 중요: RLS 정책을 우회하기 위해 Service Role 클라이언트 사용
  try {
    logger.debug(
      `[deleteProductImages] 데이터베이스에서 이미지 삭제 시도: ${deleteIds.length}개`,
    );

    // Service Role 클라이언트 가져오기 (RLS 우회)
    const { getServiceRoleClient } = await import(
      "@/lib/supabase/service-role"
    );
    const serviceRoleSupabase = getServiceRoleClient();

    // 삭제 전에 실제로 존재하는 이미지 ID만 필터링
    const { data: existingImageIds, error: checkError } =
      await serviceRoleSupabase
        .from("product_images")
        .select("id")
        .eq("product_id", productId)
        .in("id", deleteIds);

    if (checkError) {
      logger.error("[deleteProductImages] 이미지 존재 확인 에러:", checkError);
    } else {
      const validDeleteIds = existingImageIds?.map((img) => img.id) || [];
      const invalidIds = deleteIds.filter((id) => !validDeleteIds.includes(id));

      if (invalidIds.length > 0) {
        logger.warn(
          `[deleteProductImages] 존재하지 않는 이미지 ID (무시됨):`,
          invalidIds,
        );
      }

      if (validDeleteIds.length > 0) {
        logger.debug(
          `[deleteProductImages] Service Role 클라이언트로 이미지 삭제 실행: ${validDeleteIds.length}개`,
        );
        const { data: deleteResult, error: deleteImageError } =
          await serviceRoleSupabase
            .from("product_images")
            .delete()
            .in("id", validDeleteIds)
            .select(); // 삭제된 레코드 반환

        if (deleteImageError) {
          logger.error(
            "[deleteProductImages] 데이터베이스 이미지 삭제 에러:",
            deleteImageError,
          );
          throw new Error(`이미지 삭제 실패: ${deleteImageError.message}`);
        } else {
          logger.info(
            `[deleteProductImages] 데이터베이스에서 이미지 ${validDeleteIds.length}개 삭제 완료`,
          );
          logger.debug(`[deleteProductImages] 삭제된 레코드:`, deleteResult);
        }
      } else {
        logger.warn("[deleteProductImages] 삭제할 유효한 이미지가 없습니다.");
      }
    }
  } catch (error) {
    logger.error(
      "[deleteProductImages] 데이터베이스 이미지 삭제 중 예외 발생:",
      error,
    );
    // 이미지 삭제 실패 시에도 상품 수정은 계속 진행하되, 경고 메시지 반환
    logger.warn(
      "[deleteProductImages] 이미지 삭제 실패했지만 상품 수정은 계속 진행합니다.",
    );
  }

  logger.groupEnd();
}

