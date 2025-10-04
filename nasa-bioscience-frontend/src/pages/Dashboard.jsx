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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
          <Header />
        </div>
      </section>

      {/* Section 2: Planetary Bioscience Hubs */}
      <section
        className="w-full py-6 sm:py-10 px-4 sm:px-6 relative overflow-hidden snap-start"
        style={{
          ...sectionMinHeight,
          background: "#ffffff"
        }}
        aria-label="Planetary Bioscience Hubs"
      >
        <style>{`
          /* 4-card grid layout matching Featured News design */
          .h-center-wrap {
            min-height: calc(100vh - 160px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 1rem 0;
          }

          @media (min-width: 768px) {
            .h-center-wrap {
              padding: 2rem 0;
            }
          }

          .hub-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 1rem;
            width: 100%;
            margin: 0;
            animation: fadeInUp 0.8s ease-out;
          }

          @media (min-width: 768px) {
            .hub-grid {
              grid-template-columns: 1.2fr 1fr;
              grid-template-rows: repeat(3, 1fr);
              gap: 1.5rem;
            }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* Make first card span all 3 rows on the left on desktop */
          .hub-card.featured {
            min-height: 400px;
            animation: fadeInLeft 0.8s ease-out;
          }

          @media (min-width: 768px) {
            .hub-card.featured {
              grid-row: span 3;
              min-height: 500px;
            }
          }

          @keyframes fadeInLeft {
            from {
              opacity: 0;
              transform: translateX(-30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .hub-card {
            position: relative;
            overflow: hidden;
            border-radius: 1rem;
            box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            transition: all 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
            min-height: 200px;
            animation: fadeInRight 0.8s ease-out;
          }

          @keyframes fadeInRight {
            from {
              opacity: 0;
              transform: translateX(30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          .hub-card:nth-child(2) {
            animation-delay: 0.1s;
          }

          .hub-card:nth-child(3) {
            animation-delay: 0.2s;
          }

          .hub-card:nth-child(4) {
            animation-delay: 0.3s;
          }

          @media (hover: hover) {
            .hub-card:hover {
              transform: translateY(-8px);
              box-shadow: 0 20px 40px rgba(0,0,0,0.25);
            }

            .hub-card:hover .bg-image {
              transform: scale(1.1);
            }

            .hub-card:hover::before {
              opacity: 1;
            }

            .hub-card:hover .card-badge {
              transform: scale(1.05);
            }

            .hub-card:hover h3 {
              letter-spacing: 0.5px;
            }

            .hub-card:hover .publication-count {
              transform: scale(1.08);
            }

            .hub-card:hover .arrow-link {
              transform: translateX(5px);
            }
          }

          .hub-card .bg-image {
            position: absolute;
            inset: 0;
            background-size: cover;
            background-position: center;
            transition: transform 700ms cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          .hub-card::before {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 100%);
            opacity: 0;
            transition: opacity 400ms ease;
            z-index: 5;
          }

          .hub-card .card-badge {
            transition: transform 300ms ease, background-color 300ms ease;
          }

          .hub-card h3 {
            transition: all 300ms ease;
          }

          .hub-card p {
            transition: all 300ms ease;
          }

          .publication-count {
            transition: all 400ms cubic-bezier(0.2, 0.8, 0.2, 1);
          }

          .arrow-link {
            transition: transform 300ms ease;
            display: inline-block;
          }

          .section-heading {
            animation: fadeInDown 0.8s ease-out;
            position: relative;
            display: inline-block;
          }

          @keyframes fadeInDown {
            from {
              opacity: 0;
              transform: translateY(-20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .heading-underline {
            animation: expandWidth 1s ease-out 0.3s both;
          }

          @keyframes expandWidth {
            from {
              width: 0;
            }
            to {
              width: 8rem;
            }
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
        `}</style>

        <div className="absolute top-20 left-1/4 w-64 h-64 sm:w-96 sm:h-96 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/4 w-64 h-64 sm:w-96 sm:h-96 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 sm:w-96 sm:h-96 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

        <div className="max-w-7xl mx-auto relative z-10 flex flex-col h-full">
          <div className="mt-8 sm:mt-16 text-center">
            <h2 className="section-heading text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent mb-4 pb-1 px-4">
              Research Features Available
            </h2>
            <div className="heading-underline w-20 sm:w-32 h-1 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500"></div>
          </div>

          {/* 4-card grid layout */}
          <div className="h-center-wrap">
            <div className="hub-grid">
              {/* Moon Hub - Featured (spans 3 rows on desktop) */}
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

                <div className="relative z-10 p-4 sm:p-6 md:p-8 flex flex-col justify-end h-full">
                  <div className="mb-2 sm:mb-3">
                    {/* <span className="card-badge inline-block px-2 sm:px-3 py-1 bg-blue-500/80 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
                      5 MIN READ
                    </span> */}
                  </div>
                  
                  <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2 sm:mb-3 group-hover:text-blue-100 transition-colors duration-300">
                    Moon Bioscience Hub
                  </h3>
                  
                  <p className="text-gray-200 text-sm sm:text-base md:text-lg mb-3 sm:mb-4">
                    Curated research and analytics relevant to lunar exploration and biology.
                  </p>

                  <div className="mb-3 sm:mb-4 publication-count">
                    <span className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
                      {moonCount.toLocaleString()}
                    </span>
                    <span className="text-xs sm:text-sm text-blue-200 ml-2">publications</span>
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

                <div className="relative z-10 p-4 sm:p-6 flex flex-col justify-end h-full">
                  <div className="mb-2">
                    {/* <span className="card-badge inline-block px-2 sm:px-3 py-1 bg-red-500/80 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
                      4 MIN READ
                    </span> */}
                  </div>
                  
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-red-100 transition-colors duration-300">
                    Mars Bioscience Hub
                  </h3>
                  
                  <p className="text-gray-200 text-xs sm:text-sm mb-2 sm:mb-3">
                    Research focused on Mars-relevant biological studies.
                  </p>

                  <div className="publication-count">
                    <span className="text-2xl sm:text-3xl font-extrabold text-white">
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

                <div className="relative z-10 p-4 sm:p-6 flex flex-col justify-end h-full">
                  <div className="mb-2">
                    <span className="card-badge inline-block px-2 sm:px-3 py-1 bg-purple-500/80 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
                      AI POWERED
                    </span>
                  </div>
                  
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-purple-100 transition-colors duration-300">
                    Knowledge Graph
                  </h3>
                  
                  <p className="text-gray-200 text-xs sm:text-sm mb-2 sm:mb-3">
                    Explore interconnected research concepts and relationships.
                  </p>

                  <div>
                    <span className="arrow-link text-xs sm:text-sm text-purple-200 font-semibold">
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
                  style={{ backgroundImage: 'url(/images/ISS1.jpeg)' }}
                ></div>

                <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-gray-900/70 to-black/60"></div>

                <div className="relative z-10 p-4 sm:p-6 flex flex-col justify-end h-full">
                  <div className="mb-2">
                    <span className="card-badge inline-block px-2 sm:px-3 py-1 bg-emerald-500/80 rounded-full text-xs font-semibold text-white uppercase tracking-wide">
                      AI POWERED
                    </span>
                  </div>
                  
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-emerald-100 transition-colors duration-300">
                    QuroBot
                  </h3>
                  
                  <p className="text-gray-200 text-xs sm:text-sm mb-2 sm:mb-3">
                    AI-powered tool to help navigate and analyze research.
                  </p>

                  <div>
                    <span className="arrow-link text-xs sm:text-sm text-emerald-200 font-semibold">
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
  className="w-full py-6 sm:py-8 md:py-10 lg:py-12 px-3 sm:px-4 md:px-6 bg-gray-100 snap-start flex flex-col"
  aria-label="Research Themes"
