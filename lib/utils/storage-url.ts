/**
 * @file lib/utils/storage-url.ts
 * @description Supabase Storage URL 파싱 유틸리티
 *
 * 주요 기능:
 * 1. Supabase Storage URL에서 파일 경로 추출
 * 2. Supabase Storage URL에서 버킷 이름 추출
 *
 * @dependencies
 * - 없음 (순수 유틸리티 함수)
 */

/**
 * Supabase Storage URL에서 파일 경로를 추출합니다.
 * 
 * @param imageUrl - Supabase Storage URL (예: https://xxx.supabase.co/storage/v1/object/public/product-images/products/xxx.webp)
 * @returns 파일 경로 (예: products/xxx.webp) 또는 null
 * 
 * @example
 * ```typescript
 * const url = "https://xxx.supabase.co/storage/v1/object/public/product-images/products/image.webp";
 * const path = extractFilePathFromUrl(url);
 * // 결과: "products/image.webp"
 * ```
 */
export function extractFilePathFromUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    // /storage/v1/object/public/product-images/ 또는 /storage/v1/object/sign/product-images/ 경로에서 파일 경로 추출
    const productImagesMatch = url.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign)\/product-images\/(.+)$/,
    );
    if (productImagesMatch && productImagesMatch[1]) {
      return productImagesMatch[1];
    }
    // 하위 호환성: uploads 버킷도 지원
    const uploadsMatch = url.pathname.match(
      /\/storage\/v1\/object\/(?:public|sign)\/uploads\/(.+)$/,
    );
    if (uploadsMatch && uploadsMatch[1]) {
      return uploadsMatch[1];
    }
    return null;
  } catch (error) {
    console.error("[extractFilePathFromUrl] URL 파싱 에러:", error);
    return null;
  }
}

/**
 * Supabase Storage URL에서 버킷 이름을 추출합니다.
 * 
 * @param imageUrl - Supabase Storage URL
 * @returns 버킷 이름 (예: "product-images" 또는 "uploads") 또는 null
 * 
 * @example
 * ```typescript
 * const url = "https://xxx.supabase.co/storage/v1/object/public/product-images/products/image.webp";
 * const bucket = extractBucketFromUrl(url);
 * // 결과: "product-images"
 * ```
 */
export function extractBucketFromUrl(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    // product-images 버킷 확인
    if (url.pathname.includes("/product-images/")) {
      return "product-images";
    }
    // uploads 버킷 확인 (하위 호환성)
    if (url.pathname.includes("/uploads/")) {
      return "uploads";
    }
    return null;
  } catch (error) {
    console.error("[extractBucketFromUrl] URL 파싱 에러:", error);
    return null;
  }
}

