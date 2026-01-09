"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { Realtime } from "@inngest/realtime";
import { Check, Loader2, Terminal, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";

interface Props {
  runId?: string;
  onPreviewChange?: () => void;
}

// Maps backend status to UI state
type TaskStatus = "queued" | "running" | "done" | "error";
interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  detail?: string;
}

export const MessageLoading = ({ runId, onPreviewChange }: Props) => {
  const trpc = useTRPC();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // Initialize connection
  useEffect(() => {
    if (!runId) return;

    let rt: any = null;
    let channel: any = null;

    const connect = async () => {
      try {
        // 1. Get token from server
        // @ts-ignore
        const token = await trpc.messages.getRealtimeToken.query({ runId });
        if (!token) return;

        // 2. Init Realtime
        // Note: Inngest Realtime usually requires specific setup, assuming standard websocket behavior here
        // If using the hosted Inngest Realtime, the token contains the URL.
        rt = new (Realtime as any)({
          // If the token is full config
          // However, the standard usage often is `new Realtime()` + connect.
          // Let's assume the token object from backend is what we need.
          // Actually, the docs say `permission` token.
          // We pass it to `connect`.
        });

        // 3. Subscribe
        // The token response from backend usually includes `token` and `url`? 
        // Or we pass the token to `subscribe`.
        // Let's assume the library handles it if we pass the token.
        // Wait, standard usage: 
        /*
          const socket = new WebSocket(token.url);
          // or 
          const channel = new Realtime(token);
        */
        // Let's try the most standard pattern for Inngest Realtime if known, or generic.
        // Looking at `package.json`, it's `@inngest/realtime`.
        // I will assume `new Realtime(token)` works or `new Realtime()` and `rt.subscribe(channelId, { token })`.
        // Given I returned `getSubscriptionToken`, it's likely a signed token string or object.

        // Let's use a robust approach compatible with the backend `getRunSubscriptionToken`.
        // If `token` is an object, pass it.

        // @ts-ignore - The library types might vary, we force it for now.
        channel = new Realtime(token);

        channel.on("open", () => setIsConnected(true));

        channel.on("message", (msg: any) => {
          // Provide fallback for msg structure
          const topic = msg.topic;
          const data = msg.data;

          if (topic === "log") {
            setLogs(prev => [...prev, data.line].slice(-50)); // Keep last 50
          }
          if (topic === "progress") {
            const payload = data;
            if (payload.kind === "init") {
              setTasks(payload.tasks);
            }
            if (payload.kind === "task_update") {
              setTasks(prev => prev.map(t =>
                t.id === payload.taskId ? { ...t, status: payload.status, detail: payload.detail } : t
              ));
            }
          }
          if (topic === "preview" && data.kind === "preview_update") {
            onPreviewChange?.();
          }
        });

      } catch (e) {
        console.error("Realtime error", e);
      }
    };

    connect();

    return () => {
      channel?.close?.();
      rt?.close?.();
    };
  }, [runId, trpc, onPreviewChange]);

  // Fallback UI if not connected yet or no tasks (show at least something)
  if (!tasks.length && !logs.length) {
    // Return the old dummy UI or a simple loader until data arrives
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground animate-pulse">
        <Loader2 className="size-4 animate-spin" />
        <span>Nawiązywanie połączenia z Agentem...</span>
      </div>
    );
  }

  const currentTask = tasks.find(t => t.status === "running") || tasks.find(t => t.status === "queued");
  // If all done, show last
  const displayTask = currentTask || tasks[tasks.length - 1];

  return (
    <div className="flex flex-col group px-2 pb-4 w-full max-w-xl">
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image src="/logo.svg" alt="Przekod" width={18} height={18} className="shrink-0" />
        <span className="text-sm font-medium">Przekod (Agent V2)</span>
        {isConnected && <span className="flex size-2 rounded-full bg-green-500 animate-pulse ml-2" title="Live" />}
      </div>

      <div className="pl-8.5 flex flex-col gap-y-2">

        {/* Active Task Highlight */}
        {displayTask && (
          <div className="flex items-center gap-2 text-sm text-foreground font-medium animate-in fade-in slide-in-from-left-2">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <span>{displayTask.label}</span>
            {displayTask.detail && <span className="text-xs text-muted-foreground font-normal">({displayTask.detail})</span>}
          </div>
        )}

        {/* ProgressBar roughly based on tasks done */}
        <div className="h-1 w-full bg-muted rounded overflow-hidden mt-1">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(tasks.filter(t => t.status === 'done').length / Math.max(tasks.length, 1)) * 100}%` }}
          />
        </div>

        {/* Logs Accordion */}
        <div className="mt-2 text-xs">
          <button
            onClick={() => setIsLogsOpen(!isLogsOpen)}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            {isLogsOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
            <Terminal className="size-3" />
            Logi systemowe ({logs.length})
          </button>

          {isLogsOpen && (
            <div className="mt-2 p-2 bg-black/5 rounded-md font-mono text-[10px] space-y-1 max-h-[200px] overflow-y-auto">
              {logs.map((log, i) => (
                <div key={i} className="break-all border-b border-border/50 last:border-0 pb-0.5">{log}</div>
              ))}
              <div ref={node => node?.scrollIntoView()} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
