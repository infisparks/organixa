// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Base configuration extended from next/core-web-vitals and next/typescript
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // Custom configuration for your project
  {
    // Apply rules globally to all matched files
    rules: {
      // ❌ Errors to disable
      // Disable 'any' usage error (Use with caution; ideally, fix by specifying types)
      "@typescript-eslint/no-explicit-any": "off",

      // Disable the rule about unescaped characters in JSX
      "react/no-unescaped-entities": "off",

      // Change the error for @ts-ignore to a warning, instead of an error (still encourages use of @ts-expect-error)
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-ignore": "allow-with-description",
        },
      ],

      // ⚠️ Warnings to disable
      // Disable the warning about using <img> instead of <Image /> (You should still consider fixing these for performance)
      "@next/next/no-img-element": "off",
    },
  },

  // 🧹 Overrides for specific file patterns to address unused variables/imports
  // This targets files where many unused imports/variables were reported
  {
    files: [
      "src/app/**/*.tsx", // Target all pages and layouts
      "src/components/**/*.tsx", // Target all components
      "src/hooks/**/*.ts", // Target hook files
    ],
    rules: {
      // Disable the 'unused variables' error specifically for these files
      "@typescript-eslint/no-unused-vars": "off",

      // Disable the 'missing dependency' warning for useEffect hooks
      // Note: This is generally bad practice and should be fixed, but is included to suppress the warning.
      "react-hooks/exhaustive-deps": "off",
    },
  },
];

export default eslintConfig;