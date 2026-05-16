export const batiproColors = {
  primaryDark: "#0F2747",
  primaryAccent: "#3B82F6",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  surfaceSecondary: "#F1F5F9",
  border: "#E2E8F0",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  success: "#16A34A",
  warning: "#D97706",
  danger: "#DC2626",
  info: "#0EA5E9",
} as const;

export type BatiproColorToken = keyof typeof batiproColors;
