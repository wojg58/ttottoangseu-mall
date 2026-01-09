-- ============================================================================
-- orders 테이블에 paid_at 필드 추가
-- ============================================================================
-- 
-- 결제 승인 시간을 정확하게 추적하기 위해 paid_at 필드를 추가합니다.
-- 이 필드는 payment_status가 'PAID'로 변경될 때 결제 승인 시간(approved_at)을 저장합니다.
-- ============================================================================

-- 1. paid_at 컬럼 추가
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. 주석 추가
COMMENT ON COLUMN public.orders.paid_at IS '결제 완료 일시 (payment_status가 PAID로 변경된 시점)';

-- 3. 인덱스 추가 (결제 완료 주문 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON public.orders(paid_at DESC)
WHERE paid_at IS NOT NULL;

-- 4. 기존 결제 완료 주문의 paid_at 업데이트 (payments 테이블의 approved_at 사용)
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

