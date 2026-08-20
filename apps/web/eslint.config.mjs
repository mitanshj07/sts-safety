// apps/web/eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    files: ["src/**/*.{ts,tsx,js,mjs}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='console'] > Identifier[name=/^(kycNumber|kyc_number|kycSalt|kyc_salt|salt|privateKey|mnemonic|TOURIST_HD_MNEMONIC|ISSUER_PRIVATE_KEY|PII_ENCRYPTION_KEY)$/]",
          message:
            "Never log a private key, a salt, or a raw KYC number.",
        },
        {
          selector:
            "CallExpression[callee.object.name='console'][callee.property.name=/^(log|debug|info|warn|error)$/] Literal[value=/(privateKey|mnemonic|kycNumber|kyc_number|kyc_salt|ISSUER_PRIVATE_KEY|TOURIST_HD_MNEMONIC)/i]",
          message:
            "Never log a private key, a salt, or a raw KYC number.",
        },
      ],
    },
  },
]);

export default eslintConfig;
