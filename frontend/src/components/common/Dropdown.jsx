import { Fragment } from "react";
import { Listbox, Transition } from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";
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

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}

      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <Listbox.Button
            className={clsx(
              "relative w-full cursor-default rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-left text-sm shadow-sm",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <span
              className={clsx("block truncate", !selected && "text-gray-400")}
            >
              {selected ? selected.label : placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />
            </span>
          </Listbox.Button>

          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-sm shadow-lg ring-1 ring-black/5 focus:outline-none">
              {options.map((opt) => (
                <Listbox.Option
                  key={opt.value}
                  value={opt.value}
                  disabled={opt.disabled}
                  className={({ active }) =>
                    clsx(
                      "relative cursor-default select-none py-2 pl-10 pr-4",
                      active ? "bg-blue-50 text-blue-900" : "text-gray-900",
                      opt.disabled && "opacity-50",
                    )
                  }
                >
                  {({ selected: isSelected }) => (
                    <>
                      <span
                        className={clsx(
                          "block truncate",
                          isSelected && "font-medium",
                        )}
                      >
                        {opt.label}
                      </span>
                      {isSelected && (
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                          <CheckIcon className="h-4 w-4" />
                        </span>
                      )}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}
