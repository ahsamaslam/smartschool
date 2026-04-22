import { clsx } from "clsx";

const base =
  "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

const variants = {
  primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
  secondary:
    "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500",
  danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost: "bg-transparent text-blue-600 hover:bg-blue-50 focus:ring-blue-500",
  success: "bg-green-600 text-white hover:bg-green-700 focus:ring-green-500",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2   text-sm gap-2",
  lg: "px-6 py-2.5 text-base gap-2",
};

/**
 * Generic button component.
 *
 * @param {'primary'|'secondary'|'danger'|'ghost'|'success'} variant
 * @param {'sm'|'md'|'lg'} size
 * @param {boolean} loading  Shows a spinner and disables the button.
 * @param {boolean} fullWidth
 */
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
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
      )}
      {children}
    </button>
  );
}
