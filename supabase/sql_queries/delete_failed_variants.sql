-- ============================================================================
-- 매핑 실패한 variant 삭제 (soft delete)
-- ============================================================================
-- 목적: 매핑 실패한 variant들을 삭제하여 스크립트가 새로 생성하도록 함
-- ⚠️ 주의: 재고 정보가 손실됩니다

BEGIN;

-- 매핑 실패한 상품의 variant들을 soft delete
UPDATE public.product_variants pv
SET deleted_at = now()
WHERE pv.id IN (
    SELECT DISTINCT pv2.id
    FROM public.variant_name_mapping vnm
    INNER JOIN public.products p ON p.id = vnm.product_id
    INNER JOIN public.product_variants pv2 ON pv2.product_id = vnm.product_id 
        AND pv2.deleted_at IS NULL
    WHERE vnm.mapping_confidence = 'failed'
);

-- 삭제된 variant 수 확인
SELECT COUNT(*) as deleted_count
FROM public.product_variants
WHERE deleted_at IS NOT NULL
  AND deleted_at >= NOW() - INTERVAL '1 minute';

COMMIT;
