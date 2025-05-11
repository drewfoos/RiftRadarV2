import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// Base configurations extended using FlatCompat
const baseConfigs = [
  ...compat.extends("next/core-web-vitals"), // Extends Next.js core web vitals rules
  // Note: "next/typescript" is typically included in "next/core-web-vitals" or handled by Next.js's TypeScript integration.
  // If you specifically added it for a reason, you can keep it.
  // Otherwise, "next/core-web-vitals" might be sufficient.
  // For this example, we'll assume it's needed or preferred.
  ...compat.extends("next/typescript")
];

const eslintConfig = [
  ...baseConfigs, // Spread the base configurations
  {
    // This object is where you define or override rules
    rules: {
      // Add or override specific rules here
      "@typescript-eslint/no-explicit-any": "off", // Disables the rule that bans 'any' type
      // You can add other rule modifications here, for example:
      // "react/no-unescaped-entities": "warn", // Set a rule to warning instead of error
    },
  },
  // You can add more configuration objects if needed, for example, for specific file patterns
  // {
  //   files: ["src/app/api/**/*.ts"], // Apply only to files in this path
  //   rules: {
  //     // Rules specific to API routes
  //   }
  // }
];

export default eslintConfig;
