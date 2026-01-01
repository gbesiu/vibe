import { useEffect, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { Fragment } from "@/generated/prisma";

import { MessageCard } from "./message-card";
import { MessageForm } from "./message-form";
import { MessageLoading } from "./message-loading";

interface Props {
  projectId: string;
  activeFragment: Fragment | null;
  setActiveFragment: (fragment: Fragment | null) => void;
};

import confetti from "canvas-confetti";

// ... existing imports

export const MessagesContainer = ({
  projectId,
  activeFragment,
  setActiveFragment
}: Props) => {
  // ... existing hooks

  const lastMessage = messages[messages.length - 1];
  const isLastMessageUser = lastMessage?.role === "USER";
  const prevMessageCount = useRef(messages.length);

  useEffect(() => {
    // If we have a new message and it's from the assistant (meaning job done)
    if (messages.length > prevMessageCount.current && lastMessage?.role === "ASSISTANT") {
      // 1. Confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      // 2. Sound (Success Chime)
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.volume = 0.5;
      audio.play().catch(e => console.log("Audio play failed (user interaction required)", e));
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, lastMessage?.role]);

  // ... rest of render

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="pt-2 pr-1">
          {messages.map((message) => (
            <MessageCard
              key={message.id}
              content={message.content}
              role={message.role}
              fragment={message.fragment}
              createdAt={message.createdAt}
              isActiveFragment={activeFragment?.id === message.fragment?.id}
              onFragmentClick={() => setActiveFragment(message.fragment)}
              type={message.type}
            />
          ))}
          {isLastMessageUser && <MessageLoading />}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="relative p-3 pt-1">
        <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-b from-transparent to-background pointer-events-none" />
        <MessageForm projectId={projectId} />
      </div>
    </div>
  );
};
