/**
 * @file types/daum-postcode.d.ts
 * @description Daum Postcode API 타입 정의
 */

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string;
          address: string;
          addressEnglish: string;
          addressType: 'R' | 'J';
          userSelectedType: 'R' | 'J';
          noSelected: 'Y' | 'N';
          userLanguageType: 'K' | 'E';
          roadAddress: string;
          roadAddressEnglish: string;
          jibunAddress: string;
          jibunAddressEnglish: string;
          autoRoadAddress: string;
          autoRoadAddressEnglish: string;
          autoJibunAddress: string;
          autoJibunAddressEnglish: string;
          buildingCode: string;
          buildingName: string;
          apartment: 'Y' | 'N';
          sido: string;
          sigungu: string;
          sigunguCode: string;
          roadnameCode: string;
          bcode: string;
          roadname: string;
          bname: string;
          bname1: string;
          bname2: string;
          hname: string;
          query: string;
          postCode: string;
          postCode1: string;
          postCode2: string;
          postCodeSeq: string;
          postCodeType: string;
        }) => void;
        width?: string | number;
        height?: string | number;
      }) => {
        open: () => void;
      };
    };
  }
}

export {};

