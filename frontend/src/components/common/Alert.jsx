import { clsx } from "clsx";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const CONFIG = {
  success: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-800",
    Icon: CheckCircleIcon,
    iconColor: "text-green-500",
  },
  error: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
    Icon: ExclamationCircleIcon,
    iconColor: "text-red-500",
  },
  warning: {
    bg: "bg-yellow-50 border-yellow-200",
    text: "text-yellow-800",
    Icon: ExclamationTriangleIcon,
    iconColor: "text-yellow-500",
  },
  info: {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    Icon: InformationCircleIcon,
    iconColor: "text-blue-500",
  },
};

/**
 * Inline alert banner (not a toast).
 *
 * @param {'success'|'error'|'warning'|'info'} type
 * @param {string}   message
 * @param {boolean}  dismissible
 * @param {() => void} onDismiss
 */
export default function Alert({
  type = "info",
  message,
  dismissible = false,
  onDismiss,
  className,
}) {
  if (!message) return null;
  const { bg, text, Icon, iconColor } = CONFIG[type] || CONFIG.info;

  return (
    <div
      role="alert"
      className={clsx(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
        bg,
        text,
        className,
      )}
    >
      <Icon className={clsx("h-5 w-5 shrink-0 mt-0.5", iconColor)} />
      <p className="flex-1">{message}</p>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className={clsx("shrink-0 hover:opacity-70 transition-opacity", text)}
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
