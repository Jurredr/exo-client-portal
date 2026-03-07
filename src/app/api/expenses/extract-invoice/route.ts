import { createClient } from "@/lib/supabase/server";
import { isUserInEXOCompany, getCompaniesByNameOrBtw } from "@/lib/db/queries";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const EXTRACT_PROMPT = `Extract invoice data from this document. Return a JSON object with these exact keys (use null for missing values):
- vendor: string - company/seller name (the vendor on the invoice)
- amount: string - total amount as number string (e.g. "123.45")
- currency: string - ISO code (EUR, USD, etc.)
- date: string - invoice date in YYYY-MM-DD format
- btwNumber: string | null - VAT/BTW number if present
- kvkNumber: string | null - KVK number if present (Dutch Chamber of Commerce)
- description: string - brief description of items/services
- category: string | null - map to ONE of: Office, Software, Travel, Equipment, Marketing, Utilities, Professional Services, Other (infer from items/services)
- vendorAddress: string | null - vendor's address if on invoice
- vendorEmail: string | null - vendor's email if on invoice
- vendorPhone: string | null - vendor's phone if on invoice

Return only valid JSON, no markdown or extra text.`;

export interface ExtractInvoiceResponse {
  vendor: string | null;
  amount: string | null;
  currency: string | null;
  date: string | null;
  btwNumber: string | null;
  kvkNumber: string | null;
  description: string | null;
  category: string | null;
  vendorAddress: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;
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
    const validCategories = [
      "Office",
      "Software",
      "Travel",
      "Equipment",
      "Marketing",
      "Utilities",
      "Professional Services",
      "Other",
    ];
    const cat =
      typeof parsed.category === "string" &&
      validCategories.includes(parsed.category)
        ? parsed.category
        : null;

    return {
      vendor: typeof parsed.vendor === "string" ? parsed.vendor : null,
      amount: typeof parsed.amount === "string" ? parsed.amount : null,
      currency: typeof parsed.currency === "string" ? parsed.currency : null,
      date: typeof parsed.date === "string" ? parsed.date : null,
      btwNumber: typeof parsed.btwNumber === "string" ? parsed.btwNumber : null,
      kvkNumber: typeof parsed.kvkNumber === "string" ? parsed.kvkNumber : null,
      description:
        typeof parsed.description === "string" ? parsed.description : null,
      category: cat,
      vendorAddress:
        typeof parsed.vendorAddress === "string" ? parsed.vendorAddress : null,
      vendorEmail:
        typeof parsed.vendorEmail === "string" ? parsed.vendorEmail : null,
      vendorPhone:
        typeof parsed.vendorPhone === "string" ? parsed.vendorPhone : null,
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
    const fileData = `data:application/pdf;base64,${base64}`;

    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              file_data: fileData,
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
