import { z } from "zod";
import { Sandbox } from "@e2b/code-interpreter";
import { anthropic, createAgent, createTool, createNetwork, type Tool, type Message, createState } from "@inngest/agent-kit";

import { prisma } from "@/lib/db";
import { FRAGMENT_TITLE_PROMPT, PROMPT, RESPONSE_PROMPT } from "@/prompt";

import { inngest } from "./client";
import { SANDBOX_TIMEOUT } from "./types";
import { getSandbox, lastAssistantTextMessageContent, parseAgentOutput } from "./utils";

// Model agenta kodu — konfigurowalny przez zmienną środowiskową CODE_AGENT_MODEL
const CODE_AGENT_MODEL = process.env.CODE_AGENT_MODEL || "claude-sonnet-4-20250514";

// Ile ostatnich wiadomości projektu trafia do kontekstu agenta (konfigurowalne).
const AGENT_HISTORY_MESSAGES = Number(process.env.AGENT_HISTORY_MESSAGES) || 15;

interface AgentState {
  summary: string;
  files: { [path: string]: string };
};

export const codeAgentFunction = inngest.createFunction(
  { id: "code-agent" },
  { event: "code-agent/run" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const templateId = process.env.E2B_SANDBOX_TEMPLATE || "vibe-code-fotz";
      const sandbox = await Sandbox.create(templateId);
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox.sandboxId;
    });

    const previousMessages = await step.run("get-previous-messages", async () => {
      const formattedMessages: Message[] = [];

      const messages = await prisma.message.findMany({
        where: {
          projectId: event.data.projectId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: AGENT_HISTORY_MESSAGES,
      });

      for (const message of messages) {
        formattedMessages.push({
          type: "text",
          role: message.role === "ASSISTANT" ? "assistant" : "user",
          content: message.content,
        })
      }

      return formattedMessages.reverse();
    });

    const codeModel = (event.data.model as string) || CODE_AGENT_MODEL;

    const state = createState<AgentState>(
      {
        summary: "",
        files: {},
      },
      {
        messages: previousMessages,
      },
    );

    const codeAgent = createAgent<AgentState>({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: anthropic({ 
        model: codeModel,
        defaultParameters: {
          max_tokens: 16384,
          temperature: 0.1,
        },
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: z.object({
            command: z.string(),
          }),
          handler: async ({ command }, { step }) => {
            return await step?.run("terminal", async () => {
              const buffers = { stdout: "", stderr: "" };

              try {
                const sandbox = await getSandbox(sandboxId);
                const result = await sandbox.commands.run(command, {
                  onStdout: (data: string) => {
                    buffers.stdout += data;
                  },
                  onStderr: (data: string) => {
                    buffers.stderr += data;
                  }
                });
                return result.stdout;
              } catch (e) {
                console.error(
                  `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderror: ${buffers.stderr}`,
                );
                return `Command failed: ${e} \nstdout: ${buffers.stdout}\nstderr: ${buffers.stderr}`;
              }
            });
          },
        }),
        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string(),
              }),
            ),
          }),
          handler: async (
            { files },
            { step, network }: Tool.Options<AgentState>
          ) => {
            const newFiles = await step?.run("createOrUpdateFiles", async () => {
              try {
                const updatedFiles = network.state.data.files || {};
                const sandbox = await getSandbox(sandboxId);
                for (const file of files) {
                  await sandbox.files.write(file.path, file.content);
                  updatedFiles[file.path] = file.content;
                }

                return updatedFiles;
              } catch (e) {
                return "Error: " + e;
              }
            });

            if (typeof newFiles === "object") {
              network.state.data.files = newFiles;
            }
          }
        }),
        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: z.object({
            files: z.array(z.string()),
          }),
          handler: async ({ files }, { step }) => {
            return await step?.run("readFiles", async () => {
              try {
                const sandbox = await getSandbox(sandboxId);
                const contents = [];
                for (const file of files) {
                  const content = await sandbox.files.read(file);
                  contents.push({ path: file, content });
                }
                return JSON.stringify(contents);
              } catch (e) {
                return "Error: " + e;
              }
            })
          },
        })
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const lastAssistantMessageText =
            lastAssistantTextMessageContent(result);

          if (lastAssistantMessageText && network) {
            if (lastAssistantMessageText.includes("<task_summary>")) {
              network.state.data.summary = lastAssistantMessageText;
            }
          }

          return result;
        },
      },
    });

    const network = createNetwork<AgentState>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 15,
      defaultState: state,
      router: async ({ network }) => {
        const summary = network.state.data.summary;

        if (summary) {
          return;
        }

        return codeAgent;
      },
    });

    let result = await network.run(event.data.value, { state });

    // --- Self-healing (opt-in): verify the generated app type-checks; if not, feed the errors back to the agent ---
    // Controlled by SELF_HEAL_MAX_ATTEMPTS (default 0 = disabled). Set to 1+ to enable.
    // Uses `npx tsc --noEmit` (the dev server keeps running; we must NOT run dev/build/start here).
    // Fully guarded: any failure falls back to the original result and never breaks generation.
    const SELF_HEAL_MAX_ATTEMPTS = Number(process.env.SELF_HEAL_MAX_ATTEMPTS ?? "0");
    try {
      for (let attempt = 1; attempt <= SELF_HEAL_MAX_ATTEMPTS; attempt++) {
        if (Object.keys(result.state.data.files || {}).length === 0) break;

        const typeErrors = await step.run(`self-heal-typecheck-${attempt}`, async () => {
          try {
            const sandbox = await getSandbox(sandboxId);
            await sandbox.commands.run("cd /home/user && npx tsc --noEmit");
            return null; // type-check passed
          } catch (e) {
            const err = e as { stdout?: string; stderr?: string };
            const output = `${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim() || String(e);
            return output.slice(0, 6000);
          }
        });

        if (!typeErrors) break; // app type-checks — nothing to heal

        // Clear the summary so the router lets the agent run again, then ask it to fix the errors.
        state.data.summary = "";
        result = await network.run(
          `The application you just generated does not type-check. Fix ALL of the following TypeScript errors by editing the affected files with createOrUpdateFiles. Do not run dev/build/start scripts. Re-emit a <task_summary> when done.\n\n<tsc_errors>\n${typeErrors}\n</tsc_errors>`,
          { state },
        );
      }
    } catch (healError) {
      // Self-healing must never break the main flow.
      console.error("[self-heal] skipped due to error:", healError);
    }

    const fragmentTitleGenerator = createAgent({
      name: "fragment-title-generator",
      description: "A fragment title generator",
      system: FRAGMENT_TITLE_PROMPT,
      model: anthropic({ 
        model: CODE_AGENT_MODEL,
        defaultParameters: {
          max_tokens: 4096,
        },
      }),
    })

    const responseGenerator = createAgent({
      name: "response-generator",
      description: "A response generator",
      system: RESPONSE_PROMPT,
      model: anthropic({ 
        model: CODE_AGENT_MODEL,
        defaultParameters: {
          max_tokens: 4096,
        },
      }),
    });

    // Anthropic requires at least 1 message - ensure summary is never empty
    const summaryText = result.state.data.summary || 
      `<task_summary>Created files: ${Object.keys(result.state.data.files || {}).join(", ") || "none"}</task_summary>`;

    const { 
      output: fragmentTitleOuput
    } = await fragmentTitleGenerator.run(summaryText);
    const { 
      output: responseOutput
    } = await responseGenerator.run(summaryText);

    const isError =
      Object.keys(result.state.data.files || {}).length === 0;

    const sandboxUrl = await step.run("get-sandbox-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("save-result", async () => {
      if (isError) {
        return await prisma.message.create({
          data: {
            projectId: event.data.projectId,
            content: "Something went wrong while generating your app. Please try again — a shorter or more specific prompt often helps.",
            role: "ASSISTANT",
            type: "ERROR",
          },
        });
      }

      return await prisma.message.create({
        data: {
          projectId: event.data.projectId,
          content: parseAgentOutput(responseOutput),
          role: "ASSISTANT",
          type: "RESULT",
          fragment: {
            create: {
              sandboxUrl: sandboxUrl,
              title: parseAgentOutput(fragmentTitleOuput),
              files: JSON.stringify(result.state.data.files),
            },
          },
        },
      })
    });

    return { 
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  },
);

// Recreate an E2B sandbox from a fragment's saved files (previews expire after SANDBOX_TIMEOUT).
export const recreateSandboxFunction = inngest.createFunction(
  { id: "recreate-sandbox" },
  { event: "fragment/recreate-sandbox" },
  async ({ event, step }) => {
    const fragmentId = event.data.fragmentId as string;

    const files = await step.run("load-fragment-files", async () => {
      const fragment = await prisma.fragment.findUnique({
        where: { id: fragmentId },
      });
      if (!fragment) {
        throw new Error("Fragment not found");
      }
      try {
        return JSON.parse(fragment.files || "{}") as { [path: string]: string };
      } catch {
        return {} as { [path: string]: string };
      }
    });

    const sandboxUrl = await step.run("create-and-populate-sandbox", async () => {
      const templateId = process.env.E2B_SANDBOX_TEMPLATE || "vibe-code-fotz";
      const sandbox = await Sandbox.create(templateId);
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      for (const [path, content] of Object.entries(files)) {
        await sandbox.files.write(path, content);
      }
      const host = sandbox.getHost(3000);
      return `https://${host}`;
    });

    await step.run("update-fragment-url", async () => {
      return prisma.fragment.update({
        where: { id: fragmentId },
        data: { sandboxUrl },
      });
    });

    return { url: sandboxUrl };
  },
);
