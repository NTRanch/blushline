// game.mjs — Blushline game core. Shared verbatim by the shipped page
// (inlined by tools/assemble.mjs) and the node capture/playtest/test
// harnesses. The numerics live in core/kernel.mjs (the transliteration
// of the Mojo reference kernel); this file is the fitting itself:
// screens, stations, judging, and the per-frame draw list on the
// 960x960 logical canvas, emitted as the shared line protocol
// (r/c/l/p/t ops, palette indices) that the shell and the rasteriser
// both interpret. Fixed 16 ms steps, seeded RNG, no wall clock, no
// ambient state: same seed + same inputs = same draw lists.
import {
  accumulate, blushStep, blushTarget, gazeChannel, gazeStimulus,
  levelSchedule, rngNext, tierOf, DISC_RADIUS_UNITS, LEVELS, STATIONS,
} from "../core/kernel.mjs";

export const PALETTE = [
  "#0d0208", "#ff2e88", "#f8f0ed", "#ac9393", "#540e46",
  "#ec8584", "#eaeaea", "#68636c", "#ffd166", "#1a0510",
  "#ff8fb8", "#3a0a24",
];

export const INPUT = { tap: 1, confirm: 2, back: 4, pause: 8, up: 16, down: 32 };

export const SCREEN = {
  GATE: 0, TITLE: 1, HOWTO: 2, PLAY: 3, PAUSE: 4, SETTINGS: 5, VICTORY: 6, GAMEOVER: 7,
};

const PHASE = { MEASURE: 0, GAZE: 1, REPORT: 2 };
const CHANNEL_NAMES = ["TOWARD", "AWAY", "DOWNCAST"];
const GAZE_PHASE_STEPS = 188;
const MEASURE_TIMEOUT_STEPS = 375;
const NEEDLE_CYCLE_STEPS = [100, 80, 64];
const REPORT_PHASE_STEPS = 138;
const FAILURES_MAX = 3;
const DRIFT = [0, 1, 2, 3, 2, 1, 0, -1, -2, -3, -2, -1];

function needleAt(stepInPhase, level) {
  const cycle = NEEDLE_CYCLE_STEPS[level] ?? 100;
  const ph = (stepInPhase % cycle) / cycle;
  const tri = ph < 0.5 ? ph * 4 - 1 : 3 - ph * 4;
  return Math.max(-1, Math.min(1, tri));
}

