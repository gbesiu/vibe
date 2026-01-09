import { z } from "zod";
import { TRPCError } from "@trpc/server";

import { prisma } from "@/lib/db";
import { inngest } from "@/inngest/client";
import { protectedProcedure, createTRPCRouter } from "@/trpc/init";
import { consumeCredits } from "@/lib/usage";
import { getRunSubscriptionToken } from "@/inngest/helpers";

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
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required" })
          .max(10000, { message: "Value is too long" }),
        projectId: z.string().min(1, { message: "Project ID is required" }),
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
      } catch (error) {
        if (error instanceof Error && 'remainingPoints' in error) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits"
          });
        }
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Something went wrong" });
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
        name: "vibe/app.build.requested",
        data: {
          runId: createdMessage.id,
          userId: ctx.auth.userId,
          projectId: input.projectId,
          prompt: input.value,
        },
      });

      return createdMessage;
    }),
  getRealtimeTokenV2: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ input }) => {
      return await getRunSubscriptionToken({ runId: input.runId });
    }),

  getRunStatus: protectedProcedure
    .input(z.object({ runId: z.string() }))
    .query(async ({ input, ctx }) => {
      const message = await prisma.message.findUnique({
        where: { id: input.runId },
        include: { fragment: true },
      });

      if (!message) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Message not found" });
      }

      // Check if message belongs to user's project
      const project = await prisma.project.findFirst({
        where: {
          id: message.projectId,
          userId: ctx.auth.userId,
        },
      });

      if (!project) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return {
        id: message.id,
        type: message.type,
        role: message.role,
        content: message.content,
        hasFragment: !!message.fragment,
        fragmentId: message.fragment?.id,
        updatedAt: message.updatedAt,
      };
    }),
});
