import { createClient } from "@/lib/supabase/server";
import { isUserInEXOCompany } from "@/lib/db/queries";
import { db } from "@/db";
import { offers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const PROJECT_DESCRIPTION_PROMPT = `You are a professional at EXO, a creative agency. Generate a concise project description in plain text (no markdown headings or bullets).

The description should:
- Summarize the project scope and deliverables
- Be 2-4 sentences, professional and clear
- Use the language specified (NL or EN)
- Be suitable for displaying on a project overview page

Return ONLY the description text, no extra commentary.`;

/**
 * Generate project description without requiring an existing project (for Add project flow)
 */
export async function POST(request: Request) {
  try {
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      projectTitle = "",
      source,
      offerId,
      customInput,
      language = "NL",
    } = body as {
      projectTitle?: string;
      source: "offer" | "custom";
      offerId?: string;
      customInput?: string;
      language?: "NL" | "EN";
    };

    let inputText = "";
    if (source === "offer" && offerId) {
      const [offer] = await db
        .select({ content: offers.content })
        .from(offers)
        .where(eq(offers.id, offerId))
        .limit(1);
      if (!offer?.content) {
        return NextResponse.json(
          { error: "Offer not found or has no content" },
          { status: 400 }
        );
      }
      inputText = offer.content;
    } else if (source === "custom" && customInput?.trim()) {
      inputText = customInput.trim();
    } else {
      return NextResponse.json(
        { error: "Invalid input: provide offerId or customInput" },
        { status: 400 }
      );
    }

    const langInstruction =
      language === "NL"
        ? "Write the description in Dutch (Nederlands)."
        : "Write the description in English.";

    const client = new OpenAI({ apiKey });
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
          content: `${PROJECT_DESCRIPTION_PROMPT}

${langInstruction}

${projectTitle ? `Project title: ${projectTitle}` : ""}

Source content to summarize:
---
${inputText.slice(0, 12000)}
---

Generate the project description:`,
        },
      ],
      temperature: 0.6,
    });

    const description = response.choices[0]?.message?.content?.trim();
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
