// src/components/Navigation.jsx
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

const Navigation = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const navItems = [
    { path: "/", label: "Home", icon: "" },
    { path: "/publications", label: "Publications", icon: "" },
    { path: "/chatbot", label: "QuroBot", icon: "" },
    { path: "/analytics", label: "Knowledge Graph", icon: "" },
    { path: "/contact", label: "Contact Us", icon: "" },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full bg-black text-white z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo Section */}
          <Link to="/" className="group flex-shrink-0">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shadow-[0_0_15px_rgba(255,255,255,0.5)] group-hover:shadow-[0_0_25px_rgba(255,255,255,0.8)] transition-shadow duration-300">
              <div className="absolute inset-0 rounded-full border-2 border-white/30"></div>
              <img
                src="/images/logo.png"
                alt="Logo"
                className="w-full h-full object-cover"
              />
            </div>
          </Link>

          {/* Desktop Navigation Items */}
          <div className="hidden md:flex space-x-4 lg:space-x-8">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center px-3 lg:px-4 h-full border-b-4 transition-all duration-150
                    ${
                      isActive
                        ? "border-white text-white"
                        : "border-transparent text-white/70 hover:text-white hover:border-white/30"
                    }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  <span className="text-base lg:text-lg xl:text-xl font-semibold tracking-tight">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 animate-fadeIn">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center px-4 py-3 rounded-lg transition-all duration-150
                      ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                  >
                    <span className="mr-2">{item.icon}</span>
                    <span className="text-base font-semibold tracking-tight">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;