# Crypto Options Analytics Platform

**A real-time derivatives analytics engine for BTC and ETH options — built from scratch in Go.**

Live: [optiondashboard.online](https://optiondashboard.online)
Stack: Go 1.23 · React 19 + TypeScript · Redis 7 · TimescaleDB · Docker · nginx

---

## What it is

Deribit is the dominant venue for crypto options. It streams raw ticker data but gives you no
way to reason about the *surface* — where volatility is rich or cheap, how a multi-leg structure
pays off, or whether a given contract is trading away from its theoretical value.

This platform ingests that raw feed and turns it into a live analytics desk:

- Subscribes to **~1,300 BTC/ETH option contracts** simultaneously over Deribit's WebSocket API
- Processes **200–400 market updates per second** through a bounded Go worker pool
- Computes a **Black-Scholes theoretical price** for every contract on the hot path and flags
  its deviation from the exchange mark
- Maintains a live **implied-volatility surface** across the full strike × expiry grid, rendered
  as an interactive 3D plot
- Lets you build a **multi-leg position** and see its payoff diagram and breakeven points update
  in real time
- Persists every tick to a time-series database with **continuous aggregates** at 1 min / 15 min /
  1 hour for historical replay

The whole thing runs as four containers behind nginx with SSL, and degrades gracefully when
either datastore disappears.

---

## Why I built it

I wanted to work on the two problems that actually define a derivatives platform, rather than
just wiring an API to a chart:

1. **Latency under sustained load.** A pricing number is worthless if it arrives late. Getting
   from "bytes on a socket" to "priced, cached, and fanned out to browsers" in tens of
   microseconds forced me into profiling, cache-line layout, lock-free reads, and allocation
   elimination — not as buzzwords, but because each one showed up in a `pprof` profile.

2. **Pricing models that hold up in a crypto regime.** Textbook parameters are calibrated to
   equities. BTC realises ~150% implied volatility against equity's ~30%, jumps far more often,
   and shows almost none of the leverage effect that anchors equity models. That gap is where
   the interesting quantitative work lives.

---

## Architecture

```
Deribit WSS  (ticker.{instrument}.100ms  ·  ~1,300 channels  ·  200-400 msg/sec)
      │
      ▼
┌──────────────────────────────────────────────────────────────────┐
│ Go backend                                                       │
│                                                                  │
│  readLoop ──► buffered chan (1000) ──► worker pool (10-30)       │
│                                              │                   │
│                    sonic JSON (partial decode, pointer deref)    │
│                                              │                   │
│                    instrument metadata  ◄─ sync.Map (lock-free)  │
│                                              │                   │
│                    Black-Scholes  ◄─ 10k-entry N(d) lookup table │
│                                              │                   │
│                    IV surface update (strike × expiry grid)      │
│                                              │                   │
│  ┌───────────────────────────────────────────┴───────────────┐   │
│  ▼                                                           ▼   │
│ Redis 7                                             TimescaleDB  │
│  · source of truth for live state                    · hypertable│
│  · L1 LRU in front (1024 entries, 1s TTL)            · 1m/15m/1h │
│  · batched pipeline writes                             aggregates│
│  · circuit breaker (gobreaker)                       · compression│
│  · Pub/Sub ──┐                                         + retention│
└──────────────┼───────────────────────────────────────────────────┘
               ▼
         /ws fan-out ──► React dashboard (virtual table, 3D surface, PnL)
```

**Failure behaviour is explicit.** If Redis is unreachable the server still boots but serves no
live data and never registers `/ws` — Redis *is* the live state. If TimescaleDB is unreachable
you lose only the `/api/history/*` endpoints. Neither is fatal.

---

## The engineering

### Hot path: bytes to cached price

Every design decision below came out of a profile, and each is measurable in isolation.

| Stage | Technique | Cost |
|---|---|---|
| JSON decode | `bytedance/sonic` with `*float64` fields — decode once, dereference pointers instead of re-unmarshalling nested objects | ~2 µs |
| Instrument metadata | `sync.Map` pre-populated at startup, then effectively read-only → lock-free concurrent reads | **8.2 ns** sequential / **0.75 ns** parallel, 0 allocs |
| Black-Scholes | 10,000-entry `N(d)` lookup table (100 KB, [-5,+5], step 0.001) with linear interpolation, plus a discount-factor cache keyed on `(expiry, rate)`; puts via put-call parity | ~2 µs, 0 allocs |
| Redis write | Batched pipeline writes behind a circuit breaker | ~5 µs |

The lookup table is the fun one. `math.Erf` dominates at this message rate. Precomputing the
standard normal CDF trades 100 KB of cache-resident memory for a ~6× speedup, and adding linear
interpolation between adjacent entries recovers an order of magnitude of accuracy
(0.05% → 0.005% error) for about 5 ns.

### Honest latency accounting

The metrics dashboard initially reported ~1.1 ms per message while `pprof` showed ~95 µs p99.
Both numbers were "real" — they measured different things. Decomposing them gave:

```
end-to-end p99  ≈ 95 µs
   ├── queue wait      ~80 µs  (84%)   ← messages sitting in the channel
   └── processing      ~15 µs  (16%)   ← parse + price + cache write
```

Queue wait dominating is *normal and healthy* for an async worker pool — it means workers are
idle-waiting rather than backlogged. But reporting it as "processing latency" is misleading.
I instrumented each stage separately so the dashboard reports a number that can actually be
defended. Percentiles (p50/p95/p99/p99.9) come from a fixed-size ring buffer with a `sync.Pool`
for the sort scratch space, so the metrics path itself allocates nothing.

### Memory layout

`OptionState` is the struct touched on every single update. It's laid out by access frequency
rather than logical grouping:

```go
// HOT  (~168 B) — read together on every pricing/filter pass
InstrumentName, MarkPrice, UnderlyingPrice, MarkIV, DaysToExpiry,
Delta, Gamma, Vega, Theta, Rho, Timestamp, ExpirationTime

// WARM (64 B — exactly one cache line) — bid/ask spreads, theoretical price
BidPrice, AskPrice, BidIV, AskIV, MarkPriceUSD, TheoreticalPrice, ...

// COLD — strings and display-only fields, last
Underlying, OptionType, Expiration
```

Grouping the hot fields into the leading cache lines means a filter sweep over 1,300 options
pulls in far fewer cache lines than the naive field order did.

### Three-tier caching

1. **L1** — in-process LRU (`hashicorp/golang-lru/v2`), 1024 entries, 1 s TTL, atomic hit/miss counters
2. **Redis 7** — authoritative live state, hash storage, batched writes, Pub/Sub fan-out
3. **TimescaleDB** — hypertables with continuous aggregates; compression after 1 h; aggressive
   retention by design (raw ticks 4 h, 15-min bars 3 d, 1-hour bars 10 d)

### Frontend under real update pressure

Rendering 1,300 live rows naively re-created every DOM node on each tick. Fixes:

- **Windowed virtualization** (`@tanstack/react-virtual`) — ~20 rows in the DOM regardless of dataset size
- **Number formatting hoisted out of the render loop** — `Intl.NumberFormat` instances created once
  per data version instead of thousands of `toLocaleString()` calls per frame
- **Plotly WebGL lifecycle** — Plotly owns its DOM imperatively and does not release WebGL
  contexts on React unmount. Without an explicit `Plotly.purge()` in the cleanup effect the tab
  leaked ~20 MB/min while navigating. React's virtual DOM and Plotly's imperative ownership do
  not compose for free.
- **Vendor code splitting** — React, Plotly, and Recharts in separate chunks so the initial bundle
  isn't gated on the 3D library

---

## The quantitative work

### Live: Black-Scholes + surface construction

Every contract gets a theoretical price from the exchange's mark IV, and the platform surfaces
`mark − theoretical` in both absolute and percentage terms. The **implied-volatility surface**
is maintained as a strike × expiry grid with bilinear interpolation for points between quoted
contracts, backed by a keyed grid cache (5 s TTL) with dirty-tracking so a single contract
update doesn't force a full surface rebuild.

Greeks (delta, gamma, vega, theta, rho) are taken from Deribit's ticker feed rather than
recomputed locally — the exchange's Greeks are what the market actually references for margin
and hedging, so recomputing them would introduce disagreement without adding information.

### Position payoff engine

Multi-leg structures are priced at expiry via intrinsic value summed across legs, with breakeven
points located by scanning the payoff curve for sign changes and linearly interpolating the
crossing. The price range auto-widens to guarantee every selected strike stays visible.

### Research: Bates jump-diffusion via Fourier-cosine expansion

The deeper modelling work targets the **Bates model** — Heston stochastic volatility plus
Merton Poisson jumps:

```
dS/S = (r − λk_J) dt + √v dW^S + (e^J − 1) dN
dv   = κ(θ − v) dt + σ_v √v dW^v
```

Priced with the **COS method** (Fang & Oosterlee, 2008), which expands the risk-neutral density
in a Fourier-cosine series. For European payoffs this collapses to a single sum over `N` terms,
costing one characteristic-function evaluation per term — dramatically cheaper than Monte Carlo
across a whole strike ladder, since the truncation range and payoff coefficients are computed
once and reused for every strike.

What's implemented:

- **Characteristic function** with the `A(τ,u)` / `B(τ,u)` decomposition, the jump MGF
  `exp(λτ(e^{iuμ_J − σ_J²u²/2} − 1))` as a multiplicative factor, and the **"little Heston trap"**
  formulation (Albrecher et al. 2007; Lord & Kahl 2010) to select the correct complex-log branch —
  the naive branch makes long-dated prices oscillate and diverge
- **Cumulant-based adaptive truncation** — `[a,b] = c₁ ± L√(c₂ + √c₄)`, with `L = 12` rather than the
  textbook 10, because crypto's fatter tails need a wider integration domain
- **Analytic payoff coefficients** `χ_k(c,d)`, with the `k = 0` case handled separately
- **Adaptive term count** — `N = 128` inside 7 days to expiry, `N = 64` beyond, since short-dated
  options have sharply peaked densities needing more Fourier resolution
- **Parameter validation** including the **Feller condition** `2κθ ≥ σ_v²`, which guarantees the
  variance process stays strictly positive
- **Numerical guards** throughout — overflow clamping on complex exponentials, near-zero
  denominator detection, NaN propagation checks, put-call parity with intrinsic-value clamping

The crypto-specific calibration bounds are the genuinely interesting part. Equity defaults price
BTC options 3–5× below market. Encoding the regime difference means capturing that crypto
volatility runs ~10× equity's, mean-reverts roughly 3× slower, shows almost no leverage effect
(ρ ≈ −0.1 versus equity's strongly negative ρ), and jumps ~3× as often (λ ≈ 12/yr).

---

## Project status — what's live vs. what isn't

I'd rather be precise about this than oversell it.

| Component | Status |
|---|---|
| Deribit ingestion, worker pool, latency instrumentation | **Live in production** |
| Black-Scholes pricing + mark deviation | **Live in production** |
| IV surface construction + 3D rendering | **Live in production** |
| Multi-leg PnL / breakeven engine | **Live in production** |
| Redis + TimescaleDB tiering, aggregates, retention | **Live in production** |
| Heston / Bates COS pricer (`bates_mock/`) | **Standalone, numerical test suite passing** |
| Bates COS pricer wired for production (`internal/pricing/`) | **Implemented, not yet numerically correct — known bug** |
| Parameter calibration (L-BFGS against the observed smile) | **Specified in design docs, not implemented** |

On that known bug: the production-wired Bates pricer currently returns divergent prices (the
integration harness prints values on the order of `1e307`), which points at the payoff-coefficient
normalisation and the `e^{iu ln S₀}` forward term being double-counted between the characteristic
function and the summation loop. The standalone `bates_mock` implementation — which applies the
forward term inside the CF and uses the little-trap branch — passes its test suite. Reconciling
the two is the next piece of work, and the reason Black-Scholes remains the live pricer.

Shipping a fast, correct Black-Scholes path while the harder model is still being validated was
the right call. Being able to say exactly *why* the harder model isn't live yet seems more useful
than a green checkmark.

---

## Tech stack

| Layer | Choice | Reasoning |
|---|---|---|
| Backend | Go 1.23 | Goroutines map naturally onto per-message work; GC pauses are tolerable at these rates once the hot path is allocation-free |
| JSON | `bytedance/sonic` | SIMD-accelerated; partial decode into pointer fields avoids re-parsing nested Greeks/stats objects |
| Concurrency | bounded worker pool, `sync.Map`, `atomic`, `sync.Pool` | Bounded pool gives backpressure instead of unbounded goroutine growth under burst |
| Live cache | Redis 7 | Hash storage plus Pub/Sub makes caching and fan-out one dependency, not two |
| Resilience | `sony/gobreaker` | Circuit-break Redis so a slow cache doesn't cascade into ingestion |
| History | TimescaleDB | Continuous aggregates compute the dashboard's rollups without a separate batch job |
| API | `gorilla/mux` + response cache | Short-TTL response cache absorbs dashboard poll storms |
| Logging | `uber-go/zap` | Structured, low-allocation |
| Frontend | React 19, TypeScript, Vite 7 | — |
| Charts | Plotly.js (3D surface), Recharts (time series) | Plotly for WebGL 3D; Recharts for lighter 2D |
| Table | `@tanstack/react-virtual` | Windowing is the only way 1,300 live rows stay smooth |
| Infra | Docker multi-stage, Compose, nginx, Let's Encrypt | — |
| Profiling | `pprof`, custom percentile tracker | — |

---

## Running it

```bash
docker compose -f docker-compose.dev.yml up -d
# dashboard  → http://localhost:5173
# API        → http://localhost:8080
```

```bash
curl http://localhost:8080/health           # {"checks":{"redis":"ok","timescaledb":"ok"},"status":"ok"}
curl http://localhost:8080/api/index-prices # {"BTC":79000.94,"ETH":2524.12}
curl http://localhost:8080/api/metrics      # latency percentiles, cache hit rates, worker pool depth
```

Full operational documentation — environment variables, production deployment, security
checklist, known quirks, troubleshooting — lives in [`README.md`](./README.md).

### Selected API surface

| Endpoint | Purpose |
|---|---|
| `GET /api/options` | Full live option chain with pricing and deviations |
| `GET /api/iv-surface/{underlying}` | IV surface grid, optionally interpolated |
| `GET /api/history/{instrument}` | Historical ticks from continuous aggregates |
| `GET /api/history/iv/{underlying}` | Historical IV series |
| `GET /api/metrics` | Latency percentiles, cache stats, runtime, worker pool |
| `WS /ws` | Live push of option updates via Redis Pub/Sub |

---

## What I'd do next

- **Fix and deploy the Bates pricer** — reconcile forward-term handling between the two
  implementations, validate against `bates_mock`'s passing suite, then wire it in
- **Build the calibrator** — L-BFGS over the 8 Bates parameters against a spread-weighted RMSE
  objective, with the Feller condition as a hard constraint and a lock-free `atomic.Pointer`
  swap so recalibration never stalls the hot path
- **Fix the two failing L1 cache tests** — TTL expiry and a concurrency assertion, both test-side
  timing issues rather than production bugs, but they should be green
- **Replace bilinear IV interpolation with SVI or SABR** — bilinear can produce
  static-arbitrage-violating surfaces; a parametric fit would rule out calendar and butterfly
  arbitrage by construction
- **Analytic Greeks from the COS engine** — currently finite-difference, costing 3–5 pricing calls
  per Greek

---

## Notes for reviewers

Verified on a 13th Gen Intel i7-13700K:

```bash
go build ./...                                    # clean
go test ./...                                     # api, filter, parser, pricing, websocket pass
                                                  # cache: 2 known test-side failures
go test -bench=. -benchmem ./internal/parser/     # 8.167 ns/op sequential, 0 allocs
                                                  # 0.7482 ns/op parallel,   0 allocs
cd bates_mock && go test ./internal/pricing/      # passes (~34 s of numerical validation)
```

Latency figures (95 µs p99, ~2 µs Black-Scholes, ~2 µs JSON parse) come from `pprof` profiling and
per-stage instrumentation against the live Deribit feed, and are reproducible via
`GET /api/metrics` on a running instance. The cache-lookup figures above are from the checked-in
Go benchmarks, reproducible with the command shown.
