export class Plane {
    constructor(cfg) {
        this.callsign     = cfg.callsign;
        this.phonetic     = cfg.phonetic;
        this.lat          = cfg.lat;
        this.lon          = cfg.lon;
        this.altitude     = cfg.altitude;
        this.targetAlt    = cfg.altitude;
        this.speed        = cfg.speed;        // knots
        this.heading      = cfg.heading;      // degrees true
        this.targetHdg    = cfg.heading;
        this.route        = [...(cfg.route || [])];
        this.wpIndex      = 0;
        this.color        = cfg.color || '#00ff88';
        this.selected     = false;
        this.status       = 'enroute';        // enroute | exited
        this.trail        = [];
        this.TRAIL_LEN    = 25;
    }

    // dt: seconds since last frame
    update(dt, waypoints) {
        if (this.status === 'exited') return;

        // Smoothly turn toward target heading (max 3°/s)
        const rawDiff  = ((this.targetHdg - this.heading + 540) % 360) - 180;
        const maxTurn  = 3 * dt;
        this.heading += Math.abs(rawDiff) < maxTurn
            ? rawDiff
            : Math.sign(rawDiff) * maxTurn;
        this.heading = (this.heading + 360) % 360;

        // Smoothly change altitude (1500 fpm)
        const altDiff = this.targetAlt - this.altitude;
        const maxAlt  = 1500 / 60 * dt;
        this.altitude += Math.abs(altDiff) < maxAlt
            ? altDiff
            : Math.sign(altDiff) * maxAlt;

        // Steer toward current waypoint
        if (this.route.length > 0 && this.wpIndex < this.route.length) {
            const wp = waypoints[this.route[this.wpIndex]];
            if (wp) {
                const dlon = wp.lon - this.lon;
                const dlat = wp.lat - this.lat;
                const dist = Math.hypot(dlon, dlat);
                if (dist < 0.04) {                     // ~4 km capture radius
                    this.wpIndex++;
                    if (this.wpIndex >= this.route.length) this.status = 'exited';
                } else {
                    const desiredHdg = Math.atan2(dlon, dlat) * (180 / Math.PI);
                    this.targetHdg   = (desiredHdg + 360) % 360;
                }
            }
        }

        // Move forward in current heading
        const hdgRad = this.heading * Math.PI / 180;
        // 1 knot ≈ 1.852 km/h ≈ 1/3600 nm/s; 1° lat ≈ 111 km
        const degPerSec = (this.speed * 1.852) / (3600 * 111);
        this.lat += Math.cos(hdgRad) * degPerSec * dt;
        this.lon += Math.sin(hdgRad) * degPerSec * dt;

        this.trail.push({ lat: this.lat, lon: this.lon });
        if (this.trail.length > this.TRAIL_LEN) this.trail.shift();
    }

    receiveInstruction(instr) {
        switch (instr.type) {
            case 'climb':
            case 'descend':
            case 'maintain_alt':
                this.targetAlt = instr.altitude;
                break;
            case 'heading':
                this.targetHdg = instr.heading;
                break;
            case 'direct': {
                // Go direct to named waypoint, then continue rest of route
                const remaining = this.route.slice(this.wpIndex);
                const idx = remaining.indexOf(instr.waypoint);
                if (idx >= 0) {
                    this.route   = remaining.slice(idx);
                    this.wpIndex = 0;
                } else {
                    this.route   = [instr.waypoint, ...remaining];
                    this.wpIndex = 0;
                }
                break;
            }
            case 'speed':
                this.speed = instr.speed;
                break;
        }
    }

    readback(instr) {
        const cs = this.phonetic;
        switch (instr.type) {
            case 'climb':        return `${cs}, climbing to ${instr.display}.`;
            case 'descend':      return `${cs}, descending to ${instr.display}.`;
            case 'maintain_alt': return `${cs}, maintaining ${instr.display}.`;
            case 'heading':      return `${cs}, turning ${instr.direction || ''} heading ${instr.heading}.`.replace('turning  ', 'turning ');
            case 'direct':       return `${cs}, direct ${instr.waypoint}.`;
            case 'speed':        return `${cs}, speed ${instr.speed} knots.`;
            case 'contact':      return `${cs}, contacting ${instr.who}, good day.`;
            case 'land':         return `${cs}, cleared to land, runway ${instr.runway || ''}.`;
            case 'takeoff':      return `${cs}, cleared for takeoff.`;
            default:             return `${cs}, wilco.`;
        }
    }

    currentWaypoint() {
        return this.route[this.wpIndex] || null;
    }
}
