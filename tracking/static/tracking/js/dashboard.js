console.log("🚀 Enhanced dashboard.js loaded");

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
    if (!el) return console.error("❌ #map element missing in DOM");

    window.map = L.map(el).setView([31.5204, 74.3587], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(window.map);

    console.log("🗺️ Map ready");
  } catch (err) {
    console.error("Map init failed:", err);
  }
})();

window.markers = {};
window.runnerData = {}; // store all runner data centrally

// ------------------------------------------------------------
// SMOOTH MOVEMENT
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

// ------------------------------------------------------------
// LEADERBOARD UPDATE + SORT
// ------------------------------------------------------------
function updateLeaderboard() {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;

  const runners = Object.values(window.runnerData);

  // Sort by distance (descending)
  runners.sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));

  // Clear existing rows
  tbody.innerHTML = "";

  runners.forEach((r, index) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r.runner_id;

    // Medal emoji for top 3
    let medal = "";
    if (index === 0) medal = "🥇";
    else if (index === 1) medal = "🥈";
    else if (index === 2) medal = "🥉";

    // Speed (km/h)
    const speedKmh =
      r.pace_spm && r.pace_spm > 0 ? (3600 / r.pace_spm).toFixed(1) : "-";

    // Last update (relative)
    const ago = r.last_update ? timeAgo(r.last_update) : "-";

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${r.runner_id}</td>
      <td>${medal} ${r.name}</td>
      <td class="distance">${r.distance_m?.toFixed(1) || 0}</td>
      <td class="pace">${r.pace_spm?.toFixed(1) || "-"}</td>
      <td class="speed">${speedKmh}</td>
      <td class="ago">${ago}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ------------------------------------------------------------
// RELATIVE TIME HELPER
// ------------------------------------------------------------
function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
setInterval(updateLeaderboard, 5000); // refresh "ago" every 5s

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
    console.log("📡 WS message:", msg);

    if (msg.type === "info") return;

    const data = msg.message || msg;
    const lat = parseFloat(data.lat ?? data.latitude);
    const lon = parseFloat(data.lon ?? data.lng ?? data.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      console.warn("⚠️ Invalid coordinates in:", data);
      return;
    }

    const id = data.runner_id || data.id || "unknown";
    const name = data.name || `Runner ${id}`;
    const newPos = [lat, lon];

    // Update marker
    if (!window.markers[id]) {
      window.markers[id] = L.marker(newPos)
        .addTo(window.map)
        .bindPopup(name);
      window.map.setView(newPos, 14);
      console.log(`📍 Created marker for ${name}`);
    } else {
      const cur = window.markers[id].getLatLng();
      moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], newPos, 800);
      window.markers[id].bindPopup(
        `${name}<br>${data.timestamp || "Just now"}`
      );
    }

    // Save runner data
    window.runnerData[id] = {
      ...window.runnerData[id],
      ...data,
      name,
      last_update: Date.now(),
    };

    // Highlight effect
    const row = document.querySelector(`#leaderboard tr[data-id="${id}"]`);
    if (row) {
      row.style.transition = "background 0.5s";
      row.style.background = "yellow";
      setTimeout(() => (row.style.background = ""), 800);
    }

    updateLeaderboard();
  } catch (err) {
    console.error("❌ WS parse error:", err);
  }
};

// ------------------------------------------------------------
// SIMULATE RUNNER (testing helper)
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
      pace_spm: 300 + Math.random() * 100,
      timestamp: new Date().toLocaleTimeString(),
    },
  };
  console.log("🧪 Simulating runner:", fake);
  window.socket.onmessage({ data: JSON.stringify(fake) });
};
console.log("🧪 simulateRunner() ready");
