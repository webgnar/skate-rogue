# Tasks

## 1. Vehicles

- [ ] 1.1 Vehicle model (parked, robotaxi, oncoming) stepped with the skater; parked cars migrate to it; verify existing car-hop and slam tests still pass
- [ ] 1.2 Robotaxi braking and oncoming speed; verify tests for brake distance and the 0.75 s warning

## 2. Director

- [ ] 2.1 Seeded spawn plan by floor with fairness checks; verify determinism and density tests
- [ ] 2.2 Bot and validator with traffic; verify floors 1-8 on 50 seeds clear without being caught

## 3. Heat

- [ ] 3.1 Heat table and caught rule; verify tests (three quick slams catch, one slam is forgiven after clean skating)
- [ ] 3.2 Cruiser render driven by Heat, remount hold, escalation cues at 50, 75 and 90; verify screenshots

## 4. Integration

- [ ] 4.1 Caught camera beat and CAUGHT run-over screen; verify in a headless run
- [ ] 4.2 Push and send zack the Vercel preview
