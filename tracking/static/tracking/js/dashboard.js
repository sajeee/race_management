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
  if (!el) return console.error("❌ #map element missing");
  window.map = L.map(el).setView([31.5204, 74.3587], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
  }).addTo(window.map);
  console.log("🗺️ Map ready");
})();

window.markers = {};
window.runnerData = {};

// ------------------------------------------------------------
// Smooth marker movement
// ------------------------------------------------------------
function moveMarkerSmooth(marker, fromLatLng, toLatLng, duration = 1000) {
  const start = Date.now();
  const from = {lat: fromLatLng[0], lng: fromLatLng[1]};
  const to = {lat: toLatLng[0], lng: toLatLng[1]};
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
// Leaderboard update
// ------------------------------------------------------------
function updateLeaderboard() {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;
  const runners = Object.values(window.runnerData);
  runners.sort((a,b) => (b.distance_m||0) - (a.distance_m||0));
  tbody.innerHTML = "";
  runners.forEach((r,index) => {
    const medal = index===0?"🥇":index===1?"🥈":index===2?"🥉":"";
    const speedKmh = r.pace_m_per_km && r.pace_m_per_km>0 ? (60/r.pace_m_per_km).toFixed(1) : "-";
    const ago = r.last_update ? timeAgo(r.last_update) : "-";
    const tr = document.createElement("tr");
    tr.dataset.id = r.runner_id;
    tr.innerHTML = `
      <td>${index+1}</td>
      <td>${r.runner_id}</td>
      <td>${medal} ${r.name}</td>
      <td class="distance">${r.distance_m?.toFixed(1)||0}</td>
      <td class="pace">${r.pace_m_per_km?.toFixed(2)||"-"}</td>
      <td class="speed">${speedKmh}</td>
      <td class="ago">${ago}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Relative time
function timeAgo(ts){const diff=(Date.now()-ts)/1000;return diff<60?`${Math.floor(diff)}s ago`:diff<3600?`${Math.floor(diff/60)}m ago`:`${Math.floor(diff/3600)}h ago`; }
setInterval(updateLeaderboard,5000);

// ------------------------------------------------------------
// WebSocket
// ------------------------------------------------------------
window.socket = new WebSocket(WS_URL);
window.socket.onopen = () => console.log("✅ WS connected");
window.socket.onclose = () => console.warn("⚠️ WS closed");
window.socket.onerror = e => console.error("❌ WS error", e);

window.socket.onmessage = e=>{
  try{
    const msg=JSON.parse(e.data);
    if(msg.type==="info") return;
    const data=msg.message||msg;
    const lat=parseFloat(data.lat), lon=parseFloat(data.lon);
    if(isNaN(lat)||isNaN(lon)) return console.warn("⚠️ Invalid coords",data);
    const id=data.runner_id||"unknown", name=data.name||`Runner ${id}`;
    const newPos=[lat,lon];
    if(!window.markers[id]){
      window.markers[id]=L.marker(newPos).addTo(window.map).bindPopup(name);
      window.map.setView(newPos,14);
    }else{
      const cur=window.markers[id].getLatLng();
      moveMarkerSmooth(window.markers[id],[cur.lat,cur.lng],newPos,800);
      window.markers[id].bindPopup(`${name}<br>${data.timestamp||"Just now"}`);
    }
    window.runnerData[id]={...window.runnerData[id],...data,name,last_update:Date.now()};
    const row=document.querySelector(`#leaderboard tr[data-id="${id}"]`);
    if(row){row.style.transition="background 0.5s"; row.style.background="yellow"; setTimeout(()=>row.style.background="",800);}
    updateLeaderboard();
  }catch(err){console.error("❌ WS parse error:",err);}
};

// ------------------------------------------------------------
// Simulate runner
// ------------------------------------------------------------
window.simulateRunner=(lat,lon,id=999,name="Sim Runner")=>{
  const fake={type:"race_update",message:{runner_id:id,name,lat,lon,distance_m:Math.random()*1000,pace_m_per_km:5+Math.random()*1,timestamp:new Date().toLocaleTimeString()}};
  window.socket.onmessage({data:JSON.stringify(fake)});
};
console.log("🧪 simulateRunner() ready");
