-- ============================================================================
-- 주문 상태 분리: payment_status + fulfillment_status
-- ============================================================================
-- 
-- 실행 방법: Supabase Dashboard → SQL Editor → 이 파일 전체 복사 후 실행
-- 
-- 기존 구조:
--   - orders.status (단일 컬럼)
--     - pending: 결제 대기
--     - confirmed: 결제 완료
--     - preparing: 상품 준비중
--     - shipped: 배송중
--     - delivered: 배송 완료
--     - cancelled: 주문 취소
--
-- 새로운 구조:
--   - orders.payment_status (결제 상태)
--     - PENDING: 결제 대기/생성됨
--     - PAID: 결제 성공
--     - CANCELED: 주문 취소
--     - REFUNDED: 환불 완료
--
--   - orders.fulfillment_status (이행/배송 상태)
--     - UNFULFILLED: 미처리
--     - PREPARING: 상품 준비
--     - SHIPPED: 배송중
--     - DELIVERED: 배송완료
--     - CANCELED: 주문 취소 시 동기화 가능
--
-- 마이그레이션 규칙:
--   - pending → payment_status=PENDING, fulfillment_status=UNFULFILLED
--   - confirmed → payment_status=PAID, fulfillment_status=UNFULFILLED
--   - preparing → payment_status=PAID, fulfillment_status=PREPARING
--   - shipped → payment_status=PAID, fulfillment_status=SHIPPED
--   - delivered → payment_status=PAID, fulfillment_status=DELIVERED
--   - cancelled → payment_status=CANCELED, fulfillment_status=CANCELED
-- ============================================================================

-- ============================================================================
-- 1. 마이그레이션 실행
-- ============================================================================

-- 1-1. payment_status 컬럼 추가
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20);

-- 1-2. fulfillment_status 컬럼 추가
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20);

-- 1-3. 기존 status 값을 두 컬럼으로 분리하여 업데이트
UPDATE public.orders
SET 
  payment_status = CASE
    WHEN status = 'pending' THEN 'PENDING'
    WHEN status IN ('confirmed', 'preparing', 'shipped', 'delivered') THEN 'PAID'
    WHEN status = 'cancelled' THEN 'CANCELED'
    WHEN status IN ('PENDING', 'PAID', 'CANCELED', 'REFUNDED') THEN status -- 이미 변환된 경우
    ELSE 'PENDING'
  END,
  fulfillment_status = CASE
    WHEN status = 'pending' THEN 'UNFULFILLED'
    WHEN status = 'confirmed' THEN 'UNFULFILLED'
    WHEN status = 'preparing' THEN 'PREPARING'
    WHEN status = 'shipped' THEN 'SHIPPED'
    WHEN status = 'delivered' THEN 'DELIVERED'
    WHEN status = 'cancelled' THEN 'CANCELED'
    WHEN status IN ('PENDING', 'PAID', 'CANCELED', 'REFUNDED') THEN 'UNFULFILLED' -- 이미 변환된 경우 기본값
    ELSE 'UNFULFILLED'
  END;

-- 1-4. NOT NULL 제약조건 추가
ALTER TABLE public.orders
ALTER COLUMN payment_status SET NOT NULL,
ALTER COLUMN fulfillment_status SET NOT NULL;

-- 1-5. 기본값 설정
ALTER TABLE public.orders
ALTER COLUMN payment_status SET DEFAULT 'PENDING',
ALTER COLUMN fulfillment_status SET DEFAULT 'UNFULFILLED';

-- 1-6. CHECK 제약조건 추가
ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS chk_orders_status,
DROP CONSTRAINT IF EXISTS chk_orders_payment_status,
DROP CONSTRAINT IF EXISTS chk_orders_fulfillment_status;

ALTER TABLE public.orders
ADD CONSTRAINT chk_orders_payment_status CHECK (
  payment_status IN ('PENDING', 'PAID', 'CANCELED', 'REFUNDED')
);

ALTER TABLE public.orders
ADD CONSTRAINT chk_orders_fulfillment_status CHECK (
  fulfillment_status IN ('UNFULFILLED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELED')
);

-- 1-7. 인덱스 재생성 (기존 status 인덱스 대신)
DROP INDEX IF EXISTS public.idx_orders_status;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON public.orders(fulfillment_status);

-- 1-8. 주석 업데이트
COMMENT ON COLUMN public.orders.payment_status IS '결제 상태 (PENDING: 결제 대기/생성됨, PAID: 결제 성공, CANCELED: 주문 취소, REFUNDED: 환불 완료)';
COMMENT ON COLUMN public.orders.fulfillment_status IS '이행/배송 상태 (UNFULFILLED: 미처리, PREPARING: 상품 준비, SHIPPED: 배송중, DELIVERED: 배송완료, CANCELED: 주문 취소 시 동기화 가능)';

-- ============================================================================
-- 2. 마이그레이션 결과 확인
-- ============================================================================

-- 2-1. 컬럼 정보 확인
SELECT 
  '=== 컬럼 정보 ===' as section,
  column_name, 
  data_type, 
  column_default, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders' 
  AND column_name IN ('payment_status', 'fulfillment_status')
ORDER BY column_name;

-- 2-2. 주문 상태 분포 확인
SELECT 
  '=== 주문 상태 분포 ===' as section,
  payment_status, 
  fulfillment_status, 
  COUNT(*) as count
FROM public.orders 
GROUP BY payment_status, fulfillment_status
ORDER BY payment_status, fulfillment_status;

-- 2-3. 기존 status와 새 컬럼 비교 (샘플 10개)
SELECT 
  '=== 기존 status vs 새 컬럼 비교 (샘플) ===' as section,
  id,
  order_number,
  status as old_status,
  payment_status,
  fulfillment_status
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;

