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
    /* Center the resizer vertically within the section and make tabs larger.
       - overall: the card area is centered and limited to a max width.
       - initial sizes more pronounced: one much smaller, one much larger.
       - on hover the hovered card expands substantially to give a long-length feel.
    */

    /* ensure the section's internal container uses most of the viewport height so centering looks natural */
    .h-center-wrap {
      min-height: calc( (100vh - 160px) ); /* makes the cards centered in the middle area; adjust if your header/footer differ */
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .resizer {
      display: flex;
      gap: 2rem; /* same visual gap as tailwind's gap-8 */
      width: 90%;
      max-width: 1200px; /* make tabs larger but constrained */
      transition: all 500ms ease;
      align-items: stretch;
      margin: 0 auto;
    }

    .res-card {
      flex: 1;
      min-width: 0;
      transition: flex 550ms cubic-bezier(.2,.8,.2,1), transform 550ms cubic-bezier(.2,.8,.2,1);
      transform-origin: center;
      will-change: transform, flex;
    }

    /* Larger card sizing — make overall tabs larger in height */
    .res-card { height: 520px; } /* increased height */

    /* initial sizes (more extreme) */
    .res-card.moon { flex: 0.6; }  /* initially noticeably smaller */
    .res-card.mars { flex: 1.4; }  /* initially noticeably larger */

    /* when hovering the container, shrink all a bit to emphasize expansion on the hovered one */
    .resizer:hover .res-card { flex: 0.6; }

    /* hovered card expands a lot to look like a long horizontal tab */
    .resizer .res-card:hover { flex: 1.8; transform: translateY(-12px); }

    /* keep background images smooth */
    .res-card .bg-cover { will-change: transform; }

    /* keyboard accessibility: focus should mirror hover */
    .resizer .res-card:focus-within,
    .resizer .res-card:focus {
      outline: none;
      flex: 1.8;
    }

    /* Round corners scale nicely */
    .res-card .rounded-3xl { overflow: hidden; }

    /* Make inner gradient overlay subtler on white background */
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

  <div className="absolute top-20 left-1/4 w-96 h-96  rounded-full blur-3xl animate-pulse"></div>
  <div className="absolute top-1/3 right-1/4 w-96 h-96  rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
  <div className="absolute bottom-1/4 left-1/3 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>

  <div className="max-w-7xl mx-auto relative z-10 flex flex-col h-full">
    <div className="mt-16 text-center">
      <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
        Planetary Bioscience Hubs
      </h2>
      <div className="w-32 h-1  mx-auto"></div>
    </div>

    {/* Centering wrapper so the tabs sit in the middle of the page area */}
    <div className="h-center-wrap">
      {/* Use the resizer class for the flex behavior handled by the CSS above */}
      <div className="resizer">
        {/* Moon Hub (initially smaller) */}
        <Link
          to="/moon"
          className="res-card group relative block overflow-hidden transition-all duration-500 transform rounded-3xl shadow-2xl moon"
          tabIndex={0}
          aria-label="Moon Bioscience Hub"
        >
          <div
            className="absolute inset-0 bg-cover bg-center transform group-hover:scale-110 transition-transform duration-700"
            style={{ backgroundImage: 'url(/images/moon.jpeg)' }}
          ></div>

          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-gray-900/70 to-black/60"></div>

          <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 
                          "></div>

          <div className="absolute inset-0 rounded-3xl border-2 "></div>

          <div className="relative z-10 p-8 flex flex-col justify-between h-full">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white drop-shadow-2xl mb-4 
                             group-hover:text-blue-100 transition-all duration-500">
                Moon Bioscience Hub
              </h2>
              <p className="text-gray-100 text-lg leading-relaxed font-medium drop-shadow-lg group-hover:text-white transition-colors duration-300">
                Curated research and analytics relevant to lunar exploration and biology.
              </p>

              <div className="mt-6">
                <span className="text-5xl md:text-6xl font-extrabold text-white drop-shadow-2xl
                                 group-hover:text-green-300 transition-all duration-500">
                  {moonCount.toLocaleString()}
                </span>
                <span className="text-lg text-blue-200 ml-3 font-semibold drop-shadow-lg">
                  publications (approx.)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <span className="text-lg text-gray-100 font-medium drop-shadow-lg">
                Explore lunar bioscience publications
              </span>
              <span className="text-xl font-bold text-blue-300 drop-shadow-lg group-hover:translate-x-3">
                Go to Moon →
              </span>
            </div>
          </div>
        </Link>

        {/* Mars Hub (initially larger) */}
        <Link
          to="/mars"
          className="res-card group relative block overflow-hidden transition-all duration-500 transform rounded-3xl shadow-2xl mars"
          tabIndex={0}
          aria-label="Mars Bioscience Hub"
        >
          <div
            className="absolute inset-0 bg-cover bg-center transform group-hover:scale-110 transition-transform duration-700"
            style={{ backgroundImage: 'url(/images/mars1.jpeg)' }}
          ></div>

          <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-gray-900/70 to-black/60"></div>

          <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 
                          "></div>

          <div className="absolute inset-0 rounded-3xl border-2  
                          "></div>

          <div className="relative z-10 p-8 flex flex-col justify-between h-full">
            <div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white drop-shadow-2xl mb-4 
                             group-hover:text-red-100 transition-all duration-500">
                Mars Bioscience Hub
              </h2>
              <p className="text-gray-100 text-lg leading-relaxed font-medium drop-shadow-lg group-hover:text-white transition-colors duration-300">
                Curated research and analytics focused on Mars-relevant biological studies.
              </p>

              <div className="mt-6">
                <span className="text-5xl md:text-6xl font-extrabold text-white drop-shadow-2xl
                                ">
                  {marsCount.toLocaleString()}
                </span>
                <span className="text-lg text-red-200 ml-3 font-semibold drop-shadow-lg">
                  publications (approx.)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <span className="text-lg text-gray-100 font-medium drop-shadow-lg">
                Explore Mars bioscience publications
              </span>
              <span className="text-xl font-bold text-red-300 drop-shadow-lg group-hover:translate-x-3">
                Go to Mars →
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