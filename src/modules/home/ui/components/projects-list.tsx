"use client";

import { useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { ProjectCard } from "./project-card";

export const ProjectsList = () => {
  const trpc = useTRPC();
  const { user } = useUser();
  const { data: projects } = useQuery(trpc.projects.getMany.queryOptions());

  if (!user) return null;

  return (
    <div className="w-full flex flex-col gap-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">
          Twoje Przekody
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects?.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center p-12 border border-dashed rounded-xl bg-muted/20">
            <p className="text-muted-foreground">
              Nie masz jeszcze żadnych projektów.
            </p>
          </div>
        )}

        {projects?.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
          />
        ))}
      </div>
    </div>
  );
};
