-- =============================================
-- naver_sync_queue 테이블에 variant_id 컬럼 추가
-- 옵션 단위 재고 동기화를 위해 필요
-- =============================================

-- variant_id 컬럼 추가 (옵션 정보 저장)
ALTER TABLE naver_sync_queue
ADD COLUMN IF NOT EXISTS variant_id TEXT;

-- 인덱스 추가 (옵션별 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_naver_sync_queue_variant_id
ON naver_sync_queue(variant_id)
WHERE variant_id IS NOT NULL;

-- 주석 추가
COMMENT ON COLUMN naver_sync_queue.variant_id
IS '상품 옵션 ID (옵션 단위 재고 동기화용, NULL이면 상품 단위 동기화)';

