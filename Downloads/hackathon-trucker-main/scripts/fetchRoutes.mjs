import https from "https";
import fs from "fs";

function fetchRoute(startLng, startLat, endLng, endLat) {
  return new Promise((resolve, reject) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) { reject(e); }
      });
    }).on("error", reject);
  });
}

async function run() {
  const routes = [
    { id: 'driver-green', start: [-112.074, 33.4484], end: [-112.5838, 33.3703] }, // Phoenix to Buckeye
    { id: 'driver-yellow', start: [-112.074, 33.4484], end: [-112.1350, 33.8647] }, // Phoenix to Anthem
    { id: 'driver-red', start: [-112.2543, 33.4606], end: [-112.0833, 33.4481] } // Tolleson to Phoenix
  ];

  const results = {};
  for (const r of routes) {
    console.log(`Fetching route for ${r.id}...`);
    try {
      const data = await fetchRoute(r.start[0], r.start[1], r.end[0], r.end[1]);
      if (data.code === "Ok" && data.routes && data.routes.length > 0) {
        // Reverse coordinates since GeoJSON returns [lng, lat], but map needs [lat, lng] usually
        results[r.id] = data.routes[0].geometry.coordinates.map(coord => [coord[1], coord[0]]);
        console.log(`Found ${results[r.id].length} points for ${r.id}`);
      } else {
        console.error(`Failed to fetch for ${r.id}:`, data);
      }
    } catch(e) {
      console.error(e);
    }
  }
  fs.writeFileSync('/Users/tonnguyen/Downloads/hackathon-trucker-main/src/mocks/routeData.json', JSON.stringify(results, null, 2));
  console.log("Written to routeData.json");
}

run();
