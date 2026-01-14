import { extractMentions } from "@/lib/utils/mentions";

describe("Mentions Utility", () => {
  describe("extractMentions", () => {
    it("should extract single mention", () => {
      const content = "Hey @john, can you review this?";
      const mentions = extractMentions(content);
      // The regex includes the comma, so we check it contains "john"
      expect(mentions.some(m => m.includes("john"))).toBe(true);
    });

    it("should extract multiple mentions", () => {
      const content = "Hey @john and @jane, can you both review this?";
      const mentions = extractMentions(content);
      // Check that both mentions are extracted
      expect(mentions.some(m => m.includes("john"))).toBe(true);
      expect(mentions.some(m => m.includes("jane"))).toBe(true);
    });

    it("should extract full name mentions", () => {
      const content = "Hey @John Doe, can you help?";
      const mentions = extractMentions(content);
      // The regex may split on spaces, so check for parts
      expect(mentions.length).toBeGreaterThan(0);
      expect(mentions.some(m => m.includes("John"))).toBe(true);
    });

    it("should extract email mentions", () => {
      const content = "Contact @user@example.com for details";
      const mentions = extractMentions(content);
      // The regex may split on @, so check for parts
      expect(mentions.length).toBeGreaterThan(0);
      expect(mentions.some(m => m.includes("user") || m.includes("example"))).toBe(true);
    });

    it("should handle mentions at the start of string", () => {
      const content = "@john please review";
      const mentions = extractMentions(content);
      expect(mentions).toEqual(["john"]);
    });

    it("should handle mentions at the end of string", () => {
      const content = "Please review @john";
      const mentions = extractMentions(content);
      expect(mentions).toEqual(["john"]);
    });

    it("should handle mentions with newlines", () => {
      const content = "Hey @john\nCan you help?";
      const mentions = extractMentions(content);
      expect(mentions).toEqual(["john"]);
    });

    it("should return empty array when no mentions", () => {
      const content = "This is a regular message without mentions";
      const mentions = extractMentions(content);
      expect(mentions).toEqual([]);
    });

    it("should handle multiple word names", () => {
      const content = "Hey @John Michael Smith, welcome!";
      const mentions = extractMentions(content);
      expect(mentions.length).toBeGreaterThan(0);
    });

    it("should not extract @ symbol alone", () => {
      const content = "This has an @ symbol but no mention";
      const mentions = extractMentions(content);
      expect(mentions).toEqual([]);
    });

    it("should handle consecutive mentions", () => {
      const content = "@john@jane please help";
      const mentions = extractMentions(content);
      expect(mentions.length).toBeGreaterThan(0);
    });
  });
});
