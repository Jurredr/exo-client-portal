"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORIES } from "@/lib/constants/expense-categories";
import { useCreateAsset } from "@/hooks/use-assets";
import { toast } from "sonner";

interface ExpenseData {
  id: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  category: string | null;
}

interface MarkAsAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expense: ExpenseData | null;
  onSuccess?: () => void;
  alreadyLinked?: boolean;
}

export function MarkAsAssetModal({
  open,
  onOpenChange,
  expense,
  onSuccess,
  alreadyLinked = false,
}: MarkAsAssetModalProps) {
  const [name, setName] = useState(() => expense?.description ?? "");
  const [residualValue, setResidualValue] = useState("0");
  const [usefulLifeYears, setUsefulLifeYears] = useState(5);
  const [category, setCategory] = useState(() => {
    const expCat = expense?.category;
    const isValid =
      expCat && (EXPENSE_CATEGORIES as readonly string[]).includes(expCat);
    return isValid ? expCat : "Equipment";
  });

  const createAsset = useCreateAsset();

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setName("");
      setResidualValue("0");
      setUsefulLifeYears(5);
      setCategory("");
    }
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expense) return;

    const purchasePrice =
      parseFloat(expense.amount.replace(/[^0-9.,]/g, "").replace(",", ".")) ||
      0;
    if (isNaN(purchasePrice) || purchasePrice <= 0) {
      toast.error("Invalid amount for purchase price");
      return;
    }

    createAsset.mutate(
      {
        name: name.trim() || expense.description,
        description: expense.description,
        purchaseDate: expense.date,
        purchasePrice,
        residualValue: parseFloat(residualValue) || 0,
        usefulLifeYears: Math.max(1, usefulLifeYears),
        category: category.trim() || null,
        linkedExpenseId: expense.id,
      },
      {
        onSuccess: () => {
          toast.success("Asset created successfully");
          handleOpenChange(false);
          onSuccess?.();
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to create asset");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as Asset</DialogTitle>
          <DialogDescription>
            Create an asset from this expense. The purchase price will be taken
            from the expense amount. Depreciation will be calculated and
            excluded from direct costs.
          </DialogDescription>
        </DialogHeader>

        {alreadyLinked ? (
          <p className="text-sm text-muted-foreground py-4">
            This expense is already linked to an asset.
          </p>
        ) : expense ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Asset name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. MacBook Pro"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Purchase price (from expense)</Label>
              <p className="text-sm text-muted-foreground">
                {expense.amount} {expense.currency}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="residualValue">Residual value (EUR)</Label>
              <Input
                id="residualValue"
                type="number"
                min="0"
                step="0.01"
                value={residualValue}
                onChange={(e) => setResidualValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="usefulLifeYears">Useful life (years)</Label>
              <Input
                id="usefulLifeYears"
                type="number"
                min="1"
                max="50"
                value={usefulLifeYears}
                onChange={(e) =>
                  setUsefulLifeYears(parseInt(e.target.value, 10) || 5)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={category || "none"}
                onValueChange={(v) => setCategory(v === "none" ? "" : v)}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createAsset.isPending}>
                {createAsset.isPending ? "Creating..." : "Create Asset"}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
