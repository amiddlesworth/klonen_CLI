import { describe, expect, it } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("lets the later color win", () => {
    expect(cn("text-fg-1", "text-danger")).toBe("text-danger");
    expect(cn("bg-surface", "bg-hover")).toBe("bg-hover");
    expect(cn("border-control", "border-danger")).toBe("border-danger");
  });

  it("keeps a custom text size next to a token color", () => {
    expect(cn("text-caption", "text-fg-3")).toBe("text-caption text-fg-3");
    expect(cn("text-fg-3", "text-caption")).toBe("text-fg-3 text-caption");
    for (const size of ["hero", "hero-sm", "display", "display-sm", "stat", "stat-sm", "title", "subtitle", "body", "prose", "small", "caption"]) {
      expect(cn(`text-${size}`, "text-fg-2")).toBe(`text-${size} text-fg-2`);
    }
  });

  it("lets the later custom text size win", () => {
    expect(cn("text-small", "text-caption")).toBe("text-caption");
    expect(cn("text-display-sm", "md:text-display", "text-hero")).toBe("md:text-display text-hero");
  });

  it("keeps a line height on either side of the size (Tailwind v4: leading-* always wins)", () => {
    expect(cn("text-caption", "leading-6")).toBe("text-caption leading-6");
    expect(cn("leading-none", "text-caption")).toBe("leading-none text-caption");
  });

  it("resolves self-alignment and margins by argument order", () => {
    expect(cn("self-start mt-px", "self-center mt-0")).toBe("self-center mt-0");
  });

  it("knows the custom shadow, container and animation names", () => {
    expect(cn("shadow-pop", "shadow-btn")).toBe("shadow-btn");
    expect(cn("max-w-page", "max-w-dialog")).toBe("max-w-dialog");
    expect(cn("shadow-pop", "shadow-transparent")).toBe("shadow-pop shadow-transparent");
  });

  it("keeps variants and unknown utilities apart", () => {
    expect(cn("text-fg-2", "hover:text-fg-1", "num", "target-24")).toBe("text-fg-2 hover:text-fg-1 num target-24");
    expect(cn("px-4", "md:px-6", false, undefined, ["py-2"])).toBe("px-4 md:px-6 py-2");
  });
});
