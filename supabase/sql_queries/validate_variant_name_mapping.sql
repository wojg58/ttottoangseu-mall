-- ============================================================================
-- 매핑 테이블 검증 쿼리
-- ============================================================================
-- 목적: variant_name_mapping 테이블의 데이터 품질 검증
-- 충돌 감지, 매핑 품질 확인

-- 1. 매핑 통계
SELECT 
    mapping_confidence,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.variant_name_mapping
GROUP BY mapping_confidence
ORDER BY 
    CASE mapping_confidence
        WHEN 'exact' THEN 1
        WHEN 'normalized' THEN 2
        WHEN 'manual' THEN 3
        WHEN 'pending' THEN 4
        WHEN 'failed' THEN 5
    END;

-- 2. 충돌 감지: 같은 스마트스토어 옵션명이 여러 DB 옵션명에 매핑되는 경우
SELECT 
    new_variant_value as smartstore_option_name,
    COUNT(DISTINCT variant_id) as mapped_variant_count,
    COUNT(DISTINCT product_id) as affected_product_count,
    STRING_AGG(DISTINCT old_variant_value, ', ' ORDER BY old_variant_value) as db_option_names,
    STRING_AGG(DISTINCT product_id::text, ', ' ORDER BY product_id::text) as product_ids
FROM public.variant_name_mapping
WHERE variant_id IS NOT NULL
    AND mapping_confidence != 'failed'
GROUP BY new_variant_value
HAVING COUNT(DISTINCT variant_id) > 1
ORDER BY mapped_variant_count DESC, new_variant_value;

-- 3. 매핑 실패 항목 상세 (수동 보정 필요)
SELECT 
    vnm.id,
    vnm.product_id,
    p.name as product_name,
    vnm.new_variant_value as smartstore_option_name,
    vnm.smartstore_option_id,
    vnm.mapping_reason,
    vnm.created_at,
    -- 해당 상품의 모든 옵션명 (수동 매핑 참고용)
    (
        SELECT STRING_AGG(pv.variant_value, ', ' ORDER BY pv.variant_value)
        FROM public.product_variants pv
        WHERE pv.product_id = vnm.product_id
            AND pv.deleted_at IS NULL
    ) as available_db_options
FROM public.variant_name_mapping vnm
INNER JOIN public.products p ON vnm.product_id = p.id
WHERE vnm.mapping_confidence = 'failed'
ORDER BY p.name, vnm.new_variant_value;

-- 4. 매핑 품질 검증: old_variant_value와 new_variant_value 비교
SELECT 
    CASE 
        WHEN old_variant_value = new_variant_value THEN 'identical'
        WHEN normalize_variant_name(old_variant_value) = normalize_variant_name(new_variant_value) THEN 'normalized_match'
        WHEN old_variant_value ILIKE '%' || new_variant_value || '%' 
             OR new_variant_value ILIKE '%' || old_variant_value || '%' THEN 'partial_match'
        ELSE 'different'
    END as comparison_type,
    COUNT(*) as count
FROM public.variant_name_mapping
WHERE variant_id IS NOT NULL
    AND mapping_confidence != 'failed'
GROUP BY comparison_type
ORDER BY 
    CASE comparison_type
        WHEN 'identical' THEN 1
        WHEN 'normalized_match' THEN 2
        WHEN 'partial_match' THEN 3
        WHEN 'different' THEN 4
    END;

-- 5. 상품별 매핑 상태 요약
SELECT 
    p.id,
    p.name as product_name,
    COUNT(DISTINCT vnm.id) as total_mappings,
    COUNT(DISTINCT CASE WHEN vnm.mapping_confidence = 'exact' THEN vnm.id END) as exact_mappings,
    COUNT(DISTINCT CASE WHEN vnm.mapping_confidence = 'normalized' THEN vnm.id END) as normalized_mappings,
    COUNT(DISTINCT CASE WHEN vnm.mapping_confidence = 'failed' THEN vnm.id END) as failed_mappings,
    COUNT(DISTINCT pv.id) as total_variants,
    ROUND(
        COUNT(DISTINCT CASE WHEN vnm.mapping_confidence IN ('exact', 'normalized', 'manual') THEN vnm.id END) * 100.0 / 
        NULLIF(COUNT(DISTINCT pv.id), 0), 
        2
    ) as mapping_success_rate
FROM public.products p
LEFT JOIN public.product_variants pv ON p.id = pv.product_id AND pv.deleted_at IS NULL
LEFT JOIN public.variant_name_mapping vnm ON p.id = vnm.product_id
WHERE p.deleted_at IS NULL
    AND p.status = 'active'
GROUP BY p.id, p.name
HAVING COUNT(DISTINCT pv.id) > 0
ORDER BY mapping_success_rate ASC, p.name;

-- 6. 매핑 테이블과 실제 variant 비교 (누락 확인)
SELECT 
    pv.id as variant_id,
    pv.product_id,
    p.name as product_name,
    pv.variant_value as current_db_option_name,
    pv.smartstore_option_id,
    CASE 
        WHEN vnm.id IS NULL THEN 'NOT_IN_MAPPING_TABLE'
        ELSE vnm.mapping_confidence
    END as mapping_status
FROM public.product_variants pv
INNER JOIN public.products p ON pv.product_id = p.id
LEFT JOIN public.variant_name_mapping vnm ON pv.id = vnm.variant_id
WHERE pv.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND p.status = 'active'
    AND pv.smartstore_option_id IS NOT NULL -- 스마트스토어 연동된 옵션만
    AND vnm.id IS NULL -- 매핑 테이블에 없는 항목
ORDER BY p.name, pv.variant_value;

-- 7. 매핑 준비 상태 확인 (실제 업데이트 전 최종 검증)
SELECT 
    '매핑 준비 상태' as check_type,
    COUNT(*) FILTER (WHERE mapping_confidence IN ('exact', 'normalized', 'manual')) as ready_to_update,
    COUNT(*) FILTER (WHERE mapping_confidence = 'pending') as pending_review,
    COUNT(*) FILTER (WHERE mapping_confidence = 'failed') as needs_manual_fix,
    COUNT(*) as total_mappings
FROM public.variant_name_mapping
WHERE variant_id IS NOT NULL;

-- 참고: normalize_variant_name 함수는 실제 정규화 로직과 동일하게 구현 필요
-- 여기서는 간단한 예시만 제공 (실제로는 JavaScript의 normalizeOptionName과 동일한 로직 필요)
