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

window.socket.onmessage = function (event) {
  try {
    const msg = JSON.parse(event.data);
    console.log("📡 Raw WS message:", msg);

    if (msg.type === "info") {
      console.log("ℹ️", msg.message);
      return;
    }

    // 🏁 Leaderboard snapshot
    if (msg.type === "leaderboard_snapshot" || msg.type === "leaderboard_update") {
      updateLeaderboard(msg.data);
      return;
    }

    // 📍 Race update (runner position)
    if (msg.type === "race_update") {
      const data = msg.message;
      if (!data.lat || !data.lon) {
        console.warn("⚠️ Missing coordinates in race_update:", data);
        return;
      }

      if (!runners[data.runner_id]) {
        // 🆕 Create marker for this runner if not exists
        const color = getRandomColor();
        const marker = L.marker([data.lat, data.lon], {
          title: data.name,
          icon: L.divIcon({
            className: "runner-marker",
            html: `<div style="background:${color};width:12px;height:12px;border-radius:50%;"></div>`,
          }),
        }).addTo(map);

        runners[data.runner_id] = {
          name: data.name,
          marker: marker,
          color: color,
        };
      } else {
        // 🏃 Move existing marker
        runners[data.runner_id].marker.setLatLng([data.lat, data.lon]);
      }

      // Center map smoothly on runner if it's the first one
      if (Object.keys(runners).length === 1) {
        map.setView([data.lat, data.lon], 16);
      }

      updateLeaderboardRow(data);
      return;
    }

    if (msg.type === "ping") return; // Ignore pings

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
