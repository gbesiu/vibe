"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [error, setError] = useState<string | null>(null);

  // @ts-ignore
  const { data: token, error: tokenError } = useQuery({
    queryKey: ["getRealtimeToken", runId],
    queryFn: async () => {
      // Fallback to raw fetch to bypass TRPC Proxy issues "is not a function"
      const input = encodeURIComponent(JSON.stringify({ json: { runId } }));
      const res = await fetch(`/api/trpc/messages.getRealtimeTokenV2?input=${input}`);
      if (!res.ok) throw new Error("Failed to fetch token via HTTP");
      const body = await res.json();
      // Handle SuperJSON response structure (result.data.json) or standard (result.data)
      return body?.result?.data?.json ?? body?.result?.data;
    },
    enabled: !!runId,
    retry: 2
  });

  // Connection Effect
  useEffect(() => {
    if (!token) return;

    let ws: WebSocket | null = null;

    const connect = async () => {
      try {
        setError(null);
        console.log("[Realtime] Token received:", token);
        console.log("[Realtime] Token keys:", Object.keys(token || {}));
        console.log("[Realtime] Token structure:", JSON.stringify(token, null, 2));

        // Extract WebSocket URL from token
        // Token structure from Inngest usually contains: { url, token, ... }
        const wsUrl = (token as any)?.url || (token as any)?.wsUrl;
        const authToken = (token as any)?.token || token;

        if (!wsUrl) {
          throw new Error("Token nie zawiera URL do WebSocket. Struktura tokenu: " + JSON.stringify(Object.keys(token || {})));
        }

        console.log("[Realtime] Connecting to WebSocket:", wsUrl);

        // Create native WebSocket connection
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[Realtime] WebSocket connected!");
          setIsConnected(true);

          // Subscribe to channel with topics
          const subscribeMessage = {
            type: "subscribe",
            channel: `run:${runId}`,
            topics: ["progress", "log", "preview"],
            token: authToken
          };

          console.log("[Realtime] Sending subscribe:", subscribeMessage);
          ws?.send(JSON.stringify(subscribeMessage));
        };

        ws.onmessage = (event) => {
          try {
            console.log("[Realtime] Message received:", event.data);
            const message = JSON.parse(event.data);

            // Handle different message types
            if (message.type === "event" || message.topic) {
              const topic = message.topic;
              const data = message.data || message.payload;

              console.log("[Realtime] Event:", { topic, data });

              if (topic === "log") {
                setLogs(prev => [...prev, data.line].slice(-50));
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
            }
          } catch (e) {
            console.error("[Realtime] Failed to parse message:", e, event.data);
          }
        };

        ws.onerror = (error) => {
          console.error("[Realtime] WebSocket error:", error);
          setError(`Błąd WebSocket: ${error.type}`);
          setIsConnected(false);
        };

        ws.onclose = (event) => {
          console.log("[Realtime] WebSocket closed:", event.code, event.reason);
          setIsConnected(false);
        };

      } catch (e: any) {
        console.error("Realtime setup error - FULL:", e);
        console.error("Error details:", {
          name: e?.name,
          message: e?.message,
          stack: e?.stack
        });

        const errorMsg = e?.message || e?.toString?.() || "Unknown error";
        setError(`Błąd inicjalizacji: ${errorMsg}`);
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (ws) {
        console.log("[Realtime] Closing WebSocket");
        ws.close();
        ws = null;
      }
    };
  }, [token, runId, onPreviewChange]);

  // Handle Token Error
  useEffect(() => {
    if (tokenError) {
      setError(`Błąd pobierania tokenu: ${tokenError.message}`);
    }
  }, [tokenError]);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-red-500 bg-red-50 dark:bg-red-900/10 rounded-md">
        <span className="font-bold">!</span>
        <span>{error} (Sprawdź konsolę)</span>
      </div>
    );
  }

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
