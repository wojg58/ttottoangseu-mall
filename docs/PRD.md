# 또또앙스 쇼핑몰 자사몰 MVP - 프로젝트 컨텍스트

당신은 또또앙스 쇼핑몰 자사몰 MVP 프로젝트를 개발하는 개발자입니다. 아래 내용을 모든 응답에 참고하세요.
쇼핑몰입니다.

## 1. 프로젝트 개요

**서비스명**: 또또앙스 쇼핑몰 자사몰 MVP
**목표**: 8주 이내 실제 주문/결제 가능한 캐릭터 굿즈 자사몰 오픈
**핵심**: 네이버 스마트스토어 연동으로 브랜딩/재고/주문 통합 관리

### 핵심 목적

1. 브랜드 정체성 강화 (네이버 플랫폼 의존도 감소)
2. 다채널 트래픽 허브 구축 (블로그, 인스타, 스레드, 유튜브)
3. 운영 효율화 (스마트스토어 연동 자동화)
4. 데이터 주도 성장 기반 마련

### 배경 및 문제

- 네이버 스마트스토어 의존 → 브랜드 스토리/세계관 표현 한계
- 캐릭터 굿즈 소비자는 감성적 경험 중시
- 다양한 SNS 채널 트래픽을 받을 허브 필요
- 스마트스토어와 자사몰 병행 운영 시 재고/상품 관리 중복 문제

## 2. 기술 스택

### Frontend

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

### 인증/회원

- Clerk (소셜 로그인: 네이버, 구글, 카카오)
- Supabase users 테이블에 clerk_user_id 연동

### Backend/Database

- Supabase (PostgreSQL)
- Row Level Security (RLS) 적용
- Supabase Storage (상품 이미지)

### 결제

- TossPayments SDK

### 자동화

- n8n (회원가입 알림, 주문 관리, 재고 동기화)
- Google Sheets 연동
- Slack/카카오톡 알림

### 외부 연동

- 네이버 스마트스토어 API (상품/재고)
- CSV/엑셀 데이터 이관

### 디자인

- Figma + Vibe 코딩

## 3. 데이터베이스 구조 (11개 테이블)

### 회원

- **users**: id(UUID), clerk_user_id, email, name, role(customer/admin), deleted_at, created_at, updated_at

### 상품

- **categories**: id(UUID), name, slug, description, image_url, sort_order, is_active, deleted_at
- **products**: id(UUID), category_id, name, slug, price, discount_price, description, status(active/hidden/sold_out), stock, is_featured, is_new, deleted_at
- **product_images**: id(UUID), product_id, image_url, is_primary, sort_order, alt_text
- **product_variants**: id(UUID), product_id, variant_name, variant_value, stock, price_adjustment, sku, deleted_at

### 장바구니

- **carts**: id(UUID), user_id, created_at, updated_at
- **cart_items**: id(UUID), cart_id, product_id, variant_id, quantity, price

### 주문/결제

- **orders**: id(UUID), user_id, order_number, status, total_amount, shipping_name, shipping_phone, shipping_address, shipping_zip_code, shipping_memo, shipping_status, tracking_number, shipped_at, delivered_at
- **order_items**: id(UUID), order_id, product_id, variant_id, product_name, variant_info, quantity, price
- **payments**: id(UUID), order_id, payment_key, toss_payment_id, method, status, amount, requested_at, approved_at, failed_at, cancelled_at, metadata(JSONB)
- **refunds**: id(UUID), payment_id, order_id, refund_amount, refund_reason, refund_status, toss_refund_id, requested_at, approved_at, rejected_at, completed_at

### DB 특징

- 모든 ID는 UUID (gen_random_uuid())
- Soft Delete 적용 (deleted_at)
- CASCADE/RESTRICT/SET NULL 제약조건
- CHECK 제약조건으로 값 검증
- 40개 이상 성능 최적화 인덱스
- updated_at 자동 업데이트 트리거

## 4. MVP 핵심 기능 (In-Scope)

1. ✅ 회원가입/로그인 (Clerk + Supabase 연동)
2. ✅ 상품 리스트/카테고리별 조회
3. ✅ 상품 상세 페이지 (가격, 재고, 옵션, 이미지)
4. ✅ 장바구니 (로그인 유저만, CRUD)
5. ✅ 주문 생성 (배송 정보 입력)
6. ✅ TossPayments 결제 연동
7. ✅ 관리자 대시보드 (상품/주문 관리)
8. ✅ 스마트스토어 상품 데이터 이관 (CSV/엑셀, 10-30개 우선)
9. ✅ n8n 자동화 (회원가입/주문 알림, 재고 동기화)

## 5. MVP 제외 기능 (Out-of-Scope)

- ❌ 리뷰/평점 기능
- ❌ 쿠폰/포인트/적립금
- ❌ 복잡한 검색/필터
- ❌ 택배사 API 연동 (실시간 배송 추적)
- ❌ 완전한 양방향 재고 동기화
- ❌ 위시리스트/찜 기능
- ❌ 1:1 문의 게시판

## 6. 타깃 유저

### 페르소나 1: 캐릭터 덕후 대학생 J (24세, 여성)

- 헬로키티, 산리오 굿즈 수집
- 인스타/스마트스토어 구매 경험 多
- 사진 예쁜 쇼핑몰, 굿즈 세계관 중시
- 신상품 출시 시 즉시 반응, SNS 공유 활발

### 페르소나 2: 선물용 굿즈 구매 직장인 L (29세, 여성)

- 친구/연인 생일 선물용
- 믿고 사는 브랜드 쇼핑몰 선호
- 한 번에 여러 개 구매
- 패키징/선물 포장 중요시

### 핵심 니즈

