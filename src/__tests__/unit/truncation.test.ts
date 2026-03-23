import { describe, test, expect } from "bun:test";
import { truncateList, formatTruncation } from "../../core/truncation";

describe("truncateList", () => {
  test("returns all items when within limit", () => {
    const result = truncateList(["a", "b", "c"], 5);
    expect(result.items).toEqual(["a", "b", "c"]);
    expect(result.truncated).toBe(0);
  });

  test("truncates items exceeding limit", () => {
    const result = truncateList([1, 2, 3, 4, 5], 3);
    expect(result.items).toEqual([1, 2, 3]);
    expect(result.truncated).toBe(2);
  });

  test("returns all items at exact limit boundary", () => {
    const result = truncateList(["x", "y", "z"], 3);
    expect(result.items).toEqual(["x", "y", "z"]);
    expect(result.truncated).toBe(0);
  });

  test("handles empty list", () => {
    const result = truncateList([], 5);
    expect(result.items).toEqual([]);
    expect(result.truncated).toBe(0);
  });

  test("truncates to single item when max is 1", () => {
    const result = truncateList(["a", "b", "c"], 1);
    expect(result.items).toEqual(["a"]);
    expect(result.truncated).toBe(2);
  });
});

describe("formatTruncation", () => {
  test("returns empty string when truncated is zero", () => {
    expect(formatTruncation(0)).toBe("");
  });

  test("formats positive count with default label", () => {
    expect(formatTruncation(5)).toBe("... and 5 more items");
  });

  test("formats positive count with custom label", () => {
    expect(formatTruncation(3, "tasks")).toBe("... and 3 more tasks");
  });

  test("formats count of 1 with default label", () => {
    expect(formatTruncation(1)).toBe("... and 1 more items");
  });

  test("returns empty string for zero with custom label", () => {
    expect(formatTruncation(0, "features")).toBe("");
  });
});
