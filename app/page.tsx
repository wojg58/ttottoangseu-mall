/**
 * @file app/page.tsx
 * @description 또또앙스 쇼핑몰 홈페이지
 *
 * 주요 기능:
 * 1. 메인 배너 / 히어로 섹션
 * 2. 베스트 상품 섹션
 * 3. 신상품 섹션
 * 4. 카테고리 섹션
 *
 * @dependencies
 * - Supabase: 상품 데이터 fetching
 */

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { createPublicClient } from "@/lib/supabase/server";
import ProductCard from "@/components/product-card";
import AllProductsSection from "@/components/all-products-section";
import EventBanner from "@/components/event-banner";
import WallpaperPreview from "@/components/WallpaperPreview";
import logger from "@/lib/logger";
import type { ProductListItem, Category } from "@/types/database";

// 베스트 상품 목록 (4개)
const BEST_PRODUCT_NAMES = [
  "산리오 헬로키티 블랙엔젤 스타일업 롱다리 마스코트 인형 키링 그레이 드레스",
  "산리오 헬로키티 판타지 스타일업 시리즈 롱다리 태닝 코갸류 마스코트 인형 키링",
  "유키오 마스코트 인형 키링",
  "ttotto_pr_081 유키오 동물 시리즈 마스코트 인형 키링",
];

// 전체 상품 목록 (20개)
const ALL_PRODUCT_NAMES = [
  "산리오 헬로키티 고고걸 갸류 스타일업 마스코트 호피 태닝 롱다리 인형 키링",
  "산리오 헬로키티 MC컬렉션 마스코트 스탠다드 인형 키링",
  "산리오 헬로키티 MC컬렉션 마스코트 바니 토끼 인형 키링",
  "산리오 MC컬렉션 마스코트 머메이드 인어 인형 키링",
  "산리오 헬로키티 MC컬렉션 마스코트 애니멀 호피 인형 키링",
  "산리오 헬로키티 MC컬렉션 마스코트 타이니참 인형 키링",
  "산리오 헬로키티 MC컬렉션 마스코트 베이비 아기 인형 키링 키홀더",
  "산리오 헬로키티 블랙엔젤 하트 카라비너 마스코트 인형 키링 그레이",
  "산리오 헬로키티 판타지 마스코트 태닝 머메이드 인어 키링",
  "산리오 헬로키티 판타지 요정 마스코트 홀더 하트 카라비너 인형 키링",
  "헬로키티 블랙엔젤 퀼팅 하트 파우치 동전지갑 실버",
  "헬로키티&타이니참 나카요시 마스코트 파우치 세트",
  "산리오 헬로키티 90s 고고걸 갸류 글리터 반짝이 파우치",
  "헬로키티 포치비 실리콘 동전지갑 키링 똑딱이 레드 민트 미니 파우치",
  "산리오 헬로키티 러블리 프릴 시리즈 블랙 로리타 하트카라비너 마스코트 키링",
  "ttotto_pr_080 유키오 운동부 시리즈 마스코트 인형 키링",
  "ttotto_pr_025 산리오 헬로키티 러블리 프릴 시리즈 레드 메이드 하트카라비너 마스코트 키링",
  "ttotto_pr_077 크레용 신짱 짱구 과자 패키지 미니 파우치 카드지갑 팝콘 구미",
  "ttotto_pr_065 치이카와 먼작귀 트렁크 캔케이스 미니 편지지 세트 틴케이스",
  "ttotto_pr_104 다마고치 북마크 컬렉션 2탄 책갈피",
];

/**
 * 상품명 정규화 함수
 */
function normalize(str: string): string {
  return str.trim().replace(/\s+/g, " ").replace(/[&]/g, "&").toLowerCase();
}

/**
 * 상품명 매칭 점수 계산 함수
 * @returns 0-100 사이의 점수
 */
