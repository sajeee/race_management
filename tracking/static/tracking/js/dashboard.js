console.log("🚀 Enhanced dashboard.js loaded");

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const WS_PROTO = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTO}://${window.location.host}/ws/race/${window.RACE_ID}/`;
console.log("🌐 WebSocket URL:", WS_URL);

window.markers = {};
window.runnerData = {};

// ------------------------------------------------------------
// MAP INITIALIZATION
// ------------------------------------------------------------
(function initMap() {
  try {
    const el = document.getElementById("map");
    if (!el) return console.error("❌ #map element missing");

    window.map = L.map(el).setView([31.5204, 74.3587], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(window.map);

    console.log("🗺️ Map ready");
  } catch (err) {
    console.error("❌ Map init failed:", err);
  }
})();

// ------------------------------------------------------------
// MARKER MOVEMENT (smooth animation)
// ------------------------------------------------------------
function moveMarkerSmooth(marker, fromLatLng, toLatLng, duration = 1000) {
  const start = Date.now();
  const from = { lat: fromLatLng[0], lng: fromLatLng[1] };
  const to = { lat: toLatLng[0], lng: toLatLng[1] };

  function animate() {
    const t = Math.min(1, (Date.now() - start) / duration);
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;
    marker.setLatLng([lat, lng]);
    if (t < 1) requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}

// ------------------------------------------------------------
// LEADERBOARD MANAGEMENT
// ------------------------------------------------------------
function updateLeaderboard() {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;

  const runners = Object.values(window.runnerData);
  runners.sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));
  tbody.innerHTML = "";

  runners.forEach((r, index) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r.runner_id;

    // 🥇 top 3 medals
    const medal = ["🥇", "🥈", "🥉"][index] || "";

    const paceMinPerKm = r.pace_spm
      ? (r.pace_spm / 60).toFixed(2)
      : "-";
    const speedKmh = r.speed_kmh
      ? r.speed_kmh.toFixed(2)
      : (r.pace_spm ? (3600 / r.pace_spm).toFixed(2) : "-");

    const ago = r.last_update ? timeAgo(r.last_update) : "-";

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${r.runner_id}</td>
      <td>${medal} ${r.name}</td>
      <td class="distance">${(r.distance_m || 0).toFixed(1)}</td>
      <td class="pace">${paceMinPerKm}</td>
      <td class="speed">${speedKmh}</td>
      <td class="ago">${ago}</td>
    `;
    tbody.appendChild(tr);
  });
}

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
setInterval(updateLeaderboard, 5000);

// ------------------------------------------------------------
// WEBSOCKET SETUP
// ------------------------------------------------------------
window.socket = new WebSocket(WS_URL);

socket.onopen = () => console.log("✅ WS connected");
socket.onerror = (e) => console.error("❌ WS error", e);
socket.onclose = () => console.warn("⚠️ WS closed");

socket.onmessage = (e) => {
  try {
    const msg = JSON.parse(e.data);
    console.log("📡 WS message:", msg);

    switch (msg.type) {
      case "info":
        console.log("ℹ️", msg.message);
        break;

      case "leaderboard_snapshot":
      case "leaderboard_update":
        handleLeaderboard(msg.data);
        break;

      case "race_update":
        handleRaceUpdate(msg.data);
        break;

      default:
        console.warn("⚠️ Unknown message type:", msg.type);
    }
  } catch (err) {
    console.error("❌ WS parse error:", err);
  }
};

// ------------------------------------------------------------
// HANDLE LEADERBOARD SNAPSHOT
// ------------------------------------------------------------
function handleLeaderboard(entries) {
  if (!Array.isArray(entries)) return;
  entries.forEach((r) => {
    window.runnerData[r.runner_id] = {
      ...window.runnerData[r.runner_id],
      ...r,
      last_update: Date.now(),
    };
  });
  updateLeaderboard();
}

// ------------------------------------------------------------
// HANDLE LIVE RACE UPDATE
// ------------------------------------------------------------
function handleRaceUpdate(data) {
  const id = data.runner_id;
  const name = data.name || `Runner ${id}`;
  const lat = parseFloat(data.lat);
  const lon = parseFloat(data.lon);
  if (isNaN(lat) || isNaN(lon)) return;

  const newPos = [lat, lon];

  if (!window.markers[id]) {
    window.markers[id] = L.marker(newPos)
      .addTo(window.map)
      .bindPopup(name);
  } else {
    const cur = window.markers[id].getLatLng();
    moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], newPos, 800);
  }

  window.runnerData[id] = {
    ...window.runnerData[id],
    ...data,
    name,
    last_update: Date.now(),
  };

  updateLeaderboard();
}

// ------------------------------------------------------------
// SIMULATION TOOL (manual testing)
// ------------------------------------------------------------
window.simulateRunner = function (lat, lon, id = 999, name = "Sim Runner") {
  const fake = {
    type: "race_update",
    data: {
      runner_id: id,
      name,
      lat,
      lon,
      distance_m: Math.random() * 1000,
      pace_spm: 300 + Math.random() * 100,
      timestamp: new Date().toLocaleTimeString(),
    },
  };
  console.log("🧪 Simulating runner:", fake);
  handleRaceUpdate(fake.data);
};
console.log("🧪 simulateRunner() ready");

