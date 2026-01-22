<#
@file scripts/sync-stock-scheduler.ps1
@description 스마트스토어 재고 동기화 API를 호출하는 스케줄러용 스크립트
@dependencies
  - PowerShell 5+ (Invoke-RestMethod)
  - ADMIN_SYNC_SECRET 환경 변수
  - app/api/admin/sync-stock 엔드포인트
#>

param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$AdminSecret = $env:ADMIN_SYNC_SECRET
)

if (-not $AdminSecret) {
  Write-Error "[ERROR] ADMIN_SYNC_SECRET 환경 변수가 없습니다."
  exit 1
}

$endpoint = "$BaseUrl/api/admin/sync-stock"
$headers = @{
  "x-admin-secret" = $AdminSecret
}

try {
  Write-Host "[INFO] 재고 동기화 요청 시작: $endpoint"
  $response = Invoke-RestMethod -Method Get -Uri $endpoint -Headers $headers -TimeoutSec 600
  $responseJson = $response | ConvertTo-Json -Depth 6
  Write-Host "[INFO] 재고 동기화 응답:" $responseJson

  if (-not $response.success) {
    Write-Error "[ERROR] 재고 동기화 실패: $($response.message)"
    exit 1
  }

  Write-Host "[INFO] 재고 동기화 성공"
  exit 0
} catch {
  Write-Error "[ERROR] 재고 동기화 예외: $($_.Exception.Message)"
  exit 1
}
