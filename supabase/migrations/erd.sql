-- ============================================================================
-- 또또앙스 쇼핑몰 데이터베이스 스크립트 (PostgreSQL/Supabase)
-- 생성일: 2024
-- 버전: 1.0.0 (Complete with Soft Delete)
-- 
-- 포함 기능:
-- - UUID 자동 생성 (gen_random_uuid())
-- - CASCADE/RESTRICT/SET NULL 제약조건
-- - CHECK 제약조건 (ENUM 대신)
-- - UNIQUE 제약조건 (부분 인덱스 포함)
-- - 성능 최적화 인덱스
-- - Soft Delete (deleted_at)
-- - JSONB 타입
-- - 복합 UNIQUE 제약
-- - updated_at 자동 업데이트 트리거
-- ============================================================================

-- ============================================================================
-- 1. 기존 테이블 및 함수 삭제 (개발용)
-- ============================================================================

-- 테이블 삭제 (의존성 순서 역순)
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS carts CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 함수 삭제
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================================================
-- 2. updated_at 자동 업데이트 함수 생성
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_updated_at_column() IS '레코드 수정 시 updated_at을 자동으로 현재 시간으로 업데이트';

-- ============================================================================
-- 3. 테이블 생성
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 users (사용자)
-- ----------------------------------------------------------------------------

CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clerk_user_id VARCHAR(255) NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    phone VARCHAR(20),
    role VARCHAR(20) NOT NULL DEFAULT 'customer',
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_users_role CHECK (role IN ('customer', 'admin'))
);

-- 트리거 생성
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE users IS '회원 정보';
COMMENT ON COLUMN users.id IS '회원 고유 ID (UUID)';
COMMENT ON COLUMN users.clerk_user_id IS 'Clerk 인증 서비스 사용자 ID';
COMMENT ON COLUMN users.email IS '이메일 주소';
COMMENT ON COLUMN users.name IS '회원 이름';
COMMENT ON COLUMN users.phone IS '연락처 (예: 010-1234-5678)';
COMMENT ON COLUMN users.role IS '권한 (customer: 고객, admin: 관리자)';
COMMENT ON COLUMN users.deleted_at IS '탈퇴일시 (NULL이면 활성 회원)';
COMMENT ON COLUMN users.created_at IS '가입일시';
COMMENT ON COLUMN users.updated_at IS '최종 수정일시';

-- ----------------------------------------------------------------------------
-- 3.2 categories (카테고리)
-- ----------------------------------------------------------------------------

CREATE TABLE categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거 생성
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE categories IS '상품 카테고리';
COMMENT ON COLUMN categories.id IS '카테고리 고유 ID';
COMMENT ON COLUMN categories.name IS '카테고리명 (예: 키티 키링)';
COMMENT ON COLUMN categories.slug IS 'URL 슬러그 (예: kitty-keyring)';
COMMENT ON COLUMN categories.description IS '카테고리 설명';
COMMENT ON COLUMN categories.image_url IS '카테고리 대표 이미지 URL';
COMMENT ON COLUMN categories.sort_order IS '정렬 순서 (작을수록 먼저 표시)';
COMMENT ON COLUMN categories.is_active IS '활성화 여부';
COMMENT ON COLUMN categories.deleted_at IS '삭제일시 (NULL이면 활성)';
COMMENT ON COLUMN categories.created_at IS '생성일시';
COMMENT ON COLUMN categories.updated_at IS '최종 수정일시';

-- ----------------------------------------------------------------------------
-- 3.3 products (상품)
-- ----------------------------------------------------------------------------

CREATE TABLE products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    discount_price DECIMAL(10,2),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    stock INT NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_new BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_products_status CHECK (status IN ('active', 'hidden', 'sold_out')),
    CONSTRAINT chk_products_price_positive CHECK (price >= 0),
    CONSTRAINT chk_products_discount_price_valid CHECK (
        discount_price IS NULL OR (discount_price >= 0 AND discount_price <= price)
    ),
    CONSTRAINT chk_products_stock_non_negative CHECK (stock >= 0)
);

