-- ============================================================================
-- 옵션명 업데이트 마이그레이션
-- ============================================================================
-- 목적: variant_name_mapping 테이블의 매핑 정보를 기반으로 
--       product_variants.variant_value를 스마트스토어 옵션명으로 업데이트
--
-- 주의: 이 마이그레이션은 트랜잭션으로 실행되어야 하며,
--       사전에 variant_name_mapping 테이블의 데이터 품질을 검증해야 합니다.
--
-- 실행 전 체크리스트:
-- 1. 백업 테이블 생성 확인 (product_variants_backup_YYYYMMDD)
-- 2. variant_name_mapping 테이블 데이터 검증 완료
-- 3. 충돌 항목 수동 해결 완료
-- 4. 매핑 실패 항목 수동 보정 완료 (또는 제외)

BEGIN;

-- 1. 사전 검증: 매핑 테이블에 데이터가 있는지 확인
DO $$
DECLARE
    mapping_count INT;
    ready_count INT;
BEGIN
    SELECT COUNT(*) INTO mapping_count FROM public.variant_name_mapping;
    SELECT COUNT(*) INTO ready_count 
    FROM public.variant_name_mapping 
    WHERE variant_id IS NOT NULL 
        AND mapping_confidence IN ('exact', 'normalized', 'manual');
    
    IF mapping_count = 0 THEN
        RAISE EXCEPTION '매핑 테이블에 데이터가 없습니다. 먼저 build-smartstore-mapping.js를 실행하세요.';
    END IF;
    
    IF ready_count = 0 THEN
        RAISE EXCEPTION '업데이트할 매핑이 없습니다. (ready_count: %)', ready_count;
    END IF;
    
    RAISE NOTICE '✅ 검증 완료: 총 % 개 매핑, 업데이트 가능: % 개', mapping_count, ready_count;
END $$;

-- 2. 충돌 확인: 같은 variant_id가 여러 매핑에 있는지 확인
DO $$
DECLARE
    conflict_count INT;
BEGIN
    SELECT COUNT(*) INTO conflict_count
    FROM (
        SELECT variant_id
        FROM public.variant_name_mapping
        WHERE variant_id IS NOT NULL
            AND mapping_confidence IN ('exact', 'normalized', 'manual')
        GROUP BY variant_id
        HAVING COUNT(*) > 1
    ) conflicts;
    
    IF conflict_count > 0 THEN
        RAISE WARNING '⚠️ 충돌 감지: % 개 variant_id가 여러 매핑에 있습니다. 수동으로 해결하세요.', conflict_count;
        -- 충돌 상세 정보 출력
        RAISE NOTICE '충돌 상세:';
        FOR rec IN (
            SELECT variant_id, COUNT(*) as mapping_count
            FROM public.variant_name_mapping
            WHERE variant_id IS NOT NULL
                AND mapping_confidence IN ('exact', 'normalized', 'manual')
            GROUP BY variant_id
            HAVING COUNT(*) > 1
        ) LOOP
            RAISE NOTICE '  variant_id: %, 매핑 수: %', rec.variant_id, rec.mapping_count;
        END LOOP;
    ELSE
        RAISE NOTICE '✅ 충돌 없음';
    END IF;
END $$;

-- 3. 실제 업데이트 실행
-- 매핑 테이블에서 'exact', 'normalized', 'manual' 상태인 항목만 업데이트
UPDATE public.product_variants pv
SET 
    variant_value = vnm.new_variant_value,
    updated_at = now()
FROM public.variant_name_mapping vnm
WHERE pv.id = vnm.variant_id
    AND vnm.mapping_confidence IN ('exact', 'normalized', 'manual')
    AND pv.variant_value != vnm.new_variant_value -- 실제로 변경이 필요한 경우만
    AND pv.deleted_at IS NULL;

-- 4. 업데이트 결과 확인
DO $$
DECLARE
    updated_count INT;
    total_mappings INT;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    SELECT COUNT(*) INTO total_mappings
    FROM public.variant_name_mapping
    WHERE variant_id IS NOT NULL
        AND mapping_confidence IN ('exact', 'normalized', 'manual');
    
    RAISE NOTICE '✅ 업데이트 완료: % 개 옵션명 업데이트됨 (총 매핑: % 개)', updated_count, total_mappings;
    
    IF updated_count = 0 THEN
        RAISE WARNING '⚠️ 업데이트된 항목이 없습니다. 모든 옵션명이 이미 동일한지 확인하세요.';
    END IF;
END $$;

-- 5. 업데이트 후 검증: 매핑 테이블과 실제 데이터 일치 확인
DO $$
DECLARE
    mismatch_count INT;
BEGIN
    SELECT COUNT(*) INTO mismatch_count
    FROM public.product_variants pv
    INNER JOIN public.variant_name_mapping vnm ON pv.id = vnm.variant_id
    WHERE vnm.mapping_confidence IN ('exact', 'normalized', 'manual')
        AND pv.variant_value != vnm.new_variant_value
        AND pv.deleted_at IS NULL;
    
    IF mismatch_count > 0 THEN
        RAISE WARNING '⚠️ 불일치 감지: % 개 옵션명이 매핑 테이블과 일치하지 않습니다.', mismatch_count;
    ELSE
        RAISE NOTICE '✅ 검증 완료: 모든 옵션명이 매핑 테이블과 일치합니다.';
    END IF;
END $$;

-- 6. 롤백 안내
RAISE NOTICE '';
RAISE NOTICE '============================================================';
RAISE NOTICE '업데이트 완료';
RAISE NOTICE '============================================================';
RAISE NOTICE '롤백이 필요한 경우 다음 명령어를 실행하세요:';
RAISE NOTICE '  psql -f supabase/migrations/rollback_variant_names.sql';
RAISE NOTICE '============================================================';

COMMIT;

-- 참고: 이 마이그레이션은 COMMIT으로 끝나므로, 
--       문제가 발생하면 즉시 롤백 스크립트를 실행해야 합니다.
