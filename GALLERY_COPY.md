# Gallery copy — ready to paste

Pre-written blurbs at different lengths for a personal-site portfolio entry.
Everything here is factually consistent with `SHOWCASE.md`.

---

## Project title options

- Crypto Options Analytics Platform
- Real-Time Crypto Options Analytics Engine
- BTC/ETH Options Analytics — Live Derivatives Pricing at Microsecond Latency

**Tagline:** Real-time derivatives analytics for BTC and ETH options, built from scratch in Go.

**Live demo:** https://optiondashboard.online

**Tags:** `Go` `Quantitative Finance` `Options Pricing` `Low Latency` `React` `TypeScript`
`Redis` `TimescaleDB` `WebSockets` `Docker`

---

## One-line (gallery card / grid tile)

> A production options analytics engine that prices ~1,300 live BTC/ETH contracts at 400 msg/sec
> with a 95 µs p99 latency, and renders the volatility surface in 3D.

---

## Short (2–3 sentences — card hover or project summary)

> A real-time derivatives analytics platform for crypto options, built in Go. It ingests ~1,300
> live BTC and ETH option contracts from Deribit's WebSocket feed, computes Black-Scholes
> theoretical prices on the hot path at a measured 95 µs p99 end-to-end latency, and maintains a
> live implied-volatility surface rendered as an interactive 3D plot. The backend runs a bounded
> worker pool over a three-tier cache (in-process LRU → Redis → TimescaleDB) with graceful
> degradation when either datastore fails.

---

## Medium (project page intro — ~150 words)

> Deribit is the dominant venue for crypto options, but its raw feed gives you no way to reason
> about the volatility surface. I built a platform that turns that feed into a live analytics desk.
>
> It subscribes to roughly 1,300 BTC and ETH option contracts simultaneously, processing 200–400
> market updates per second through a bounded Go worker pool. Each update gets a Black-Scholes
> theoretical price computed on the hot path — 2 µs, zero allocations, using a 10,000-entry
> precomputed normal-CDF lookup table with linear interpolation. The platform maintains a live
> implied-volatility surface across the full strike × expiry grid, and lets you assemble
> multi-leg positions and watch payoff diagrams and breakevens update in real time.
>
> The quantitative depth goes further than Black-Scholes: I implemented a Bates jump-diffusion
> pricer using the Fourier-cosine (COS) method, including the "little Heston trap" branch
> correction and cumulant-based adaptive truncation tuned for crypto's fat tails.

---

## Technical highlights (bulleted list for a project page)

- **95 µs p99 end-to-end latency**, decomposed via `pprof` into queue wait (80 µs) and actual
  processing (15 µs) — because reporting the aggregate as "processing time" would have been
  misleading
- **2 µs Black-Scholes** with zero allocations, using a 10,000-entry precomputed `N(d)` lookup
  table with linear interpolation — ~6× faster than `math.Erf` while improving accuracy 10×
- **0.75 ns instrument metadata lookup** under parallel load via a pre-populated `sync.Map`,
  giving genuinely lock-free concurrent reads on the hot path
- **Cache-line-conscious struct layout** — `OptionState` ordered by access frequency so a filter
  sweep over 1,300 contracts touches minimal cache lines
- **Three-tier cache** — in-process LRU (1 s TTL, atomic counters) → Redis 7 with batched pipeline
  writes and Pub/Sub fan-out → TimescaleDB hypertables with 1 min/15 min/1 hour continuous
  aggregates
- **Bates jump-diffusion COS pricer** — characteristic function with `A`/`B` decomposition, jump
  MGF, little-Heston-trap complex-log branch selection, cumulant-based adaptive truncation
  (`L = 12` for crypto's fat tails), Feller condition validation
- **1,300-row live table at 60 fps** via windowed virtualization, with `Intl.NumberFormat`
  hoisted out of the render loop and Plotly WebGL contexts explicitly purged on unmount to stop
  a 20 MB/min leak
- **Resilient by design** — circuit breaker around Redis, graceful degradation when either
  datastore is unreachable, ordered shutdown that flushes pending writes

---

## Interview talking points

Three stories worth having ready, each with a concrete number and a real tradeoff:

**1. The latency number that was wrong.**
The dashboard reported 1.1 ms; `pprof` said 95 µs. Both were measuring something real. Queue wait
was 84% of the total, which is *healthy* for an async worker pool — workers idle-waiting, not
backlogged. Instrumenting each stage separately produced a number I could actually defend. Good
demonstration of measuring the right thing rather than the convenient thing.

**2. Why the lookup table beats the library function.**
`math.Erf` was the hot spot in the BS path. Precomputing the normal CDF across [-5, +5] at 0.001
resolution costs 100 KB — small enough to stay cache-resident — and gives ~6× throughput. Naive
table lookup loses accuracy, so adding linear interpolation between adjacent entries recovers an
order of magnitude (0.05% → 0.005% error) for about 5 ns. A clean space/time/accuracy tradeoff
with all three axes quantified.

**3. Why Black-Scholes is live and Bates isn't.**
The Bates COS pricer is implemented but the production-wired version diverges — it double-counts
the `e^{iu ln S₀}` forward term between the characteristic function and the summation loop, so
prices blow up to ~1e307. The standalone version, which applies the forward term inside the CF
and uses the little-trap branch, passes its numerical suite. I shipped the correct fast path and
kept the harder model out of production rather than shipping something I couldn't validate. Being
able to name the exact bug is the point.

**Also worth raising:** why equity-calibrated parameters price BTC options 3–5× below market
(~150% vol vs 30%, ~3× slower mean reversion, almost no leverage effect, ~3× jump frequency), and
why bilinear IV interpolation is a known weakness that SVI or SABR would fix by ruling out
static arbitrage by construction.

---

## Screenshots worth capturing

1. **Options chain** — the live table with pricing deviation columns highlighted
2. **3D IV surface** — rotated to show the volatility smile and term structure together
3. **PnL diagram** — a multi-leg structure (a spread or straddle) with breakevens marked
4. **Performance dashboard** — latency percentiles and cache hit rates, since it substantiates
   the numbers in the write-up
5. **Architecture diagram** — redraw the ASCII diagram from `SHOWCASE.md` cleanly

---

## Positioning note

Two distinct strengths are on display here, and it's worth being explicit about both:
systems engineering (profiling, lock-free concurrency, cache hierarchy, memory layout) and
quantitative finance (stochastic volatility, jump diffusion, Fourier pricing methods,
regime-aware calibration). Quant dev roles sit exactly at that intersection, so lead with
whichever matches the specific firm — infrastructure-heavy shops care about the 95 µs and the
cache work, research-oriented desks care about the COS method and the crypto calibration analysis.

The honest status table is a feature, not a liability. Anyone technical will probe the claims;
having already documented what works, what doesn't, and precisely why builds far more credibility
than an unqualified feature list.
