import { useState, useEffect } from "react";

/**
 * Debounce a value — returns the value only after it hasn't changed
 * for *delay* milliseconds.
 *
 * Useful for search inputs to avoid firing a request on every keystroke.
 */
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
