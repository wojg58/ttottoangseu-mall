-- =============================================
-- 네이버 스마트스토어 옵션 단위 재고 연동을 위한 필드 추가
-- =============================================
-- 
-- 목적: product_variants 테이블에 스마트스토어 옵션 매핑 정보 저장
-- 
-- 추가 컬럼:
-- - smartstore_origin_product_no: 원상품 번호 (옵션 ID와 조합하여 유니크)
-- - smartstore_option_id: 옵션 ID (원상품 번호와 조합하여 유니크)
-- - smartstore_channel_product_no: 채널상품 번호 (멀티채널 확장 대비)
--
-- 참고: 옵션 ID는 전역으로 유니크가 아닐 수 있으므로
--       origin_product_no + option_id 조합으로 매핑합니다.

-- 1. 컬럼 추가
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS smartstore_origin_product_no BIGINT,
ADD COLUMN IF NOT EXISTS smartstore_option_id BIGINT,
ADD COLUMN IF NOT EXISTS smartstore_channel_product_no BIGINT;

-- 2. 복합 인덱스 추가 (origin + option 조합으로 조회)
CREATE INDEX IF NOT EXISTS idx_pv_smartstore_origin_option
ON product_variants(smartstore_origin_product_no, smartstore_option_id)
WHERE smartstore_origin_product_no IS NOT NULL
  AND smartstore_option_id IS NOT NULL
  AND deleted_at IS NULL;

-- 3. SKU 인덱스 추가 (sellerManagerCode 매핑용)
-- 이미 존재할 수 있으므로 IF NOT EXISTS 사용
CREATE INDEX IF NOT EXISTS idx_product_variants_sku
ON product_variants(sku)
WHERE sku IS NOT NULL AND deleted_at IS NULL;

-- 4. 채널상품 번호 인덱스 추가 (채널상품으로 조회 시 사용)
CREATE INDEX IF NOT EXISTS idx_pv_smartstore_channel_product_no
ON product_variants(smartstore_channel_product_no)
WHERE smartstore_channel_product_no IS NOT NULL
  AND deleted_at IS NULL;

-- 5. 주석 추가
COMMENT ON COLUMN product_variants.smartstore_origin_product_no
IS '네이버 스마트스토어 원상품 번호 (옵션 ID와 조합하여 유니크)';

COMMENT ON COLUMN product_variants.smartstore_option_id
IS '네이버 스마트스토어 옵션 ID (원상품 번호와 조합하여 유니크)';

COMMENT ON COLUMN product_variants.smartstore_channel_product_no
IS '네이버 스마트스토어 채널상품 번호 (멀티채널 확장 대비)';

-- 6. (선택) 데이터 정리 후 UNIQUE 제약 추가 검토
-- 매핑 빌드 작업 완료 후 중복 데이터가 없는지 확인하고
-- 필요시 아래 주석을 해제하여 UNIQUE 제약을 추가하세요.
--
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_pv_smartstore_unique
-- ON product_variants(smartstore_origin_product_no, smartstore_option_id)
-- WHERE smartstore_origin_product_no IS NOT NULL
--   AND smartstore_option_id IS NOT NULL
--   AND deleted_at IS NULL;

