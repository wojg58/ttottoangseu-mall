-- ============================================================================
-- orders.paid_at 필드 통합 관리 스크립트
-- ============================================================================
-- 
-- 이 스크립트는 orders 테이블의 paid_at 필드를 관리하는 모든 기능을 포함합니다:
-- 1. paid_at 컬럼 추가 (마이그레이션)
-- 2. paid_at 동기화 및 검증
-- 3. 한국 시간(KST)으로 시간 확인
-- 
-- 사용 방법:
-- - Supabase 대시보드 → SQL Editor에서 필요한 섹션만 실행
-- - 전체 실행 시 순서대로 실행됩니다
-- - 복사 붙여넣기 후 원하는 섹션만 선택하여 실행 가능
-- ============================================================================

-- ============================================================================
-- 섹션 1: paid_at 컬럼 추가 (마이그레이션)
-- ============================================================================
-- 주의: 이미 컬럼이 추가되어 있다면 이 섹션은 건너뛰세요
-- ============================================================================

-- 1.1. paid_at 컬럼 추가
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 1.2. 주석 추가
COMMENT ON COLUMN public.orders.paid_at IS '결제 완료 일시 (payment_status가 PAID로 변경된 시점, payments.approved_at과 동일)';

-- 1.3. 인덱스 추가 (결제 완료 주문 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders(paid_at DESC)
WHERE paid_at IS NOT NULL;

-- ============================================================================
-- 섹션 2: 기존 결제 완료 주문의 paid_at 초기화
-- ============================================================================
-- payments 테이블의 approved_at을 사용하여 paid_at을 업데이트합니다
-- ============================================================================

UPDATE public.orders o
SET paid_at = (
  SELECT p.approved_at
  FROM public.payments p
  WHERE p.order_id = o.id
    AND p.status = 'done'
    AND p.approved_at IS NOT NULL
  ORDER BY p.approved_at DESC
  LIMIT 1
)
WHERE o.payment_status = 'PAID'
  AND o.paid_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.order_id = o.id
      AND p.status = 'done'
      AND p.approved_at IS NOT NULL
  );

-- ============================================================================
-- 섹션 3: paid_at 동기화 검사 및 수정
-- ============================================================================
-- orders.paid_at과 payments.approved_at이 일치하는지 확인하고 수정합니다
-- ============================================================================

-- 3.1. 현재 상태 확인: paid_at이 NULL이거나 불일치하는 주문 확인
SELECT 
    o.id,
    o.order_number,
    o.payment_status,
    o.paid_at as order_paid_at,
    o.created_at,
    p.approved_at as payment_approved_at,
    p.status as payment_status,
    CASE 
        WHEN o.paid_at IS NULL THEN 'paid_at NULL'
        WHEN o.paid_at = p.approved_at THEN '일치'
        ELSE '불일치'
    END as sync_status
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.payment_status = 'PAID'
ORDER BY o.created_at DESC
LIMIT 20;

-- 3.2. paid_at 동기화: NULL이거나 payments.approved_at과 다른 경우 업데이트
UPDATE public.orders o
SET paid_at = (
  SELECT p.approved_at
  FROM public.payments p
  WHERE p.order_id = o.id
    AND p.status = 'done'
    AND p.approved_at IS NOT NULL
  ORDER BY p.approved_at DESC
  LIMIT 1
)
WHERE o.payment_status = 'PAID'
  AND (
    o.paid_at IS NULL
    OR o.paid_at != (
      SELECT p.approved_at
      FROM public.payments p
      WHERE p.order_id = o.id
        AND p.status = 'done'
        AND p.approved_at IS NOT NULL
      ORDER BY p.approved_at DESC
      LIMIT 1
    )
  )
  AND EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.order_id = o.id
      AND p.status = 'done'
      AND p.approved_at IS NOT NULL
  );

-- 3.3. 동기화 후 검증: paid_at과 payments.approved_at 일치 확인
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
ORDER BY o.paid_at DESC NULLS LAST
LIMIT 20;

-- 3.4. 전체 주문의 paid_at과 approved_at 비교 (LIMIT 없음)
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
-- 섹션 4: 한국 시간(KST)으로 시간 확인
-- ============================================================================
-- UTC로 저장된 시간을 한국 시간(KST, UTC+9)으로 변환하여 확인합니다
-- ============================================================================

-- 4.1. 최근 결제 내역을 한국 시간으로 확인
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

-- 4.2. 주문과 결제 정보를 함께 한국 시간으로 확인
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
  (p.approved_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as payment_approved_at_kst,
  -- 동기화 상태 확인
  CASE 
    WHEN o.paid_at = p.approved_at THEN '✅ 일치'
    ELSE '❌ 불일치'
  END as sync_status
FROM orders o
LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.payment_status = 'PAID'
ORDER BY o.paid_at DESC NULLS LAST, o.created_at DESC
LIMIT 20;

-- 4.3. 시간 비교 확인 (UTC vs KST)
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

-- 4.4. paid_at과 approved_at을 한국 시간으로 비교
SELECT 
    o.order_number,
    -- UTC 시간
    o.paid_at as order_paid_at_utc,
    p.approved_at as payment_approved_at_utc,
    -- 한국 시간으로 변환
    (o.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as paid_at_kst,
    (p.approved_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')::text as approved_at_kst,
    -- 동기화 상태
    CASE 
        WHEN o.paid_at = p.approved_at THEN '✅ 일치'
        ELSE '❌ 불일치'
    END as match_status
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.payment_status = 'PAID'
ORDER BY o.paid_at DESC NULLS LAST
LIMIT 20;

-- ============================================================================
-- 섹션 5: 통계 및 요약
-- ============================================================================
-- paid_at 관련 통계 정보를 확인합니다
-- ============================================================================

-- 5.1. paid_at 동기화 상태 요약
SELECT 
    COUNT(*) as total_paid_orders,
    COUNT(o.paid_at) as orders_with_paid_at,
    COUNT(*) - COUNT(o.paid_at) as orders_without_paid_at,
    COUNT(CASE WHEN o.paid_at = p.approved_at THEN 1 END) as synced_count,
    COUNT(CASE WHEN o.paid_at != p.approved_at OR (o.paid_at IS NULL AND p.approved_at IS NOT NULL) THEN 1 END) as unsynced_count
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.payment_status = 'PAID';

-- 5.2. 최근 결제 완료 주문 요약 (한국 시간 기준)
SELECT 
    DATE((o.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul')) as payment_date_kst,
    COUNT(*) as order_count,
    SUM(o.total_amount) as total_revenue
FROM public.orders o
WHERE o.payment_status = 'PAID'
  AND o.paid_at IS NOT NULL
GROUP BY DATE((o.paid_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Seoul'))
ORDER BY payment_date_kst DESC
LIMIT 7;
