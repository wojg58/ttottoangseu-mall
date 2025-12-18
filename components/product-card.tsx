/**
 * @file components/product-card.tsx
 * @description 상품 카드 컴포넌트
 *
 * 주요 기능:
 * 1. 상품 이미지, 이름, 가격 표시
 * 2. 할인율 계산 및 표시
 * 3. NEW, BEST, 품절 뱃지 표시
 * 4. 찜하기 버튼
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { useState, useEffect } from "react";
import type { ProductListItem } from "@/types/database";

interface ProductCardProps {
  product: ProductListItem;
  rank?: number; // 베스트 상품 순위
}

export default function ProductCard({ product, rank }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 할인율 계산
  const discountRate =
    product.discount_price && product.price > 0
      ? Math.round(
          ((product.price - product.discount_price) / product.price) * 100,
        )
      : 0;

  // 표시 가격 (할인가 또는 정가)
  const displayPrice = product.discount_price ?? product.price;

  // 품절 여부
  const isSoldOut = product.status === "sold_out" || product.stock === 0;

  console.log("[ProductCard] 렌더링:", product.name, {
    isSoldOut,
    discountRate,
  });

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLiked(!isLiked);
    console.log("[ProductCard] 찜하기 클릭:", product.name, !isLiked);
    // TODO: 찜하기 기능 구현
  };

  return (
    <Link href={`/products/${product.slug}`} className="product-card group">
      {/* 이미지 영역 */}
      <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-[#f5f5f5] p-4">
        {/* 상품 이미지 */}
        <Image
          src={
            product.primary_image?.image_url ||
            "https://placehold.co/600x600/fad2e6/333333?text=No+Image"
          }
          alt={product.primary_image?.alt_text || product.name}
          fill
          className="product-image"
          style={{ objectFit: "contain" }}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
        />

        {/* 순위 뱃지 (베스트 상품인 경우) */}
        {rank && (
          <span className="absolute top-0 left-0 bg-[#4a3f48] text-white text-xs font-bold px-3 py-1 rounded-br-lg">
            {rank}
          </span>
        )}

        {/* NEW 뱃지 */}
        {product.is_new && !rank && (
          <span className="absolute top-2 left-2 shop-badge-new">NEW</span>
        )}

        {/* BEST 뱃지 */}
        {product.is_featured && !rank && !product.is_new && (
          <span className="absolute top-2 left-2 shop-badge bg-[#ff6b9d] text-white">
            BEST
          </span>
        )}

        {/* 품절 오버레이 */}
        {isSoldOut && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="bg-gray-700/80 text-white px-4 py-2 rounded-sm text-sm font-medium">
              품절
            </span>
          </div>
        )}

        {/* 찜하기 버튼 */}
        <button
          onClick={handleLikeClick}
          className="absolute top-2 right-2 p-2 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
        >
          <Heart
            className={`w-4 h-4 ${
              isLiked ? "fill-[#ff6b9d] text-[#ff6b9d]" : "text-gray-400"
            }`}
          />
        </button>
      </div>

      {/* 상품 정보 */}
      <div className="px-1">
        {/* 카테고리 */}
        <p className="text-xs text-black mb-1">{product.category.name}</p>

        {/* 상품명 */}
        <h3 className="text-sm text-black leading-snug line-clamp-2 mb-2 group-hover:text-[#ff6b9d] transition-colors">
          {product.name}
        </h3>

        {/* 가격 정보 */}
        <div className="flex items-baseline gap-2 flex-wrap">
          {discountRate > 0 && (
            <span className="text-[#ff6b9d] font-bold text-sm">
              {discountRate}%
            </span>
          )}
          <span className="shop-price">
            {mounted
              ? displayPrice.toLocaleString("ko-KR")
              : displayPrice.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            }원
          </span>
          {discountRate > 0 && (
            <span className="shop-price-original">
              {mounted
                ? product.price.toLocaleString("ko-KR")
                : product.price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
              }원
            </span>
          )}
        </div>

        {/* 리뷰 (TODO: 실제 리뷰 데이터 연동) */}
        <div className="flex items-center gap-1 mt-2 text-xs text-black">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">4.8</span>
          <span>리뷰 12</span>
        </div>
      </div>
    </Link>
  );
}
