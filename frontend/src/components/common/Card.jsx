import { clsx } from "clsx";

/**
 * White rounded-shadow card container.
 *
 * @param {'none'|'sm'|'md'|'lg'} shadow
 * @param {boolean} hover  Add lift effect on hover.
 */
export default function Card({
  children,
  className,
  shadow = "md",
  hover = false,
  ...props
}) {
  return (
    <div
      className={clsx(
        "bg-white rounded-xl border border-gray-100",
        shadow === "none" && "shadow-none",
        shadow === "sm" && "shadow-sm",
        shadow === "md" && "shadow-md",
        shadow === "lg" && "shadow-lg",
        hover &&
          "transition-transform hover:-translate-y-0.5 hover:shadow-lg cursor-pointer",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
