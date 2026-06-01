/**
 * ATC phraseology parser.
 * Converts raw speech transcript into a structured command:
 *   { callsign, instruction: { type, altitude|heading|speed|waypoint, display } }
 */

const PHONETIC = {
    alpha:'A', bravo:'B', charlie:'C', delta:'D', echo:'E',
    foxtrot:'F', golf:'G', hotel:'H', india:'I', juliet:'J',
    kilo:'K', lima:'L', mike:'M', november:'N', oscar:'O',
    papa:'P', quebec:'Q', romeo:'R', sierra:'S', tango:'T',
    uniform:'U', victor:'V', whiskey:'W', xray:'X', 'x-ray':'X',
    yankee:'Y', zulu:'Z',
};

const DIGIT_WORDS = {
    zero:'0', one:'1', two:'2', three:'3', four:'4',
    five:'5', six:'6', seven:'7', eight:'8', niner:'9', nine:'9',
};

function phoneticToLetters(words) {
    let result = '';
    for (const w of words) {
        if (PHONETIC[w]) result += PHONETIC[w];
        else if (DIGIT_WORDS[w]) result += DIGIT_WORDS[w];
        else break;
    }
    return result;
}

function wordsToNumber(str) {
    const parts = str.trim().toLowerCase().split(/\s+/);
    let digits = '';
    let thousands = 0;
    let hundreds = 0;

    for (const w of parts) {
        if (DIGIT_WORDS[w]) {
            digits += DIGIT_WORDS[w];
        } else if (w === 'thousand' || w === 'thousands') {
            if (digits) { thousands = parseInt(digits, 10) * 1000; digits = ''; }
        } else if (w === 'hundred' || w === 'hundreds') {
            if (digits) { hundreds = parseInt(digits, 10) * 100; digits = ''; }
        }
        // ignore unrecognised words (prepositions, etc.)
    }

    const remainder = digits ? parseInt(digits, 10) : 0;
    const total = thousands + hundreds + remainder;
    return total > 0 ? total : (digits ? parseInt(digits, 10) : null);
}

// ── Instruction parser ────────────────────────────────────────────────────────

function parseInstruction(text) {
    const t = text.toLowerCase();

    // Climb / Descend ─────────────────────────────────────────────────────────
    const isClimb   = /\bclimb\b|\bclimbing\b/.test(t);
    const isDescend = /\bdescend\b|\bdescending\b/.test(t);

    if (isClimb || isDescend) {
        const alt = extractAltitude(t);
        if (alt !== null) {
            const type = isClimb ? 'climb' : 'descend';
            return { type, altitude: alt.feet, display: alt.label };
        }
    }

    // Maintain altitude ───────────────────────────────────────────────────────
    if (/\bmaintain\b/.test(t) && !/\bspeed\b|\bknots\b|\bkt\b/.test(t)) {
        const alt = extractAltitude(t);
        if (alt !== null) return { type: 'maintain_alt', altitude: alt.feet, display: `Maintain ${alt.label}` };
    }

    // Heading ─────────────────────────────────────────────────────────────────
    const hdgMatch = t.match(/heading\s+([\w\s]+?)(?:$|,|\.|contact|speed|squawk)/);
    if (hdgMatch) {
        const hdg = wordsToNumber(hdgMatch[1].trim());
        if (hdg !== null) {
            const dir = /\bturn left\b/.test(t) ? 'left' : /\bturn right\b/.test(t) ? 'right' : null;
            return { type: 'heading', heading: hdg, direction: dir, display: `Heading ${String(hdg).padStart(3,'0')}` };
        }
    }

    // Direct to waypoint ──────────────────────────────────────────────────────
    const dirMatch = t.match(/direct(?:ly)?\s+(?:to\s+)?([a-z]{2,5})\b/);
    if (dirMatch) {
        const wp = dirMatch[1].toUpperCase();
        return { type: 'direct', waypoint: wp, display: `Direct ${wp}` };
    }

    // Speed ───────────────────────────────────────────────────────────────────
    const spdMatch = t.match(/(?:maintain|reduce|increase|speed)\s+([\w\s]+?)\s*(?:knots|kts|kt)\b/);
    if (spdMatch) {
        const spd = wordsToNumber(spdMatch[1]);
        if (spd !== null) return { type: 'speed', speed: spd, display: `Speed ${spd} kt` };
    }

    // Contact ─────────────────────────────────────────────────────────────────
    const ctMatch = t.match(/contact\s+(\w+)/);
    if (ctMatch) return { type: 'contact', who: ctMatch[1], display: `Contact ${ctMatch[1]}` };

    // Cleared to land ─────────────────────────────────────────────────────────
    if (/clear(?:ed)? (?:to )?land/.test(t)) {
        const rwMatch = t.match(/runway\s+([\w\s]+)/);
        return { type: 'land', runway: rwMatch ? rwMatch[1].trim() : null, display: 'Cleared to land' };
    }

    // Cleared for takeoff ─────────────────────────────────────────────────────
    if (/clear(?:ed)?.*take.?off/.test(t)) {
        return { type: 'takeoff', display: 'Cleared for takeoff' };
    }

    return { type: 'unknown', display: '(unrecognised instruction)' };
}

