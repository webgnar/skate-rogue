# Proposal

## Why

The GDD's traffic table has two hazards that wait for the skater, the bus stop (`B`) and the parked car door (`E`),
and neither was built. zack asked the threads to keep building through the GDD overnight (2026-10-24).

## What Changes

- **Bus stops** from floor 4: one stop on open street on most floors. A bus signals in the back lane, pulls into the
  skate lane at the stop, waits, then drives on. Other traffic pulls out around it.
- **Car doors** from floor 2: half the plain parked cars have a door that swings open as the skater comes up. Rolling
  into it is a slam, and landing on its edge pops the skater up like a car hop.
- **District gravity:** each floor gets its act's district gravity (Atlantis 0.8) and is validated in it.

## Capabilities

### New Capabilities

- `street-hazards`: bus stops and car doors.
