-- 모든 상품 소프트 삭제 처리
-- deleted_at을 현재 시간으로 설정하여 논리적 삭제 처리

UPDATE products 
SET 
  deleted_at = now(),
  updated_at = now()
WHERE deleted_at IS NULL;

-- 삭제된 상품 수 확인
SELECT COUNT(*) as deleted_count
FROM products
WHERE deleted_at IS NOT NULL;

