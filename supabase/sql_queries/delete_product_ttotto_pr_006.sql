-- ============================================================================
-- ttotto_pr_006 상품 삭제 처리 (홈화면 전체상품에서 제거)
-- ============================================================================
-- 
-- 상품명: 산리오 헬로키티 블랙엔젤 하트 카라비너 마스코트 인형 키링 그레이
-- 상품 ID: ttotto_pr_006
-- 스마트스토어 ID: 12510513094 (동기화 대상)
-- 
-- ⚠️ 주의: 이 상품은 스마트스토어 동기화 대상이지만, 홈화면에서만 제거합니다.
-- ============================================================================

-- 삭제 전 확인
SELECT 
  id,
  name,
  status,
  stock,
  smartstore_product_id,
  deleted_at,
  '삭제 전 상태' as description
FROM products
WHERE id = 'ttotto_pr_006';

-- 상품 소프트 삭제 처리 (홈화면에서 제거)
UPDATE products
SET 
  deleted_at = NOW(),
  updated_at = NOW()
WHERE id = 'ttotto_pr_006'
  AND deleted_at IS NULL;

-- 삭제 후 확인
SELECT 
  id,
  name,
  status,
  deleted_at,
  '삭제 완료 - 홈화면에서 제거됨' as status_message
FROM products
WHERE id = 'ttotto_pr_006';
