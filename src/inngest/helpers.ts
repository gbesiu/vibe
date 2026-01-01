
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
    const subscriptionToken = await getSubscriptionToken(inngest, {
        channel: runChannel(opts.runId),
        topics: [...RUN_TOPICS],
    });

    // Fetch WebSocket URL from Inngest API (server-side to avoid CORS)
    try {
        const response = await fetch('https://api.inngest.com/v1/realtime/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscriptionToken),
        });

        if (!response.ok) {
            console.error('[Inngest] Failed to get WebSocket URL:', response.statusText);
            // Return original token as fallback
            return subscriptionToken as RunRealtimeToken;
        }

        const wsData = await response.json();
        console.log('[Inngest] WebSocket URL obtained:', wsData);

        // Return WebSocket URL along with original token data
        return {
            ...subscriptionToken,
            wsUrl: wsData.url || wsData.wsUrl,
            ...wsData
        } as RunRealtimeToken;
    } catch (error) {
        console.error('[Inngest] Error fetching WebSocket URL:', error);
        // Return original token as fallback
        return subscriptionToken as RunRealtimeToken;
    }
};
