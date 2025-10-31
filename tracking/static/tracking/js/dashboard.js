/* ============================================================
   Live Race Dashboard JS (v4 - Final Stable)
   Handles live runner updates safely (no null lat/lon errors)
   ============================================================ */

console.log("🚀 dashboard.js LOADED from:", window.location.origin + "/static/tracking/js/dashboard.js");
console.log("🏁 Dashboard script ready");

// 🌐 WebSocket setup
const raceId = window.location.pathname.split("/").filter(Boolean).pop();
const wsUrl = `wss://${window.location.host}/ws/race/${raceId}/`;
console.log("🌐 WebSocket URL:", wsUrl);

window.socket = new WebSocket(wsUrl);

// 🗺️ Initialize map
let map = L.map("map").setView([34.0143, 71.4749], 15);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

console.log("🗺️ Leaflet map initialized");

let runners = {}; // { id: { name, marker, color } }

// 🎨 Random marker color
function getRandomColor() {
  const colors = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#007aff", "#5856d6", "#af52de"];
  return colors[Math.floor(Math.random() * colors.length)];
}

// 🏁 Update leaderboard
function updateLeaderboard(data) {
  const tbody = document.getElementById("leaderboard-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  data.sort((a, b) => b.distance_m - a.distance_m);
  data.forEach((runner, index) => {
    const pace = (runner.pace_min_km || 0).toFixed(2);
    const speed = (runner.speed_kmh || 0).toFixed(2);
    const row = `
      <tr>
        <td>${index + 1}</td>
        <td>${runner.runner_id}</td>
        <td>${runner.name}</td>
        <td>${runner.distance_m.toFixed(1)}</td>
        <td>${pace}</td>
        <td>${speed}</td>
        <td>${runner.timestamp || "-"}</td>
      </tr>`;
    tbody.insertAdjacentHTML("beforeend", row);
  });
}

// 🧠 Safe coordinate validator
function validCoords(lat, lon) {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

// 📡 Handle WebSocket messages
window.socket.onmessage = function (event) {
  try {
    const msg = JSON.parse(event.data);
    console.log("📡 Incoming WS:", msg);

    if (msg.type === "info") {
      console.log("ℹ️", msg.message);
      return;
    }

    if (msg.type === "leaderboard_snapshot" || msg.type === "leaderboard_update") {
      updateLeaderboard(msg.data);
      return;
    }

    if (msg.type === "race_update") {
      const data = msg.message || {};
      const lat = parseFloat(data.lat);
      const lon = parseFloat(data.lon);

      if (!validCoords(lat, lon)) {
        console.warn("⚠️ Ignoring invalid coordinates:", lat, lon);
        return;
      }

      // Create marker if missing
      if (!runners[data.runner_id]) {
        const color = getRandomColor();
        const marker = L.marker([lat, lon], {
          title: data.name,
          icon: L.divIcon({
            className: "runner-marker",
            html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;border:2px solid white"></div>`,
          }),
        }).addTo(map);

        runners[data.runner_id] = { name: data.name, marker, color };
        if (Object.keys(runners).length === 1) map.setView([lat, lon], 16);
        console.log(`📍 Created marker for ${data.name}`);
      } else {
        runners[data.runner_id].marker.setLatLng([lat, lon]);
      }

      updateLeaderboard([data]);
      return;
    }

    if (msg.type === "ping") return;

  } catch (err) {
    console.error("❌ WS parse error:", err);
  }
};

// ⚡ Socket lifecycle
window.socket.onopen = () => console.log("✅ WS connected");
window.socket.onclose = () => console.warn("⚠️ WS closed");
window.socket.onerror = (e) => console.error("❌ WS error:", e);
