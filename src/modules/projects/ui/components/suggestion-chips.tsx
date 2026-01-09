"use client";

import { SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    onSelect: (value: string) => void;
    className?: string;
}

const SUGGESTIONS = [
    { label: "Make it mobile responsive", value: "Optimize the layout for mobile devices, ensuring all elements stack correctly and fonts are readable." },
    { label: "Add Dark Mode", value: "Implement a dark mode toggle using Tailwind's dark: modifier and next-themes." },
    { label: "Fix UI bugs", value: "Audit the UI for any visual inconsistencies, overflow issues, or alignment problems and fix them." },
    { label: "Add Login Page", value: "Create a modern, secure login page with email and password fields, validation, and a beautiful layout." },
    { label: "Refactor code", value: "Analyze the current file for code quality issues and refactor it to follow best practices and DRY principles." },
];

export const SuggestionChips = ({ onSelect, className }: Props) => {
    return (
        <div className={cn("flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mask-fade-right", className)}>
            <div className="flex items-center justify-center size-6 rounded-full bg-primary/10 shrink-0">
                <SparklesIcon className="size-3 text-primary" />
            </div>
            {SUGGESTIONS.map((suggestion) => (
                <button
                    key={suggestion.label}
                    onClick={() => onSelect(suggestion.value)}
                    className="flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                >
                    {suggestion.label}
                </button>
            ))}
        </div>
    );
};