-- 트리거 생성
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE products IS '상품 정보';
COMMENT ON COLUMN products.id IS '상품 고유 ID';
COMMENT ON COLUMN products.category_id IS '카테고리 ID (FK)';
COMMENT ON COLUMN products.name IS '상품명';
COMMENT ON COLUMN products.slug IS 'URL 슬러그 (예: hello-kitty-keyring)';
COMMENT ON COLUMN products.price IS '정가';
COMMENT ON COLUMN products.discount_price IS '할인가 (NULL이면 할인 없음)';
COMMENT ON COLUMN products.description IS '상품 설명';
COMMENT ON COLUMN products.status IS '상태 (active: 판매중, hidden: 숨김, sold_out: 품절)';
COMMENT ON COLUMN products.stock IS '재고 수량';
COMMENT ON COLUMN products.is_featured IS '베스트 상품 여부';
COMMENT ON COLUMN products.is_new IS '신상품 여부';
COMMENT ON COLUMN products.deleted_at IS '삭제일시 (NULL이면 활성)';
COMMENT ON COLUMN products.created_at IS '등록일시';
COMMENT ON COLUMN products.updated_at IS '최종 수정일시';

-- ----------------------------------------------------------------------------
-- 3.4 product_images (상품 이미지)
-- ----------------------------------------------------------------------------

CREATE TABLE product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    alt_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 주석
COMMENT ON TABLE product_images IS '상품 이미지';
COMMENT ON COLUMN product_images.id IS '이미지 고유 ID';
COMMENT ON COLUMN product_images.product_id IS '상품 ID (FK)';
COMMENT ON COLUMN product_images.image_url IS '이미지 URL';
COMMENT ON COLUMN product_images.is_primary IS '대표 이미지 여부';
COMMENT ON COLUMN product_images.sort_order IS '정렬 순서';
COMMENT ON COLUMN product_images.alt_text IS '이미지 대체 텍스트 (접근성)';
COMMENT ON COLUMN product_images.created_at IS '등록일시';

-- ----------------------------------------------------------------------------
-- 3.5 product_variants (상품 옵션)
-- ----------------------------------------------------------------------------

CREATE TABLE product_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL,
    variant_name TEXT NOT NULL,
    variant_value TEXT NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    sku TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_product_variants_stock_non_negative CHECK (stock >= 0)
);

-- 트리거 생성
CREATE TRIGGER trg_product_variants_updated_at
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE product_variants IS '상품 옵션 (색상, 사이즈 등)';
COMMENT ON COLUMN product_variants.id IS '옵션 고유 ID';
COMMENT ON COLUMN product_variants.product_id IS '상품 ID (FK)';
COMMENT ON COLUMN product_variants.variant_name IS '옵션명 (예: 색상)';
COMMENT ON COLUMN product_variants.variant_value IS '옵션값 (예: 핑크)';
COMMENT ON COLUMN product_variants.stock IS '옵션별 재고 수량';
COMMENT ON COLUMN product_variants.price_adjustment IS '가격 조정 (+1000원, -500원 등)';
COMMENT ON COLUMN product_variants.sku IS '재고관리코드 (SKU)';
COMMENT ON COLUMN product_variants.deleted_at IS '삭제일시 (NULL이면 활성)';
COMMENT ON COLUMN product_variants.created_at IS '등록일시';
COMMENT ON COLUMN product_variants.updated_at IS '최종 수정일시';

-- ----------------------------------------------------------------------------
-- 3.6 carts (장바구니)
-- ----------------------------------------------------------------------------

CREATE TABLE carts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거 생성
CREATE TRIGGER trg_carts_updated_at
    BEFORE UPDATE ON carts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE carts IS '장바구니';
COMMENT ON COLUMN carts.id IS '장바구니 고유 ID';
COMMENT ON COLUMN carts.user_id IS '회원 ID (FK)';
COMMENT ON COLUMN carts.created_at IS '생성일시';
COMMENT ON COLUMN carts.updated_at IS '최종 수정일시';

-- ----------------------------------------------------------------------------
-- 3.7 cart_items (장바구니 아이템)
-- ----------------------------------------------------------------------------

CREATE TABLE cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cart_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_cart_items_quantity_positive CHECK (quantity > 0)
);

