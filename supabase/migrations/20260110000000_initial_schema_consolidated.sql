-- ============================================================================
-- 초기 스키마 통합 마이그레이션
-- ============================================================================
-- 
-- 이 파일은 새 환경에서 사용하기 위한 통합 마이그레이션입니다.
-- 기존 프로젝트에는 영향이 없습니다 (타임스탬프가 미래이므로 실행되지 않음).
-- 
-- 포함 내용:
-- - updated_at 자동 업데이트 함수
-- - users 테이블 (Clerk 연동)
-- - categories 테이블
-- - products 테이블 (TEXT ID 사용)
-- - product_images 테이블
-- - product_variants 테이블
-- - carts 및 cart_items 테이블
-- - orders 및 order_items 테이블
-- - payments 및 refunds 테이블
-- 
-- 개발 환경 원칙:
-- - RLS 비활성화 (프로덕션 전환 시 정책 검토 필요)
-- ============================================================================

-- ============================================================================
-- 1. updated_at 자동 업데이트 함수 생성
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
-- 2. users 테이블 생성 (Clerk 연동)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clerk_user_id TEXT NOT NULL,
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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at'
    ) THEN
        CREATE TRIGGER trg_users_updated_at
            BEFORE UPDATE ON public.users
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 인덱스 및 UNIQUE 제약조건
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_clerk_user_id_active
    ON public.users(clerk_user_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_active
    ON public.users(email)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON public.users(clerk_user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role) WHERE deleted_at IS NULL;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- 권한 부여
GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- 주석
COMMENT ON TABLE public.users IS '회원 정보 (Clerk 연동)';
COMMENT ON COLUMN public.users.id IS '회원 고유 ID (UUID)';
COMMENT ON COLUMN public.users.clerk_user_id IS 'Clerk 인증 서비스 사용자 ID';
COMMENT ON COLUMN public.users.email IS '이메일 주소';
COMMENT ON COLUMN public.users.name IS '회원 이름';
COMMENT ON COLUMN public.users.phone IS '연락처';
COMMENT ON COLUMN public.users.role IS '권한 (customer: 고객, admin: 관리자)';
COMMENT ON COLUMN public.users.deleted_at IS '탈퇴일시 (NULL이면 활성 회원)';

-- ============================================================================
-- 3. categories 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.categories (
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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_categories_updated_at'
    ) THEN
        CREATE TRIGGER trg_categories_updated_at
            BEFORE UPDATE ON public.categories
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 인덱스 및 UNIQUE 제약조건
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_slug_active
    ON public.categories(slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON public.categories(is_active) WHERE deleted_at IS NULL;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.categories IS '상품 카테고리';
COMMENT ON COLUMN public.categories.name IS '카테고리명';
COMMENT ON COLUMN public.categories.slug IS 'URL 슬러그';
COMMENT ON COLUMN public.categories.description IS '카테고리 설명';
COMMENT ON COLUMN public.categories.sort_order IS '정렬 순서 (작을수록 먼저 표시)';
COMMENT ON COLUMN public.categories.is_active IS '활성화 여부';
COMMENT ON COLUMN public.categories.deleted_at IS '삭제일시 (NULL이면 활성)';

-- ============================================================================
-- 4. products 테이블 생성 (TEXT ID 사용)
-- ============================================================================

-- SEQUENCE 생성 (상품 ID 자동 생성용)
CREATE SEQUENCE IF NOT EXISTS product_id_seq START WITH 1;

-- product_id 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_product_id()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  new_id TEXT;
BEGIN
  -- id가 이미 지정되어 있고 ttotto_pr_ 형식이면 그대로 사용
  IF NEW.id IS NOT NULL AND NEW.id != '' AND NEW.id LIKE 'ttotto_pr_%' THEN
    RETURN NEW;
  END IF;

  -- UUID 형식이거나 구버전 ttotto_ 형식이면 무시하고 새로 생성
  IF NEW.id IS NOT NULL AND NEW.id != '' THEN
    IF NEW.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      -- UUID 형식이면 무시하고 새로 생성
    ELSIF NEW.id LIKE 'ttotto_%' AND NEW.id NOT LIKE 'ttotto_pr_%' THEN
      -- 구버전 ttotto_ 형식이면 무시하고 새로 생성
    ELSE
      -- 다른 형식이면 그대로 사용
      RETURN NEW;
    END IF;
  END IF;

  -- SEQUENCE에서 다음 번호 가져오기 (동시성 안전, 원자적 연산)
  next_num := nextval('product_id_seq');

  -- 새 ID 생성 (ttotto_pr_001, ttotto_pr_002 형식)
  new_id := 'ttotto_pr_' || LPAD(next_num::TEXT, 3, '0');
  
  NEW.id := new_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_product_id() IS '상품 ID를 ttotto_pr_001, ttotto_pr_002 형식으로 자동 생성 (SEQUENCE 사용, 동시성 안전)';

-- products 테이블 생성
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    category_id UUID,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    discount_price DECIMAL(10,2),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    stock INT NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_new BOOLEAN NOT NULL DEFAULT false,
    smartstore_product_id TEXT,
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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_updated_at'
    ) THEN
        CREATE TRIGGER trg_products_updated_at
            BEFORE UPDATE ON public.products
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_generate_id'
    ) THEN
        CREATE TRIGGER trg_products_generate_id
            BEFORE INSERT ON public.products
            FOR EACH ROW
            EXECUTE FUNCTION generate_product_id();
    END IF;
