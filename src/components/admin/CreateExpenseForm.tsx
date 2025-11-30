"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DollarSign, Calendar, Upload, X, FileText } from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Office",
  "Software",
  "Travel",
  "Equipment",
  "Marketing",
  "Utilities",
  "Professional Services",
  "Other",
];

export function CreateExpenseForm({ onSuccess }: { onSuccess?: () => void }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<string>("");
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      setInvoiceFile(file);
      
      // Create preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setInvoicePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setInvoicePreview(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }

    if (!amount.trim()) {
      toast.error("Amount is required");
      return;
    }

    setIsSubmitting(true);
    try {
      let invoiceUrl: string | null = null;
      let invoiceFileName: string | null = null;
      let invoiceFileType: string | null = null;

      // Convert file to base64 if provided
      if (invoiceFile) {
        const reader = new FileReader();
        invoiceUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            resolve(reader.result as string);
          };
          reader.onerror = reject;
          reader.readAsDataURL(invoiceFile);
        });
        invoiceFileName = invoiceFile.name;
        invoiceFileType = invoiceFile.type;
      }

      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: description.trim(),
          amount: amount.trim(),
          date: date || null,
          category: category || null,
          invoiceUrl,
          invoiceFileName,
          invoiceFileType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create expense");
      }

      toast.success("Expense created successfully");
      setDescription("");
      setAmount("");
      setDate("");
      setCategory("");
      setInvoiceFile(null);
      setInvoicePreview(null);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create expense"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="expense-description">Description *</Label>
        <Textarea
          id="expense-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Office supplies, Software subscription, etc."
          rows={3}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expense-amount" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Amount *
          </Label>
          <Input
            id="expense-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expense-date" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Date
          </Label>
          <Input
            id="expense-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-category">Category</Label>
        <Select value={category || undefined} onValueChange={(value) => setCategory(value || "")}>
          <SelectTrigger id="expense-category" className="w-full">
            <SelectValue placeholder="Select a category (optional)" />
          </SelectTrigger>
          <SelectContent>
            {EXPENSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="expense-invoice" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Invoice (Optional)
        </Label>
        <div className="space-y-2">
          <Input
            id="expense-invoice"
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="cursor-pointer"
          />
          {invoiceFile && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
              <FileText className="h-4 w-4" />
              <span className="text-sm flex-1">{invoiceFile.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  setInvoiceFile(null);
                  setInvoicePreview(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {invoicePreview && (
            <div className="mt-2">
              <img
                src={invoicePreview}
                alt="Invoice preview"
                className="max-w-full h-auto max-h-48 rounded-md border"
              />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Max 10MB. Supports images and PDFs.
          </p>
        </div>
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? "Creating..." : "Create Expense"}
      </Button>
    </form>
  );
}

