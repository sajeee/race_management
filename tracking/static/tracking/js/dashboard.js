console.log("🚀 Final dashboard.js loaded");

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const WS_PROTO = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTO}://${window.location.host}/ws/race/${window.RACE_ID}/`;
console.log("🌐 WebSocket URL:", WS_URL);

window.runnerData = {};
window.markers = {};

// ------------------------------------------------------------
// MAP INIT
// ------------------------------------------------------------
(function initMap() {
  const el = document.getElementById("map");
  if (!el) return console.error("❌ #map missing");
  window.map = L.map(el).setView([31.5204, 74.3587], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(window.map);
  console.log("🗺️ Map initialized");
})();

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function moveMarkerSmooth(marker, fromLatLng, toLatLng, duration = 1000) {
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

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

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
    const paceMinKm = r.pace_min_km ? r.pace_min_km.toFixed(2) : "-";
    const speedKmh = r.speed_kmh ? r.speed_kmh.toFixed(2) : "-";

    const tr = document.createElement("tr");
    tr.dataset.id = r.runner_id;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.runner_id}</td>
      <td>${r.name}</td>
      <td>${r.distance_m?.toFixed(1) || 0}</td>
      <td>${paceMinKm}</td>
      <td>${speedKmh}</td>
      <td>${r.last_update ? timeAgo(r.last_update) : "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}
setInterval(updateLeaderboard, 5000);

// ------------------------------------------------------------
// WEBSOCKET
// ------------------------------------------------------------
window.socket = new WebSocket(WS_URL);

window.socket.onopen = () => console.log("✅ WS connected");
window.socket.onerror = (e) => console.error("❌ WS error", e);
window.socket.onclose = () => console.warn("⚠️ WS closed");

window.socket.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    console.log("📡 Raw WS message:", msg);

    // Handle by type
    switch (msg.type) {
      case "info":
      case "ping":
        console.log("ℹ️", msg.message || msg.type);
        return;

      case "leaderboard_snapshot":
      case "leaderboard_update":
        (msg.data || []).forEach((r) => {
          window.runnerData[r.runner_id] = {
            ...window.runnerData[r.runner_id],
            ...r,
            last_update: Date.now(),
          };
        });
        updateLeaderboard();
        return;

      case "race_update":
        const data = msg.message;
        if (!data) return console.warn("⚠️ Empty race_update message", msg);

        const lat = parseFloat(data.lat);
        const lon = parseFloat(data.lon);
        if (isNaN(lat) || isNaN(lon)) {
          console.warn("⚠️ Invalid lat/lon:", data);
          return;
        }

        const id = data.runner_id;
        const name = data.name || `Runner ${id}`;
        const newPos = [lat, lon];

        if (!window.markers[id]) {
          window.markers[id] = L.marker(newPos).addTo(window.map).bindPopup(name);
          window.map.setView(newPos, 14);
          console.log(`📍 Created marker for ${name}`);
        } else {
          const cur = window.markers[id].getLatLng();
          moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], newPos, 900);
          window.markers[id].bindPopup(`${name}<br>${data.timestamp}`);
        }

        window.runnerData[id] = {
          ...window.runnerData[id],
          ...data,
          name,
          last_update: Date.now(),
        };
        updateLeaderboard();
        return;

      default:
        console.warn("⚠️ Unknown message type:", msg);
        return;
    }
  } catch (err) {
    console.error("❌ WS parse error:", err);
  }
};

// ------------------------------------------------------------
// SIMULATION
// ------------------------------------------------------------
window.simulateRunner = function (lat, lon, id = 999, name = "Sim Runner") {
  const fake = {
    type: "race_update",
    message: {
      runner_id: id,
      name,
      lat,
      lon,
      distance_m: Math.random() * 1000,
      pace_min_km: (4 + Math.random() * 2).toFixed(2),
      speed_kmh: (8 + Math.random() * 3).toFixed(2),
      timestamp: new Date().toLocaleTimeString(),
    },
  };
  console.log("🧪 Simulating:", fake);
  window.socket.onmessage({ data: JSON.stringify(fake) });
};

console.log("🧪 simulateRunner(lat,lon,id,name) ready");
