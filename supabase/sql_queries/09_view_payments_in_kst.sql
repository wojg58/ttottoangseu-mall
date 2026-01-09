-- ============================================================================
-- Supabase 대시보드에서 한국 시간(KST)으로 결제 정보 확인
-- ============================================================================
-- 
-- 이 쿼리는 payments 테이블의 UTC 시간을 한국 시간(KST, UTC+9)으로 변환하여
-- Supabase 대시보드에서 확인할 수 있도록 합니다.
-- 
-- 사용 방법:
-- 1. Supabase 대시보드 → SQL Editor 열기
-- 2. 이 쿼리를 복사하여 실행
-- 3. 한국 시간으로 변환된 결과 확인
-- ============================================================================

-- 최근 결제 내역을 한국 시간으로 확인
SELECT 
  p.id,
  p.order_id,
  o.order_number,
  p.amount,
  p.method,
  p.status,
  -- UTC 시간 (원본)
  p.requested_at as requested_at_utc,
  p.approved_at as approved_at_utc,
  -- 한국 시간으로 변환 (KST = UTC+9)
  (p.requested_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as requested_at_kst,
  (p.approved_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as approved_at_kst,
  p.created_at as created_at_utc,
  (p.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as created_at_kst
FROM payments p
LEFT JOIN orders o ON o.id = p.order_id
WHERE p.status = 'done'
ORDER BY p.approved_at DESC
LIMIT 20;

-- ============================================================================
-- 주문과 결제 정보를 함께 한국 시간으로 확인
-- ============================================================================
SELECT 
  o.id as order_id,
  o.order_number,
  o.payment_status,
  o.fulfillment_status,
  o.total_amount,
  -- 주문 시간 (UTC → KST)
  o.created_at as order_created_at_utc,
  (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as order_created_at_kst,
  -- 결제 완료 시간 (UTC → KST)
  o.paid_at as paid_at_utc,
  (o.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as paid_at_kst,
  -- 결제 승인 시간 (UTC → KST)
  p.approved_at as payment_approved_at_utc,
  (p.approved_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as payment_approved_at_kst
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.payment_status = 'PAID'
ORDER BY o.paid_at DESC NULLS LAST, o.created_at DESC
LIMIT 20;

-- ============================================================================
-- 시간 비교 확인 (UTC vs KST)
-- ============================================================================
-- UTC와 KST의 차이를 명확히 확인할 수 있는 쿼리
SELECT 
  p.id,
  o.order_number,
  p.amount,
  -- UTC 시간
  p.approved_at as utc_time,
  -- KST 시간 (UTC+9)
  (p.approved_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as kst_time,
  -- 시간 차이 확인 (9시간)
  EXTRACT(EPOCH FROM ((p.approved_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul') - (p.approved_at AT TIME ZONE 'UTC'))) / 3600 as timezone_offset_hours
FROM payments p
LEFT JOIN orders o ON o.id = p.order_id
WHERE p.status = 'done'
  AND p.approved_at IS NOT NULL
ORDER BY p.approved_at DESC
LIMIT 10;

