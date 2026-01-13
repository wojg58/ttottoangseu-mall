-- ============================================================================
-- 주문 및 결제 상태 통합 관리 스크립트
-- ============================================================================
-- 
-- 이 스크립트는 주문과 결제 상태를 확인하고 테스트하는 모든 기능을 포함합니다:
-- 1. 주문 상태 분포 확인
-- 2. 결제 테스트 전후 상태 확인
-- 3. 결제 정보와 주문 상태 매칭 확인
-- 4. 특정 주문 상세 확인
-- 5. paid_at과 approved_at 비교
-- 
-- 사용 방법:
-- - Supabase 대시보드 → SQL Editor에서 필요한 섹션만 실행
-- - 복사 붙여넣기 후 원하는 섹션만 선택하여 실행 가능
-- ============================================================================

-- ============================================================================
-- 섹션 1: 주문 상태 분포 확인
-- ============================================================================
-- 전체 주문의 payment_status와 fulfillment_status 분포를 확인합니다
-- ============================================================================

-- 1.1. 전체 주문 상태 분포 확인
SELECT 
  payment_status, 
  fulfillment_status, 
  COUNT(*) as count
FROM public.orders 
GROUP BY payment_status, fulfillment_status
ORDER BY payment_status, fulfillment_status;

-- 1.2. 결제 상태별 통계 확인
SELECT 
  payment_status,
  COUNT(*) as count,
  SUM(total_amount) as total_revenue
FROM public.orders
GROUP BY payment_status
ORDER BY 
  CASE payment_status
    WHEN 'PENDING' THEN 1
    WHEN 'PAID' THEN 2
    WHEN 'CANCELED' THEN 3
    WHEN 'REFUNDED' THEN 4
    ELSE 5
  END;

-- ============================================================================
-- 섹션 2: 결제 테스트 전후 상태 확인
-- ============================================================================
-- 결제 테스트 전후로 주문 상태가 올바르게 변경되었는지 확인합니다
-- ============================================================================

-- 2.1. 결제 테스트 전: 현재 주문 상태 확인 (PENDING 상태)
SELECT 
  '=== 결제 대기 중인 주문 ===' as section,
  id,
  order_number,
  payment_status,
  fulfillment_status,
  total_amount,
  created_at
FROM public.orders
WHERE payment_status = 'PENDING'
ORDER BY created_at DESC
LIMIT 10;

-- 2.2. 결제 테스트 후: 주문 상태 변경 확인 (PAID 상태)
SELECT 
  '=== 결제 완료된 주문 ===' as section,
  id,
  order_number,
  payment_status,
  fulfillment_status,
  total_amount,
  created_at,
  updated_at
FROM public.orders
WHERE payment_status = 'PAID'
ORDER BY updated_at DESC
LIMIT 10;

-- 2.3. 최근 주문 상태 변경 이력 확인 (결제 완료된 주문)
SELECT 
  '=== 최근 결제 완료 주문 (상태 변경 확인용) ===' as section,
  id,
  order_number,
  payment_status,
  fulfillment_status,
  status as old_status, -- 하위 호환성 컬럼
  total_amount,
  created_at,
  updated_at,
  -- created_at과 updated_at의 차이로 상태 변경 시점 확인
  EXTRACT(EPOCH FROM (updated_at - created_at)) as seconds_since_creation
FROM public.orders
WHERE payment_status = 'PAID'
ORDER BY updated_at DESC
LIMIT 5;

-- ============================================================================
-- 섹션 3: 결제 정보와 주문 상태 매칭 확인
-- ============================================================================
-- orders 테이블과 payments 테이블의 상태가 일치하는지 확인합니다
-- ============================================================================

-- 3.1. 결제 정보와 주문 상태 매칭 확인
SELECT 
  '=== 결제 정보와 주문 상태 매칭 ===' as section,
  o.id as order_id,
  o.order_number,
  o.payment_status,
  o.fulfillment_status,
  o.total_amount as order_amount,
  p.id as payment_id,
  p.status as payment_status_in_payments,
  p.amount as payment_amount,
  p.approved_at,
  CASE 
    WHEN o.payment_status = 'PAID' AND p.status = 'done' THEN '✅ 정상'
    WHEN o.payment_status = 'PENDING' AND p.status IS NULL THEN '⏳ 대기 중'
    WHEN o.payment_status = 'PAID' AND p.status IS NULL THEN '⚠️ 결제 정보 없음'
    ELSE '❌ 불일치'
  END as status_match
FROM public.orders o
LEFT JOIN public.payments p ON o.id = p.order_id
WHERE o.payment_status IN ('PENDING', 'PAID')
ORDER BY o.updated_at DESC
LIMIT 10;

