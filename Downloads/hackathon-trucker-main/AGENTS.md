<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

# Product Context

This repo is building **RightCall**, an intervention intelligence platform for freight.

- Core promise: turn ELD/dispatch signals into the **right human action at the right moment**.
- Primary value moment: a dispatcher can see which few drivers need attention, and who should take the next load, in under 30 seconds.
- Prefer describing the product as an **intervention intelligence platform** or **decision-support tool**. Do not frame it as autonomous dispatching.
- The moat is the labeled outcome flywheel: every alert, intervention, override, and result should be instrumented so the system learns from real dispatcher behavior over time.

# Product Principles

- Keep a human in the loop. Recommendations are allowed; autonomous assignments or auto-actions are out of scope unless the user explicitly asks for them.
- Optimize for trust, not alert volume. False positives and unexplained scoring are product failures.
- Treat drivers as partners, not surveillance targets. Driver-facing experiences should be transparent, plain-English, and contestable.
- Preserve explainability. Dispatchers and drivers should see the top reasons behind a score or recommendation.
- Safety comes before efficiency. Margin or optimization features should not weaken compliance or driver trust.

# MVP Scope

When making product choices without further instruction, bias toward the hardened MVP from the PRD:

1. Live dispatcher priority queue
2. Alert detail + intervention logging
3. Smart Match Lite with top 3 candidates
4. Driver scorecard portal
5. Admin / outcomes reporting
6. Driver consent flow and right-to-contest flow

Assume the MVP is intentionally narrow:

- Start with a single ELD provider if needed; normalize provider data behind a canonical schema.
- Use a validated rules engine before claiming ML-driven precision.
- Keep matching human-approved and auditable.
- Prefer responsive web before native apps unless the user explicitly asks otherwise.

# Explicit Non-Goals

Unless the user says otherwise, do not expand scope into:

- autonomous dispatching
- replacing the fleet's ELD, TMS, payroll, or ERP
- enterprise SSO / billing platform work
- insurance underwriting features
- margin / lane economics module
- multi-provider ELD support if single-provider MVP is enough
- ML precision claims before sufficient labeled data exists

# Legal and Trust Guardrails

These are non-negotiable product constraints and should shape both UI and data design:

- Drivers must acknowledge what is collected, how it is used, and who can see it before their first scored trip.
- Drivers must be able to contest trip events; target review SLA is within 72 hours.
- KPI scores are coaching / operational inputs, not standalone grounds for termination or other employment decisions.
- When scores influence dispatch recommendations, keep an audit trail with timestamp, version, inputs, and dispatcher action.
- Raw telemetry should be treated as time-limited data; the PRD target is 12 months raw retention and longer retention for aggregates / derived scores.
- Driver-facing copy should be plain English, not jargon-heavy model language.
- Drivers should only see their own score details, trends, and recent contributing trips, not fleet rankings or raw model features.

# Core Domain Model

If you need to introduce or rename entities, prefer the PRD's language:

- `drivers`
- `vehicles`
- `trips`
- `telemetry_events`
- `driver_features`
- `risk_assessments`
- `alerts`
- `interventions`
- `driver_kpi_scores`
- `loads`
- `match_recommendations`

Canonical telemetry should normalize provider-specific fields into shared app fields such as:

- fleet / driver / vehicle identifiers
- ELD provider + raw provider event ID
- event type
- occurred / received timestamps
- GPS lat/lon (+ optional accuracy)
- vehicle speed
- g-force for harsh events
- HOS driving remaining
- duty status
- engine state
- schema version

Do not leak provider-specific field names deep into shared product logic if a canonical field can be used instead.

# Behavioral Rules Worth Preserving

- End-to-end alerting target: event to dispatcher-visible alert in under 30 seconds.
- The dispatcher queue is a curated action queue, not a giant list of all drivers.
- Safe drivers should collapse into summary counts by default.
- Alert fatigue budget matters: avoid designs that could exceed roughly 4 ALERT/CRITICAL notifications per dispatcher per hour over an 8-hour shift.
- New drivers with fewer than 30 scored trips should be treated as cold-start / uncalibrated rather than over-personalized.
- Smart matching should first enforce hard constraints, then rank remaining candidates.

Hard matching constraints from the PRD:

- enough HOS remaining for trip duration plus buffer
- required certifications present
- not in a suspended safety band
- not currently blocked by required break rules
- feasible deadhead distance

Recommendations should include short, plain-English explanations. Overrides should be logged with structured reasons.

# Repo-Specific Implementation Note

The PRD proposes a broader cloud/microservice architecture, but this repo currently uses React + TypeScript + Vite + Convex. Treat the PRD's architecture section as **product intent and system constraints**, not as a requirement to mirror the exact infrastructure stack. In this codebase:

- preserve the product contracts, auditability, and latency goals
- use Convex-friendly data modeling and realtime patterns
- keep implementation incremental and MVP-focused

# Frontend Demo Simulation

There is a frontend-only playback dataset for risk demo work at `src/mocks/driverRiskSimulation.ts`.

Use it when building or iterating on the RightCall demo timeline. It is intentionally deterministic and should be preferred over calling the Python model live from the frontend for the current demo flow.

What it contains:

- exactly 3 drivers
- exactly 60 ticks per driver
- a 60-second playback window
- 2 simulated minutes per tick
- deterministic `riskScore`, `riskBand`, explanations, and lat/lng movement

Driver intent:

- one driver stays safely `green`
- one driver trends into `yellow`
- one driver is clearly `red`

Important exports:

- `simulationMeta`: playback constants such as `playbackSeconds = 60` and `simulatedMinutesPerTick = 2`
- `driverRiskSimulation`: full dataset grouped by driver, each with `driver` summary data and `snapshots`
- `driverSummaries`: top-level driver cards / list-friendly summaries
- `driverSnapshotsById`: direct lookup map for all ticks by driver id
- `simulationFrames`: all 60 synchronized frames, one per playback second
- `getSimulationFrame(second)`: preferred helper when the UI needs all drivers at one playback second
- `getDriverStateAtSecond(driverId, second)`: preferred helper for a single driver detail view

Behavior notes:

- `second` values are clamped into the valid range `0-59`
- no API calls, no Convex reads/writes, and no runtime randomness
- the data is meant for demo playback and UI prototyping, not backend ingestion
- risk bands map as:
  - `green`: `0-34`
  - `yellow`: `35-59`
  - `red`: `60+`

Recommended usage when wiring the UI later:

1. Use `simulationMeta.playbackSeconds` to bound the timer or scrubber.
2. Drive the playback clock with one integer second per UI tick.
3. Call `getSimulationFrame(currentSecond)` to render the dispatcher/map view for that moment.
4. Call `getDriverStateAtSecond(driverId, currentSecond)` for a selected driver side panel, details drawer, or scorecard.
5. Use `driverSummaries` for static list scaffolding before playback starts.

Example import:

```ts
import {
  driverSummaries,
  getDriverStateAtSecond,
  getSimulationFrame,
  simulationMeta,
} from './mocks/driverRiskSimulation'
```

Example playback usage:

```ts
const frame = getSimulationFrame(currentSecond)
const selectedDriver = getDriverStateAtSecond('driver-yellow', currentSecond)
```

If this module is extended later, preserve these constraints unless the product direction changes:

- keep the demo human-in-the-loop and explainable
- prefer deterministic playback over opaque scoring for the MVP demo
- keep explanations plain English
- avoid introducing backend coupling unless the user explicitly asks for it
