-- ============================================================================
-- 매핑 테이블 생성: variant_name_mapping
-- ============================================================================
-- 목적: DB 옵션명과 스마트스토어 옵션명 매핑 정보 저장
-- 검증 및 수동 보정 후 실제 업데이트에 사용

CREATE TABLE IF NOT EXISTS public.variant_name_mapping (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    variant_id UUID, -- NULL 허용 (매핑 실패 시)
    product_id TEXT NOT NULL,
    old_variant_value TEXT NOT NULL,
    new_variant_value TEXT NOT NULL,
    smartstore_option_id BIGINT,
    smartstore_channel_product_no BIGINT,
    mapping_confidence TEXT NOT NULL DEFAULT 'pending', -- 'exact', 'normalized', 'manual', 'pending', 'failed'
    mapping_reason TEXT, -- 매핑 실패 이유 또는 수동 보정 사유
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- CHECK 제약조건
    CONSTRAINT chk_mapping_confidence CHECK (
        mapping_confidence IN ('exact', 'normalized', 'manual', 'pending', 'failed')
    ),
    CONSTRAINT chk_old_new_different CHECK (
        old_variant_value = 'UNMAPPED' OR new_variant_value = 'UNMAPPED' OR old_variant_value != new_variant_value
    ),
    -- variant_id가 NULL이면 매핑 실패 항목
    CONSTRAINT chk_failed_mapping CHECK (
        (mapping_confidence = 'failed' AND variant_id IS NULL) OR
        (mapping_confidence != 'failed' AND variant_id IS NOT NULL)
    )
);

-- 외래키 제약조건 (variant_id는 NULL 허용이므로 조건부로만 적용)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_variant_name_mapping_variant_id'
    ) THEN
        ALTER TABLE public.variant_name_mapping
            ADD CONSTRAINT fk_variant_name_mapping_variant_id
            FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_variant_name_mapping_product_id'
    ) THEN
        ALTER TABLE public.variant_name_mapping
            ADD CONSTRAINT fk_variant_name_mapping_product_id
            FOREIGN KEY (product_id) REFERENCES public.products(id)
            ON DELETE CASCADE;
    END IF;
END $$;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_variant_name_mapping_variant_id 
    ON public.variant_name_mapping(variant_id);
CREATE INDEX IF NOT EXISTS idx_variant_name_mapping_product_id 
    ON public.variant_name_mapping(product_id);
CREATE INDEX IF NOT EXISTS idx_variant_name_mapping_confidence 
    ON public.variant_name_mapping(mapping_confidence);
CREATE INDEX IF NOT EXISTS idx_variant_name_mapping_smartstore_option 
    ON public.variant_name_mapping(smartstore_option_id) 
    WHERE smartstore_option_id IS NOT NULL;

-- updated_at 트리거
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_variant_name_mapping_updated_at'
    ) THEN
        CREATE TRIGGER trg_variant_name_mapping_updated_at
            BEFORE UPDATE ON public.variant_name_mapping
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 주석
COMMENT ON TABLE public.variant_name_mapping IS '옵션명 매핑 테이블 - DB 옵션명과 스마트스토어 옵션명 매핑 정보';
COMMENT ON COLUMN public.variant_name_mapping.variant_id IS '옵션 ID (FK)';
COMMENT ON COLUMN public.variant_name_mapping.product_id IS '상품 ID (FK)';
COMMENT ON COLUMN public.variant_name_mapping.old_variant_value IS '기존 옵션명 (DB)';
COMMENT ON COLUMN public.variant_name_mapping.new_variant_value IS '새 옵션명 (스마트스토어)';
COMMENT ON COLUMN public.variant_name_mapping.smartstore_option_id IS '스마트스토어 옵션 ID';
COMMENT ON COLUMN public.variant_name_mapping.mapping_confidence IS '매핑 신뢰도: exact(정확), normalized(정규화), manual(수동), pending(대기), failed(실패)';
COMMENT ON COLUMN public.variant_name_mapping.mapping_reason IS '매핑 실패 이유 또는 수동 보정 사유';
