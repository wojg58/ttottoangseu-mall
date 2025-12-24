/**
 * @file types/member.ts
 * @description 회원 가입 관련 타입 정의
 */

export type MemberType = "p" | "c" | "f"; // 개인, 사업자, 외국인
export type CompanyType = "p" | "c"; // 개인사업자, 법인사업자
export type Gender = "M" | "F";

export interface MemberJoinForm {
  // 회원 구분
  member_type: MemberType;
  company_type?: CompanyType;

  // 기본 정보
  email: string;
  password: string;
  password_confirm: string;
  hint: string;
  hint_answer: string;
  name: string;

  // 주소
  postcode: string;
  addr1: string;
  addr2: string;

  // 연락처
  phone?: string;
  mobile: string;

  // 추가 정보
  gender?: Gender;
  birth_year?: string;
  birth_month?: string;
  birth_day?: string;
  is_solar_calendar?: boolean;

  // 약관 동의
  agree_service: boolean;
  agree_privacy?: boolean;
  is_sms?: boolean;
  is_news_mail?: boolean;
}

export interface MemberAdditionalInfo {
  clerk_id: string;
  member_type: MemberType;
  company_type?: CompanyType;
  hint: string;
  hint_answer: string;
  postcode?: string;
  addr1?: string;
  addr2?: string;
  phone?: string;
  mobile: string;
  gender?: Gender;
  birth_date?: string;
  is_solar_calendar?: boolean;
  is_sms: boolean;
  is_news_mail: boolean;
  created_at?: string;
  updated_at?: string;
}

