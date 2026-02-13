"use client";

import { useState, useEffect } from "react";
import type { Project } from "@/types/project";
import Image from "next/image";
import { ResourceCard } from "@/components/ResourceCard";
import { AddCard } from "@/components/AddCard";
import { VAT_PERCENTAGE } from "@/lib/constants";
import { formatDate } from "@/lib/utils/date";
import {
  calculateVAT,
  calculateTotal,
  calculatePaymentAmount,
  formatCurrency,
  parseNumeric,
} from "@/lib/utils/currency";
import {
  getStageProgress,
  isStageCompleted,
  isStageActive,
} from "@/lib/utils/project";
import {
  IconFileDescription,
  IconCash,
  IconPackage,
  IconRefresh,
  IconInfoCircle,
} from "@tabler/icons-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ProjectInvoice {
  id: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  status: string;
  invoiceDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
}

interface ProjectDetailsProps {
  project: Project;
  organizationName: string;
  organizationImageUrl?: string;
  isInEXO?: boolean;
}

const STAGE_CONFIG = [
  { key: "kick_off" as const, label: "Kick-off", Icon: IconFileDescription },
  { key: "pay_first" as const, label: "Pay", Icon: IconCash },
  { key: "deliver" as const, label: "Deliver", Icon: IconPackage },
  { key: "revise" as const, label: "Revise", Icon: IconRefresh },
  { key: "pay_final" as const, label: "Pay", Icon: IconCash },
];

const STATUS_CONFIG: Record<
  string,
  { dotGradient: string; dotStroke: string; barGradient: string }
> = {
  lead: {
    dotGradient: "radial-gradient(circle, #c084fc 0%, #9333ea 100%)",
    dotStroke: "#a855f7",
    barGradient: "radial-gradient(ellipse at center, #c084fc 0%, #9333ea 100%)",
  },
  active: {
    dotGradient: "radial-gradient(circle, #4CF65A 0%, #2AC022 100%)",
    dotStroke: "#5FC867",
    barGradient: "radial-gradient(ellipse at center, #77F64C 0%, #59C864 100%)",
  },
  on_hold: {
    dotGradient: "radial-gradient(circle, #FACC15 0%, #EAB308 100%)",
    dotStroke: "#FDE047",
    barGradient: "radial-gradient(ellipse at center, #FDE047 0%, #EAB308 100%)",
  },
  completed: {
    dotGradient: "radial-gradient(circle, #9CA3AF 0%, #6B7280 100%)",
    dotStroke: "#9CA3AF",
    barGradient: "radial-gradient(ellipse at center, #D1D5DB 0%, #9CA3AF 100%)",
  },
  cancelled: {
    dotGradient: "radial-gradient(circle, #f87171 0%, #dc2626 100%)",
    dotStroke: "#ef4444",
    barGradient: "radial-gradient(ellipse at center, #f87171 0%, #dc2626 100%)",
  },
};

function formatStatusLabel(status: string): string {
  if (status === "lead") return "Discussing";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const DEFAULT_STATUS_CONFIG = STATUS_CONFIG.active;

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? DEFAULT_STATUS_CONFIG;
}