function extractAltitude(t) {
    // Flight level  e.g. "flight level three five zero"
    const flMatch = t.match(/flight level\s+([\w\s]+?)(?:$|,|\.|contact|speed)/);
    if (flMatch) {
        const fl = wordsToNumber(flMatch[1].trim());
        if (fl !== null) return { feet: fl * 100, label: `FL${fl}` };
    }

    // "... feet / foot / ft"
    const ftMatch = t.match(/([\w\s]+?)\s*(?:feet|foot|ft)\b/);
    if (ftMatch) {
        const alt = wordsToNumber(ftMatch[1].trim());
        if (alt !== null) return { feet: alt, label: `${alt} ft` };
    }

    // "two thousand" style — no unit word
    const tMatch = t.match(/([\w\s]*\bthousand[\w\s]*)/);
    if (tMatch) {
        const alt = wordsToNumber(tMatch[1].trim());
        if (alt !== null) return { feet: alt, label: `${alt} ft` };
    }

    return null;
}

// ── Callsign matcher ──────────────────────────────────────────────────────────

function matchCallsign(words, knownCallsigns) {
    // 1. Try exact phonetic phrase match for each known aircraft
    for (const ac of knownCallsigns) {
        const phoneticWords = ac.phonetic.toLowerCase().split(/\s+/);
        const matched = phoneticWords.length > 0 &&
            phoneticWords.every((pw, i) => words[i] === pw);
        if (matched) return { callsign: ac.callsign, consumed: phoneticWords.length };
    }

    // 2. Build callsign letter-by-letter from ICAO phonetics
    const built = phoneticToLetters(words);
    if (built.length >= 2) {
        for (const ac of knownCallsigns) {
            if (ac.callsign === built || ac.callsign.startsWith(built)) {
                return { callsign: ac.callsign, consumed: built.length };
            }
        }
        // Partial: up to 8 phonetic words attempted
        const attempt = phoneticToLetters(words.slice(0, 8));
        if (attempt.length >= 2) {
            for (const ac of knownCallsigns) {
                if (ac.callsign.startsWith(attempt)) {
                    return { callsign: ac.callsign, consumed: attempt.length };
                }
            }
        }
    }

    return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseATCCommand(transcript, knownCallsigns) {
    // Strip commas, periods, and other punctuation that speech recognition adds
    const cleaned = transcript.toLowerCase().trim().replace(/[,.\-!?;:]/g, '');
    const words   = cleaned.split(/\s+/).filter(Boolean);

    const match = matchCallsign(words, knownCallsigns);
    if (!match) {
        return { error: `Could not identify callsign in: "${transcript}"`, raw: transcript };
    }

    const { callsign, consumed } = match;
    const instructionText = words.slice(consumed).join(' ');
    const instruction = parseInstruction(instructionText);

    return { callsign, instruction, raw: transcript };
}

// Expose for testing
export { wordsToNumber, phoneticToLetters };