END $$;

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_products_category_id'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT fk_products_category_id
            FOREIGN KEY (category_id) REFERENCES public.categories(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- 인덱스 및 UNIQUE 제약조건
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_slug_active
    ON public.products(slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured) WHERE is_featured = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_new ON public.products(is_new) WHERE is_new = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_smartstore_product_id 
    ON public.products(smartstore_product_id) 
    WHERE smartstore_product_id IS NOT NULL AND deleted_at IS NULL;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.products IS '상품 정보';
COMMENT ON COLUMN public.products.id IS '상품 고유 ID (ttotto_pr_001, ttotto_pr_002 형식)';
COMMENT ON COLUMN public.products.category_id IS '카테고리 ID (FK, NULL 가능)';
COMMENT ON COLUMN public.products.name IS '상품명';
COMMENT ON COLUMN public.products.slug IS 'URL 슬러그';
COMMENT ON COLUMN public.products.price IS '정가';
COMMENT ON COLUMN public.products.discount_price IS '할인가 (NULL이면 할인 없음)';
COMMENT ON COLUMN public.products.status IS '상태 (active: 판매중, hidden: 숨김, sold_out: 품절)';
COMMENT ON COLUMN public.products.stock IS '재고 수량';
COMMENT ON COLUMN public.products.is_featured IS '베스트 상품 여부';
COMMENT ON COLUMN public.products.is_new IS '신상품 여부';
COMMENT ON COLUMN public.products.smartstore_product_id IS '네이버 스마트스토어 상품 ID (재고 동기화용)';
COMMENT ON COLUMN public.products.deleted_at IS '삭제일시 (NULL이면 활성)';

-- ============================================================================
-- 5. product_images 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    sort_order INT NOT NULL DEFAULT 0,
    alt_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_images_product_id'
    ) THEN
        ALTER TABLE public.product_images
            ADD CONSTRAINT fk_product_images_product_id
            FOREIGN KEY (product_id) REFERENCES public.products(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_is_primary ON public.product_images(product_id, is_primary) WHERE is_primary = true;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.product_images DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.product_images IS '상품 이미지';
COMMENT ON COLUMN public.product_images.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN public.product_images.image_url IS '이미지 URL';
COMMENT ON COLUMN public.product_images.is_primary IS '대표 이미지 여부';
COMMENT ON COLUMN public.product_images.sort_order IS '정렬 순서';
COMMENT ON COLUMN public.product_images.alt_text IS '이미지 대체 텍스트 (접근성)';

-- ============================================================================
-- 6. product_variants 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    variant_value TEXT NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    price_adjustment DECIMAL(10,2) DEFAULT 0,
    sku TEXT,
    smartstore_origin_product_no BIGINT,
    smartstore_option_id BIGINT,
    smartstore_channel_product_no BIGINT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_product_variants_stock_non_negative CHECK (stock >= 0)
);

