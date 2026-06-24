/**
 * Higgsfield AI – Video & Image Generation Client
 * Docs: https://higgsfield.ai (Studio plan required for API)
 * REST API, async generation with polling
 */

const API_URL = "https://api.higgsfield.ai";
const API_KEY = process.env.HIGGSFIELD_API_KEY!;

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type HFGenerationStatus = "pending" | "processing" | "completed" | "failed";

export type HFJob = {
  id: string;
  status: HFGenerationStatus;
  outputUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
};

// ─── Text-to-Video ────────────────────────────────────────────────────────────

export type TextToVideoParams = {
  prompt: string;
  duration?: number; // seconds, default 5
  aspectRatio?: "16:9" | "9:16" | "1:1";
  style?: string;
};

export async function generateVideoFromText(params: TextToVideoParams): Promise<HFJob> {
  const res = await fetch(`${API_URL}/v1/generate/text-to-video`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      prompt: params.prompt,
      duration: params.duration || 5,
      aspect_ratio: params.aspectRatio || "1:1",
      style: params.style,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Higgsfield text-to-video failed: ${res.status} – ${err}`);
  }

  return await res.json();
}

// ─── Image-to-Video ───────────────────────────────────────────────────────────

export type ImageToVideoParams = {
  imageUrl: string;
  prompt?: string;
  duration?: number;
};

export async function generateVideoFromImage(params: ImageToVideoParams): Promise<HFJob> {
  const res = await fetch(`${API_URL}/v1/generate/image-to-video`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      image_url: params.imageUrl,
      prompt: params.prompt || "Product showcase, smooth rotation, studio lighting",
      duration: params.duration || 5,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Higgsfield image-to-video failed: ${res.status} – ${err}`);
  }

  return await res.json();
}

// ─── Poll status ──────────────────────────────────────────────────────────────

export async function getJobStatus(jobId: string): Promise<HFJob> {
  const res = await fetch(`${API_URL}/v1/generate/${jobId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Higgsfield get status failed: ${res.status}`);
  }

  return await res.json();
}

// ─── Poll until done ──────────────────────────────────────────────────────────

export async function waitForJob(
  jobId: string,
  maxWaitMs = 300_000,
  pollIntervalMs = 5_000
): Promise<HFJob> {
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const job = await getJobStatus(jobId);

    if (job.status === "completed") return job;
    if (job.status === "failed") {
      throw new Error(`Higgsfield job ${jobId} failed`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Higgsfield job ${jobId} timed out after ${maxWaitMs}ms`);
}

// ─── Convenience: generate product video with retries ─────────────────────────

export async function generateProductVideo(
  productName: string,
  imageUrl?: string
): Promise<string | null> {
  try {
    let job: HFJob;

    if (imageUrl) {
      job = await generateVideoFromImage({
        imageUrl,
        prompt: `${productName} – elegant product showcase, smooth 360° rotation, premium studio background, cinematic lighting`,
      });
    } else {
      job = await generateVideoFromText({
        prompt: `Professional product advertisement for ${productName}. Clean white background, studio lighting, elegant presentation, 4K quality`,
        duration: 5,
        aspectRatio: "1:1",
      });
    }

    const done = await waitForJob(job.id);
    return done.outputUrl ?? null;
  } catch (err) {
    console.error("[Higgsfield] generateProductVideo error:", err);
    return null;
  }
}
