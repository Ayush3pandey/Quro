// src/components/Header.jsx
import React, { useEffect, useState } from "react";
import api from "../services/api";

const Header = () => {
  const [stats, setStats] = useState(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    let mounted = true;
    api.getStats?.()
      .then((res) => {
        if (!mounted) return;
        setStats(res);
      })
      .catch(() => { /* ignore */ });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    // Hide the scroll hint as soon as the user scrolls (or wheel / touchstart)
    const handleUserScroll = () => {
      setShowScrollHint(false);
      removeListeners();
    };

    const removeListeners = () => {
      window.removeEventListener("scroll", handleUserScroll);
      window.removeEventListener("wheel", handleUserScroll);
      window.removeEventListener("touchstart", handleUserScroll);
    };

    // Add listeners (passive for better performance)
    window.addEventListener("scroll", handleUserScroll, { passive: true });
    window.addEventListener("wheel", handleUserScroll, { passive: true });
    window.addEventListener("touchstart", handleUserScroll, { passive: true });

    // Cleanup on unmount
    return () => removeListeners();
  }, []);

  return (
    <header className="relative h-screen w-full overflow-hidden">
      {/* Video/background layer */}
      <div className="absolute inset-0 w-full h-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          poster="/images/hero-poster.jpg"
        >
          <source src="/videos/video1.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Dark overlay so text is readable */}
        <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex flex-col justify-center h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
            THE QURO
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-gray-200 leading-relaxed max-w-2xl">
            Scientific Research Analytics Platform - Explore cutting-edge research and discoveries from NASA's bioscience programs
          </p>

          <div className="mt-8 flex items-center space-x-6 text-white">
            <span className="text-sm sm:text-base font-medium bg-white bg-opacity-20 px-4 py-2 rounded-full">
              {stats?.total_publications?.toLocaleString() || "572"} Live Records
            </span>
            <span className="text-sm sm:text-base text-gray-300">
              Updated {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Scroll hint - shown only until the user scrolls */}
      {showScrollHint && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <div className="flex flex-col items-center text-white animate-bounce">
            <span className="text-sm mb-2">Scroll to explore</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
