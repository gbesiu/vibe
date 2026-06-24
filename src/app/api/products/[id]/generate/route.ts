import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import OpenAI from "openai";
import { generateProductVideo } from "@/lib/higgsfield";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim());

  if (!userId || (!adminIds.includes(userId) && adminIds[0] !== "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const results: { description?: string; imageUrl?: string; videoUrl?: string } = {};

  try {
    // ── 1. Generate AI description ─────────────────────────────────────────
    const descPrompt = `Napisz profesjonalny, przekonujący opis produktu po polsku dla: "${product.name}".
${product.description ? `Oryginalne informacje: ${product.description}` : ""}
Opis powinien być:
- 2-3 zdania, max 200 słów
- Skupiony na korzyściach dla klienta
- Używać pozytywnego, energetycznego języka
- Zawierać słowa kluczowe SEO naturalnie
Odpowiedz TYLKO opisem, bez nagłówków ani formatowania.`;

    const descResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: descPrompt }],
      max_tokens: 300,
    });

    results.description = descResponse.choices[0]?.message?.content?.trim() ?? undefined;

    // ── 2. Generate AI product image (DALL-E 3) ────────────────────────────
    const imagePrompt = `Professional product photography of "${product.name}". 
Clean white background, studio lighting, high-end commercial photography style, 
photorealistic, 8K quality, centered composition, no text or watermarks.`;

    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024",
      quality: "hd",
      style: "natural",
    });

    results.imageUrl = imageResponse.data[0]?.url ?? undefined;

    // ── 3. Generate Higgsfield product video ──────────────────────────────
    if (process.env.HIGGSFIELD_API_KEY) {
      const videoUrl = await generateProductVideo(
        product.name,
        results.imageUrl || product.mainImage || product.images[0]
      );
      results.videoUrl = videoUrl ?? undefined;
    }

    // ── 4. Save to DB ──────────────────────────────────────────────────────
    await prisma.product.update({
      where: { id },
      data: {
        aiDescription: results.description ?? undefined,
        aiImageUrl: results.imageUrl ?? undefined,
        aiVideoUrl: results.videoUrl ?? undefined,
        aiGeneratedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, productId: id, ...results });
  } catch (err) {
    console.error("[generate-content] error:", err);
    return NextResponse.json({ error: String(err), partial: results }, { status: 500 });
  }
}
