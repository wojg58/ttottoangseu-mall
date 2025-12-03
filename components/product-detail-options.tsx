/**
 * @file components/product-detail-options.tsx
 * @description 상품 상세 페이지 옵션 선택 및 장바구니 버튼 영역
 *
 * 주요 기능:
 * 1. 옵션 선택 (ProductVariantSelector)
 * 2. 선택된 옵션에 따른 가격 계산
 * 3. 선택된 옵션에 따른 재고 표시
 * 4. 장바구니 담기 버튼
 */

"use client";

import { useState } from "react";
import type { ProductVariant } from "@/types/database";
import ProductVariantSelector from "@/components/product-variant-selector";
import AddToCartButton from "@/components/add-to-cart-button";

interface ProductDetailOptionsProps {
  productId: string;
  productName: string;
  basePrice: number;
  baseStock: number;
  variants: ProductVariant[];
  isSoldOut: boolean;
}

export default function ProductDetailOptions({
  productId,
  productName,
  basePrice,
  baseStock,
  variants,
  isSoldOut,
}: ProductDetailOptionsProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  console.log("[ProductDetailOptions] 렌더링:", {
    productId,
    selectedVariant: selectedVariant?.id,
  });

  // 선택된 옵션이 있는 경우 해당 옵션의 가격과 재고 사용
  const finalPrice = selectedVariant
    ? basePrice + (selectedVariant.price_adjustment || 0)
    : basePrice;

  const finalStock = selectedVariant
    ? selectedVariant.stock
    : baseStock;

  const finalIsSoldOut = isSoldOut || (selectedVariant ? selectedVariant.stock === 0 : false);

  // 옵션이 있고 필수인 경우 선택 여부 확인
  const hasVariants = variants && variants.filter((v) => !v.deleted_at).length > 0;
  const requiresVariant = hasVariants && !selectedVariant;

  const handleVariantChange = (variantId: string | null, variant: ProductVariant | null) => {
    console.log("[ProductDetailOptions] 옵션 변경:", { variantId, variant: variant?.variant_value });
    setSelectedVariant(variant);
  };

  return (
    <div className="space-y-6">
      {/* 옵션 선택 */}
      {hasVariants && (
        <div className="mb-6">
          <ProductVariantSelector
            variants={variants}
            basePrice={basePrice}
            onVariantChange={handleVariantChange}
            required={true}
          />
        </div>
      )}

      {/* 재고 표시 */}
      <div className="mb-6">
        <p className="text-sm text-[#8b7d84]">
          {finalIsSoldOut ? (
            <span className="text-red-500">품절된 상품입니다</span>
          ) : finalStock <= 5 ? (
            <span className="text-orange-500">
              🔥 {finalStock}개 남음 - 품절 임박!
            </span>
          ) : (
            <span>재고: {finalStock}개</span>
          )}
        </p>
      </div>

      {/* 장바구니/구매 버튼 */}
      <AddToCartButton
        productId={productId}
        productName={productName}
        price={finalPrice}
        stock={finalStock}
        isSoldOut={finalIsSoldOut || requiresVariant}
        variantId={selectedVariant?.id}
      />
    </div>
  );
}

