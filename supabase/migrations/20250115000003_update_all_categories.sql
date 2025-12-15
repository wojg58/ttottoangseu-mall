-- =============================================
-- 모든 카테고리 이름 및 설명 일괄 업데이트
-- =============================================
-- 이 SQL문은 Supabase 대시보드의 SQL Editor에서 바로 실행할 수 있습니다.
-- 
-- 변경 사항:
-- 1. "캐릭터" → "치이카와" (설명: "치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터")
-- 2. "완구,스티커" → "모프샌드" (설명: "사랑스럽고 귀여운 고양이")
-- 3. "키링,지비츠" 또는 "키링/지비츠" → "유키오" (설명: "순수하고 말없이 곁에 있어주는 납작한 친구")
-- 4. "패션잡화" → "짱구" (설명: "장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이")
-- 5. "곰돌이" → "반다이" (설명: "다마고치, 배스킨라빈스 등 반다이 상품")
-- 6. "스마일" → "가차,리멘트" (설명: "다양한 캡슐토이와 리멘트")
-- 7. "산리오" 설명 업데이트 (설명: "헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈")

-- 1. "캐릭터" → "치이카와" (이름 및 설명 업데이트)
UPDATE categories 
SET 
  name = '치이카와',
  description = '치이카와, 하치와레, 우사기, 쿠리만쥬, 모몽가, 랏코, 시사, 카니 귀여운 인기 캐릭터',
  updated_at = now()
WHERE name = '캐릭터' OR slug = 'character';

-- 2. "완구,스티커" → "모프샌드" (이름 및 설명 업데이트)
UPDATE categories 
SET 
  name = '모프샌드',
  description = '사랑스럽고 귀여운 고양이',
  updated_at = now()
WHERE name = '완구,스티커' OR slug = 'phone-strap';

-- 3. "키링,지비츠" 또는 "키링/지비츠" → "유키오" (이름 및 설명 업데이트)
UPDATE categories 
SET 
  name = '유키오',
  description = '순수하고 말없이 곁에 있어주는 납작한 친구',
  updated_at = now()
WHERE name IN ('키링,지비츠', '키링/지비츠') OR slug = 'keyring';

-- 4. "패션잡화" → "짱구" (이름 및 설명 업데이트)
UPDATE categories 
SET 
  name = '짱구',
  description = '장난꾸러기지만 가족과 친구를 누구보다 아끼는 다섯 살 아이',
  updated_at = now()
WHERE name = '패션잡화' OR slug = 'fashion';

-- 5. "곰돌이" → "반다이" (이름 및 설명 업데이트)
UPDATE categories 
SET 
  name = '반다이',
  description = '다마고치, 배스킨라빈스 등 반다이 상품',
  updated_at = now()
WHERE name = '곰돌이' OR slug = 'bear';

-- 6. "스마일" → "가차,리멘트" (이름 및 설명 업데이트)
UPDATE categories 
SET 
  name = '가차,리멘트',
  description = '다양한 캡슐토이와 리멘트',
  updated_at = now()
WHERE name = '스마일' OR slug = 'stationery';

-- 7. 산리오 카테고리 설명 업데이트
UPDATE categories 
SET 
  description = '헬로키티, 마이멜로디, 쿠로미, 시나모롤, 폼폼푸린, 포차코, 한교동 등 캐릭터 굿즈',
  updated_at = now()
WHERE slug = 'sanrio';

-- 변경 확인
SELECT id, name, slug, description, updated_at 
FROM categories 
WHERE name IN ('치이카와', '모프샌드', '유키오', '짱구', '반다이', '가차,리멘트', '산리오')
   OR slug IN ('sanrio', 'character', 'phone-strap', 'keyring', 'fashion', 'bear', 'stationery')
ORDER BY sort_order, name;

