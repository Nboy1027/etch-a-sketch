import { MapRenderer }    from './map.js';
import { Plane }          from './plane.js';
import { SpeechController}from './speech.js';
import { parseATCCommand } from './parser.js';
import { Scorer }          from './scorer.js';
import { LEVEL1 }          from '../levels/level1.js';
import { LEVEL2 }          from '../levels/level2.js';

const LEVELS = { '1': LEVEL1, '2': LEVEL2 };

// ── Helpers ───────────────────────────────────────────────────────────────────
function hhmmss(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ── Game class ────────────────────────────────────────────────────────────────
class ATCGame {
    constructor() {
        this.canvas   = document.getElementById('map-canvas');
        this.map      = new MapRenderer(this.canvas);
        this.speech   = new SpeechController();
        this.scorer   = new Scorer();

        this.level       = null;
        this.planes      = [];
        this.waypoints   = {};
        this.events      = [];        // remaining (unfired) level events
        this.activeEvent = null;      // event waiting for controller response
        this.activeEventFiredAt = 0;  // gameTime when activeEvent fired

        this.gameTime    = 0;
        this.running     = false;
        this.paused      = false;
        this.lastTick    = 0;
        this.selected    = null;      // selected callsign string

        this._bindUI();
        this._bindSpeech();
        this._resize();
        window.addEventListener('resize', () => this._resize());

        // Initial empty render
        this.map.resize();
        this.map.clear();
        this.map.drawBorder();
    }

    // ── UI bindings ────────────────────────────────────────────────────────────
    _bindUI() {
        document.getElementById('btn-start').addEventListener('click',  () => this._startGame());
        document.getElementById('btn-pause').addEventListener('click',  () => this._togglePause());
        document.getElementById('btn-close-score').addEventListener('click', () => {
            document.getElementById('score-modal').classList.add('hidden');
        });

        // PTT button
        const ptt = document.getElementById('btn-ptt');
        ptt.addEventListener('mousedown',  () => this._pttOn());
        ptt.addEventListener('mouseup',    () => this._pttOff());
        ptt.addEventListener('mouseleave', () => this._pttOff());

        // Spacebar PTT
        document.addEventListener('keydown', e => {
            if (e.code === 'Space' && !e.repeat && !document.activeElement.matches('input')) {
                e.preventDefault(); this._pttOn();
            }
        });
        document.addEventListener('keyup', e => {
            if (e.code === 'Space') { e.preventDefault(); this._pttOff(); }
        });

        // Text input fallback
        document.getElementById('btn-send').addEventListener('click', () => this._submitText());
        document.getElementById('text-cmd').addEventListener('keydown', e => {
            if (e.key === 'Enter') this._submitText();
        });

        // Click plane on map
        this.canvas.addEventListener('click', e => {
            const rect  = this.canvas.getBoundingClientRect();
            const plane = this.map.planeAt(e.clientX - rect.left, e.clientY - rect.top, this.planes);
            this.selected = plane ? plane.callsign : null;
            this._updateStrips();
        });
    }

    _bindSpeech() {
        if (!this.speech.available) {
            this._log('Voice recognition unavailable in this browser. Use text input.', 'warn');
            document.getElementById('btn-ptt').disabled = true;
        }

        this.speech.onInterim = t => {
            document.getElementById('transcript-display').textContent = t + '…';
        };
        this.speech.onFinal = t => {
            document.getElementById('transcript-display').textContent = t;
            this._processCommand(t);
        };
    }

    // ── PTT ────────────────────────────────────────────────────────────────────
    _pttOn() {
        if (!this.running || this.paused) return;
        document.getElementById('btn-ptt').classList.add('active');
        document.getElementById('voice-dot').classList.add('on');
        this.speech.start();
    }
    _pttOff() {
        document.getElementById('btn-ptt').classList.remove('active');
        document.getElementById('voice-dot').classList.remove('on');
        this.speech.stop();
    }

    // ── Text input fallback ────────────────────────────────────────────────────
    _submitText() {
        if (!this.running || this.paused) return;
        const el  = document.getElementById('text-cmd');
        const val = el.value.trim();
        if (!val) return;
        el.value = '';
        document.getElementById('transcript-display').textContent = val;
        this._processCommand(val);
    }

    // ── Parse & execute command ────────────────────────────────────────────────
    _processCommand(transcript) {
        if (!transcript.trim()) return;
        this._log(`[CTR] ${transcript}`, 'ctrl');

        const known  = this.planes.map(p => ({ callsign: p.callsign, phonetic: p.phonetic }));
        const parsed = parseATCCommand(transcript, known);

        if (parsed.error) {
            this._log(parsed.error, 'warn');
            return;
        }

        const plane = this.planes.find(p => p.callsign === parsed.callsign);
        if (!plane) {
            this._log(`Unknown callsign: ${parsed.callsign}`, 'warn');
            return;
        }

        const instr = parsed.instruction;
        if (instr.type === 'unknown') {
            this._log(`Could not parse instruction — try again.`, 'warn');
            return;
        }

        plane.receiveInstruction(instr);
        const rb = plane.readback(instr);
        document.getElementById('readback-display').textContent = rb;
        this.speech.speak(rb);
        this._log(`[${plane.callsign}] ${rb}`, 'ac');
        this._updateStrips();

        // Scoring
        if (this.activeEvent && this.activeEvent.callsign === parsed.callsign) {
            const elapsed = this.gameTime - this.activeEventFiredAt;
            const result  = this.scorer.evaluate(parsed, this.activeEvent, elapsed);
            const pct     = Math.round(result.score / result.max * 100);
            this._log(`Score: ${result.score}/${result.max} (${pct}%)`, 'sys');

            // Clear active event and hint
            this.activeEvent = null;
            document.getElementById('hint-display').classList.remove('visible');
            document.getElementById('hint-display').textContent = '';
            this._updateScore();
        } else {
            this.scorer.recordExtra(parsed);
        }
    }

    // ── Game lifecycle ─────────────────────────────────────────────────────────
    _startGame() {
        const key   = document.getElementById('level-select').value;
        this.level  = LEVELS[key];

        this.scorer.reset();
        this.gameTime  = 0;
        this.running   = true;
        this.paused    = false;
        this.lastTick  = performance.now();
        this.selected  = null;
        this.activeEvent = null;

        this.waypoints = this.level.waypoints;
        this.planes    = this.level.aircraft.map(cfg => new Plane(cfg));
        // Deep-copy events, add runtime fields
        this.events    = this.level.events.map(ev => ({ ...ev, fired: false }));

        document.getElementById('btn-start').textContent  = '↺ Restart';
        document.getElementById('btn-pause').disabled     = false;
        document.getElementById('score-modal').classList.add('hidden');
        document.getElementById('hint-display').classList.remove('visible');
        document.getElementById('readback-display').textContent = '';
        document.getElementById('transcript-display').textContent = '';

        this._updateStrips();
        this._updateScore();
        this._log(`═══ ${this.level.name} ═══`, 'sys');
        this._log(this.level.description, 'sys');
        this._log('Press Space (or PTT button) to transmit.', 'sys');

        requestAnimationFrame(t => this._loop(t));
    }

    _togglePause() {
        this.paused = !this.paused;
        document.getElementById('btn-pause').textContent = this.paused ? '▶ Resume' : '⏸ Pause';
        if (!this.paused) {
            this.lastTick = performance.now();
            requestAnimationFrame(t => this._loop(t));
        }
    }

    // ── Main loop ──────────────────────────────────────────────────────────────
    _loop(ts) {
        if (!this.running || this.paused) return;

        const dt      = Math.min((ts - this.lastTick) / 1000, 0.1);
        this.lastTick = ts;
        this.gameTime += dt;

        // Update planes
        for (const p of this.planes) p.update(dt, this.waypoints);

        // Check scheduled events
        this._fireEvents();

        // Update timer display
        document.getElementById('timer').textContent = hhmmss(this.gameTime);

        // Render
        this.map.render(this.planes, this.waypoints, this.selected);

        // End condition
        if (this.gameTime >= this.level.duration) {
            this._endGame();
            return;
        }

        requestAnimationFrame(t => this._loop(t));
    }

    _fireEvents() {
        for (const ev of this.events) {
            if (!ev.fired && ev.time <= this.gameTime) {
                ev.fired = true;

                // If there's an unresponded event, score it as missed
                if (this.activeEvent) {
                    this._log(`Missed instruction for ${this.activeEvent.callsign}!`, 'warn');
                    // Count as a zero-score attempt
                    this.scorer.evaluate(
                        { callsign: '', instruction: { type: 'unknown' } },
                        this.activeEvent,
                        this.gameTime - this.activeEventFiredAt
                    );
                    this._updateScore();
                }

                this.activeEvent        = ev;
                this.activeEventFiredAt = this.gameTime;

                this._log(`► Instruct ${ev.callsign}`, 'sys');
                if (ev.hint) {
                    const hd = document.getElementById('hint-display');
                    hd.textContent = `💬 ${ev.hint}`;
                    hd.classList.add('visible');
                }
            }
        }
    }

    _endGame() {
        this.running = false;
        document.getElementById('btn-pause').disabled = true;

        // Score any lingering active event as missed
        if (this.activeEvent) {
            this.scorer.evaluate(
                { callsign: '', instruction: { type: 'unknown' } },
                this.activeEvent,
                this.gameTime - this.activeEventFiredAt
            );
            this.activeEvent = null;
        }

        const s    = this.scorer.summary();
        const rows = [];

        rows.push(`<div class="srow"><span class="lbl">Total score</span><span class="val">${s.total} / ${s.max}</span></div>`);
        rows.push(`<div class="srow ${s.pct >= 75 ? 'good' : s.pct < 50 ? 'bad' : ''}"><span class="lbl">Accuracy</span><span class="val">${s.pct}%  (Grade ${s.grade})</span></div>`);
        rows.push(`<div class="srow"><span class="lbl">Instructions evaluated</span><span class="val">${s.entries.filter(e => e.event).length}</span></div>`);

        rows.push(`<div class="score-section-title">Per instruction</div>`);

        for (const e of s.entries.filter(x => x.event)) {
            const cs  = e.event.callsign;
            const lbl = `${cs} — ${e.event.instruction.display}`;
            const pct = Math.round(e.score / e.max * 100);
            const cls = pct >= 75 ? 'good' : pct < 40 ? 'bad' : '';
            rows.push(`<div class="srow ${cls}"><span class="lbl">${lbl}</span><span class="val">${e.score}/${e.max} (${pct}%)</span></div>`);
            for (const d of e.details) {
                if (d.earned < d.max || d.earned < 0) {
                    rows.push(`<div class="srow" style="padding-left:16px;font-size:11px"><span class="lbl" style="color:#556">${d.item}</span><span class="val" style="color:${d.earned < 0 ? '#f66':'#888'}">${d.earned > 0 ? '+' : ''}${d.earned}</span></div>`);
                }
            }
        }

        document.getElementById('score-breakdown').innerHTML = rows.join('');
        document.getElementById('score-modal').classList.remove('hidden');
        this._log(`═══ Session ended — ${s.pct}% (${s.grade}) ═══`, 'sys');
    }

    // ── UI helpers ─────────────────────────────────────────────────────────────
    _updateStrips() {
        const container = document.getElementById('strips');
        container.innerHTML = '';

        for (const p of this.planes) {
            const div = document.createElement('div');
            div.className = 'strip' + (p.callsign === this.selected ? ' selected' : '');

            const fl    = Math.round(p.altitude / 100);
            const flStr = fl >= 100 ? `FL${fl}` : `${Math.round(p.altitude)} ft`;
            const tfl   = Math.round(p.targetAlt / 100);
            const tflStr= tfl >= 100 ? `FL${tfl}` : `${Math.round(p.targetAlt)} ft`;
            const arrow = p.targetAlt > p.altitude ? '↑' : p.targetAlt < p.altitude ? '↓' : '—';

            div.innerHTML = `
                <div class="cs ${p.callsign === this.selected ? 'selected' : ''}"
                     style="color:${p.color}">${p.callsign}</div>
                <div class="det">
                    ALT ${flStr} ${arrow} ${tflStr}<br>
                    HDG ${Math.round(p.heading).toString().padStart(3,'0')}°
                    SPD ${p.speed} kt
                    WP ${p.currentWaypoint() || '—'}
                </div>
            `;
            div.addEventListener('click', () => {
                this.selected = p.callsign;
                this._updateStrips();
            });
            container.appendChild(div);
        }
    }

    _updateScore() {
        const s = this.scorer.summary();
        document.getElementById('score-display').textContent = `Score: ${s.total}`;
    }

    _log(text, type = 'sys') {
        const log   = document.getElementById('log');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `<span class="ts">${hhmmss(this.gameTime)}</span>${text}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    _resize() {
        this.map.resize();
    }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { new ATCGame(); });