-- 트리거 생성
CREATE TRIGGER trg_cart_items_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE cart_items IS '장바구니 아이템';
COMMENT ON COLUMN cart_items.id IS '아이템 고유 ID';
COMMENT ON COLUMN cart_items.cart_id IS '장바구니 ID (FK)';
COMMENT ON COLUMN cart_items.product_id IS '상품 ID (FK)';
COMMENT ON COLUMN cart_items.variant_id IS '옵션 ID (FK, NULL 가능)';
COMMENT ON COLUMN cart_items.quantity IS '수량';
COMMENT ON COLUMN cart_items.price IS '담을 당시 가격 (가격 변동 추적용)';
COMMENT ON COLUMN cart_items.created_at IS '담은 날짜';
COMMENT ON COLUMN cart_items.updated_at IS '최종 수정일시';

-- ----------------------------------------------------------------------------
-- 3.8 orders (주문)
-- ----------------------------------------------------------------------------

CREATE TABLE orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    order_number TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    shipping_name TEXT NOT NULL,
    shipping_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_zip_code TEXT,
    shipping_memo TEXT,
    shipping_status VARCHAR(20),
    tracking_number TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_orders_status CHECK (
        status IN ('pending', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled')
    ),
    CONSTRAINT chk_orders_shipping_status CHECK (
        shipping_status IS NULL OR 
        shipping_status IN ('pending', 'processing', 'shipped', 'in_transit', 'delivered')
    ),
    CONSTRAINT chk_orders_total_amount_positive CHECK (total_amount > 0)
);

-- 트리거 생성
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE orders IS '주문 정보';
COMMENT ON COLUMN orders.id IS '주문 고유 ID';
COMMENT ON COLUMN orders.user_id IS '회원 ID (FK)';
COMMENT ON COLUMN orders.order_number IS '주문번호 (예: ORD-2024-001)';
COMMENT ON COLUMN orders.status IS '주문 상태 (pending: 대기, confirmed: 확정, preparing: 준비중, shipped: 배송중, delivered: 배송완료, cancelled: 취소)';
COMMENT ON COLUMN orders.total_amount IS '총 주문 금액';
COMMENT ON COLUMN orders.shipping_name IS '수령인 이름';
COMMENT ON COLUMN orders.shipping_phone IS '수령인 연락처';
COMMENT ON COLUMN orders.shipping_address IS '배송지 주소';
COMMENT ON COLUMN orders.shipping_zip_code IS '우편번호';
COMMENT ON COLUMN orders.shipping_memo IS '배송 메모';
COMMENT ON COLUMN orders.shipping_status IS '배송 상태';
COMMENT ON COLUMN orders.tracking_number IS '운송장 번호';
COMMENT ON COLUMN orders.shipped_at IS '배송 시작일시';
COMMENT ON COLUMN orders.delivered_at IS '배송 완료일시';
COMMENT ON COLUMN orders.created_at IS '주문일시';
COMMENT ON COLUMN orders.updated_at IS '최종 수정일시';

-- ----------------------------------------------------------------------------
-- 3.9 order_items (주문 상품)
-- ----------------------------------------------------------------------------

CREATE TABLE order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    product_id UUID NOT NULL,
    variant_id UUID,
    product_name TEXT NOT NULL,
    variant_info TEXT,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0)
);

-- 주석
COMMENT ON TABLE order_items IS '주문 상품 (주문 당시 스냅샷)';
COMMENT ON COLUMN order_items.id IS '주문상품 고유 ID';
COMMENT ON COLUMN order_items.order_id IS '주문 ID (FK)';
COMMENT ON COLUMN order_items.product_id IS '상품 ID (FK)';
COMMENT ON COLUMN order_items.variant_id IS '옵션 ID (FK, NULL 가능)';
COMMENT ON COLUMN order_items.product_name IS '주문 당시 상품명 (스냅샷)';
COMMENT ON COLUMN order_items.variant_info IS '주문 당시 옵션 정보 (스냅샷)';
COMMENT ON COLUMN order_items.quantity IS '주문 수량';
COMMENT ON COLUMN order_items.price IS '주문 당시 단가 (스냅샷)';
COMMENT ON COLUMN order_items.created_at IS '생성일시';

