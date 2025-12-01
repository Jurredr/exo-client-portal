"use client";

import type { Project } from "@/types/project";
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

interface ProjectDetailsProps {
  project: Project;
  organizationName: string;
}

export default function ProjectDetails({
  project,
  organizationName,
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

  return (
    <div className="w-[1027px] ml-[119px]">
      {/* Main Content Card */}
      <div className="bg-white/80 backdrop-blur-sm border border-[#d1d1d1] rounded-[48px] p-[71px]">
        {/* Project Title with Badges */}
        <div className="mb-8">
          <h1
            className="text-[58px] font-normal leading-[1.1] mb-4 bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text"
            style={{ WebkitTextFillColor: "transparent" }}
          >
            {project.title}
          </h1>
          <div className="flex items-center gap-4">
            <div className="w-[105px] h-[58px] rounded-[41px] bg-black flex items-center justify-center overflow-hidden">
              <span className="text-white text-[20px] font-bold">EXO</span>
            </div>
            <div className="w-[105px] h-[58px] rounded-[41px] bg-black flex items-center justify-center overflow-hidden">
              <span className="text-white text-[20px] font-bold">
                {organizationName}
              </span>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-2 gap-6 mb-12">
          {/* Left Column - About This Project */}
          <div className="bg-white/80 backdrop-blur-sm border-2 border-[#d1d1d1] rounded-[48px] p-8">
            <h2
              className="text-[36px] font-normal leading-[1.1] mb-4 bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text"
              style={{ WebkitTextFillColor: "transparent" }}
            >
              About this Project
            </h2>
            <p className="text-[#686868] text-[20px] leading-[26px] mb-8 font-medium tracking-[-0.5px]">
              {project.description || "No description available."}
            </p>
            <div className="space-y-6">
              <div>
                <p className="font-semibold text-[20px] text-[#1f1f1f] leading-[26px] tracking-[-0.5px]">
                  exo@jurre.me
                </p>
                <p className="font-medium text-[16px] text-[#686868] leading-[30.424px] tracking-[-0.5px]">
                  EXO&apos;s email
                </p>
              </div>
              <div>
                <p className="font-semibold text-[20px] text-[#1f1f1f] leading-[26px] tracking-[-0.5px]">
                  {formatDate(project.startDate)}
                </p>
                <p className="font-medium text-[16px] text-[#686868] leading-[30.424px] tracking-[-0.5px]">
                  Project start
                </p>
              </div>
              <div>
                <p className="font-semibold text-[20px] text-[#1f1f1f] leading-[26px] tracking-[-0.5px]">
                  {formatDate(project.deadline)}
                </p>
                <p className="font-medium text-[16px] text-[#686868] leading-[30.424px] tracking-[-0.5px]">
                  Project deadline
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Status and Invoice */}
          <div className="space-y-6">
            {/* Project Status Card */}
            <div className="bg-white/80 backdrop-blur-sm border-2 border-[#d1d1d1] rounded-[48px] overflow-hidden">
              <div className="p-8 pb-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-[#42a44a]" />
                  <h2
                    className="text-[36px] font-semibold leading-[1.1] bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text"
                    style={{ WebkitTextFillColor: "transparent" }}
                  >
                    {project.status}
                  </h2>
                </div>
                <p className="font-medium text-[20px] text-[#686868] mb-6 tracking-[-1px]">
                  Project Status
                </p>

                {/* Progress Bar */}
                <div className="bg-[#eaeaea] h-4 rounded-full mb-4">
                  <div
                    className="bg-[#42a44a] h-4 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Status Steps */}
              <div className="bg-[#ebebeb] border-t-2 border-[#d1d1d1] px-8 py-4">
                <div className="flex items-center justify-between text-[16px]">
                  {/* Kick-off */}
                  <div
                    className={`flex flex-col items-center gap-1 ${
                      isStageCompleted(project.stage, "kick_off")
                        ? "opacity-40"
                        : isStageActive(project.stage, "kick_off")
                          ? ""
                          : "opacity-40"
                    }`}
                  >
                    <span className="text-[20px]">☕</span>
                    <span
                      className={`font-semibold text-[#444444] tracking-[-0.5px] ${
                        isStageCompleted(project.stage, "kick_off")
                          ? "line-through"
                          : ""
                      }`}
                    >
                      Kick-off
                    </span>
                  </div>

                  {/* Pay (First) */}
                  <div
                    className={`flex flex-col items-center gap-1 ${
                      isStageCompleted(project.stage, "pay_first")
                        ? "opacity-40"
                        : isStageActive(project.stage, "pay_first")
                          ? ""
                          : "opacity-40"
                    }`}
                  >
                    <span className="text-[20px]">💰</span>
                    <span
                      className={`font-semibold text-[#444444] tracking-[-0.5px] ${
                        isStageCompleted(project.stage, "pay_first")
                          ? "line-through"
                          : ""
                      }`}
                    >
                      Pay
                    </span>
                  </div>

                  {/* Revise */}
                  <div
                    className={`flex flex-col items-center gap-1 ${
                      isStageCompleted(project.stage, "revise")
                        ? "opacity-40"
                        : isStageActive(project.stage, "revise")
                          ? ""
                          : "opacity-40"
                    }`}
                  >
                    <span className="text-[20px]">💬</span>
                    <span
                      className={`font-semibold text-[#444444] tracking-[-0.5px] ${
                        isStageCompleted(project.stage, "revise")
                          ? "line-through"
                          : ""
                      }`}
                    >
                      Revise
                    </span>
                  </div>

                  {/* Deliver */}
                  <div
                    className={`flex flex-col items-center gap-1 ${
                      isStageCompleted(project.stage, "deliver")
                        ? "opacity-40"
                        : isStageActive(project.stage, "deliver")
                          ? ""
                          : "opacity-40"
                    }`}
                  >
                    <span className="text-[20px]">🚀</span>
                    <span
                      className={`font-semibold text-[#444444] tracking-[-0.5px] ${
                        isStageCompleted(project.stage, "deliver")
                          ? "line-through"
                          : ""
                      }`}
                    >
                      Deliver
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Invoice Card */}
            <div className="bg-white/80 backdrop-blur-sm border-2 border-[#d1d1d1] rounded-[48px] p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-[18px]">ℹ️</span>
                <h3 className="font-medium text-[20px] text-[#686868]">
                  Invoice
                </h3>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-2 border-b-2 border-[#d1d1d1]">
                  <p className="font-medium text-[20px] text-[#686868] tracking-[-0.5px]">
                    Subtotal
                  </p>
                  <p className="font-semibold text-[20px] text-[#1f1f1f] tracking-[-0.5px]">
                    {formatCurrency(parseNumeric(project.subtotal), currency)}
                  </p>
                </div>
                <div className="flex justify-between items-center pb-2 border-b-2 border-[#d1d1d1]">
                  <p className="font-medium text-[20px] text-[#686868] tracking-[-0.5px]">
                    {VAT_PERCENTAGE}% VAT
                  </p>
                  <p className="font-semibold text-[20px] text-[#1f1f1f] tracking-[-0.5px]">
                    {vat}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <p className="font-medium text-[20px] text-[#686868] tracking-[-0.5px]">
                    Total Price
                  </p>
                  <p className="font-semibold text-[20px] text-[#1f1f1f] tracking-[-0.5px]">
                    {total}
                  </p>
                </div>
              </div>

              {/* Pay Button */}
              <button
                className="w-full py-6 rounded-[76px] bg-white/80 backdrop-blur-[25px] border border-white text-black font-semibold text-[20px] hover:bg-white/90 transition-colors shadow-[inset_10px_10px_1.676px_-11.735px_rgba(255,255,255,0.5),inset_6.706px_6.706px_3.353px_-6.706px_#b3b3b3,inset_-6.706px_-6.706px_3.353px_-6.706px_#b3b3b3,inset_0px_0px_0px_3.353px_#999999,inset_0px_0px_73.762px_0px_rgba(242,242,242,0.5)] tracking-[-1px]"
                disabled={project.stage === "completed"}
              >
                {paymentAmount === null
                  ? "Payment complete"
                  : paymentAmount === "€0"
                    ? "No payment required"
                    : `Pay ${paymentAmount}`}
              </button>
            </div>
          </div>
        </div>

        {/* Deliverables Section */}
        <div className="mb-12 pt-8 border-t border-[#d1d1d1]">
          <h2
            className="text-[58px] font-normal leading-[1.1] mb-4 bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text"
            style={{ WebkitTextFillColor: "transparent" }}
          >
            Deliverables
          </h2>
          <p className="text-[#686868] text-[20px] leading-[26px] mb-6 font-medium tracking-[-0.5px]">
            All project files and assets delivered here, always up-to-date and
            ready to download.
          </p>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-[31px] border-2 border-[#adadad] bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-sm text-gray-600">Deliverables</p>
                  <p className="text-xs text-gray-400">1.45 GB</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Client Assets Section */}
        <div className="mb-12 pt-8 border-t border-[#d1d1d1]">
          <h2
            className="text-[58px] font-normal leading-[1.1] mb-4 bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text"
            style={{ WebkitTextFillColor: "transparent" }}
          >
            Client Assets
          </h2>
          <p className="text-[#686868] text-[20px] leading-[26px] mb-6 font-medium tracking-[-0.5px]">
            Upload any files or assets needed for the project here.
          </p>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-[31px] border-2 border-[#adadad] bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer"
              >
                <div className="text-center">
                  <div className="text-4xl mb-2">📁</div>
                  <p className="text-sm text-gray-600">Deliverables</p>
                  <p className="text-xs text-gray-400">1.45 GB</p>
                </div>
              </div>
            ))}
            <div className="aspect-square rounded-[31px] border-2 border-dashed border-[#adadad] bg-[rgba(251,251,251,0.5)] flex items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors">
              <span className="text-5xl text-gray-400">+</span>
            </div>
          </div>
        </div>

        {/* Legal Section */}
        <div className="pt-8 border-t border-[#d1d1d1]">
          <h2
            className="text-[58px] font-normal leading-[1.1] mb-4 bg-gradient-to-r from-[#1f1f1f] to-[#404040] bg-clip-text"
            style={{ WebkitTextFillColor: "transparent" }}
          >
            Legal
          </h2>
          <p className="text-[#686868] text-[20px] leading-[26px] mb-6 font-medium tracking-[-0.5px]">
            Access your contracts, legal documents, and invoices for this
            project here.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {/* Project Agreement */}
            <div className="bg-white border-2 border-[#adadad] rounded-[31px] p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="w-[106px] h-[106px] mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-5xl">📄</span>
              </div>
              <p className="font-semibold text-[20px] text-black text-center mb-3 tracking-[-0.5px]">
                Project Agreement
              </p>
              <div className="flex items-center justify-center gap-2 bg-[#c6ffc6] border border-[#42a44a] rounded-md px-2 py-1">
                <span className="text-[#42a44a] text-xs">✓</span>
                <span className="text-[#42a44a] text-xs font-semibold tracking-[-0.38px]">
                  Signed
                </span>
              </div>
            </div>

            {/* NDA */}
            <div className="bg-white border-2 border-[#adadad] rounded-[31px] p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="w-[106px] h-[106px] mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-5xl">📄</span>
              </div>
              <p className="font-semibold text-[20px] text-black text-center mb-3 tracking-[-0.5px]">
                NDA
              </p>
              <div className="flex items-center justify-center gap-2 bg-[#fff2c6] border border-[#c59161] rounded-md px-2 py-1">
                <span className="text-[#bd712c] text-xs">⚠</span>
                <span className="text-[#bd712c] text-xs font-semibold tracking-[-0.4px]">
                  Not signed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
