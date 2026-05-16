import type { Config } from "tailwindcss";
import { batiproColors, batiproRadius, batiproShadows, batiproSpacing, batiproTypography } from "../tokens";

export const batiproTailwindPreset = {
  theme: {
    extend: {
      colors: {
        bt: {
          primary: batiproColors.primaryDark,
          accent: batiproColors.primaryAccent,
          background: batiproColors.background,
          surface: batiproColors.surface,
          "surface-secondary": batiproColors.surfaceSecondary,
          border: batiproColors.border,
          text: batiproColors.textPrimary,
          muted: batiproColors.textSecondary,
          success: batiproColors.success,
          warning: batiproColors.warning,
          danger: batiproColors.danger,
          info: batiproColors.info,
        },
      },
      fontFamily: {
        sans: batiproTypography.fontFamily.sans,
      },
      spacing: batiproSpacing,
      borderRadius: {
        input: batiproRadius.input,
        card: batiproRadius.card,
        dialog: batiproRadius.dialog,
      },
      boxShadow: {
        subtle: batiproShadows.subtle,
        card: batiproShadows.card,
        dialog: batiproShadows.dialog,
      },
      transitionDuration: {
        bt: "150ms",
      },
    },
  },
} satisfies Partial<Config>;
