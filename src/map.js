/**
 * Radar-style canvas map renderer.
 * Coordinate system: lon/lat → canvas x/y with a Mercator-ish linear projection.
 */

// Simplified Israel border polygon  [lon, lat]  clockwise from NW coast
const ISRAEL_POLY = [
    [34.95, 33.09],   // Rosh HaNikra (NW)
    [35.10, 33.22],   // Near Metula
    [35.35, 33.27],   // Northern border
    [35.68, 33.25],   // NE (upper Golan)
    [35.92, 33.06],   // Golan east
    [35.87, 32.93],   // Golan south
    [35.68, 32.70],   // East of Sea of Galilee
    [35.57, 32.40],   // Jordan River valley
    [35.57, 31.95],   // Central Jordan Valley
    [35.55, 31.60],   // NW Dead Sea
    [35.55, 31.50],   // Dead Sea mid
    [35.46, 31.10],   // Dead Sea south
    [35.35, 30.87],   // Arava south
    [34.95, 29.56],   // Eilat (S tip)
    [34.78, 29.55],   // Gulf of Aqaba coast
    [34.27, 29.55],   // Egypt–Israel border (Sinai)
    [34.27, 30.88],   // Negev highlands
    [34.23, 31.22],   // Rafah corner
    [34.37, 31.35],   // Near Gaza strip
    [34.48, 31.55],   // Near Ashdod
    [34.66, 31.90],   // South Tel Aviv
    [34.77, 32.07],   // Tel Aviv coast
    [34.87, 32.52],   // Netanya
    [34.95, 32.82],   // Haifa bay
    [35.07, 33.00],   // Haifa north coast
    [34.95, 33.09],   // close
];

const PAD = 50; // canvas padding px

