/* functions/.eslintrc.js */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier" // ← 포맷 관련 규칙 끄기
  ],
  rules: {
    // 포맷/스타일 규칙 완화
    quotes: ["off", "double", { avoidEscape: true }],
    "max-len": "off",
    indent: "off",
    "arrow-parens": "off",
    "object-curly-spacing": "off",
    "comma-dangle": "off",
    "require-jsdoc": "off",
    // 타입/임포트 관련
    "@typescript-eslint/no-explicit-any": "off",
    "import/no-unresolved": "off"
  }
};
