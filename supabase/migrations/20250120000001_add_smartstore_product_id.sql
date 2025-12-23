-- =============================================
-- 네이버 스마트스토어 연동을 위한 필드 추가
-- =============================================

-- products 테이블에 네이버 스마트스토어 상품 ID 필드 추가
ALTER TABLE products
ADD COLUMN IF NOT EXISTS smartstore_product_id TEXT;

-- 인덱스 추가 (재고 동기화 시 빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_products_smartstore_product_id 
ON products(smartstore_product_id) 
WHERE smartstore_product_id IS NOT NULL AND deleted_at IS NULL;

-- 주석 추가
COMMENT ON COLUMN products.smartstore_product_id IS '네이버 스마트스토어 상품 ID (재고 동기화용)';




