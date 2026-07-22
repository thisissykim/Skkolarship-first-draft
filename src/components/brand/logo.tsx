import Image from "next/image";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  withCaption?: boolean;
  /** Use "light" wordmark text on dark backgrounds (e.g. the login hero). */
  tone?: "dark" | "light";
  className?: string;
};

const SIZE_MAP = {
  sm: { mark: 32, title: "text-base", caption: "text-[10px]" },
  md: { mark: 44, title: "text-xl", caption: "text-xs" },
  lg: { mark: 64, title: "text-3xl", caption: "text-sm" },
};

export default function Logo({
  size = "md",
  withWordmark = true,
  withCaption = true,
  tone = "dark",
  className = "",
}: LogoProps) {
  const dims = SIZE_MAP[size];
  const titleColor = tone === "light" ? "text-white" : "text-navy-900";
  const captionColor = tone === "light" ? "text-white/70" : "text-navy-500";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/brand/skku-logo.png"
        alt="Skkolarship"
        width={dims.mark}
        height={dims.mark}
        className="shrink-0 rounded-full"
        priority
      />
      {withWordmark ? (
        <div className="leading-tight">
          <p className={`font-extrabold tracking-tight ${titleColor} ${dims.title}`}>Skkolarship</p>
          {withCaption ? <p className={`font-medium ${captionColor} ${dims.caption}`}>성균관대학교 장학금 매칭 서비스</p> : null}
        </div>
      ) : null}
    </div>
  );
}
