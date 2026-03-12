import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import {
  setOutputMode,
  getOutputMode,
  output,
  renderTable,
  renderStatusLine,
  renderList,
} from "../../lib/output";

describe("output module", () => {
  beforeEach(() => {
    // Reset to known state before each test
    setOutputMode("text");
  });

  describe("setOutputMode / getOutputMode", () => {
    test("defaults to text after explicit set", () => {
      setOutputMode("text");
      expect(getOutputMode()).toBe("text");
    });

    test("switches to json", () => {
      setOutputMode("json");
      expect(getOutputMode()).toBe("json");
    });
  });

  describe("output()", () => {
    test("text mode calls textFormatter", () => {
      setOutputMode("text");
      const spy = spyOn(console, "log").mockImplementation(() => {});
      const data = { name: "test" };
      output(data, (d) => `Name: ${d.name}`);
      expect(spy).toHaveBeenCalledWith("Name: test");
      spy.mockRestore();
    });

    test("json mode prints JSON.stringify", () => {
      setOutputMode("json");
      const spy = spyOn(console, "log").mockImplementation(() => {});
      const data = { name: "test" };
      output(data, (d) => `Name: ${d.name}`);
      expect(spy).toHaveBeenCalledWith(JSON.stringify(data));
      spy.mockRestore();
    });
  });

  describe("renderTable", () => {
    test("aligns columns and separates header with dashes", () => {
      const headers = ["Name", "Status"];
      const rows = [
        ["alpha", "ok"],
        ["beta-long", "fail"],
      ];
      const result = renderTable(headers, rows);
      const lines = result.split("\n");

      // Header line
      expect(lines[0]).toBe("Name       Status");
      // Separator
      expect(lines[1]).toBe("---------  ------");
      // Rows
      expect(lines[2]).toBe("alpha      ok    ");
      expect(lines[3]).toBe("beta-long  fail  ");
    });

    test("handles empty rows", () => {
      const result = renderTable(["A", "B"], []);
      const lines = result.split("\n");
      expect(lines).toHaveLength(2); // header + separator
    });
  });

  describe("renderStatusLine", () => {
    test("formats label: value", () => {
      expect(renderStatusLine("Status", "running")).toBe("Status: running");
    });
  });

  describe("renderList", () => {
    test("prefixes each item with dash", () => {
      const result = renderList(["one", "two", "three"]);
      expect(result).toBe("- one\n- two\n- three");
    });

    test("handles single item", () => {
      expect(renderList(["only"])).toBe("- only");
    });

    test("handles empty list", () => {
      expect(renderList([])).toBe("");
    });
  });
});
