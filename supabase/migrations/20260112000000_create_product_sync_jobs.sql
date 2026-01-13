-- ============================================================================
-- 상품 싱크 작업 큐 테이블 생성
-- ============================================================================
-- 
-- 관리자 페이지에서 스마트스토어 상품 싱크 작업을 추적하기 위한 테이블
-- 
-- 사용 방법:
-- - Supabase 대시보드 → SQL Editor에서 실행
-- ============================================================================

-- 1. 작업 큐 테이블 생성
CREATE TABLE IF NOT EXISTS public.product_sync_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
    progress INT NOT NULL DEFAULT 0, -- 0-100 (진행률)
    total_products INT, -- 전체 상품 수
    processed_products INT DEFAULT 0, -- 처리된 상품 수
    result JSONB, -- 작업 결과 (매핑 성공/실패 수 등)
    error_message TEXT, -- 에러 메시지
    started_by TEXT, -- 작업 시작한 사용자 ID (Clerk user ID)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ, -- 작업 시작 시간
    completed_at TIMESTAMPTZ, -- 작업 완료 시간
    
    -- CHECK 제약조건
    CONSTRAINT chk_product_sync_jobs_status CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    CONSTRAINT chk_product_sync_jobs_progress CHECK (progress >= 0 AND progress <= 100)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_product_sync_jobs_status 
    ON public.product_sync_jobs(status) 
    WHERE status IN ('pending', 'running');

CREATE INDEX IF NOT EXISTS idx_product_sync_jobs_created_at 
    ON public.product_sync_jobs(created_at DESC);

-- 3. 트리거 생성 (updated_at 자동 업데이트)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_product_sync_jobs_updated_at'
    ) THEN
        CREATE TRIGGER trg_product_sync_jobs_updated_at
            BEFORE UPDATE ON public.product_sync_jobs
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 4. RLS 비활성화 (개발 환경)
ALTER TABLE public.product_sync_jobs DISABLE ROW LEVEL SECURITY;

-- 5. 주석 추가
COMMENT ON TABLE public.product_sync_jobs IS '스마트스토어 상품 싱크 작업 큐';
COMMENT ON COLUMN public.product_sync_jobs.status IS '작업 상태 (pending: 대기, running: 실행중, completed: 완료, failed: 실패)';
COMMENT ON COLUMN public.product_sync_jobs.progress IS '진행률 (0-100)';
COMMENT ON COLUMN public.product_sync_jobs.result IS '작업 결과 JSON (매핑 성공/실패 수, 재고 동기화 결과 등)';
COMMENT ON COLUMN public.product_sync_jobs.started_by IS '작업 시작한 사용자 ID (Clerk user ID)';

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================