-- 트리거 생성
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_variants_updated_at'
    ) THEN
        CREATE TRIGGER trg_product_variants_updated_at
            BEFORE UPDATE ON public.product_variants
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_product_variants_product_id'
    ) THEN
        ALTER TABLE public.product_variants
            ADD CONSTRAINT fk_product_variants_product_id
            FOREIGN KEY (product_id) REFERENCES public.products(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON public.product_variants(sku) WHERE sku IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pv_smartstore_origin_option
    ON public.product_variants(smartstore_origin_product_no, smartstore_option_id)
    WHERE smartstore_origin_product_no IS NOT NULL
      AND smartstore_option_id IS NOT NULL
      AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pv_smartstore_channel_product_no
    ON public.product_variants(smartstore_channel_product_no)
    WHERE smartstore_channel_product_no IS NOT NULL
      AND deleted_at IS NULL;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.product_variants DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.product_variants IS '상품 옵션 (색상, 사이즈 등)';
COMMENT ON COLUMN public.product_variants.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN public.product_variants.variant_name IS '옵션명 (예: 색상)';
COMMENT ON COLUMN public.product_variants.variant_value IS '옵션값 (예: 핑크)';
COMMENT ON COLUMN public.product_variants.stock IS '옵션별 재고 수량';
COMMENT ON COLUMN public.product_variants.price_adjustment IS '가격 조정 (+1000원, -500원 등)';
COMMENT ON COLUMN public.product_variants.sku IS '재고관리코드 (SKU)';
COMMENT ON COLUMN public.product_variants.smartstore_origin_product_no IS '네이버 스마트스토어 원상품 번호';
COMMENT ON COLUMN public.product_variants.smartstore_option_id IS '네이버 스마트스토어 옵션 ID';
COMMENT ON COLUMN public.product_variants.smartstore_channel_product_no IS '네이버 스마트스토어 채널상품 번호';

-- ============================================================================
-- 7. carts 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.carts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거 생성
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_carts_updated_at'
    ) THEN
        CREATE TRIGGER trg_carts_updated_at
            BEFORE UPDATE ON public.carts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_carts_user_id'
    ) THEN
        ALTER TABLE public.carts
            ADD CONSTRAINT fk_carts_user_id
            FOREIGN KEY (user_id) REFERENCES public.users(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON public.carts(user_id);

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.carts DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.carts IS '장바구니';
COMMENT ON COLUMN public.carts.user_id IS '회원 ID (FK)';

-- ============================================================================
-- 8. cart_items 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cart_id UUID NOT NULL,
    product_id TEXT NOT NULL,
    variant_id UUID,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_cart_items_quantity_positive CHECK (quantity > 0)
);

