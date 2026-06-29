import { useCallback, useEffect, useState } from "react";

const readStorageValue = (key, fallbackValue) => {
  if (typeof window === "undefined") {
    return fallbackValue;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? JSON.parse(rawValue) : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

export const useLocalStorage = (key, fallbackValue = null) => {
  const [value, setValue] = useState(() => readStorageValue(key, fallbackValue));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  const removeValue = useCallback(() => {
    setValue(null);
  }, []);

  return [value, setValue, removeValue];
};
