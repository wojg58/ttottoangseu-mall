# admin-activity-log 사용 예시

## 📋 개요

`lib/admin-activity-log.ts`는 서버에서 관리자 활동을 로그로 기록하는 유틸리티입니다.

## 🚀 기본 사용법

### 1. API Route에서 사용

```typescript
// app/api/admin/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { logAdminAction } from "@/lib/admin-activity-log";
import { updateOrderStatus } from "@/actions/admin";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // 변경 전 주문 정보 조회
  const oldOrder = await getOrderById(id);

  // 주문 상태 업데이트
  const result = await updateOrderStatus(
    id,
    body.payment_status,
    body.fulfillment_status
  );

  if (result.success) {
    // 변경 후 주문 정보 조회
    const newOrder = await getOrderById(id);

    // 로그 기록
    await logAdminAction({
      action: "order_status_changed",
      entity_type: "order",
      entity_id: id,
      before: {
        payment_status: oldOrder.payment_status,
        fulfillment_status: oldOrder.fulfillment_status,
      },
      after: {
        payment_status: newOrder.payment_status,
        fulfillment_status: newOrder.fulfillment_status,
      },
      req: request, // IP, User Agent 자동 추출
    });
  }

  return NextResponse.json(result);
}
```

### 2. Server Action에서 사용

```typescript
// actions/admin.ts
"use server";

import { logAdminAction } from "@/lib/admin-activity-log";
import { headers } from "next/headers";

export async function updateProductPrice(
  productId: string,
  newPrice: number
) {
  // 변경 전 상품 정보 조회
  const oldProduct = await getProductById(productId);

  // 가격 업데이트
  await updateProduct(productId, { price: newPrice });

  // 변경 후 상품 정보 조회
  const newProduct = await getProductById(productId);

  // Request 객체 생성 (Server Action에서)
  const headersList = await headers();
  const request = new Request("http://localhost", {
    headers: Object.fromEntries(headersList.entries()),
  });

  // 로그 기록
  await logAdminAction({
    action: "product_price_updated",
    entity_type: "product",
    entity_id: productId,
    before: { price: oldProduct.price },
    after: { price: newProduct.price },
    req: request,
  });
}
```

### 3. 편의 함수 사용

```typescript
// app/api/admin/orders/[id]/route.ts
import { logOrderStatusChange } from "@/lib/admin-activity-log";

export async function PUT(request: NextRequest, { params }) {
  const { id } = await params;
  const oldOrder = await getOrderById(id);

  // 주문 상태 업데이트
  await updateOrderStatus(id, "PAID", "PREPARING");

  const newOrder = await getOrderById(id);

  // 편의 함수 사용
  await logOrderStatusChange({
    orderId: id,
    before: {
      payment_status: oldOrder.payment_status,
      fulfillment_status: oldOrder.fulfillment_status,
    },
    after: {
      payment_status: newOrder.payment_status,
      fulfillment_status: newOrder.fulfillment_status,
    },
    req: request,
  });
}
```

### 4. 재고 변경 로그

```typescript
// app/api/admin/inventory/route.ts
import { logInventoryChange } from "@/lib/admin-activity-log";

export async function PUT(request: NextRequest) {
  const { productId, variantId, stock } = await request.json();

  const oldInventory = await getInventory(productId, variantId);

  // 재고 업데이트
  await updateInventory(productId, variantId, stock);

  const newInventory = await getInventory(productId, variantId);

  // 로그 기록
  await logInventoryChange({
    productId,
    variantId,
    before: { stock: oldInventory.stock },
    after: { stock: newInventory.stock },
    req: request,
  });
}
```

### 5. 복잡한 변경 사항 로그

```typescript
// 여러 필드가 동시에 변경되는 경우
await logAdminAction({
  action: "product_updated",
  entity_type: "product",
  entity_id: productId,
  before: {
    name: "기존 상품명",
    price: 10000,
    stock: 50,
    status: "active",
  },
  after: {
    name: "새 상품명",
    price: 15000,
    stock: 30,
    status: "active",
  },
  req: request,
});
```

## 🔍 주요 특징

### 자동 관리자 검증
- 내부에서 `isAdmin()` 호출하여 관리자 권한 확인
- 관리자가 아니면 로그 기록하지 않음 (에러 없이 false 반환)

### 자동 정보 추출
- `admin_user_id`: Clerk user ID 자동 추출
- `admin_email`: 현재 사용자 이메일 자동 추출
- `ip`: Request 헤더에서 자동 추출
  - `x-forwarded-for` (우선)
  - `x-real-ip`
  - `cf-connecting-ip` (Cloudflare)
  - `req.ip` (NextRequest)
- `user_agent`: Request 헤더에서 자동 추출

### JSONB 저장
- `before`/`after` 필드는 JSONB 타입으로 저장
- 객체를 직접 전달하면 자동으로 JSONB로 변환

### 에러 처리
- 로그 기록 실패해도 메인 로직은 계속 진행
- 에러는 logger를 통해 기록되지만 예외는 던지지 않음

## ⚠️ 주의사항

1. **서버 전용**: 클라이언트 컴포넌트에서 사용 불가
2. **관리자 권한 필수**: 관리자가 아니면 로그 기록 안 함
3. **Request 객체**: IP/User Agent 추출을 위해 `req` 파라미터 권장
4. **RLS 정책**: `admin_activity_logs` 테이블의 RLS 정책에 따라 관리자만 INSERT 가능

## 📝 로그 확인

로그는 `/admin/settings/audit-logs` 페이지에서 확인할 수 있습니다.
