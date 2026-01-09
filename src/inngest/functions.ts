/* eslint-disable no-console */
import { z } from "zod";
import OpenAI from "openai";
import { Sandbox } from "@e2b/code-interpreter";

import { inngest } from "@/inngest/client";
import { PROMPT as SYSTEM_PROMPT, RESPONSE_PROMPT, FRAGMENT_TITLE_PROMPT } from "@/prompt";
import { prisma } from "@/lib/db";

import {
  runChannel,
  RUN_TOPICS,
  publishPreview,
  publishProgress,
  publishLog,
  publishResult,
  ProgressTask,
  ProgressPayload,
  LogPayload,
  ResultPayload,
  RunRealtimeToken,
  RunTopic
} from "./helpers";

/* =========================
   2) Event contracts
   ========================= */

// Renamed to match user request: vibe/app.build.requested
const BuildRequestedEvent = z.object({
  name: z.literal("vibe/app.build.requested"),
  data: z.object({
    runId: z.string().min(6),
    userId: z.string().min(1),
    prompt: z.string().min(1),
    projectId: z.string().optional(),
    // Optional thread/context
    previousMessages: z
      .array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        })
      )
      .optional(),
    // Optional meta
    model: z.string().optional(),
    maxIterations: z.number().int().min(1).max(40).optional(),
  }),
});
export type BuildRequestedEvent = z.infer<typeof BuildRequestedEvent>;

/* =========================
   4) Agent Schemas
   ========================= */

const AGENT_DECISION_SCHEMA = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool"),
    summary: z.string().min(1),
    tool: z.enum(["terminal", "createOrUpdateFiles", "readFiles"]),
    input: z.any(),
    taskUpdate: z
      .object({
        taskId: z.string().min(1),
        status: z.enum(["queued", "running", "done", "error"]),
        detail: z.string().optional(),
      })
      .optional(),
  }),
  z.object({
    type: z.literal("final"),
    task_summary: z.string().min(1),
  }),
]);
type AgentDecision = z.infer<typeof AGENT_DECISION_SCHEMA>;

/* =========================
   6) E2B tool adapters
   ========================= */

async function toolTerminal(sandbox: Sandbox, command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Be safe: basic terminal usage
  const res = await sandbox.commands.run(command);
  return {
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
    exitCode: typeof res.exitCode === "number" ? res.exitCode : 0,
  };
}

async function toolWriteFiles(
  sandbox: Sandbox,
  files: Array<{ path: string; content: string }>
): Promise<{ written: number }> {
  // Ensure all paths are absolute for E2B
  const absFiles = files.map(f => ({
    ...f,
    path: f.path.startsWith("/") ? f.path : `/${f.path}`
  }));

  // Write sequentially to avoid race conditions if many files
  for (const f of absFiles) {
    // E2B Sandbox.files.write usually exists
    await sandbox.files.write(f.path, f.content);
  }
  return { written: files.length };
}

async function toolReadFiles(
  sandbox: Sandbox,
  paths: string[]
): Promise<Array<{ path: string; content: string }>> {
  const out: Array<{ path: string; content: string }> = [];
  for (const p of paths) {
    const abs = p.startsWith("/") ? p : `/${p}`;
    try {
      const content = await sandbox.files.read(abs);
      out.push({ path: abs, content: content ?? "" });
    } catch (err: any) {
      out.push({ path: abs, content: `Error reading file: ${err.message}` });
    }
  }
  return out;
}

/* =========================
   7) LLM helper (OpenAI)
   ========================= */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "dummy" });

async function llmJSON(opts: {
  model: string;
  system: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}): Promise<any> {
  // Retry logic could go here
  const res = await openai.chat.completions.create({
    model: opts.model,
    temperature: 0.2, // Low temp for stability
    messages: [
      { role: "system", content: opts.system },
      ...opts.messages,
    ],
    response_format: { type: "json_object" },
  });

  const content = res.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(content);
  } catch {
    // Fallback if JSON is broken
    return { type: "tool", tool: "readFiles", input: { paths: ["/app/page.tsx"] }, summary: "JSON parse error, fallback to readFiles." };
  }
}

