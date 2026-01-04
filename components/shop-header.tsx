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

import { SignedOut, SignedIn, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  ShoppingCart,
  Menu,
  X,
  LogIn,
  UserPlus,
  User,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// 카테고리 데이터 (DB에서 가져올 예정이지만 일단 하드코딩)
const CATEGORIES = [
  { name: "베스트", slug: "best", emoji: "💝" },
  { name: "산리오", slug: "sanrio", emoji: "❤️" },
  { name: "치이카와", slug: "character", emoji: "🧡" },
  { name: "모프샌드", slug: "phone-strap", emoji: "💛" },
  { name: "유키오", slug: "keyring", emoji: "💚" },
  { name: "짱구", slug: "fashion", emoji: "💙" },
  { name: "반다이", slug: "bear", emoji: "💜" },
  { name: "가차,리멘트", slug: "stationery", emoji: "💜" },
  { name: "전체상품", slug: "all", emoji: "" },
];

export default function ShopHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    // 검색어가 비어있으면 검색하지 않음
    if (!searchQuery.trim()) {
      return;
    }

    // 검색어를 URL 파라미터로 전달하여 상품 페이지로 이동
    const searchParams = new URLSearchParams({ search: searchQuery.trim() });
    const searchUrl = `/products?${searchParams.toString()}`;
    router.push(searchUrl);
    setIsSearchOpen(false);
    setSearchQuery("");
  };

  return (
    <>
      {/* Announcement Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="shop-container">
          <div className="flex items-center h-[30px]">{/* 빈 공간 */}</div>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full">
        {/* 메인 헤더 - 핑크 배경 (대비율 개선: 더 진한 핑크 사용) */}
        <div className="bg-[#FF5088]">
          <div className="shop-container h-[70px] sm:h-[90px] md:h-[120px] flex items-center">
            <div className="relative flex justify-between items-center gap-1 sm:gap-2 md:gap-4 w-full">
              {/* 왼쪽 소셜 미디어 바로가기 아이콘 - 모바일에서도 표시 (작게) */}
              <div className="flex flex-1 items-center gap-1 sm:gap-2">
                {/* 네이버 스마트스토어 */}
                <a
                  href="https://smartstore.naver.com/ttottoangseu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 hover:opacity-80 transition-opacity"
                  aria-label="네이버 스마트스토어 바로가기"
                >
                  <Image
                    src="/icons/icon-smartstore.png"
                    alt="네이버 스마트스토어 바로가기"
                    width={28}
                    height={28}
                    className="object-contain block"
                    sizes="(max-width: 640px) 24px, (max-width: 768px) 28px, 28px"
                    priority
                  />
                </a>

                {/* 인스타그램 */}
                <a
                  href="https://www.instagram.com/ttottoangseu_shop/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 hover:opacity-80 transition-opacity"
                  aria-label="인스타그램 바로가기"
                >
                  <Image
                    src="/icons/icon_Instagram.png"
                    alt="인스타그램 바로가기"
                    width={26}
                    height={26}
                    className="object-contain block"
                    sizes="(max-width: 640px) 24px, (max-width: 768px) 26px, 26px"
                    priority
                  />
                </a>
              </div>

              {/* 로고 영역 - 중앙 배치 (모바일에서도 타이틀 표시) */}
              <Link
                href="/"
                className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0 z-10 pointer-events-auto"
                aria-label="또또앙스 홈으로 이동"
              >
                <Image
                  src="/character.png"
                  alt="또또앙스 로고"
                  width={100}
                  height={100}
                  className="object-contain w-10 h-10 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-[100px] lg:h-[100px] drop-shadow-md"
                  priority
                  sizes="(max-width: 640px) 40px, (max-width: 768px) 64px, (max-width: 1024px) 80px, 100px"
                />
                {/* 모바일에서도 타이틀 표시 (작게) */}
                <div>
                  <h1 className="text-sm sm:text-lg md:text-4xl lg:text-5xl font-bold drop-shadow-md brand-text-logo text-white whitespace-nowrap">
                    또또앙스
                  </h1>
                </div>
              </Link>

              {/* 우측 아이콘들 - 모바일: 드롭다운 하나만, 태블릿 이상: 개별 아이콘 */}
              <div className="flex-1 flex justify-end items-center gap-1 sm:gap-0.5 md:gap-2 lg:gap-3">
                {/* 모바일: 통합 드롭다운 메뉴 (모든 기능 포함) */}
                <div className="relative sm:hidden">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(!isUserMenuOpen);
                      // 모바일 메뉴가 열려있으면 닫기
                      if (isMobileMenuOpen) {
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className="flex items-center justify-center w-9 h-9 text-white hover:opacity-80 transition-opacity"
                    aria-label="메뉴"
                  >
                    {isUserMenuOpen ? (
                      <X className="w-6 h-6" />
                    ) : (
                      <Menu className="w-6 h-6" />
                    )}
                  </button>

                  {/* 드롭다운 메뉴 */}
                  {isUserMenuOpen && (
                    <>
                      {/* 배경 오버레이 (클릭 시 닫기) */}
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsUserMenuOpen(false)}
                      ></div>
                      <div className="absolute top-full right-0 mt-2 w-52 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="py-2">
                          {/* 장바구니 */}
                          <Link
                            href="/cart"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                          >
                            <div className="relative">
                              <ShoppingCart className="w-5 h-5" />
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                                0
                              </span>
                            </div>
                            장바구니
                          </Link>

                          <div className="border-t border-gray-200 my-1"></div>

                          {/* 사용자 메뉴 */}
                          <SignedOut>
                            <Link
                              href="/sign-in"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <LogIn className="w-5 h-5" />
                              로그인
                            </Link>
                            <Link
                              href="/sign-up/join"
                              onClick={() => setIsUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <UserPlus className="w-5 h-5" />
                              회원가입
                            </Link>
                          </SignedOut>
                          <Link
                            href="/mypage"
                            onClick={() => setIsUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <User className="w-5 h-5" />
                            마이페이지
                          </Link>
                          <SignedIn>
                            <SignOutButton>
                              <button
                                type="button"
                                onClick={() => setIsUserMenuOpen(false)}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 text-left"
                              >
                                <LogOut className="w-5 h-5" />
                                로그아웃
                              </button>
                            </SignOutButton>
                          </SignedIn>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* 태블릿 이상: 개별 아이콘 표시 */}
                <div className="hidden sm:flex items-center gap-0.5 md:gap-2 lg:gap-3">
                  <SignedOut>
                    {/* 로그인 */}
                    <Link
                      href="/sign-in"
                      className="flex flex-col items-center justify-center gap-0.5 md:gap-1 text-white hover:opacity-80 transition-opacity min-w-[44px] md:min-w-[50px]"
                      aria-label="로그인"
                    >
                      <LogIn className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="text-[10px] md:text-xs">로그인</span>
                    </Link>

                    {/* 회원가입 */}
                    <Link
                      href="/sign-up/join"
                      className="flex flex-col items-center justify-center gap-0.5 md:gap-1 text-white hover:opacity-80 transition-opacity min-w-[44px] md:min-w-[50px]"
                      aria-label="회원가입"
                    >
                      <UserPlus className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="text-[10px] md:text-xs">회원가입</span>
                    </Link>
                  </SignedOut>

                  {/* 마이페이지 */}
                  <Link
                    href="/mypage"
                    className="flex flex-col items-center justify-center gap-0.5 md:gap-1 text-white hover:opacity-80 transition-opacity min-w-[44px] md:min-w-[50px]"
                    aria-label="마이페이지"
                  >
                    <User className="w-5 h-5 md:w-6 md:h-6" />
                    <span className="text-[10px] md:text-xs">마이페이지</span>
                  </Link>

                  {/* 로그아웃 */}
                  <SignedIn>
                    <SignOutButton>
                      <button
                        type="button"
                        className="flex flex-col items-center justify-center gap-0.5 md:gap-1 text-white hover:opacity-80 transition-opacity min-w-[44px] md:min-w-[50px]"
                        aria-label="로그아웃"
                      >
                        <LogOut className="w-5 h-5 md:w-6 md:h-6" />
                        <span className="text-[10px] md:text-xs">로그아웃</span>
                      </button>
                    </SignOutButton>
                  </SignedIn>

                  {/* 장바구니 */}
                  <Link
                    href="/cart"
                    className="flex flex-col items-center justify-center gap-0.5 md:gap-1 text-white hover:opacity-80 transition-opacity relative min-w-[44px] md:min-w-[50px]"
                    aria-label="장바구니"
                  >
                    <div className="relative">
                      <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                        0
                      </span>
                    </div>
                    <span className="text-[10px] md:text-xs">장바구니</span>
                  </Link>

                  {/* 모바일 메뉴 버튼 (태블릿 이상에서는 카테고리 메뉴용) */}
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-3 min-w-[48px] min-h-[48px] text-white hover:bg-white/20 rounded-full transition-colors lg:hidden flex items-center justify-center relative"
                    aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
                  >
                    <X
                      className={`w-6 h-6 absolute transition-opacity duration-200 ${
                        isMobileMenuOpen
                          ? "opacity-100"
                          : "opacity-0 pointer-events-none"
                      }`}
                    />
                    <Menu
                      className={`w-6 h-6 absolute transition-opacity duration-200 ${
                        isMobileMenuOpen
                          ? "opacity-0 pointer-events-none"
                          : "opacity-100"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 카테고리 네비게이션 */}
        <nav className="bg-[#ffd6e8] border-b border-[#ffc8dc] hidden lg:block">
          <div className="shop-container">
            <div className="flex items-center justify-between gap-4">
              <ul className="flex items-center justify-center gap-2 md:gap-4 lg:gap-6 flex-1 flex-nowrap overflow-x-auto scrollbar-hide">
                {CATEGORIES.map((category) => (
                  <li key={category.slug} className="flex-shrink-0">
                    <Link
                      href={
                        category.slug === "best"
                          ? "/products?featured=true"
                          : category.slug === "all"
                          ? "/products"
                          : `/products/category/${category.slug}`
                      }
                      className="category-nav-item flex items-center gap-1 text-black hover:text-[#ff6b9d] text-base md:text-lg lg:text-[20px] px-2 md:px-4 lg:px-6 whitespace-nowrap"
                    >
                      <span>
                        {category.slug === "best" ? (
                          <>
                            <Image
                              src="/best.png"
                              alt="베스트"
                              width={20}
                              height={20}
                              className="inline-block mr-1 w-4 h-4 md:w-5 md:h-5"
                              sizes="(max-width: 768px) 16px, 20px"
                            />
                            {category.name}
                          </>
                        ) : (
                          <>
                            {category.emoji}
                            {category.name}
                          </>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {/* 검색 입력 필드 */}
              <div className="flex items-center shrink-0">
                <form
                  onSubmit={handleSearch}
                  className="flex items-center gap-1 border-b border-black pb-1"
                >
                  <Input
                    type="text"
                    placeholder="검색"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-[120px] md:w-[150px] lg:w-[180px] h-7 md:h-8 px-2 bg-transparent border-0 text-xs md:text-sm text-gray-700 placeholder:text-gray-400 focus-visible:ring-0 focus-visible:outline-none shadow-none"
                  />
                  <button
                    type="submit"
                    className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
                    aria-label="검색"
                  >
                    <Search className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </nav>

        {/* 모바일 메뉴 */}
        {isMobileMenuOpen && (
          <nav className="bg-white border-b border-[#ffc8dc] lg:hidden">
            <div className="shop-container py-4">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                      className="flex flex-col items-center justify-center text-center p-3 rounded-lg bg-[#ffeef5] text-[#4a3f48] hover:bg-[#FF6B9D] hover:text-white transition-colors text-xs min-h-[80px]"
                    >
                      {category.slug === "best" ? (
                        <div className="flex justify-center mb-2">
                          <Image
                            src="/best.png"
                            alt="베스트"
                            width={24}
                            height={24}
                            className="rounded"
                            sizes="24px"
                          />
                        </div>
                      ) : (
                        <span className="text-xl mb-1">
                          {category.emoji || "📦"}
                        </span>
                      )}
                      <p className="leading-tight">{category.name}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        )}

        {/* 검색 모달 */}
        <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent className="max-w-2xl w-[calc(100%-2rem)] p-0 gap-0 top-[20%] translate-y-0">
            <div className="p-6 bg-white rounded-lg">
              {/* 검색 입력 필드 */}
              <form onSubmit={handleSearch} className="mb-6">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400" />
                  </div>
                  <Input
                    type="text"
                    placeholder="어떤 상품을 찾으시나요?"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setIsSearchOpen(false);
                        setSearchQuery("");
                      }
                    }}
                    className="w-full h-14 pl-12 pr-4 py-2 rounded-lg border-2 border-gray-200 bg-gray-50 text-[#4a3f48] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-shop-rose focus-visible:border-shop-rose text-base"
                    autoFocus
                  />
                </div>
              </form>

              {/* 추천 검색어 */}
              <div>
                <h3 className="text-lg font-bold text-[#4a3f48] mb-4">추천</h3>
                <div className="flex flex-wrap gap-2">
                  {["헬로키티", "치이카와", "모프샌드", "유키오", "짱구"].map(
                    (keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => {
                          const searchParams = new URLSearchParams({
                            search: keyword,
                          });
                          router.push(`/products?${searchParams.toString()}`);
                          setIsSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="px-4 py-2 rounded-full bg-[#ffeef5] text-[#ff6b9d] hover:bg-[#ff6b9d] hover:text-white transition-colors text-sm font-medium"
                      >
                        {keyword}
                      </button>
                    ),
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </header>
    </>
  );
}
