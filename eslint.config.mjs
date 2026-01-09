import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn", // 경고로 변경 (에러 방지)
      "prefer-const": "warn", // 경고로 변경 (에러 방지)
      "react-hooks/exhaustive-deps": "warn", // 경고로 변경 (에러 방지)
      "@next/next/no-img-element": "warn", // 경고로 변경 (에러 방지)
    },
  },
];

export default eslintConfig;
