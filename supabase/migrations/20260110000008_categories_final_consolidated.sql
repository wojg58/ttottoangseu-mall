-- ============================================================================
-- 카테고리 최종 통합 마이그레이션
-- ============================================================================
-- 
-- 이 파일은 새 환경에서 사용하기 위한 통합 마이그레이션입니다.
-- 기존 프로젝트에는 영향이 없습니다 (타임스탬프가 미래이므로 실행되지 않음).
-- 
-- 포함 내용:
-- - 카테고리 데이터 초기 삽입
-- - 카테고리 이름 및 설명 업데이트
-- ============================================================================

-- ============================================================================
-- 1. 카테고리 데이터 초기 삽입 (없는 경우에만)
-- ============================================================================

INSERT INTO public.categories (name, slug, description, sort_order, is_active)
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
  SELECT 1 FROM public.categories WHERE public.categories.slug = v.slug AND public.categories.deleted_at IS NULL
);

-- ============================================================================
-- 2. 카테고리 이름 및 설명 업데이트 (다양한 이전 이름 형식 지원)
-- ============================================================================

-- 2-1. "캐릭터" → "치이카와" (이름 및 설명 업데이트)
UPDATE public.categories 
SET 
  name = '치이카와',
  description = '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터',
  updated_at = now()
WHERE (name = '캐릭터' OR slug = 'character')
  AND name != '치이카와';

-- 2-2. "완구,스티커", "핸드폰줄" → "모프샌드" (이름 및 설명 업데이트)
UPDATE public.categories 
SET 
  name = '모프샌드',
  description = '사랑스럽고 귀여운 고양이',
  updated_at = now()
WHERE (name IN ('완구,스티커', '핸드폰줄') OR slug = 'phone-strap')
  AND name != '모프샌드';

-- 2-3. "키링,지비츠", "키링/지비츠" → "유키오" (이름 및 설명 업데이트)
UPDATE public.categories 
SET 
  name = '유키오',
  description = '순순하고 말없이 곁에 있어주는 납작한 친구',
  updated_at = now()
WHERE (name IN ('키링,지비츠', '키링/지비츠') OR slug = 'keyring')
  AND name != '유키오';

-- 2-4. "패션잡화" → "짱구" (이름 및 설명 업데이트)
UPDATE public.categories 
SET 
  name = '짱구',
  description = '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이',
  updated_at = now()
WHERE (name = '패션잡화' OR slug = 'fashion')
  AND name != '짱구';

-- 2-5. "곰돌이", "반다이" → "라부부" (이름 및 설명 업데이트)
UPDATE public.categories 
SET 
  name = '라부부',
  description = '귀엽고 엉뚱한 몬스터',
  updated_at = now()
WHERE (name IN ('곰돌이', '반다이') OR slug = 'bear')
  AND name != '라부부';

-- ============================================================================
-- 3. 카테고리 설명만 업데이트 (이름은 이미 올바른 경우)
-- ============================================================================

-- 3-1. 산리오 카테고리 설명 업데이트
UPDATE public.categories 
SET 
  description = '헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈',
  updated_at = now()
WHERE slug = 'sanrio'
  AND (description IS NULL OR description != '헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈');

-- 3-2. 치이카와 카테고리 설명 업데이트
UPDATE public.categories 
SET 
  description = '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터',
  updated_at = now()
WHERE slug = 'character'
  AND name = '치이카와'
  AND (description IS NULL OR description != '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터');

-- 3-3. 모프샌드 카테고리 설명 업데이트
UPDATE public.categories 
SET 
  description = '사랑스럽고 귀여운 고양이',
  updated_at = now()
WHERE slug = 'phone-strap'
  AND name = '모프샌드'
  AND (description IS NULL OR description != '사랑스럽고 귀여운 고양이');

-- 3-4. 유키오 카테고리 설명 업데이트
UPDATE public.categories 
SET 
  description = '순순하고 말없이 곁에 있어주는 납작한 친구',
  updated_at = now()
WHERE slug = 'keyring'
  AND name = '유키오'
  AND (description IS NULL OR description != '순순하고 말없이 곁에 있어주는 납작한 친구');

-- 3-5. 짱구 카테고리 설명 업데이트
UPDATE public.categories 
SET 
  description = '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이',
  updated_at = now()
WHERE slug = 'fashion'
  AND name = '짱구'
  AND (description IS NULL OR description != '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이');

-- 3-6. 라부부 카테고리 설명 업데이트
UPDATE public.categories 
SET 
  description = '귀엽고 엉뚱한 몬스터',
  updated_at = now()
WHERE slug = 'bear'
  AND name = '라부부'
  AND (description IS NULL OR description != '귀엽고 엉뚱한 몬스터');

-- ============================================================================
-- 마이그레이션 완료
-- ============================================================================

