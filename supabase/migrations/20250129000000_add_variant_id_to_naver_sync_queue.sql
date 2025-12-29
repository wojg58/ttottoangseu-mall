-- =============================================
-- naver_sync_queue 테이블에 variant_id 및 smartstore_option_id 컬럼 추가
-- 옵션 단위 재고 동기화를 위해 필요
-- =============================================

-- variant_id 컬럼 추가 또는 타입 변경 (옵션 정보 저장)
-- 기존 컬럼이 TEXT 타입일 수 있으므로 타입 변경 처리
DO $$
BEGIN
  -- variant_id 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'naver_sync_queue' AND column_name = 'variant_id'
  ) THEN
    ALTER TABLE naver_sync_queue ADD COLUMN variant_id UUID;
  -- variant_id 컬럼이 있지만 TEXT 타입이면 UUID로 변경
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'naver_sync_queue' 
    AND column_name = 'variant_id' 
    AND data_type = 'text'
  ) THEN
    -- 기존 외래키 제약조건이 있다면 제거
    ALTER TABLE naver_sync_queue DROP CONSTRAINT IF EXISTS fk_naver_sync_queue_variant_id;
    -- TEXT를 UUID로 변환 (NULL이거나 유효한 UUID 문자열만 변환)
    ALTER TABLE naver_sync_queue 
    ALTER COLUMN variant_id TYPE UUID USING CASE 
      WHEN variant_id IS NULL OR variant_id = '' THEN NULL
      ELSE variant_id::UUID
    END;
  END IF;
END $$;

-- smartstore_option_id 컬럼 추가 (스마트스토어 옵션 ID 저장)
ALTER TABLE naver_sync_queue
ADD COLUMN IF NOT EXISTS smartstore_option_id BIGINT;

-- 외래키 제약조건 추가 (product_variants 테이블 참조)
-- 기존 제약조건이 없을 때만 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_naver_sync_queue_variant_id'
    AND table_name = 'naver_sync_queue'
  ) THEN
    ALTER TABLE naver_sync_queue
    ADD CONSTRAINT fk_naver_sync_queue_variant_id
    FOREIGN KEY (variant_id) REFERENCES product_variants(id)
    ON DELETE SET NULL
    NOT VALID;
    
    -- 제약조건 유효성 검사
    ALTER TABLE naver_sync_queue
    VALIDATE CONSTRAINT fk_naver_sync_queue_variant_id;
  END IF;
END $$;

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

