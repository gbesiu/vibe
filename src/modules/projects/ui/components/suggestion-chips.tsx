"use client";

import { SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    onSelect: (value: string) => void;
    className?: string;
}

const ALL_SUGGESTIONS = [
    { label: "Dostosuj do mobile (RWD)", value: "Spraw, aby aplikacja wyglądała świetnie na telefonach. Popraw stackowanie elementów i wielkość czcionek." },
    { label: "Dodaj Tryb Ciemny 🌙", value: "Zaimplementuj przełącznik trybu ciemnego używając Tailwind i next-themes." },
    { label: "Napraw błędy wizualne", value: "Przeanalizuj UI pod kątem błędów, nierównych odstępów i popraw je." },
    { label: "Stwórz stronę logowania", value: "Zbuduj nowoczesny formularz logowania z walidacją i ładnym designem." },
    { label: "Dodaj Dashboard", value: "Stwórz panel klienta ze statystykami i wykresem." },
    { label: "Zmień kolorystykę", value: "Zaproponuj nową, nowoczesną paletę kolorów dla tej aplikacji." },
    { label: "Dodaj animacje", value: "Ożyw interfejs dodając subtelne animacje wejścia i hover effects." },
    { label: "Zoptymalizuj kod", value: "Przejrzyj kod i zastosuj najlepsze praktyki (DRY, clean code)." },
    { label: "Dodaj Stopkę", value: "Zbuduj profesjonalną stopkę z linkami i newsletterem." },
    { label: "Sekcja Hero", value: "Stwórz imponującą sekcję Hero z dużym nagłówkiem i Call to Action." },
];

function shuffleArray(array: any[]) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

export const SuggestionChips = ({ onSelect, className }: Props) => {
    const [suggestions, setSuggestions] = useState<typeof ALL_SUGGESTIONS>([]);

    useEffect(() => {
        setSuggestions(shuffleArray(ALL_SUGGESTIONS).slice(0, 5));
    }, []);

    return (
        <div className={cn("flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none mask-fade-right", className)}>
            <div className="flex items-center justify-center size-6 rounded-full bg-primary/10 shrink-0">
                <SparklesIcon className="size-3 text-primary" />
            </div>
            {suggestions.map((suggestion) => (
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
