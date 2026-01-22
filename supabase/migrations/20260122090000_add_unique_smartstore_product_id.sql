-- =============================================
-- smartstore_product_id 중복 방지 (부분 유니크 인덱스)
-- =============================================

-- smartstore_product_id는 deleted_at이 null인 활성 상품에서만 유니크 보장
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_smartstore_product_id_unique
ON public.products (smartstore_product_id)
WHERE smartstore_product_id IS NOT NULL
  AND deleted_at IS NULL;
