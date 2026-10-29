import { describe, expect, it } from "vitest";
import { cleanEssentialName, normalizeEssentialName, parseEssentialDictionary } from "../names";

describe("essential names", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeEssentialName("  Paper   Towels  ")).toBe("paper towels");
    expect(cleanEssentialName("  Paper   Towels  ")).toBe("Paper Towels");
  });

  it("parses text dictionaries safely", () => {
    expect(
      parseEssentialDictionary(`
        # Cleaning
        Dish soap

        dish   soap
        Trash bags
      `),
    ).toEqual([
      { name: "Dish soap", normalizedName: "dish soap" },
      { name: "Trash bags", normalizedName: "trash bags" },
    ]);
  });
});
