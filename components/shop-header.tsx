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
import Image from "next/image";
import { Search, ShoppingCart, Heart, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// 카테고리 데이터 (DB에서 가져올 예정이지만 일단 하드코딩)
const CATEGORIES = [
  { name: "베스트", slug: "best", emoji: "💝" },
  { name: "산리오", slug: "sanrio", emoji: "❤️" },
  { name: "캐릭터", slug: "character", emoji: "🧡" },
  { name: "완구,스티커", slug: "phone-strap", emoji: "💛" },
  { name: "키링,지비츠", slug: "keyring", emoji: "💚" },
  { name: "패션잡화", slug: "fashion", emoji: "💙" },
  { name: "곰돌이", slug: "bear", emoji: "🤎" },
  { name: "스마일", slug: "stationery", emoji: "💜" },
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
      {/* 메인 헤더 - 핑크 배경 */}
      <div className="bg-[#FF6B9D]">
        <div className="shop-container py-4">
          <div className="flex justify-between items-center gap-4">
            {/* 로고 영역 */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <Image
                src="/character.png"
                alt="또또앙스"
                width={100}
                height={100}
                className="object-contain"
              />
              <div className="hidden sm:block">
                <h1 className="text-5xl font-bold drop-shadow-sm brand-text-logo text-white">
                  또또앙스
                </h1>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white hover:text-white/80 transition-colors"
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
                <Link
                  href="/mypage"
                  className="p-2 text-white hover:bg-white/20 rounded-full transition-colors"
                >
                  <span className="text-sm">마이페이지</span>
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
      <nav className="bg-[#fad2e6] border-b border-[#f5d5e3] hidden lg:block">
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
                  className="category-nav-item flex items-center gap-1 text-black hover:text-[#ff6b9d]"
                >
                  <span>
                    {category.name}
                    {category.slug === "best" ? (
                      <Image
                        src="/best.png"
                        alt="베스트"
                        width={20}
                        height={20}
                        className="inline-block ml-1"
                      />
                    ) : (
                      category.emoji
                    )}
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
                    className="block text-center py-3 px-2 rounded-lg bg-[#ffeef5] text-[#4a3f48] hover:bg-[#FF6B9D] hover:text-white transition-colors text-sm"
                  >
                    {category.slug === "best" ? (
                      <div className="flex justify-center mb-1">
                        <Image
                          src="/best.png"
                          alt="베스트"
                          width={32}
                          height={32}
                          className="rounded"
                        />
                      </div>
                    ) : (
                      <span className="text-lg">{category.emoji || "📦"}</span>
                    )}
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
