-- 카테고리명 변경
-- 1. "핸드폰줄" → "모프샌드"
-- 2. "완구문구" → "가차,리멘트" (이미 변경되었을 수 있지만 안전하게 처리)

-- 1. "핸드폰줄" → "모프샌드"
UPDATE categories 
SET 
  name = '모프샌드',
  updated_at = now()
WHERE name = '핸드폰줄';

-- 2. "완구문구" → "가차,리멘트" (이미 변경되었을 수 있지만 안전하게 처리)
UPDATE categories 
SET 
  name = '가차,리멘트',
  description = '다양한 캡슐토이와 리멘트',
  updated_at = now()
WHERE name = '완구문구';

-- 변경 확인
SELECT id, name, slug, description, updated_at 
FROM categories 
WHERE name IN ('모프샌드', '가차,리멘트')
ORDER BY name;