function WorkflowStepper({ stage }: { stage: string | null | undefined }) {
  return (
    <div className="flex gap-px rounded-xl border overflow-hidden border-neutral-300 bg-neutral-300">
      {STAGE_CONFIG.map(({ key, label, Icon }) => {
        const active = isStageActive(stage, key);
        const completed = isStageCompleted(stage, key);
        const bg = active ? "#ffffff" : completed ? "#cccccc" : "#e6e6e6";

        return (
          <div
            key={key}
            className="flex flex-1 flex-col items-center justify-center py-2 px-2"
            style={{ backgroundColor: bg }}
          >
            <div
              className={`flex shrink-0 items-center justify-center ${
                active
                  ? "text-gray-800"
                  : completed
                    ? "text-gray-600"
                    : "text-gray-400"
              }`}
            >
              <Icon className="size-4" stroke={2} />
            </div>
            <span
              className={`mt-0.5 truncate text-center font-sans text-[10px] font-medium ${
                active
                  ? "font-semibold text-gray-800"
                  : completed
                    ? "text-gray-600"
                    : "text-gray-400"
              } ${completed ? "line-through" : ""}`}
              style={{ whiteSpace: "nowrap" }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function ProjectDetails({
  project,
  organizationName,
  organizationImageUrl,
  isInEXO = false,
}: ProjectDetailsProps) {
  const currency = project.currency || "EUR";
  const vat = calculateVAT(project.subtotal, currency);
  const total = calculateTotal(project.subtotal, currency);
  const paymentAmount = calculatePaymentAmount(
    project.subtotal,
    project.stage,
    currency
  );
  const progress = getStageProgress(project.stage);
  const statusConfig = getStatusConfig(project.status ?? "active");

  const [invoices, setInvoices] = useState<ProjectInvoice[]>([]);
  useEffect(() => {
    fetch(`/api/projects/${project.id}/invoices`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => setInvoices([]));
  }, [project.id]);

  return (
    <div className="max-w-2xl">
      {/* Main Content Card */}
      <div className="rounded-3xl border flex flex-col gap-10 border-gray-200 bg-white/75 p-10 shadow-lg backdrop-blur-md">
        {/* Project Title - "EXO {pill} — {project_name} for {org_name} {org_pill}" */}
        <div>
          {/* Standard block layout for natural text wrapping */}
          <h1 className="font-serif text-3xl leading-tight text-gray-900 md:text-4xl">
            <span className="mr-2">EXO</span>

            <span className="relative bottom-1 mr-3 inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-full align-middle md:h-10 md:w-16">
              <Image src="/exo-pill.png" alt="" fill className="object-cover" />
            </span>

            <span className="mr-3">—</span>

            <span>
              {project.title} for {organizationName}
            </span>

            {organizationImageUrl && (
              <span className="relative bottom-1 ml-2 inline-flex h-6 w-6 shrink-0 overflow-hidden rounded-full align-middle md:h-10 md:w-16">
                <Image
                  src={organizationImageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 24px, 64px"
                  unoptimized
                />
              </span>
            )}
          </h1>
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left Column - About This Project */}
          <div className="flex min-h-full flex-col rounded-3xl border border-gray-300 bg-white/90 p-6">
            <h2 className="mb-4 text-2xl font-serif text-gray-900">
              About this Project
            </h2>
            <p className="font-sans text-sm leading-snug text-gray-600">
              {project.description || `${project.title}.`}
            </p>
            <div className="mt-auto space-y-4 pt-6">
              <div>
                <p className="font-sans text-sm font-semibold text-gray-900">
                  exo@jurre.me
                </p>
                <p className="font-sans text-xs text-gray-500">
                  EXO&apos;s email
                </p>
              </div>
              <div>
                <p className="font-sans text-sm font-semibold text-gray-900">
                  {formatDate(project.startDate)}
                </p>
                <p className="font-sans text-xs text-gray-500">Project start</p>
              </div>
              <div>
                <p className="font-sans text-sm font-semibold text-gray-900">
                  {formatDate(project.deadline)}
                </p>
                <p className="font-sans text-xs text-gray-500">
                  Project deadline
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Status and Payment */}
          <div>
            <div className="rounded-3xl border border-gray-300 bg-white/90 p-6">
              <div className="mb-1 flex items-center gap-2">
                <div
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    background: statusConfig.dotGradient,
                    border: `1px solid ${statusConfig.dotStroke}`,
                    boxSizing: "border-box",
                  }}
                />
                <span className="text-2xl font-serif text-gray-900">
                  {formatStatusLabel(project.status ?? "active")}
                </span>
              </div>
              <p className="mb-3 font-sans text-xs text-gray-500">
                Project Status
              </p>

              {/* Progress Bar */}
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-[#dddddd]">
                <div
                  className="h-full overflow-hidden rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: statusConfig.barGradient,
                  }}
                />
              </div>

              {/* Workflow Steps */}
              <WorkflowStepper stage={project.stage} />
            </div>

            {/* Financial Summary */}
            <div className="mt-3 rounded-3xl border border-gray-300 bg-white/90 p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between font-sans text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(parseNumeric(project.subtotal), currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between font-sans text-sm">
                  <span className="flex items-center gap-1 text-gray-600">
                    {VAT_PERCENTAGE}% BTW
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex shrink-0 cursor-help rounded focus:outline-none focus:ring-2 focus:ring-gray-300"
                          aria-label="BTW information"
                        >
                          <IconInfoCircle className="size-3.5 text-gray-400" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-68">
                        <p>
                          BTW is 0% at the moment since EXO is still in the KOR
                          (Kleine ondernemers regeling).
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </span>
                  <span className="font-semibold text-gray-900">{vat}</span>
                </div>
                <div className="flex items-center justify-between border-t border-dashed border-gray-200 pt-3 font-sans text-sm">
                  <span className="font-medium text-gray-700">Total Price</span>
                  <span className="font-bold text-gray-900">{total}</span>
                </div>
              </div>

              <button
                className="mt-6 w-full rounded-2xl bg-linear-to-br cursor-pointer from-gray-100 to-gray-200 border border-gray-200 py-4 font-sans text-sm font-semibold text-gray-800 shadow-sm transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  project.stage !== "pay_first" && project.stage !== "pay_final"
                }
              >
                {paymentAmount === null
                  ? "Payment complete"
                  : paymentAmount === "€0"
                    ? "Payment received"
                    : `Pay ${paymentAmount}`}
              </button>
            </div>
          </div>
        </div>

        {/* Deliverables Section */}
        <section className="-mx-10 border-t border-gray-400/70 px-10 pt-10">
          <h2 className="mb-2 font-serif text-3xl text-gray-900">
            Deliverables
          </h2>
          <p className="mb-6 font-sans text-sm text-gray-600">
            All project files and assets delivered here, always up-to-date and
            ready to download.
          </p>
          <div className="flex flex-wrap gap-4">
            <ResourceCard
              type="folder"
              title="Deliverables"
              subtitle="1.45 GB"
            />
            {isInEXO && <AddCard />}
          </div>
        </section>

        {/* Client Assets Section */}
        <section className="-mx-10 border-t border-gray-400/70 px-10 pt-10">
          <h2 className="mb-2 font-serif text-3xl text-gray-900">
            Client Assets
          </h2>
          <p className="mb-6 font-sans text-sm text-gray-600">
            Upload any files or assets needed for the project here.
          </p>
          <div className="flex flex-wrap gap-4">
            <AddCard />
          </div>
        </section>

        {/* Legal Section */}
        <section className="-mx-10 border-t border-gray-400/70 px-10 pt-10">
          <h2 className="mb-2 font-serif text-3xl text-gray-900">Legal</h2>
          <p className="mb-6 font-sans text-sm text-gray-600">
            Access your contracts, legal documents, and invoices for this
            project here.
          </p>
          <div className="flex flex-wrap gap-4">
            {invoices.map((invoice) => (
              <ResourceCard
                key={invoice.id}
                type="file"
                title={invoice.invoiceNumber}
                subtitle={formatCurrency(
                  parseNumeric(invoice.amount),
                  invoice.currency
                )}
                badge={{
                  text:
                    invoice.status === "paid"
                      ? "Paid"
                      : invoice.status === "overdue"
                        ? "Overdue"
                        : "Sent",
                  variant: invoice.status === "overdue" ? "warning" : "success",
                }}
                href={`/api/invoices/${invoice.id}/download`}
              />
            ))}
            {invoices.length === 0 && (
              <p className="font-sans text-sm text-gray-500">
                No invoices for this project yet.
              </p>
            )}
            {isInEXO && <AddCard />}
          </div>
        </section>
      </div>
    </div>
  );
}
