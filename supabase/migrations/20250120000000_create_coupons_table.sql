-- ============================================================================
-- 쿠폰 테이블 생성
-- ============================================================================

-- 쿠폰 테이블
CREATE TABLE coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed', -- 'fixed': 고정금액, 'percentage': 퍼센트
    discount_amount DECIMAL(10,2) NOT NULL,
    min_order_amount DECIMAL(10,2) DEFAULT 0, -- 최소 주문 금액
    max_discount_amount DECIMAL(10,2), -- 최대 할인 금액 (퍼센트 쿠폰용)
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active': 사용가능, 'used': 사용됨, 'expired': 만료됨
    used_at TIMESTAMPTZ, -- 사용일시
    expires_at TIMESTAMPTZ NOT NULL, -- 만료일시
    order_id UUID, -- 사용된 주문 ID
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- 외래키
    CONSTRAINT fk_coupons_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_coupons_order_id FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    
    -- CHECK 제약조건
    CONSTRAINT chk_coupons_discount_type CHECK (discount_type IN ('fixed', 'percentage')),
    CONSTRAINT chk_coupons_status CHECK (status IN ('active', 'used', 'expired')),
    CONSTRAINT chk_coupons_discount_amount_positive CHECK (discount_amount > 0),
    CONSTRAINT chk_coupons_min_order_amount_non_negative CHECK (min_order_amount >= 0)
);

-- 트리거 생성
CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 생성
CREATE INDEX idx_coupons_user_id ON coupons(user_id);
CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_status ON coupons(status);
CREATE INDEX idx_coupons_expires_at ON coupons(expires_at);

-- 주석
COMMENT ON TABLE coupons IS '쿠폰 정보';
COMMENT ON COLUMN coupons.id IS '쿠폰 고유 ID';
COMMENT ON COLUMN coupons.user_id IS '회원 ID (FK)';
COMMENT ON COLUMN coupons.code IS '쿠폰 코드 (고유)';
COMMENT ON COLUMN coupons.name IS '쿠폰 이름';
COMMENT ON COLUMN coupons.discount_type IS '할인 타입 (fixed: 고정금액, percentage: 퍼센트)';
COMMENT ON COLUMN coupons.discount_amount IS '할인 금액 또는 할인율';
COMMENT ON COLUMN coupons.min_order_amount IS '최소 주문 금액';
COMMENT ON COLUMN coupons.max_discount_amount IS '최대 할인 금액 (퍼센트 쿠폰용)';
COMMENT ON COLUMN coupons.status IS '쿠폰 상태 (active: 사용가능, used: 사용됨, expired: 만료됨)';
COMMENT ON COLUMN coupons.used_at IS '사용일시';
COMMENT ON COLUMN coupons.expires_at IS '만료일시';
COMMENT ON COLUMN coupons.order_id IS '사용된 주문 ID';

-- orders 테이블에 coupon_id 컬럼 추가 (쿠폰 사용 추적용)
ALTER TABLE orders ADD COLUMN coupon_id UUID;
ALTER TABLE orders ADD CONSTRAINT fk_orders_coupon_id FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL;
COMMENT ON COLUMN orders.coupon_id IS '사용된 쿠폰 ID';

