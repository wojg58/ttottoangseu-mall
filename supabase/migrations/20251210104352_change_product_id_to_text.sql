-- ============================================================================
-- products 테이블 id를 UUID에서 TEXT로 변경
-- ttotto_pr_01, ttotto_pr_02 형식으로 자동 생성 (SEQUENCE 사용, 동시성 안전)
-- ============================================================================
-- 생성일: 2025-12-10
-- 설명: products 테이블의 id를 UUID에서 TEXT로 변경하고, 
--       ttotto_pr_01, ttotto_pr_02 형식으로 자동 생성하도록 변경
--       SEQUENCE를 사용하여 동시성 문제 해결
-- ============================================================================

-- ============================================================================
-- 1단계: 관련 데이터 삭제
-- ============================================================================

-- 주문 기록 삭제 (사용자 요청에 따라)
DELETE FROM refunds;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM orders;

-- 장바구니 관련 삭제
DELETE FROM cart_items;
DELETE FROM carts;

-- 상품 관련 데이터 삭제
DELETE FROM product_categories;
DELETE FROM product_images;
DELETE FROM product_variants;
DELETE FROM products;

-- ============================================================================
-- 2단계: 외래키 제약조건 제거
-- ============================================================================

-- products 관련 외래키 제거
ALTER TABLE products 
    DROP CONSTRAINT IF EXISTS fk_products_category_id;

ALTER TABLE product_images 
    DROP CONSTRAINT IF EXISTS fk_product_images_product_id;

ALTER TABLE product_variants 
    DROP CONSTRAINT IF EXISTS fk_product_variants_product_id;

ALTER TABLE cart_items 
    DROP CONSTRAINT IF EXISTS fk_cart_items_product_id;

ALTER TABLE order_items 
    DROP CONSTRAINT IF EXISTS fk_order_items_product_id;

ALTER TABLE product_categories 
    DROP CONSTRAINT IF EXISTS fk_product_categories_product_id;

-- ============================================================================
-- 3단계: products 테이블 id 컬럼 타입 변경
-- ============================================================================

-- 기존 PRIMARY KEY 제약조건 제거
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_pkey;

-- id 컬럼을 TEXT로 변경
ALTER TABLE products 
    ALTER COLUMN id TYPE TEXT USING id::TEXT;

-- PRIMARY KEY 재생성
ALTER TABLE products 
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);

-- ============================================================================
-- 4단계: SEQUENCE 생성 (동시성 안전을 위해)
-- ============================================================================

-- 기존 시퀀스가 있으면 삭제
DROP SEQUENCE IF EXISTS product_id_seq;

-- 새로운 시퀀스 생성 (1부터 시작)
CREATE SEQUENCE product_id_seq START WITH 1;

-- ============================================================================
-- 5단계: product_id 자동 생성 함수 생성 (SEQUENCE 사용)
-- ============================================================================

-- 기존 함수가 있다면 삭제
DROP FUNCTION IF EXISTS generate_product_id() CASCADE;

-- product_id 자동 생성 함수 (SEQUENCE 사용, 동시성 안전)
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

  -- 새 ID 생성 (ttotto_pr_001, ttotto_pr_002 형식, 3자리로 충분히 확장 가능)
  -- 316개 상품이므로 최소 3자리 필요
  new_id := 'ttotto_pr_' || LPAD(next_num::TEXT, 3, '0');
  
  NEW.id := new_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 주석 추가
COMMENT ON FUNCTION generate_product_id() IS '상품 ID를 ttotto_pr_001, ttotto_pr_002 형식으로 자동 생성 (SEQUENCE 사용, 동시성 안전)';

-- ============================================================================
-- 6단계: products 테이블에 트리거 생성
-- ============================================================================

-- 기존 트리거가 있다면 삭제
DROP TRIGGER IF EXISTS trg_products_generate_id ON products;

-- INSERT 전에 id 자동 생성하는 트리거
CREATE TRIGGER trg_products_generate_id
BEFORE INSERT ON products
FOR EACH ROW
EXECUTE FUNCTION generate_product_id();

-- ============================================================================
-- 7단계: 관련 테이블의 product_id 타입 변경
-- ============================================================================

-- product_images.product_id
ALTER TABLE product_images 
    ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;

-- product_variants.product_id
ALTER TABLE product_variants 
    ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;

-- cart_items.product_id
ALTER TABLE cart_items 
    ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;

-- order_items.product_id
ALTER TABLE order_items 
    ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;

-- product_categories.product_id
ALTER TABLE product_categories 
    ALTER COLUMN product_id TYPE TEXT USING product_id::TEXT;

-- ============================================================================
-- 8단계: 외래키 제약조건 재생성
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

-- cart_items → products
ALTER TABLE cart_items
    ADD CONSTRAINT fk_cart_items_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT;

-- order_items → products
ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT;

-- product_categories → products
ALTER TABLE product_categories
    ADD CONSTRAINT fk_product_categories_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE;

-- ============================================================================
-- 9단계: 주석 업데이트
-- ============================================================================

COMMENT ON COLUMN products.id IS '상품 고유 ID (ttotto_pr_001, ttotto_pr_002 형식)';
COMMENT ON COLUMN product_images.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN product_variants.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN cart_items.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN order_items.product_id IS '상품 ID (FK, TEXT)';
COMMENT ON COLUMN product_categories.product_id IS '상품 ID (FK, TEXT)';

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================
-- 이제 products 테이블에 INSERT 시 id를 지정하지 않으면
-- 자동으로 ttotto_pr_001, ttotto_pr_002 형식으로 생성됩니다.
-- SEQUENCE를 사용하여 동시성 문제가 해결되었습니다.
-- ============================================================================
