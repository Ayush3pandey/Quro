import { useState, useEffect } from "react";

export function useSessionStorage(key, initialValue) {
  const readValue = () => {
    try {
      const item = sessionStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  };

  const [state, setState] = useState(readValue);

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.error("Could not write to sessionStorage", e);
    }
  }, [key, state]);

  return [state, setState];
}