function matchProduct(productName: string, targetName: string): number {
  const normalizedProduct = normalize(productName);
  const normalizedTarget = normalize(targetName);

  // 1. 완전 일치
  if (normalizedProduct === normalizedTarget) return 100;

  // 2. 공백 제거 후 완전 일치
  const noSpaceProduct = normalizedProduct.replace(/\s+/g, "");
  const noSpaceTarget = normalizedTarget.replace(/\s+/g, "");
  if (noSpaceProduct === noSpaceTarget) return 95;

  // 3. 포함 관계
  if (normalizedProduct.includes(normalizedTarget)) return 80;
  if (normalizedTarget.includes(normalizedProduct)) return 80;

  // 4. 주요 키워드 매칭
  const excludeWords = ["산리오", "헬로키티", "마스코트", "인형", "키링"];
  const targetWords = normalizedTarget
    .split(/\s+/)
    .filter((word) => word.length > 1 && !excludeWords.includes(word));

  if (targetWords.length > 0) {
    const matchedWords = targetWords.filter((word) =>
      normalizedProduct.includes(word)
    );
    const matchRatio = matchedWords.length / targetWords.length;

    if (matchRatio >= 0.8) return 70 + matchRatio * 10;
    if (matchRatio >= 0.6) return 50 + matchRatio * 10;
  }

  // 5. 공통 단어 기반 점수
  const productWords = new Set(normalizedProduct.split(/\s+/));
  const targetWordsSet = new Set(normalizedTarget.split(/\s+/));
  const commonWords = [...productWords].filter((word) =>
    targetWordsSet.has(word)
  );
  const commonRatio =
    commonWords.length / Math.max(productWords.size, targetWordsSet.size);

  return commonRatio * 40;
}

/**
 * 타겟 상품명 목록에서 최적 매칭 상품 찾기
 */
function findMatchedProducts<T extends { name: string }>(
  products: T[],
  targetNames: string[],
  label: string
): T[] {
  return targetNames
    .map((targetName, index) => {
      const scoredProducts = products
        .map((product) => ({
          product,
          score: matchProduct(product.name, targetName),
        }))
        .filter((item) => item.score >= 50)
        .sort((a, b) => b.score - a.score);

      const bestMatch = scoredProducts[0];

      if (bestMatch && bestMatch.score >= 50) {
        logger.debug(`[HomePage] ${label} ${index + 1}번 매칭 (${bestMatch.score.toFixed(0)}점)`, {
          target: targetName.substring(0, 30) + "...",
          found: bestMatch.product.name.substring(0, 30) + "...",
        });
        return bestMatch.product;
      }

      logger.warn(`[HomePage] ${label} ${index + 1}번 매칭 실패`, {
        target: targetName.substring(0, 30) + "...",
      });
      return null;
    })
    .filter((product): product is NonNullable<typeof product> => product !== null);
}

/**
 * 상품 데이터 가져오기 (서버 컴포넌트에서 실행)
 * - 최적화: Supabase 쿼리 1회로 통합
 */