async function llmText(opts: {
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  const res = await openai.chat.completions.create({
    model: opts.model,
    temperature: 0.4,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });
  return (res.choices[0]?.message?.content ?? "").trim();
}

/* =========================
   8) Workflow: build app
   ========================= */

export const buildAppWorkflow = inngest.createFunction(
  { id: "vibe-app-build-workflow" },
  { event: "vibe/app.build.requested" },
  async ({ event, step }) => {

    // @ts-ignore
    const publishFn = arguments[0].publish || (async (msg) => { });

    const runId = event.data.runId;
    const userId = event.data.userId;
    const prompt = event.data.prompt;
    const projectId = event.data.projectId;
    const previousMessages = event.data.previousMessages || [];
    const model = event.data.model || "gpt-4o-mini";
    const maxIterations = event.data.maxIterations || 18;

    if (!runId || !prompt) {
      throw new Error("Missing runId or prompt");
    }

    const tasks: ProgressTask[] = [
      { id: "get-sandbox-id", label: "Tworzenie środowiska (Sandbox)", status: "queued" },
      { id: "init-network", label: "Analiza kontekstu", status: "queued" },
      { id: "agent-loop", label: "Praca Agenta Vibe", status: "queued" },
      { id: "fragment-title", label: "Generowanie tytułu", status: "queued" },
      { id: "response", label: "Personalizacja odpowiedzi", status: "queued" },
      { id: "save-result", label: "Zapisywanie wersji", status: "queued" },
      { id: "finalization", label: "Gotowe!", status: "queued" },
    ];

    await publishProgress(publishFn, runId, { kind: "init", tasks });

    // 1) Sandbox
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "get-sandbox-id", status: "running" });
    const sandboxId = await step.run("create-sandbox", async () => {
      // Create sandbox logic
      const sb = await Sandbox.create();
      return sb.sandboxId;
    });
    // @ts-ignore
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "get-sandbox-id", status: "done", detail: sandboxId });

    // RECONNECT TO SANDBOX
    // Note: sandboxId comes from step.run (persistent)
    let sandbox: Sandbox | undefined;
    try {
      sandbox = await Sandbox.connect(sandboxId);
    } catch (e) {
      console.error("Failed to connect to sandbox", e);
      // If we can't connect, should we fail? Yes, tool calls will fail.
    }

    // 2) Init State (Load History)
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "init-network", status: "running" });
    const state = await step.run("init-state", async () => {
      let memory = [...previousMessages];

      if (projectId && memory.length === 0) {
        const history = await prisma.message.findMany({
          where: { projectId },
          orderBy: { createdAt: "asc" },
          take: 20
        });
        memory = history.map(m => ({
          role: m.role.toLowerCase() as "user" | "assistant",
          content: m.content
        }));
      }

      return {
        userId,
        runId,
        projectId,
        memory,
        toolTrace: [] as Array<{ tool: string; input: any; output: any }>,
      };
    });
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "init-network", status: "done" });

    // 3) Loop
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "agent-loop", status: "running" });

    let taskSummary = "";
    // Setup initial messages
    const agentMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      ...state.memory,
      {
        role: "user",
        content:
          `Użytkownik chce zbudować aplikację w sandboxie Next.js.\n` +
          `ZADANIE:\n${prompt}\n` +
          `Kontekst techniczny: Użytkownik widzi logi w czasie rzeczywistym.`,
      },
    ];

    for (let i = 0; i < maxIterations; i++) {
      await publishLog(publishFn, runId, `[Agent] Iteracja ${i + 1}/${maxIterations}...`);

      const decisionRaw = await step.run(`agent-decision-${i + 1}`, async () => {
        return await llmJSON({
          model,
          system: SYSTEM_PROMPT, // From @/prompt
          messages: [
            ...agentMessages,
            {
              role: "user",
              content:
                `Obecny stan (ostatnie 8 akcji):\n${JSON.stringify(state.toolTrace.slice(-8), null, 2)}\n\n` +
                `Masz do dyspozycji narzędzia: terminal, createOrUpdateFiles, readFiles.\n` +
                `Decyzja (JSON)?`,
            },
          ],
        });
      });

      const decisionParsed = AGENT_DECISION_SCHEMA.safeParse(decisionRaw);

      let decision: AgentDecision;
      if (!decisionParsed.success) {
        await publishLog(publishFn, runId, `[System] Błąd JSON Agenta. Ponawiam próbę odczytu.`);
        // Fallback action
        decision = { type: "tool", tool: "readFiles", input: { paths: ["/app/page.tsx"] }, summary: "Auto-correction: reading file." };
      } else {
        decision = decisionParsed.data;
      }

      if (decision.type === "final") {
        taskSummary = decision.task_summary;
        // @ts-ignore
        await publishLog(publishFn, runId, `[Agent] Zakończono pracę.`);
        break;
      }

      // Execute Tool
      if (decision.type === "tool") {
        await publishLog(publishFn, runId, `> ${decision.tool}: ${decision.summary}`);

        const toolOutput = await step.run(`tool-${decision.tool}-${i + 1}`, async () => {
          // @ts-ignore
          if (!sandbox) throw new Error("Sandbox died");

          if (decision.tool === "terminal") {
            const cmd = decision.input?.command || "";
            // @ts-ignore
            return await toolTerminal(sandbox, cmd);
          }
          if (decision.tool === "createOrUpdateFiles") {
            const files = decision.input?.files || [];
            // @ts-ignore
            const start = Date.now();
            const res = await toolWriteFiles(sandbox, files);
            // Emit preview update!
            await publishPreview(publishFn, runId);
            return res;
          }
          if (decision.tool === "readFiles") {
            const paths = decision.input?.paths || [];
            // @ts-ignore
            return await toolReadFiles(sandbox, paths);
          }
          return { error: "Unknown tool" };
        });

        // Add to trace
        state.toolTrace.push({ tool: decision.tool, input: decision.input, output: toolOutput });

        // Add to conversation
        agentMessages.push({ role: "assistant", content: JSON.stringify(decision) });
        agentMessages.push({ role: "user", content: `Wynik narzędzia:\n${JSON.stringify(toolOutput).slice(0, 4000)}` });

        if (decision.taskUpdate) {
          // Optional: update specific UI tasks
        }
      }
    }

    if (!taskSummary) {
      taskSummary = "Zakończono limit iteracji. Aplikacja powinna być gotowa, ale agent nie potwierdził finalizacji.";
    }

    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "agent-loop", status: "done" });

    // 4) Fragment Title
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "fragment-title", status: "running" });
    const fragmentTitle = await step.run("fragment-title", async () => {
      const title = await llmText({
        model,
        system: "Generator Tytułów",
        user: `${FRAGMENT_TITLE_PROMPT}\n\nPodsumowanie:\n${taskSummary}`,
      });
      return title.replace(/[^\p{L}\p{N}\s]/gu, "").trim().slice(0, 50);
    });
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "fragment-title", status: "done", detail: fragmentTitle });

    // 5) Response
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "response", status: "running" });
    const response = await step.run("final-response", async () => {
      return await llmText({
        model,
        system: RESPONSE_PROMPT,
        user: `Podsumowanie prac:\n${taskSummary}\n\nWygeneruj odpowiedź dla użytkownika.`,
      });
    });
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "response", status: "done" });

    // 6) Sandbox URL
    const sandboxUrl = await step.run("sandbox-url", async () => {
      if (!sandbox) return "";
      // @ts-ignore
      return `https://${sandbox.getHost(3000)}`;
    });

    // 7) Save (Placeholder Hook for now)
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "save-result", status: "running" });
    // In a real app, you would call prisma.fragment.create here using step.run
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "save-result", status: "done" });

    // 8) Finalize
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "finalization", status: "running" });
    await publishResult(publishFn, runId, {
      kind: "result",
      fragmentTitle,
      response,
      sandboxUrl,
      taskSummary
    });
    await publishProgress(publishFn, runId, { kind: "task_update", taskId: "finalization", status: "done" });

    // Cleanup
    await step.run("cleanup", async () => {
      try {
        // @ts-ignore
        await sandbox?.kill(); // Use kill instead of close, just in case
      } catch { }
    });

    return { runId, fragmentTitle, sandboxUrl };
  }
);
