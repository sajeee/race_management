/* ============================================================
   🚀 Race Dashboard (Redis Channels Compatible)
   Smooth marker updates + live leaderboard with pace/speed
   ============================================================ */

console.log("🚀 dashboard.js LOADED from:", window.location.href);
console.log("🏁 Safe Dashboard JS loaded");

// --- WebSocket setup ---
const raceId = window.location.pathname.split("/").filter(Boolean).pop();
const wsUrl =
  (window.location.protocol === "https:" ? "wss://" : "ws://") +
  window.location.host +
  `/ws/race/${raceId}/`;

console.log("🌐 WebSocket URL:", wsUrl);

let map, runners = {}, markers = {}, leaderboardBody;

// --- Initialize map ---
document.addEventListener("DOMContentLoaded", () => {
  map = L.map("map").setView([34.0143, 71.4749], 17);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
  }).addTo(map);
  console.log("🗺️ Leaflet map initialized");

  leaderboardBody = document.querySelector("#leaderboard-body");
  connectSocket();
});

// --- Connect WS ---
function connectSocket() {
  const socket = new WebSocket(wsUrl);
  window.socket = socket;

  socket.onopen = () => {
    console.log("✅ WS connected");
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log("📡 Raw WS message:", data);

      if (data.type === "info") {
        console.log("ℹ️ " + data.message);
        return;
      }

      updateRunner(data);
    } catch (e) {
      console.warn("⚠️ WS parse error", e);
    }
  };

  socket.onerror = (err) => {
    console.error("❌ WS error", err);
  };

  socket.onclose = () => {
    console.warn("⚠️ WS closed — reconnecting in 3s…");
    setTimeout(connectSocket, 3000);
  };
}

// --- Update or create runner marker ---
function updateRunner(data) {
  const { runner_id, name, lat, lon, distance_m, pace_m_per_km, timestamp } = data;
  const id = String(runner_id);

  if (!runners[id]) {
    runners[id] = { name, totalDist: 0, lastLat: lat, lastLon: lon, lastTime: timestamp };
  }

  const runner = runners[id];
  runner.name = name;
  runner.lat = lat;
  runner.lon = lon;
  runner.timestamp = timestamp;

  // Calculate incremental distance (reset on fresh start)
  const d = haversine(runner.lastLat, runner.lastLon, lat, lon);
  if (d < 100) runner.totalDist += d; // ignore teleports
  runner.lastLat = lat;
  runner.lastLon = lon;

  // Calculate pace & speed
  const paceMinPerKm = pace_m_per_km ? (pace_m_per_km / 1000).toFixed(2) : ((1000 / (pace_m_per_km || 1)).toFixed(2));
  const speedKmH = pace_m_per_km ? (60 / pace_m_per_km).toFixed(2) : 0;

  runner.pace = isFinite(paceMinPerKm) ? paceMinPerKm : "—";
  runner.speed = isFinite(speedKmH) ? speedKmH : "—";

  // Marker management
  if (!markers[id]) {
    const marker = L.marker([lat, lon]).addTo(map);
    marker.bindPopup(`<b>${name}</b>`);
    markers[id] = marker;
    console.log(`📍 Created marker for ${name} (${lat}, ${lon})`);
  } else {
    const marker = markers[id];
    smoothMove(marker, lat, lon);
  }

  renderLeaderboard();
}

// --- Smooth movement ---
function smoothMove(marker, lat, lon) {
  const start = marker.getLatLng();
  const end = L.latLng(lat, lon);
  const duration = 1000;
  const startTime = performance.now();

  function animate(time) {
    const t = Math.min((time - startTime) / duration, 1);
    marker.setLatLng([
      start.lat + (end.lat - start.lat) * t,
      start.lng + (end.lng - start.lng) * t,
    ]);
    if (t < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// --- Render leaderboard ---
function renderLeaderboard() {
  const arr = Object.entries(runners).map(([id, r]) => ({
    id,
    name: r.name,
    dist: r.totalDist,
    pace: r.pace,
    speed: r.speed,
    time: r.timestamp,
  }));

  arr.sort((a, b) => b.dist - a.dist);

  if (!arr.length) {
    leaderboardBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No runners yet</td></tr>`;
    return;
  }

  leaderboardBody.innerHTML = arr
    .map(
      (r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.id}</td>
      <td>${r.name}</td>
      <td>${r.dist.toFixed(1)}</td>
      <td>${r.pace}</td>
      <td>${r.speed}</td>
      <td>${r.time.split("T").pop().split(".")[0]}</td>
    </tr>`
    )
    .join("");
}

// --- Utility: distance (Haversine) ---
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- For testing offline ---
window.simulateRunner = function () {
  console.log("🧪 simulateRunner() called");
  let lat = 34.0143,
    lon = 71.4749;
  setInterval(() => {
    lat += (Math.random() - 0.5) * 0.0001;
    lon += (Math.random() - 0.5) * 0.0001;
    const fakeData = {
      runner_id: 1,
      name: "Syed Sajid Shah",
      lat,
      lon,
      distance_m: Math.random() * 100,
      pace_m_per_km: 5.2,
      timestamp: new Date().toISOString(),
    };
    updateRunner(fakeData);
  }, 2000);
  console.log("🧪 simulateRunner() is now defined globally");
};
