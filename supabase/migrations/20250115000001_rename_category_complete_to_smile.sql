-- 카테고리명 변경: "완구문구" → "스마일"

UPDATE categories 
SET 
  name = '스마일',
  updated_at = now()
WHERE name = '완구문구';

-- 변경 확인
SELECT id, name, slug, updated_at 
FROM categories 
WHERE name = '스마일';