>
  <div className="max-w-7xl mx-auto relative z-10 flex-1 w-full">
    <div className="mb-4 sm:mb-6 md:mb-8 text-center px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 mb-2 sm:mb-3 md:mb-4">
        Research Themes
      </h2>
      <div className="w-16 sm:w-20 md:w-24 lg:w-32 h-0.5 sm:h-1 bg-gradient-to-r from-transparent via-gray-900 to-transparent mx-auto"></div>
    </div>

    <div className="mb-4 sm:mb-6 md:mb-8 px-1 sm:px-2 md:px-4">
      <Swiper
        modules={[Navigation, Pagination]}
        spaceBetween={12}
        slidesPerView={1}
        breakpoints={{
          480: { slidesPerView: 1, spaceBetween: 14 },
          640: { slidesPerView: 1, spaceBetween: 16 },
          768: { slidesPerView: 2, spaceBetween: 18 },
          1024: { slidesPerView: 3, spaceBetween: 20 },
          1280: { slidesPerView: 3, spaceBetween: 24 },
        }}
        navigation={{
          enabled: true,
        }}
        pagination={{ clickable: true }}
        className="pb-10 sm:pb-12 md:pb-14 lg:pb-16 research-themes-swiper"
      >
        {topCategories.map((category, index) => (
          <SwiperSlide key={category.name}>
            <div
              className="group relative rounded-lg sm:rounded-xl md:rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 
                         border border-white/30 shadow-lg sm:shadow-xl md:shadow-2xl 
                         hover:shadow-white/40 transition-all transform 
                         hover:-translate-y-1 sm:hover:-translate-y-2 
                         hover:scale-[1.02] sm:hover:scale-105 
                         duration-300 sm:duration-500 
                         bg-white/10 backdrop-blur-sm overflow-hidden
                         min-h-[240px] xs:min-h-[260px] sm:min-h-[280px] md:min-h-[300px] lg:min-h-[320px]
                         flex flex-col"
              style={{ 
                animationDelay: `${index * 0.1}s`,
                backgroundImage: `url(/images/${category.name.toLowerCase().replace(/\s+/g, "-")}.jpeg)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {/* Dark overlay for better text readability */}
              <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors duration-300 z-0"></div>
              
              <div className="relative z-10 h-full flex flex-col justify-between">
                <h3 className="font-bold text-white capitalize 
                               text-sm xs:text-base sm:text-lg md:text-xl 
                               text-center mb-2 sm:mb-3 md:mb-4 lg:mb-6 
                               group-hover:text-white/90 transition-colors duration-300 
                               drop-shadow-lg leading-tight px-1">
                  {category.name}
                </h3>

                <div className="text-center mb-2 sm:mb-3 md:mb-4 lg:mb-6 flex-grow flex flex-col justify-center">
                  <div className="text-xl xs:text-2xl sm:text-3xl md:text-4xl font-extrabold text-white drop-shadow-lg">
                    {category.count}
                  </div>
                  <div className="text-[10px] xs:text-xs sm:text-sm text-white/90 drop-shadow-lg mt-0.5 sm:mt-1">
                    Publications
                  </div>
                </div>

                <div className="flex justify-center">
                  <Link
                    to={`/publications?category=${encodeURIComponent(category.name)}`}
                    className="inline-flex items-center 
                               px-2.5 xs:px-3 sm:px-4 md:px-5 lg:px-6 
                               py-1 xs:py-1.5 sm:py-2 
                               text-[10px] xs:text-xs sm:text-sm font-bold 
                               text-white hover:text-gray-900 
                               border-2 border-white/70 
                               rounded-full hover:bg-white 
                               transition-all duration-300 backdrop-blur-sm
                               whitespace-nowrap
                               active:scale-95"
                  >
                    Explore
                    <svg
                      className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-4 sm:h-4 
                                 ml-1 xs:ml-1.5 sm:ml-2 
                                 transform transition-transform duration-300 
                                 group-hover:translate-x-1 flex-shrink-0"
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
</section>
      <section>
        {/* Footer */}
        <footer className="w-full bg-white border-t border-gray-200 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-3 sm:gap-4">
            <div className="text-xs sm:text-sm text-gray-600 text-center md:text-left">
              © {new Date().getFullYear()} THE QURO – All rights reserved.
            </div>

            <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-600">
              <div  className="hover:text-gray-900">Privacy</div>
              <div  className="hover:text-gray-900">Terms</div>
              <a href="/contact" className="hover:text-gray-900">Contact</a>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};

export default Dashboard;