-- 트리거 생성
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_cart_items_updated_at'
    ) THEN
        CREATE TRIGGER trg_cart_items_updated_at
            BEFORE UPDATE ON public.cart_items
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cart_items_cart_id'
    ) THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT fk_cart_items_cart_id
            FOREIGN KEY (cart_id) REFERENCES public.carts(id)
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cart_items_product_id'
    ) THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT fk_cart_items_product_id
            FOREIGN KEY (product_id) REFERENCES public.products(id)
            ON DELETE RESTRICT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_cart_items_variant_id'
    ) THEN
        ALTER TABLE public.cart_items
            ADD CONSTRAINT fk_cart_items_variant_id
            FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 복합 UNIQUE 제약조건 (같은 장바구니에 같은 상품+옵션 조합 중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_cart_product_variant
    ON public.cart_items(cart_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product_id ON public.cart_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON public.cart_items(variant_id) WHERE variant_id IS NOT NULL;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.cart_items DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.cart_items IS '장바구니 아이템';
COMMENT ON COLUMN public.cart_items.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN public.cart_items.variant_id IS '옵션 ID (FK, NULL 가능)';
COMMENT ON COLUMN public.cart_items.quantity IS '수량';
COMMENT ON COLUMN public.cart_items.price IS '담을 당시 가격 (가격 변동 추적용)';

-- ============================================================================
-- 9. orders 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    order_number TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    coupon_id UUID,
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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_orders_updated_at'
    ) THEN
        CREATE TRIGGER trg_orders_updated_at
            BEFORE UPDATE ON public.orders
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_user_id'
    ) THEN
        ALTER TABLE public.orders
            ADD CONSTRAINT fk_orders_user_id
            FOREIGN KEY (user_id) REFERENCES public.users(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- UNIQUE 제약조건
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_order_number
    ON public.orders(order_number);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_status ON public.orders(shipping_status) WHERE shipping_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.orders IS '주문 정보';
COMMENT ON COLUMN public.orders.order_number IS '주문번호';
COMMENT ON COLUMN public.orders.status IS '주문 상태';
COMMENT ON COLUMN public.orders.total_amount IS '총 주문 금액';
COMMENT ON COLUMN public.orders.coupon_id IS '사용된 쿠폰 ID';

-- ============================================================================
-- 10. order_items 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    product_id TEXT NOT NULL,
    variant_id UUID,
    product_name TEXT NOT NULL,
    variant_info TEXT,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0)
);

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_order_id'
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT fk_order_items_order_id
            FOREIGN KEY (order_id) REFERENCES public.orders(id)
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_product_id'
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT fk_order_items_product_id
            FOREIGN KEY (product_id) REFERENCES public.products(id)
            ON DELETE RESTRICT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_order_items_variant_id'
    ) THEN
        ALTER TABLE public.order_items
            ADD CONSTRAINT fk_order_items_variant_id
            FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON public.order_items(variant_id) WHERE variant_id IS NOT NULL;

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.order_items IS '주문 상품 (주문 당시 스냅샷)';
COMMENT ON COLUMN public.order_items.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN public.order_items.variant_id IS '옵션 ID (FK, NULL 가능)';
COMMENT ON COLUMN public.order_items.product_name IS '주문 당시 상품명 (스냅샷)';
COMMENT ON COLUMN public.order_items.variant_info IS '주문 당시 옵션 정보 (스냅샷)';
COMMENT ON COLUMN public.order_items.price IS '주문 당시 단가 (스냅샷)';

-- ============================================================================
-- 11. payments 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_payments_updated_at'
    ) THEN
        CREATE TRIGGER trg_payments_updated_at
            BEFORE UPDATE ON public.payments
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_payments_order_id'
    ) THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT fk_payments_order_id
            FOREIGN KEY (order_id) REFERENCES public.orders(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- UNIQUE 제약조건
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_payment_key
    ON public.payments(payment_key)
    WHERE payment_key IS NOT NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_key ON public.payments(payment_key) WHERE payment_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON public.payments(method);
CREATE INDEX IF NOT EXISTS idx_payments_requested_at ON public.payments(requested_at DESC);

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.payments IS '결제 정보 (TossPayments 연동)';
COMMENT ON COLUMN public.payments.payment_key IS 'TossPayments 결제 키';
COMMENT ON COLUMN public.payments.method IS '결제 수단';
COMMENT ON COLUMN public.payments.status IS '결제 상태';
COMMENT ON COLUMN public.payments.amount IS '결제 금액';

-- ============================================================================
-- 12. refunds 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.refunds (
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
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_refunds_updated_at'
    ) THEN
        CREATE TRIGGER trg_refunds_updated_at
            BEFORE UPDATE ON public.refunds
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_refunds_payment_id'
    ) THEN
        ALTER TABLE public.refunds
            ADD CONSTRAINT fk_refunds_payment_id
            FOREIGN KEY (payment_id) REFERENCES public.payments(id)
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_refunds_order_id'
    ) THEN
        ALTER TABLE public.refunds
            ADD CONSTRAINT fk_refunds_order_id
            FOREIGN KEY (order_id) REFERENCES public.orders(id)
            ON DELETE RESTRICT;
    END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON public.refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_refund_status ON public.refunds(refund_status);
CREATE INDEX IF NOT EXISTS idx_refunds_requested_at ON public.refunds(requested_at DESC);

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.refunds DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.refunds IS '환불 정보';
COMMENT ON COLUMN public.refunds.refund_amount IS '환불 금액';
COMMENT ON COLUMN public.refunds.refund_status IS '환불 상태';

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

