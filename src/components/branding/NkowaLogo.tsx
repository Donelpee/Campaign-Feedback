import { cn } from "@/lib/utils";

type NkowaLogoSize = "sm" | "md" | "lg" | "xl";
type NkowaLogoTheme = "light" | "dark";
type NkowaLogoAlign = "left" | "center";

interface NkowaLogoProps {
  className?: string;
  showTagline?: boolean;
  size?: NkowaLogoSize;
  theme?: NkowaLogoTheme;
  align?: NkowaLogoAlign;
  taglineVariant?: "default" | "prominent";
}

const sizeStyles: Record<NkowaLogoSize, { width: string }> = {
  sm: { width: "max-w-[140px]" },
  md: { width: "max-w-[190px]" },
  lg: { width: "max-w-[250px]" },
  xl: { width: "max-w-[310px]" },
};

const themeColors: Record<
  NkowaLogoTheme,
  { ink: string; accent: string; secondary: string; tagline: string }
> = {
  light: {
    ink: "#171b37",
    accent: "#5b54dd",
    secondary: "#14866f",
    tagline: "#6a7892",
  },
  dark: {
    ink: "#f3f7ff",
    accent: "#8c82ff",
    secondary: "#76dcc4",
    tagline: "#ffffff",
  },
};

export function NkowaLogo({
  className,
  showTagline = true,
  size = "md",
  theme = "light",
  align = "left",
  taglineVariant = "default",
}: NkowaLogoProps) {
  const palette = themeColors[theme];
  const taglineFontSize = taglineVariant === "prominent" ? "14" : "12";
  const taglineLetterSpacing = taglineVariant === "prominent" ? "0.8" : "0.6";
  const dividerWidth = taglineVariant === "prominent" ? 270 : 250;

  return (
    <div
      className={cn(
        "inline-flex",
        align === "center" ? "justify-center" : "justify-start",
        "w-full",
        sizeStyles[size].width,
        className,
      )}
      aria-label="Nkowa logo"
    >
      <svg
        viewBox={showTagline ? "0 0 320 230" : "0 0 320 170"}
        className="h-auto w-full"
        role="img"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="0"
          y="76"
          fill={palette.ink}
          fontFamily="Avenir Next, Montserrat, Poppins, Segoe UI, Arial, sans-serif"
          fontSize="78"
          fontWeight="800"
          letterSpacing="1.5"
        >
          NK
        </text>

        <text
          x="118"
          y="76"
          fill={palette.accent}
          fontFamily="Avenir Next, Montserrat, Poppins, Segoe UI, Arial, sans-serif"
          fontSize="78"
          fontWeight="800"
        >
          O
        </text>

        <rect x="144" y="88" width="10" height="10" rx="1.5" fill={palette.accent} />

        <text
          x="2"
          y="156"
          fill={palette.secondary}
          fontFamily="Avenir Next, Montserrat, Poppins, Segoe UI, Arial, sans-serif"
          fontSize="70"
          fontWeight="35"
        >
          W
        </text>

        <text
          x="78"
          y="156"
          fill={palette.secondary}
          fontFamily="Avenir Next, Montserrat, Poppins, Segoe UI, Arial, sans-serif"
          fontSize="70"
          fontWeight="35"
        >
          A
        </text>

        {showTagline && (
          <>
            <text
              x="0"
              y="194"
              fill={palette.tagline}
              fontFamily="Avenir Next, Montserrat, Poppins, Segoe UI, Arial, sans-serif"
              fontSize={taglineFontSize}
              fontWeight="600"
              letterSpacing={taglineLetterSpacing}
            >
              CAMPAIGN INTELLIGENCE PLATFORM
            </text>
            <line
              x1="0"
              y1="207"
              x2={dividerWidth}
              y2="207"
              stroke={palette.accent}
              strokeWidth="2.5"
            />
          </>
        )}
      </svg>
    </div>
  );
}
