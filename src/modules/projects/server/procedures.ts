import { z } from "zod";
import { generateSlug } from "random-word-slugs";

import { prisma } from "@/lib/db";
import { TRPCError } from "@trpc/server";
import { inngest } from "@/inngest/client";
import { consumeCredits } from "@/lib/usage";
import { protectedProcedure, createTRPCRouter, baseProcedure } from "@/trpc/init";

export const projectsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({
      id: z.string().min(1, { message: "Id is required" }),
    }))
    .query(async ({ input, ctx }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.id,
          userId: ctx.auth.userId,
        },
      });

      if (!existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      return existingProject;
    }),
  getPublic: baseProcedure
    .input(z.object({
      id: z.string().min(1, { message: "Id is required" }),
    }))
    .query(async ({ input }) => {
      const existingProject = await prisma.project.findUnique({
        where: {
          id: input.id,
        },
        include: {
          messages: {
            take: 1,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              fragment: true,
            }
          }
        }
      });

      if (!existingProject) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }

      return existingProject;
    }),
  getMany: protectedProcedure
    .query(async ({ ctx }) => {
      const projects = await prisma.project.findMany({
        where: {
          userId: ctx.auth.userId,
        },
        orderBy: {
          updatedAt: "desc",
        },
        include: {
          messages: {
            take: 1,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              fragment: true,
            }
          }
        }
      });

      return projects;
    }),
  create: protectedProcedure
    .input(
      z.object({
        value: z.string()
          .min(1, { message: "Value is required" })
          .max(10000, { message: "Value is too long" })
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        await consumeCredits();
      } catch (error) {
        if (error instanceof Error && 'remainingPoints' in error) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "You have run out of credits"
          });
        }
        throw error;
        //throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Something went wrong" });
      }

      const createdProject = await prisma.project.create({
        data: {
          userId: ctx.auth.userId,
          name: generateSlug(2, {
            format: "kebab",
          }),
          messages: {
            create: {
              content: input.value,
              role: "USER",
              type: "RESULT",
            }
          }
        }
      });

      await inngest.send({
        name: "code-agent/run",
        data: {
          value: input.value,
          projectId: createdProject.id,
        },
      });

      return createdProject;
    }),
  updateFile: protectedProcedure
    .input(z.object({
      projectId: z.string().min(1, { message: "Project ID is required" }),
      fragmentId: z.string().min(1, { message: "Fragment ID is required" }),
      action: z.object({
        path: z.string().min(1, { message: "Path is required" }),
        content: z.string(),
      }),
    }))
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

      const existingFragment = await prisma.fragment.findUnique({
        where: {
          id: input.fragmentId,
        },
      });

      if (!existingFragment) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fragment not found" });
      }

      const files = existingFragment.files as Record<string, string>;
      const newFiles = {
        ...files,
        [input.action.path]: input.action.content,
      };

      await prisma.fragment.update({
        where: {
          id: input.fragmentId,
        },
        data: {
          files: newFiles,
        },
      });

      return { success: true };
    }),
});