- 캐릭터 굿즈 한 곳에서 탐색
- 예쁜 상세페이지 + 브랜드 스토리
- 실시간 재고 상태 표시
- 자사몰만의 특별한 경험
- 구매 이력 관리 및 재구매 편리

## 7. 8주 마일스톤

### Week 1-2

- Figma 와이어프레임 완성
- Supabase 스키마 확정 및 테이블 생성
- Clerk 통합 테스트 및 로그인/회원 연동

### Week 3-4

- 상품 리스트/상세 페이지 구현
- 스마트스토어 핵심 상품 1차 이관 (10-30개)
- 장바구니 기능 완료 (CRUD)

### Week 5-6

- 주문 생성 플로우 + 주문 내역 저장
- TossPayments 기본 연동 및 테스트 결제
- 관리자 대시보드 (상품 관리 CRUD)

### Week 7-8

- n8n 자동화 (회원가입/주문 알림, 시트 연동)
- 재고 1방향 동기화 (스마트스토어 → 자사몰)
- 버그 수정, 테스트 주문, MVP 릴리즈

## 8. KPI (3개월 기준)

### 정량 KPI

- 자사몰 회원가입 수: 최소 100명
- 자사몰 첫 결제 주문 수: 최소 50건
- 방문자 대비 장바구니 진입률: 15% 이상

### 정성 KPI

- 기존 스마트스토어 고객 만족도: 4.0/5.0 이상
- 운영자 관점 상품 등록/재고 관리 피로도 감소
- 자동화율: 70% 이상

## 9. 주요 화면 구성

- **홈**: 브랜드 소개, 베스트/신상 상품, 카테고리 링크
- **상품 리스트**: 그리드 레이아웃, 필터/정렬 옵션
- **상품 상세**: 대형 이미지 갤러리, 옵션 선택기, 상세 설명 탭
- **장바구니**: 테이블 형태, 총 금액 하단 고정
- **주문/결제**: 2단계 또는 원페이지 체크아웃
- **마이페이지**: 주문 내역, 회원 정보 관리
- **관리자 대시보드**: 사이드바 네비게이션, 데이터 테이블

## 10. 사용자 플로우

### 고객 플로우

1. SNS/검색 → 자사몰 방문
2. 홈에서 추천/신상품 확인
3. 카테고리별 상품 탐색
4. 상품 상세 → 옵션/수량 선택 → 장바구니 담기 (로그인 필요)
5. 장바구니 → 수량 조정 → 주문하기
6. 배송 정보 입력 (수령인, 연락처, 주소, 메모)
7. TossPayments 결제창 → 결제 완료
8. 마이페이지에서 주문 내역 확인

### 관리자 플로우

- 상품 관리: 등록/수정/숨김 처리, 재고 관리
- 주문 관리: 주문 리스트 확인, 상태 업데이트
- 통계 확인: 재고/판매량 모니터링

### 예외 처리

- 비로그인 장바구니 접근 → 로그인 페이지 리다이렉트
- 품절 상품 장바구니 담기 → 품절 표시 및 버튼 비활성화
- 결제 실패/취소 → 오류 안내 및 재시도 버튼
- 필수 입력값 누락 → 유효성 검사 메시지
- 관리자 권한 없는 접근 → 홈 또는 403 페이지

## 11. 보안/RLS

- users, carts, orders 테이블: RLS 적용 (user_id = 요청 유저 ID)
- 관리자는 모든 데이터 조회 가능 (role = 'admin')
- API 키: 환경 변수 관리, .env 파일 .gitignore 처리
- 결제 정보: 클라이언트 키(프론트), 시크릿 키(서버)

## 12. 성능 최적화

- Next.js Image 컴포넌트 활용
- WebP 포맷 사용
- Supabase 쿼리 결과 캐싱 (React Query 또는 SWR)
- 무한 스크롤 또는 페이지네이션
- Supabase Storage + CDN 연동

## 13. 리스크 및 대응

### 기술 리스크

- 여러 외부 서비스 동시 사용 → 각 서비스별 연동 테스트 단계 분리
- 재고 동기화 오류 → Slack 알림, 수동 확인 프로세스

### 운영 리스크

- 병행 운영 리소스 → n8n 자동화로 최소화
- 트래픽 유입 필요 → 콘텐츠 마케팅 2주 집중 홍보

### 법적 리스크

- 개인정보 처리방침 필수
- 전자상거래법 준수 (환불/교환 정책)

## 14. MVP 성공 기준

1. 실제 고객이 주문하고 결제 완료 가능
2. 스마트스토어 ↔ 자사몰 재고 1시간 이내 동기화
3. 관리자 대시보드에서 주문/상품 관리 가능
4. 3개월 내 최소 50건 이상 실제 주문

## 15. Phase 2 로드맵 (MVP 이후)

- 리뷰/평점 시스템
- 쿠폰/포인트 적립
- 위시리스트/찜
- 1:1 문의 게시판
- 콘텐츠 블로그 섹션 (브랜드 스토리)
- 커뮤니티 기능 (팬아트, 이벤트)
- 모바일 앱 검토

---

## 중요 개발 규칙

1. 모든 쿼리에서 `deleted_at IS NULL` 조건 필수 (Soft Delete)
2. Clerk user와 Supabase users 테이블 연동 필수
3. TossPayments는 주문 생성 후 결제창 호출
4. 재고는 스마트스토어 → 자사몰 1방향 동기화만 (MVP)
5. 관리자 권한은 users.role = 'admin'으로 체크
6. 모든 금액은 DECIMAL(10,2) 타입
7. 상품 이미지는 Supabase Storage 사용
8. n8n으로 회원가입/주문 시 Slack 알림 자동화

---

위 컨텍스트를 기반으로 모든 개발 작업을 진행하세요.
