
import { getSubscriptionToken } from "@inngest/realtime";
import { inngest } from "./client";

/* =========================
   Realtime Constants & Types
   ========================= */

export const runChannel = (runId: string) => `run:${runId}` as const;

export const RUN_TOPICS = ["progress", "log", "result", "preview"] as const;
export type RunTopic = (typeof RUN_TOPICS)[number];

export type RunRealtimeToken = any;

/* =========================
   Payload Shapes
   ========================= */

export type PreviewPayload = { kind: "preview_update" };

export type TaskStatus = "queued" | "running" | "done" | "error";

export type ProgressTask = {
    id: string;
    label: string;
    status: TaskStatus;
    detail?: string;
};

export type ProgressPayload =
    | { kind: "init"; tasks: ProgressTask[] }
    | { kind: "task_update"; taskId: string; status: TaskStatus; detail?: string }
    | { kind: "phase"; label: string; status: TaskStatus; detail?: string };

export type LogPayload = { kind: "log"; line: string };

export type ResultPayload = {
    kind: "result";
    fragmentTitle: string;
    response: string;
    sandboxUrl: string;
    taskSummary: string;
};

/* =========================
   Helpers: Publishing
   ========================= */

export async function publishPreview(publish: (msg: any) => Promise<any>, runId: string) {
    await publish({
        channel: runChannel(runId),
        topic: "preview",
        data: { kind: "preview_update" } satisfies PreviewPayload,
    });
}

export async function publishProgress(publish: (msg: any) => Promise<any>, runId: string, payload: ProgressPayload) {
    await publish({
        channel: runChannel(runId),
        topic: "progress",
        data: payload,
    });
}

export async function publishLog(publish: (msg: any) => Promise<any>, runId: string, line: string) {
    await publish({
        channel: runChannel(runId),
        topic: "log",
        data: { kind: "log", line } satisfies LogPayload,
    });
}

export async function publishResult(publish: (msg: any) => Promise<any>, runId: string, payload: ResultPayload) {
    await publish({
        channel: runChannel(runId),
        topic: "result",
        data: payload,
    });
}

/* =========================
   Token Generation
   ========================= */

export async function getRunSubscriptionToken(opts: {
    runId: string;
}): Promise<RunRealtimeToken> {
    const token = await getSubscriptionToken(inngest, {
        channel: runChannel(opts.runId),
        topics: [...RUN_TOPICS],
    });
    return token as RunRealtimeToken;
};
