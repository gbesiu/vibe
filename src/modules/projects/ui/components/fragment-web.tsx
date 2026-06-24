import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { DownloadIcon, ExternalLinkIcon, Loader2Icon, PowerIcon, RefreshCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";

import { Hint } from "@/components/hint";
import { Fragment } from "@/lib/prisma-types";
import { Button } from "@/components/ui/button";

interface Props {
  data: Fragment;
};

export function FragmentWeb({ data }: Props) {
  const [copied, setCopied] = useState(false);
  const [fragmentKey, setFragmentKey] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const trpc = useTRPC();
  const recreateSandbox = useMutation(
    trpc.messages.recreateSandbox.mutationOptions({
      onSuccess: () => toast.success("Restarting sandbox — the preview will refresh shortly"),
      onError: () => toast.error("Failed to restart sandbox"),
    }),
  );

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(data.sandboxUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    if (!data.files) {
      toast.error("No files to download");
      return;
    }

    setIsDownloading(true);
    try {
      const files = JSON.parse(data.files as string) as Record<string, string>;
      const entries = Object.entries(files);

      if (entries.length === 1) {
        // Single file — download directly
        const [filename, content] = entries[0];
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Multiple files — combine into one downloadable HTML page
        const combined = entries.map(([path, content]) =>
          `<!-- ===== ${path} ===== -->\n${content}`
        ).join("\n\n");
        const blob = new Blob([combined], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "project-code.html";
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success("Code downloaded!");
    } catch {
      toast.error("Failed to download code");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <Hint text="Refresh" side="bottom" align="start">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>
        <Hint text="Restart sandbox (rebuild an expired preview)" side="bottom" align="start">
          <Button
            size="sm"
            variant="outline"
            onClick={() => recreateSandbox.mutate({ fragmentId: data.id })}
            disabled={recreateSandbox.isPending || !data.files}
          >
            {recreateSandbox.isPending ? <Loader2Icon className="animate-spin" /> : <PowerIcon />}
          </Button>
        </Hint>
        <Hint text="Click to copy" side="bottom">
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleCopy}
            disabled={!data.sandboxUrl || copied}
            className="flex-1 justify-start text-start font-normal"
          >
            <span className="truncate">
              {data.sandboxUrl}
            </span>
          </Button>
        </Hint>
        <Hint text="Download code as ZIP" side="bottom" align="start">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadZip}
            disabled={!data.files || isDownloading}
          >
            {isDownloading ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
          </Button>
        </Hint>
        <Hint text="Open in a new tab" side="bottom" align="start">
          <Button
            size="sm"
            disabled={!data.sandboxUrl}
            variant="outline"
            onClick={() => {
              if (!data.sandboxUrl) return;
              window.open(data.sandboxUrl, "_blank");
            }}
          >
            <ExternalLinkIcon />
          </Button>
        </Hint>
      </div>
      <iframe
        key={fragmentKey}
        className="h-full w-full"
        sandbox="allow-forms allow-scripts allow-same-origin"
        loading="lazy"
        src={data.sandboxUrl}
      />
    </div>
  )
};