-- ============================================================================
-- 숨김 처리된 상품 삭제 SQL
-- ============================================================================
-- 
-- 목적: status가 'hidden'인 상품들을 소프트 삭제 처리
-- 
-- 실행 방법:
-- 1. Supabase Dashboard > SQL Editor에서 실행
-- 2. 또는 로컬에서 스크립트 실행: pnpm tsx scripts/delete-hidden-products.ts
-- 
-- ⚠️ 주의: 이 작업은 되돌릴 수 없습니다!
-- ============================================================================

-- 삭제 전 확인
SELECT 
  COUNT(*) as hidden_count_before,
  '삭제 전 숨김 처리된 상품 수' as description
FROM products
WHERE status = 'hidden'
  AND deleted_at IS NULL;

-- 숨김 처리된 상품 소프트 삭제
UPDATE products
SET 
  deleted_at = NOW(),
  updated_at = NOW()
WHERE status = 'hidden'
  AND deleted_at IS NULL;

-- 삭제 후 확인
SELECT 
  COUNT(*) as hidden_count_after,
  '삭제 후 남은 숨김 처리된 상품 수' as description
FROM products
WHERE status = 'hidden'
  AND deleted_at IS NULL;

-- 삭제된 상품 확인 (deleted_at이 설정된 숨김 상품)
SELECT 
  COUNT(*) as deleted_hidden_count,
  '삭제 처리된 숨김 상품 수' as description
FROM products
WHERE status = 'hidden'
  AND deleted_at IS NOT NULL;
