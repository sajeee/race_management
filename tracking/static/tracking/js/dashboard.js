// tracking/static/tracking/js/dashboard.js
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
  const el = document.getElementById("map");
  if (!el) return console.error("#map missing");
  window.map = L.map(el).setView([31.5204, 74.3587], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(window.map);
})();

window.markers = {};
window.runnerData = {};

// ------------------------------------------------------------
// SMOOTH MOVEMENT (with lock)
// ------------------------------------------------------------
function moveMarkerSmooth(marker, fromLatLng, toLatLng, duration = 1000) {
  if (marker._animating) return;
  marker._animating = true;
  const start = Date.now();
  const from = { lat: fromLatLng[0], lng: fromLatLng[1] };
  const to = { lat: toLatLng[0], lng: toLatLng[1] };
  function animate() {
    const t = Math.min(1, (Date.now() - start) / duration);
    const lat = from.lat + (to.lat - from.lat) * t;
    const lng = from.lng + (to.lng - from.lng) * t;
    marker.setLatLng([lat, lng]);
    if (t < 1) requestAnimationFrame(animate);
    else marker._animating = false;
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
  runners.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r.runner_id;
    const medal = idx===0 ? "🥇" : idx===1 ? "🥈" : idx===2 ? "🥉" : "";
    const speedKmh = r.pace_spm ? (3600 / r.pace_spm).toFixed(1) : "-";
    const ago = r.last_update ? timeAgo(r.last_update) : "-";
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${r.runner_id}</td>
      <td>${medal} ${r.name}</td>
      <td class="distance">${(r.distance_m || 0).toFixed(1)}</td>
      <td class="pace">${r.pace_spm ? r.pace_spm.toFixed(1) : "-"}</td>
      <td class="speed">${speedKmh}</td>
      <td class="ago">${ago}</td>
    `;
    tbody.appendChild(tr);
  });
  updateStatsBanner();
}

function updateStatsBanner() {
  const total = Object.keys(window.runnerData).length;
  const top = Object.values(window.runnerData).sort((a,b)=> (b.distance_m||0)-(a.distance_m||0))[0];
  const banner = document.getElementById("race-stats");
  if (banner) banner.textContent = `🏃 Runners: ${total} | 🥇 Leader: ${top?.name || "-"} (${((top?.distance_m||0)/1000).toFixed(2)} km)`;
}

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}
setInterval(() => { updateLeaderboard(); }, 5000);

// ------------------------------------------------------------
// WEBSOCKET WITH RECONNECT
// ------------------------------------------------------------
let socket = null;
let reconnectTimer = null;

function connectWS() {
  socket = new WebSocket(WS_URL);
  socket.onopen = () => {
    console.log("✅ WS connected");
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  };
  socket.onerror = (e) => console.error("❌ WS error", e);
  socket.onclose = (e) => {
    console.warn("⚠️ WS closed, reconnect in 3s", e);
    reconnectTimer = setTimeout(connectWS, 3000);
  };
  socket.onmessage = handleWSMessage;
  window.socket = socket;
}

function handleWSMessage(e) {
  try {
    const msg = JSON.parse(e.data);
    // allow either wrapper {type, message} or raw payload
    const data = msg.message || msg;
    if (msg.type === "info") return;

    const lat = parseFloat(data.lat ?? data.latitude);
    const lon = parseFloat(data.lon ?? data.lng ?? data.longitude);
    if (isNaN(lat) || isNaN(lon)) return;

    const id = data.runner_id || data.id || "unknown";
    const name = data.name || `Runner ${id}`;
    const newPos = [lat, lon];

    if (!window.markers[id]) {
      window.markers[id] = L.marker(newPos).addTo(window.map).bindPopup(name);
      window.map.setView(newPos, 14);
    } else {
      const cur = window.markers[id].getLatLng();
      moveMarkerSmooth(window.markers[id], [cur.lat, cur.lng], newPos, 800);
      window.markers[id].bindPopup(`${name}<br>${data.timestamp || "Just now"}`);
    }

    window.runnerData[id] = {
      ...window.runnerData[id],
      ...data,
      name,
      runner_id: id,
      last_update: Date.now()
    };

    highlightRow(id);
    updateLeaderboard();
  } catch (err) {
    console.error("❌ WS parse error:", err);
  }
}

function highlightRow(id) {
  const row = document.querySelector(`#leaderboard tr[data-id="${id}"]`);
  if (row) {
    row.style.transition = "background 0.5s";
    row.style.background = "yellow";
    setTimeout(()=> row.style.background = "", 800);
  }
}

connectWS();

// ------------------------------------------------------------
// simulateRunner helper (dev)
window.simulateRunner = function(lat, lon, id=999, name="Sim Runner") {
  const fake = {
    runner_id: id,
    name,
    lat,
    lon,
    distance_m: Math.random()*1000,
    pace_spm: 300 + Math.random()*100
  };
  handleWSMessage({ data: JSON.stringify(fake) });
};
