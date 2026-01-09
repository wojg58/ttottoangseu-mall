-- ============================================================================
-- 카테고리 관리 통합 쿼리
-- ============================================================================
-- 
-- 이 쿼리는 다음 2개의 쿼리를 통합한 것입니다:
-- 1. "카테고리명·설명 일괄 업데이트"
-- 2. "상품-카테고리 다대다 관계 마이그레이션"
-- 
-- 주의: "상품-카테고리 다대다 관계"는 이미 마이그레이션 파일로 존재합니다.
--       이 쿼리는 카테고리 데이터 관리용입니다.
-- 
-- ⚠️ 중요: 이 파일에는 여러 SQL 문이 포함되어 있습니다.
--          각 단계를 개별적으로 실행하거나, 필요한 쿼리만 선택해서 실행하세요.
--          EXPLAIN을 사용하려면 SELECT 쿼리만 선택해야 합니다.
-- ============================================================================

-- ============================================================================
-- 단계 1: 카테고리 데이터 초기 삽입 (없는 경우에만)
-- ============================================================================
-- 이 쿼리만 선택해서 실행하세요.
INSERT INTO categories (name, slug, description, sort_order, is_active)
SELECT * FROM (VALUES
  ('베스트', 'best', '베스트 상품 모음', 1, true),
  ('산리오', 'sanrio', '헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈', 2, true),
  ('치이카와', 'character', '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터', 3, true),
  ('모프샌드', 'phone-strap', '사랑스럽고 귀여운 고양이', 4, true),
  ('유키오', 'keyring', '순순하고 말없이 곁에 있어주는 납작한 친구', 5, true),
  ('짱구', 'fashion', '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이', 6, true),
  ('라부부', 'bear', '귀엽고 엉뚱한 몬스터', 7, true)
) AS v(name, slug, description, sort_order, is_active)
WHERE NOT EXISTS (
  SELECT 1 FROM categories WHERE categories.slug = v.slug AND categories.deleted_at IS NULL
);

-- ============================================================================
-- 단계 2: 카테고리 이름 및 설명 업데이트
-- ============================================================================

-- 2-1. "캐릭터" → "치이카와"
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  name = '치이카와',
  description = '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터',
  updated_at = now()
WHERE (name = '캐릭터' OR slug = 'character')
  AND name != '치이카와';

-- 2-2. "완구,스티커", "핸드폰줄" → "모프샌드"
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  name = '모프샌드',
  description = '사랑스럽고 귀여운 고양이',
  updated_at = now()
WHERE (name IN ('완구,스티커', '핸드폰줄') OR slug = 'phone-strap')
  AND name != '모프샌드';

-- 2-3. "키링,지비츠", "키링/지비츠" → "유키오"
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  name = '유키오',
  description = '순순하고 말없이 곁에 있어주는 납작한 친구',
  updated_at = now()
WHERE (name IN ('키링,지비츠', '키링/지비츠') OR slug = 'keyring')
  AND name != '유키오';

-- 2-4. "패션잡화" → "짱구"
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  name = '짱구',
  description = '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이',
  updated_at = now()
WHERE (name = '패션잡화' OR slug = 'fashion')
  AND name != '짱구';

-- 2-5. "곰돌이", "반다이" → "라부부"
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  name = '라부부',
  description = '귀엽고 엉뚱한 몬스터',
  updated_at = now()
WHERE (name IN ('곰돌이', '반다이') OR slug = 'bear')
  AND name != '라부부';

-- ============================================================================
-- 단계 3: 카테고리 설명만 업데이트 (이름은 이미 올바른 경우)
-- ============================================================================

-- 2-2, 2-3, 2-4, 2-5 쿼리에도 "이 쿼리만 선택해서 실행하세요" 추가
-- 2-2. "완구,스티커", "핸드폰줄" → "모프샌드"
-- 이 쿼리만 선택해서 실행하세요.

-- 3-1. 산리오 카테고리 설명 업데이트
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  description = '헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈',
  updated_at = now()
WHERE slug = 'sanrio'
  AND (description IS NULL OR description != '헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈');

-- 3-2. 치이카와 카테고리 설명 업데이트
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  description = '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터',
  updated_at = now()
WHERE slug = 'character'
  AND name = '치이카와'
  AND (description IS NULL OR description != '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터');

-- 3-3. 모프샌드 카테고리 설명 업데이트
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  description = '사랑스럽고 귀여운 고양이',
  updated_at = now()
WHERE slug = 'phone-strap'
  AND name = '모프샌드'
  AND (description IS NULL OR description != '사랑스럽고 귀여운 고양이');

-- 3-4. 유키오 카테고리 설명 업데이트
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  description = '순순하고 말없이 곁에 있어주는 납작한 친구',
  updated_at = now()
WHERE slug = 'keyring'
  AND name = '유키오'
  AND (description IS NULL OR description != '순순하고 말없이 곁에 있어주는 납작한 친구');

-- 3-5. 짱구 카테고리 설명 업데이트
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  description = '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이',
  updated_at = now()
WHERE slug = 'fashion'
  AND name = '짱구'
  AND (description IS NULL OR description != '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이');

-- 3-6. 라부부 카테고리 설명 업데이트
-- 이 쿼리만 선택해서 실행하세요.
UPDATE categories 
SET 
  description = '귀엽고 엉뚱한 몬스터',
  updated_at = now()
WHERE slug = 'bear'
  AND name = '라부부'
  AND (description IS NULL OR description != '귀엽고 엉뚱한 몬스터');

-- ============================================================================
-- 단계 4: "가챠,리멘트" 카테고리 삭제 (soft delete)
-- ============================================================================
-- ⚠️ 이 쿼리는 데이터를 변경합니다.
-- 이 쿼리만 선택해서 실행하세요.
-- 
-- "가챠,리멘트", "가차,리멘트", "완구문구", "스마일" 등 모든 변형 삭제
UPDATE categories 
SET 
  deleted_at = now(),
  updated_at = now()
WHERE slug = 'stationery'
   OR name IN ('가챠,리멘트', '가차,리멘트', '완구문구', '스마일')
   AND deleted_at IS NULL;

-- ============================================================================
-- 단계 5: 카테고리 확인 (SELECT 쿼리 - EXPLAIN 사용 가능)
-- ============================================================================
-- 이 쿼리만 선택해서 실행하거나 EXPLAIN을 사용하세요.
SELECT 
  id,
  name,
  slug,
  description,
  sort_order,
  is_active,
  deleted_at,
  updated_at
FROM categories
WHERE 
  (name IN ('베스트', '산리오', '치이카와', '모프샌드', '유키오', '짱구', '라부부')
   OR slug IN ('best', 'sanrio', 'character', 'phone-strap', 'keyring', 'fashion', 'bear'))
  AND deleted_at IS NULL
ORDER BY 
  COALESCE(sort_order, 0),
  name;

-- ============================================================================
-- 마무리
-- ============================================================================
-- 
-- 카테고리 업데이트가 완료되었습니다.
-- 
-- 참고: "상품-카테고리 다대다 관계"는 마이그레이션 파일을 통해 이미 설정되어 있습니다.
--       (20250115000000_add_product_categories_many_to_many.sql)
-- ============================================================================

