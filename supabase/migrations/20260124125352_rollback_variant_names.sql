-- ============================================================================
-- 옵션명 롤백 스크립트
-- ============================================================================
-- 목적: 백업 테이블에서 원본 variant_value 복원
--       variant_name_mapping 테이블은 유지 (수동 보정 정보 보존)
--
-- 주의: 이 스크립트는 백업 테이블이 존재하는 경우에만 실행 가능합니다.
--       백업 테이블명: product_variants_backup_YYYYMMDD
--
-- 실행 방법:
--   psql -f supabase/migrations/20260124125352_rollback_variant_names.sql
--   또는 Supabase SQL Editor에서 실행

BEGIN;

-- 1. 백업 테이블 존재 확인
DO $$
DECLARE
    backup_table_name TEXT;
    backup_count INT;
    current_count INT;
BEGIN
    -- 백업 테이블 찾기 (가장 최근 것)
    SELECT tablename INTO backup_table_name
    FROM pg_tables
    WHERE schemaname = 'public'
        AND tablename LIKE 'product_variants_backup_%'
    ORDER BY tablename DESC
    LIMIT 1;
    
    IF backup_table_name IS NULL THEN
        RAISE EXCEPTION '백업 테이블을 찾을 수 없습니다. product_variants_backup_YYYYMMDD 형식의 테이블이 필요합니다.';
    END IF;
    
    -- 백업 테이블의 레코드 수 확인
    EXECUTE format('SELECT COUNT(*) FROM public.%I', backup_table_name) INTO backup_count;
    
    -- 현재 테이블의 레코드 수 확인
    SELECT COUNT(*) INTO current_count FROM public.product_variants WHERE deleted_at IS NULL;
    
    RAISE NOTICE '✅ 백업 테이블 발견: %', backup_table_name;
    RAISE NOTICE '   백업 레코드 수: %', backup_count;
    RAISE NOTICE '   현재 레코드 수: %', current_count;
    
    IF backup_count = 0 THEN
        RAISE EXCEPTION '백업 테이블이 비어있습니다.';
    END IF;
    
    -- 백업 테이블명을 세션 변수에 저장 (다음 단계에서 사용)
    PERFORM set_config('app.backup_table_name', backup_table_name, false);
END $$;

-- 2. 롤백 실행: 백업 테이블에서 variant_value 복원
DO $$
DECLARE
    backup_table_name TEXT;
    restored_count INT;
BEGIN
    -- 세션 변수에서 백업 테이블명 가져오기
    backup_table_name := current_setting('app.backup_table_name');
    
    -- 백업 테이블과 조인하여 variant_value 복원
    EXECUTE format('
        UPDATE public.product_variants pv
        SET 
            variant_value = backup.variant_value,
            updated_at = now()
        FROM public.%I backup
        WHERE pv.id = backup.id
            AND pv.variant_value != backup.variant_value
            AND pv.deleted_at IS NULL
    ', backup_table_name);
    
    GET DIAGNOSTICS restored_count = ROW_COUNT;
    
    RAISE NOTICE '✅ 롤백 완료: % 개 옵션명 복원됨', restored_count;
    
    IF restored_count = 0 THEN
        RAISE NOTICE '⚠️ 복원된 항목이 없습니다. (이미 원본 상태일 수 있음)';
    END IF;
END $$;

-- 3. 롤백 후 검증: 백업 테이블과 일치 확인
DO $$
DECLARE
    backup_table_name TEXT;
    mismatch_count INT;
BEGIN
    backup_table_name := current_setting('app.backup_table_name');
    
    -- 불일치 항목 확인
    EXECUTE format('
        SELECT COUNT(*)
        FROM public.product_variants pv
        INNER JOIN public.%I backup ON pv.id = backup.id
        WHERE pv.variant_value != backup.variant_value
            AND pv.deleted_at IS NULL
    ', backup_table_name) INTO mismatch_count;
    
    IF mismatch_count > 0 THEN
        RAISE WARNING '⚠️ 불일치 감지: % 개 옵션명이 백업과 일치하지 않습니다.', mismatch_count;
    ELSE
        RAISE NOTICE '✅ 검증 완료: 모든 옵션명이 백업과 일치합니다.';
    END IF;
END $$;

-- 4. 롤백 완료 안내
RAISE NOTICE '';
RAISE NOTICE '============================================================';
RAISE NOTICE '롤백 완료';
RAISE NOTICE '============================================================';
RAISE NOTICE '참고: variant_name_mapping 테이블은 유지됩니다.';
RAISE NOTICE '      필요시 수동으로 삭제하거나 다시 매핑을 시도하세요.';
RAISE NOTICE '============================================================';

COMMIT;

-- 참고: variant_name_mapping 테이블은 삭제하지 않습니다.
--       수동 보정 정보를 보존하기 위함입니다.
--       완전히 삭제하려면 다음 명령어를 실행하세요:
--       DROP TABLE IF EXISTS public.variant_name_mapping;
