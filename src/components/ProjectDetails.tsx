"use client";

import type { Project } from "@/types/project";
import { VAT_PERCENTAGE } from "@/lib/constants";

interface ProjectDetailsProps {
  project: Project;
  organizationName: string;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "Not set";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseNumeric(value: string | null | undefined): number {
  if (!value) return 0;
  // Handle numeric strings from database (may be string representation of number)
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
}

function formatCurrency(amount: number): string {
  return `€${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calculateVAT(subtotal: string | null | undefined): string {
  const subtotalValue = parseNumeric(subtotal);
  const vat = subtotalValue * (VAT_PERCENTAGE / 100);
  return formatCurrency(vat);
}

function calculateTotal(subtotal: string | null | undefined): string {
  const subtotalValue = parseNumeric(subtotal);
  const vat = subtotalValue * (VAT_PERCENTAGE / 100);
  const total = subtotalValue + vat;
  return formatCurrency(total);
}

function calculatePaymentAmount(subtotal: string | null | undefined): string {
  if (!subtotal) return "€0.00";
  // For now, return a portion of total price
  // You can implement more complex logic later
  const subtotalValue = parseNumeric(subtotal);
  const total = subtotalValue * (1 + VAT_PERCENTAGE / 100);
  const payment = total * 0.4; // 40% as example
  return formatCurrency(payment);
}

export default function ProjectDetails({
  project,
  organizationName,
}: ProjectDetailsProps) {
  const vat = calculateVAT(project.subtotal);
  const total = calculateTotal(project.subtotal);
  const paymentAmount = calculatePaymentAmount(project.subtotal);

  return (
    <div className="max-w-[1027px] ml-[119px] px-[119px] min-h-screen">
      {/* Main Content Card */}
      <div className="bg-white/80 backdrop-blur-sm border border-[#d1d1d1] rounded-[48px] p-[71px]">
        {/* Project Title */}
        <div className="mb-8">
          <h1 className="text-[58px] font-normal leading-[1.1] bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent mb-4">
            {project.title}
          </h1>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-[105px] h-[58px] rounded-[41px] bg-black overflow-hidden">
              <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                EXO
              </div>
            </div>
            <div className="w-[105px] h-[58px] rounded-[41px] bg-black overflow-hidden">
              <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                Arte
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          {/* About This Project */}
          <div className="bg-white/80 backdrop-blur-sm border-2 border-[#d1d1d1] rounded-[48px] p-8">
            <h2 className="text-[36px] font-normal leading-[1.1] bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent mb-4">
              About this Project
            </h2>
            <p className="text-[#686868] text-[20px] leading-[26px] mb-8">
              {project.description || "No description available."}
            </p>
            <div className="space-y-4">
              <div>
                <p className="font-semibold text-[20px] text-[#1f1f1f]">
                  {organizationName}
                </p>
                <p className="font-medium text-[16px] text-[#686868]">
                  Organization
                </p>
              </div>
              <div>
                <p className="font-semibold text-[20px] text-[#1f1f1f]">
                  {formatDate(project.startDate)}
                </p>
                <p className="font-medium text-[16px] text-[#686868]">
                  Project start
                </p>
              </div>
              <div>
                <p className="font-semibold text-[20px] text-[#1f1f1f]">
                  {formatDate(project.deadline)}
                </p>
                <p className="font-medium text-[16px] text-[#686868]">
                  Project deadline
                </p>
              </div>
            </div>
          </div>

          {/* Project Status */}
          <div className="bg-white/80 backdrop-blur-sm border-2 border-[#d1d1d1] rounded-[48px] p-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-green-500" />
              <h2 className="text-[36px] font-semibold leading-[1.1] bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent">
                {project.status}
              </h2>
            </div>
            <p className="font-medium text-[20px] text-[#686868] mb-6">
              Project Status
            </p>
            <div className="bg-[#eaeaea] h-4 rounded-full mb-4">
              <div className="bg-[#42a44a] h-4 rounded-full w-[30%]" />
            </div>
            <div className="flex items-center justify-between text-sm text-[#444444]">
              <div className="flex items-center gap-2 opacity-40 line-through">
                <span>☕</span>
                <span>Kick-off</span>
              </div>
              <div className="flex items-center gap-2">
                <span>💰</span>
                <span>Pay</span>
              </div>
              <div className="flex items-center gap-2 opacity-40">
                <span>💬</span>
                <span>Revise</span>
              </div>
              <div className="flex items-center gap-2 opacity-40">
                <span>🚀</span>
                <span>Deliver</span>
              </div>
            </div>
          </div>

          {/* Invoice */}
          <div className="bg-white/80 backdrop-blur-sm border-2 border-[#d1d1d1] rounded-[48px] p-8">
            <div className="flex items-center gap-2 mb-6">
              <span>ℹ️</span>
              <h3 className="font-medium text-[20px] text-[#686868]">
                Invoice
              </h3>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center border-b border-[#d1d1d1] pb-2">
                <p className="font-medium text-[20px] text-[#686868]">
                  Subtotal
                </p>
                <p className="font-semibold text-[20px] text-[#1f1f1f]">
                  {formatCurrency(parseNumeric(project.subtotal))}
                </p>
              </div>
              <div className="flex justify-between items-center border-b border-[#d1d1d1] pb-2">
                <p className="font-medium text-[20px] text-[#686868]">
                  {VAT_PERCENTAGE}% VAT
                </p>
                <p className="font-semibold text-[20px] text-[#1f1f1f]">
                  {vat}
                </p>
              </div>
              <div className="flex justify-between items-center pt-2">
                <p className="font-medium text-[20px] text-[#686868]">
                  Total Price
                </p>
                <p className="font-semibold text-[20px] text-[#1f1f1f]">
                  {total}
                </p>
              </div>
            </div>
            <button className="w-full py-4 rounded-[76px] bg-white/80 backdrop-blur-[25px] border border-white text-black font-semibold text-[20px] hover:bg-white/90 transition-colors shadow-lg">
              Pay {paymentAmount}
            </button>
          </div>
        </div>

        {/* Deliverables Section */}
        <div className="mb-12">
          <div className="border-t border-[#d1d1d1] pt-8 mb-6">
            <h2 className="text-[58px] font-normal leading-[1.1] bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent mb-4">
              Deliverables
            </h2>
            <p className="text-[#686868] text-[20px] leading-[26px] mb-6">
              All project files and assets delivered here, always up-to-date and
              ready to download.
            </p>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[31px] border-2 border-[#adadad] bg-gray-100 flex items-center justify-center"
                >
                  <span className="text-gray-400">Image {i}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Client Assets Section */}
        <div className="mb-12">
          <div className="border-t border-[#d1d1d1] pt-8 mb-6">
            <h2 className="text-[58px] font-normal leading-[1.1] bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent mb-4">
              Client Assets
            </h2>
            <p className="text-[#686868] text-[20px] leading-[26px] mb-6">
              Upload any files or assets needed for the project here.
            </p>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-[31px] border-2 border-[#adadad] bg-gray-100 flex items-center justify-center"
                >
                  <span className="text-gray-400">Asset {i}</span>
                </div>
              ))}
              <div className="aspect-square rounded-[31px] border-2 border-dashed border-[#adadad] bg-[rgba(251,251,251,0.5)] flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
                <span className="text-4xl text-gray-400">+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Section */}
        <div>
          <div className="border-t border-[#d1d1d1] pt-8 mb-6">
            <h2 className="text-[58px] font-normal leading-[1.1] bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text text-transparent mb-4">
              Legal
            </h2>
            <p className="text-[#686868] text-[20px] leading-[26px] mb-6">
              Access your contracts, legal documents, and invoices for this
              project here.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border-2 border-[#adadad] rounded-[31px] p-6">
                <div className="w-[106px] h-[106px] mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">📄</span>
                </div>
                <p className="font-semibold text-[20px] text-black text-center mb-2">
                  Project Agreement
                </p>
                <div className="flex items-center justify-center gap-2 bg-[#c6ffc6] border border-[#42a44a] rounded-md px-2 py-1">
                  <span className="text-[#42a44a] text-xs">✓</span>
                  <span className="text-[#42a44a] text-xs font-semibold">
                    Signed
                  </span>
                </div>
              </div>
              <div className="bg-white border-2 border-[#adadad] rounded-[31px] p-6">
                <div className="w-[106px] h-[106px] mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">📄</span>
                </div>
                <p className="font-semibold text-[20px] text-black text-center mb-2">
                  NDA
                </p>
                <div className="flex items-center justify-center gap-2 bg-[#fff2c6] border border-[#c59161] rounded-md px-2 py-1">
                  <span className="text-[#bd712c] text-xs">⚠</span>
                  <span className="text-[#bd712c] text-xs font-semibold">
                    Not signed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
