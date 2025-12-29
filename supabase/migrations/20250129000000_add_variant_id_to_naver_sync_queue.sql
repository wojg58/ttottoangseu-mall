-- =============================================
-- naver_sync_queue 테이블에 variant_id 및 smartstore_option_id 컬럼 추가
-- 옵션 단위 재고 동기화를 위해 필요
-- =============================================

-- variant_id 컬럼 추가 (옵션 정보 저장)
ALTER TABLE naver_sync_queue
ADD COLUMN IF NOT EXISTS variant_id UUID;

-- smartstore_option_id 컬럼 추가 (스마트스토어 옵션 ID 저장)
ALTER TABLE naver_sync_queue
ADD COLUMN IF NOT EXISTS smartstore_option_id BIGINT;

-- 외래키 제약조건 추가 (product_variants 테이블 참조)
ALTER TABLE naver_sync_queue
ADD CONSTRAINT fk_naver_sync_queue_variant_id
FOREIGN KEY (variant_id) REFERENCES product_variants(id)
ON DELETE SET NULL
NOT VALID;

-- 제약조건 유효성 검사
ALTER TABLE naver_sync_queue
VALIDATE CONSTRAINT fk_naver_sync_queue_variant_id;

-- 인덱스 추가 (옵션별 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_naver_sync_queue_variant_id
ON naver_sync_queue(variant_id)
WHERE variant_id IS NOT NULL;

-- smartstore_option_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_naver_sync_queue_smartstore_option_id
ON naver_sync_queue(smartstore_option_id)
WHERE smartstore_option_id IS NOT NULL;

-- 주석 추가
COMMENT ON COLUMN naver_sync_queue.variant_id
IS '상품 옵션 ID (옵션 단위 재고 동기화용, NULL이면 상품 단위 동기화)';

COMMENT ON COLUMN naver_sync_queue.smartstore_option_id
IS '네이버 스마트스토어 옵션 ID (옵션 단위 재고 동기화용)';

