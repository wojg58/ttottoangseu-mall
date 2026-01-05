# 또또앙스 쇼핑몰 MVP 개발 TODO

## Week 1-2: 프로젝트 초기 설정 및 인증

### 프로젝트 기본 설정

- [x] Next.js 15 프로젝트 초기화 및 의존성 설치
- [x] TypeScript 설정 (`tsconfig.json`)
- [x] Tailwind CSS v4 설정 (`globals.css`)
- [x] ESLint/Prettier 설정
- [ ] 환경 변수 설정 (`.env.example`, `.env`)
- [x] `.gitignore` 설정
- [x] `README.md` 작성

### 디자인 및 와이어프레임

- [ ] Figma 와이어프레임 완성
- [ ] 디자인 시스템 정의 (색상, 타이포그래피, 컴포넌트)
- [x] shadcn/ui 컴포넌트 설치 및 커스터마이징

### 데이터베이스

- [x] Supabase 스키마 확정 및 테이블 생성 (`update_shopping_mall_schema.sql`)
- [x] Supabase Storage 버킷 생성 (`product-images`, `category-images`) - `setup_storage.sql` 확인됨
- [x] 초기 카테고리 데이터 삽입 - `20250602000000_insert_categories.sql` 확인됨
- [ ] RLS 정책 설정 (개발 환경에서는 비활성화)

### 인증 시스템 (Clerk + Supabase)

- [x] Clerk 프로젝트 설정 (네이버, 구글, 카카오 소셜 로그인)
- [x] Clerk 미들웨어 설정 (`middleware.ts`)
- [x] ClerkProvider 설정 (`app/layout.tsx`)
- [x] Supabase 클라이언트 설정 (`lib/supabase/clerk-client.ts`, `server.ts`, `service-role.ts`)
- [x] 사용자 동기화 훅 구현 (`hooks/use-sync-user.ts`)
- [x] 사용자 동기화 API 라우트 (`app/api/sync-user/route.ts`)
- [x] SyncUserProvider 구현 (`components/providers/sync-user-provider.tsx`)
- [x] 로그인/회원가입 페이지 (Clerk 기본 페이지 사용)
- [x] 카카오 로그인 버튼 UI 구현 및 활성화 - `app/sign-in/[[...rest]]/sign-in-content.tsx`
- [x] 로그아웃 기능 구현 (Clerk UserButton 사용)
- [x] 인증 상태 확인 및 리다이렉트 로직

### 공통 컴포넌트

- [x] 레이아웃 컴포넌트
  - [x] Header (네비게이션, 로그인 상태) - `components/shop-header.tsx`
  - [x] Footer - `components/shop-footer.tsx`
  - [x] Navigation (Header 내부에 포함)
- [x] 공통 UI 컴포넌트
  - [x] Button - `components/ui/button.tsx`
  - [x] Input - `components/ui/input.tsx`
  - [ ] Card
  - [ ] Badge
  - [ ] Loading Spinner
  - [ ] Error Message
- [ ] SEO 설정
  - [x] `app/favicon.ico`
  - [ ] `app/robots.ts`
  - [ ] `app/sitemap.ts`
  - [ ] `app/manifest.ts`
  - [ ] `app/not-found.tsx`

## Week 3-4: 상품 및 장바구니 기능

### 상품 카테고리

- [x] 카테고리 리스트 조회 API/Server Action - `actions/products.ts`
- [x] 카테고리별 상품 조회 API/Server Action - `actions/products.ts`
- [x] 카테고리 페이지 (`app/products/category/[slug]/page.tsx`)
- [x] 카테고리 네비게이션 컴포넌트 - `components/shop-header.tsx`

### 상품 리스트

- [x] 상품 리스트 조회 API/Server Action (페이지네이션, 필터링) - `actions/products.ts`
- [x] 상품 리스트 페이지 (`app/products/page.tsx`)
- [x] 상품 카드 컴포넌트 (`components/product-card.tsx`)
- [x] 상품 그리드 레이아웃
- [x] 필터/정렬 기능 (베스트, 신상품, 가격순 등) - `components/product-sort-select.tsx`
- [x] 무한 스크롤 또는 페이지네이션

