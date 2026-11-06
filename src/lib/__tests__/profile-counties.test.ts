/**
 * `profiles.counties` is a Json column, but every writer in the app stores a
 * comma-separated string ("Alameda, Contra Costa") and the API reads it back
 * through a comma split. Older rows may hold a JSON array. This helper is the
 * single place that turns either shape into a `string[]` for the UI.
 */
import { parseProfileCounties } from "../profile-counties";

describe("parseProfileCounties", () => {
  it("returns an empty list for null, undefined and empty strings", () => {
    expect(parseProfileCounties(null)).toEqual([]);
    expect(parseProfileCounties(undefined)).toEqual([]);
    expect(parseProfileCounties("")).toEqual([]);
  });

  it("splits a comma-separated string and trims each entry", () => {
    expect(parseProfileCounties("Alameda, Contra Costa,San Mateo")).toEqual([
      "Alameda",
      "Contra Costa",
      "San Mateo",
    ]);
  });

  it("strips doubled quotes left by legacy CSV imports", () => {
    expect(parseProfileCounties('""Alameda, Marin""')).toEqual(["Alameda", "Marin"]);
  });

  it("drops empty segments from trailing or repeated commas", () => {
    expect(parseProfileCounties("Alameda,,Marin,")).toEqual(["Alameda", "Marin"]);
  });

  it("accepts a JSON array of strings, trimming and dropping blanks", () => {
    expect(parseProfileCounties([" Alameda", "Fulton ", ""])).toEqual(["Alameda", "Fulton"]);
  });

  it("ignores non-string entries inside an array", () => {
    expect(parseProfileCounties(["Alameda", 42, null, { county: "Marin" }])).toEqual(["Alameda"]);
  });

  it("returns an empty list for any other JSON shape", () => {
    expect(parseProfileCounties(42)).toEqual([]);
    expect(parseProfileCounties({ CA: ["Alameda"] })).toEqual([]);
    expect(parseProfileCounties(true)).toEqual([]);
  });
});
