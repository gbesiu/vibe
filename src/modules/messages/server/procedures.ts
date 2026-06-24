import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { consumeCredits } from "@/lib/usage";
import { AI_MODEL_VALUES } from "@/lib/models";

export const messagesRouter = createTRPCRouter({
  getMany: protectedProcedure
  .input(
      z.object({
        projectId: z.string().min(1, { message: "Project ID is required" }),
      }),
    )
    .query(async ({ input, ctx }) => {
      const messages = await prisma.message.findMany({
        where: {
          projectId: input.projectId,
          project: {
            userId: ctx.auth.userId,
          },
        },
        include: {
          fragment: true,
        },
        orderBy: {
          updatedAt: "asc",
        },
      });

      return messages;
    }),
  recreateSandbox: protectedProcedure
    .input(z.object({ fragmentId: z.string().min(1, { message: "Fragment ID is required" }) }))
    .mutation(async ({ input, ctx }) => {
      const fragment = await prisma.fragment.findFirst({
        where: {
          id: input.fragmentId,
          message: { project: { userId: ctx.auth.userId } },
        },
      });

      if (!fragment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fragment not found" });
      }

      await inngest.send({
        name: "fragment/recreate-sandbox",
        data: { fragmentId: input.fragmentId },
      });

      return { success: true };
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required" })
          .max(10000, { message: "Value is too long" }),
        projectId: z.string().min(1, { message: "Project ID is required" }),
        model: z.enum(AI_MODEL_VALUES).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.projectId,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      try {
        await consumeCredits();
      } catch (error: unknown) {
        // rate-limiter-flexible throws a plain object (not Error) with _remainingPoints
        const rateLimitError = error as Record<string, unknown>;
        if (rateLimitError && typeof rateLimitError === "object" && "_remainingPoints" in rateLimitError) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits",
          });
        }
        // Log other errors but don't block message creation
        console.error("[messages.create] consumeCredits failed:", error);
      }

      const createdMessage = await prisma.message.create({
        data: {
          projectId: existingProject.id,
          content: input.value,
          role: "USER",
          type: "RESULT",
        },
      });

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: input.projectId,
          model: input.model,
        },
      });

      return createdMessage;
    }),
});
