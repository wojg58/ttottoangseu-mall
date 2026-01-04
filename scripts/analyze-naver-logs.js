const fs = require('fs');

// 파일 읽기
const content = fs.readFileSync('네이버로그인검증', 'utf8');

// JSON 배열 찾기 (마지막 부분)
const jsonStart = content.lastIndexOf('[');
if (jsonStart === -1) {
  console.log('JSON 로그를 찾을 수 없습니다.');
  process.exit(1);
}

// JSON 부분 추출 시도
let jsonStr = content.substring(jsonStart);
// 불완전한 JSON일 수 있으므로 마지막 ] 찾기
const jsonEnd = jsonStr.lastIndexOf(']');
if (jsonEnd !== -1) {
  jsonStr = jsonStr.substring(0, jsonEnd + 1);
}

try {
  const logs = JSON.parse(jsonStr);
  
  // 네이버 로그인 관련 키워드로 필터링
  const keywords = [
    'auth', 'oauth', 'session', 'naver', '네이버', '콜백', 
    '동기화', 'clerk', '세션', '로그인', 'signin', 'sign-in',
    'external', 'account', 'user', '사용자', 'sync'
  ];
  
  const naverLogs = logs.filter(log => {
    const msg = (log.message || '').toLowerCase();
    return keywords.some(keyword => msg.includes(keyword.toLowerCase()));
  });
  
  console.log(`\n📋 총 ${logs.length}개 로그 중 네이버 로그인 관련 로그: ${naverLogs.length}개\n`);
  
  if (naverLogs.length === 0) {
    console.log('❌ 네이버 로그인 관련 로그를 찾을 수 없습니다.');
    console.log('\n💡 다음을 확인해주세요:');
    console.log('   1. 실제로 네이버 로그인을 시도했는지 확인');
    console.log('   2. 브라우저 콘솔에서 getStoredLogs() 실행하여 최신 로그 확인');
    console.log('   3. localStorage.getItem("oauth_callback_logs") 확인');
  } else {
    console.log('✅ 네이버 로그인 관련 로그 발견:\n');
    naverLogs.forEach((log, index) => {
      console.log(`--- 로그 ${index + 1} ---`);
      console.log(`시간: ${log.timestamp}`);
      console.log(`레벨: ${log.level}`);
      console.log(`메시지: ${log.message}`);
      if (log.args && log.args.length > 0) {
        console.log(`인자: ${JSON.stringify(log.args, null, 2).substring(0, 200)}...`);
      }
      console.log('');
    });
  }
  
  // AuthSessionSync 관련 로그만 따로 추출
  const authSessionLogs = logs.filter(log => {
    const msg = (log.message || '').toLowerCase();
    return msg.includes('authsessionsync') || msg.includes('oauth 콜백');
  });
  
  if (authSessionLogs.length > 0) {
    console.log(`\n🔍 AuthSessionSync 관련 로그: ${authSessionLogs.length}개\n`);
    authSessionLogs.forEach((log, index) => {
      console.log(`[${index + 1}] ${log.timestamp}`);
      console.log(`   ${log.message}`);
      console.log('');
    });
  }
  
} catch (error) {
  console.error('JSON 파싱 에러:', error.message);
  console.log('\n파일의 마지막 부분을 확인해주세요.');
  console.log('JSON이 잘못되었거나 불완전할 수 있습니다.');
}

