---
name: City catalog & Dakar hub
description: Strict 36-city list and Dakar always locked as the other endpoint of every route
type: feature
---
- City selectors (`worldCities.ts`) expose only the 36 predefined cities — Dakar is NOT in the list.
- `HUB_DAKAR` is a constant; flows import it and lock one side of the route to Dakar via `<DakarHubLock role="origin|destination" />` (FlowPrimitives).
- SendFlow uses a `direction` toggle ('to_dakar' | 'from_dakar') to decide which selector is shown vs. locked.
- All routes are Dakar ↔ ville étrangère, no override possible.
