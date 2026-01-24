/**
 * @file app/debug-auth/page.tsx
 * @description 인증 상태 진단 페이지
 *
 * 현재 로그인 상태와 관리자 권한을 확인할 수 있는 디버깅 페이지
 */

import { currentUser } from "@clerk/nextjs/server";
import { isAdmin } from "@/actions/admin";
import { logger } from "@/lib/logger";
import Link from "next/link";

export default async function DebugAuthPage() {
  logger.info("[DebugAuthPage] 인증 상태 진단 시작");

  const user = await currentUser();
  const adminStatus = await isAdmin();

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">인증 상태 진단</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">1. 로그인 상태</h2>
          {user ? (
            <div className="space-y-2">
              <p className="text-green-600">✅ 로그인됨</p>
              <div className="bg-gray-100 p-4 rounded">
                <p><strong>User ID:</strong> {user.id}</p>
                <p><strong>이메일:</strong> {user.emailAddresses?.[0]?.emailAddress || "없음"}</p>
                <p><strong>이름:</strong> {user.firstName} {user.lastName}</p>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-red-600">❌ 로그인되지 않음</p>
              <p className="mt-2 text-gray-600">
                <Link href="/sign-in" className="text-blue-600 underline">
                  로그인 페이지로 이동
                </Link>
              </p>
            </div>
          )}
        </div>

        {user && (
          <>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">2. 사용자 메타데이터</h2>
              <div className="bg-gray-100 p-4 rounded">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(
                    {
                      publicMetadata: user.publicMetadata,
                      privateMetadata: user.privateMetadata ? "(비공개)" : null,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">3. 관리자 권한 확인</h2>
              {adminStatus ? (
                <div>
                  <p className="text-green-600 text-lg font-semibold">✅ 관리자 권한 있음</p>
                  <p className="mt-2 text-gray-600">
                    <a href="/admin" className="text-blue-600 underline">
                      관리자 페이지로 이동
                    </a>
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-red-600 text-lg font-semibold">❌ 관리자 권한 없음</p>
                  <div className="mt-4 space-y-2">
                    <p className="font-semibold">관리자 권한을 얻는 방법:</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                      <li>
                        <strong>Clerk Role 설정:</strong> Clerk Dashboard에서 사용자에게 &quot;admin&quot; role 부여
                      </li>
                      <li>
                        <strong>Public Metadata 설정:</strong> Clerk Dashboard에서 사용자의 publicMetadata에
                        {" "}
                        <code className="bg-gray-200 px-1 rounded">{"{ \"isAdmin\": true }"}</code> 또는
                        {" "}
                        <code className="bg-gray-200 px-1 rounded">{"{ \"role\": \"admin\" }"}</code> 추가
                      </li>
                      <li>
                        <strong>이메일 기반 (하위 호환성):</strong> 환경 변수 ADMIN_EMAILS에 이메일 추가
                      </li>
                    </ol>
                    <p className="mt-4 text-sm text-gray-600">
                      현재 이메일: <strong>{user.emailAddresses?.[0]?.emailAddress || "없음"}</strong>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">4. 이메일 주소 목록</h2>
              <div className="bg-gray-100 p-4 rounded">
                <ul className="space-y-1">
                  {user.emailAddresses?.map((email, idx) => (
                    <li key={idx}>
                      {email.emailAddress}
                      {email.id === user.primaryEmailAddressId && (
                        <span className="ml-2 text-blue-600">(기본)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">5. 빠른 링크</h2>
          <div className="space-y-2">
            <p>
              <Link href="/sign-in" className="text-blue-600 underline">
                로그인 페이지
              </Link>
            </p>
            <p>
              <Link href="/admin" className="text-blue-600 underline">
                관리자 페이지
              </Link>
            </p>
            <p>
              <Link href="/" className="text-blue-600 underline">
                홈페이지
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