### 상품 상세

- [x] 상품 상세 조회 API/Server Action - `actions/products.ts`
- [x] 상품 상세 페이지 (`app/products/[slug]/page.tsx`)
- [x] 상품 이미지 갤러리 컴포넌트 - `components/product-image-gallery.tsx`
- [ ] 상품 옵션 선택 컴포넌트 (`product-variants`) - 부분 구현
- [x] 재고 상태 표시
- [x] 수량 선택 컴포넌트
- [x] 장바구니 담기 버튼 (로그인 체크) - `components/add-to-cart-button.tsx`
- [x] 상품 설명 탭 (상세 정보, 배송 안내)

### 장바구니

- [x] 장바구니 조회 API/Server Action - `actions/cart.ts`
- [x] 장바구니 아이템 추가 API/Server Action - `actions/cart.ts`
- [x] 장바구니 아이템 수정 API/Server Action - `actions/cart.ts`
- [x] 장바구니 아이템 삭제 API/Server Action - `actions/cart.ts`
- [x] 장바구니 페이지 (`app/cart/page.tsx`)
- [x] 장바구니 아이템 컴포넌트 - `components/cart-item-list.tsx`, `components/cart-summary.tsx`
- [x] 장바구니 총 금액 계산
- [x] 비로그인 사용자 리다이렉트 처리
- [x] 장바구니 아이콘 및 개수 표시 (Header) - `components/shop-header.tsx`

### 스마트스토어 데이터 이관

- [x] CSV/엑셀 파싱 유틸리티 - `lib/utils/import-products.ts`
- [x] 상품 데이터 이관 스크립트/페이지 - `app/admin/products/import/page.tsx`
- [x] 상품 이미지 업로드 (Supabase Storage) - `lib/utils/upload-image.ts`
- [x] 카테고리 매핑 로직 - `lib/utils/import-products.ts` (`createCategoryMap`)
- [ ] 초기 상품 10-30개 이관 완료

## Week 5-6: 주문 및 결제

### 주문 생성

- [x] 주문 생성 API/Server Action - `actions/orders.ts`
- [x] 주문번호 생성 로직 (`ORD-YYYY-MMDD-XXX`) - `actions/orders.ts`
- [x] 주문 페이지 (`app/checkout/page.tsx`)
- [x] 배송 정보 입력 폼 - `components/checkout-form.tsx`
  - [x] 수령인 이름
  - [x] 연락처
  - [x] 주소 (우편번호 검색)
  - [x] 배송 메모
- [x] 주문 상품 리스트 표시
- [x] 주문 금액 계산 (상품금액 + 배송비)
- [x] 주문 유효성 검사 (재고 확인, 필수 입력값)

### TossPayments 연동 ✅ 완료

- [x] TossPayments SDK 설치 및 설정
- [x] 결제 위젯 컴포넌트 - `components/payment-widget.tsx`
- [x] 결제 요청 API (`app/api/payments/route.ts`)
- [x] 결제 승인 처리 (`app/api/payments/confirm/route.ts`)
- [x] 결제 실패/취소 처리
- [x] 결제 완료 페이지 (`app/payments/success/page.tsx`)
- [x] 결제 실패 페이지 (`app/payments/fail/page.tsx`)
- [x] 결제 정보 저장 (`payments` 테이블)
- [x] 환경 변수 설정 완료

### 주문 내역

- [x] 주문 내역 조회 API/Server Action - `actions/orders.ts`
- [x] 마이페이지 (`app/mypage/page.tsx`)
- [x] 주문 내역 리스트 - `app/mypage/orders/page.tsx`
- [x] 주문 상세 페이지 (`app/mypage/orders/[id]/page.tsx`)
- [x] 주문 상태 표시
- [ ] 주문 취소 기능 (상태별 제한) - 우선순위 낮음

### 관리자 대시보드 - 상품 관리

