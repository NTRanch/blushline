# blushline/core/kernel.mojo — Blushline numerical kernel (Mojo).
#
# Tiger Style (tiger-style-mojo): contracts first, bounded work, numerics
# treated as a safety property. This file is the REFERENCE implementation
# for Blushline: the blush response curve, the gaze channel scoring under
# the ratified section 1.7 full-disc-centre definition, the arousal-engine
# low-tier coupling, and the measurement schedule scalars. The shipped
# game is a JS transliteration (core/kernel.mjs); conformance/vectors.json
# is the durable contract between the two, and tools/conformance.mjs is
# its gate. Station names and all dialogue are presentation data and are
# deliberately NOT here (engine research chapter, section 2d).
#
# Toolchain pin of record: mojo 0.25.6.1 via pixi (see pixi.toml).
# Execution status: NO Mojo toolchain is installed in the build sandbox
# and Mojo has no wasm target (D-335); this kernel is authored as the
# source of record and is NOT executed by the v1.0 build. The conformance
# vectors were derived from these formulas by an independent integer /
# exact-rational implementation (conformance/README.md). Anyone who runs
# this file with the pinned toolchain must regenerate the vectors and
# re-run the harness before trusting either side.
#
# Numeric policy (applies to every function below):
# - All channel quantities are Float64 in the closed range [0, 1].
# - Non-finite scalar input (NaN, +/-inf) fails CLOSED to the floor
#   value 0.0. A face channel that cannot be computed reads as rest,
#   never as a spurious peak.
# - Gaze geometry is the one exception: a non-positive or non-finite
#   disc radius makes the reading meaningless, so the gaze functions
#   return the INVALID sentinel (-1) instead of a verdict. A false
#   reading is worse than no reading.

from math import sqrt

# ---------------------------------------------------------------------------
# Constants (alphabetical; every bound names its unit or its meaning)
# ---------------------------------------------------------------------------

alias ACCUMULATE_PER_STIMULUS: Float64 = 0.16
    # Session-stimulus gain per unit of station stimulus (dimensionless).
alias BLUSH_RATE_FALL_PER_STEP: Float64 = 0.0078125
    # Blush approach rate toward a lower target, per 16 ms step (1/128).
alias BLUSH_RATE_RISE_PER_STEP: Float64 = 0.03125
    # Blush approach rate toward a higher target, per 16 ms step (1/32).
alias DISC_RADIUS_UNITS: Float64 = 40.0
    # Gaze disc radius in kernel units; iris offsets share the unit.
alias GAZE_DOWNCAST_MIN_NY: Float64 = 0.45
    # Section 1.7: normalised downward centre offset at/above which the
    # channel is DOWNCAST. Checked before the magnitude rule.
alias GAZE_TOWARD_MAX_M: Float64 = 0.30
    # Section 1.7: normalised centre magnitude at/below which the
    # channel is TOWARD (the gaze rests on the stimulus).
alias LEVEL_COUNT: Int = 3
alias SENSITIVITY_MAX: Float64 = 2.0
alias TIER_T1_MIN: Float64 = 0.25
    # Arousal-engine low-tier coupling: blush at/above this is tier T1.
alias TIER_T2_MIN: Float64 = 0.55
    # Arousal-engine low-tier coupling: blush at/above this is tier T2.

# Gaze channel codes (the schedule and the game share these integers).
alias CHANNEL_AWAY: Int = 1
alias CHANNEL_DOWNCAST: Int = 2
alias CHANNEL_INVALID: Int = -1
alias CHANNEL_TOWARD: Int = 0


# ---------------------------------------------------------------------------
# Scalar hygiene
# ---------------------------------------------------------------------------

fn sanitize(x: Float64) -> Float64:
    """Fail-closed scalar hygiene: NaN and +/-inf become 0.0.

    Contract: any Float64 in, a finite Float64 out. NaN is the only
    value unequal to itself; infinities are caught by the range test
    because no finite bound admits them.
    """
    if x != x or x > 1.0e308 or x < -1.0e308:
        return 0.0
    return x


fn clamp01(x: Float64) -> Float64:
    """Clamp a sanitised scalar into the channel range [0, 1]."""
    var v = sanitize(x)
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v


fn clamp_range(x: Float64, lo: Float64, hi: Float64) -> Float64:
    """Clamp a sanitised scalar into [lo, hi]. Precondition: lo <= hi."""
    var v = sanitize(x)
    if v < lo:
        return lo
    if v > hi:
        return hi
    return v


# ---------------------------------------------------------------------------
# Blush response curve and session dynamics
# ---------------------------------------------------------------------------

