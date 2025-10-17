# simulator.py
import time, requests, random

RACE_ID = 1
URL = f"http://127.0.0.1:8000/api/tracking/{RACE_ID}/post_location/"

# runners by bib with starting coords
runners = [
    {'bib': 101, 'lat': 31.5204, 'lon': 74.3587},
    {'bib': 102, 'lat': 31.5220, 'lon': 74.3600},
    {'bib': 103, 'lat': 31.5180, 'lon': 74.3550},
]

def step(r):
    # small random step in lat/lon (not accurate, good enough for sim)
    r['lat'] += (random.random() - 0.5) / 5000.0
    r['lon'] += (random.random() - 0.5) / 5000.0
    payload = {'runner_bib': r['bib'], 'lat': r['lat'], 'lon': r['lon']}
    try:
        resp = requests.post(URL, json=payload, timeout=5)
        print("POST", payload, resp.status_code, resp.text)
    except Exception as e:
        print("ERR", e)

if __name__ == "__main__":
    while True:
        for rr in runners:
            step(rr)
        time.sleep(2)