- [x] 관리자 권한 체크 미들웨어/유틸 - `actions/admin.ts` (`isAdmin()`)
- [x] 관리자 대시보드 레이아웃 (`app/admin/layout.tsx`) - 없음, 각 페이지에서 개별 체크 (의도적으로 생략)
- [x] 상품 목록 페이지 (`app/admin/products/page.tsx`)
- [x] 상품 등록 페이지 (`app/admin/products/new/page.tsx`)
- [x] 상품 수정 페이지 (`app/admin/products/[id]/page.tsx`)
- [x] 상품 CRUD API/Server Actions - `actions/admin-products.ts`
- [x] 상품 이미지 업로드 (Supabase Storage) - `components/product-form.tsx`
- [x] 상품 옵션 관리 - `components/product-form.tsx`
- [x] 재고 관리
- [x] 상품 상태 변경 (active/hidden/sold_out)

## Week 7-8: 자동화 및 최종 점검

### 관리자 대시보드 - 주문 관리

- [x] 주문 목록 페이지 (`app/admin/orders/page.tsx`)
- [ ] 주문 상세 페이지 (`app/admin/orders/[id]/page.tsx`) - 우선순위 낮음
- [x] 주문 상태 업데이트 - `actions/admin.ts` (`updateOrderStatus()`)
- [x] 배송 정보 입력 (운송장 번호, 배송 상태) - `actions/admin.ts`
- [x] 주문 통계 (대시보드 메인) - `app/admin/page.tsx` (`getDashboardStats()`)

### n8n 자동화

- [ ] n8n 워크플로우 설정
- [ ] 회원가입 알림 (Slack/카카오톡)
- [ ] 주문 알림 (Slack/카카오톡)
- [ ] Google Sheets 연동 (주문 데이터)
- [ ] 재고 동기화 워크플로우 (스마트스토어 → 자사몰)

### 재고 동기화

- [ ] 스마트스토어 API 연동 (재고 조회)
- [ ] 재고 동기화 스크립트/API
- [ ] 재고 동기화 스케줄러 (n8n 또는 Cron)
- [ ] 재고 동기화 로그 및 에러 처리

### 성능 최적화

- [x] Next.js Image 컴포넌트 적용 - `components/product-card.tsx`, `components/product-image-gallery.tsx` 등
- [ ] 이미지 WebP 포맷 변환
- [ ] React Query 또는 SWR 캐싱 설정
- [ ] 페이지 로딩 최적화
- [ ] 코드 스플리팅

### 테스트 및 버그 수정

- [ ] 주요 기능 E2E 테스트 (Playwright)
- [ ] 테스트 주문 진행
- [ ] 결제 테스트 (TossPayments 테스트 모드)
- [ ] 크로스 브라우저 테스트
- [ ] 모바일 반응형 테스트
- [ ] 버그 수정 및 개선

### 배포 준비

- [ ] Vercel 프로젝트 설정
- [ ] 환경 변수 설정 (프로덕션)
- [ ] Supabase 프로덕션 데이터베이스 설정
- [ ] RLS 정책 활성화 및 테스트
- [ ] 도메인 연결
- [ ] SSL 인증서 확인
- [ ] 에러 모니터링 설정 (Sentry 등)

### 문서화

- [ ] API 문서 작성
- [ ] 관리자 매뉴얼 작성
- [ ] 배포 가이드 작성
- [ ] 트러블슈팅 가이드

### MVP 릴리즈

- [ ] 최종 점검 체크리스트
- [ ] 프로덕션 배포
- [ ] 모니터링 설정
- [ ] 사용자 피드백 수집 체계 구축

## Phase 2 (MVP 이후 - 참고용)

### 추가 기능

- [ ] 리뷰/평점 시스템
- [ ] 쿠폰/포인트/적립금
- [ ] 위시리스트/찜 기능
- [ ] 1:1 문의 게시판
- [ ] 검색 기능 강화
- [ ] 택배사 API 연동 (실시간 배송 추적)

### 콘텐츠 및 마케팅

- [ ] 브랜드 스토리 블로그 섹션
- [ ] 커뮤니티 기능 (팬아트, 이벤트)
- [ ] 이메일 마케팅 연동
- [ ] SNS 공유 기능

### 기술 개선

- [ ] 완전한 양방향 재고 동기화
- [ ] 모바일 앱 검토
- [ ] PWA 기능 추가
- [ ] 다국어 지원
