/**
 * @file components/shop-header.tsx
 * @description 또또앙스 쇼핑몰 헤더 컴포넌트
 *
 * 주요 기능:
 * 1. 로고 및 브랜드명 표시
 * 2. 검색 기능
 * 3. 카테고리 네비게이션
 * 4. 로그인/회원정보/장바구니 버튼
 *
 * @dependencies
 * - @clerk/nextjs: 인증 관련 컴포넌트
 * - lucide-react: 아이콘
 */

"use client";

import { SignedOut, SignInButton, SignedIn, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Search, ShoppingCart, Heart, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 카테고리 데이터 (DB에서 가져올 예정이지만 일단 하드코딩)
const CATEGORIES = [
  { name: "베스트", slug: "best", emoji: "🏆" },
  { name: "산리오", slug: "sanrio", emoji: "❣️" },
  { name: "캐릭터", slug: "character", emoji: "🧡" },
  { name: "핸드폰줄", slug: "phone-strap", emoji: "💛" },
  { name: "키링,지비츠", slug: "keyring", emoji: "💚" },
  { name: "패션잡화", slug: "fashion", emoji: "💙" },
  { name: "곰돌이", slug: "bear", emoji: "🤎" },
  { name: "완구문구", slug: "stationery", emoji: "💜" },
  { name: "전체상품", slug: "all", emoji: "" },
];

export default function ShopHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  console.log("[ShopHeader] 렌더링");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[ShopHeader] 검색:", searchQuery);
    // TODO: 검색 기능 구현
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* 상단 바 - 연한 핑크 배경 */}
      <div className="bg-[#ffeef5] border-b border-[#f5d5e3]">
        <div className="shop-container">
          <div className="flex justify-between items-center h-10 text-xs text-[#8b7d84]">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#ff6b9d]">또또앙스</span>
              <span>캐릭터 굿즈 전문 쇼핑몰</span>
            </div>
            <div className="flex items-center gap-4">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="hover:text-[#ff6b9d] transition-colors">
                    로그인
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/mypage"
                  className="hover:text-[#ff6b9d] transition-colors"
                >
                  마이페이지
                </Link>
              </SignedIn>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 헤더 - 핑크 배경 */}
      <div className="bg-[#fad2e6]">
        <div className="shop-container py-4">
          <div className="flex justify-between items-center gap-4">
            {/* 로고 영역 */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                <span className="text-2xl">🎀</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-white text-lg font-bold drop-shadow-sm">
                  또또앙스
                </h1>
                <p className="text-white/80 text-xs">
                  두근거리는 설렘 (*´v`*) Love
                </p>
              </div>
            </Link>

            {/* 검색 바 */}
            <form onSubmit={handleSearch} className="flex-1 max-w-md mx-4">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="검색어를 입력해주세요"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 rounded-full border-none bg-white text-[#4a3f48] placeholder:text-[#b8a8b0] focus-visible:ring-2 focus-visible:ring-white/50"
                />
                <button
                  type="submit"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#fad2e6] hover:text-[#ff6b9d] transition-colors"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </form>

            {/* 우측 아이콘들 */}
            <div className="flex items-center gap-2">
              <SignedIn>
                <Link
                  href="/wishlist"
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors hidden sm:flex"
                >
                  <Heart className="w-5 h-5" />
                </Link>
                <Link
                  href="/cart"
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors relative"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {/* TODO: 장바구니 아이템 개수 표시 */}
                </Link>
                <div className="ml-2">
                  <UserButton
                    appearance={{
                      elements: {
                        avatarBox: "w-9 h-9 border-2 border-white",
                      },
                    }}
                  />
                </div>
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <Button className="shop-btn-accent text-sm">로그인</Button>
                </SignInButton>
              </SignedOut>

              {/* 모바일 메뉴 버튼 */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-colors lg:hidden"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 카테고리 네비게이션 */}
      <nav className="bg-white border-b border-[#f5d5e3] hidden lg:block">
        <div className="shop-container">
          <ul className="flex items-center justify-center gap-1">
            {CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link
                  href={
                    category.slug === "best"
                      ? "/products?featured=true"
                      : category.slug === "all"
                      ? "/products"
                      : `/products/category/${category.slug}`
                  }
                  className="category-nav-item flex items-center gap-1 text-[#4a3f48] hover:text-[#ff6b9d]"
                >
                  <span>
                    {category.name}
                    {category.emoji}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* 모바일 메뉴 */}
      {isMobileMenuOpen && (
        <nav className="bg-white border-b border-[#f5d5e3] lg:hidden">
          <div className="shop-container py-4">
            <ul className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={
                      category.slug === "best"
                        ? "/products?featured=true"
                        : category.slug === "all"
                        ? "/products"
                        : `/products/category/${category.slug}`
                    }
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-center py-3 px-2 rounded-lg bg-[#ffeef5] text-[#4a3f48] hover:bg-[#fad2e6] transition-colors text-sm"
                  >
                    <span className="text-lg">{category.emoji || "📦"}</span>
                    <p className="mt-1">{category.name}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      )}
    </header>
  );
}
