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
import { useState, useMemo, memo } from "react";
import type { ProductListItem } from "@/types/database";
import { formatPrice } from "@/lib/utils";

interface ProductCardProps {
  product: ProductListItem;
  rank?: number; // 베스트 상품 순위
}

function ProductCardComponent({ product, rank }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [imageError, setImageError] = useState(false);

  // 메모이제이션된 계산값들
  const { discountRate, displayPrice, isSoldOut } = useMemo(() => {
    const discount =
      product.discount_price && product.price > 0
        ? Math.round(
            ((product.price - product.discount_price) / product.price) * 100,
          )
        : 0;

    return {
      discountRate: discount,
      displayPrice: product.discount_price ?? product.price,
      isSoldOut: product.status === "sold_out" || product.stock === 0,
    };
  }, [product.discount_price, product.price, product.status, product.stock]);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLiked(!isLiked);
    // NOTE: 찜하기 기능은 향후 구현 예정 (현재는 클라이언트 상태만 관리)
  };

  const handleImageError = () => {
    console.warn(
      "[ProductCard] 이미지 로딩 실패:",
      product.primary_image?.image_url,
    );
    setImageError(true);
  };

  return (
    <Link href={`/products/${product.slug}`} className="product-card group">
      {/* 이미지 영역 */}
      <div className="relative aspect-square mb-3 rounded-xl overflow-hidden bg-[#f5f5f5] border border-gray-300">
        {/* 상품 이미지 */}
        {!imageError && product.primary_image?.image_url ? (
          <Image
            src={product.primary_image.image_url}
            alt={product.primary_image.alt_text || product.name}
            fill
            className="product-image"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            onError={handleImageError}
            onLoadingComplete={() => {
              console.log(
                "[ProductCard] 이미지 로딩 완료:",
                product.primary_image?.image_url,
              );
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl block mb-2">🎀</span>
              <p className="text-xs text-[#8b7d84]">이미지 준비 중</p>
            </div>
          </div>
        )}

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
          className="absolute top-2 right-2 p-3 min-w-[48px] min-h-[48px] bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white flex items-center justify-center"
          aria-label={isLiked ? "찜하기 취소" : "찜하기"}
        >
          <Heart
            className={`w-5 h-5 ${
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
          <span className="shop-price">{formatPrice(displayPrice)}</span>
          {discountRate > 0 && (
            <span className="shop-price-original">
              {formatPrice(product.price)}
            </span>
          )}
        </div>

        {/* 리뷰 (리뷰가 있을 때만 표시) */}
        {/* NOTE: 리뷰 기능은 향후 구현 예정 */}
        {false && (
          <div className="flex items-center gap-1 mt-2 text-xs text-black">
            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span className="font-medium">4.8</span>
            <span>리뷰 12</span>
          </div>
        )}
      </div>
    </Link>
  );
}

// React.memo로 불필요한 리렌더링 방지
const ProductCard = memo(ProductCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.stock === nextProps.product.stock &&
    prevProps.product.status === nextProps.product.status &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.product.discount_price === nextProps.product.discount_price &&
    prevProps.rank === nextProps.rank
  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
