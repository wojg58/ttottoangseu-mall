# 어드민 페이지 기능 개선 제안서

> **작성 기준**: 10년차 백오피스 개발자 관점에서의 비즈니스 로직 분석 및 개선 제안  
> **작성일**: 2026년 1월 11일  
> **프로젝트**: ttottoangseumall (전자상거래 플랫폼)

---

## 📋 목차

1. [현재 구현 현황](#현재-구현-현황)
2. [핵심 비즈니스 로직 분석](#핵심-비즈니스-로직-분석)
3. [우선순위별 개선 제안](#우선순위별-개선-제안)
4. [상세 기능 명세](#상세-기능-명세)
5. [구현 가이드](#구현-가이드)

---

## 현재 구현 현황

### ✅ 구현된 기능

#### 1. 대시보드 (`/admin`)
- 기본 통계: 총 주문 수, 대기 주문 수, 총 매출, 총 상품 수
- 최근 주문 5개 표시
- 빠른 메뉴 (주문 관리, 상품 관리)

#### 2. 주문 관리 (`/admin/orders`)
- 주문 목록 조회 (페이지네이션, 필터링)
- 주문 상태 필터 (결제 대기, 결제 완료, 배송중 등)
- 날짜 필터 (결제 완료일 기준)
- 주문 상세 조회 (`/admin/orders/[id]`)
- 주문 상태 업데이트 (결제 상태, 배송 상태)
- 운송장 번호 입력
- 엑셀 다운로드 (주문 내역)

#### 3. 상품 관리 (`/admin/products`)
- 상품 목록 조회 (검색, 페이지네이션)
- 상품 등록/수정/삭제 (소프트 삭제)
- 상품 이미지 업로드 (Supabase Storage)
- 상품 옵션 관리 (variant)
- 재고 관리
- 상품 상태 변경 (active/hidden/sold_out)
- 일괄 작업 (숨김/복원/삭제)
- 이미지 일괄 업로드
- 상품 이관 (네이버 스마트스토어)

#### 4. 기타
- 쿠폰 시스템 (자동 발급, 사용)
- 리뷰/문의 관리 (기본 CRUD)
- 네이버 스마트스토어 재고 동기화 큐

---

## 핵심 비즈니스 로직 분석

### 비즈니스 도메인
- **전자상거래 플랫폼**: 상품 판매, 주문 처리, 배송 관리
- **멀티 채널**: 자사몰 + 네이버 스마트스토어 동기화
- **결제 시스템**: 토스페이먼츠 연동
- **회원 관리**: Clerk 인증 기반

### 데이터 흐름
1. **주문 생성 → 결제 승인 → 재고 차감 → 배송 처리**
2. **상품 등록 → 네이버 동기화 큐 적재 → 재고 동기화**
3. **쿠폰 발급 → 주문 시 사용 → 상태 업데이트**

### 현재 아키텍처
- **인증**: Clerk (이메일 기반 관리자 권한)
- **데이터베이스**: Supabase (PostgreSQL)
- **스토리지**: Supabase Storage
- **결제**: 토스페이먼츠
- **외부 연동**: 네이버 스마트스토어 API

---

## 우선순위별 개선 제안

### 🔴 P0 (즉시 구현 필요)

#### 1. 고급 통계 및 분석 대시보드
**현재 문제점**: 기본 통계만 제공, 트렌드 분석 불가  
**개선 효과**: 매출 분석, 상품별 판매량 파악, 의사결정 지원

**필요 기능**:
- 일/주/월별 매출 트렌드 차트
- 상품별 판매량 TOP 10
- 카테고리별 매출 분포
- 결제 수단별 통계
- 신규/기존 고객 구분 통계

#### 2. 재고 관리 고도화
**현재 문제점**: 재고 수량만 표시, 알림/이력 관리 없음  
**개선 효과**: 재고 부족 사전 예방, 재고 이력 추적

**필요 기능**:
- 재고 부족 알림 (임계값 설정)
- 재고 변동 이력 (입고/출고/조정)
- 재고 자동 발주 제안 (판매 속도 기반)
- 옵션별 재고 현황 대시보드

#### 3. 고객 관리 시스템
**현재 문제점**: 고객 정보 조회 불가, 구매 이력 추적 어려움  
**개선 효과**: 고객 세그먼트 분석, VIP 관리, 재구매 유도

**필요 기능**:
- 고객 목록 조회 (검색, 필터링)
- 고객 상세 정보 (구매 이력, 총 구매액, 평균 주문 금액)
- 고객 세그먼트 (신규/기존/VIP)
- 고객별 주문 통계
- 고객 메모/태그 기능

---

### 🟡 P1 (단기 구현 권장)

#### 4. 주문 관리 고도화
**현재 문제점**: 기본적인 상태 업데이트만 가능  
**개선 효과**: 주문 처리 효율성 향상, 오류 감소

**필요 기능**:
- 주문 일괄 처리 (상태 변경, 운송장 번호 입력)
- 주문 검색 고도화 (주문번호, 고객명, 연락처, 상품명)
- 주문 내역 수정 (배송지 변경, 메모 추가)
- 주문 취소/환불 처리 (재고 복구, 쿠폰 복구)
- 주문 알림 (신규 주문, 결제 완료, 배송 완료)

#### 5. 리포트 생성 및 다운로드
**현재 문제점**: 엑셀 다운로드만 제공, 리포트 다양성 부족  
**개선 효과**: 정기 리포트 자동화, 세무/회계 지원

**필요 기능**:
- 일일/주간/월간 매출 리포트
- 상품별 판매 리포트
- 고객별 구매 리포트
- 세무 신고용 리포트 (매출 증빙)
- 커스텀 리포트 생성 (필터 기반)

#### 6. 쿠폰 관리 시스템
**현재 문제점**: 자동 발급만 가능, 관리 기능 부족  
**개선 효과**: 마케팅 전략 수립, 쿠폰 사용률 분석

**필요 기능**:
- 쿠폰 목록 조회 (발급/사용/만료)
- 쿠폰 생성/수정/삭제
- 쿠폰 일괄 발급 (고객 그룹별)
- 쿠폰 사용 통계 (사용률, 할인 금액)
- 쿠폰 만료 알림

---

### 🟢 P2 (중장기 개선)

#### 7. 마케팅 도구
**필요 기능**:
- 프로모션 관리 (할인, 무료배송, 사은품)
- 이벤트 관리 (기간별 이벤트)
- 푸시 알림 발송 (고객 그룹별)
- 이메일 마케팅 (주문 확인, 배송 알림)

#### 8. 운영 효율성 도구
**필요 기능**:
- 작업 로그 (관리자 활동 기록)
- 알림 센터 (주문 알림, 재고 알림, 에러 알림)
- 자동화 워크플로우 (n8n 연동)
- 백업/복구 관리

#### 9. 재무 관리
**필요 기능**:
- 정산 관리 (일일/월간 정산)
- 환불 처리 (부분 환불, 전체 환불)
- 세금 계산 (부가세, 원가계산)
- 수수료 관리 (결제 수수료, 배송비)

#### 10. 권한 관리
**필요 기능**:
- 역할 기반 접근 제어 (RBAC)
- 관리자 계정 관리
- 권한별 기능 제한
- 활동 로그 (감사 추적)

---

## 상세 기능 명세

### 1. 고급 통계 및 분석 대시보드

#### 1.1 매출 트렌드 차트
```typescript
// 기능: 일/주/월별 매출 추이 시각화
// 데이터 소스: orders 테이블 (paid_at 기준)
// 차트 라이브러리: recharts 또는 Chart.js

interface SalesTrendData {
  date: string;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

// API 엔드포인트 예시
GET /api/admin/analytics/sales-trend?period=daily&startDate=2026-01-01&endDate=2026-01-31
```

**구현 위치**: `app/admin/analytics/page.tsx` (신규 생성)

#### 1.2 상품별 판매량 TOP 10
```typescript
// 기능: 판매량 기준 상위 10개 상품 표시
// 데이터 소스: order_items + products 조인

interface TopProduct {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

// API 엔드포인트 예시
GET /api/admin/analytics/top-products?period=monthly&limit=10
```

#### 1.3 카테고리별 매출 분포
```typescript
// 기능: 카테고리별 매출 비율 파이 차트
// 데이터 소스: order_items + products + categories 조인

interface CategoryRevenue {
  categoryId: string;
  categoryName: string;
  revenue: number;
  percentage: number;
}
```

---

### 2. 재고 관리 고도화

#### 2.1 재고 부족 알림
```typescript
// 기능: 재고가 임계값 이하로 떨어지면 알림
// 설정: 상품별 또는 전역 임계값 설정

interface StockAlert {
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  variantId?: string;
  variantName?: string;
}

// 데이터베이스 스키마 추가 필요
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  threshold INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**구현 위치**: `app/admin/inventory/alerts/page.tsx` (신규 생성)

#### 2.2 재고 변동 이력
```typescript
// 기능: 재고 입고/출고/조정 이력 추적
// 데이터 소스: stock_transactions 테이블 (신규 생성 필요)

interface StockTransaction {
  id: string;
  productId: string;
  variantId?: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  orderId?: string;
  createdBy: string;
  createdAt: string;
}

// 데이터베이스 스키마 추가 필요
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  type VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  reason TEXT,
  order_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**구현 위치**: `app/admin/inventory/history/page.tsx` (신규 생성)

#### 2.3 재고 자동 발주 제안
```typescript
// 기능: 판매 속도 기반 재고 발주 제안
// 알고리즘: (평균 일일 판매량 × 리드타임) - 현재 재고

interface ReorderSuggestion {
  productId: string;
  productName: string;
  currentStock: number;
  averageDailySales: number;
  leadTime: number; // 일
  suggestedQuantity: number;
  urgency: 'low' | 'medium' | 'high';
}
```

---

### 3. 고객 관리 시스템

#### 3.1 고객 목록 조회
```typescript
// 기능: 고객 검색, 필터링, 정렬
// 필터: 가입일, 구매 횟수, 총 구매액, 세그먼트

interface CustomerListParams {
  search?: string; // 이름, 이메일, 연락처
  segment?: 'new' | 'existing' | 'vip';
  minPurchaseAmount?: number;
  minOrderCount?: number;
  joinDateFrom?: string;
  joinDateTo?: string;
  page?: number;
  pageSize?: number;
}

interface CustomerListItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate: string;
  segment: 'new' | 'existing' | 'vip';
  createdAt: string;
}
```

**구현 위치**: `app/admin/customers/page.tsx` (신규 생성)

#### 3.2 고객 상세 정보
```typescript
// 기능: 고객별 상세 정보 및 구매 이력
// 포함 정보: 기본 정보, 구매 통계, 주문 내역, 쿠폰 사용 이력

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  lastOrderDate: string;
  statistics: {
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    favoriteCategory: string;
  };
  orders: Order[];
  coupons: Coupon[];
  notes: CustomerNote[];
}
```

**구현 위치**: `app/admin/customers/[id]/page.tsx` (신규 생성)

#### 3.3 고객 세그먼트 자동 분류
```typescript
// 기능: 구매 이력 기반 자동 세그먼트 분류
// 규칙:
// - 신규: 가입 후 30일 이내, 주문 1회 이하
// - 기존: 가입 후 30일 이상, 주문 2회 이상
// - VIP: 총 구매액 100만원 이상 또는 주문 10회 이상

// 데이터베이스 스키마 추가 필요
ALTER TABLE users ADD COLUMN segment VARCHAR(20) DEFAULT 'new';
ALTER TABLE users ADD COLUMN total_spent DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN total_orders INT DEFAULT 0;

// 트리거로 자동 업데이트
CREATE OR REPLACE FUNCTION update_user_segment()
RETURNS TRIGGER AS $$
BEGIN
  -- 세그먼트 업데이트 로직
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### 4. 주문 관리 고도화

#### 4.1 주문 일괄 처리
```typescript
// 기능: 여러 주문을 선택하여 일괄 상태 변경
// 예시: 배송 준비 완료 주문들을 일괄 "배송중"으로 변경

interface BulkOrderUpdate {
  orderIds: string[];
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  trackingNumber?: string;
}

// Server Action 예시
export async function bulkUpdateOrders(
  input: BulkOrderUpdate
): Promise<{ success: boolean; updated: number }> {
  // 구현
}
```

**구현 위치**: `components/admin/bulk-order-update.tsx` (신규 생성)

#### 4.2 주문 검색 고도화
```typescript
// 기능: 다양한 조건으로 주문 검색
// 검색 필드: 주문번호, 고객명, 연락처, 이메일, 상품명, 운송장 번호

interface AdvancedOrderSearch {
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  productName?: string;
  trackingNumber?: string;
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  dateFrom?: string;
  dateTo?: string;
}
```

**구현 위치**: `components/admin/advanced-order-search.tsx` (신규 생성)

#### 4.3 주문 내역 수정
```typescript
// 기능: 주문 배송지, 메모 수정
// 제한: 배송 시작 전에만 수정 가능

interface UpdateOrderInput {
  orderId: string;
  shippingName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  shippingZipCode?: string;
  shippingMemo?: string;
}

// Server Action 예시
export async function updateOrderShippingInfo(
  input: UpdateOrderInput
): Promise<{ success: boolean; message: string }> {
  // 배송 상태 확인
  // 배송 시작 전이면 수정 가능
  // 배송 시작 후면 에러 반환
}
```

---

### 5. 리포트 생성 및 다운로드

#### 5.1 일일/주간/월간 매출 리포트
```typescript
// 기능: 기간별 매출 리포트 생성 및 다운로드
// 포함 정보: 총 매출, 주문 수, 평균 주문 금액, 상품별 판매량

interface SalesReport {
  period: 'daily' | 'weekly' | 'monthly';
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  byCategory: CategoryRevenue[];
  byProduct: ProductSales[];
  byPaymentMethod: PaymentMethodRevenue[];
}

// API 엔드포인트 예시
GET /api/admin/reports/sales?period=monthly&startDate=2026-01-01&endDate=2026-01-31&format=excel
```

**구현 위치**: `app/admin/reports/sales/page.tsx` (신규 생성)

#### 5.2 세무 신고용 리포트
```typescript
// 기능: 부가세 신고용 매출 증빙 리포트
// 포함 정보: 공급가액, 부가세, 합계, 거래 내역

interface TaxReport {
  period: string;
  totalSupplyAmount: number; // 공급가액
  totalVAT: number; // 부가세
  totalAmount: number; // 합계
  transactions: TaxTransaction[];
}

interface TaxTransaction {
  date: string;
  orderNumber: string;
  customerName: string;
  supplyAmount: number;
  vat: number;
  totalAmount: number;
}
```

---

### 6. 쿠폰 관리 시스템

#### 6.1 쿠폰 목록 조회
```typescript
// 기능: 쿠폰 목록 조회 및 관리
// 필터: 상태, 할인 유형, 만료일

interface CouponListParams {
  status?: 'active' | 'used' | 'expired';
  discountType?: 'fixed' | 'percentage';
  expiresFrom?: string;
  expiresTo?: string;
  page?: number;
  pageSize?: number;
}

interface CouponListItem {
  id: string;
  code: string;
  name: string;
  discountType: 'fixed' | 'percentage';
  discountAmount: number;
  minOrderAmount: number;
  status: 'active' | 'used' | 'expired';
  usedCount: number;
  totalDiscount: number;
  expiresAt: string;
  createdAt: string;
}
```

**구현 위치**: `app/admin/coupons/page.tsx` (신규 생성)

#### 6.2 쿠폰 생성/수정
```typescript
// 기능: 쿠폰 생성 및 수정
// 검증: 할인 금액, 최소 주문 금액, 만료일

interface CreateCouponInput {
  name: string;
  code?: string; // 자동 생성 또는 수동 입력
  discountType: 'fixed' | 'percentage';
  discountAmount: number;
  minOrderAmount: number;
  maxDiscountAmount?: number; // percentage 타입일 때
  expiresAt: string;
  userIds?: string[]; // 특정 고객에게만 발급
  limit?: number; // 발급 제한 수
}

// Server Action 예시
export async function createCoupon(
  input: CreateCouponInput
): Promise<{ success: boolean; couponId?: string }> {
  // 검증 로직
  // 쿠폰 생성
  // 특정 고객에게 발급 (userIds가 있으면)
}
```

**구현 위치**: `app/admin/coupons/new/page.tsx` (신규 생성)

#### 6.3 쿠폰 사용 통계
```typescript
// 기능: 쿠폰 사용률 및 할인 금액 통계
// 분석: 발급 수, 사용 수, 사용률, 총 할인 금액

interface CouponStatistics {
  couponId: string;
  couponName: string;
  issuedCount: number;
  usedCount: number;
  usageRate: number; // 사용률 (%)
  totalDiscount: number; // 총 할인 금액
  averageDiscount: number; // 평균 할인 금액
  topUsers: Array<{
    userId: string;
    userName: string;
    usageCount: number;
  }>;
}
```

---

## 구현 가이드

### 1. 데이터베이스 스키마 추가

#### 재고 알림 테이블
```sql
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  variant_id TEXT,
  threshold INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_stock_alerts_product_id ON stock_alerts(product_id);
CREATE INDEX idx_stock_alerts_is_active ON stock_alerts(is_active);
```

#### 재고 변동 이력 테이블
```sql
CREATE TABLE stock_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  variant_id TEXT,
  type VARCHAR(20) NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity INT NOT NULL,
  reason TEXT,
  order_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_stock_transactions_product_id ON stock_transactions(product_id);
CREATE INDEX idx_stock_transactions_order_id ON stock_transactions(order_id);
CREATE INDEX idx_stock_transactions_created_at ON stock_transactions(created_at);
```

#### 고객 세그먼트 컬럼 추가
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS segment VARCHAR(20) DEFAULT 'new';
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_spent DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_orders INT DEFAULT 0;

CREATE INDEX idx_users_segment ON users(segment);
CREATE INDEX idx_users_total_spent ON users(total_spent);
```

### 2. Server Actions 추가

#### 고객 목록 조회
```typescript
// actions/admin-customers.ts (신규 생성)

export async function getAdminCustomers(
  params: CustomerListParams
): Promise<PaginatedResponse<CustomerListItem>> {
  // 구현
}
```

#### 통계 조회
```typescript
// actions/admin-analytics.ts (신규 생성)

export async function getSalesTrend(
  period: 'daily' | 'weekly' | 'monthly',
  startDate: string,
  endDate: string
): Promise<SalesTrendData[]> {
  // 구현
}

export async function getTopProducts(
  period: 'daily' | 'weekly' | 'monthly',
  limit: number = 10
): Promise<TopProduct[]> {
  // 구현
}
```

### 3. 컴포넌트 구조

```
app/admin/
├── analytics/          # 통계 및 분석 (신규)
│   └── page.tsx
├── customers/          # 고객 관리 (신규)
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── inventory/        # 재고 관리 (신규)
│   ├── alerts/
│   │   └── page.tsx
│   └── history/
│       └── page.tsx
├── coupons/           # 쿠폰 관리 (신규)
│   ├── page.tsx
│   └── new/
│       └── page.tsx
├── reports/           # 리포트 (신규)
│   ├── sales/
│   │   └── page.tsx
│   └── tax/
│       └── page.tsx
├── orders/            # 기존
├── products/          # 기존
└── page.tsx           # 대시보드 (개선)
```

### 4. 우선순위별 구현 계획

#### Phase 1 (1-2주)
1. 고급 통계 대시보드 구현
2. 재고 알림 시스템 구현
3. 고객 목록 조회 구현

#### Phase 2 (2-3주)
4. 재고 변동 이력 구현
5. 주문 일괄 처리 구현
6. 쿠폰 관리 시스템 구현

#### Phase 3 (3-4주)
7. 리포트 생성 시스템 구현
8. 고객 상세 정보 구현
9. 주문 검색 고도화 구현

---

## 참고 사항

### 성능 최적화
- 대량 데이터 조회 시 페이지네이션 필수
- 통계 쿼리는 인덱스 최적화 필요
- 캐싱 전략 고려 (Redis 또는 Next.js 캐싱)

### 보안 고려사항
- 모든 어드민 API는 `isAdmin()` 체크 필수
- 민감 정보 (고객 개인정보) 접근 로그 기록
- RBAC 구현 시 권한별 접근 제어

### 사용자 경험
- 로딩 상태 표시 (Skeleton UI)
- 에러 처리 및 사용자 친화적 메시지
- 반응형 디자인 (모바일 지원)

---

## 결론

현재 프로젝트는 기본적인 전자상거래 기능은 잘 구현되어 있으나, **운영 효율성**과 **데이터 분석** 측면에서 개선이 필요합니다.

**즉시 구현 권장 기능**:
1. 고급 통계 대시보드 (매출 트렌드, 상품별 판매량)
2. 재고 알림 시스템 (재고 부족 사전 예방)
3. 고객 관리 시스템 (고객 세그먼트, 구매 이력)

이러한 기능들을 구현하면 **운영 효율성 향상**과 **데이터 기반 의사결정**이 가능해집니다.

