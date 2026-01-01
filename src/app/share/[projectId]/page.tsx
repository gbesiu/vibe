import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";

import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { FragmentWeb } from "@/modules/projects/ui/components/fragment-web";

interface PageProps {
    params: Promise<{
        projectId: string;
    }>;
};

export default async function SharePage({ params }: PageProps) {
    const { projectId } = await params;

    const project = await prisma.project.findUnique({
        where: {
            id: projectId,
        },
        include: {
            messages: {
                take: 1,
                orderBy: {
                    createdAt: "desc",
                },
                include: {
                    fragment: true,
                }
            }
        }
    });

    if (!project) {
        notFound();
    }

    const latestMessage = project.messages[0];
    const activeFragment = latestMessage?.fragment;

    return (
        <div className="flex flex-col h-screen bg-background">
            <div className="h-14 border-b flex items-center px-4 justify-between bg-auth-sidebar/50 backdrop-blur-sm fixed top-0 w-full z-50">
                <div className="flex items-center gap-x-2">
                    <span className="font-semibold text-sm">
                        {project.name}
                    </span>
                    <span className="text-muted-foreground text-sm">
                        • Built with Vibe
                    </span>
                </div>
                <div className="flex items-center gap-x-2">
                    <Button asChild size="sm" variant="default">
                        <Link href="/">
                            From Idea to App in Seconds
                        </Link>
                    </Button>
                </div>
            </div>
            <div className="flex-1 pt-14">
                {activeFragment ? (
                    <FragmentWeb data={activeFragment} />
                ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                        No preview available
                    </div>
                )}
            </div>
        </div>
    );
};