export class MapRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx    = canvas.getContext('2d');
        this.scale  = 1;
        this.ox     = 0;   // lon offset
        this.oy     = 0;   // lat offset (screen flipped)
        this._computeTransform();
    }

    resize() {
        this.canvas.width  = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        this._computeTransform();
    }

    _computeTransform() {
        const lons  = ISRAEL_POLY.map(p => p[0]);
        const lats  = ISRAEL_POLY.map(p => p[1]);
        const minLon = Math.min(...lons), maxLon = Math.max(...lons);
        const minLat = Math.min(...lats), maxLat = Math.max(...lats);

        const W = this.canvas.width  - PAD * 2;
        const H = this.canvas.height - PAD * 2;

        const sx = W / (maxLon - minLon);
        const sy = H / (maxLat - minLat);
        this.scale = Math.min(sx, sy);

        const mw = (maxLon - minLon) * this.scale;
        const mh = (maxLat - minLat) * this.scale;

        // ox, oy chosen so the map is centred within the padded area
        this.ox = PAD + (W - mw) / 2 - minLon * this.scale;
        // oy is the y value at lat=0; latitude grows up, y grows down
        this.oy = this.canvas.height - PAD - (H - mh) / 2 + minLat * this.scale;

        this._bounds = { minLon, maxLon, minLat, maxLat };
    }

    ll2px(lat, lon) {
        return {
            x: lon * this.scale + this.ox,
            y: this.oy - lat * this.scale,
        };
    }

    // ── Clear ──────────────────────────────────────────────────────────────────
    clear() {
        const ctx = this.ctx;
        ctx.fillStyle = '#050510';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle radar sweep overlay
        this._drawRadarGrid();
    }

    _drawRadarGrid() {
        const ctx = this.ctx;
        const { minLon, maxLon, minLat, maxLat } = this._bounds;

        ctx.save();
        ctx.strokeStyle = 'rgba(0,80,60,0.18)';
        ctx.lineWidth   = 0.5;

        // Lat lines every 0.5°
        for (let lat = Math.ceil(minLat * 2) / 2; lat <= maxLat; lat += 0.5) {
            const { y } = this.ll2px(lat, 0);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
        // Lon lines every 0.5°
        for (let lon = Math.ceil(minLon * 2) / 2; lon <= maxLon; lon += 0.5) {
            const { x } = this.ll2px(0, lon);
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ── Country outline ────────────────────────────────────────────────────────
    drawBorder() {
        const ctx = this.ctx;
        ctx.beginPath();
        for (let i = 0; i < ISRAEL_POLY.length; i++) {
            const [lon, lat] = ISRAEL_POLY[i];
            const { x, y } = this.ll2px(lat, lon);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();

        ctx.fillStyle   = 'rgba(255,255,255,0.025)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth   = 1.5;
        ctx.stroke();
    }

    // ── Waypoints ──────────────────────────────────────────────────────────────
    drawWaypoints(waypoints) {
        const ctx = this.ctx;
        ctx.save();
        for (const [name, wp] of Object.entries(waypoints)) {
            const { x, y } = this.ll2px(wp.lat, wp.lon);

            // cross symbol
            ctx.strokeStyle = 'rgba(80,100,255,0.65)';
            ctx.lineWidth   = 1;
            ctx.beginPath();
            ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
            ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6);
            ctx.stroke();

            ctx.fillStyle = 'rgba(100,130,255,0.85)';
            ctx.font      = '9px Courier New';
            ctx.fillText(name, x + 7, y - 3);
        }
        ctx.restore();
    }

    // ── Planned routes (dashed) ────────────────────────────────────────────────
    drawRoutes(planes, waypoints) {
        const ctx = this.ctx;
        ctx.save();
        ctx.setLineDash([4, 5]);
        ctx.lineWidth = 0.8;
        for (const p of planes) {
            if (p.status === 'exited') continue;
            ctx.strokeStyle = `${p.color}55`;
            ctx.beginPath();
            let first = true;
            for (let i = p.wpIndex; i < p.route.length; i++) {
                const wp = waypoints[p.route[i]];
                if (!wp) continue;
                const { x, y } = this.ll2px(wp.lat, wp.lon);
                first ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                first = false;
            }
            ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.restore();
    }

    // ── Plane trail ────────────────────────────────────────────────────────────
    _drawTrail(plane) {
        if (plane.trail.length < 2) return;
        const ctx = this.ctx;
        ctx.beginPath();
        for (let i = 0; i < plane.trail.length; i++) {
            const { x, y } = this.ll2px(plane.trail[i].lat, plane.trail[i].lon);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `${plane.color}44`;
        ctx.lineWidth   = 1;
        ctx.stroke();
    }

    // ── Plane symbol ───────────────────────────────────────────────────────────
    _drawPlane(plane) {
        const { x, y } = this.ll2px(plane.lat, plane.lon);
        const ctx  = this.ctx;
        const size = plane.selected ? 13 : 10;
        const hdgR = plane.heading * Math.PI / 180;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(hdgR);

        // Plane body: narrow triangle pointing up (north = 0°)
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.45, size * 0.55);
        ctx.lineTo(0, size * 0.1);
        ctx.lineTo(-size * 0.45, size * 0.55);
        ctx.closePath();

        ctx.fillStyle   = plane.selected ? '#ffffff' : plane.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth   = 0.5;
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Label
        const fl   = Math.round(plane.altitude / 100);
        const flStr = fl >= 100 ? `FL${fl}` : `${Math.round(plane.altitude)}ft`;

        ctx.font      = plane.selected ? 'bold 11px Courier New' : '10px Courier New';
        ctx.fillStyle = plane.color;
        ctx.fillText(`${plane.callsign}  ${flStr}`, x + 14, y - 2);
        ctx.font      = '9px Courier New';
        ctx.fillStyle = '#778899';
        ctx.fillText(`${Math.round(plane.heading).toString().padStart(3,'0')}°  ${plane.speed}kt`, x + 14, y + 10);
    }

    // ── Render everything ──────────────────────────────────────────────────────
    render(planes, waypoints, selectedCallsign) {
        this.clear();
        this.drawBorder();
        this.drawWaypoints(waypoints);
        this.drawRoutes(planes, waypoints);

        for (const p of planes) {
            if (p.status === 'exited') continue;
            this._drawTrail(p);
        }
        for (const p of planes) {
            if (p.status === 'exited') continue;
            p.selected = p.callsign === selectedCallsign;
            this._drawPlane(p);
        }
    }

    // ── Hit-test planes ────────────────────────────────────────────────────────
    planeAt(mx, my, planes) {
        for (const p of planes) {
            if (p.status === 'exited') continue;
            const { x, y } = this.ll2px(p.lat, p.lon);
            if (Math.hypot(mx - x, my - y) < 16) return p;
        }
        return null;
    }
}