-- ----------------------------------------------------------------------------
-- 3.10 payments (결제)
-- ----------------------------------------------------------------------------

CREATE TABLE payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    payment_key TEXT,
    toss_payment_id TEXT,
    method VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    amount DECIMAL(10,2) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    failure_code TEXT,
    failure_message TEXT,
    cancel_reason TEXT,
    receipt_url TEXT,
    card_company TEXT,
    card_number TEXT,
    installment_plan_months INT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_payments_method CHECK (
        method IN ('card', 'virtual_account', 'transfer', 'mobile', 'etc')
    ),
    CONSTRAINT chk_payments_status CHECK (
        status IN ('pending', 'ready', 'in_progress', 'done', 'cancelled', 'failed', 'expired')
    ),
    CONSTRAINT chk_payments_amount_positive CHECK (amount > 0)
);

-- 트리거 생성
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE payments IS '결제 정보 (TossPayments 연동)';
COMMENT ON COLUMN payments.id IS '결제 고유 ID';
COMMENT ON COLUMN payments.order_id IS '주문 ID (FK)';
COMMENT ON COLUMN payments.payment_key IS 'TossPayments 결제 키';
COMMENT ON COLUMN payments.toss_payment_id IS 'TossPayments 결제 ID';
COMMENT ON COLUMN payments.method IS '결제 수단 (card: 카드, virtual_account: 가상계좌, transfer: 계좌이체, mobile: 휴대폰, etc: 기타)';
COMMENT ON COLUMN payments.status IS '결제 상태 (pending: 대기, ready: 준비, in_progress: 진행중, done: 완료, cancelled: 취소, failed: 실패, expired: 만료)';
COMMENT ON COLUMN payments.amount IS '결제 금액';
COMMENT ON COLUMN payments.requested_at IS '결제 요청일시';
COMMENT ON COLUMN payments.approved_at IS '결제 승인일시';
COMMENT ON COLUMN payments.failed_at IS '결제 실패일시';
COMMENT ON COLUMN payments.cancelled_at IS '결제 취소일시';
COMMENT ON COLUMN payments.failure_code IS '실패 코드';
COMMENT ON COLUMN payments.failure_message IS '실패 메시지';
COMMENT ON COLUMN payments.cancel_reason IS '취소 사유';
COMMENT ON COLUMN payments.receipt_url IS '영수증 URL';
COMMENT ON COLUMN payments.card_company IS '카드사';
COMMENT ON COLUMN payments.card_number IS '카드번호 (마스킹)';
COMMENT ON COLUMN payments.installment_plan_months IS '할부 개월 (0: 일시불)';
COMMENT ON COLUMN payments.metadata IS '추가 정보 (JSONB)';
COMMENT ON COLUMN payments.created_at IS '생성일시';
COMMENT ON COLUMN payments.updated_at IS '최종 수정일시';

-- ----------------------------------------------------------------------------
-- 3.11 refunds (환불)
-- ----------------------------------------------------------------------------

CREATE TABLE refunds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_id UUID NOT NULL,
    order_id UUID NOT NULL,
    refund_amount DECIMAL(10,2) NOT NULL,
    refund_reason TEXT NOT NULL,
    refund_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    toss_refund_id TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    refund_account_bank TEXT,
    refund_account_number TEXT,
    refund_account_holder TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_refunds_status CHECK (
        refund_status IN ('pending', 'approved', 'rejected', 'completed', 'failed')
    ),
    CONSTRAINT chk_refunds_amount_positive CHECK (refund_amount > 0)
);

-- 트리거 생성
CREATE TRIGGER trg_refunds_updated_at
    BEFORE UPDATE ON refunds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 주석
