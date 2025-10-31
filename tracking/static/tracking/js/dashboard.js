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

    console.log("🗺️ Leaflet map initialized");
  } catch (err) {
    console.error("Map init failed:", err);
  }
})();

window.markers = {};
window.runnerData = JSON.parse(localStorage.getItem("runnerData") || "{}"); // persistent data

// ------------------------------------------------------------
// SMOOTH MARKER MOVEMENT
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
// LEADERBOARD UPDATE
// ------------------------------------------------------------
function updateLeaderboard() {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;

  const runners = Object.values(window.runnerData);
  runners.sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));

  tbody.innerHTML = "";
  if (runners.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">Waiting for runners...</td></tr>`;
    return;
  }

  runners.forEach((r, index) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r.runner_id;

    let medal = "";
    if (index === 0) medal = "🥇";
    else if (index === 1) medal = "🥈";
    else if (index === 2) medal = "🥉";

    const paceMinKm = r.pace_spm
      ? (r.pace_spm / 60).toFixed(1)
      : "-";
    const speedKmh =
      r.pace_spm && r.pace_spm > 0 ? (3600 / r.pace_spm).toFixed(1) : "-";
    const ago = r.last_update ? timeAgo(r.last_update) : "-";

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${r.runner_id}</td>
      <td>${medal} ${r.name}</td>
      <td>${r.distance_m?.toFixed(1) || 0}</td>
      <td>${paceMinKm}</td>
      <td>${speedKmh}</td>
      <td>${ago}</td>
    `;

    tbody.appendChild(tr);
  });
}

// ------------------------------------------------------------
// TIME UTILS
// ------------------------------------------------------------
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
function setupWebSocket() {
  const socket = new WebSocket(WS_URL);

  socket.onopen = () => {
    console.log("✅ WS connected");
    socket.isAlive = true;
  };

  socket.onerror = (e) => console.error("❌ WS error", e);

  socket.onclose = () => {
    console.warn("⚠️ WS closed — reconnecting in 5s...");
    setTimeout(setupWebSocket, 5000);
  };

  socket.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      console.log("📡 Raw WS message:", msg);

      if (msg.type === "info") {
        console.log("ℹ️", msg.message);
        return;
      }
      if (msg.type === "ping") return; // keep-alive ping

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

      // update or create marker
      if (!window.markers[id]) {
        window.markers[id] = L.marker(newPos).addTo(window.map).bindPopup(name);
        window.map.setView(newPos, 14);
        console.log(`📍 Created marker for ${name} (${lat}, ${lon})`);
      } else {
        const cur = window.markers[id].getLatLng();
        moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], newPos, 800);
        window.markers[id].bindPopup(`${name}<br>${data.timestamp || "Now"}`);
      }

      // update runner stats
      window.runnerData[id] = {
        ...window.runnerData[id],
        ...data,
        name,
        last_update: Date.now(),
      };

      // save persistently
      localStorage.setItem("runnerData", JSON.stringify(window.runnerData));

      // row highlight animation
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

  window.socket = socket;
}

setupWebSocket();

// ------------------------------------------------------------
// SIMULATION TOOL (manual testing)
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