-- 3.2. paid_at과 approved_at 비교 (전체 주문, LIMIT 없음)
SELECT 
    o.order_number,
    o.paid_at as order_paid_at,
    p.approved_at as payment_approved_at,
    CASE 
        WHEN o.paid_at = p.approved_at THEN '✅ 일치'
        ELSE '❌ 불일치'
    END as match_status
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.payment_status = 'PAID'
ORDER BY o.paid_at DESC NULLS LAST;

-- ============================================================================
-- 섹션 4: 특정 주문 상세 확인
-- ============================================================================
-- 특정 주문 ID로 주문과 결제 정보를 상세히 확인합니다
-- 사용법: 쿼리에서 'YOUR_ORDER_ID'를 실제 주문 ID로 변경
-- ============================================================================

-- 4.1. 특정 주문의 상태 확인
-- 사용법: 아래 쿼리에서 'YOUR_ORDER_ID'를 실제 주문 ID로 변경
/*
SELECT 
  '=== 특정 주문 상태 확인 ===' as section,
  id,
  order_number,
  payment_status,
  fulfillment_status,
  status as old_status, -- 하위 호환성 컬럼
  total_amount,
  created_at,
  updated_at,
  paid_at
FROM public.orders
WHERE id = 'YOUR_ORDER_ID';
*/

-- 4.2. 특정 주문의 결제 정보 확인
-- 사용법: 아래 쿼리에서 'YOUR_ORDER_ID'를 실제 주문 ID로 변경
/*
SELECT 
  '=== 특정 주문의 결제 정보 ===' as section,
  id,
  order_id,
  payment_key,
  method,
  status,
  amount,
  requested_at,
  approved_at,
  created_at
FROM public.payments
WHERE order_id = 'YOUR_ORDER_ID';
*/

-- 4.3. 특정 주문의 통합 확인 (주문 + 결제 정보)
-- 사용법: 아래 쿼리에서 'YOUR_ORDER_ID'를 실제 주문 ID로 변경
/*
SELECT 
  '=== 특정 주문 통합 확인 ===' as section,
  o.id as order_id,
  o.order_number,
  o.payment_status,
  o.fulfillment_status,
  o.total_amount as order_amount,
  o.paid_at as order_paid_at,
  o.created_at as order_created_at,
  o.updated_at as order_updated_at,
  p.id as payment_id,
  p.payment_key,
  p.method,
  p.status as payment_status,
  p.amount as payment_amount,
  p.requested_at,
  p.approved_at,
  p.created_at as payment_created_at,
  CASE 
    WHEN o.paid_at = p.approved_at THEN '✅ 일치'
    ELSE '❌ 불일치'
  END as paid_at_match
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.id = 'YOUR_ORDER_ID';
*/

-- ============================================================================
-- 섹션 5: 빠른 확인용 쿼리 (주문 ID 직접 입력)
-- ============================================================================
-- 아래 쿼리들은 주문 ID를 직접 입력하여 빠르게 확인할 수 있습니다
-- ⚠️ 주의: 이 섹션은 기본적으로 주석 처리되어 있습니다.
-- 사용하려면 주석을 해제하고 'YOUR_ORDER_ID_HERE'를 실제 주문 ID로 변경하세요.
-- ============================================================================

-- 5.1. 주문 상태 확인 (주문 ID 직접 입력)
-- 사용법: 아래 주석을 해제하고 'YOUR_ORDER_ID_HERE'를 실제 주문 ID로 변경
-- 예시: '9c6fb7dd-e9cf-4073-b172-f5a7cbadd420'
/*
SELECT 
  id,
  order_number,
  payment_status,
  fulfillment_status,
  total_amount,
  paid_at,
  created_at,
  updated_at
FROM public.orders
WHERE id = 'YOUR_ORDER_ID_HERE';
*/

-- 5.2. 결제 정보 확인 (주문 ID 직접 입력)
-- 사용법: 아래 주석을 해제하고 'YOUR_ORDER_ID_HERE'를 실제 주문 ID로 변경
-- 예시: '9c6fb7dd-e9cf-4073-b172-f5a7cbadd420'
/*
SELECT 
  id,
  order_id,
  payment_key,
  method,
  status,
  amount,
  requested_at,
  approved_at,
  created_at
FROM public.payments
WHERE order_id = 'YOUR_ORDER_ID_HERE';
*/

-- 5.3. 주문과 결제 정보 통합 확인 (주문 ID 직접 입력)
-- 사용법: 아래 주석을 해제하고 'YOUR_ORDER_ID_HERE'를 실제 주문 ID로 변경
-- 예시: '9c6fb7dd-e9cf-4073-b172-f5a7cbadd420'
/*
SELECT 
    o.order_number,
    o.payment_status,
    o.fulfillment_status,
    o.total_amount as order_amount,
    o.paid_at as order_paid_at,
    p.approved_at as payment_approved_at,
    CASE 
        WHEN o.paid_at = p.approved_at THEN '✅ 일치'
        ELSE '❌ 불일치'
    END as match_status
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.id = 'YOUR_ORDER_ID_HERE';
*/

