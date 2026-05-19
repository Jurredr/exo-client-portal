import { createClient } from "@/lib/supabase/server";
import { isUserInEXOCompany, getProjectById } from "@/lib/db/queries";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { downloadOfferFile } from "@/lib/utils/file-storage";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const PROJECT_DESCRIPTION_PROMPT = `You are a professional at EXO, a creative agency. Generate a short, client-facing project description in plain text (no markdown headings or bullets).

The description should:
- Be based specifically on the "Projectoverzicht" section in the source (if present); otherwise summarize the overall scope and deliverables
- Be 1-2 short sentences (max ~40 words total), high-level and client-facing
- Skip implementation details, internal scope notes, parallel projects, or team/process info
- Use the language specified (NL or EN)
- Be suitable for displaying on a project overview page

Return ONLY the description text, no extra commentary.`;

interface OfferRow {
  content: string | null;
  note: string | null;
  fileName: string | null;
  fileStoragePath: string | null;
}

async function generateFromPdf(
  client: OpenAI,
  pdfBuffer: Buffer,
  fileName: string,
  prompt: string
): Promise<string | null> {
  const uploaded = await client.files.create({
    file: new File([new Uint8Array(pdfBuffer)], fileName, {
      type: "application/pdf",
    }),
    purpose: "user_data",
  });
  try {
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_file", file_id: uploaded.id },
            { type: "input_text", text: prompt },
          ],
        },
      ],
      temperature: 0.6,
    });
    return response.output_text?.trim() || null;
  } finally {
    await client.files.delete(uploaded.id).catch(() => {});
  }
}

async function generateFromText(
  client: OpenAI,
  prompt: string,
  inputText: string
): Promise<string | null> {
  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You generate concise project descriptions. Output only the description text, no markdown or extra formatting.",
      },
      {
        role: "user",
        content: `${prompt}

Source content to summarize:
---
${inputText.slice(0, 12000)}
---

Generate the project description:`,
      },
    ],
    temperature: 0.6,
  });
  return response.choices[0]?.message?.content?.trim() || null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isInEXO = await isUserInEXOCompany(user.email);
    if (!isInEXO) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      source,
      offerId,
      customInput,
      language = "NL",
    } = body as {
      source: "offer" | "custom";
      offerId?: string;
      customInput?: string;
      language?: "NL" | "EN";
    };

    const langInstruction =
      language === "NL"
        ? "Write the description in Dutch (Nederlands)."
        : "Write the description in English.";
    const basePrompt = `${PROJECT_DESCRIPTION_PROMPT}

${langInstruction}

Project title: ${project.title}`;

    const client = new OpenAI({ apiKey });
    let description: string | null = null;

    if (source === "offer" && offerId) {
      const [offer] = (await db
        .select({
          content: offers.content,
          note: offers.note,
          fileName: offers.fileName,
          fileStoragePath: offers.fileStoragePath,
        })
        .from(offers)
        .where(eq(offers.id, offerId))
        .limit(1)) as OfferRow[];

      if (!offer) {
        return NextResponse.json({ error: "Offer not found" }, { status: 404 });
      }

      if (offer.fileStoragePath) {
        const pdfBuffer = await downloadOfferFile(offer.fileStoragePath);
        if (!pdfBuffer) {
          return NextResponse.json(
            { error: "Offer file could not be downloaded" },
            { status: 500 }
          );
        }
        const noteSuffix = offer.note?.trim()
          ? `\n\nAdditional note from the team: ${offer.note.trim()}`
          : "";
        const pdfPrompt = `${basePrompt}

The attached PDF is the signed/sent offer for this project. Find the section titled "Projectoverzicht" (or the closest equivalent) and base the description on what is described there.${noteSuffix}

Generate the project description:`;
        description = await generateFromPdf(
          client,
          pdfBuffer,
          offer.fileName || `offer-${offerId}.pdf`,
          pdfPrompt
        );
      } else {
        const parts: string[] = [];
        if (offer.content?.trim()) parts.push(offer.content.trim());
        if (offer.note?.trim()) parts.push(`Note: ${offer.note.trim()}`);
        if (!parts.length) {
          return NextResponse.json(
            { error: "Offer has no usable content, note, or file" },
            { status: 400 }
          );
        }
        description = await generateFromText(
          client,
          basePrompt,
          parts.join("\n\n")
        );
      }
    } else if (source === "custom" && customInput?.trim()) {
      description = await generateFromText(
        client,
        basePrompt,
        customInput.trim()
      );
    } else {
      return NextResponse.json(
        { error: "Invalid input: provide offerId or customInput" },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: "Failed to generate description" },
        { status: 500 }
      );
    }

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Error generating project description:", error);
    return NextResponse.json(
      { error: "Failed to generate description" },
      { status: 500 }
    );
  }
}
