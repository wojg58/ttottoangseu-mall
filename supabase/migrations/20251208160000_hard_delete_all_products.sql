-- 모든 상품 물리적 삭제 (되돌릴 수 없음)
-- 주의: 이 작업은 완전히 되돌릴 수 없습니다.
-- 관련 데이터도 함께 삭제됩니다.

-- 삭제 전 상품 수 확인
SELECT COUNT(*) as before_count FROM products;

-- 관련 데이터 먼저 삭제 (외래키 제약조건 때문에)
-- 1. 상품-카테고리 관계 삭제
DELETE FROM product_categories;

-- 2. 상품 이미지 삭제
DELETE FROM product_images;

-- 3. 상품 옵션 삭제
DELETE FROM product_variants;

-- 4. 장바구니 아이템 삭제 (상품 관련)
DELETE FROM cart_items WHERE product_id IS NOT NULL;

-- 주의: order_items는 주문 기록이므로 삭제하지 않습니다.
-- 필요시 주문 기록도 삭제하려면 아래 주석을 해제하세요:
-- DELETE FROM order_items WHERE product_id IS NOT NULL;

-- 5. 상품 삭제
DELETE FROM products;

-- 삭제 후 확인
SELECT COUNT(*) as remaining_products FROM products;
SELECT COUNT(*) as remaining_product_categories FROM product_categories;
SELECT COUNT(*) as remaining_product_images FROM product_images;
SELECT COUNT(*) as remaining_product_variants FROM product_variants;

