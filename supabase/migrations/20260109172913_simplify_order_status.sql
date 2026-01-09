-- ============================================================================
-- 주문 상태 단순화: PENDING → PAID → CANCELED/REFUNDED
-- ============================================================================
-- 
-- 기존 상태값:
--   - pending: 결제 대기
--   - confirmed: 결제 완료
--   - preparing: 상품 준비중
--   - shipped: 배송중
--   - delivered: 배송 완료
--   - cancelled: 주문 취소
--
-- 새로운 상태값:
--   - PENDING: 결제 대기
--   - PAID: 결제 완료 (결제 성공 시에만)
--   - CANCELED: 주문 취소
--   - REFUNDED: 환불 완료
--
-- 마이그레이션 규칙:
--   - pending → PENDING
--   - confirmed/preparing/shipped/delivered → PAID (이미 결제 완료된 주문)
--   - cancelled → CANCELED
-- ============================================================================

-- 1. 기존 데이터 마이그레이션
UPDATE orders
SET status = CASE
  WHEN status = 'pending' THEN 'PENDING'
  WHEN status IN ('confirmed', 'preparing', 'shipped', 'delivered') THEN 'PAID'
  WHEN status = 'cancelled' THEN 'CANCELED'
  ELSE 'PENDING' -- 예외 케이스는 PENDING으로
END;

-- 2. CHECK 제약조건 삭제 (기존)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;

-- 3. 새로운 CHECK 제약조건 추가
ALTER TABLE orders
ADD CONSTRAINT chk_orders_status CHECK (
  status IN ('PENDING', 'PAID', 'CANCELED', 'REFUNDED')
);

-- 4. 기본값 변경
ALTER TABLE orders
ALTER COLUMN status SET DEFAULT 'PENDING';

-- 5. 주석 업데이트
COMMENT ON COLUMN orders.status IS '주문 상태 (PENDING: 결제 대기, PAID: 결제 완료, CANCELED: 주문 취소, REFUNDED: 환불 완료)';

