import { ChevronUpDownIcon } from "@heroicons/react/20/solid";
import { clsx } from "clsx";

/**
 * Accessible select dropdown built on HeadlessUI Listbox.
 *
 * @param {Array<{label: string, value: any}>} options
 * @param {any}    value       Currently selected value
 * @param {(v: any) => void} onChange
 * @param {string} placeholder Text shown when nothing is selected
 * @param {string} label
 * @param {boolean} disabled
 */
export default function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = "Select…",
  label,
  disabled = false,
  className,
}) {
  const selected = options.find((o) => o.value === value);

  const handleChange = (e) => {
    const raw = e.target.value;
    const matched = options.find((o) => String(o.value) === raw);
    onChange?.(matched ? matched.value : raw);
  };

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}

      <div className="relative">
        <select
          value={selected ? String(selected.value) : ""}
          onChange={handleChange}
          disabled={disabled}
          className={clsx(
            "w-full appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-left text-sm shadow-sm text-gray-900",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            disabled && "opacity-50 cursor-not-allowed",
            !selected && "text-gray-700",
          )}
        >
          <option value="" disabled hidden>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option
              key={String(opt.value)}
              value={String(opt.value)}
              disabled={opt.disabled}
            >
              {opt.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
        </span>
      </div>
    </div>
  );
}
