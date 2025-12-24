/**
 * @file components/join-form.tsx
 * @description 회원가입 메인 폼 컴포넌트
 */

"use client";

import { useState } from "react";
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

  // Daum 우편번호 검색
  const openPostcode = () => {
    if (typeof window === "undefined") return;

    // @ts-ignore
    new window.daum.Postcode({
      oncomplete: function (data: any) {
        setValue("postcode", data.zonecode);
        setValue("addr1", data.address);
        trigger(["postcode", "addr1"]);
      },
    }).open();
  };

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

      const result = await signUp.create({
        emailAddress: data.email,
        password: data.password,
        firstName: data.name,
      });

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

      alert(
        error.errors?.[0]?.message ||
          error.message ||
          "회원가입 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Daum 우편번호 서비스 스크립트 */}
      <script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        async
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* ===== 기본 정보 섹션 ===== */}
        <section>
          <div className="space-y-6">
            {/* 이메일 */}
            <div>
              <Label htmlFor="email" className="flex items-center gap-2 mb-2">
                <span className="text-red-500">*</span>
                이메일 (로그인 아이디)
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com"
                {...register("email")}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.email.message}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                로그인 아이디로 사용할 이메일을 입력해 주세요.
              </p>
            </div>

            {/* 비밀번호 */}
            <div>
              <Label htmlFor="password" className="flex items-center gap-2 mb-2">
                <span className="text-red-500">*</span>
                비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호를 입력해주세요"
                {...register("password")}
                className={errors.password ? "border-red-500" : ""}
              />
              {errors.password && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.password.message}
                </p>
              )}
              <p className="text-sm text-gray-500 mt-1">
                영문/숫자/특수문자 중 2가지 이상 조합, 8자~16자
              </p>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <Label
                htmlFor="password_confirm"
                className="flex items-center gap-2 mb-2"
              >
                <span className="text-red-500">*</span>
                비밀번호 확인
              </Label>
              <Input
                id="password_confirm"
                type="password"
                placeholder="비밀번호를 다시 입력해주세요"
                {...register("password_confirm")}
                className={errors.password_confirm ? "border-red-500" : ""}
              />
              {errors.password_confirm && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.password_confirm.message}
                </p>
              )}
            </div>

            {/* 비밀번호 찾기 질문 */}
            <div>
              <Label htmlFor="hint" className="flex items-center gap-2 mb-2">
                <span className="text-red-500">*</span>
                비밀번호 찾기 질문
              </Label>
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
            </div>

            {/* 비밀번호 찾기 답변 */}
            <div>
              <Label
                htmlFor="hint_answer"
                className="flex items-center gap-2 mb-2"
              >
                <span className="text-red-500">*</span>
                비밀번호 찾기 답변
              </Label>
              <Input
                id="hint_answer"
                type="text"
                placeholder="답변을 입력해주세요"
                {...register("hint_answer")}
                className={errors.hint_answer ? "border-red-500" : ""}
              />
              {errors.hint_answer && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.hint_answer.message}
                </p>
              )}
            </div>

            {/* 이름 */}
            <div>
              <Label htmlFor="name" className="flex items-center gap-2 mb-2">
                <span className="text-red-500">*</span>
                이름
              </Label>
              <Input
                id="name"
                type="text"
                placeholder="이름을 입력해주세요"
                {...register("name")}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            {/* 주소 */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <span className="text-red-500">*</span>
                주소
              </Label>
              <div className="space-y-2">
                {/* 우편번호 */}
                <div className="flex gap-2">
                  <Input
                    placeholder="우편번호"
                    {...register("postcode")}
                    readOnly
                    className={errors.postcode ? "border-red-500" : ""}
                  />
                  <Button type="button" onClick={openPostcode} variant="outline">
                    주소검색
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
                  className={errors.addr1 ? "border-red-500" : ""}
                />
                {errors.addr1 && (
                  <p className="text-sm text-red-500">{errors.addr1.message}</p>
                )}

                {/* 나머지 주소 */}
                <Input
                  placeholder="나머지 주소 (상세주소를 입력해주세요)"
                  {...register("addr2")}
                  className={errors.addr2 ? "border-red-500" : ""}
                />
                {errors.addr2 && (
                  <p className="text-sm text-red-500">{errors.addr2.message}</p>
                )}
              </div>
            </div>

            {/* 일반전화 (선택) */}
            <div>
              <Label htmlFor="phone" className="mb-2 block">
                일반전화
              </Label>
              <Input
                id="phone"
                type="text"
                placeholder="예: 02-1234-5678"
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.phone.message}
                </p>
              )}
            </div>

            {/* 휴대전화 */}
            <div>
              <Label htmlFor="mobile" className="flex items-center gap-2 mb-2">
                <span className="text-red-500">*</span>
                휴대전화
              </Label>
              <Input
                id="mobile"
                type="text"
                placeholder="예: 010-1234-5678"
                {...register("mobile")}
                className={errors.mobile ? "border-red-500" : ""}
              />
              {errors.mobile && (
                <p className="text-sm text-red-500 mt-1">
                  {errors.mobile.message}
                </p>
              )}
            </div>
          </div>
        </section>

        <Separator />

        {/* ===== 추가 정보 섹션 (선택) ===== */}
        <section>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <h2 className="text-xl font-bold">
              추가 정보 <span className="text-sm font-normal">(선택)</span>
            </h2>
          </div>

          <div className="space-y-6">
            {/* 성별 */}
            <div>
              <Label className="mb-3 block">성별</Label>
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
            </div>

            {/* 생년월일 */}
            <div>
              <Label className="mb-2 block">생년월일</Label>
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
            </div>
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
                  제2조(정의) ① "몰"이란 또또앙스가 재화 또는 용역을 이용자에게
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
    </>
  );
}

