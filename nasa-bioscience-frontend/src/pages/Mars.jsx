// // src/pages/Mars.jsx
// import React from 'react';
// import PlanetPage from './Moon'; // reuse same component pattern by passing different planetName

// // If you prefer separate file with full code, you can duplicate Moon.jsx and replace "Moon" with "Mars".
// // Here we simply reuse and pass the planet name.
// export default function Mars() {
//   // The Moon.jsx file exports a component that expects a planetName prop if used directly.
//   // Because Moon.jsx exported a default function returning PlanetPage('Moon'), we can't reuse directly.
//   // So we will import Moon's component file name differently — however to keep things simple,
//   // duplicate the logic from Moon.jsx if your build fails. For now return PlanetPage('Mars') by creating new instance.

//   // Quick inline PlanetPage copy for Mars (small wrapper to avoid duplicating code).
//   // NOTE: If your bundler complains, duplicate the Moon.jsx code and replace planetName with "Mars".
//   const PlanetComponent = require('./Moon').default;
//   return <PlanetComponent planetName="Mars" />;
// }




// src/pages/Mars.jsx
import React from "react";
import PlanetPage from "../components/PlanetPage";

export default function Mars() {
  return <PlanetPage planetName="Mars" />;
}
