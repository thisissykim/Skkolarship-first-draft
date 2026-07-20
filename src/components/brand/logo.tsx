type LogoProps = {
  size?: "sm" | "md" | "lg";
  withWordmark?: boolean;
  withCaption?: boolean;
  className?: string;
};

const SIZE_MAP = {
  sm: { mark: 32, title: "text-base", caption: "text-[10px]" },
  md: { mark: 44, title: "text-xl", caption: "text-xs" },
  lg: { mark: 64, title: "text-3xl", caption: "text-sm" },
};

/**
 * Placeholder brand mark until the official SKKU logo asset is provided.
 * Swap the <svg> below for an <Image src="/skku-logo.svg" /> once available —
 * the surrounding layout (size, spacing, wordmark) stays the same.
 */
export default function Logo({ size = "md", withWordmark = true, withCaption = true, className = "" }: LogoProps) {
  const dims = SIZE_MAP[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg width={dims.mark} height={dims.mark} viewBox="0 0 48 48" fill="none" aria-hidden="true" className="shrink-0">
        <circle cx="24" cy="24" r="24" fill="#0b1c31" />
        <circle cx="24" cy="24" r="24" fill="url(#skku-logo-gradient)" fillOpacity="0.25" />
        <path
          d="M24 10c-3.5 4-6 8.4-6 12.8 0 3.9 2.6 6.8 6 6.8s6-2.9 6-6.8C30 18.4 27.5 14 24 10Z"
          fill="#34b880"
        />
        <path d="M24 22v16" stroke="#eafbf3" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M24 27c-2.4 0-4.4 1.1-5.6 2.8" stroke="#eafbf3" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M24 31c2.1 0 3.9 1 5 2.5" stroke="#eafbf3" strokeWidth="1.4" strokeLinecap="round" />
        <defs>
          <linearGradient id="skku-logo-gradient" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34b880" />
            <stop offset="1" stopColor="#0b1c31" />
          </linearGradient>
        </defs>
      </svg>
      {withWordmark ? (
        <div className="leading-tight">
          <p className={`font-extrabold tracking-tight text-navy-900 ${dims.title}`}>Skkolarship</p>
          {withCaption ? <p className={`font-medium text-navy-500 ${dims.caption}`}>성균관대학교 장학금 매칭 서비스</p> : null}
        </div>
      ) : null}
    </div>
  );
}
