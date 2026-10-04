import { describe, expect, it } from "vitest";
import { ShareIdGenerator } from "./share-id-generator.js";

describe("ShareIdGenerator", () => {
  it("generates ids with the configured length and alphabet", () => {
    const generator = new ShareIdGenerator({ alphabet: "abcdef0123456789", length: 10 });

    const id = generator.generate();

    expect(id).toHaveLength(10);
    expect(id).toMatch(/^[abcdef0-9]+$/);
  });

  it("rejects too-short ids", () => {
    expect(() => new ShareIdGenerator({ length: 5 })).toThrow(
      "Share id length must be at least 6 characters",
    );
  });
});
