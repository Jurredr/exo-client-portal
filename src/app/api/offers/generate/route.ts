import { createClient } from "@/lib/supabase/server";
import {
  hasAdminAccess,
  getCompanyById,
  getContactById,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";
import OpenAI from "openai";

const OFFER_TEMPLATE_REFERENCE = `# [EXO x Company] Multi-Provider Mail Architecture & Gmail Integration

---

## Projectoverzicht

- Uitbreiding op het bestaande **Pigion.AI backend en frontend project**
- Doel: ontkoppelen van de huidige Microsoft/Outlook-afhankelijkheid en introduceren van een schaalbaar provider-systeem
- Focus op een robuuste provider-abstractielaag met volledige Gmail-integratie als tweede ondersteunde provider
- Deze werkzaamheden vallen buiten de oorspronkelijke SOW en worden als scope-extensie uitgevoerd

---

## Scope – Inbegrepen

### Provider Abstractielaag – Backend Refactor

- Introductie van een provider-interface als centrale abstractie voor alle mail-gerelateerde operaties
- Ontkoppelen van bestaande Microsoft Graph-afhankelijkheden uit gedeelde en generieke backend-logica
- Alle core functionaliteit (mail ophalen, drafts aanmaken, sent mail verwerken, etc.) geïmplementeerd via de provider-interface
- Microsoft blijft volledig ondersteund via de nieuwe structuur

### Gmail Provider – Volledige Integratie

- Google OAuth2 als auth provider toevoegen naast Microsoft, inclusief mobile OAuth flows
- Koppeling met Gmail API voor alle ondersteunde mailoperaties:
    - Mailbox uitlezen en verwerken
    - Draft aanmaken en opslaan
    - Sent mail ophalen
    - Folder/label-logica equivalent aan huidige Microsoft flow
- Token management voor Google (opslaan, refreshen, revoken)
- Correcte disconnect flow inclusief credential wipe

### Multi-Provider Gebruikerservaring

- Gebruiker kan kiezen voor Microsoft of Google bij onboarding/koppeling
- Provider-keuze opgeslagen per gebruiker
- UI-afstemming voor provider-selectie binnen bestaande flows
- Conditionele weergave op basis van gekoppelde provider

### **Performance & Monitoring**

- Performance-checks op kritieke provider-flows (mail ophalen, draft generatie, token refresh)
- Integratie van monitoring tooling voor observability op provider-level
- Alerting op kritieke failures via Sentry
    - Production-ready configuratie met environment separation

---

## Technische Stack

- Next.js
- TypeScript
- Supabase
- Bestaande Pigion.AI backend-architectuur
- Microsoft Graph API (bestaand)
- Gmail API / Google OAuth2 (nieuw)

---

## Werkwijze

- Analyse van bestaande Microsoft Graph-implementatie als basis
- Gefaseerde aanpak: abstractielaag eerst, daarna Gmail-implementatie
- Geen over-engineering; bestaande Microsoft-functionaliteit blijft stabiel tijdens refactor
- Pragmatische implementatie zonder volledige codebase-herstructurering
- Testen van kritieke flows per provider

---

## Feedback & Revisies

- **1 feedbackmoment inbegrepen**
- In scope:
    - Kleine functionele correcties
    - Afstemming van edge cases per provider
- Niet in scope:
    - Extra mail providers (bijv. IMAP, Yahoo)
    - Geavanceerde Gmail label-management
    - Infrastructurele wijzigingen
    - Nieuwe productfeatures buiten de provider-scope

---

## Out of Scope (deze fase)

- Ondersteuning voor andere providers dan Microsoft en Google
- Geavanceerde Gmail-specifieke features buiten de core Pigion-flow
- Performance-optimalisatie op schaal
- Monitoring tooling

---

## Investering

- **€4.200 excl. btw**
- Projectprijs voor provider-abstractie + volledige Gmail-integratie
- Eventuele vervolguitbreidingen in overleg

---

## Eigendom & Oplevering

- Volledige codebase eigendom van **Pigion.AI**
- Oplevering als geïntegreerde uitbreiding op bestaande MVP
- Klaar voor verdere uitbreiding naar aanvullende mail providers

---

**Jurre de Ruiter**

Datum:

**{Contact naam}**

Datum:`;

const OFFER_GENERATION_PROMPT = `You are a professional at EXO, a creative agency. Generate a formal offer/quote document in markdown format.

Use this EXACT offer structure as your template. Follow the same sections, formatting, and style:

${OFFER_TEMPLATE_REFERENCE}

Rules:
- Use the language specified (NL or EN) for the entire document
- Replace the title with: # [EXO x {Company/Client naam}] {Project/Service titel}
- Adapt the sections to the project described. Use the same section names where they fit (Projectoverzicht, Scope – Inbegrepen, Technische Stack, Werkwijze, Feedback & Revisies, Out of Scope, Investering, Eigendom & Oplevering)
- For Investering: use the prijssuggestie if provided, otherwise suggest a reasonable amount
- End with the signature block: **Jurre de Ruiter** / Datum: / **{Contact naam}** / Datum: — replace {Contact naam} with the client/contact name provided in the request.
- Use --- between sections
- Use ### for subsections within Scope, ## for main sections
- Use - for bullet points, **bold** for emphasis
- Return ONLY the markdown document, no extra commentary`;

export interface GenerateOfferRequest {
  description: string;
  companyId?: string | null;
  contactId?: string | null;
  language: "NL" | "EN";
  prijssuggestie?: string | null;
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

    const isInEXO = await hasAdminAccess(user.email);
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

    const body = (await request.json()) as GenerateOfferRequest;
    const { description, companyId, contactId, language, prijssuggestie } =
      body;

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    let clientName = "the client";
    if (contactId) {
      const contact = await getContactById(contactId);
      if (contact) {
        clientName = `${contact.firstName} ${contact.lastName}`;
        if (contact.email) clientName += ` (${contact.email})`;
      }
    } else if (companyId) {
      const company = await getCompanyById(companyId);
      if (company) {
        clientName = company.name;
      }
    }

    const langInstruction =
      language === "NL"
        ? "Write the entire offer in Dutch (Nederlands)."
        : "Write the entire offer in English.";

    const priceInstruction = prijssuggestie?.trim()
      ? `Use this price suggestion in the Investment section: ${prijssuggestie}`
      : "Suggest a reasonable professional rate for the scope described.";

    const clientInstruction = `The offer is for: ${clientName}.`;

    const userPrompt = `${OFFER_GENERATION_PROMPT}

${langInstruction}
${priceInstruction}
${clientInstruction}

Description of the project/service to quote:
---
${description.trim()}
---

Generate the offer markdown now:`;

    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional offer writer for EXO creative agency. Output only valid markdown, no code blocks or extra formatting.",
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { error: "Failed to generate offer content" },
        { status: 500 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Error generating offer:", error);
    return NextResponse.json(
      { error: "Failed to generate offer" },
      { status: 500 }
    );
  }
}