async function getProducts() {
  logger.group("[HomePage] 상품 데이터 fetching");
  logger.time("getProducts");

  // 공개 데이터이므로 인증 없이 접근 (모든 사용자가 상품을 볼 수 있어야 함)
  const supabase = createPublicClient();

  // 모든 활성 상품을 한 번에 가져오기
  const { data: allProductsRaw, error } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories!fk_products_category_id(id, name, slug),
      images:product_images(id, image_url, is_primary, alt_text)
    `
    )
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    logger.error("[HomePage] 상품 fetch 에러:", error);
    logger.timeEnd("getProducts");
    logger.groupEnd();
    return { featuredProducts: [], allProducts: [], categories: [] };
  }

  // 상품이 없는 경우
  if (!allProductsRaw || allProductsRaw.length === 0) {
    logger.warn("[HomePage] 활성 상품 없음");
    logger.timeEnd("getProducts");
    logger.groupEnd();
    return { featuredProducts: [], allProducts: [], categories: [] };
  }

  // 타입 변환 (name 필드 접근용)
  type RawProduct = (typeof allProductsRaw)[number];
  const productsWithName = allProductsRaw as (RawProduct & { name: string })[];

  // 베스트 상품 매칭
  const featuredProducts = findMatchedProducts(
    productsWithName,
    BEST_PRODUCT_NAMES,
    "베스트"
  );

  // 전체 상품 매칭
  const allProducts = findMatchedProducts(
    productsWithName,
    ALL_PRODUCT_NAMES,
    "전체상품"
  );

  // 카테고리 목록
  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (categoryError) {
    logger.error("[HomePage] 카테고리 fetch 에러:", categoryError);
  }

  logger.debug("[HomePage] 데이터 fetching 완료:", {
    featuredCount: featuredProducts.length,
    allCount: allProducts.length,
    categoryCount: categories?.length ?? 0,
  });
  logger.timeEnd("getProducts");
  logger.groupEnd();

  // 데이터 변환
  const transformProduct = (product: unknown): ProductListItem => {
    const p = product as {
      id: string;
      category_id: string;
      name: string;
      slug: string;
      price: number;
      discount_price: number | null;
      description: string | null;
      status: "active" | "hidden" | "sold_out";
      stock: number;
      is_featured: boolean;
      is_new: boolean;
      deleted_at: string | null;
      created_at: string;
      updated_at: string;
      category: { id: string; name: string; slug: string };
      images: Array<{
        id: string;
        image_url: string;
        is_primary: boolean;
        alt_text: string | null;
      }>;
    };

    const primaryImage =
      p.images?.find((img) => img.is_primary) || p.images?.[0] || null;

    return {
      id: p.id,
      category_id: p.category_id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      discount_price: p.discount_price,
      description: p.description,
      status: p.status,
      stock: p.stock,
      is_featured: p.is_featured,
      is_new: p.is_new,
      deleted_at: p.deleted_at,
      created_at: p.created_at,
      updated_at: p.updated_at,
      category: p.category,
      primary_image: primaryImage
        ? {
            id: primaryImage.id,
            product_id: p.id,
            image_url: primaryImage.image_url,
            is_primary: primaryImage.is_primary,
            sort_order: 0,
            alt_text: primaryImage.alt_text,
            created_at: p.created_at,
          }
        : null,
    };
  };

  return {
    featuredProducts: featuredProducts.map(transformProduct),
    allProducts: allProducts.map(transformProduct),
    categories: (categories || []) as Category[],
  };
}

export default async function HomePage() {
  const { featuredProducts, allProducts } = await getProducts();

  return (
    <main className="relative min-h-screen">
      {/* 배경 이미지 - LCP가 아니므로 priority 제거 */}
      <div className="fixed inset-0 -z-10">
        <Image
          src="/f.jpg"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          quality={75}
          fetchPriority="low"
          loading="lazy"
          aria-hidden="true"
        />
      </div>
      {/* 배경 오버레이 (텍스트 가독성을 위해) */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px] pointer-events-none"></div>
      <div className="relative z-10">
        {/* 히어로 배너 + 카테고리 섹션 */}
        <section className="relative py-8 md:py-20">
          <div className="shop-container">
            {/* 히어로 배너 - 모바일 우선 */}
            <div className="flex flex-col gap-8 mb-12 md:flex-row md:items-center md:gap-8 md:mb-16">
              {/* 텍스트 영역 - 모바일에서 먼저 표시 */}
              <div className="text-center md:text-left md:flex-1 order-1 md:order-none w-full">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 mb-4"
                  style={{
                    backgroundColor: "white",
                  }}
                >
                  <Sparkles className="w-4 h-4 text-shop-rose" />
                  <span className="text-sm md:text-lg text-black font-medium">
                    귀여운 캐릭터 키덜트 소품샵
                  </span>
                </div>
                <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold text-black mb-4 leading-tight">
                  두근거리는 설렘을{" "}
                  <span className="text-shop-rose">선물하세요</span> 💕
                </h2>
                <p className="text-black mb-12 md:mb-6 text-base md:text-lg font-bold leading-relaxed">
                  산리오, 짱구, 유키오 등 사랑스러운 캐릭터 굿즈를 만나보세요.
                  <br className="hidden md:inline" />
                  인형 키링, 파우치, 완구, 스티커 등 다양한 아이템이 가득!
                </p>
              </div>
              {/* 이미지 영역 - 모바일에서 텍스트 아래에 표시 */}
              <div className="w-full max-w-[160px] mx-auto md:max-w-md lg:max-w-lg md:flex-1 order-2 md:order-none mt-4 md:mt-0">
                <div className="relative w-full aspect-square max-h-[160px] md:max-h-none">
                  {/* 장식적인 원들 - 데스크탑에서만 표시 */}
                  <div className="hidden lg:block absolute w-32 h-32 bg-shop-rose/20 rounded-full"
                       style={{
                         left: "50%",
                         top: "50%",
                         transform: "translate(calc(50% - 300px), calc(50% + 60px))",
                       }}
                  />
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                      src="/kity.png"
                      alt="또또앙스 캐릭터"
                      width={400}
                      height={400}
                      className="w-full h-auto md:h-full object-cover md:object-contain"
                      priority
                      quality={85}
                      fetchPriority="high"
                      sizes="(max-width: 768px) 160px, (max-width: 1024px) 50vw, 400px"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 이벤트 배너 */}
          <EventBanner />
        </section>

        {/* 베스트 상품 섹션 */}
        <section className="py-12 bg-white relative overflow-hidden">
          {/* 장식용 원형 요소 */}
          <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-white/30 rounded-full"></div>
          <div className="shop-container">
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="flex items-center gap-3 mb-4 justify-center">
                <div className="w-10 h-10 bg-[#FFEB3B] rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-[#F57F17]" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-shop-rose">
                    베스트 상품
                  </h2>
                </div>
              </div>
            </div>

            {featuredProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                  {featuredProducts.map((product, index) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      rank={index + 1}
                    />
                  ))}
                </div>
                <div className="flex justify-center mt-8">
                  <Link
                    href="/products?featured=true"
                    className="text-shop-rose hover:text-pink-600 hover:underline text-sm flex items-center gap-1"
                  >
                    전체보기
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-shop-pink-light rounded-xl">
                <span className="text-4xl mb-4 block">🎀</span>
                <p className="text-shop-text-muted">베스트 상품을 준비 중이에요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 전체상품 섹션 */}
        <section className="py-12 bg-white border-t border-gray-200">
          <div className="shop-container">
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="flex items-center gap-3 mb-4 justify-center">
                <div className="w-10 h-10 bg-[#FFEB3B] rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-shop-rose" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-shop-rose">
                    전체상품
                  </h2>
                </div>
              </div>
            </div>

            {allProducts.length > 0 ? (
              <>
                <AllProductsSection initialProducts={allProducts} />
                <div className="flex justify-center mt-8">
                  <Link
                    href="/products"
                    className="text-shop-rose hover:text-pink-600 hover:underline text-sm flex items-center gap-1"
                  >
                    전체보기
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl">
                <span className="text-4xl mb-4 block">✨</span>
                <p className="text-black">상품을 준비 중이에요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 브랜드 스토리 배너 */}
        <section className="w-full py-16 relative bg-white border-t border-gray-200">
          <div className="w-full max-w-[1216px] mx-auto relative z-10">
            <WallpaperPreview
              src="/image/calendar_mobile_02.png"
              bgSrc="/image/calendar_main.png"
              title="1월 배경화면"
              description="스마트폰/PC에 저장해서 예쁘게 써보세요 💗"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
