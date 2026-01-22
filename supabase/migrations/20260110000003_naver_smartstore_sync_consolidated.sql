-- ============================================================================
-- 네이버 스마트스토어 연동 통합 마이그레이션
-- ============================================================================
-- 
-- 이 파일은 새 환경에서 사용하기 위한 통합 마이그레이션입니다.
-- 기존 프로젝트에는 영향이 없습니다 (타임스탬프가 미래이므로 실행되지 않음).
-- 
-- 포함 내용:
-- - products.smartstore_product_id 컬럼 (이미 초기 스키마에 포함됨)
-- - product_variants 스마트스토어 매핑 컬럼 (이미 초기 스키마에 포함됨)
-- - naver_sync_queue 테이블 생성 및 variant_id 추가
-- ============================================================================

-- ============================================================================
-- 1. naver_sync_queue 테이블 생성 (재고 동기화 큐)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.naver_sync_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id TEXT,
    variant_id UUID,
    smartstore_product_id TEXT,
    smartstore_option_id BIGINT,
    sync_type VARCHAR(20) NOT NULL DEFAULT 'stock', -- 'stock': 재고, 'price': 가격
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at TIMESTAMPTZ,
    
    -- CHECK 제약조건
    CONSTRAINT chk_naver_sync_queue_sync_type CHECK (sync_type IN ('stock', 'price')),
    CONSTRAINT chk_naver_sync_queue_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- 기존 테이블이 이미 존재하고 variant_id 타입이 TEXT인 경우 UUID로 변환
DO $$
DECLARE
    variant_data_type TEXT;
BEGIN
    SELECT data_type
      INTO variant_data_type
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'naver_sync_queue'
       AND column_name = 'variant_id';

    IF variant_data_type = 'text' THEN
        -- UUID 형식이 아닌 값은 NULL 처리 후 타입 변환
        UPDATE public.naver_sync_queue
           SET variant_id = NULL
         WHERE variant_id IS NOT NULL
           AND variant_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

        ALTER TABLE public.naver_sync_queue
          ALTER COLUMN variant_id TYPE UUID
          USING variant_id::uuid;
    END IF;
END $$;

-- 외래키 제약조건
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_naver_sync_queue_product_id'
    ) THEN
        ALTER TABLE public.naver_sync_queue
            ADD CONSTRAINT fk_naver_sync_queue_product_id
            FOREIGN KEY (product_id) REFERENCES public.products(id)
            ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_naver_sync_queue_variant_id'
    ) THEN
        ALTER TABLE public.naver_sync_queue
            ADD CONSTRAINT fk_naver_sync_queue_variant_id
            FOREIGN KEY (variant_id) REFERENCES public.product_variants(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- 트리거 생성
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_naver_sync_queue_updated_at'
    ) THEN
        CREATE TRIGGER trg_naver_sync_queue_updated_at
            BEFORE UPDATE ON public.naver_sync_queue
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_naver_sync_queue_product_id 
    ON public.naver_sync_queue(product_id) 
    WHERE product_id IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_naver_sync_queue_variant_id
    ON public.naver_sync_queue(variant_id)
    WHERE variant_id IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_naver_sync_queue_smartstore_option_id
    ON public.naver_sync_queue(smartstore_option_id)
    WHERE smartstore_option_id IS NOT NULL;
    
CREATE INDEX IF NOT EXISTS idx_naver_sync_queue_status 
    ON public.naver_sync_queue(status) 
    WHERE status = 'pending';
    
CREATE INDEX IF NOT EXISTS idx_naver_sync_queue_created_at 
    ON public.naver_sync_queue(created_at DESC);

-- RLS 비활성화 (개발 환경)
ALTER TABLE public.naver_sync_queue DISABLE ROW LEVEL SECURITY;

-- 주석
COMMENT ON TABLE public.naver_sync_queue IS '네이버 스마트스토어 재고/가격 동기화 큐';
COMMENT ON COLUMN public.naver_sync_queue.product_id IS '상품 ID (FK, TEXT, NULL이면 variant_id만 사용)';
COMMENT ON COLUMN public.naver_sync_queue.variant_id IS '상품 옵션 ID (옵션 단위 재고 동기화용, NULL이면 상품 단위 동기화)';
COMMENT ON COLUMN public.naver_sync_queue.smartstore_product_id IS '네이버 스마트스토어 상품 ID';
COMMENT ON COLUMN public.naver_sync_queue.smartstore_option_id IS '네이버 스마트스토어 옵션 ID (옵션 단위 재고 동기화용)';
COMMENT ON COLUMN public.naver_sync_queue.sync_type IS '동기화 타입 (stock: 재고, price: 가격)';
COMMENT ON COLUMN public.naver_sync_queue.status IS '동기화 상태 (pending: 대기, processing: 처리중, completed: 완료, failed: 실패)';
COMMENT ON COLUMN public.naver_sync_queue.retry_count IS '재시도 횟수';

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

