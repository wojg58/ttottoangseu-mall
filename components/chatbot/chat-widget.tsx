/**
 * @file components/chatbot/chat-widget.tsx
 * @description 또또앙스 챗봇 위젯(우측 하단) + Gemini 스트리밍 채팅 UI
 *
 * 주요 기능:
 * - 우측 하단 캐릭터 버튼(플로팅)
 * - 클릭 시 Dialog로 채팅창 표시
 * - 로그인한 사용자만 채팅 가능 (비로그인은 로그인 유도)
 * - 서버 SSE 스트림(`/api/chat/stream`)을 읽어 토큰을 실시간으로 렌더링
 * - 상담 연결 버튼 2개(새 탭): 네이버톡톡/카카오톡 (URL은 NEXT_PUBLIC_* env로 주입)
 *
 * @dependencies
 * - Clerk: useAuth (로그인 여부)
 * - shadcn/ui: Dialog, Button, Input
 */

"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatRole = "user" | "assistant";

interface UiMessage {
  id: string;
  role: ChatRole;
  content: string;
  isStreaming?: boolean;
}

function safeUuid() {
  // 클라이언트에서만 실행되므로 crypto.randomUUID() 사용 가능
  if (typeof window !== "undefined" && typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // 폴백: 클라이언트에서만 실행되므로 Date.now()와 Math.random() 사용 가능
  return `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function parseSseChunk(buffer: string) {
  const events: Array<{ event: string; data: string }> = [];
  let rest = buffer;

  while (true) {
    const idx = rest.indexOf("\n\n");
    if (idx === -1) break;

    const raw = rest.slice(0, idx);
    rest = rest.slice(idx + 2);

    let event = "message";
    let data = "";
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.replace("event:", "").trim();
      if (line.startsWith("data:")) data += line.replace("data:", "").trim();
    }
    if (data) events.push({ event, data });
  }

  return { events, rest };
}

/**
 * 메시지 내용을 포맷팅하여 가독성을 높입니다.
 * 마침표(.) 뒤에 줄바꿈을 추가합니다.
 */
function formatMessageContent(content: string): string {
  // 마침표 뒤에 공백이 있으면 줄바꿈으로 변경
  // 단, 이미 줄바꿈이 있거나 연속된 마침표(예: ...)는 제외
  return content
    .replace(/\.\s+/g, ".\n")
    .replace(/\.\n\n+/g, ".\n") // 연속된 줄바꿈은 하나로
    .trim();
}

export function ChatWidget() {
  const { isSignedIn } = useAuth();

  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [hasShownGreeting, setHasShownGreeting] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const signInUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || "/sign-in";
  }, []);

  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId;

    console.group("[ChatWidget] ensureSession");
    try {
      const res = await fetch("/api/chat/session", { method: "POST" });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as unknown;
        console.error("Failed to create session:", res.status, payload);
        throw new Error("세션 생성에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }

      const data = (await res.json()) as { sessionId: string };
      console.log("Created sessionId:", data.sessionId);
      setSessionId(data.sessionId);
      return data.sessionId;
    } finally {
      console.groupEnd();
    }
  }, [sessionId]);

  const appendMessage = useCallback((msg: UiMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // 챗봇 창이 처음 열릴 때 인사말 자동 추가
  useEffect(() => {
    if (!open || !isSignedIn) {
      // 창이 닫히면 인사말 표시 상태 초기화
      if (!open) {
        setHasShownGreeting(false);
      }
      return;
    }
    if (hasShownGreeting || messages.length > 0) return; // 이미 인사말을 보여줬거나 메시지가 있으면 추가하지 않음

    const greeting: UiMessage = {
      id: safeUuid(), // 안전한 UUID 생성 함수 사용
      role: "assistant",
      content: `두근두근 설렘 가득한 또또앙스 쇼핑몰에 오신 걸 환영해요! 💕

상품 문의, 배송·교환, 추천까지 도와드릴게요

궁금한 점을 편하게 말씀해 주세요.`,
    };

    appendMessage(greeting);
    setHasShownGreeting(true);
  }, [open, isSignedIn, messages.length, hasShownGreeting, appendMessage]);

  useEffect(() => {
    if (!open) return;
    // open 시 스크롤 하단 고정
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [open, messages.length]);

  const updateLastAssistant = useCallback((delta: string, done?: boolean) => {
    setMessages((prev) => {
      const next = [...prev];
      const idx = [...next].reverse().findIndex((m) => m.role === "assistant");
      if (idx === -1) return prev;
      const realIdx = next.length - 1 - idx;
      const target = next[realIdx];
      next[realIdx] = {
        ...target,
        content: target.content + delta,
        isStreaming: done ? false : target.isStreaming,
      };
      return next;
    });
  }, []);

  const startStream = useCallback(
    async (sid: string, text: string) => {
      console.group("[ChatWidget] startStream");
      console.log("sessionId:", sid);
      console.log("messageLength:", text.length);

      const assistantId = safeUuid();
      appendMessage({ id: assistantId, role: "assistant", content: "", isStreaming: true });

      setIsSending(true);
      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid, message: text }),
        });

        if (!res.ok || !res.body) {
          const payload = (await res.json().catch(() => null)) as unknown;
          console.error("Stream request failed:", res.status, payload);
          updateLastAssistant("\n\n(오류) 답변을 가져오지 못했어요.", true);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parsed = parseSseChunk(buffer);
          buffer = parsed.rest;

          for (const evt of parsed.events) {
            if (evt.event === "token") {
              const { delta } = JSON.parse(evt.data) as { delta: string };
              if (delta) updateLastAssistant(delta);
            }
            if (evt.event === "done") {
              updateLastAssistant("", true);
            }
            if (evt.event === "error") {
              const { message } = JSON.parse(evt.data) as { message: string };
              updateLastAssistant(`\n\n(오류) ${message}`, true);
            }
          }
        }
      } catch (e) {
        console.error("Stream error:", e);
        updateLastAssistant("\n\n(오류) 스트리밍 중 문제가 발생했어요.", true);
      } finally {
        setIsSending(false);
        console.groupEnd();
      }
    },
    [appendMessage, updateLastAssistant],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    if (!isSignedIn) return;
    if (isSending) return;

    console.group("[ChatWidget] handleSend");
    try {
      setInput("");
      // 전송 후 textarea 높이 초기화
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      appendMessage({ id: safeUuid(), role: "user", content: text });
      const sid = await ensureSession();
      await startStream(sid, text);
    } catch (e) {
      console.error("Send failed:", e);
      appendMessage({
        id: safeUuid(),
        role: "assistant",
        content: "세션을 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
    } finally {
      console.groupEnd();
    }
  }, [appendMessage, ensureSession, input, isSending, isSignedIn, startStream]);

  return (
    <>
      {/* Floating Button */}
      <button
        type="button"
        className="fixed bottom-0 right-0 md:bottom-6 md:right-6 z-50 w-[120px] h-[120px] md:w-[150px] md:h-[150px] transition-all duration-300 ease-out flex items-center justify-center bg-transparent hover:opacity-90 hover:scale-110 hover:rotate-12 active:scale-95 p-0 m-0"
        onClick={() => {
          console.log("[ChatWidget] open");
          setOpen(true);
        }}
        aria-label="또또앙스 챗봇 열기"
      >
        <Image 
          src="/chatbot.png" 
          alt="또또앙스 챗봇" 
          width={150} 
          height={150} 
          priority 
          sizes="(max-width: 768px) 120px, 150px"
          className="w-full h-full transition-transform duration-300 object-contain"
        />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-32px)] md:w-[430px] h-[730px] max-w-none p-0 overflow-hidden fixed right-4 md:right-6 bottom-4 md:bottom-6 top-auto left-auto translate-x-0 translate-y-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <DialogHeader className="px-4 py-3 bg-[#ffeef5] border-b border-pink-100">
            <DialogTitle className="text-[#4a3f48]">또또앙스 상담 챗봇</DialogTitle>
          </DialogHeader>

          <div className="px-4 py-3 flex flex-col gap-3">
            {!isSignedIn ? (
              <div className="rounded-lg border border-pink-100 bg-white p-3 text-sm text-[#4a3f48]">
                <p className="font-medium mb-2">로그인한 사용자만 챗봇을 사용할 수 있어요.</p>
                <Button asChild className="w-full">
                  <Link href={signInUrl}>로그인 하러가기</Link>
                </Button>
              </div>
            ) : (
              <>
                {/* Messages */}
                 <div
                   ref={listRef}
                   className="h-[580px] overflow-y-auto rounded-lg border border-pink-100 bg-white p-3 space-y-3"
                 >
                   {messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.role === "user"
                          ? "flex justify-end"
                          : "flex justify-start"
                      }
                    >
                      <div
                        className={
                          m.role === "user"
                            ? "max-w-[80%] rounded-2xl px-3 py-2 bg-[#ff6b9d] text-white text-sm whitespace-pre-wrap"
                            : "max-w-[80%] rounded-2xl px-3 py-2 bg-[#ffeef5] text-[#4a3f48] text-sm whitespace-pre-wrap"
                        }
                      >
                        {m.role === "assistant" && m.content
                          ? formatMessageContent(m.content)
                          : m.content || (m.isStreaming ? "..." : "")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Input */}
                <div className="flex gap-2 items-end">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      // 입력 내용에 따라 높이 자동 조절
                      const textarea = e.target;
                      textarea.style.height = "auto";
                      textarea.style.height = `${textarea.scrollHeight}px`;
                    }}
                    placeholder="메시지를 입력하세요"
                    disabled={isSending}
                    rows={1}
                    className="resize-none min-h-[40px] max-h-[200px] overflow-y-auto"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                  />
                  <Button onClick={() => void handleSend()} disabled={isSending || !input.trim()}>
                    전송
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


