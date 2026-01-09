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

  // Polling for run status (FALLBACK)
  const { data: runStatus } = useQuery({
    queryKey: ["runStatus", runId],
    queryFn: async () => {
      const res = await fetch(`/api/trpc/messages.getRunStatus?input=${encodeURIComponent(JSON.stringify({ json: { runId } }))}`);
      if (!res.ok) throw new Error("Failed to fetch status");
      const body = await res.json();
      return body?.result?.data?.json ?? body?.result?.data;
    },
    enabled: !!runId && !isConnected, // Only poll if WebSocket is not connected
    refetchInterval: 5000,
    retry: 2,
  });

  // Native WebSocket for Live Updates
  useEffect(() => {
    if (!token?.wsUrl || !runId) return;

    console.log("[Realtime] Connecting to:", token.wsUrl);

    let ws: WebSocket | null = null;
    let reconnectTimeout: any;

    const connect = () => {
      ws = new WebSocket(token.wsUrl);

      ws.onopen = () => {
        console.log("[Realtime] ✅ Connected to Inngest WebSocket!");
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        console.log("[Realtime] 📩 Raw message received:", event.data);
        try {
          const payload = JSON.parse(event.data);
          console.log("[Realtime] Message:", payload);

          // Handle Inngest Realtime Protocol
          // The data is usually in payload.data or payload.event
          const data = payload.data || payload;
          const topic = payload.topic;

          if (topic === "progress") {
            const p = data as any;
            if (p.kind === "init") setTasks(p.tasks);
            if (p.kind === "task_update") {
              setTasks(prev => prev.map(t => t.id === p.taskId ? { ...t, status: p.status, detail: p.detail } : t));
            }
          } else if (topic === "log") {
            setLogs(prev => [...prev.slice(-100), data.line]);
          } else if (topic === "preview") {
            console.log("[Realtime] Preview update triggered!");
            onPreviewChange?.();
          } else if (topic === "result") {
            console.log("[Realtime] Result received:", data);
            onPreviewChange?.();
          }
        } catch (err) {
          console.error("[Realtime] Parse error:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("[Realtime] WebSocket error:", err);
      };

      ws.onclose = () => {
        console.log("[Realtime] Disconnected.");
        setIsConnected(false);
        // Attempt reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (ws) {
        ws.onclose = null; // Prevent reconnect on intentional close
        ws.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [token, runId, onPreviewChange]);

  // Update UI based on run status (When polling as fallback)
  useEffect(() => {
    if (!runStatus || isConnected) return;

    console.log("[Polling] Syncing status:", JSON.stringify(runStatus, null, 2));

    // If we have any status, we should at least show the initial tasks
    if (tasks.length === 0) {
      setTasks([
        { id: "1", label: "Wysłano zapytanie", status: "done" },
        { id: "2", label: "Analiza Agenta Vibe", status: "running", detail: "inicjalizacja..." },
        { id: "3", label: "Generowanie kodu", status: "queued" },
      ]);
    }

    if (runStatus.role === "assistant" && !runStatus.hasFragment) {
      setTasks([
        { id: "1", label: "Wysłano zapytanie", status: "done" },
        { id: "2", label: "Analiza Agenta Vibe", status: "done" },
        { id: "3", label: "Tworzenie plików", status: "running", detail: "zapisywanie..." },
      ]);
    } else if (runStatus.role === "assistant" && runStatus.hasFragment) {
      setTasks([
        { id: "1", label: "Wysłano zapytanie", status: "done" },
        { id: "2", label: "Analiza Agenta Vibe", status: "done" },
        { id: "3", label: "Generowanie kodu", status: "done" },
      ]);
      onPreviewChange?.();
    } else if (runStatus.status === "error") {
      setError("Wystąpił błąd podczas przetwarzania");
      setIsConnected(false);
    }
  }, [runStatus, isConnected, onPreviewChange, tasks.length]);

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
