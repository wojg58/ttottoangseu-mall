-- 카테고리명 변경: "완구문구" → "가차,리멘트"

UPDATE categories 
SET 
  name = '가차,리멘트',
  description = '다양한 캡슐토이와 리멘트',
  updated_at = now()
WHERE name = '완구문구';

-- 변경 확인
SELECT id, name, slug, description, updated_at 
FROM categories 
WHERE name = '가차,리멘트';

