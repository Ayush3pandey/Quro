// src/context/ProgressContext.jsx
import React, { createContext, useContext, useEffect, useRef } from "react";
import { useLocalStorage } from "../hooks/useLocalStorage";

const ProgressContext = createContext();

export function ProgressProvider({ children }) {
  // authoritative store: localStorage
  const [progress, setProgress] = useLocalStorage("app:progress", {});
  const isUpdatingRef = useRef(false);

  // When storage changes in another tab, update React state.
  useEffect(() => {
    const onStorage = (ev) => {
      if (!ev.key) return;
      if (ev.key !== "app:progress") return;

      try {
        // ev.newValue is a string or null (if cleared)
        const newState = ev.newValue ? JSON.parse(ev.newValue) : {};
        // Avoid reacting to our own writes (we set this flag when we write).
        if (isUpdatingRef.current) {
          // small delay to clear the flag (we generated this storage event)
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 0);
          return;
        }

        // Only update if actually different (shallow compare)
        const prev = progress || {};
        const same =
          Object.keys(prev).length === Object.keys(newState).length &&
          Object.keys(prev).every((k) => {
            try {
              return JSON.stringify(prev[k]) === JSON.stringify(newState[k]);
            } catch {
              return prev[k] === newState[k];
            }
          });

        if (!same) {
          setProgress(newState);
        }
      } catch (e) {
        console.error("ProgressContext: failed to parse storage event", e);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, setProgress]);

  // write-through updater that marks writes so we can ignore the storage event we trigger
  const updateProgress = (patch) => {
    setProgress((prev) => {
      const next = { ...(prev || {}), ...(patch || {}) };
      try {
        isUpdatingRef.current = true;
        window.localStorage.setItem("app:progress", JSON.stringify(next));
      } catch (e) {
        console.error("ProgressContext: failed to write localStorage", e);
      }
      return next;
    });
  };

  const resetProgress = () => {
    try {
      isUpdatingRef.current = true;
      window.localStorage.removeItem("app:progress");
    } catch (e) {
      console.error("ProgressContext: failed to clear localStorage", e);
    }
    setProgress({});
    // small safety: clear the flag soon
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 0);
  };

  return (
    <ProgressContext.Provider value={{ progress: progress || {}, updateProgress, resetProgress }}>
      {children}
    </ProgressContext.Provider>
  );
}

export const useProgress = () => useContext(ProgressContext);
