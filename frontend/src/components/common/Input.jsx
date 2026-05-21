import { useState, forwardRef } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { clsx } from "clsx";

/**
 * Form input with optional label, error message and password-reveal toggle.
 */
const Input = forwardRef(function Input(
  {
    label,
    error,
    type = "text",
    className,
    id,
    required,
    hint,
    disabled,
    ...props
  },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "_");
  const isPassword = type === "password";
  const resolvedType = isPassword && showPassword ? "text" : type;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          disabled={disabled}
          className={clsx(
            "w-full rounded-lg border px-3 py-2 text-sm shadow-sm text-gray-900",
            "placeholder:text-gray-500",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            disabled
              ? "border-gray-200 bg-gray-100 text-gray-700 cursor-not-allowed"
              : error
                ? "border-red-400 bg-red-50"
                : "border-gray-300 bg-white hover:border-gray-400",
            isPassword && "pr-10",
            className,
          )}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeSlashIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});

export default Input;
