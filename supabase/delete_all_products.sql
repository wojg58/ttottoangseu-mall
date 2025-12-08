-- 모든 상품 물리적 삭제 SQL
-- Supabase Dashboard의 SQL Editor에서 실행하세요
-- 주의: 이 작업은 되돌릴 수 없습니다!

-- ============================================
-- 1단계: 삭제 전 확인
-- ============================================
SELECT 
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM product_categories) as product_categories_count,
  (SELECT COUNT(*) FROM product_images) as product_images_count,
  (SELECT COUNT(*) FROM product_variants) as product_variants_count,
  (SELECT COUNT(*) FROM cart_items WHERE product_id IS NOT NULL) as cart_items_count;

-- ============================================
-- 2단계: 관련 데이터 삭제 (외래키 제약조건 때문에 먼저 삭제 필요)
-- ============================================

-- 1. 상품-카테고리 관계 삭제
DELETE FROM product_categories;

-- 2. 상품 이미지 삭제
DELETE FROM product_images;

-- 3. 상품 옵션 삭제
DELETE FROM product_variants;

-- 4. 장바구니 아이템 삭제 (상품 관련)
DELETE FROM cart_items WHERE product_id IS NOT NULL;

-- 주의: order_items는 주문 기록이므로 삭제하지 않습니다.
-- 주문 기록도 삭제하려면 아래 주석을 해제하세요:
-- DELETE FROM order_items WHERE product_id IS NOT NULL;

-- ============================================
-- 3단계: 상품 삭제
-- ============================================
DELETE FROM products;

-- ============================================
-- 4단계: 삭제 후 확인
-- ============================================
SELECT 
  (SELECT COUNT(*) FROM products) as remaining_products,
  (SELECT COUNT(*) FROM product_categories) as remaining_product_categories,
  (SELECT COUNT(*) FROM product_images) as remaining_product_images,
  (SELECT COUNT(*) FROM product_variants) as remaining_product_variants,
  (SELECT COUNT(*) FROM cart_items WHERE product_id IS NOT NULL) as remaining_cart_items;

