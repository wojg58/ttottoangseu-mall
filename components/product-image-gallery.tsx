/**
 * @file components/product-image-gallery.tsx
 * @description 상품 이미지 갤러리 컴포넌트
 *
 * 주요 기능:
 * 1. 메인 이미지 표시
 * 2. 썸네일 리스트
 * 3. 이미지 전환
 */

"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/types/database";
import logger from "@/lib/logger-client";

interface ProductImageGalleryProps {
  images: ProductImage[];
  productName: string;
}

export default function ProductImageGallery({
  images,
  productName,
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // 이미지 정렬 (sort_order 기준, 없으면 is_primary 우선)
  const sortedImages = [...(images || [])].sort((a, b) => {
    // is_primary가 true인 것을 먼저
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    // sort_order로 정렬
    return (a.sort_order || 0) - (b.sort_order || 0);
  });

  // 이미지가 없는 경우
  if (!sortedImages || sortedImages.length === 0) {
    logger.warn("[ProductImageGallery] 이미지가 없습니다", { productName });
    return (
      <div className="aspect-square bg-[#f5f5f5] rounded-xl flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl block mb-4">🎀</span>
          <p className="text-[#8b7d84]">이미지 준비 중</p>
        </div>
      </div>
    );
  }

  const currentImage = sortedImages[selectedIndex];
  
  // 이미지 URL 유효성 검사
  if (currentImage && !currentImage.image_url) {
    logger.warn("[ProductImageGallery] 이미지 URL이 없습니다", {
      imageId: currentImage.id,
      productName,
    });
  }

  const handleImageError = (index: number) => {
    const failedImage = sortedImages[index];
    logger.warn("[ProductImageGallery] 이미지 로딩 실패", {
      index,
      imageId: failedImage?.id,
      imageUrl: failedImage?.image_url,
      productName,
    });
    console.error("[ProductImageGallery] 이미지 URL:", failedImage?.image_url);
    console.error("[ProductImageGallery] 이미지 ID:", failedImage?.id);
    setImageErrors((prev) => new Set(prev).add(index));
  };

  return (
    <div className="space-y-4">
      {/* 메인 이미지 */}
      <div className="relative aspect-square bg-[#f5f5f5] rounded-xl overflow-hidden p-4">
        {!imageErrors.has(selectedIndex) && currentImage.image_url ? (
          <Image
            src={currentImage.image_url}
            alt={currentImage.alt_text || productName}
            fill
            className="object-contain"
            sizes="(max-width: 1024px) 100vw, 50vw"
            priority
            onError={() => handleImageError(selectedIndex)}
            onLoad={() => {
              logger.info("[ProductImageGallery] 이미지 로딩 성공", {
                imageUrl: currentImage.image_url,
                productName,
              });
            }}
            unoptimized={!currentImage.image_url.includes('supabase.co') && !currentImage.image_url.includes('naver.net')}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl block mb-2">🎀</span>
              <p className="text-sm text-[#8b7d84]">이미지 준비 중</p>
              {currentImage?.image_url && (
                <p className="text-xs text-red-500 mt-2 break-all px-4">
                  URL: {currentImage.image_url.substring(0, 50)}...
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 썸네일 리스트 */}
      {sortedImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sortedImages.map((image, index) => (
            <button
              key={image.id}
              onClick={() => {
                setSelectedIndex(index);
              }}
              className={`relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 bg-[#f5f5f5] p-1 transition-colors ${
                selectedIndex === index
                  ? "border-[#ff6b9d]"
                  : "border-transparent hover:border-[#fad2e6]"
              }`}
            >
              {!imageErrors.has(index) && image.image_url ? (
                <Image
                  src={image.image_url}
                  alt={image.alt_text || `${productName} ${index + 1}`}
                  fill
                  className="object-contain"
                  sizes="80px"
                  onError={() => handleImageError(index)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <span className="text-xs text-gray-400">🎀</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
