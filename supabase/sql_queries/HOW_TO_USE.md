# Supabase SQL Editor 사용 가이드

## ⚠️ 중요: EXPLAIN 오류 해결 방법

Supabase SQL Editor에서 **"EXPLAIN only works on a single SQL statement"** 오류가 발생하는 이유는 파일에 여러 개의 SQL 문이 포함되어 있기 때문입니다.

## ✅ 올바른 사용 방법

### 방법 1: 필요한 쿼리만 선택해서 실행

1. SQL 파일을 Supabase SQL Editor에 붙여넣습니다.
2. **실행하고 싶은 하나의 SQL 문만 마우스로 선택**합니다.
3. 선택한 부분만 실행하거나 EXPLAIN을 사용합니다.

**예시:**
```sql
-- 이 부분만 선택
SELECT 
    p1.id,
    p1.name,
    p1.slug
FROM products p1
WHERE p1.deleted_at IS NOT NULL;
```

### 방법 2: 단계별로 개별 쿼리 실행

각 SQL 파일은 단계별로 나뉘어 있습니다. 각 단계의 쿼리를 개별적으로 실행하세요.

**예시:**
- `01_restore_soft_deleted_products.sql` 파일에서
  - 단계 1-1만 선택 → 실행
  - 단계 1-2만 선택 → 실행
  - 단계 2만 선택 → 실행

### 방법 3: EXPLAIN 사용 시

EXPLAIN은 **SELECT 쿼리에만** 사용할 수 있습니다.

1. SELECT 쿼리 하나만 선택합니다.
2. EXPLAIN 탭을 클릭합니다.
3. 실행 계획을 확인합니다.

**주의:**
- UPDATE, INSERT, DELETE, CREATE INDEX 등은 EXPLAIN을 사용할 수 없습니다.
- SELECT 쿼리만 EXPLAIN 가능합니다.

## 📝 파일별 사용 가이드

### 01_restore_soft_deleted_products.sql
- **단계 1-1**: SELECT 쿼리 (EXPLAIN 가능)
- **단계 1-2**: UPDATE 쿼리 (EXPLAIN 불가, 실행만 가능)
- **단계 2**: SELECT 쿼리 (EXPLAIN 가능)
- **단계 3-1**: SELECT 쿼리 (EXPLAIN 가능)
- **단계 3-2**: UPDATE 쿼리 (EXPLAIN 불가, 실행만 가능)

### 04_indexes_and_performance.sql
- **단계 1-3, 2-5, 3-4**: CREATE INDEX 쿼리 (EXPLAIN 불가, 실행만 가능)
- **단계 4-1, 4-2, 5-2**: SELECT 쿼리 (EXPLAIN 가능)

### 05_common_queries.sql
- 모든 쿼리가 SELECT이므로 EXPLAIN 가능
- 각 쿼리를 개별적으로 선택해서 실행

## 🎯 빠른 참조

| 쿼리 타입 | EXPLAIN 가능? | 실행 방법 |
|----------|--------------|----------|
| SELECT | ✅ 가능 | 쿼리 선택 → EXPLAIN 탭 클릭 |
| UPDATE | ❌ 불가 | 쿼리 선택 → Run 클릭 |
| INSERT | ❌ 불가 | 쿼리 선택 → Run 클릭 |
| DELETE | ❌ 불가 | 쿼리 선택 → Run 클릭 |
| CREATE INDEX | ❌ 불가 | 쿼리 선택 → Run 클릭 |
| ANALYZE | ❌ 불가 | 쿼리 선택 → Run 클릭 |

## 💡 팁

1. **여러 쿼리 실행**: 각 쿼리를 개별적으로 선택해서 순차적으로 실행
2. **EXPLAIN 사용**: SELECT 쿼리만 선택하고 EXPLAIN 탭 사용
3. **에러 발생 시**: 하나의 SQL 문만 선택했는지 확인
4. **데이터 변경 전**: SELECT 쿼리로 먼저 확인

---

**작성일**: 2026년 1월 10일  
**목적**: Supabase SQL Editor 사용 가이드

