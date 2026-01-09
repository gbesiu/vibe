import Image from "next/image";
import { useState, useEffect } from "react";

import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LOADING_STEPS = [
  "Analizuję Twoją prośbę...",
  "Planowanie struktury strony...",
  "Generowanie komponentów...",
  "Tworzenie layoutu...",
  "Dodawanie stylów...",
  "Optymalizacja kodu...",
  "Ostatnie poprawki...",
  "Prawie gotowe...",
];

export const MessageLoading = () => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev: number) => {
        if (prev >= LOADING_STEPS.length - 1) return prev;
        return prev + 1;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col group px-2 pb-4">
      <div className="flex items-center gap-2 pl-2 mb-2">
        <Image
          src="/logo.svg"
          alt="Przekod"
          width={18}
          height={18}
          className="shrink-0"
        />
        <span className="text-sm font-medium">Przekod</span>
      </div>
      <div className="pl-8.5 flex flex-col gap-y-2">
        {LOADING_STEPS.map((step, index) => {
          if (index > currentStep) return null;

          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div
              key={step}
              className={cn(
                "flex items-center gap-2 text-sm transition-all duration-300 animate-in fade-in slide-in-from-left-2",
                isCompleted ? "text-muted-foreground" : "text-foreground font-medium"
              )}
            >
              <div className="flex items-center justify-center size-4 shrink-0">
                {isCompleted ? (
                  <Check className="size-3.5" />
                ) : (
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                )}
              </div>
              <span>{step}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
