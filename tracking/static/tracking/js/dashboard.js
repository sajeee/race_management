console.log("🚀 dashboard.js LOADED");

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const WS_PROTO = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTO}://${window.location.host}/ws/race/${window.RACE_ID}/`;
console.log("🌐 WebSocket URL:", WS_URL);

// ------------------------------------------------------------
// MAP INITIALIZATION
// ------------------------------------------------------------
(function initMap() {
  try {
    const el = document.getElementById("map");
    if (!el) return console.error("❌ #map element missing");

    window.map = L.map(el).setView([31.5204, 74.3587], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(window.map);

    console.log("🗺️ Leaflet map initialized");
  } catch (err) {
    console.error("❌ Map init error:", err);
  }
})();

window.markers = {};
window.runnerData = {}; // memory store for all runners

// ------------------------------------------------------------
// HELPER: Smooth Marker Movement
// ------------------------------------------------------------
function moveMarkerSmooth(marker, fromLatLng, toLatLng, duration = 1000) {
  const start = Date.now();
  function animate() {
    const now = Date.now();
    const t = Math.min(1, (now - start) / duration);
    const lat = fromLatLng[0] + (toLatLng[0] - fromLatLng[0]) * t;
    const lon = fromLatLng[1] + (toLatLng[1] - fromLatLng[1]) * t;
    marker.setLatLng([lat, lon]);
    if (t < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}

// ------------------------------------------------------------
// HELPER: Update Leaderboard
// ------------------------------------------------------------
function updateLeaderboard() {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;

  const runners = Object.values(window.runnerData);
  if (!runners.length) {
    tbody.innerHTML = `<tr><td colspan="7">Waiting for runners...</td></tr>`;
    return;
  }

  runners.sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));

  tbody.innerHTML = "";
  runners.forEach((r, i) => {
    const speed = r.speed_kmh ? r.speed_kmh.toFixed(2) : "-";
    const pace = r.pace_min_km ? r.pace_min_km.toFixed(2) : "-";
    const last = r.last_update ? timeAgo(r.last_update) : "-";

    const medal = ["🥇", "🥈", "🥉"][i] || "";

    tbody.innerHTML += `
      <tr data-id="${r.runner_id}">
        <td>${i + 1}</td>
        <td>${r.runner_id}</td>
        <td>${medal} ${r.name}</td>
        <td>${r.distance_m?.toFixed(1) || 0}</td>
        <td>${pace}</td>
        <td>${speed}</td>
        <td>${last}</td>
      </tr>`;
  });
}

// ------------------------------------------------------------
// HELPER: Relative Time
// ------------------------------------------------------------
function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
setInterval(updateLeaderboard, 5000);

// ------------------------------------------------------------
// WEBSOCKET HANDLER
// ------------------------------------------------------------
window.socket = new WebSocket(WS_URL);

window.socket.onopen = () => console.log("✅ WS connected");
window.socket.onerror = (e) => console.error("❌ WS error", e);
window.socket.onclose = () => console.warn("⚠️ WS closed");

window.socket.onmessage = (e) => {
  try {
    const msg = JSON.parse(e.data);
    console.log("📡 Raw WS message:", msg);

    if (msg.type === "info" || msg.type === "ping") return;

    // ✅ Handle leaderboard snapshot/update separately (no lat/lon)
    if (msg.type === "leaderboard_snapshot" || msg.type === "leaderboard_update") {
      (msg.data || []).forEach((r) => {
        window.runnerData[r.runner_id] = {
          ...(window.runnerData[r.runner_id] || {}),
          ...r,
        };
      });
      updateLeaderboard();
      return;
    }

    // ✅ Handle location updates (race_update)
    const data = msg.message || msg;
    const lat = parseFloat(data.lat ?? data.latitude);
    const lon = parseFloat(data.lon ?? data.lng ?? data.longitude);
    if (isNaN(lat) || isNaN(lon)) return; // skip invalid coords

    const id = data.runner_id || "unknown";
    const name = data.name || `Runner ${id}`;
    const pos = [lat, lon];

    // Create or move marker
    if (!window.markers[id]) {
      window.markers[id] = L.marker(pos).addTo(window.map).bindPopup(name);
      console.log(`📍 Created marker for ${name}`);
    } else {
      const cur = window.markers[id].getLatLng();
      moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], pos);
    }

    // Update runner data
    window.runnerData[id] = {
      ...window.runnerData[id],
      ...data,
      name,
      last_update: Date.now(),
    };

    updateLeaderboard();
  } catch (err) {
    console.error("❌ WS parse error:", err);
  }
};

// ------------------------------------------------------------
// SIMULATE RUNNER (for debugging)
// ------------------------------------------------------------
window.simulateRunner = function (lat, lon, id = 999, name = "Sim Runner") {
  const fake = {
    type: "race_update",
    message: {
      runner_id: id,
      name,
      lat,
      lon,
      distance_m: Math.random() * 500,
      pace_min_km: 5 + Math.random() * 3,
      speed_kmh: 10 + Math.random() * 2,
      timestamp: new Date().toLocaleTimeString(),
    },
  };
  console.log("🧪 Simulating runner:", fake);
  window.socket.onmessage({ data: JSON.stringify(fake) });
};

console.log("🧪 simulateRunner() ready");
