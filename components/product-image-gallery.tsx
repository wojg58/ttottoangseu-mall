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

interface ProductImageGalleryProps {
  images: ProductImage[];
  productName: string;
}

export default function ProductImageGallery({
  images,
  productName,
}: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  console.log("[ProductImageGallery] 렌더링, 이미지 수:", images.length);

  // 이미지가 없는 경우
  if (!images || images.length === 0) {
    return (
      <div className="aspect-square bg-[#f5f5f5] rounded-xl flex items-center justify-center">
        <div className="text-center">
          <span className="text-6xl block mb-4">🎀</span>
          <p className="text-[#8b7d84]">이미지 준비 중</p>
        </div>
      </div>
    );
  }

  const currentImage = images[selectedIndex];

  return (
    <div className="space-y-4">
      {/* 메인 이미지 */}
      <div className="relative aspect-square bg-[#f5f5f5] rounded-xl overflow-hidden p-4">
        <Image
          src={currentImage.image_url}
          alt={currentImage.alt_text || productName}
          fill
          className="object-contain"
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
        />
      </div>

      {/* 썸네일 리스트 */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              onClick={() => {
                setSelectedIndex(index);
                console.log("[ProductImageGallery] 이미지 선택:", index);
              }}
              className={`relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 bg-[#f5f5f5] p-1 transition-colors ${
                selectedIndex === index
                  ? "border-[#ff6b9d]"
                  : "border-transparent hover:border-[#fad2e6]"
              }`}
            >
              <Image
                src={image.image_url}
                alt={image.alt_text || `${productName} ${index + 1}`}
                fill
                className="object-contain"
                sizes="80px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
