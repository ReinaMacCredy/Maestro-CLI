import { describe, test, expect } from "bun:test";
import {
  MaestroError,
  formatError,
  formatWarning,
  formatSuggestion,
  formatHint,
} from "../../lib/errors";
import { truncateList, formatTruncation } from "../../core/truncation";

describe("MaestroError", () => {
  test("constructs with message only", () => {
    const err = new MaestroError("something broke");
    expect(err.message).toBe("something broke");
    expect(err.name).toBe("MaestroError");
    expect(err.hints).toEqual([]);
    expect(err).toBeInstanceOf(Error);
  });

  test("constructs with hints", () => {
    const err = new MaestroError("bad input", ["try --force", "check docs"]);
    expect(err.message).toBe("bad input");
    expect(err.hints).toEqual(["try --force", "check docs"]);
  });
});

describe("format functions", () => {
  test("formatError includes context and message", () => {
    expect(formatError("init", "config not found")).toBe(
      "[error] init: config not found",
    );
  });

  test("formatWarning prefixes with [warn]", () => {
    expect(formatWarning("disk almost full")).toBe("[warn] disk almost full");
  });

  test("formatSuggestion prefixes with [suggestion]", () => {
    expect(formatSuggestion("run init first")).toBe(
      "[suggestion] run init first",
    );
  });

  test("formatHint prefixes with [hint]", () => {
    expect(formatHint("use --verbose for details")).toBe(
      "[hint] use --verbose for details",
    );
  });
});

describe("truncation", () => {
  describe("truncateList", () => {
    test("returns all items when under max", () => {
      const result = truncateList([1, 2, 3], 5);
      expect(result.items).toEqual([1, 2, 3]);
      expect(result.truncated).toBe(0);
    });

    test("returns all items when exactly at max", () => {
      const result = truncateList([1, 2, 3], 3);
      expect(result.items).toEqual([1, 2, 3]);
      expect(result.truncated).toBe(0);
    });

    test("truncates items over max", () => {
      const result = truncateList(["a", "b", "c", "d", "e"], 2);
      expect(result.items).toEqual(["a", "b"]);
      expect(result.truncated).toBe(3);
    });
  });

  describe("formatTruncation", () => {
    test("returns empty string when truncated is 0", () => {
      expect(formatTruncation(0)).toBe("");
    });

    test("returns message with default label", () => {
      expect(formatTruncation(5)).toBe("... and 5 more items");
    });

    test("uses custom label", () => {
      expect(formatTruncation(3, "tasks")).toBe("... and 3 more tasks");
    });
  });
});
