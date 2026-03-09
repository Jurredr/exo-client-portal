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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkAsAssetModal } from "./MarkAsAssetModal";

interface ExpenseOption {
  id: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  category: string | null;
}

interface AddAssetFromExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenses: ExpenseOption[];
  linkedExpenseIds: Set<string>;
  onSuccess?: () => void;
}

export function AddAssetFromExpenseModal({
  open,
  onOpenChange,
  expenses,
  linkedExpenseIds,
  onSuccess,
}: AddAssetFromExpenseModalProps) {
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>("");
  const [showMarkAsAsset, setShowMarkAsAsset] = useState(false);

  const availableExpenses = expenses.filter((e) => !linkedExpenseIds.has(e.id));

  const selectedExpense = availableExpenses.find(
    (e) => e.id === selectedExpenseId
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSelectedExpenseId("");
      setShowMarkAsAsset(false);
    }
    onOpenChange(next);
  };

  const handleContinue = () => {
    if (selectedExpense) {
      setShowMarkAsAsset(true);
    }
  };

  const handleMarkAsAssetSuccess = () => {
    setShowMarkAsAsset(false);
    setSelectedExpenseId("");
    handleOpenChange(false);
    onSuccess?.();
  };

  return (
    <>
      <Dialog open={open && !showMarkAsAsset} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Asset from Expense</DialogTitle>
            <DialogDescription>
              Select an expense to convert into an asset. The purchase price
              will be taken from the expense amount.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select expense</Label>
              <Select
                value={selectedExpenseId || "none"}
                onValueChange={(v) =>
                  setSelectedExpenseId(v === "none" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an expense" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None selected</SelectItem>
                  {availableExpenses.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.description} · {e.amount} {e.currency} ·{" "}
                      {new Date(e.date).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableExpenses.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No expenses available. All expenses are already linked to
                  assets, or there are no expenses yet.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!selectedExpenseId || !selectedExpense}
              >
                Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedExpense && (
        <MarkAsAssetModal
          key={selectedExpense.id}
          open={showMarkAsAsset}
          onOpenChange={setShowMarkAsAsset}
          expense={selectedExpense}
          onSuccess={handleMarkAsAssetSuccess}
          alreadyLinked={false}
        />
      )}
    </>
  );
}
