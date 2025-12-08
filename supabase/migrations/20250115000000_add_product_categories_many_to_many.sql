-- 상품-카테고리 다중 관계 지원 마이그레이션
-- 상품이 여러 카테고리에 속할 수 있도록 product_categories 중간 테이블 생성

-- 1. product_categories 중간 테이블 생성
CREATE TABLE IF NOT EXISTS product_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL,
    category_id UUID NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false, -- 기본 카테고리 여부
    sort_order INT NOT NULL DEFAULT 0, -- 정렬 순서
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- UNIQUE 제약조건: 같은 상품-카테고리 조합은 중복 불가
    CONSTRAINT uq_product_categories_product_category UNIQUE (product_id, category_id)
);

-- 2. 외래키 제약조건
ALTER TABLE product_categories
    ADD CONSTRAINT fk_product_categories_product_id
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE;

ALTER TABLE product_categories
    ADD CONSTRAINT fk_product_categories_category_id
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE CASCADE;

-- 3. 인덱스 생성
CREATE INDEX idx_product_categories_product_id ON product_categories(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX idx_product_categories_category_id ON product_categories(category_id) WHERE category_id IS NOT NULL;

-- 4. 기존 products.category_id 데이터를 product_categories로 마이그레이션
-- 기존에 category_id가 있는 모든 상품에 대해 product_categories 레코드 생성
INSERT INTO product_categories (product_id, category_id, is_primary, sort_order)
SELECT 
    id as product_id,
    category_id,
    true as is_primary, -- 기존 category_id를 기본 카테고리로 설정
    0 as sort_order
FROM products
WHERE category_id IS NOT NULL
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_categories 
    WHERE product_categories.product_id = products.id 
      AND product_categories.category_id = products.category_id
  );

-- 5. products.category_id를 nullable로 변경 (하위 호환성 유지)
-- 기존 코드가 category_id를 사용할 수 있도록 유지하되, 다중 카테고리도 지원
-- 주의: 기존 외래키 제약조건은 유지하되, NULL 허용으로 변경
ALTER TABLE products
    ALTER COLUMN category_id DROP NOT NULL;

-- 6. 주석 추가
COMMENT ON TABLE product_categories IS '상품-카테고리 다중 관계 (Many-to-Many)';
COMMENT ON COLUMN product_categories.id IS '관계 고유 ID';
COMMENT ON COLUMN product_categories.product_id IS '상품 ID (FK)';
COMMENT ON COLUMN product_categories.category_id IS '카테고리 ID (FK)';
COMMENT ON COLUMN product_categories.is_primary IS '기본 카테고리 여부 (products.category_id와 동기화)';
COMMENT ON COLUMN product_categories.sort_order IS '정렬 순서 (작을수록 먼저 표시)';
COMMENT ON COLUMN product_categories.created_at IS '생성일시';

-- 7. 트리거 함수: products.category_id 변경 시 product_categories 동기화
CREATE OR REPLACE FUNCTION sync_product_category_id()
RETURNS TRIGGER AS $$
BEGIN
    -- category_id가 변경되면 product_categories의 is_primary 업데이트
    IF NEW.category_id IS NOT NULL THEN
        -- 기존 기본 카테고리 해제
        UPDATE product_categories
        SET is_primary = false
        WHERE product_id = NEW.id AND is_primary = true;
        
        -- 새로운 기본 카테고리 설정 (없으면 생성)
        INSERT INTO product_categories (product_id, category_id, is_primary, sort_order)
        VALUES (NEW.id, NEW.category_id, true, 0)
        ON CONFLICT (product_id, category_id)
        DO UPDATE SET is_primary = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. 트리거 생성
DROP TRIGGER IF EXISTS trg_sync_product_category_id ON products;
CREATE TRIGGER trg_sync_product_category_id
    AFTER INSERT OR UPDATE OF category_id ON products
    FOR EACH ROW
    WHEN (NEW.category_id IS NOT NULL)
    EXECUTE FUNCTION sync_product_category_id();

