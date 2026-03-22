"use client";

import { Component, type ReactNode } from "react";
import Image from "next/image";
import { dark } from "@clerk/themes";
import { PricingTable } from "@clerk/nextjs";

import { useCurrentTheme } from "@/hooks/use-current-theme";

class PricingErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <p>Pricing information is currently unavailable.</p>
          <p className="text-sm mt-2">Please check back later or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const Page = () => {
  const currentTheme = useCurrentTheme();

  return ( 
    <div className="flex flex-col max-w-3xl mx-auto w-full">
      <section className="space-y-6 pt-[16vh] 2xl:pt-48">
        <div className="flex flex-col items-center">
          <Image 
            src="/logo.svg"
            alt="Vibe"
            width={50}
            height={50}
            className="hidden md:block"
          />
        </div>
        <h1 className="text-xl md:text-3xl font-bold text-center">Pricing</h1>
        <p className="text-muted-foreground text-center text-sm md:text-base">
          Choose the plan that fits your needs
        </p>
        <PricingErrorBoundary>
          <PricingTable
            appearance={{
              baseTheme: currentTheme === "dark" ? dark : undefined,
              elements: {
                pricingTableCard: "border! shadow-none! rounded-lg!"
              }
            }}
          />
        </PricingErrorBoundary>
      </section>
    </div>
   );
}
 
export default Page;