fn blush_curve(x: Float64) -> Float64:
    """The measured blush response curve: target blush for a stimulus.

    Shape: 1 - (1 - x)^3 over the clamped input - a saturating cubic
    with a fast initial rise and a long shoulder, chosen so the live
    path needs NO transcendental functions (engine research section 5.3:
    libm divergence across languages is a budgeted risk; a polynomial
    is bit-reproducible). Monotone non-decreasing on [0, 1]; curve(0)
    is exactly 0 and curve(1) is exactly 1.
    """
    var t = clamp01(x)
    var u = 1.0 - t
    return 1.0 - u * u * u


fn blush_target(session_stimulus: Float64, sensitivity: Float64) -> Float64:
    """Blush target for the accumulated session stimulus.

    Sensitivity is a level property in [0, SENSITIVITY_MAX]; the product
    is clamped to the curve's domain before evaluation, so an over-hot
    session saturates instead of wrapping.
    """
    var s = clamp01(session_stimulus)
    var k = clamp_range(sensitivity, 0.0, SENSITIVITY_MAX)
    return blush_curve(clamp01(s * k))


fn blush_step(current: Float64, target: Float64) -> Float64:
    """Advance the blush one fixed 16 ms step toward the target.

    Rise is four times faster than fall (1/32 vs 1/128 per step):
    colour arrives quickly and leaves slowly, which is the measured
    behaviour the D-4 record supports. One step, no loop, no state.
    """
    var c = clamp01(current)
    var t = clamp01(target)
    var rate = BLUSH_RATE_RISE_PER_STEP
    if t < c:
        rate = BLUSH_RATE_FALL_PER_STEP
    return clamp01(c + (t - c) * rate)


fn accumulate(session_stimulus: Float64, station_stimulus: Float64) -> Float64:
    """Fold one station's stimulus into the session accumulation.

    Bounded by construction: the result is clamped to [0, 1], so a
    session of any length saturates instead of growing without bound.
    """
    return clamp01(
        clamp01(session_stimulus)
        + clamp01(station_stimulus) * ACCUMULATE_PER_STIMULUS
    )


# ---------------------------------------------------------------------------
# Gaze channels - ratified section 1.7 full-disc-centre definition
# ---------------------------------------------------------------------------
# The scored quantity is the FULL iris-disc centre: the displacement of
# the disc centre from the eye centre, normalised by the disc radius.
# (The earlier pupil-only read was the D-4 defect; section 1.7 as
# amended 2026-10-30 scores the full disc centre, with a part-identity
# pass and a model-space cross-check on the measurement side. This
# kernel is the scoring side.)

fn gaze_valid(dx: Float64, dy: Float64, radius: Float64) -> Bool:
    """Geometry is readable only with finite offsets and radius > 0."""
    if radius != radius or radius > 1.0e308 or radius <= 0.0:
        return False
    if dx != dx or dy != dy:
        return False
    if dx > 1.0e308 or dx < -1.0e308 or dy > 1.0e308 or dy < -1.0e308:
        return False
    return True


fn gaze_magnitude(dx: Float64, dy: Float64, radius: Float64) -> Float64:
    """Normalised full-disc centre magnitude m = |(dx, dy)| / radius.

    Returns -1.0 (CHANNEL_INVALID as a magnitude) on unreadable
    geometry. m may exceed 1 when the centre leaves the disc; callers
    clamp where a range is required.
    """
    if not gaze_valid(dx, dy, radius):
        return -1.0
    return sqrt(dx * dx + dy * dy) / radius


fn gaze_channel(dx: Float64, dy: Float64, radius: Float64) -> Int:
    """Classify a gaze reading into TOWARD / AWAY / DOWNCAST / INVALID.

    Rule order is part of the contract: DOWNCAST is tested first on the
    normalised downward offset ny = dy / radius (screen coordinates,
    +y is down); a strongly lowered gaze is downcast whatever its
    magnitude. Otherwise a centre magnitude at/below GAZE_TOWARD_MAX_M
    is TOWARD; anything else is AWAY.
    """
    if not gaze_valid(dx, dy, radius):
        return CHANNEL_INVALID
    var ny = dy / radius
    if ny >= GAZE_DOWNCAST_MIN_NY:
        return CHANNEL_DOWNCAST
    if gaze_magnitude(dx, dy, radius) <= GAZE_TOWARD_MAX_M:
        return CHANNEL_TOWARD
    return CHANNEL_AWAY


fn gaze_score(dx: Float64, dy: Float64, radius: Float64) -> Float64:
    """Centredness score in [0, 1]: 1 - m, clamped. -1.0 if invalid."""
    var m = gaze_magnitude(dx, dy, radius)
    if m < 0.0:
        return -1.0
    return clamp01(1.0 - m)


