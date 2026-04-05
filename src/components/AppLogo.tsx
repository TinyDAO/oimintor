/** 应用标识：雷达式 OI 结构意象 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle
        cx="24"
        cy="24"
        r="20"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity={0.22}
      />
      <circle
        cx="24"
        cy="24"
        r="12.5"
        stroke="currentColor"
        strokeWidth="1.25"
        opacity={0.32}
      />
      <path
        d="M24 9v15l10.5 6"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="24" r="3.25" fill="var(--accent)" />
    </svg>
  )
}
