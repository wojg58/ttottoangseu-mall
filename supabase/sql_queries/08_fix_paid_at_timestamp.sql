-- ============================================================================
-- ⚠️ DEPRECATED: 이 파일은 더 이상 사용되지 않습니다
-- ============================================================================
-- 
-- 이 스크립트의 모든 기능은 다음 파일로 통합되었습니다:
-- → supabase/sql_queries/10_orders_paid_at_complete.sql
-- 
-- 새로운 파일을 사용해주세요:
-- - 섹션 3: paid_at 동기화 검사 및 수정
-- 
-- 이 파일은 하위 호환성을 위해 유지되지만, 새로운 작업에는 사용하지 마세요.
-- ============================================================================

-- 아래 내용은 10_orders_paid_at_complete.sql의 섹션 3으로 이동되었습니다.
-- 참고용으로만 남겨둡니다.

-- ============================================================================
-- paid_at 필드 확인 및 수정 스크립트
-- ============================================================================
-- 
-- 이 스크립트는 orders 테이블의 paid_at 필드가 payments 테이블의 approved_at과
-- 정확히 일치하는지 확인하고, 필요시 업데이트합니다.
-- 
-- ⚠️ 이 기능은 10_orders_paid_at_complete.sql의 섹션 3으로 통합되었습니다.
-- ============================================================================

-- 1. 현재 상태 확인: paid_at이 NULL인 결제 완료 주문 확인
SELECT 
    o.id,
    o.order_number,
    o.payment_status,
    o.paid_at,
    o.created_at,
    p.approved_at as payment_approved_at,
    p.status as payment_status
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.payment_status = 'PAID'
ORDER BY o.created_at DESC
LIMIT 10;

-- 2. paid_at이 NULL이거나 payments.approved_at과 다른 경우 업데이트
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

-- 3. 업데이트 후 확인: paid_at과 payments.approved_at이 일치하는지 확인
SELECT 
    o.id,
    o.order_number,
    o.payment_status,
    o.paid_at,
    p.approved_at as payment_approved_at,
    CASE 
        WHEN o.paid_at = p.approved_at THEN '일치'
        ELSE '불일치'
    END as match_status
FROM public.orders o
LEFT JOIN public.payments p ON p.order_id = o.id AND p.status = 'done'
WHERE o.payment_status = 'PAID'
ORDER BY o.paid_at DESC
LIMIT 10;