fn gaze_stimulus(value: UInt32, channel: Int) -> Tuple[Int, Int]:
    """Derive a deterministic iris offset (kernel units) for a channel.

    The fitting's scripted gaze stimuli come from the session RNG
    stream; deriving them by integer arithmetic on one stream value
    keeps the Mojo reference and the JS transliteration in exact
    agreement (no floating point is involved). Channel-correct by
    construction:
    - TOWARD:   |dx| <= 6, |dy| <= 4   (m <= ~0.19, ny <= 0.10)
    - AWAY:     |dx| in [20, 32], |dy| <= 5 (m >= 0.50, ny <= 0.125)
    - DOWNCAST: dy in [20, 34], |dx| <= 5   (ny in [0.50, 0.85])
    An out-of-range channel code yields the TOWARD derivation (the
    least-committal stimulus); the game validates codes upstream.
    """
    var v = value
    if channel == CHANNEL_AWAY:
        var mag = 20 + Int(v % 13)
        var dx = mag
        if ((v >> 8) & 1) == 1:
            dx = -mag
        var dy = Int((v >> 4) % 11) - 5
        return (dx, dy)
    if channel == CHANNEL_DOWNCAST:
        var dy2 = 20 + Int(v % 15)
        var dx2 = Int((v >> 3) % 11) - 5
        return (dx2, dy2)
    var dx3 = Int(v % 13) - 6
    var dy3 = Int((v >> 4) % 9) - 4
    return (dx3, dy3)


# ---------------------------------------------------------------------------
# Arousal-engine low-tier coupling
# ---------------------------------------------------------------------------

fn tier_of(blush: Float64) -> Int:
    """Map a blush level to the arousal engine's low tiers (0, 1, 2).

    Thresholds are inclusive at the bottom: exactly TIER_T1_MIN is T1,
    exactly TIER_T2_MIN is T2. Blushline couples to the LOW tiers only;
    T3/T4 belong to the main-game line and are never produced here.
    """
    var b = clamp01(blush)
    if b >= TIER_T2_MIN:
        return 2
    if b >= TIER_T1_MIN:
        return 1
    return 0


# ---------------------------------------------------------------------------
# Deterministic RNG - splitmix32, integer-exact across languages
# ---------------------------------------------------------------------------

fn rng_next(state: UInt32) -> Tuple[UInt32, UInt32]:
    """Advance a splitmix32 stream; returns (new_state, value).

    Integer arithmetic only, so the stream is bit-identical in Mojo and
    in the JS transliteration (Math.imul semantics). The stdlib random
    source is never used: it is an unverifiable black box across the
    language boundary (engine research section 3).
    """
    var s = state + 0x9E3779B9
    var z = s
    z = (z ^ (z >> 16)) * 0x21F0AAAD
    z = (z ^ (z >> 15)) * 0x735A2D97
    return (s, z ^ (z >> 15))


# ---------------------------------------------------------------------------
# Measurement schedule scalars (per level; names are presentation data)
# ---------------------------------------------------------------------------

fn level_station_count(level: Int) -> Int:
    """Stations in a fitting session: 4 / 6 / 8 by level. 0 if invalid."""
    if level == 0:
        return 4
    if level == 1:
        return 6
    if level == 2:
        return 8
    return 0


fn level_window(level: Int) -> Float64:
    """Needle judge half-window (normalised, centre 0): 0.34/0.26/0.19."""
    if level == 0:
        return 0.34
    if level == 1:
        return 0.26
    if level == 2:
        return 0.19
    return 0.0


fn level_sensitivity(level: Int) -> Float64:
    """Blush sensitivity per level: 1.0 / 1.25 / 1.5. 0.0 if invalid."""
    if level == 0:
        return 1.0
    if level == 1:
        return 1.25
    if level == 2:
        return 1.5
    return 0.0


fn level_tier_target(level: Int) -> Int:
    """Tier the session must reach: T1 in level 1, T2 afterwards."""
    if level == 0:
        return 1
    if level == 1 or level == 2:
        return 2
    return 0


fn level_fit_target(level: Int) -> Int:
    """Fit-score threshold for a completed fitting: 55 / 65 / 75."""
    if level == 0:
        return 55
    if level == 1:
        return 65
    if level == 2:
        return 75
    return 0


# ---------------------------------------------------------------------------
# Driver: table + vector emission entry point (authoring time only)
# ---------------------------------------------------------------------------

fn main() raises:
    """Print the blush table samples the shipped tables are built from.

    The full vector set lives in conformance/vectors.json; this driver
    exists so a future Mojo-equipped host can regenerate the curve table
    and diff it against the recorded vectors. It performs no I/O beyond
    stdout and allocates nothing.
    """
    print("blushline kernel (mojo reference) - blush_curve samples:")
    for i in range(17):
        var x = Float64(i) / 16.0
        print(x, blush_curve(x))
    print("gaze_channel(30, 40, 100) =", gaze_channel(30.0, 40.0, 100.0))
    print("tier_of(0.55) =", tier_of(0.55))
