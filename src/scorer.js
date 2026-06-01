/**
 * Scoring engine.
 *
 * Each level has timed events.  When an event fires the controller should issue
 * the expected instruction within RESPONSE_WINDOW seconds.
 * A command is scored on three axes:
 *   • Callsign accuracy   (30 pts)
 *   • Instruction type    (40 pts)
 *   • Value accuracy      (30 pts, proportional to how close the value is)
 */

const RESPONSE_WINDOW = 90; // seconds after event fires

export class Scorer {
    constructor() { this._reset(); }

    _reset() {
        this.entries   = [];
        this.total     = 0;
        this.maxTotal  = 0;
    }

    reset() { this._reset(); }

    /**
     * Evaluate a controller command against a pending event.
     * @param {object} parsed  - { callsign, instruction }
     * @param {object} event   - level event object with .callsign, .instruction
     * @param {number} elapsed - seconds since event fired
     * @returns {{ score, max, details }}
     */
    evaluate(parsed, event, elapsed) {
        const expected = event.instruction;
        let score = 0, max = 100, details = [];

        // Callsign (30 pts)
        const csOk = parsed.callsign === event.callsign;
        score += csOk ? 30 : 0;
        details.push({ item: 'Correct callsign', earned: csOk ? 30 : 0, max: 30 });

        // Instruction type (40 pts)
        const typeOk = parsed.instruction?.type === expected.type;
        score += typeOk ? 40 : 0;
        details.push({ item: 'Correct instruction type', earned: typeOk ? 40 : 0, max: 40 });

        // Value (30 pts, graduated)
        const givenVal = parsed.instruction?.altitude
            ?? parsed.instruction?.heading
            ?? parsed.instruction?.speed
            ?? null;
        const expVal   = expected.value ?? null;

        if (expVal !== null && givenVal !== null) {
            const err   = Math.abs(givenVal - expVal) / Math.max(expVal, 1);
            const frac  = Math.max(0, 1 - err);          // 0–1
            const pts   = Math.round(frac * 30);
            score += pts;
            details.push({ item: 'Value accuracy', earned: pts, max: 30 });
        } else {
            // No numeric value expected (e.g. direct-to, contact)
            score += 30;
            details.push({ item: 'Value accuracy', earned: 30, max: 30 });
        }

        // Timing bonus: –10 pts if responded > 30 s late (up to –20 at 60 s)
        if (elapsed > 30) {
            const penalty = Math.min(20, Math.round((elapsed - 30) / 1.5));
            score = Math.max(0, score - penalty);
            details.push({ item: 'Timing penalty', earned: -penalty, max: 0 });
        }

        this.total    += score;
        this.maxTotal += max;
        this.entries.push({ event, parsed, score, max, details });

        return { score, max, details };
    }

    /** Record commands that didn't match any pending event (no score awarded). */
    recordExtra(parsed) {
        this.entries.push({ event: null, parsed, score: 0, max: 0, details: [] });
    }

    summary() {
        const pct = this.maxTotal > 0
            ? Math.round(this.total / this.maxTotal * 100)
            : 0;
        return {
            total:   this.total,
            max:     this.maxTotal,
            pct,
            entries: this.entries,
            grade:   pct >= 90 ? 'A' : pct >= 75 ? 'B' : pct >= 60 ? 'C' : pct >= 40 ? 'D' : 'F',
        };
    }
}
