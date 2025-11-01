console.log("🚀 dashboard.js loaded");

window.markers = {};
window.runnerData = {};

function moveMarkerSmooth(marker, fromLatLng, toLatLng, duration=1000){
    const start=Date.now(), from={lat:fromLatLng[0], lng:fromLatLng[1]}, to={lat:toLatLng[0], lng:toLatLng[1]};
    function animate(){
        const t=Math.min(1,(Date.now()-start)/duration);
        marker.setLatLng([from.lat+(to.lat-from.lat)*t, from.lng+(to.lng-from.lng)*t]);
        if(t<1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}

function geodesicDistance([lat1, lon1], [lat2, lon2]){
    const R = 6371000;
    const φ1 = lat1*Math.PI/180, φ2 = lat2*Math.PI/180;
    const Δφ=(lat2-lat1)*Math.PI/180, Δλ=(lon2-lon1)*Math.PI/180;
    const a=Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
    return R*2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function updateLeaderboard(){
    const tbody=document.querySelector("#leaderboard tbody");
    if(!tbody) return;
    const runners=Object.values(window.runnerData).sort((a,b)=>(b.distance_m||0)-(a.distance_m||0));
    tbody.innerHTML="";
    runners.forEach((r,i)=>{
        const speed=(r.pace_m_per_km? (60/r.pace_m_per_km).toFixed(1):"-");
        const tr=document.createElement("tr");
        tr.dataset.id=r.runner_id;
        let medal=""; if(i===0) medal="🥇"; else if(i===1) medal="🥈"; else if(i===2) medal="🥉";
        tr.innerHTML=`<td>${i+1}</td><td>${r.runner_id}</td><td>${medal} ${r.name}</td><td>${r.distance_m?.toFixed(1)||0}</td><td>${r.pace_m_per_km?.toFixed(1)||"-"}</td><td>${speed}</td><td>${r.timestamp||"-"}</td>`;
        tbody.appendChild(tr);
    });
}

function connectWS(){
    const proto = location.protocol==="https:"?"wss":"ws";
    const url = `${proto}://${location.host}/ws/race/${window.RACE_ID}/`;
    const socket = new WebSocket(url);

    socket.onopen = ()=>console.log("✅ WS connected");
    socket.onclose = ()=>{console.warn("⚠️ WS closed, reconnect in 2s"); setTimeout(connectWS,2000);};
    socket.onerror = e=>console.error("❌ WS error", e);

    socket.onmessage = e=>{
        const msg=JSON.parse(e.data);
        if(msg.type==="info") return;
        const data=msg.message||msg;
        const id=data.runner_id;
        const newPos=[parseFloat(data.lat),parseFloat(data.lon)];

        if(!window.markers[id]){
            window.markers[id]=L.marker(newPos).addTo(map).bindPopup(data.name);
        }else{
            const cur=window.markers[id].getLatLng();
            if(geodesicDistance([cur.lat,cur.lng],newPos)>0.5){
                moveMarkerSmooth(window.markers[id],[cur.lat,cur.lng],newPos,1000);
            }
            window.markers[id].bindPopup(`${data.name}<br>${data.timestamp}`);
        }

        window.runnerData[id]={...window.runnerData[id],...data,last_update:Date.now()};
        updateLeaderboard();
    };
}

connectWS();

(function initMap(){
    window.map=L.map('map').setView([34.0143,71.4749],14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19, attribution:"&copy; OSM contributors"}).addTo(map);
})();
