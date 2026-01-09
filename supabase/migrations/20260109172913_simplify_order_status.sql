-- ============================================================================
-- 주문 상태 분리: payment_status + fulfillment_status
-- ============================================================================
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

-- 1. payment_status 컬럼 추가
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20);

-- 2. fulfillment_status 컬럼 추가
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS fulfillment_status VARCHAR(20);

-- 3. 기존 status 값을 두 컬럼으로 분리하여 업데이트
UPDATE orders
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

-- 4. NOT NULL 제약조건 추가
ALTER TABLE orders
ALTER COLUMN payment_status SET NOT NULL,
ALTER COLUMN fulfillment_status SET NOT NULL;

-- 5. 기본값 설정
ALTER TABLE orders
ALTER COLUMN payment_status SET DEFAULT 'PENDING',
ALTER COLUMN fulfillment_status SET DEFAULT 'UNFULFILLED';

-- 6. CHECK 제약조건 추가
ALTER TABLE orders
DROP CONSTRAINT IF EXISTS chk_orders_status,
DROP CONSTRAINT IF EXISTS chk_orders_payment_status,
DROP CONSTRAINT IF EXISTS chk_orders_fulfillment_status;

ALTER TABLE orders
ADD CONSTRAINT chk_orders_payment_status CHECK (
  payment_status IN ('PENDING', 'PAID', 'CANCELED', 'REFUNDED')
);

ALTER TABLE orders
ADD CONSTRAINT chk_orders_fulfillment_status CHECK (
  fulfillment_status IN ('UNFULFILLED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELED')
);

-- 7. 인덱스 재생성 (기존 status 인덱스 대신)
DROP INDEX IF EXISTS idx_orders_status;
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_status ON orders(fulfillment_status);

-- 8. 주석 업데이트
COMMENT ON COLUMN orders.payment_status IS '결제 상태 (PENDING: 결제 대기/생성됨, PAID: 결제 성공, CANCELED: 주문 취소, REFUNDED: 환불 완료)';
COMMENT ON COLUMN orders.fulfillment_status IS '이행/배송 상태 (UNFULFILLED: 미처리, PREPARING: 상품 준비, SHIPPED: 배송중, DELIVERED: 배송완료, CANCELED: 주문 취소 시 동기화 가능)';

-- 9. 기존 status 컬럼은 나중에 삭제 (호환성을 위해 일단 유지)
-- ALTER TABLE orders DROP COLUMN IF EXISTS status;

-- 10. 기존 shipping_status 컬럼 관련 참고사항
-- 기존 shipping_status 컬럼은 레거시로 남겨두되, 새로운 구조에서는 fulfillment_status를 사용합니다.
-- shipping_status는 NULL 허용이며 소문자 값('pending', 'processing', 'shipped', 'in_transit', 'delivered')을 사용하지만,
-- fulfillment_status는 NOT NULL이며 대문자 값(UNFULFILLED, PREPARING, SHIPPED, DELIVERED, CANCELED)을 사용합니다.
-- 운영 편의성과 일관성을 위해 fulfillment_status를 우선 사용하세요.
