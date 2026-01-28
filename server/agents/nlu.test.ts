import { describe, it, expect } from "vitest";
import { extractEntities, stripEntities } from "./nlu";

describe("extractEntities", () => {
  it("extracts genres", () => {
    const entities = extractEntities("I want a comedy or drama");
    expect(entities.genres).toContain("Comedy");
    expect(entities.genres).toContain("Drama");
  });

  it("extracts services", () => {
    const entities = extractEntities("What's on Netflix or Hulu?");
    expect(entities.services).toContain("Netflix");
    expect(entities.services).toContain("Hulu");
  });

  it("extracts Disney+ variant", () => {
    const entities = extractEntities("on Disney+");
    expect(entities.services).toContain("Disney Plus");
  });

  it("extracts moods", () => {
    const entities = extractEntities("something funny and lighthearted");
    expect(entities.moods).toContain("comedy");
    expect(entities.moods).toContain("lighthearted");
  });

  it("extracts max duration", () => {
    const entities = extractEntities("under 90 minutes");
    expect(entities.duration).toEqual({ max: 90 });
  });

  it("extracts min duration in hours", () => {
    const entities = extractEntities("over 2 hours");
    expect(entities.duration).toEqual({ min: 120 });
  });

  it("extracts year min", () => {
    const entities = extractEntities("movies from 2020");
    expect(entities.releaseYear).toEqual({ min: 2020 });
  });

  it("extracts year max", () => {
    const entities = extractEntities("classics before 1990");
    expect(entities.releaseYear).toEqual({ max: 1990 });
  });

  it("extracts region (ISO code)", () => {
    const entities = extractEntities("available in the UK");
    expect(entities.region).toBe("GB");
  });

  it("extracts region from full country name", () => {
    const entities = extractEntities("movies in canada");
    expect(entities.region).toBe("CA");
  });

  it("extracts region from longer country name first", () => {
    const entities = extractEntities("shows available in the united kingdom");
    expect(entities.region).toBe("GB");
  });

  it("extracts region with alias", () => {
    const entities = extractEntities("what can I watch in britain");
    expect(entities.region).toBe("GB");
  });

  it("extracts quoted titles", () => {
    const entities = extractEntities('where can I watch "The Bear"?');
    expect(entities.titles).toEqual(["The Bear"]);
  });

  it("extracts multiple entity types", () => {
    const entities = extractEntities(
      "funny sci-fi on Netflix from 2020 under 2 hours"
    );
    expect(entities.moods).toContain("comedy");
    expect(entities.genres).toContain("Science Fiction");
    expect(entities.services).toContain("Netflix");
    expect(entities.releaseYear).toEqual({ min: 2020 });
    expect(entities.duration).toEqual({ max: 120 });
  });

  it("returns empty object for no entities", () => {
    const entities = extractEntities("hello");
    expect(entities.genres).toBeUndefined();
    expect(entities.services).toBeUndefined();
    expect(entities.moods).toBeUndefined();
  });

  it("returns empty object for empty string", () => {
    const entities = extractEntities("");
    expect(Object.keys(entities).length).toBe(0);
  });
});

describe("stripEntities", () => {
  it("strips service names", () => {
    const result = stripEntities("funny movies on Netflix");
    expect(result).not.toContain("Netflix");
    expect(result).not.toContain("netflix");
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it("strips duration phrases", () => {
    const result = stripEntities("action under 2 hours");
    expect(result).not.toContain("under 2 hours");
    expect(result).toContain("action");
  });

  it("strips year phrases", () => {
    const result = stripEntities("drama from 2020");
    expect(result).not.toContain("from 2020");
    expect(result).toContain("drama");
  });

  it("strips region phrases (short code)", () => {
    const result = stripEntities("movies in the US");
    expect(result).not.toMatch(/\bus\b/i);
  });

  it("strips region phrases (full country name)", () => {
    const result = stripEntities("movies in canada");
    expect(result).not.toMatch(/\bcanada\b/i);
  });

  it("strips region phrases (multi-word country name)", () => {
    const result = stripEntities("shows in the united kingdom");
    expect(result).not.toMatch(/united kingdom/i);
  });

  it("strips quoted titles", () => {
    const result = stripEntities('where can I find "The Bear"?');
    expect(result).not.toContain("The Bear");
  });

  it("strips multiple entity phrases", () => {
    const result = stripEntities(
      "funny movies on Netflix under 2 hours from 2020"
    );
    expect(result).not.toContain("Netflix");
    expect(result).not.toContain("under 2 hours");
    expect(result).not.toContain("from 2020");
    expect(result.trim().length).toBeGreaterThan(0);
  });

  it("collapses whitespace after stripping", () => {
    const result = stripEntities("drama on Hulu from 2020");
    expect(result).not.toMatch(/\s{2,}/);
  });

  it("returns trimmed result", () => {
    const result = stripEntities("on Netflix");
    expect(result).toBe(result.trim());
  });
});
