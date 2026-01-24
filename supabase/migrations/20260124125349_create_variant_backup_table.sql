-- ============================================================================
-- 백업 테이블 생성: product_variants 백업
-- ============================================================================
-- 목적: variant_value 업데이트 전 원본 데이터 백업
-- 롤백 시 사용

-- 백업 테이블 생성 (현재 날짜 포함)
CREATE TABLE IF NOT EXISTS public.product_variants_backup_20260124 (
    id UUID PRIMARY KEY,
    product_id TEXT NOT NULL,
    variant_name TEXT NOT NULL,
    variant_value TEXT NOT NULL,
    stock INT NOT NULL,
    price_adjustment DECIMAL(10,2),
    sku TEXT,
    smartstore_origin_product_no BIGINT,
    smartstore_option_id BIGINT,
    smartstore_channel_product_no BIGINT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    backup_created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 백업 데이터 복사
INSERT INTO public.product_variants_backup_20260124
SELECT 
    id,
    product_id,
    variant_name,
    variant_value,
    stock,
    price_adjustment,
    sku,
    smartstore_origin_product_no,
    smartstore_option_id,
    smartstore_channel_product_no,
    deleted_at,
    created_at,
    updated_at,
    now() as backup_created_at
FROM public.product_variants;

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_pv_backup_product_id 
    ON public.product_variants_backup_20260124(product_id);
CREATE INDEX IF NOT EXISTS idx_pv_backup_variant_value 
    ON public.product_variants_backup_20260124(variant_value);

-- 주석
COMMENT ON TABLE public.product_variants_backup_20260124 IS 'product_variants 백업 테이블 (2026-01-24) - variant_value 업데이트 전 원본 데이터';
COMMENT ON COLUMN public.product_variants_backup_20260124.backup_created_at IS '백업 생성 일시';

-- 백업 완료 확인
DO $$
DECLARE
    original_count INT;
    backup_count INT;
BEGIN
    SELECT COUNT(*) INTO original_count FROM public.product_variants;
    SELECT COUNT(*) INTO backup_count FROM public.product_variants_backup_20260124;
    
    IF original_count = backup_count THEN
        RAISE NOTICE '✅ 백업 완료: % 개 레코드 백업됨', backup_count;
    ELSE
        RAISE WARNING '⚠️ 백업 불일치: 원본 % 개, 백업 % 개', original_count, backup_count;
    END IF;
END $$;
