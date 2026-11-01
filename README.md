# BEE RoboRescue – Autonomous Disaster Response System

Dark futuristic control platform for the **BEE** ESP32 rover (ESP32-CAM, HC-SR04, OLED).
Static app, no build step: `index.html`, `css/style.css`, `js/app.js`, `assets/rover.png`.

## Rover API used (real calls only)
`/cmd?m=F|B|L|R|S`. Success is shown only when the rover answers HTTP 200.
Optional (not in current firmware, so shown as **Unavailable** until configured in Settings):
`/distance` (number or `{"cm":n}`), `/battery` (number or `{"v":n}`), camera `/capture`.

## Deploy on Vercel
1. Push this folder to GitHub (or run `npm i -g vercel && vercel` inside it).
2. Vercel -> Add New Project -> import the repo. Framework: **Other**. Build command: empty. Output directory: `.`
3. Deploy. You get `https://your-app.vercel.app`.

## HTTPS-to-HTTP restriction (important)
Vercel serves HTTPS. Browsers block an HTTPS page from calling `http://192.168.x.x` (mixed content).
Choose one:
- **A. Local HTTP (simplest, field use):** run the app from your laptop, `npx serve .` or `python -m http.server 8080`, and open `http://localhost:8080`. Browsers allow localhost to call LAN HTTP devices (Chrome may ask for local-network permission).
- **B. Secure tunnel (use the Vercel site):** expose the rover over HTTPS with a Cloudflare Tunnel or Tailscale Funnel running on a laptop/Raspberry Pi on the rover's network, forwarding to `http://<rover-ip>`. Enter the resulting `https://...` URL in Settings. Do the same for the camera stream.
- **C. Rover on a router + local proxy:** same idea as B with Caddy/nginx on a LAN box.
Do **not** try to proxy through Vercel functions: they cannot reach private LAN addresses.

## Required firmware change (CORS)
The browser needs permission to read replies. In the ESP32 handler for `/cmd` (and any other endpoint, and the camera) add:
```cpp
server.sendHeader("Access-Control-Allow-Origin", "*");
server.sendHeader("Access-Control-Allow-Private-Network", "true");
```
and answer `OPTIONS` requests with 204 and the same headers.
Failsafe recommendation: stop the motors in firmware if no command arrives for ~1 s. The page also sends `S` on key/touch release, tab hide, window blur and page close.

## Safety behaviour
- Release, blur, tab hidden, leaving the Control tab, mode change -> `S`.
- Emergency Stop sends `S` (retries 3x), locks controls until you unlock.
- DEMO mode never calls the rover and shows a yellow banner; no fake telemetry anywhere.

## Notes
Existing source code was not supplied, so this is a clean rebuild using plain HTML, CSS and JS in separate files (deploys to Vercel unchanged).
Brand: **BEE**, project **RoboRescue**.
