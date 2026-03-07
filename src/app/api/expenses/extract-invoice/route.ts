import { createClient } from "@/lib/supabase/server";
import { isUserInEXOCompany, getCompaniesByNameOrBtw } from "@/lib/db/queries";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const EXTRACT_PROMPT = `Extract invoice data from this document. Return a JSON object with these exact keys (use null for missing values):
- vendor: string - company/seller name
- amount: string - total amount as number string (e.g. "123.45")
- currency: string - ISO code (EUR, USD, etc.)
- date: string - invoice date in YYYY-MM-DD format
- btwNumber: string | null - VAT/BTW number if present
- description: string - brief description of items/services

Return only valid JSON, no markdown or extra text.`;

export interface ExtractInvoiceResponse {
  vendor: string | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
  btwNumber: string | null;
  description: string | null;
  suggestedCompanies: Array<{
    id: string;
    name: string;
    btwNumber: string | null;
    kvkNumber: string | null;
  }>;
}

function parseExtractedJson(
  text: string
): Omit<ExtractInvoiceResponse, "suggestedCompanies"> | null {
  try {
    const cleaned = text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return {
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
      amount: typeof parsed.amount === "string" ? parsed.amount : null,
      currency: typeof parsed.currency === "string" ? parsed.currency : null,
      date: typeof parsed.date === "string" ? parsed.date : null,
      btwNumber: typeof parsed.btwNumber === "string" ? parsed.btwNumber : null,
      description:
        typeof parsed.description === "string" ? parsed.description : null,
    };
  } catch {
    return null;
  }
}

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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const filename = file.name || "invoice.pdf";

    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              file_data: base64,
              filename,
            },
            {
              type: "input_text",
              text: EXTRACT_PROMPT,
            },
          ],
        },
      ],
    });

    const outputText = response.output_text ?? "";

    const extracted = parseExtractedJson(outputText);
    if (!extracted) {
      return NextResponse.json(
        { error: "Could not parse extracted invoice data" },
        { status: 422 }
      );
    }

    const suggestedCompanies = await getCompaniesByNameOrBtw(
      extracted.vendor,
      extracted.btwNumber
    );

    return NextResponse.json({
      ...extracted,
      suggestedCompanies,
    });
  } catch (error) {
    console.error("Error extracting invoice:", error);
    return NextResponse.json(
      { error: "Failed to extract invoice data" },
      { status: 500 }
    );
  }
}
