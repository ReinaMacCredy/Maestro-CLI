---
tags: [cli, architecture, commands]
category: research
---
## CLI Command Architecture

- Framework: citty (`defineCommand`)
- Commands: `src/commands/<domain>/run.ts` or `src/commands/<domain>/<verb>.ts`
- Auto-registered by `src/commands/_internal/generate.ts` at build time
- Services: `getServices()` singleton returns all ports/adapters
- Output: `output(data, formatter)` for dual text/JSON
- Errors: `handleCommandError(command, err)` in try/catch
- Similar commands: `ping` (health check), `status` (aggregation), `search-sessions` (history query)
- Ports available: taskPort, featureAdapter, planAdapter, memoryAdapter, configAdapter, graphPort?, handoffPort?, searchPort?, doctrinePort?
