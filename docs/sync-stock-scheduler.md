---
title: Smartstore Stock Scheduler (Windows)
description: Windows 작업 스케줄러로 4시간마다 재고 동기화 호출
---

# 스마트스토어 재고 동기화 스케줄러 (Windows)

이 문서는 **Windows 작업 스케줄러**를 이용해
`/api/admin/sync-stock`를 **4시간마다 호출**하는 방법을 설명합니다.

## 1) 준비물

- 서버에서 실행 중인 Next.js 앱 (예: `http://localhost:3000`)
- 환경 변수 `ADMIN_SYNC_SECRET` 설정
- 스케줄러 스크립트: `scripts/sync-stock-scheduler.ps1`

## 2) 환경 변수 설정 (서버)

1. Windows 검색 → **환경 변수** 입력 → “시스템 환경 변수 편집”
2. “환경 변수” 버튼 클릭
3. **시스템 변수**에서 새로 만들기:
   - 변수 이름: `ADMIN_SYNC_SECRET`
   - 변수 값: (관리자 시크릿 값)
4. **서버 재시작** (환경 변수 반영)

## 3) PowerShell 스크립트 위치 확인

다음 파일이 있는지 확인합니다:

```
D:\MVP\ttottoangseumall\scripts\sync-stock-scheduler.ps1
```

## 4) 작업 스케줄러 등록 (4시간마다)

1. Windows 검색 → **작업 스케줄러** 실행
2. 오른쪽 “작업 만들기…” 클릭
3. **일반** 탭
   - 이름: `Smartstore Stock Sync (4h)`
   - “사용자가 로그온하지 않아도 실행” 체크 권장
4. **트리거** 탭 → “새로 만들기…”
   - 시작: “예약됨”
   - 설정: “매일”
   - “작업 반복” 체크
   - 반복 간격: **4시간**
   - 기간: **무기한**
5. **작업** 탭 → “새로 만들기…”
   - 프로그램/스크립트:
     ```
     powershell.exe
     ```
   - 인수 추가:
     ```
     -NoProfile -ExecutionPolicy Bypass -File "D:\MVP\ttottoangseumall\scripts\sync-stock-scheduler.ps1" -BaseUrl "http://localhost:3000"
     ```
   - 시작 위치:
     ```
     D:\MVP\ttottoangseumall
     ```
6. 저장 후 완료

## 5) 정상 동작 확인

작업 스케줄러에서 해당 작업을 **우클릭 → 실행**해보고,
응답 로그에 `재고 동기화 성공`이 뜨는지 확인하세요.

## 6) 서버 주소가 다른 경우

도메인이나 포트가 다르면 `-BaseUrl`만 변경하면 됩니다.

예:
```
-BaseUrl "https://your-domain.com"
```
