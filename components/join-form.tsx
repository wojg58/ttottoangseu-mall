/**
 * @file components/join-form.tsx
 * @description 회원가입 메인 폼 컴포넌트
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { saveMemberAdditionalInfo } from "@/actions/member-actions";
import logger from "@/lib/logger";
import type { Gender } from "@/types/member";

// 비밀번호 찾기 질문 목록
const PASSWORD_HINTS = [
  { value: "hint_01", label: "기억에 남는 추억의 장소는?" },
  { value: "hint_02", label: "자신의 인생 좌우명은?" },
  { value: "hint_03", label: "자신의 보물 제1호는?" },
  { value: "hint_04", label: "가장 기억에 남는 선생님 성함은?" },
  { value: "hint_05", label: "타인이 모르는 자신만의 신체비밀이 있다면?" },
];

// 유효성 검사 스키마
const joinSchema = z
  .object({
    // 회원 구분 (기본값: 개인회원)
    member_type: z.enum(["p", "c", "f"]).default("p"),
    company_type: z.enum(["p", "c"]).optional(),

    // 기본 정보
    email: z.string().email("올바른 이메일 주소를 입력해주세요."),
    password: z
      .string()
      .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
      .max(16, "비밀번호는 최대 16자까지 가능합니다.")
      .regex(
        /^(?=.*[a-zA-Z])(?=.*\d)|(?=.*[a-zA-Z])(?=.*[!@#$%^&*()])|(?=.*\d)(?=.*[!@#$%^&*()])/,
        "영문/숫자/특수문자 중 2가지 이상 조합이 필요합니다."
      ),
    password_confirm: z.string(),
    hint: z.string().min(1, "비밀번호 찾기 질문을 선택해주세요."),
    hint_answer: z.string().min(1, "비밀번호 찾기 답변을 입력해주세요."),
    name: z.string().min(1, "이름을 입력해주세요."),

    // 주소
    postcode: z.string().min(1, "우편번호를 입력해주세요."),
    addr1: z.string().min(1, "기본 주소를 입력해주세요."),
    addr2: z.string().min(1, "나머지 주소를 입력해주세요."),

    // 연락처
    phone: z.string().optional(),
    mobile: z
      .string()
      .min(10, "휴대전화 번호를 입력해주세요.")
      .regex(/^[0-9-]+$/, "숫자와 하이픈(-)만 입력 가능합니다."),

    // 추가 정보
    gender: z.enum(["M", "F"]).optional(),
    birth_year: z.string().optional(),
    birth_month: z.string().optional(),
    birth_day: z.string().optional(),
    is_solar_calendar: z.boolean().default(true),

    // 약관 동의
    agree_service: z.boolean().refine((val) => val === true, {
      message: "이용약관에 동의해주세요.",
    }),
    is_sms: z.boolean().default(false),
    is_news_mail: z.boolean().default(false),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["password_confirm"],
  });

type JoinFormData = z.infer<typeof joinSchema>;

export default function JoinForm() {
  const router = useRouter();
  const { signUp, setActive } = useSignUp();
  const [isLoading, setIsLoading] = useState(false);
  const [agreeAll, setAgreeAll] = useState(false);
  const [isPostcodeReady, setIsPostcodeReady] = useState(false);
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);
  const postcodeRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      member_type: "p",
      is_solar_calendar: true,
      agree_service: false,
      is_sms: false,
      is_news_mail: false,
    },
  });

  const agreeService = watch("agree_service");
  const isSms = watch("is_sms");
  const isNewsMail = watch("is_news_mail");

  // 전체 동의 처리
  const handleAgreeAll = (checked: boolean) => {
    setAgreeAll(checked);
    setValue("agree_service", checked);
    setValue("is_sms", checked);
    setValue("is_news_mail", checked);
  };

  // Daum Postcode API 스크립트 로드
  useEffect(() => {
    // 이미 스크립트가 로드되어 있는지 확인
    if (window.daum) {
      logger.debug("[JoinForm] Daum Postcode API가 이미 로드되어 있습니다");
      setIsPostcodeReady(true);
      return;
    }

    // 이미 스크립트 태그가 있는지 확인
    const existingScript = document.querySelector(
      'script[src*="postcode.v2.js"]'
    );
    if (existingScript) {
      logger.debug("[JoinForm] Daum Postcode API 스크립트 태그가 이미 존재합니다");
      // 스크립트가 로드될 때까지 대기
      const checkInterval = setInterval(() => {
        if (window.daum) {
          logger.debug("[JoinForm] Daum Postcode API 로드 완료 확인");
          setIsPostcodeReady(true);
          clearInterval(checkInterval);
        }
      }, 100);

      // 최대 10초 대기
      setTimeout(() => {
        clearInterval(checkInterval);
        if (window.daum) {
          setIsPostcodeReady(true);
        } else {
          logger.error("[JoinForm] Daum Postcode API 로드 타임아웃");
        }
      }, 10000);

      return () => clearInterval(checkInterval);
    }

    // 새 스크립트 생성 및 로드
    const script = document.createElement("script");
    script.src =
      "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;

    script.onload = () => {
      logger.debug("[JoinForm] Daum Postcode API 스크립트 로드 완료");
      setIsPostcodeReady(true);
    };

    script.onerror = () => {
      logger.error("[JoinForm] Daum Postcode API 스크립트 로드 실패");
      setIsPostcodeReady(false);
    };

    document.head.appendChild(script);
    logger.debug("[JoinForm] Daum Postcode API 스크립트 로드 시작");

    return () => {
      // 컴포넌트 언마운트 시 스크립트 제거 (다른 곳에서 사용 중이 아닐 때만)
      if (document.head.contains(script)) {
        // 다른 컴포넌트에서 사용 중인지 확인
        const otherScripts = document.querySelectorAll(
          'script[src*="postcode.v2.js"]'
        );
        if (otherScripts.length === 1) {
          document.head.removeChild(script);
        }
      }
    };
  }, []);

  // Daum 우편번호 검색
  const openPostcode = () => {
    if (typeof window === "undefined") return;

    // 스크립트가 아직 로드되지 않았으면 재시도 로직
    if (!window.daum || !isPostcodeReady) {
      logger.warn("[JoinForm] Daum Postcode API가 아직 로드되지 않았습니다. 재시도 중...");
      
      // 최대 3초간 재시도
      let retryCount = 0;
      const maxRetries = 30; // 100ms * 30 = 3초
      
      const retryInterval = setInterval(() => {
        retryCount++;
        
        if (window.daum) {
          logger.debug("[JoinForm] Daum Postcode API 로드 완료, 주소 검색 모달 열기");
          clearInterval(retryInterval);
          setIsPostcodeReady(true);
          setIsPostcodeOpen(true);
        } else if (retryCount >= maxRetries) {
          logger.error("[JoinForm] Daum Postcode API 로드 실패 (재시도 한도 초과)");
          clearInterval(retryInterval);
          alert("주소 검색 서비스를 불러올 수 없습니다. 페이지를 새로고침한 후 다시 시도해주세요.");
        }
      }, 100);

      return;
    }

    logger.debug("[JoinForm] 주소 검색 모달 열기");
    setIsPostcodeOpen(true);
  };

  // 모달이 열릴 때 주소 검색 UI를 embed
  useEffect(() => {
    if (!isPostcodeOpen || !window.daum) {
      return;
    }

    // Dialog가 렌더링되기를 기다림 (DOM이 준비되도록)
    const timer = setTimeout(() => {
      logger.debug("[JoinForm] useEffect 실행 (타이머 후)", {
        isPostcodeOpen,
        hasPostcodeRef: !!postcodeRef.current,
        hasDaumAPI: !!window.daum,
      });

      if (!postcodeRef.current) {
        logger.error("[JoinForm] postcodeRef.current가 여전히 null입니다");
        return;
      }

      logger.debug("[JoinForm] 주소 검색 UI embed 시작");

      try {
        const postcode = new window.daum.Postcode({
          oncomplete: function (data: any) {
            logger.group("[JoinForm] 주소 선택 완료");
            logger.debug("우편번호:", data.zonecode);
            logger.debug("주소:", data.address);
            logger.debug("주소 타입:", data.addressType);
            logger.debug("도로명 주소:", data.roadAddress);
            logger.debug("지번 주소:", data.jibunAddress);
            logger.groupEnd();

            // 도로명 주소 우선, 없으면 지번 주소 사용
            const address = data.addressType === 'R' ? data.roadAddress : data.jibunAddress;
            
            setValue("postcode", data.zonecode);
            setValue("addr1", address || data.address);
            trigger(["postcode", "addr1"]);
            
            // 주소 선택 후 모달 닫기
            setIsPostcodeOpen(false);
          },
          onresize: function (size: { width: number; height: number }) {
            logger.debug("[JoinForm] UI 크기 변경:", size);
          },
          onclose: function (state: 'COMPLETE' | 'FORCE_CLOSE') {
            logger.debug("[JoinForm] UI 닫힘:", state);
            setIsPostcodeOpen(false);
          },
          width: '100%',
          height: '100%',
        });
        
        // 모달 내부에 주소 검색 UI 삽입
        postcode.embed(postcodeRef.current);
        logger.debug("[JoinForm] 주소 검색 UI embed 완료");
      } catch (error: any) {
        logger.error("[JoinForm] 주소 검색 UI embed 실패:", error);
        alert("주소 검색을 불러올 수 없습니다. 페이지를 새로고침한 후 다시 시도해주세요.");
        setIsPostcodeOpen(false);
      }
    }, 100); // DOM 렌더링을 위해 100ms 대기

    return () => clearTimeout(timer);
  }, [isPostcodeOpen, setValue, trigger]);

  // 폼 제출
  const onSubmit = async (data: JoinFormData) => {
    logger.group("[JoinForm] 회원가입 시작");
    logger.debug("[JoinForm] 폼 데이터:", data);

    setIsLoading(true);

    try {
      // 1단계: Clerk 회원가입
      logger.debug("[JoinForm] 1단계: Clerk 회원가입");

      if (!signUp) {
        throw new Error("Clerk SignUp이 초기화되지 않았습니다.");
      }

      // CAPTCHA 우회를 위한 옵션 (개발 환경)
      const signUpOptions: any = {
        emailAddress: data.email,
        password: data.password,
        firstName: data.name,
      };

      // 개발 환경에서는 CAPTCHA를 우회
      if (process.env.NODE_ENV === "development") {
        logger.debug("[JoinForm] 개발 환경: CAPTCHA 우회 시도");
        signUpOptions.unsafeMetadata = {
          skipCaptcha: true,
        };
      }

      logger.debug("[JoinForm] SignUp 옵션:", signUpOptions);
      const result = await signUp.create(signUpOptions);

      logger.debug("[JoinForm] Clerk 회원가입 완료:", result);

      // 2단계: 이메일 인증 코드 전송
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      logger.debug("[JoinForm] 이메일 인증 코드 전송 완료");

      // 3단계: Supabase에 추가 정보 저장 (세션 활성화 후)
      if (result.createdSessionId) {
        await setActive({ session: result.createdSessionId });

        logger.debug("[JoinForm] 2단계: Supabase 추가 정보 저장");

        // 생년월일 조합
        let birth_date: string | undefined;
        if (data.birth_year && data.birth_month && data.birth_day) {
          birth_date = `${data.birth_year}-${data.birth_month.padStart(
            2,
            "0"
          )}-${data.birth_day.padStart(2, "0")}`;
        }

        const saveResult = await saveMemberAdditionalInfo({
          member_type: data.member_type,
          company_type: data.company_type,
          hint: data.hint,
          hint_answer: data.hint_answer,
          postcode: data.postcode,
          addr1: data.addr1,
          addr2: data.addr2,
          phone: data.phone,
          mobile: data.mobile,
          gender: data.gender,
          birth_date: birth_date,
          is_solar_calendar: data.is_solar_calendar,
          is_sms: data.is_sms,
          is_news_mail: data.is_news_mail,
        });

        if (!saveResult.success) {
          logger.error("[JoinForm] 추가 정보 저장 실패:", saveResult.error);
        } else {
          logger.debug("[JoinForm] 추가 정보 저장 완료");
        }
      }

      logger.debug("[JoinForm] 회원가입 완료");
      logger.groupEnd();

      // 이메일 인증 페이지로 이동
      router.push(`/sign-up/verify-email?email=${encodeURIComponent(data.email)}`);
    } catch (error: any) {
      logger.error("[JoinForm] 회원가입 에러:", error);
      logger.groupEnd();

      // CAPTCHA 에러 특별 처리
      const errorMessage = error.errors?.[0]?.message || error.message || "";
      const isCaptchaError = errorMessage.toLowerCase().includes("captcha");

      if (isCaptchaError) {
        alert(
          "봇 방지 검증 중 오류가 발생했습니다.\n\n" +
          "개발 환경에서는 Clerk Dashboard의 Bot Protection 설정을 확인해주세요.\n" +
          "또는 페이지를 새로고침한 후 다시 시도해주세요."
        );
      } else {
        alert(
          error.errors?.[0]?.message ||
            error.message ||
            "회원가입 중 오류가 발생했습니다."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* ===== 기본 정보 섹션 ===== */}
        <section>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h2 className="text-xl font-bold">기본정보</h2>
            <p className="text-sm text-gray-600 mt-1">
              <span className="text-red-500">*</span> 필수입력사항
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full border-collapse">
              <colgroup>
                <col style={{ width: "190px" }} />
                <col style={{ width: "auto" }} />
              </colgroup>
              <tbody>
                {/* 이메일 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      이메일
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <Input
                      id="email"
                      type="email"
                      placeholder="example@email.com"
                      {...register("email")}
                      className={`w-full ${errors.email ? "border-red-500" : ""}`}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.email.message}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      로그인 아이디로 사용할 이메일을 입력해 주세요.
                    </p>
                  </td>
                </tr>

                {/* 비밀번호 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      비밀번호
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <Input
                      id="password"
                      type="password"
                      placeholder="비밀번호를 입력해주세요"
                      {...register("password")}
                      className={`w-full ${errors.password ? "border-red-500" : ""}`}
                    />
                    {errors.password && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.password.message}
                      </p>
                    )}
                    <p className="text-sm text-gray-500 mt-1">
                      영문/숫자/특수문자 중 2가지 이상 조합, 8자~16자
                    </p>
                  </td>
                </tr>

                {/* 비밀번호 확인 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      비밀번호 확인
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <Input
                      id="password_confirm"
                      type="password"
                      placeholder="비밀번호를 다시 입력해주세요"
                      {...register("password_confirm")}
                      className={`w-full ${errors.password_confirm ? "border-red-500" : ""}`}
                    />
                    {errors.password_confirm && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.password_confirm.message}
                      </p>
                    )}
                  </td>
                </tr>

                {/* 비밀번호 찾기 질문 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      비밀번호 확인 질문
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <Select
                      value={watch("hint")}
                      onValueChange={(value) => setValue("hint", value)}
                    >
                      <SelectTrigger className={errors.hint ? "border-red-500" : ""}>
                        <SelectValue placeholder="질문을 선택해주세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {PASSWORD_HINTS.map((hint) => (
                          <SelectItem key={hint.value} value={hint.value}>
                            {hint.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.hint && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.hint.message}
                      </p>
                    )}
                  </td>
                </tr>

                {/* 비밀번호 찾기 답변 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      비밀번호 확인 답변
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <Input
                      id="hint_answer"
                      type="text"
                      placeholder="답변을 입력해주세요"
                      {...register("hint_answer")}
                      className={`w-full ${errors.hint_answer ? "border-red-500" : ""}`}
                    />
                    {errors.hint_answer && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.hint_answer.message}
                      </p>
                    )}
                  </td>
                </tr>

                {/* 이름 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      이름
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <Input
                      id="name"
                      type="text"
                      placeholder="이름을 입력해주세요"
                      {...register("name")}
                      className={`w-full ${errors.name ? "border-red-500" : ""}`}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                    )}
                  </td>
                </tr>

                {/* 성별 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      성별
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <RadioGroup
                      value={watch("gender") || ""}
                      onValueChange={(value) => setValue("gender", value as Gender)}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="M" id="gender-male" />
                        <Label htmlFor="gender-male" className="cursor-pointer">
                          남자
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="F" id="gender-female" />
                        <Label htmlFor="gender-female" className="cursor-pointer">
                          여자
                        </Label>
                      </div>
                    </RadioGroup>
                  </td>
                </tr>

                {/* 생년월일 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      생년월일
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 items-center flex-wrap">
                      <Input
                        placeholder="년 (예: 1990)"
                        {...register("birth_year")}
                        maxLength={4}
                        className="w-32"
                      />
                      <span>년</span>
                      <Input
                        placeholder="월 (예: 01)"
                        {...register("birth_month")}
                        maxLength={2}
                        className="w-24"
                      />
                      <span>월</span>
                      <Input
                        placeholder="일 (예: 01)"
                        {...register("birth_day")}
                        maxLength={2}
                        className="w-24"
                      />
                      <span>일</span>
                    </div>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={watch("is_solar_calendar") === true}
                          onChange={() => setValue("is_solar_calendar", true)}
                        />
                        <span>양력</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={watch("is_solar_calendar") === false}
                          onChange={() => setValue("is_solar_calendar", false)}
                        />
                        <span>음력</span>
                      </label>
                    </div>
                  </td>
                </tr>

                {/* 주소 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      주소
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      {/* 우편번호 */}
                      <div className="flex gap-2">
                        <Input
                          placeholder="우편번호"
                          {...register("postcode")}
                          readOnly
                          className={`flex-1 ${errors.postcode ? "border-red-500" : ""}`}
                        />
                        <Button 
                          type="button" 
                          onClick={openPostcode} 
                          variant="outline"
                          disabled={!isPostcodeReady}
                          title={!isPostcodeReady ? "주소 검색 서비스를 불러오는 중..." : "주소 검색"}
                        >
                          {isPostcodeReady ? "주소검색" : "로딩 중..."}
                        </Button>
                      </div>
                      {errors.postcode && (
                        <p className="text-sm text-red-500">
                          {errors.postcode.message}
                        </p>
                      )}

                      {/* 기본 주소 */}
                      <Input
                        placeholder="기본 주소"
                        {...register("addr1")}
                        readOnly
                        className={`w-full ${errors.addr1 ? "border-red-500" : ""}`}
                      />
                      {errors.addr1 && (
                        <p className="text-sm text-red-500">{errors.addr1.message}</p>
                      )}

                      {/* 나머지 주소 */}
                      <Input
                        placeholder="나머지 주소 (상세주소를 입력해주세요)"
                        {...register("addr2")}
                        className={`w-full ${errors.addr2 ? "border-red-500" : ""}`}
                      />
                      {errors.addr2 && (
                        <p className="text-sm text-red-500">{errors.addr2.message}</p>
                      )}
                    </div>
                  </td>
                </tr>

                {/* 휴대전화 */}
                <tr className="border-b border-gray-200">
                  <th className="bg-gray-50 px-4 py-3 text-left font-medium border-r border-gray-200">
                    <span className="flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      휴대전화
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    <Input
                      id="mobile"
                      type="text"
                      placeholder="예: 010-1234-5678"
                      {...register("mobile")}
                      className={`w-full ${errors.mobile ? "border-red-500" : ""}`}
                    />
                    {errors.mobile && (
                      <p className="text-sm text-red-500 mt-1">
                        {errors.mobile.message}
                      </p>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <Separator />

        {/* ===== 약관 동의 섹션 ===== */}
        <section>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h2 className="text-xl font-bold">약관 동의</h2>
          </div>

          <div className="space-y-4">
            {/* 전체 동의 */}
            <div className="p-4 border-2 border-gray-200 rounded-lg">
              <label className="flex items-center gap-3 cursor-pointer">
                <Checkbox
                  checked={agreeAll}
                  onCheckedChange={handleAgreeAll}
                  className="w-5 h-5"
                />
                <span className="font-bold text-lg">
                  모든 약관을 확인하고 전체 동의합니다.
                </span>
              </label>
              <p className="text-sm text-gray-600 mt-2 ml-8">
                (전체 동의는 필수 및 선택 정보에 대한 동의가 포함되어 있습니다.)
              </p>
            </div>

            {/* 이용약관 동의 (필수) */}
            <div className="border rounded-lg p-4">
              <label className="flex items-center gap-3 cursor-pointer mb-2">
                <Checkbox
                  checked={agreeService}
                  onCheckedChange={(checked) =>
                    setValue("agree_service", checked as boolean)
                  }
                  className="w-4 h-4"
                />
                <span className="font-medium">
                  <span className="text-red-500">*</span> 이용약관 동의 (필수)
                </span>
              </label>
              <div className="ml-7 p-3 bg-gray-50 rounded max-h-32 overflow-y-auto text-sm text-gray-700">
                <p>
                  제1조(목적) 이 약관은 또또앙스가 운영하는 쇼핑몰에서 제공하는
                  인터넷 관련 서비스를 이용함에 있어 사이버 몰과 이용자의
                  권리·의무 및 책임사항을 규정함을 목적으로 합니다.
                </p>
                <p className="mt-2">
                  제2조(정의) ① &quot;몰&quot;이란 또또앙스가 재화 또는 용역을 이용자에게
                  제공하기 위하여 컴퓨터 등 정보통신설비를 이용하여 재화 등을
                  거래할 수 있도록 설정한 가상의 영업장을 말합니다.
                </p>
              </div>
              {errors.agree_service && (
                <p className="text-sm text-red-500 mt-2 ml-7">
                  {errors.agree_service.message}
                </p>
              )}
            </div>

            {/* 쇼핑정보 수신 동의 (선택) */}
            <div className="border rounded-lg p-4">
              <div className="font-medium mb-3">쇼핑정보 수신 동의 (선택)</div>
              <div className="space-y-2 ml-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={isSms}
                    onCheckedChange={(checked) =>
                      setValue("is_sms", checked as boolean)
                    }
                    className="w-4 h-4"
                  />
                  <span>SMS 수신 동의</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <Checkbox
                    checked={isNewsMail}
                    onCheckedChange={(checked) =>
                      setValue("is_news_mail", checked as boolean)
                    }
                    className="w-4 h-4"
                  />
                  <span>이메일 수신 동의</span>
                </label>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                할인쿠폰 및 혜택, 이벤트, 신상품 소식 등 쇼핑몰에서 제공하는
                유익한 쇼핑정보를 받아보실 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        {/* 제출 버튼 */}
        <div className="flex gap-3 justify-center pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="px-8"
          >
            취소
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="px-8 bg-shop-rose hover:bg-shop-rose/90"
          >
            {isLoading ? "가입 중..." : "가입하기"}
          </Button>
        </div>
      </form>

      {/* 주소 검색 모달 */}
      <Dialog open={isPostcodeOpen} onOpenChange={setIsPostcodeOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] p-0 bg-white">
          <DialogHeader className="p-4 border-b bg-white">
            <DialogTitle>주소 검색</DialogTitle>
          </DialogHeader>
          <div 
            ref={postcodeRef} 
            className="w-full h-[500px] overflow-auto bg-white"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

