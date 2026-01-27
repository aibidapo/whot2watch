import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config
vi.mock("../agents/config", () => ({
  isPlanEnforcementEnabled: vi.fn(),
  getPlanConfig: vi.fn(() => ({
    planEnforcementEnabled: false,
    trialDurationDays: 14,
    freeListLimit: 5,
    premiumFeatures: [
      "advanced_filters",
      "early_alerts",
      "ad_free",
      "social_analytics",
    ],
  })),
}));

import { isPlanEnforcementEnabled } from "../agents/config";
import { premiumGate } from "./gate";

const mockPrisma = {
  planSubscription: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
};

describe("premiumGate", () => {
  let handler: (request: any, reply: any) => Promise<void>;
  let mockReply: any;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = premiumGate("advanced_filters", mockPrisma as any);
    mockReply = {
      code: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  it("passes through when plan enforcement is disabled", async () => {
    vi.mocked(isPlanEnforcementEnabled).mockReturnValue(false);

    await handler(
      { headers: { "x-user-id": "user-1" }, query: {}, body: {} },
      mockReply,
    );

    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it("returns 403 when enforcement enabled and no userId", async () => {
    vi.mocked(isPlanEnforcementEnabled).mockReturnValue(true);

    await handler({ headers: {}, query: {}, body: {} }, mockReply);

    expect(mockReply.code).toHaveBeenCalledWith(403);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "PREMIUM_REQUIRED" }),
    );
  });

  it("returns 403 when enforcement enabled and user is free tier", async () => {
    vi.mocked(isPlanEnforcementEnabled).mockReturnValue(true);
    mockPrisma.planSubscription.findUnique.mockResolvedValue(null);

    await handler(
      { headers: { "x-user-id": "user-1" }, query: {}, body: {} },
      mockReply,
    );

    expect(mockReply.code).toHaveBeenCalledWith(403);
    expect(mockReply.send).toHaveBeenCalledWith(
      expect.objectContaining({ error: "PREMIUM_REQUIRED" }),
    );
  });

  it("passes through when enforcement enabled and user is premium", async () => {
    vi.mocked(isPlanEnforcementEnabled).mockReturnValue(true);
    mockPrisma.planSubscription.findUnique.mockResolvedValue({
      userId: "user-1",
      plan: "premium",
      status: "active",
      trialEndsAt: null,
    });

    await handler(
      { headers: { "x-user-id": "user-1" }, query: {}, body: {} },
      mockReply,
    );

    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it("resolves userId from query param", async () => {
    vi.mocked(isPlanEnforcementEnabled).mockReturnValue(true);
    mockPrisma.planSubscription.findUnique.mockResolvedValue({
      userId: "user-1",
      plan: "premium",
      status: "active",
      trialEndsAt: null,
    });

    await handler(
      { headers: {}, query: { userId: "user-1" }, body: {} },
      mockReply,
    );

    expect(mockReply.code).not.toHaveBeenCalled();
  });

  it("resolves userId from body", async () => {
    vi.mocked(isPlanEnforcementEnabled).mockReturnValue(true);
    mockPrisma.planSubscription.findUnique.mockResolvedValue({
      userId: "user-1",
      plan: "premium",
      status: "active",
      trialEndsAt: null,
    });

    await handler(
      { headers: {}, query: {}, body: { userId: "user-1" } },
      mockReply,
    );

    expect(mockReply.code).not.toHaveBeenCalled();
  });
});
