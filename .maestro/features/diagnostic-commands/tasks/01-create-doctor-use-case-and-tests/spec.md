# Task: 01-create-doctor-use-case-and-tests

## Feature: diagnostic-commands

## Dependencies

_None_

## Plan Section

### 1. Create doctor use-case and tests
**Depends on**: none

**Files:**
- Create: `src/use-cases/doctor.ts`
- Test: `src/__tests__/unit/doctor.test.ts`

**What to do**:
1. Write failing test: `doctor()` returns a `DoctorReport` with checks array (each: name, status ok/warn/fail, message)
2. Implement use-case that checks:
   - Config file exists and parses (`configAdapter.get()`)
   - Active feature resolvable (`featureAdapter.active()`)
   - Task backend reachable (`taskPort.list()` on active feature)
   - Optional integrations detected: graphPort, handoffPort, searchPort, doctrinePort (present/absent)
3. Return `{ checks: Check[], summary: { ok: number, warn: number, fail: number } }`
4. Run tests, verify pass

**Verify**:
- `bun test src/__tests__/unit/doctor.test.ts` --> all pass
