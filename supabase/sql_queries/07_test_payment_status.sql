-- ============================================================================
-- 결제 성공 시 payment_status 변경 테스트용 쿼리
-- ============================================================================
-- 
-- 사용 방법:
-- 1. 결제 테스트 전: 현재 주문 상태 확인
-- 2. 결제 테스트 실행
-- 3. 결제 테스트 후: 주문 상태 변경 확인
-- ============================================================================

-- ============================================================================
-- 1. 결제 테스트 전: 현재 주문 상태 확인
-- ============================================================================

-- PENDING 상태인 주문 조회 (결제 대기 중)
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

-- ============================================================================
-- 2. 결제 테스트 후: 주문 상태 변경 확인
-- ============================================================================

-- PAID 상태인 주문 조회 (결제 완료)
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

-- ============================================================================
-- 3. 결제 상태별 통계 확인
-- ============================================================================

SELECT 
  '=== 결제 상태별 통계 ===' as section,
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
-- 4. 최근 주문 상태 변경 이력 확인 (결제 완료된 주문)
-- ============================================================================

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
-- 5. 결제 정보와 주문 상태 매칭 확인
-- ============================================================================

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

-- ============================================================================
-- 6. 특정 주문의 상태 변경 추적 (주문 ID로 확인)
-- ============================================================================

-- 사용법: 아래 쿼리에서 'YOUR_ORDER_ID'를 실제 주문 ID로 변경
/*
SELECT 
  '=== 특정 주문 상태 확인 ===' as section,
  id,
  order_number,
  payment_status,
  fulfillment_status,
  status as old_status,
  total_amount,
  created_at,
  updated_at
FROM public.orders
WHERE id = 'YOUR_ORDER_ID';
*/

