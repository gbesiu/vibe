import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { codeAgentFunction, recreateSandboxFunction } from "@/inngest/functions";
import {
  syncBaselinkterFunction,
  generateProductContentFunction,
  generateSingleProductFunction,
} from "@/inngest/shop-functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    codeAgentFunction,
    recreateSandboxFunction,
    syncBaselinkterFunction,
    generateProductContentFunction,
    generateSingleProductFunction,
  ],
});