COMMENT ON TABLE refunds IS '환불 정보';
COMMENT ON COLUMN refunds.id IS '환불 고유 ID';
COMMENT ON COLUMN refunds.payment_id IS '결제 ID (FK)';
COMMENT ON COLUMN refunds.order_id IS '주문 ID (FK)';
COMMENT ON COLUMN refunds.refund_amount IS '환불 금액';
COMMENT ON COLUMN refunds.refund_reason IS '환불 사유';
COMMENT ON COLUMN refunds.refund_status IS '환불 상태 (pending: 대기, approved: 승인, rejected: 거부, completed: 완료, failed: 실패)';
COMMENT ON COLUMN refunds.toss_refund_id IS 'TossPayments 환불 ID';
COMMENT ON COLUMN refunds.requested_at IS '환불 요청일시';
COMMENT ON COLUMN refunds.approved_at IS '환불 승인일시';
COMMENT ON COLUMN refunds.rejected_at IS '환불 거부일시';
COMMENT ON COLUMN refunds.completed_at IS '환불 완료일시';
COMMENT ON COLUMN refunds.rejection_reason IS '거부 사유';
COMMENT ON COLUMN refunds.refund_account_bank IS '환불 은행 (계좌이체 시)';
COMMENT ON COLUMN refunds.refund_account_number IS '환불 계좌번호';
COMMENT ON COLUMN refunds.refund_account_holder IS '환불 예금주';
COMMENT ON COLUMN refunds.metadata IS '추가 정보 (JSONB)';
COMMENT ON COLUMN refunds.created_at IS '생성일시';
COMMENT ON COLUMN refunds.updated_at IS '최종 수정일시';

-- ============================================================================
-- 4. 외래키 제약조건 (Foreign Keys)
-- ============================================================================

-- products → categories
ALTER TABLE products
    ADD CONSTRAINT fk_products_category_id
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE RESTRICT;

-- product_images → products
ALTER TABLE product_images
    ADD CONSTRAINT fk_product_images_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE;

-- product_variants → products
ALTER TABLE product_variants
    ADD CONSTRAINT fk_product_variants_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE;

-- carts → users
ALTER TABLE carts
    ADD CONSTRAINT fk_carts_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT;

-- cart_items → carts
ALTER TABLE cart_items
    ADD CONSTRAINT fk_cart_items_cart_id
    FOREIGN KEY (cart_id) REFERENCES carts(id)
    ON DELETE CASCADE;

-- cart_items → products
ALTER TABLE cart_items
    ADD CONSTRAINT fk_cart_items_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT;

-- cart_items → product_variants
ALTER TABLE cart_items
    ADD CONSTRAINT fk_cart_items_variant_id
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
    ON DELETE SET NULL;

-- orders → users
ALTER TABLE orders
    ADD CONSTRAINT fk_orders_user_id
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE RESTRICT;

-- order_items → orders
ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE;

-- order_items → products
ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT;

-- order_items → product_variants
ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_variant_id
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
    ON DELETE SET NULL;

-- payments → orders
ALTER TABLE payments
    ADD CONSTRAINT fk_payments_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE;

-- refunds → payments
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_payment_id
    FOREIGN KEY (payment_id) REFERENCES payments(id)
    ON DELETE CASCADE;

-- refunds → orders
ALTER TABLE refunds
    ADD CONSTRAINT fk_refunds_order_id
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE RESTRICT;

-- ============================================================================
-- 5. UNIQUE 제약조건 (부분 인덱스 포함)
-- ============================================================================

-- users: clerk_user_id (삭제되지 않은 회원만)
CREATE UNIQUE INDEX uq_users_clerk_user_id_active
    ON users(clerk_user_id)
    WHERE deleted_at IS NULL;

-- users: email (삭제되지 않은 회원만)
CREATE UNIQUE INDEX uq_users_email_active
    ON users(email)
    WHERE deleted_at IS NULL;

-- categories: slug (삭제되지 않은 카테고리만)
CREATE UNIQUE INDEX uq_categories_slug_active
    ON categories(slug)
    WHERE deleted_at IS NULL;

-- products: slug (삭제되지 않은 상품만)
CREATE UNIQUE INDEX uq_products_slug_active
    ON products(slug)
    WHERE deleted_at IS NULL;

-- orders: order_number
CREATE UNIQUE INDEX uq_orders_order_number
    ON orders(order_number);

-- payments: payment_key (NULL이 아닌 경우만)
CREATE UNIQUE INDEX uq_payments_payment_key
    ON payments(payment_key)
    WHERE payment_key IS NOT NULL;

-- ============================================================================
-- 6. 복합 UNIQUE 제약조건
-- ============================================================================

