"use client";

import Link from "next/link";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Project, Message, Fragment } from "@prisma/client";

interface ProjectWithDetails extends Project {
    messages: (Message & {
        fragment: Fragment | null;
    })[];
}

interface ProjectCardProps {
    project: ProjectWithDetails;
}

export const ProjectCard = ({ project }: ProjectCardProps) => {
    const latestMessage = project.messages[0];
    const sandboxUrl = latestMessage?.fragment?.sandboxUrl;

    return (
        <Link
            href={`/projects/${project.id}`}
            className="group flex flex-col gap-y-4 w-full h-full"
        >
            <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted/50 shadow-sm transition-all group-hover:shadow-md group-hover:border-primary/20">
                {sandboxUrl ? (
                    <iframe
                        src={sandboxUrl}
                        className="h-full w-full object-cover pointer-events-none select-none origin-top scale-[0.25] h-[400%] w-[400%]"
                        tabIndex={-1}
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full items-center justify-center bg-muted/20">
                        <Image
                            src="/logo.svg"
                            alt="Przekod"
                            width={40}
                            height={40}
                            className="opacity-50 grayscale transition-all group-hover:grayscale-0 group-hover:opacity-100"
                        />
                    </div>
                )}

                {/* Overlay to prevent interaction with iframe and handle click */}
                <div className="absolute inset-0 bg-transparent group-hover:bg-black/5 transition-colors" />
            </div>

            <div className="space-y-1 px-1">
                <h3 className="font-semibold leading-none tracking-tight truncate group-hover:text-primary transition-colors">
                    {project.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(project.updatedAt, { addSuffix: true })}
                </p>
            </div>
        </Link>
    );
};
