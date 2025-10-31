console.log("🚀 dashboard.js LOADED (live-safe version)");

const WS_PROTO = window.location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTO}://${window.location.host}/ws/race/${window.RACE_ID}/`;
console.log("🌐 WebSocket URL:", WS_URL);

window.map = L.map("map").setView([31.5204, 74.3587], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(window.map);

window.markers = {};
window.runnerData = {};

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

function updateLeaderboard() {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;

  const runners = Object.values(window.runnerData);
  runners.sort((a, b) => (b.distance_m || 0) - (a.distance_m || 0));

  tbody.innerHTML = "";
  runners.forEach((r, index) => {
    const medal = ["🥇", "🥈", "🥉"][index] || "";
    const pace = r.pace_min_km ? r.pace_min_km.toFixed(1) : "-";
    const speed = r.speed_kmh ? r.speed_kmh.toFixed(1) : "-";
    const ago = r.last_update ? timeAgo(r.last_update) : "-";

    tbody.innerHTML += `
      <tr data-id="${r.runner_id}">
        <td>${index + 1}</td>
        <td>${r.runner_id}</td>
        <td>${medal} ${r.name}</td>
        <td>${r.distance_m?.toFixed(1) || 0}</td>
        <td>${pace}</td>
        <td>${speed}</td>
        <td>${ago}</td>
      </tr>`;
  });
}

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

setInterval(updateLeaderboard, 5000);

window.socket = new WebSocket(WS_URL);

window.socket.onopen = () => console.log("✅ WS connected");
window.socket.onerror = (e) => console.error("❌ WS error", e);
window.socket.onclose = () => console.warn("⚠️ WS closed");

window.socket.onmessage = (e) => {
  try {
    const msg = JSON.parse(e.data);
    console.log("📡 Raw WS message:", msg);

    // Ignore server pings or info
    if (msg.type === "ping" || msg.type === "info") return;

    // Handle leaderboard snapshots (no coords)
    if (msg.type === "leaderboard_snapshot" || msg.type === "leaderboard_update") {
      msg.data.forEach((runner) => {
        if (!window.runnerData[runner.runner_id]) {
          window.runnerData[runner.runner_id] = { ...runner, last_update: Date.now() };
        } else {
          Object.assign(window.runnerData[runner.runner_id], runner);
        }
      });
      updateLeaderboard();
      return;
    }

    // Handle race updates with coordinates
    const data = msg.message || msg;
    if (!data.lat || !data.lon) {
      console.warn("⚠️ Skipping message without lat/lon:", data);
      return;
    }

    const id = data.runner_id;
    const name = data.name || `Runner ${id}`;
    const newPos = [parseFloat(data.lat), parseFloat(data.lon)];

    // Place or move marker
    if (!window.markers[id]) {
      window.markers[id] = L.marker(newPos).addTo(window.map).bindPopup(name);
      console.log(`📍 Created marker for ${name} (${newPos})`);
    } else {
      const cur = window.markers[id].getLatLng();
      moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], newPos, 800);
    }

    // Update popup info
    window.markers[id].bindPopup(
      `${name}<br>${data.distance_m.toFixed(1)} m<br>Pace: ${
        data.pace_min_km?.toFixed(1) || "-"
      } min/km<br>${data.timestamp}`
    );

    // Update data for leaderboard
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

window.simulateRunner = function (lat, lon, id = 999, name = "Sim Runner") {
  const fake = {
    type: "race_update",
    message: {
      runner_id: id,
      name,
      lat,
      lon,
      distance_m: Math.random() * 1000,
      pace_min_km: 5 + Math.random() * 2,
      speed_kmh: 10 + Math.random() * 5,
      timestamp: new Date().toLocaleTimeString(),
    },
  };
  console.log("🧪 Simulating runner:", fake);
  window.socket.onmessage({ data: JSON.stringify(fake) });
};

console.log("🧪 simulateRunner() ready");
