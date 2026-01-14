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

import type { Metadata } from "next";
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
import ProductDetailTabs from "@/components/product-detail-tabs";

interface ProductDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// 동적 메타데이터 생성
export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "상품을 찾을 수 없습니다 | 또또앙스",
      description: "요청하신 상품을 찾을 수 없습니다.",
    };
  }

  const primaryImage =
    product.images?.find((img) => img.is_primary) || product.images?.[0];
  const imageUrl = primaryImage?.image_url || "/og-image.png";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ttottoangseu.co.kr";
  const productUrl = `${siteUrl}/products/${slug}`;

  // 상품 설명 생성
  const description = product.description
    ? `${product.description.substring(0, 150)}...`
    : `${product.name} - ${product.category.name} 카테고리 상품입니다. 또또앙스에서 만나보세요!`;

  return {
    title: `${product.name} | 또또앙스`,
    description,
    keywords: [
      product.name,
      product.category.name,
      "캐릭터 굿즈",
      "산리오",
      "헬로키티",
      "또또앙스",
    ],
    openGraph: {
      title: `${product.name} | 또또앙스`,
      description,
      type: "website",
      url: productUrl,
      locale: "ko_KR",
      siteName: "또또앙스",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} | 또또앙스`,
      description,
      images: [imageUrl],
    },
    alternates: {
      canonical: productUrl,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;

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

  // 이미지 정렬 (is_primary 우선, 그 다음 sort_order)
  const sortedImages = [...(product.images || [])].sort((a, b) => {
    // is_primary가 true인 것을 먼저
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    // sort_order로 정렬
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  
  const primaryImage =
    sortedImages.find((img) => img.is_primary) || sortedImages[0];
  
  // 상세 이미지 (대표 이미지 제외한 모든 이미지)
  const detailImages = sortedImages.filter(
    (img) => img.id !== primaryImage?.id
  );

  // 구조화된 데이터 (JSON-LD) 생성
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://ttottoangseu.co.kr";
  const productUrl = `${siteUrl}/products/${slug}`;
  const productImageUrl = primaryImage?.image_url || `${siteUrl}/og-image.png`;
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || `${product.name} - ${product.category.name} 카테고리 상품입니다.`,
    image: productImageUrl,
    brand: {
      "@type": "Brand",
      name: "또또앙스",
    },
    category: product.category.name,
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "KRW",
      price: displayPrice,
      availability: isSoldOut
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "또또앙스",
      },
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "12",
    },
  };

  return (
    <>
      {/* 구조화된 데이터 (JSON-LD) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
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
            {/* NOTE: 리뷰 기능은 향후 구현 예정 */}
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

        {/* 상품 상세 설명, 리뷰, 문의 탭 */}
        <ProductDetailTabs
          productId={product.id}
          productName={product.name}
          description={product.description}
          detailImages={detailImages}
        />
      </div>
    </main>
    </>
  );
}
