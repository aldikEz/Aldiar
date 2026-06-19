type BrandProps = {
  onHome?: () => void;
};

export function Brand({ onHome }: BrandProps) {
  return (
    <a
      className="brand-lockup"
      href="/"
      aria-label="Pace AI home"
      onClick={(event) => {
        if (!onHome) return;
        event.preventDefault();
        onHome();
      }}
    >
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 76 64" focusable="false">
          <path
            className="brand-mark-body"
            d="M10 58V7h26.5C51 7 60.5 15.5 60.5 28.5S51 50 36.5 50H25v8H10Zm15-37.2v15.4h11.6c5.5 0 8.8-2.9 8.8-7.7s-3.3-7.7-8.8-7.7H25Z"
            fill="currentColor"
            fillRule="evenodd"
          />
          <path
            className="brand-mark-track"
            d="M51 53H68"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="6"
          />
          <path
            className="brand-mark-track"
            d="M56 42H70"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="5"
          />
        </svg>
      </span>
      <span>PACE AI</span>
    </a>
  );
}
