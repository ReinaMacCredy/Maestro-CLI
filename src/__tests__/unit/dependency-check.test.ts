import { describe, test, expect, beforeEach } from "bun:test";
import { InMemoryTaskPort } from "../mocks/in-memory-task-port";
import { checkDependencies } from "../../utils/dependency-check";

describe("checkDependencies", () => {
  const feature = "test-feature";
  let port: InMemoryTaskPort;

  beforeEach(() => {
    port = new InMemoryTaskPort();
  });

  test("task with no dependencies is allowed", async () => {
    await port.create(feature, "Solo task", { deps: [] });

    const result = await checkDependencies(port, feature, "01-solo-task");

    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("task with all deps done is allowed", async () => {
    await port.create(feature, "Foundation", { deps: [] });
    await port.create(feature, "Depends on foundation", { deps: ["01-foundation"] });

    port.setStatus(feature, "01-foundation", "done");

    const result = await checkDependencies(port, feature, "02-depends-on-foundation");

    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("task with unmet deps is blocked", async () => {
    await port.create(feature, "First step", { deps: [] });
    await port.create(feature, "Second step", { deps: ["01-first-step"] });

    // 01-first-step stays pending (not done)

    const result = await checkDependencies(port, feature, "02-second-step");

    expect(result.allowed).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("01-first-step");
    expect(result.error).toContain("dependencies not done");
  });

  test("task with multiple deps, one unmet, is blocked", async () => {
    await port.create(feature, "Step A", { deps: [] });
    await port.create(feature, "Step B", { deps: [] });
    await port.create(feature, "Step C", { deps: ["01-step-a", "02-step-b"] });

    port.setStatus(feature, "01-step-a", "done");
    // 02-step-b stays pending

    const result = await checkDependencies(port, feature, "03-step-c");

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("02-step-b");
  });

  test("task with all multiple deps done is allowed", async () => {
    await port.create(feature, "Step A", { deps: [] });
    await port.create(feature, "Step B", { deps: [] });
    await port.create(feature, "Step C", { deps: ["01-step-a", "02-step-b"] });

    port.setStatus(feature, "01-step-a", "done");
    port.setStatus(feature, "02-step-b", "done");

    const result = await checkDependencies(port, feature, "03-step-c");

    expect(result.allowed).toBe(true);
  });

  test("review status satisfies dependencies", async () => {
    await port.create(feature, "Step A", { deps: [] });
    await port.create(feature, "Step B", { deps: ["01-step-a"] });

    port.setStatus(feature, "01-step-a", "review");

    const result = await checkDependencies(port, feature, "02-step-b");

    expect(result.allowed).toBe(true);
  });

  test("revision status does NOT satisfy dependencies", async () => {
    await port.create(feature, "Step A", { deps: [] });
    await port.create(feature, "Step B", { deps: ["01-step-a"] });

    port.setStatus(feature, "01-step-a", "revision");

    const result = await checkDependencies(port, feature, "02-step-b");

    expect(result.allowed).toBe(false);
    expect(result.error).toContain("01-step-a");
  });
});
