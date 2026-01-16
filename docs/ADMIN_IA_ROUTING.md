# 관리자 영역 IA(정보구조) + 라우팅 맵

> 작성일: 2025-01-XX  
> 목적: 관리자 대시보드 확장 및 운영 기능 전체 구조 정리

## 📋 목차

1. [전체 IA 구조](#전체-ia-구조)
2. [라우팅 맵](#라우팅-맵)
3. [컴포넌트 구조](#컴포넌트-구조)
4. [데이터 쿼리 전략](#데이터-쿼리-전략)
5. [권한 및 보안](#권한-및-보안)
6. [구현 우선순위](#구현-우선순위)

---

## 전체 IA 구조

### 1. 대시보드 (`/admin`)
**목적**: 운영자가 매일 보는 KPI 중심 대시보드

**주요 기능**:
- KPI 카드 (6개)
  - 총 주문 수
  - 처리 필요 (결제완료 + 배송대기)
  - 총 매출 (기간 선택 가능: 오늘/7일/30일)
  - 취소/환불 건수
  - 재고부족 상품 수
  - 신규 회원 수 (오늘/7일/30일)
- 최근 주문 (10개)
- 알림/할일 (To-do)
  - 미처리 주문 (결제완료 + 배송대기)
  - 재고부족 상품
  - 문의 미답변

**우선순위**: P0

---

### 2. 주문 관리 (`/admin/orders`)
**목적**: 주문 전체 조회 및 상태 관리

**주요 기능**:
- 리스트 페이지 (`/admin/orders`)
  - 필터: 상태 (결제대기/결제완료/배송중/완료/취소/환불), 기간, 결제수단
  - 검색: 주문번호, 고객명, 전화번호
  - 정렬: 주문일시, 금액, 상태
  - 페이지네이션 (20개/페이지)
  - CSV 내보내기
- 상세 페이지 (`/admin/orders/[id]`)
  - 주문 정보 (주문번호, 주문자, 배송지)
  - 결제 정보 (결제수단, 금액, 결제일시)
  - 배송 정보 (운송장번호, 배송상태, 배송일시)
  - 주문 상품 목록
  - 관리자 메모
  - 상태 변경 (결제상태, 배송상태)
  - 부분환불 (추후)

**우선순위**: P0

---

### 3. 배송/출고 (`/admin/fulfillment`)
**목적**: 송장번호 등록 및 배송 상태 일괄 관리

**주요 기능**:
- 송장번호 등록 (단건/일괄)
- 배송 상태 업데이트 (일괄)
- 배송 대기 주문 목록
- 배송중 주문 추적

**우선순위**: P1

---

### 4. 상품 관리 (`/admin/products`)
**목적**: 상품 등록, 수정, 관리

**주요 기능**:
- 리스트 페이지 (`/admin/products`)
  - 필터: 카테고리, 노출상태, 재고상태, 가격대
  - 검색: 상품명, SKU
  - 정렬: 등록일, 가격, 재고, 판매량
  - 페이지네이션 (20개/페이지)
  - 일괄 작업 (노출/숨김, 삭제, 복원)
- 등록 페이지 (`/admin/products/new`)
  - 기본 정보 (이름, 설명, 가격, 할인가)
  - 카테고리 선택
  - 옵션 설정 (variant)
  - 이미지 업로드 (다중)
  - 노출 설정
  - SEO 설정 (메타태그, 슬러그)
  - 재고 설정
- 수정 페이지 (`/admin/products/[id]/edit`)
  - 등록 페이지와 동일한 폼
  - 기존 데이터 로드

**우선순위**: P0

---

### 5. 재고 관리 (`/admin/inventory`)
**목적**: SKU/옵션별 재고 관리 및 알림

**주요 기능**:
- 재고 목록 (SKU/옵션별)
- 재고 수정 (단건/일괄)
- 재고부족 알림 기준 설정
- 재고 변동 이력 (추후)

**우선순위**: P1

---

### 6. 고객/회원 (`/admin/customers`)
**목적**: 회원 정보 조회 및 관리

**주요 기능**:
- 회원 리스트
  - 검색: 이름, 이메일, 전화번호
  - 필터: 가입일, 주문횟수
  - 정렬: 가입일, 최근주문일
- 회원 상세 (`/admin/customers/[id]`)
  - 기본 정보
  - 주문 이력
  - 등급 (추후)
  - 고객 메모

**우선순위**: P1

---

### 7. 리뷰/문의(CS) (`/admin/support`)
**목적**: 고객 문의 및 리뷰 관리

**주요 기능**:
- 상품 문의 (Q&A) 목록
  - 미답변 필터
  - 답변 작성
- 리뷰 목록
  - 답변/숨김 처리 (추후)

**우선순위**: P2

---

### 8. 프로모션 (`/admin/promotions`)
**목적**: 쿠폰, 배너, 팝업 관리

**주요 기능**:
- 쿠폰 관리 (추후)
- 배너 관리 (추후)
- 팝업 관리 (추후)

**우선순위**: P2

---

### 9. 통계 (`/admin/analytics`)
**목적**: 매출 및 상품 통계 분석

**주요 기능**:
- 기간별 매출 (일/주/월)
- 베스트 상품 (판매량/매출 기준)
- 취소율
- 객단가 (추후)

**우선순위**: P2

---

### 10. 설정 (`/admin/settings`)
**목적**: 시스템 설정 및 관리

**주요 기능**:
- 배송비 설정 (추후)
- 반품 정책 (추후)
- 관리자 계정/권한 (추후)
- 로그 조회 (추후)

**우선순위**: P2

---

## 라우팅 맵

```
/admin
├── layout.tsx                    # AdminShell (사이드바 + 헤더)
├── page.tsx                      # 대시보드
│
├── orders/
│   ├── page.tsx                  # 주문 리스트
│   └── [id]/
│       └── page.tsx              # 주문 상세
│
├── products/
│   ├── page.tsx                  # 상품 리스트
│   ├── new/
│   │   └── page.tsx              # 상품 등록
│   ├── [id]/
│   │   └── page.tsx              # 상품 상세 (기존)
│   ├── [id]/
│   │   └── edit/
│   │       └── page.tsx          # 상품 수정
│   ├── import/
│   │   └── page.tsx             # 상품 이관 (기존)
│   └── batch-upload/
│       └── page.tsx             # 이미지 일괄 업로드 (기존)
│
├── fulfillment/                 # P1
│   └── page.tsx                  # 배송/출고
│
├── inventory/                    # P1
│   └── page.tsx                  # 재고 관리
│
├── customers/                    # P1
│   ├── page.tsx                  # 회원 리스트
│   └── [id]/
│       └── page.tsx             # 회원 상세
│
├── support/                      # P2
│   ├── page.tsx                  # 리뷰/문의 목록
│   └── inquiries/
│       └── [id]/
│           └── page.tsx         # 문의 상세
│
├── promotions/                   # P2
│   └── page.tsx                  # 프로모션 관리
│
├── analytics/                    # P2
│   └── page.tsx                  # 통계
│
└── settings/                     # P2
    └── page.tsx                  # 설정
```

---

## 컴포넌트 구조

### 공통 컴포넌트

```
components/
├── admin/
│   ├── AdminShell.tsx           # 레이아웃 (사이드바 + 헤더)
│   ├── AdminSidebar.tsx         # 사이드바 네비게이션
│   ├── AdminHeader.tsx         # 헤더 (사용자 정보, 알림)
│   │
│   ├── StatCard.tsx            # KPI 카드
│   ├── DataTable.tsx           # 데이터 테이블 (검색/필터/정렬/페이지네이션)
│   ├── StatusBadge.tsx         # 상태 뱃지
│   ├── EmptyState.tsx          # 빈 상태
│   ├── LoadingSkeleton.tsx     # 로딩 스켈레톤
│   │
│   ├── OrderFilters.tsx        # 주문 필터
│   ├── OrderTable.tsx         # 주문 테이블
│   ├── OrderDetail.tsx        # 주문 상세
│   │
│   ├── ProductFilters.tsx     # 상품 필터
│   ├── ProductTable.tsx      # 상품 테이블
│   └── ProductForm.tsx     # 상품 등록/수정 폼
│
└── ui/                          # shadcn/ui 컴포넌트
    ├── button.tsx
    ├── input.tsx
    ├── select.tsx
    ├── table.tsx
    └── ...
```

---

## 데이터 쿼리 전략

### 대시보드 KPI 쿼리

```typescript
// actions/admin.ts

// 1. 총 주문 수
const { count } = await supabase
  .from("orders")
  .select("*", { count: "exact", head: true });

// 2. 처리 필요 주문 수 (결제완료 + 배송대기)
const { count } = await supabase
  .from("orders")
  .select("*", { count: "exact", head: true })
  .eq("payment_status", "PAID")
  .in("fulfillment_status", ["UNFULFILLED", "PREPARING"]);

// 3. 총 매출 (기간별)
const { data } = await supabase
  .from("orders")
  .select("total_amount")
  .eq("payment_status", "PAID")
  .gte("paid_at", startDate)
  .lte("paid_at", endDate);

// 4. 취소/환불 건수
const { count } = await supabase
  .from("orders")
  .select("*", { count: "exact", head: true })
  .in("payment_status", ["CANCELED", "REFUNDED"]);

// 5. 재고부족 상품 수
const { count } = await supabase
  .from("products")
  .select("*", { count: "exact", head: true })
  .is("deleted_at", null)
  .lte("stock", 10); // 임계값 설정 가능

// 6. 신규 회원 수 (기간별)
const { count } = await supabase
  .from("users")
  .select("*", { count: "exact", head: true })
  .gte("created_at", startDate)
  .lte("created_at", endDate);
```

### 주문 리스트 쿼리

```typescript
// Server-side pagination + filters
let query = supabase
  .from("orders")
  .select("*", { count: "exact" });

// 필터 적용
if (paymentStatus) {
  query = query.eq("payment_status", paymentStatus);
}
if (fulfillmentStatus) {
  query = query.eq("fulfillment_status", fulfillmentStatus);
}
if (startDate) {
  query = query.gte("paid_at", startDate);
}
if (endDate) {
  query = query.lte("paid_at", endDate);
}
if (searchQuery) {
  query = query.or(`order_number.ilike.%${searchQuery}%,shipping_name.ilike.%${searchQuery}%,shipping_phone.ilike.%${searchQuery}%`);
}

// 정렬
query = query.order("created_at", { ascending: false });

// 페이지네이션
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;
query = query.range(from, to);
```

### 상품 리스트 쿼리

```typescript
let query = supabase
  .from("products")
  .select("*, category:categories(*), images:product_images(*)", { count: "exact" })
  .is("deleted_at", null);

// 필터
if (categoryId) {
  query = query.eq("category_id", categoryId);
}
if (status) {
  query = query.eq("status", status);
}
if (stockFilter === "low") {
  query = query.lte("stock", 10);
}
if (searchQuery) {
  query = query.ilike("name", `%${searchQuery}%`);
}

// 정렬
query = query.order("created_at", { ascending: false });

// 페이지네이션
query = query.range(from, to);
```

---

## 권한 및 보안

### 1. Clerk Role 기반 접근 제어

```typescript
// middleware.ts 또는 각 페이지에서
import { isAdmin } from "@/actions/admin";

export default async function AdminPage() {
  const isAdminUser = await isAdmin();
  if (!isAdminUser) {
    redirect("/");
  }
  // ...
}
```

### 2. Supabase RLS 정책

**현재 상태**: 개발 환경에서는 RLS 비활성화  
**프로덕션**: 관리자만 전체 조회/수정 가능하도록 RLS 정책 필요

```sql
-- 예시: orders 테이블 관리자 접근 정책
CREATE POLICY "admin_full_access" ON orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_id = auth.jwt()->>'sub'
      AND users.email = ANY(ARRAY['admin@ttottoangs.com'])
    )
  );
```

### 3. Service Role Key 사용

관리자 대시보드는 RLS를 우회하기 위해 `service-role` 클라이언트 사용:

```typescript
import { getServiceRoleClient } from "@/lib/supabase/service-role";

const supabase = getServiceRoleClient();
// RLS 우회하여 모든 데이터 접근 가능
```

---

## 구현 우선순위

### P0 (필수) - MVP 핵심

1. ✅ **관리자 공통 레이아웃** (`/app/admin/layout.tsx`)
   - 사이드바 네비게이션
   - 헤더 (사용자 정보)
   - 반응형 (모바일 메뉴)

2. ✅ **대시보드 KPI 확장** (`/app/admin/page.tsx`)
   - 취소/환불 건수
   - 재고부족 상품 수
   - 신규 회원 수
   - 알림/할일 섹션

3. ✅ **주문 관리 개선** (`/app/admin/orders`)
   - 검색 기능 (주문번호, 고객명, 전화번호)
   - 필터 개선 (결제수단 추가)
   - CSV 내보내기 (기존 기능 유지)

4. ✅ **상품 관리 개선** (`/app/admin/products`)
   - 카테고리 필터
   - 노출/재고 필터
   - 정렬 기능

### P1 (운영 안정)

5. **배송/출고 페이지** (`/app/admin/fulfillment`)
   - 송장번호 등록 (단건/일괄)
   - 배송 상태 업데이트

6. **재고 관리 페이지** (`/app/admin/inventory`)
   - 재고 목록
   - 재고 수정
   - 재고부족 알림 기준 설정

7. **고객/회원 관리** (`/app/admin/customers`)
   - 회원 리스트
   - 회원 상세 (주문 이력)

### P2 (성장)

8. **리뷰/문의 관리** (`/admin/support`)
9. **프로모션 관리** (`/admin/promotions`)
10. **통계** (`/admin/analytics`)
11. **설정** (`/admin/settings`)

---

## 데이터베이스 스키마 가정

### 현재 확인된 테이블

- ✅ `orders`: 주문 정보
  - `payment_status`: PENDING, PAID, CANCELED, REFUNDED
  - `fulfillment_status`: UNFULFILLED, PREPARING, SHIPPED, DELIVERED
  - `paid_at`: 결제 완료일시
- ✅ `order_items`: 주문 상품
- ✅ `products`: 상품 정보
  - `status`: active, hidden, sold_out
  - `stock`: 재고 수
- ✅ `users`: 회원 정보
  - `clerk_id`: Clerk User ID
  - `created_at`: 가입일시
- ✅ `payments`: 결제 정보
  - `method`: 결제수단
  - `status`: done
- ✅ `reviews`: 리뷰 (추후)
- ✅ `inquiries`: 문의 (추후)

### TODO (추가 필요할 수 있는 컬럼)

- `orders.admin_memo`: 관리자 메모 (TEXT, NULL)
- `orders.admin_notes`: 관리자 노트 (JSONB, NULL) - 변경 이력 등
- `products.low_stock_threshold`: 재고부족 임계값 (INT, DEFAULT 10)

---

## 참고 사항

1. **기존 코드 유지**: 현재 `/app/admin/orders`, `/app/admin/products` 등은 이미 구현되어 있으므로, 레이아웃만 추가하고 기능은 점진적으로 개선
2. **스타일 일관성**: 기존 스타일 (`#ff6b9d`, `#4a3f48`, `#8b7d84`) 유지
3. **로딩/에러 처리**: 모든 페이지에 Skeleton UI 및 에러 처리 추가
4. **CSV 내보내기**: 기존 `exportOrdersToExcel` 함수 활용

---

## 다음 단계

1. ✅ 이 문서 작성 완료
2. ⏳ P0 구현 시작:
   - 관리자 레이아웃 생성
   - 대시보드 KPI 확장
   - 주문/상품 관리 개선
