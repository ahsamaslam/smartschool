import { clsx } from "clsx";

/**
 * Animated spinner.
 * @param {'sm'|'md'|'lg'} size
 * @param {string} className  Extra Tailwind classes (e.g. color)
 */
export default function Spinner({ size = "md", className }) {
  const sizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-10 w-10" };
  return (
    <svg
      className={clsx("animate-spin text-blue-600", sizes[size], className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/** Full-screen centred loading overlay */
export function PageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/70 z-40">
      <Spinner size="lg" />
    </div>
  );
}
