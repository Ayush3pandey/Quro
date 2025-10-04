// src/hooks/useLocalStorage.js
import { useState, useEffect, useRef } from "react";

function safeParse(value, fallback) {
  try {
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function useLocalStorage(key, initialValue) {
  const readInitial = () => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? safeParse(raw, initialValue) : initialValue;
    } catch {
      return initialValue;
    }
  };

  const [state, setState] = useState(readInitial);
  const prevKeyRef = useRef(key);

  // write to localStorage whenever state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (e) {
      console.error("useLocalStorage: failed to write", e);
    }
  }, [key, state]);

  // if key changes, migrate stored value
  useEffect(() => {
    if (prevKeyRef.current !== key) {
      const prev = prevKeyRef.current;
      try {
        window.localStorage.removeItem(prev);
      } catch {}
      prevKeyRef.current = key;
    }
  }, [key]);

  // helper that sets state and writes to localStorage (same effect as setState)
  const setLocalState = (updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch (e) {
        console.error("useLocalStorage: failed to write", e);
      }
      return next;
    });
  };

  return [state, setLocalState];
}
