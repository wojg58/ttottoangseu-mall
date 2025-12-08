-- 카테고리명 변경
-- 1. "핸드폰줄" → "완구,스티커"
-- 2. "완구문구" → "스마일" (이미 변경되었을 수 있지만 안전하게 처리)

-- 1. "핸드폰줄" → "완구,스티커"
UPDATE categories 
SET 
  name = '완구,스티커',
  updated_at = now()
WHERE name = '핸드폰줄';

-- 2. "완구문구" → "스마일" (이미 변경되었을 수 있지만 안전하게 처리)
UPDATE categories 
SET 
  name = '스마일',
  updated_at = now()
WHERE name = '완구문구';

-- 변경 확인
SELECT id, name, slug, updated_at 
FROM categories 
WHERE name IN ('완구,스티커', '스마일')
ORDER BY name;

