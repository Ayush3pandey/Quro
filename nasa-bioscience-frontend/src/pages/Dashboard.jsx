// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Header from "../components/Header";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [statsData, categoriesData] = await Promise.all([
          api.getStats(),
          api.getCategories()
        ]);
        if (!cancelled) {
          setStats(statsData);
          setCategories(categoriesData.categories || []);
        }
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  const topCategories = categories.slice(0, 6);

  const findPlanetCount = (planetName) => {
    if (!categories || categories.length === 0) return 0;
    const match = categories.find((c) => (c.name || "").toLowerCase() === planetName.toLowerCase());
    if (match) return match.count || 0;
    const substringTotal = categories
      .filter(c => (c.name || "").toLowerCase().includes(planetName.toLowerCase()))
      .reduce((acc, cur) => acc + (cur.count || 0), 0);
    if (substringTotal > 0) return substringTotal;
    if (stats && stats.total_publications) {
      return planetName.toLowerCase() === "moon" ? Math.round(Math.min(200, stats.total_publications * 0.05)) :
             planetName.toLowerCase() === "mars" ? Math.round(Math.min(200, stats.total_publications * 0.06)) :
             0;
    }
    return 0;
  };

  const moonCount = findPlanetCount("moon");
  const marsCount = findPlanetCount("mars");

  const sectionMinHeight = { minHeight: "calc(100vh - 5rem)" };

  return (
    <div
      className="h-screen overflow-y-scroll snap-y snap-mandatory"
      style={{ scrollSnapType: "y mandatory" }}
    >
      {/* Section 1: Full viewport Header */}
      <section
        className="w-full bg-black text-white snap-start flex items-center"
        style={sectionMinHeight}
        aria-label="Hero Header Section"
      >
        <div className="max-w-7xl mx-auto px-6 w-full">
          <Header />
        </div>
      </section>

{/* Section 2: Planetary Bioscience Hubs */}
<section
  className="w-full py-10 px-6 relative overflow-hidden snap-start"
  style={{
    ...sectionMinHeight,
    background: "#ffffff" // whole background white
  }}
  aria-label="Planetary Bioscience Hubs"
>
  <style>{`
    /* 4-card grid layout similar to the Featured News design */
    .h-center-wrap {
      min-height: calc(100vh - 160px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 0;
    }

    .hub-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      grid-template-rows: repeat(2, 1fr);
      gap: 1.5rem;
      width: 90%;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* Make first card span 2 rows */
    .hub-card.featured {
      grid-row: span 2;
    }

    .hub-card {
      position: relative;
      overflow: hidden;
      border-radius: 1rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      transition: all 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
      min-height: 300px;
    }

    .hub-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.25);
    }

    .hub-card .bg-image {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      transition: transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .hub-card:hover .bg-image {
      transform: scale(1.1);
    }

    .bottom-fade {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 32px;
      background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 100%);
      pointer-events: none;
    }

    @media (max-width: 768px) {
      .hub-grid {
        grid-template-columns: 1fr;
        grid-template-rows: auto;
      }
      
      .hub-card.featured {
        grid-row: span 1;
      }
    }
  `}</style>

  <div className="absolute top-20 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse"></div>
  <div className="absolute top-1/3 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
  <div className="absolute bottom-1/4 left-1/3 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

  <div className="max-w-7xl mx-auto relative z-10 flex flex-col h-full">
    <div className="mt-16 text-center">
      <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
        Planetary Bioscience Hubs
      </h2>
      <div className="w-32 h-1 mx-auto"></div>
    </div>

    {/* 4-card grid layout */}
    <div className="h-center-wrap">
      <div className="hub-grid">
        {/* Moon Hub - Featured (spans 2 rows) */}
        <Link
          to="/moon"
          className="hub-card featured group"
          tabIndex={0}
          aria-label="Moon Bioscience Hub"
        >
          <div
            className="bg-image"
            style={{ backgroundImage: 'url(/images/moon.jpeg)' }}
          ></div>

          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-gray-900/70 to-black/60"></div>

          <div className="relative z-10 p-6 md:p-8 flex flex-col justify-end h-full">
            <div className="mb-3">
              <span className="inline-block px-3 py-1 bg-blue-500/80 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
                5 MIN READ
              </span>
            </div>
            
            <h3 className="text-2xl md:text-4xl font-bold text-white mb-3 group-hover:text-blue-100 transition-colors duration-300">
              Moon Bioscience Hub
            </h3>
            
            <p className="text-gray-200 text-base md:text-lg mb-4">
              Curated research and analytics relevant to lunar exploration and biology.
            </p>

            <div className="mb-4">
              <span className="text-4xl md:text-5xl font-extrabold text-white">
                {moonCount.toLocaleString()}
              </span>
              <span className="text-sm text-blue-200 ml-2">publications</span>
            </div>
          </div>
        </Link>

        {/* Mars Hub */}
        <Link
          to="/mars"
          className="hub-card group"
          tabIndex={0}
          aria-label="Mars Bioscience Hub"
        >
          <div
            className="bg-image"
            style={{ backgroundImage: 'url(/images/mars1.jpeg)' }}
          ></div>

          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-gray-900/70 to-black/60"></div>

          <div className="relative z-10 p-6 flex flex-col justify-end h-full">
            <div className="mb-2">
              <span className="inline-block px-3 py-1 bg-red-500/80 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
                4 MIN READ
              </span>
            </div>
            
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-red-100 transition-colors duration-300">
              Mars Bioscience Hub
            </h3>
            
            <p className="text-gray-200 text-sm mb-3">
              Research focused on Mars-relevant biological studies.
            </p>

            <div>
              <span className="text-3xl font-extrabold text-white">
                {marsCount.toLocaleString()}
              </span>
              <span className="text-xs text-red-200 ml-2">publications</span>
            </div>
          </div>
        </Link>

        {/* Knowledge Graph */}
        <Link
          to="/analytics"
          className="hub-card group"
          tabIndex={0}
          aria-label="Knowledge Graph"
        >
          <div
            className="bg-image"
            style={{ backgroundImage: 'url(/images/knowledgeGraph.jpeg)' }}
          ></div>

          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/70 via-indigo-900/70 to-black/70"></div>

          <div className="relative z-10 p-6 flex flex-col justify-end h-full">
            <div className="mb-2">
              <span className="inline-block px-3 py-1 bg-purple-500/80 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
                3 MIN READ
              </span>
            </div>
            
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-purple-100 transition-colors duration-300">
              Knowledge Graph
            </h3>
            
            <p className="text-gray-200 text-sm mb-3">
              Explore interconnected research concepts and relationships.
            </p>

            <div>
              <span className="text-sm text-purple-200 font-semibold">
                Discover Connections →
              </span>
            </div>
          </div>
        </Link>

        {/* Research Assistant */}
        <Link
          to="/chatbot"
          className="hub-card group"
          tabIndex={0}
          aria-label="Research Assistant"
        >
          <div
            className="bg-image"
            style={{ backgroundImage: 'url(/images/research.jpeg)' }}
          ></div>

          <div className="absolute inset-0 "></div>

          <div className="relative z-10 p-6 flex flex-col justify-end h-full">
            <div className="mb-2">
              <span className="inline-block px-3 py-1 bg-emerald-500/80 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
                AI POWERED
              </span>
            </div>
            
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-emerald-100 transition-colors duration-300">
              Research Assistant
            </h3>
            
            <p className="text-gray-200 text-sm mb-3">
              AI-powered tool to help navigate and analyze research.
            </p>

            <div>
              <span className="text-sm text-emerald-200 font-semibold">
                Get Started →
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  </div>

  <div className="absolute bottom-0 left-0 right-0 pointer-events-none">
    <div className="bottom-fade"></div>
  </div>
</section>


      {/* Section 3: Research Themes */}
      <section
        className="w-full py-12 px-6 bg-gray-50 snap-start flex flex-col"
        style={sectionMinHeight}
        aria-label="Research Themes"
      >
        <div className="max-w-7xl mx-auto relative z-10 flex-1">
          <div className="mb-8 text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Research Themes
            </h2>
            <div className="w-32 h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent mx-auto"></div>
          </div>

          <div className="mb-8">
            <Swiper
              modules={[Navigation, Pagination]}
              spaceBetween={24}
              slidesPerView={1}
              breakpoints={{
                640: { slidesPerView: 1 },
                768: { slidesPerView: 2 },
                1024: { slidesPerView: 3 },
              }}
              navigation
              pagination={{ clickable: true }}
              className="pb-16"
            >
              {topCategories.map((category, index) => (
                <SwiperSlide key={category.name}>
                  <div
                    className="group relative rounded-2xl p-6 border border-green-500/30 
                               shadow-2xl hover:shadow-green-500/20 transition-all transform 
                               hover:-translate-y-2 hover:scale-105 duration-500 bg-white overflow-hidden"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="relative z-10">
                      <h3 className="font-bold text-green-600 capitalize text-xl text-center mb-6 
                                     group-hover:text-green-500 transition-colors duration-300">
                        {category.name}
                      </h3>

                      <div className="flex justify-center mb-6">
                        <div className="relative w-28 h-28 rounded-full overflow-hidden border-3 
                                        border-green-200 shadow-lg transition-all duration-500 group-hover:scale-110">
<img
  src={`/images/${category.name.toLowerCase().replace(/\s+/g, "-")}.jpeg`}
  alt={category.name}
  onError={(e) => { e.currentTarget.src = "/images/Default.jpeg"; }}
/>


                        </div>
                      </div>

                      <div className="text-center mb-6">
                        <div className="text-4xl font-extrabold text-green-600">
                          {category.count}
                        </div>
                        <div className="text-sm text-gray-500">
                          Publications
                        </div>
                      </div>

                      <div className="flex justify-center">
                        <Link
                          to={`/publications?category=${encodeURIComponent(category.name)}`}
                          className="inline-flex items-center px-6 py-2 text-sm font-bold 
                                     text-green-700 hover:text-white border-2 border-green-200 
                                     rounded-full hover:bg-green-600 transition-all duration-300"
                        >
                          Explore
                          <svg
                            className="w-4 h-4 ml-2 transform transition-transform duration-300"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                          >
                            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>

        {/* Footer */}
        <footer className="w-full bg-white border-t border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600">
              © {new Date().getFullYear()} NASA BioScience Explorer – All rights reserved.
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <a href="/privacy" className="hover:text-gray-900">Privacy</a>
              <a href="/terms" className="hover:text-gray-900">Terms</a>
              <a href="/contact" className="hover:text-gray-900">Contact</a>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default Dashboard;