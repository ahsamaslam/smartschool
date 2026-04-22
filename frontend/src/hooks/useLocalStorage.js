import { useState, useCallback } from "react";

/**
 * Persist state in localStorage.
 *
 * @param {string} key          localStorage key.
 * @param {any}    initialValue Fallback when key is absent or parse fails.
 */
export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const toStore = value instanceof Function ? value(storedValue) : value;
        setStoredValue(toStore);
        localStorage.setItem(key, JSON.stringify(toStore));
      } catch (err) {
        console.error(`useLocalStorage: failed to set key "${key}"`, err);
      }
    },
    [key, storedValue],
  );

  const removeValue = useCallback(() => {
    setStoredValue(initialValue);
    localStorage.removeItem(key);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

export default useLocalStorage;