-- cart_items: 같은 장바구니에 같은 상품+옵션 조합 중복 방지
CREATE UNIQUE INDEX uq_cart_items_cart_product_variant
    ON cart_items(cart_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

COMMENT ON INDEX uq_cart_items_cart_product_variant IS '장바구니 중복 방지: 같은 장바구니에 같은 상품+옵션 조합 중복 불가';

-- ============================================================================
-- 7. 성능 최적화 인덱스
-- ============================================================================

-- users
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_clerk_user_id ON users(clerk_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;

-- categories
CREATE INDEX idx_categories_slug ON categories(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_categories_is_active ON categories(is_active) WHERE deleted_at IS NULL;

-- products
CREATE INDEX idx_products_category_id ON products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_slug ON products(slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_status ON products(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_products_is_featured ON products(is_featured) WHERE is_featured = true AND deleted_at IS NULL;
CREATE INDEX idx_products_is_new ON products(is_new) WHERE is_new = true AND deleted_at IS NULL;
CREATE INDEX idx_products_created_at ON products(created_at DESC) WHERE deleted_at IS NULL;

-- product_images
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_is_primary ON product_images(product_id, is_primary) WHERE is_primary = true;

-- product_variants
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_product_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;

-- carts
CREATE INDEX idx_carts_user_id ON carts(user_id);

-- cart_items
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id) WHERE variant_id IS NOT NULL;

-- orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_shipping_status ON orders(shipping_status) WHERE shipping_status IS NOT NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- order_items
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id) WHERE variant_id IS NOT NULL;

-- payments
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_payment_key ON payments(payment_key) WHERE payment_key IS NOT NULL;
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_method ON payments(method);
CREATE INDEX idx_payments_requested_at ON payments(requested_at DESC);

-- refunds
CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX idx_refunds_order_id ON refunds(order_id);
CREATE INDEX idx_refunds_refund_status ON refunds(refund_status);
CREATE INDEX idx_refunds_requested_at ON refunds(requested_at DESC);

-- ============================================================================
-- 8. 완료 메시지
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '또또앙스 쇼핑몰 데이터베이스 생성 완료!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '생성된 테이블:';
    RAISE NOTICE '  1. users (회원)';
    RAISE NOTICE '  2. categories (카테고리)';
    RAISE NOTICE '  3. products (상품)';
    RAISE NOTICE '  4. product_images (상품 이미지)';
    RAISE NOTICE '  5. product_variants (상품 옵션)';
    RAISE NOTICE '  6. carts (장바구니)';
    RAISE NOTICE '  7. cart_items (장바구니 아이템)';
    RAISE NOTICE '  8. orders (주문)';
    RAISE NOTICE '  9. order_items (주문 상품)';
    RAISE NOTICE ' 10. payments (결제)';
    RAISE NOTICE ' 11. refunds (환불)';
    RAISE NOTICE '';
    RAISE NOTICE '적용된 기능:';
    RAISE NOTICE '  ✅ UUID 자동 생성 (gen_random_uuid())';
    RAISE NOTICE '  ✅ CASCADE/RESTRICT/SET NULL 제약조건';
    RAISE NOTICE '  ✅ CHECK 제약조건 (값 검증)';
    RAISE NOTICE '  ✅ UNIQUE 제약조건 (부분 인덱스)';
    RAISE NOTICE '  ✅ 성능 최적화 인덱스';
    RAISE NOTICE '  ✅ Soft Delete (deleted_at)';
    RAISE NOTICE '  ✅ JSONB 타입';
    RAISE NOTICE '  ✅ 복합 UNIQUE 제약';
    RAISE NOTICE '  ✅ updated_at 자동 업데이트 트리거';
    RAISE NOTICE '';
    RAISE NOTICE '다음 단계:';
    RAISE NOTICE '  1. Supabase Dashboard에서 SQL Editor 열기';
    RAISE NOTICE '  2. 이 스크립트 전체 복사 & 실행';
    RAISE NOTICE '  3. Next.js 프로젝트에서 Supabase 클라이언트 연동';
    RAISE NOTICE '  4. 쿼리 시 deleted_at IS NULL 조건 추가 필수!';
    RAISE NOTICE '============================================================================';
END $$;