export async function createGame({ seed = 1, level = 0, demo = false } = {}) {
  if (!levelSchedule(level)) throw new Error(`core init rejected level ${level}`);
  const state = {
    blush: 0,
    demo,
    event: 0,
    failures: 0,
    fitFinal: 0,
    gazeCorrect: 0,
    gazePick: 0,
    gazeTotal: 0,
    glimpse: 0,
    level,
    maxTier: 0,
    menuCursor: 0,
    phase: PHASE.MEASURE,
    phaseStep: 0,
    rng: (seed >>> 0) ^ 0x51ab27,
    screen: SCREEN.GATE,
    sessionStim: 0,
    settings: { calm: false, large: false },
    settingsCursor: 0,
    stationIdx: 0,
    stepCount: 0,
    // per-station working fields, set by setupStation
    accuracy: 0,
    gazeDx: 0,
    gazeDy: 0,
    gazeLocked: false,
    gazeTrue: 0,
    measureSum: 0,
    readingText: "",
    trueRead: false,
  };

  function station() {
    return STATIONS[state.stationIdx];
  }

  function intimateTotal() {
    const n = levelSchedule(state.level).stations;
    let total = 0;
    for (let i = 0; i < n; i++) if (STATIONS[i].intimate) total++;
    return total;
  }

  function setupStation() {
    const [s1, v1] = rngNext(state.rng);
    state.rng = s1;
    const st = station();
    const jitter = ((v1 % 21) - 10) * 0.1;
    state.readingText = `${st.name} - ${(st.base + jitter).toFixed(1)} ${st.unit}`;
    const [s2, v2] = rngNext(state.rng);
    state.rng = s2;
    const [dx, dy] = gazeStimulus(v2, st.gazeClass);
    state.gazeDx = dx;
    state.gazeDy = dy;
    state.gazeTrue = gazeChannel(dx, dy, DISC_RADIUS_UNITS);
    state.gazePick = 0;
    state.gazeLocked = false;
    state.phase = PHASE.MEASURE;
    state.phaseStep = 0;
  }

  const seedForGame = seed >>> 0;

  function startLevel(l) {
    if (!levelSchedule(l)) throw new Error(`core start_level rejected ${l}`);
    state.level = l;
    state.blush = 0;
    state.failures = 0;
    state.fitFinal = 0;
    state.gazeCorrect = 0;
    state.gazeTotal = 0;
    state.glimpse = 0;
    state.maxTier = 0;
    state.measureSum = 0;
    state.sessionStim = 0;
    state.stationIdx = 0;
    state.rng = (seedForGame ^ Math.imul(l + 1, 0x85ebca6b)) >>> 0;
    setupStation();
    state.screen = SCREEN.PLAY;
  }

  function takeReading(auto) {
    const sched = levelSchedule(state.level);
    const needle = needleAt(state.phaseStep, state.level);
    const a = 1 - Math.abs(needle);
    state.accuracy = a;
    state.trueRead = Math.abs(needle) <= sched.window;
    const stimulus = state.trueRead ? 0.35 + 0.45 * a : 0.15 * a;
    state.sessionStim = accumulate(state.sessionStim, stimulus);
    state.measureSum += a;
    if (a < 0.35) {
      state.failures++;
      state.event = 2;
    } else {
      state.event = state.trueRead ? 1 : 2;
    }
    if (auto && a >= 0.35) state.event = 1;
    state.phase = PHASE.GAZE;
    state.phaseStep = 0;
  }

  function lockGaze() {
    state.gazeLocked = true;
    state.gazeTotal++;
    if (state.gazePick === state.gazeTrue) {
      state.gazeCorrect++;
      const bonus = state.gazeTrue === 2 ? 0.5 : 0.35;
      state.sessionStim = accumulate(state.sessionStim, bonus);
      if (station().intimate) state.glimpse++;
      state.event = 6;
    } else {
      state.failures++;
      state.blush = Math.min(1, state.blush + 0.08); // embarrassment spike
      state.event = 2;
    }
    state.phase = PHASE.REPORT;
    state.phaseStep = 0;
  }

  function finishReport() {
    const sched = levelSchedule(state.level);
    state.stationIdx++;
    state.event = 3;
    if (state.failures >= FAILURES_MAX) {
      state.fitFinal = computeFit();
      state.screen = SCREEN.GAMEOVER;
      state.event = 5;
      return;
    }
    if (state.stationIdx >= sched.stations) {
      state.fitFinal = computeFit();
      const won = state.fitFinal >= sched.fitTarget && state.maxTier >= sched.tierTarget;
      state.screen = won ? SCREEN.VICTORY : SCREEN.GAMEOVER;
      state.event = won ? 4 : 5;
      return;
    }
    setupStation();
  }

  function computeFit() {
    const sched = levelSchedule(state.level);
    const meanMeasure = state.measureSum / Math.max(1, sched.stations);
    const gazeRate = state.gazeTotal > 0 ? state.gazeCorrect / state.gazeTotal : 0;
    return Math.round(100 * (0.6 * meanMeasure + 0.4 * gazeRate));
  }

  function demoBits() {
    let bits = 0;
    if (state.screen === SCREEN.GATE && state.stepCount > 30) bits |= INPUT.confirm;
    if (state.screen === SCREEN.PLAY) {
      if (state.phase === PHASE.MEASURE) {
        if (Math.abs(needleAt(state.phaseStep, state.level)) <= 0.04) bits |= INPUT.tap;
      } else if (state.phase === PHASE.GAZE && state.phaseStep === 90) {
        state.gazePick = state.gazeTrue;
        bits |= INPUT.confirm;
      }
    }
    return bits;
  }

  function stepPlay(bits) {
    const sched = levelSchedule(state.level);
    // Blush chases the session target every step, in every phase.
    const target = blushTarget(state.sessionStim, sched.sensitivity);
    state.blush = blushStep(state.blush, target);
    const tier = tierOf(state.blush);
    if (tier > state.maxTier) state.maxTier = tier;
    state.phaseStep++;
    if (state.phase === PHASE.MEASURE) {
      if ((bits & (INPUT.tap | INPUT.confirm)) !== 0) takeReading(false);
      else if (state.phaseStep >= MEASURE_TIMEOUT_STEPS) takeReading(true);
    } else if (state.phase === PHASE.GAZE) {
      if ((bits & INPUT.up) !== 0) state.gazePick = (state.gazePick + 2) % 3;
      if ((bits & INPUT.down) !== 0) state.gazePick = (state.gazePick + 1) % 3;
      if ((bits & INPUT.confirm) !== 0) lockGaze();
      else if (state.phaseStep >= GAZE_PHASE_STEPS) {
        state.gazePick = -1; // no read at all counts as a misread
        lockGaze();
      }
    } else if (state.phase === PHASE.REPORT) {
      if ((bits & INPUT.confirm) !== 0 || state.phaseStep >= REPORT_PHASE_STEPS) finishReport();
    }
  }

  function step(bits) {
    state.stepCount++;
    let b = bits >>> 0;
    if (state.demo) b |= demoBits();
    switch (state.screen) {
      case SCREEN.GATE:
        if ((b & (INPUT.confirm | INPUT.tap)) !== 0) state.screen = SCREEN.TITLE;
        break;
      case SCREEN.TITLE:
        if ((b & INPUT.up) !== 0) state.menuCursor = (state.menuCursor + 4) % 5;
        if ((b & INPUT.down) !== 0) state.menuCursor = (state.menuCursor + 1) % 5;
        if ((b & INPUT.confirm) !== 0) {
          if (state.menuCursor < 3) startLevel(state.menuCursor);
          else if (state.menuCursor === 3) state.screen = SCREEN.HOWTO;
          else state.screen = SCREEN.SETTINGS;
        }
        break;
      case SCREEN.HOWTO:
        if ((b & (INPUT.back | INPUT.confirm)) !== 0) state.screen = SCREEN.TITLE;
        break;
      case SCREEN.SETTINGS:
        if ((b & INPUT.up) !== 0) state.settingsCursor = (state.settingsCursor + 2) % 3;
        if ((b & INPUT.down) !== 0) state.settingsCursor = (state.settingsCursor + 1) % 3;
        if ((b & INPUT.confirm) !== 0) {
          if (state.settingsCursor === 0) state.settings.calm = !state.settings.calm;
          else if (state.settingsCursor === 1) state.settings.large = !state.settings.large;
          else state.screen = SCREEN.TITLE;
        }
        if ((b & INPUT.back) !== 0) state.screen = SCREEN.TITLE;
        break;
      case SCREEN.PLAY:
        if ((b & INPUT.pause) !== 0) state.screen = SCREEN.PAUSE;
        else stepPlay(b);
        break;
      case SCREEN.PAUSE:
        if ((b & (INPUT.pause | INPUT.confirm)) !== 0) state.screen = SCREEN.PLAY;
        else if ((b & INPUT.back) !== 0) state.screen = SCREEN.TITLE;
        break;
      case SCREEN.VICTORY:
      case SCREEN.GAMEOVER:
        if ((b & (INPUT.confirm | INPUT.tap)) !== 0) state.screen = SCREEN.TITLE;
        break;
      default:
        state.screen = SCREEN.GATE;
    }
  }

  // --- draw list emission ---
  function textSize(base) {
    return state.settings.large ? Math.round(base * 1.5) : base;
  }

  function drawFigure(ops) {
    const tier = tierOf(state.blush);
    const drift = state.settings.calm ? 0 : DRIFT[Math.floor(state.stepCount / 8) % 12];
    // Room: curtain lines, mirror frame, lamp.
    for (let i = 0; i < 6; i++) {
      const x = 90 + i * 36 + drift;
      ops.push(`l ${x} 60 ${x - 14} 900 3 4`);
    }
    ops.push("r 660 120 220 300 11");
    ops.push("l 660 120 880 120 4 3", "l 880 120 880 420 4 3", "l 880 420 660 420 4 3", "l 660 420 660 120 4 3");
    ops.push("c 838 84 26 8");
    // Figure: hair mass, shoulders/gown, neck, head.
    ops.push("c 480 258 104 4");
    ops.push("p 480 470 322 700 638 700 4");
    ops.push("r 448 330 64 60 5");
    ops.push("c 480 292 92 5");
    ops.push("c 480 226 78 4");
    // Blush cheeks: radius and heat follow the blush channel.
    const cheekR = Math.round(8 + state.blush * 26);
    const cheekC = state.blush < 0.3 ? 10 : 1;
    ops.push(`c 404 344 ${cheekR} ${cheekC}`, `c 556 344 ${cheekR} ${cheekC}`);
    // Eyes: white disc + full iris disc; the iris centre carries the
    // section 1.7 gaze. In the gaze phase it shows the stimulus offset;
    // otherwise it rests near centre with a slow drift.
    let gx = drift;
    let gy = 0;
    if (state.phase === PHASE.GAZE || state.phase === PHASE.REPORT) {
      gx = Math.round((state.gazeDx / DISC_RADIUS_UNITS) * 11);
      gy = Math.round((state.gazeDy / DISC_RADIUS_UNITS) * 11);
    }
    for (const ex of [438, 522]) {
      ops.push(`c ${ex} 288 20 6`);
      ops.push(`c ${ex + gx} ${288 + gy} 10 4`);
      ops.push(`c ${ex + gx + 3} ${288 + gy - 3} 3 1`);
    }
    // Lids lower with tier; brows rise at T1, soften at T2.
    const lidH = [0, 6, 11][tier];
    if (lidH > 0) ops.push(`r 417 268 42 ${lidH} 5`, `r 501 268 42 ${lidH} 5`);
    const browY = 252 - tier * 3;
    ops.push(`l 420 ${browY} 456 ${browY - 4} 4 4`, `l 504 ${browY - 4} 540 ${browY} 4 4`);
    // Mouth: line, parted line, small open at T2.
    if (tier === 2) ops.push("r 465 366 30 11 4");
    else if (tier === 1) ops.push("l 464 368 496 368 4 4", "l 470 373 490 373 3 4");
    else ops.push("l 466 369 494 369 4 4");
    // The tape: a gold line across the torso at the station's height.
    const tapeY = 470 + state.stationIdx * 22;
    ops.push(`l 356 ${tapeY} 604 ${tapeY} 5 8`);
  }

  function drawPlay(ops) {
    const sched = levelSchedule(state.level);
    const st = station();
    drawFigure(ops);
    ops.push(`t 48 36 ${textSize(24)} 6 STATION ${state.stationIdx + 1}/${sched.stations} - ${st.name}`);
    ops.push(`t 48 76 ${textSize(20)} 3 ${sched.name}`);
    ops.push(`t 620 36 ${textSize(24)} 6 MISREADS ${state.failures}/${FAILURES_MAX}`);
    // Blush bar + tier readout.
    ops.push("r 48 884 300 16 9");
    ops.push(`r 48 884 ${Math.round(state.blush * 300)} 16 1`);
    ops.push(`t 48 852 ${textSize(20)} 2 BLUSH ${Math.round(state.blush * 100)} PCT - TIER T${tierOf(state.blush)}`);
    if (state.phase === PHASE.MEASURE) {
      const needle = needleAt(state.phaseStep, state.level);
      const winPx = Math.round(sched.window * 240);
      ops.push("r 240 796 480 16 9");
      ops.push(`r ${480 - winPx} 796 ${winPx * 2} 16 4`);
      ops.push(`l ${480 + Math.round(needle * 240)} 780 ${480 + Math.round(needle * 240)} 828 5 1`);
      ops.push("l 480 780 480 828 3 6");
      ops.push(`t 330 736 ${textSize(24)} 6 TAP ON THE TRUE MARK`);
    } else if (state.phase === PHASE.GAZE) {
      ops.push(`t 300 736 ${textSize(24)} 6 HER GAZE - READ IT`);
      CHANNEL_NAMES.forEach((name, i) => {
        const mark = i === state.gazePick ? "> " : "  ";
        ops.push(`t ${300 + i * 190} 790 ${textSize(22)} ${i === state.gazePick ? 1 : 3} ${mark}${name}`);
      });
    } else {
      const gazeLine = state.gazeLocked && state.gazePick === state.gazeTrue
        ? `HER GAZE: ${CHANNEL_NAMES[state.gazeTrue]} - SEEN, KINDLY`
        : state.gazePick >= 0 && state.gazePick !== state.gazeTrue
          ? `HER GAZE: ${CHANNEL_NAMES[state.gazeTrue]} - MISREAD`
          : "HER GAZE: UNREAD";
      ops.push(`t 210 736 ${textSize(22)} 6 ${state.readingText} - ${state.trueRead ? "TRUE" : "OFF"}`);
      ops.push(`t 210 782 ${textSize(20)} 2 ${gazeLine}`);
      const intimateNote = st.intimate && state.glimpse > 0 ? ` - GLIMPSE ${state.glimpse}/${intimateTotal()}` : "";
      ops.push(`t 210 824 ${textSize(20)} 3 FIT-CHECK STEADY${intimateNote}`);
    }
  }

  function frameText() {
    const ops = ["r 0 0 960 960 0"];
    if (state.screen === SCREEN.GATE) {
      ops.push(`t 330 300 ${textSize(64)} 1 BLUSHLINE`);
      ops.push(`t 396 396 ${textSize(30)} 6 18+ ONLY`);
      ops.push(`t 196 470 ${textSize(19)} 3 ADULT THEMES: A CLINIC FITTING, MEASURED AND CLOSE.`);
      ops.push(`t 226 512 ${textSize(19)} 3 HER READINGS ARE REPORTED ALOUD, FIT-CHECK STYLE.`);
      ops.push(`t 286 620 ${textSize(20)} 2 PRESS ENTER - I AM 18 OR OLDER`);
    } else if (state.screen === SCREEN.TITLE) {
      ops.push(`t 330 190 ${textSize(64)} 1 BLUSHLINE`);
      ops.push(`t 300 286 ${textSize(20)} 3 A FITTING AT THE CLINIC - ALMA`);
      const items = [...LEVELS.map((l) => l.name), "HOW TO PLAY", "SETTINGS"];
      items.forEach((name, i) => {
        const mark = i === state.menuCursor ? "> " : "  ";
        ops.push(`t 300 ${380 + i * 62} ${textSize(28)} ${i === state.menuCursor ? 1 : 6} ${mark}${name}`);
      });
      ops.push(`t 252 736 ${textSize(20)} 7 UP/DOWN CHOOSE - ENTER CONFIRMS`);
    } else if (state.screen === SCREEN.HOWTO) {
      ops.push(`t 356 150 ${textSize(40)} 1 HOW TO PLAY`);
      const lines = [
        "YOU ARE THE FITTER. SHE IS THE CLIENT.",
        "AT EACH STATION, TAP AS THE NEEDLE CROSSES",
        "THE TRUE MARK. A TRUE READING WARMS HER.",
        "THEN READ HER GAZE: TOWARD, AWAY, DOWNCAST.",
        "THE SCORE IS THE FULL DISC CENTRE (1.7).",
        "READINGS ARE REPORTED ALOUD, FIT-CHECK STYLE.",
        "HER BLUSH RAMPS ON THE MEASURED CURVE.",
        "THREE MISREADS END THE SESSION.",
        "P PAUSES. SETTINGS ARE NEVER GATED.",
      ];
      lines.forEach((line, i) => ops.push(`t 130 ${240 + i * 52} ${textSize(20)} 6 ${line}`));
      ops.push(`t 330 780 ${textSize(22)} 2 ENTER - BACK TO TITLE`);
    } else if (state.screen === SCREEN.PLAY) {
      drawPlay(ops);
    } else if (state.screen === SCREEN.PAUSE) {
      drawFigure(ops);
      ops.push("r 240 380 480 200 11");
      ops.push(`t 356 430 ${textSize(36)} 1 PAUSED`);
      ops.push(`t 300 500 ${textSize(20)} 6 THE TAPE WAITS. ENTER RESUMES.`);
    } else if (state.screen === SCREEN.SETTINGS) {
      ops.push(`t 356 170 ${textSize(40)} 1 SETTINGS`);
      const rows = [
        `CALM ROOM: ${state.settings.calm ? "ON" : "OFF"}`,
        `TEXT SIZE: ${state.settings.large ? "LARGE" : "STANDARD"}`,
        "BACK",
      ];
      rows.forEach((row, i) => {
        const mark = i === state.settingsCursor ? "> " : "  ";
        ops.push(`t 300 ${300 + i * 70} ${textSize(28)} ${i === state.settingsCursor ? 1 : 6} ${mark}${row}`);
      });
      ops.push(`t 196 560 ${textSize(20)} 3 CALM ROOM STILLS THE CURTAINS AND HER DRIFT.`);
    } else if (state.screen === SCREEN.VICTORY) {
      drawFigure(ops);
      ops.push(`t 296 640 ${textSize(40)} 1 THE FIT IS TRUE`);
      ops.push(`t 300 706 ${textSize(20)} 6 FIT SCORE ${state.fitFinal} - TIER T${state.maxTier} REACHED`);
      const revealed = state.glimpse >= intimateTotal() && intimateTotal() > 0;
      ops.push(`t 216 756 ${textSize(20)} 2 REVELATION: ${revealed ? "GLIMPSED" : "HINTED ONLY"}`);
      if (revealed) ops.push(`t 216 790 ${textSize(20)} 2 A PREFERENCE, NOTED WITHOUT A WORD`);
      ops.push(`t 330 816 ${textSize(22)} 3 ENTER - RETURN`);
    } else if (state.screen === SCREEN.GAMEOVER) {
      ops.push(`t 230 330 ${textSize(34)} 1 THE SESSION IS CALLED`);
      const reason = state.failures >= FAILURES_MAX
        ? "THREE MISREADS. KINDLY, FIRMLY, IT ENDS."
        : "THE FIT IS NOT RIGHT - ANOTHER SESSION, ANOTHER DAY.";
      ops.push(`t 216 420 ${textSize(19)} 6 ${reason}`);
      ops.push(`t 300 500 ${textSize(20)} 3 FIT SCORE ${state.fitFinal} - TIER T${state.maxTier} REACHED`);
      ops.push(`t 330 600 ${textSize(22)} 3 ENTER - RETURN`);
    }
    return ops.join("\n");
  }

  return {
    applySettings(calmRoom, textLarge) {
      state.settings.calm = !!calmRoom;
      state.settings.large = !!textLarge;
    },
    blush() {
      return state.blush;
    },
    event() {
      const e = state.event;
      state.event = 0;
      return e;
    },
    failures() {
      return state.failures;
    },
    fitScore() {
      return state.screen === SCREEN.VICTORY || state.screen === SCREEN.GAMEOVER
        ? state.fitFinal
        : computeFit();
    },
    frame() {
      return { palette: PALETTE, ops: parseDrawList(this.frameText()) };
    },
    frameText,
    glimpsed() {
      return state.glimpse >= intimateTotal() && intimateTotal() > 0;
    },
    levelIdx() {
      return state.level;
    },
    maxTier() {
      return state.maxTier;
    },
    screen() {
      return state.screen;
    },
    settingsBits() {
      return (state.settings.calm ? 1 : 0) | (state.settings.large ? 2 : 0);
    },
    startLevel,
    step,
  };
}

/// Parse the shared line protocol into raster/canvas ops:
/// r -> ["r",x,y,w,h,c], c -> ["c",x,y,r,c], l -> ["l",...], p -> ["p",...],
/// t -> ["t",x,y,size,c,"text"].
export function parseDrawList(text) {
  const ops = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const kind = line[0];
    if (kind === "t") {
      const parts = line.split(" ");
      ops.push(["t", +parts[1], +parts[2], +parts[3], +parts[4], parts.slice(5).join(" ")]);
    } else {
      const parts = line.split(" ").map(Number);
      ops.push([kind, ...parts.slice(1)]);
    }
  }
  return ops;
}
