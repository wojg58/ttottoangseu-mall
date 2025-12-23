/**
 * @file app/products/[slug]/page.tsx
 * @description 상품 상세 페이지
 *
 * 주요 기능:
 * 1. 상품 이미지 갤러리
 * 2. 상품 정보 (이름, 가격, 설명)
 * 3. 옵션 선택
 * 4. 수량 선택
 * 5. 장바구니 담기 / 바로 구매
 */

import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Home,
  Heart,
  Share2,
  Truck,
  Shield,
  RefreshCw,
  Star,
} from "lucide-react";
import { getProductBySlug } from "@/actions/products";
import ProductImageGallery from "@/components/product-image-gallery";
import ProductDetailOptions from "@/components/product-detail-options";

interface ProductDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;

  console.log("[ProductDetailPage] 렌더링, slug:", slug);

  // 상품 정보 조회
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  // 할인율 계산
  const discountRate =
    product.discount_price && product.price > 0
      ? Math.round(
          ((product.price - product.discount_price) / product.price) * 100,
        )
      : 0;

  // 표시 가격
  const displayPrice = product.discount_price ?? product.price;

  // 품절 여부
  const isSoldOut = product.status === "sold_out" || product.stock === 0;

  // 이미지 정렬
  const sortedImages = [...(product.images || [])].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const primaryImage =
    sortedImages.find((img) => img.is_primary) || sortedImages[0];
  
  // 상세 이미지 (대표 이미지 제외한 모든 이미지)
  const detailImages = sortedImages.filter(
    (img) => img.id !== primaryImage?.id
  );

  return (
    <main className="py-8">
      <div className="shop-container">
        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-sm text-[#8b7d84] mb-6">
          <Link
            href="/"
            className="hover:text-[#ff6b9d] flex items-center gap-1"
          >
            <Home className="w-4 h-4" />홈
          </Link>
          <span>/</span>
          <Link href="/products" className="hover:text-[#ff6b9d]">
            상품
          </Link>
          <span>/</span>
          <Link
            href={`/products/category/${product.category.slug}`}
            className="hover:text-[#ff6b9d]"
          >
            {product.category.name}
          </Link>
          <span>/</span>
          <span className="text-[#4a3f48] truncate max-w-[200px]">
            {product.name}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* 왼쪽: 이미지 갤러리 */}
          <ProductImageGallery
            images={sortedImages}
            productName={product.name}
          />

          {/* 오른쪽: 상품 정보 */}
          <div className="flex flex-col">
            {/* 뱃지 */}
            <div className="flex items-center gap-2 mb-3">
              {product.is_new && <span className="shop-badge-new">NEW</span>}
              {product.is_featured && (
                <span className="shop-badge bg-[#ff6b9d] text-white">BEST</span>
              )}
              {isSoldOut && <span className="shop-badge-soldout">품절</span>}
            </div>

            {/* 카테고리 */}
            <Link
              href={`/products/category/${product.category.slug}`}
              className="text-sm text-[#8b7d84] hover:text-[#ff6b9d] mb-2"
            >
              {product.category.name}
            </Link>

            {/* 상품명 */}
            <h1 className="text-2xl lg:text-3xl font-bold text-[#4a3f48] mb-4">
              {product.name}
            </h1>

            {/* 리뷰 (리뷰가 있을 때만 표시) */}
            {/* TODO: 실제 리뷰 데이터 연동 시 reviewCount와 averageRating 사용 */}
            {false && (
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= 4
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-gray-200 text-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-[#4a3f48] font-medium">4.8</span>
                <span className="text-sm text-[#8b7d84]">(리뷰 12개)</span>
              </div>
            )}

            {/* 가격 */}
            <div className="bg-[#ffeef5] rounded-xl p-6 mb-6">
              <div className="flex items-baseline gap-3 flex-wrap">
                {discountRate > 0 && (
                  <span className="text-2xl font-bold text-[#ff6b9d]">
                    {discountRate}%
                  </span>
                )}
                <span className="text-3xl font-bold text-[#4a3f48]">
                  {displayPrice.toLocaleString("ko-KR")}원
                </span>
                {discountRate > 0 && (
                  <span className="text-lg text-[#8b7d84] line-through">
                    {product.price.toLocaleString("ko-KR")}원
                  </span>
                )}
              </div>
              {discountRate > 0 && (
                <p className="text-sm text-[#ff6b9d] mt-2">
                  🎉 {(product.price - displayPrice).toLocaleString("ko-KR")}원 할인!
                </p>
              )}
            </div>

            {/* 옵션 선택 및 장바구니 버튼 */}
            <ProductDetailOptions
              productId={product.id}
              productName={product.name}
              basePrice={displayPrice}
              baseStock={product.stock}
              variants={product.variants || []}
              isSoldOut={isSoldOut}
            />

            {/* 찜하기/공유 */}
            <div className="flex items-center gap-4 mt-4">
              <button className="flex items-center gap-2 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors">
                <Heart className="w-5 h-5" />
                <span className="text-sm">찜하기</span>
              </button>
              <button className="flex items-center gap-2 text-[#8b7d84] hover:text-[#ff6b9d] transition-colors">
                <Share2 className="w-5 h-5" />
                <span className="text-sm">공유하기</span>
              </button>
            </div>

            {/* 배송/안심 정보 */}
            <div className="border-t border-[#f5d5e3] mt-6 pt-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="flex flex-col items-center gap-2">
                  <Truck className="w-6 h-6 text-[#ff6b9d]" />
                  <span className="text-xs text-[#4a3f48]">빠른 배송</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Shield className="w-6 h-6 text-[#ff6b9d]" />
                  <span className="text-xs text-[#4a3f48]">안전 결제</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 text-[#ff6b9d]" />
                  <span className="text-xs text-[#4a3f48]">교환/환불</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 상품 상세 설명 */}
        <section className="mt-12 lg:mt-16">
          <div className="border-b border-[#f5d5e3]">
            <nav className="flex gap-8">
              <button className="py-4 text-[#ff6b9d] border-b-2 border-[#ff6b9d] font-bold">
                상품 설명
              </button>
              {/* 리뷰 (리뷰가 있을 때만 숫자 표시) */}
              {/* TODO: 실제 리뷰 데이터 연동 시 reviewCount 사용 */}
              <button className="py-4 text-[#8b7d84] hover:text-[#4a3f48]">
                리뷰{false && ` (0)`}
              </button>
              {/* 문의 (문의가 있을 때만 숫자 표시) */}
              {/* TODO: 실제 문의 데이터 연동 시 inquiryCount 사용 */}
              <button className="py-4 text-[#8b7d84] hover:text-[#4a3f48]">
                문의{false && ` (3)`}
              </button>
            </nav>
          </div>

          <div className="py-8">
            {product.description ? (
              <div
                className="product-description prose prose-pink max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:my-4 [&_img]:block [&_img]:mx-auto [&_p]:text-[#4a3f48] [&_p]:leading-relaxed [&_p]:mb-4 [&_p]:mt-0 [&_p]:first:mt-0 [&_p]:last:mb-0 [&_p:empty]:mb-4 [&_p:empty]:min-h-[1rem] [&_br]:block [&_br]:my-2 [&_br+br]:my-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[#4a3f48] [&_h1]:mt-6 [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#4a3f48] [&_h2]:mt-5 [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#4a3f48] [&_h3]:mt-4 [&_h3]:mb-2 [&_ul]:list-disc [&_ul]:ml-6 [&_ul]:mb-4 [&_ol]:list-decimal [&_ol]:ml-6 [&_ol]:mb-4 [&_li]:text-[#4a3f48] [&_li]:mb-2 [&_a]:text-[#ff6b9d] [&_a]:underline [&_a]:hover:text-[#ff5088] [&_div]:mb-4 [&_div]:last:mb-0"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p className="text-[#8b7d84] text-center py-8">
                상품 설명이 없습니다.
              </p>
            )}

            {/* 상품 이미지들 (상세 이미지) - 갤러리에서 추가한 이미지들 */}
            {detailImages.length > 0 && (
              <div className="mt-8 space-y-6">
                {detailImages.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative w-full max-w-4xl mx-auto rounded-xl overflow-hidden bg-[#f5f5f5]"
                  >
                    <div className="relative aspect-video w-full">
                      <Image
                        src={image.image_url}
                        alt={
                          image.alt_text ||
                          `${product.name} 상세 이미지 ${index + 1}`
                        }
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
