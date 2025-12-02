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
import { ArrowRight, Sparkles, TrendingUp, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/product-card";
import type { ProductListItem, Category } from "@/types/database";

// 카테고리별 이모지 매핑
const CATEGORY_EMOJI: Record<string, string> = {
  sanrio: "❤️",
  character: "🧡",
  "phone-strap": "💛",
  keyring: "💚",
  fashion: "💙",
  bear: "🤎",
  stationery: "💜",
};

// 상품 데이터 가져오기 (서버 컴포넌트에서 실행)
async function getProducts() {
  console.log("[HomePage] 상품 데이터 fetching 시작");

  const supabase = await createClient();

  // 베스트 상품 (is_featured = true)
  const { data: featuredProducts, error: featuredError } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories!fk_products_category_id(id, name, slug),
      images:product_images(id, image_url, is_primary, alt_text)
    `,
    )
    .eq("is_featured", true)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  if (featuredError) {
    console.error("[HomePage] 베스트 상품 fetch 에러:", featuredError);
  }

  // 신상품 (is_new = true)
  const { data: newProducts, error: newError } = await supabase
    .from("products")
    .select(
      `
      *,
      category:categories!fk_products_category_id(id, name, slug),
      images:product_images(id, image_url, is_primary, alt_text)
    `,
    )
    .eq("is_new", true)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(4);

  if (newError) {
    console.error("[HomePage] 신상품 fetch 에러:", newError);
  }

  // 카테고리 목록
  const { data: categories, error: categoryError } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (categoryError) {
    console.error("[HomePage] 카테고리 fetch 에러:", categoryError);
  }

  console.log("[HomePage] 데이터 fetching 완료:", {
    featuredCount: featuredProducts?.length ?? 0,
    newCount: newProducts?.length ?? 0,
    categoryCount: categories?.length ?? 0,
  });

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
    featuredProducts: (featuredProducts || []).map(transformProduct),
    newProducts: (newProducts || []).map(transformProduct),
    categories: (categories || []) as Category[],
  };
}

export default async function HomePage() {
  const { featuredProducts, newProducts, categories } = await getProducts();

  return (
    <main
      className="pb-16 relative min-h-screen bg-cover bg-center bg-fixed bg-no-repeat"
      style={{
        backgroundImage: "url('/f.jpg')",
      }}
    >
      {/* 배경 오버레이 (텍스트 가독성을 위해) */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px] pointer-events-none"></div>
      <div className="relative z-10">
        {/* 히어로 배너 + 카테고리 섹션 */}
        <section className="relative py-12 md:py-20">
          <div className="shop-container">
            {/* 히어로 배너 */}
            <div className="flex flex-col md:flex-row items-center gap-8 mb-16">
              <div
                className="flex-1 text-center md:text-left"
                style={{ width: "700px", maxWidth: "700px", minWidth: "700px" }}
              >
                <div className="inline-flex items-center gap-2 bg-white/50 rounded-full px-4 py-2 mb-4">
                  <Sparkles className="w-4 h-4 text-[#ff6b9d]" />
                  <span className="text-sm text-black font-medium">
                    또또앙스 캐릭터 굿즈 전문 쇼핑몰
                  </span>
                </div>
                <h1 className="text-3xl md:text-5xl font-bold text-[#4a3f48] mb-4 leading-tight">
                  두근거리는 설렘을{" "}
                  <span className="text-[#ff6b9d]">선물하세요</span> 💕
                </h1>
                <p
                  className="text-[#4a3f48] mb-6 text-lg"
                  style={{
                    fontFamily:
                      "'NamyangjuGothic', 'Gowun Dodum', system-ui, sans-serif",
                  }}
                >
                  산리오, 짱구, 유키오 등 사랑스러운 캐릭터 굿즈를 만나보세요.
                  <br />
                  인형 키링, 파우치, 핸드폰줄, 스티커 등 다양한 아이템이 가득!
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                  <Link
                    href="/products"
                    className="shop-btn-accent inline-flex items-center justify-center gap-2"
                  >
                    전체 상품 보기
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/products?featured=true"
                    className="shop-btn-primary inline-flex items-center justify-center gap-2"
                    style={{
                      fontFamily:
                        "'NamyangjuGothic', 'Gowun Dodum', system-ui, sans-serif",
                    }}
                  >
                    베스트 상품
                    <TrendingUp className="w-4 h-4" />
                  </Link>
                </div>
              </div>
              <div className="flex-1 relative">
                <div
                  className="relative w-[600px] h-[600px] mx-auto"
                  style={{ marginLeft: "-100px" }}
                >
                  {/* 장식적인 원들 */}
                  <div className="absolute -top-4 -left-4 w-24 h-24 bg-white/30 rounded-full" />
                  <div
                    className="absolute w-32 h-32 bg-[#ff6b9d]/20 rounded-full"
                    style={{
                      left: "50%",
                      top: "50%",
                      transform:
                        "translate(calc(50% - 300px), calc(50% + 70px))",
                    }}
                  />
                  <div className="relative w-full h-full flex items-center justify-center">
                    <Image
                      src="/g.png"
                      alt="또또앙스"
                      width={600}
                      height={600}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 카테고리 섹션 */}
            {categories.length > 0 && (
              <div className="py-12">
                <div className="shop-container">
                  <h2 className="text-2xl font-bold text-black text-center mb-8">
                    카테고리
                  </h2>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/products/category/${category.slug}`}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/90 backdrop-blur-sm border border-white/50 shadow-md hover:shadow-lg hover:scale-105 transition-all duration-300 group"
                      >
                        <div className="w-16 h-16 bg-[#ffeef5] group-hover:bg-[#fad2e6] rounded-full flex items-center justify-center transition-colors shadow-sm">
                          {category.slug === "best" ? (
                            <Image
                              src="/best.png"
                              alt="베스트"
                              width={40}
                              height={40}
                              className="rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl">
                              {CATEGORY_EMOJI[category.slug] || "📦"}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-black text-center font-medium">
                          {category.name.replace(/[❤️🧡💛💚💙🤎💜]/g, "")}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 베스트 상품 섹션 */}
        <section className="py-12">
          <div className="shop-container">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#ff6b9d] rounded-full flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-black">베스트 상품</h2>
                  <p className="text-sm text-black">가장 인기있는 상품들</p>
                </div>
              </div>
              <Link
                href="/products?featured=true"
                className="text-[#ff6b9d] hover:underline text-sm flex items-center gap-1"
              >
                전체보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                {featuredProducts.map((product, index) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    rank={index + 1}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-[#ffeef5] rounded-xl">
                <span className="text-4xl mb-4 block">🎀</span>
                <p className="text-[#8b7d84]">베스트 상품을 준비 중이에요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 신상품 섹션 */}
        <section className="py-12 bg-[#ffeef5]">
          <div className="shop-container">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#fad2e6] rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#ff6b9d]" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-black">신상품</h2>
                  <p className="text-sm text-black">
                    새로 입고된 상품들을 확인하세요
                  </p>
                </div>
              </div>
              <Link
                href="/products?new=true"
                className="text-[#ff6b9d] hover:underline text-sm flex items-center gap-1"
              >
                전체보기
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {newProducts.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {newProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl">
                <span className="text-4xl mb-4 block">✨</span>
                <p className="text-black">신상품을 준비 중이에요!</p>
              </div>
            )}
          </div>
        </section>

        {/* 브랜드 스토리 배너 */}
        <section className="py-16">
          <div className="shop-container">
            <div className="bg-gradient-to-r from-[#fad2e6] to-[#ffc0cb] rounded-2xl p-8 md:p-12 text-center">
              <span className="text-5xl mb-4 block">💝</span>
              <h2 className="text-2xl md:text-3xl font-bold text-black mb-4">
                두근거리는 설렘을 선물하세요
              </h2>
              <p className="text-black max-w-2xl mx-auto mb-6">
                또또앙스는 사랑스러운 캐릭터 굿즈로 일상에 작은 행복을
                선사합니다.
                <br />
                소중한 사람에게, 또는 나 자신에게 설레는 선물을 해보세요!
              </p>
              <div className="flex items-center justify-center gap-8 text-black">
                <div className="text-center">
                  <Star className="w-6 h-6 mx-auto text-[#ff6b9d] mb-2" />
                  <p className="font-bold text-lg">1,751+</p>
                  <p className="text-sm text-black">관심 고객</p>
                </div>
                <div className="text-center">
                  <span className="text-2xl block mb-2">📦</span>
                  <p className="font-bold text-lg">100+</p>
                  <p className="text-sm text-black">상품</p>
                </div>
                <div className="text-center">
                  <span className="text-2xl block mb-2">⭐</span>
                  <p className="font-bold text-lg">4.9</p>
                  <p className="text-sm text-black">평점</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
