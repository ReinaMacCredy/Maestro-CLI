# Task: 03-create-history-use-case-and-tests

## Feature: diagnostic-commands

## Dependencies

_None_

## Plan Section

### 3. Create history use-case and tests
**Depends on**: none

**Files:**
- Create: `src/use-cases/history.ts`
- Test: `src/__tests__/unit/history.test.ts`

**What to do**:
1. Write failing test: `history()` returns array of `FeatureRecord` with name, status, taskStats, dates
2. Implement use-case:
   - `featureAdapter.list()` to get all features
   - For each feature: read feature metadata (status, created date)
   - For completed features: count tasks by state, compute duration (created --> completed)
   - Sort by most recent first
   - Accept `limit` param (default 10)
3. Return `{ features: FeatureRecord[], total: number }`
4. Run tests, verify pass

**Verify**:
- `bun test src/__tests__/unit/history.test.ts` --> all pass
