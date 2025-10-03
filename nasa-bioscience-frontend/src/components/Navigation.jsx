// src/components/Navigation.jsx
import React from "react";
import { Link, useLocation } from "react-router-dom";

const Navigation = () => {
  const location = useLocation();
  const navItems = [
    { path: "/", label: "Research Overview", icon: "" },
    { path: "/publications", label: "Publications", icon: "" },
    { path: "/search", label: "Advanced Search", icon: "" },
    { path: "/analytics", label: "Impact Analytics", icon: "" },
  ];

  return (
    <nav className="fixed top-0 left-0 w-full bg-black text-white z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center h-20">
          <div className="flex space-x-8">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex items-center px-4 h-full border-b-4 transition-all duration-150
                    ${
                      isActive
                        ? "border-white text-white"
                        : "border-transparent text-white/70 hover:text-white hover:border-white/30"
                    }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  <span className="text-lg md:text-xl font-semibold tracking-tight">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="flex-1" />
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
