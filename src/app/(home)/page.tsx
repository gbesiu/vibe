import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { ProjectForm } from "@/modules/home/ui/components/project-form";
import { ProjectsList } from "@/modules/home/ui/components/projects-list";

const Page = () => {
  return (
    <div className="flex flex-col max-w-5xl mx-auto w-full">
      <section className="space-y-6 py-[16vh] 2xl:py-48">
        <div className="flex flex-col items-center">
          <Image
            src="/logo.svg"
            alt="Przekod"
            width={50}
            height={50}
            className="hidden md:block"
          />
          <Badge variant="outline" className="mt-4 animate-fade-in bg-green-500/10 text-green-700 border-green-200">
            ✨ Nowość: Udostępnianie & Edycja Kodu
          </Badge>
        </div>
        <h1 className="text-2xl md:text-5xl font-bold text-center">
          Buduj coś z Przekodem
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground text-center">
          Twórz aplikacje i strony internetowe rozmawiając z AI
        </p>
        <div className="max-w-3xl mx-auto w-full">
          <ProjectForm />
        </div>
      </section>
      <ProjectsList />
    </div>
  );
};

export default Page;
