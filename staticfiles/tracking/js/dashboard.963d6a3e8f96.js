// tracking/static/tracking/js/dashboard.js
console.log("🚀 dashboard.js LOADED from:", document.currentScript?.src || "inline");
console.log("🏁 Safe Dashboard JS loaded (debug-mode)");

// -------------------
// CONFIG
// -------------------
const WS_PROTO = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTO}://${window.location.host}/ws/race/${window.RACE_ID}/`;
console.log("🌐 WebSocket URL:", WS_URL);

// -------------------
// MAP INITIALIZATION
// -------------------
(function initMap() {
  try {
    const el = document.getElementById("map");
    if (!el) {
      console.error("❌ #map element not found in DOM yet");
      return;
    }
    window.map = L.map(el).setView([31.5204, 74.3587], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(window.map);
    console.log("🗺️ Leaflet map initialized:", window.map);
  } catch (err) {
    console.error("❌ Map init error:", err);
  }
})();

// -------------------
// GLOBALS
// -------------------
window.markers = {};
window.leaderboardData = {};
window.socket = new WebSocket(WS_URL);

// -------------------
// SOCKET EVENTS
// -------------------
window.socket.onopen = () => console.log("✅ WS connected");
window.socket.onerror = (e) => console.error("❌ WS error", e);
window.socket.onclose = () => console.warn("⚠️ WS closed");

// -------------------
// HELPERS
// -------------------
function extractCoordinates(obj) {
  if (!obj || typeof obj !== "object") return null;
  const latKeys = ["lat", "latitude", "y"];
  const lonKeys = ["lng", "lon", "longitude", "x"];
  let lat = null, lon = null;
  for (let k of latKeys) if (k in obj) lat = parseFloat(obj[k]);
  for (let k of lonKeys) if (k in obj) lon = parseFloat(obj[k]);
  if ((isNaN(lat) || isNaN(lon)) && obj.message) return extractCoordinates(obj.message);
  if ((isNaN(lat) || isNaN(lon)) && obj.payload) return extractCoordinates(obj.payload);
  if (isNaN(lat) || isNaN(lon)) return null;
  return { lat, lon };
}

function moveMarkerSmooth(marker, fromLatLng, toLatLng, duration = 1000) {
  if (!marker) return;
  const start = Date.now();
  const from = { lat: fromLatLng[0], lng: fromLatLng[1] };
  const to = { lat: toLatLng[0], lng: toLatLng[1] };

  function animate() {
    const now = Date.now();
    const t = Math.min(1, (now - start) / duration);
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;
    marker.setLatLng([lat, lng]);
    if (t < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// -------------------
// LEADERBOARD HANDLER
// -------------------
function updateLeaderboard(runnerId, name, data) {
  const tbody = document.querySelector("#leaderboard-body");
  if (!tbody) return;

  // Update local leaderboard data
  window.leaderboardData[runnerId] = {
    name,
    distance_m: data.distance_m || 0,
    pace_spm: data.pace_spm || 0,
  };

  // Sort by distance descending
  const sorted = Object.entries(window.leaderboardData)
    .sort(([, a], [, b]) => b.distance_m - a.distance_m);

  // Rebuild table body
  tbody.innerHTML = "";
  sorted.forEach(([id, r], idx) => {
    const tr = document.createElement("tr");
    tr.dataset.bib = id;
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${id}</td>
      <td>${r.name}</td>
      <td class="distance">${r.distance_m.toFixed(1)}</td>
      <td class="pace">${r.pace_spm ? r.pace_spm.toFixed(1) : "-"}</td>
    `;
    tbody.appendChild(tr);
  });

  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">No runners yet</td></tr>`;
  }
}

// -------------------
// WEBSOCKET MESSAGE HANDLER
// -------------------
window.socket.onmessage = (e) => {
  try {
    console.log("📡 Raw WS message:", e.data);
    const msg = JSON.parse(e.data);

    if (msg.type === "info") {
      console.log("ℹ️ " + msg.message);
      return;
    }

    const data = msg.message || msg.payload || msg;
    const coords = extractCoordinates(data);
    if (!coords) return console.warn("⚠️ No coordinates found:", data);

    const id = data.runner_id || data.id || "unknown";
    const name = data.name || `Runner ${id}`;
    const { lat, lon } = coords;
    const newPos = [lat, lon];

    if (!window.map) {
      console.error("❌ Map not initialized before message arrived.");
      return;
    }

    if (!window.markers[id]) {
      window.markers[id] = L.marker(newPos).addTo(window.map).bindPopup(name);
      window.map.setView(newPos, 14);
      console.log(`📍 Created marker for ${name} (${lat}, ${lon})`);
    } else {
      const cur = window.markers[id].getLatLng();
      moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], newPos, 800);
      window.markers[id].bindPopup(`${name}<br>${data.timestamp || ""}`);
    }

    // 🔁 Update live leaderboard
    updateLeaderboard(id, name, data);

  } catch (err) {
    console.error("❌ WS parse error:", err);
  }
};

// -------------------
// SIMULATION HELPER (manual testing)
// -------------------
window.simulateRunner = function (lat, lon, id = 999, name = "Sim Runner") {
  try {
    if (!window.socket) {
      console.error("❌ WebSocket not ready yet");
      return;
    }
    const fake = {
      type: "race_update",
      message: {
        runner_id: id,
        name,
        lat,
        lon,
        distance_m: Math.random() * 5000,
        pace_spm: 300 + Math.random() * 100,
        timestamp: new Date().toLocaleTimeString(),
      },
    };
    console.log("🧪 Simulating runner:", fake);
    window.socket.onmessage({ data: JSON.stringify(fake) });
  } catch (err) {
    console.error("❌ simulateRunner error:", err);
  }
};

console.log("🧪 simulateRunner() is now defined globally");
