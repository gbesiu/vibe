import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { RateLimiterPrisma } = require("rate-limiter-flexible") as {
  RateLimiterPrisma: new (opts: {
    storeClient: typeof prisma;
    tableName: string;
    points: number;
    duration: number;
  }) => {
    consume: (key: string, points?: number) => Promise<{ remainingPoints: number; msBeforeNext: number }>;
    get: (key: string) => Promise<{ remainingPoints: number; msBeforeNext: number } | null>;
  };
};

const FREE_POINTS = 5;   // liczba generacji / 30 dni dla planu darmowego
const PRO_POINTS = 100;  // liczba generacji / 30 dni dla planu pro
const DURATION = 30 * 24 * 60 * 60; // 30 days
const GENERATION_COST = 1;

export async function getUsageTracker() {
  const { has } = await auth();
  const hasProAccess = has({ plan: "pro" });

  const usageTracker = new RateLimiterPrisma({
    storeClient: prisma,
    tableName: "Usage",
    points: hasProAccess ? PRO_POINTS : FREE_POINTS,
    duration: DURATION,
  });

  return usageTracker;
};

export async function consumeCredits() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  try {
    const usageTracker = await getUsageTracker();
    const result = await usageTracker.consume(userId, GENERATION_COST);
    return result;
  } catch (error) {
    console.error("[consumeCredits] Error:", error);
    throw error;
  }
};

export async function getUsageStatus() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("User not authenticated");
  }

  const usageTracker = await getUsageTracker();
  const result = await usageTracker.get(userId);
  return result;
};
