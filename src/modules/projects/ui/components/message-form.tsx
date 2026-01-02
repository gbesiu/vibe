import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import TextareaAutosize from "react-textarea-autosize";
import { ArrowUpIcon, Loader2Icon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Form, FormField } from "@/components/ui/form";

import { Usage } from "./usage";
import { SuggestionChips } from "./suggestion-chips";

interface Props {
  projectId: string;
};

const formSchema = z.object({
  value: z.string()
    .min(1, { message: "Value is required" })
    .max(10000, { message: "Value is too long" }),
})

export const MessageForm = ({ projectId }: Props) => {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: usage } = useQuery(trpc.usage.status.queryOptions());

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: "",
    },
  });

  const [isFocused, setIsFocused] = useState(false);
  const [mode, setMode] = useState<"builder" | "chat">("builder");

  const createMessage = useMutation(trpc.messages.create.mutationOptions({
    onSuccess: () => {
      form.reset();
      queryClient.invalidateQueries(
        trpc.messages.getMany.queryOptions({ projectId }),
      );
      queryClient.invalidateQueries(
        trpc.usage.status.queryOptions()
      );
    },
    onError: (error) => {
      console.error("[CreateMessage] Error:", error);
      const msg = error.message || "Wystąpił nieznany błąd";
      toast.error(msg);

      if (error.data?.code === "TOO_MANY_REQUESTS") {
        router.push("/pricing");
      }
    },
  }));

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    let finalValue = values.value;
    if (mode === "chat") {
      finalValue = `[CHAT_MODE] ${finalValue}`;
    }

    await createMessage.mutateAsync({
      value: finalValue,
      projectId,
    });
  };

  const isPending = createMessage.isPending;
  const isButtonDisabled = isPending || !form.formState.isValid;
  const showUsage = !!usage;

  return (
    <Form {...form}>
      {showUsage && (
        <Usage
          points={usage.remainingPoints}
          msBeforeNext={usage.msBeforeNext}
        />
      )}
      <div className="space-y-2">
        <div className="flex items-center gap-4 px-1 pb-1">
          <button
            type="button"
            onClick={() => setMode("builder")}
            className={cn("text-xs font-medium transition-colors flex items-center gap-1.5", mode === "builder" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <span className={cn("size-2 rounded-full", mode === "builder" ? "bg-primary" : "bg-muted-foreground/30")} />
            Buduj (Builder)
          </button>
          <button
            type="button"
            onClick={() => setMode("chat")}
            className={cn("text-xs font-medium transition-colors flex items-center gap-1.5", mode === "chat" ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <span className={cn("size-2 rounded-full", mode === "chat" ? "bg-primary" : "bg-muted-foreground/30")} />
            Czat (Konsultant)
          </button>
        </div>

        {mode === "builder" && (
          <SuggestionChips
            onSelect={(value) => form.setValue("value", value, { shouldValidate: true })}
            className={cn(showUsage ? "pt-2" : "pt-0")}
          />
        )}

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={cn(
            "relative border p-4 pt-1 rounded-xl bg-sidebar dark:bg-sidebar transition-all",
            isFocused && "shadow-xs",
            showUsage && "rounded-t-none",
            mode === "chat" && "border-primary/20 bg-primary/5"
          )}
        >
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <TextareaAutosize
                {...field}
                disabled={isPending}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                minRows={2}
                maxRows={8}
                className="pt-4 resize-none border-none w-full outline-none bg-transparent"
                placeholder={mode === "builder" ? "Co chciałbyś zbudować?" : "O co chcesz zapytać eksperta?"}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    form.handleSubmit(onSubmit)(e);
                  }
                }}
              />
            )}
          />
          <div className="flex gap-x-2 items-end justify-between pt-2">
            <div className="text-[10px] text-muted-foreground font-mono">
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span>&#8984;</span>Enter
              </kbd>
              &nbsp;to submit
            </div>
            <Button
              disabled={isButtonDisabled}
              className={cn(
                "size-8 rounded-full",
                isButtonDisabled && "bg-muted-foreground border"
              )}
            >
              {isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <ArrowUpIcon />
              )}
            </Button>
          </div>
        </form>
      </div>
    </Form>
  );
};
