console.log("🚀 Diagnostic dashboard.js loaded");

// =============================================================
// CONFIGURATION
// =============================================================
const WS_PROTO = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTO}://${window.location.host}/ws/race/${window.RACE_ID}/`;
console.log("🌐 WebSocket URL:", WS_URL);

window.runnerData = {};
window.markers = {};

// =============================================================
// MAP INITIALIZATION
// =============================================================
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

// =============================================================
// HELPER FUNCTIONS
// =============================================================
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

// =============================================================
// LEADERBOARD RENDERING
// =============================================================
function updateLeaderboard() {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;

  const runners = Object.values(window.runnerData);
  if (!runners.length) {
    tbody.innerHTML = `<tr><td colspan="7">Waiting for runners...</td></tr>`;
    return;
  }

  // sort by distance descending
  runners.sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));

  tbody.innerHTML = "";
  runners.forEach((r, i) => {
    const pace_min_km = r.pace_spm ? (r.pace_spm / 60).toFixed(2) : "-";
    const speed_kmh = r.speed_kmh
      ? r.speed_kmh.toFixed(2)
      : r.pace_spm
      ? (3600 / r.pace_spm).toFixed(2)
      : "-";

    const tr = document.createElement("tr");
    tr.dataset.id = r.runner_id;
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.runner_id}</td>
      <td>${r.name}</td>
      <td>${r.distance_m?.toFixed(1) || 0}</td>
      <td>${pace_min_km}</td>
      <td>${speed_kmh}</td>
      <td>${r.last_update ? timeAgo(r.last_update) : "-"}</td>
    `;
    tbody.appendChild(tr);
  });
}
setInterval(updateLeaderboard, 5000);

// =============================================================
// WEBSOCKET CONNECTION
// =============================================================
window.socket = new WebSocket(WS_URL);

window.socket.onopen = () => console.log("✅ WS connected");
window.socket.onerror = (e) => console.error("❌ WS error", e);
window.socket.onclose = (e) => console.warn("⚠️ WS closed", e);

window.socket.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    console.log("📡 Raw WS message:", msg);

    // skip connection message
    if (msg.type === "info") {
      console.log("ℹ️ Info message:", msg.message);
      return;
    }

    const data = msg.message || msg;
    const lat = parseFloat(data.lat ?? data.latitude);
    const lon = parseFloat(data.lon ?? data.lng ?? data.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      console.warn("⚠️ Invalid coordinates in:", data);
      return;
    }

    const id = data.runner_id;
    const name = data.name || `Runner ${id}`;
    const newPos = [lat, lon];

    // Marker create/move
    if (!window.markers[id]) {
      window.markers[id] = L.marker(newPos).addTo(window.map).bindPopup(name);
      window.map.setView(newPos, 14);
      console.log(`📍 New marker for ${name}`);
    } else {
      const cur = window.markers[id].getLatLng();
      moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], newPos, 900);
      window.markers[id].bindPopup(`${name}<br>${data.timestamp}`);
    }

    // store data
    window.runnerData[id] = {
      ...window.runnerData[id],
      ...data,
      name,
      last_update: Date.now(),
    };

    // flash leaderboard row
    const row = document.querySelector(`#leaderboard tr[data-id="${id}"]`);
    if (row) {
      row.style.transition = "background 0.5s";
      row.style.background = "yellow";
      setTimeout(() => (row.style.background = ""), 800);
    }

    updateLeaderboard();
  } catch (err) {
    console.error("❌ WS parse error", err);
  }
};

// =============================================================
// DEBUGGING TOOLS
// =============================================================
window.simulateRunner = function (lat, lon, id = 999, name = "Sim Runner") {
  const fake = {
    type: "race_update",
    message: {
      runner_id: id,
      name,
      lat,
      lon,
      distance_m: Math.random() * 5000,
      pace_spm: 360 + Math.random() * 60,
      timestamp: new Date().toLocaleTimeString(),
    },
  };
  console.log("🧪 Simulating:", fake);
  window.socket.onmessage({ data: JSON.stringify(fake) });
};

console.log("🧪 simulateRunner(lat,lon,id,name) ready");
