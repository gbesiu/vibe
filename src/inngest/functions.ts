import { z } from "zod";
import OpenAI from "openai";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
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
   7) LLM helper (Gemini)
   ========================= */

// Support API key from env var
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.warn("[Gemini] GEMINI_API_KEY is missing from environment variables");
}
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "dummy-key");

async function llmJSON(opts: {
  model: string;
  system: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  logger?: (msg: string) => void;
}): Promise<any> {
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro",
    generationConfig: {
      responseMimeType: "application/json",
    },
    systemInstruction: opts.system,
  });

  // Convert messages to Gemini format (simplistic chat history)
  // Gemini expects: { role: 'user' | 'model', parts: [{ text: string }] }
  const contents = opts.messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  })).filter(m => m.role !== "system"); // System is already in systemInstruction

  let result;
  try {
    result = await model.generateContent({ contents });
  } catch (err: any) {
    console.warn(`[Gemini] Primary (3-pro) failed: ${err.message}. Waiting 2s...`);
    await new Promise(r => setTimeout(r, 2000));

    try {
      // First fallback: 2.0 Flash
      if (opts.logger) opts.logger("[Gemini] Fallback 1: Gemini 2.0 Flash...");
      const fallbackModel1 = genAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: opts.system,
      });
      result = await fallbackModel1.generateContent({ contents });

    } catch (err2: any) {
      console.warn(`[Gemini] Fallback 1 failed: ${err2.message}. Waiting 2s...`);
      await new Promise(r => setTimeout(r, 2000));

      // Second fallback: 1.5 Flash (Most stable/high limit)
      if (opts.logger) opts.logger("[Gemini] Fallback 2: Gemini 1.5 Flash (Last Resort)...");
      const fallbackModel2 = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" },
        systemInstruction: opts.system,
      });
      result = await fallbackModel2.generateContent({ contents });
    }
  }

  const response = result.response;
  const content = response.text();

  try {
    return JSON.parse(content);
  } catch (err) {
    console.error("[Gemini] JSON Parse Error:", err, content);
    // Fallback logic
    return {
      type: "tool",
      tool: "readFiles",
      input: { paths: ["/app/page.tsx"] },
      summary: "JSON parse error from Gemini, falling back to read."
    };
  }
}

async function llmText(opts: {
  model: string;
  system: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-3-pro",
    systemInstruction: opts.system,
  });

  const contents = opts.messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  })).filter(m => m.role !== "system");

  let result;
  try {
    result = await model.generateContent({ contents });
  } catch (err: any) {
    // 1st Fallback
    await new Promise(r => setTimeout(r, 2000));
    try {
      const fb1 = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp", systemInstruction: opts.system });
      result = await fb1.generateContent({ contents });
    } catch (err2) {
      // 2nd Fallback
      await new Promise(r => setTimeout(r, 2000));
      const fb2 = genAI.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: opts.system });
      result = await fb2.generateContent({ contents });
    }
  }

  return result.response.text();
}

/* =========================
   8) Workflow: build app
   ========================= */

export const buildAppWorkflow = inngest.createFunction(
  { id: "vibe-app-build-workflow" },
  { event: "vibe/app.build.requested" },
  async ({ event, step, publish }) => {
    // Inngest Realtime publish function
    const publishFn = publish || (async (msg: any) => { });

    const runId = event.data.runId;
    const userId = event.data.userId;
    const prompt = event.data.prompt;
    const projectId = event.data.projectId;
    const previousMessages = event.data.previousMessages || [];
    const model = event.data.model || "gpt-4o-mini";
    const maxIterations = event.data.maxIterations || 18;

    console.log("!!! BuildAppWorkflow Triggered !!!", { runId, userId, prompt });

    try {
      if (!runId || !prompt) {
        console.error("!!! Missing runId or prompt !!!");
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

        // Start the development server in the background
        await sb.commands.run("npm run dev", { background: true });

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
            logger: async (msg) => await publishLog(publishFn, runId, msg),
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
          messages: [{ role: "user", content: `${FRAGMENT_TITLE_PROMPT}\n\nPodsumowanie:\n${taskSummary}` }],
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
          messages: [{ role: "user", content: `Podsumowanie prac:\n${taskSummary}\n\nWygeneruj odpowiedź dla użytkownika.` }],
        });
      });
      await publishProgress(publishFn, runId, { kind: "task_update", taskId: "response", status: "done" });

      // 6) Sandbox URL
      const sandboxUrl = await step.run("sandbox-url", async () => {
        if (!sandbox) return "";
        // @ts-ignore
        return `https://${sandbox.getHost(3000)}`;
      });

      // 7) Save result to database
      await publishProgress(publishFn, runId, { kind: "task_update", taskId: "save-result", status: "running" });

      await step.run("save-to-db", async () => {
        // Create the assistant message with the fragment
        await prisma.message.create({
          data: {
            projectId,
            content: response,
            role: "ASSISTANT",
            type: "RESULT",
            fragment: {
              create: {
                title: fragmentTitle,
                sandboxUrl: sandboxUrl,
                files: {}, // Placeholder for now - could serialize files if needed
              }
            }
          }
        });
      });

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
    } catch (error: any) {
      console.error("!!! Workflow Crashed !!!", error);
      // @ts-ignore
      await publishLog(publishFn, runId, `[System] Krytyczny błąd: ${error.message}`);
      // @ts-ignore
      await publishProgress(publishFn, runId, { kind: "phase", label: "Błąd", status: "error", detail: error.message });

      // Save error to DB so polling picks it up
      await prisma.message.create({
        data: {
          projectId,
          content: `Wystąpił błąd krytyczny: ${error.message}`,
          role: "ASSISTANT",
          type: "RESULT",
        }
      });

      throw error;
    }
  }
);
