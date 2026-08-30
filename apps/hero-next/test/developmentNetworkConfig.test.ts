import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("hero-next development network config", () => {
  it("keeps development origins independent of a DHCP-assigned IP", () => {
    expect(nextConfig.allowedDevOrigins).toEqual(["**.*"]);
    expect(nextConfig.allowedDevOrigins).not.toContain("192.168.50.5");
  });
});
