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
import { useUpdateAsset } from "@/hooks/use-assets";
import { toast } from "sonner";
import type { AssetData } from "@/hooks/use-assets";

interface EditAssetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: AssetData | null;
  onSuccess?: () => void;
}

export function EditAssetModal({
  open,
  onOpenChange,
  asset,
  onSuccess,
}: EditAssetModalProps) {
  const [name, setName] = useState(() => asset?.name ?? "");
  const [description, setDescription] = useState(
    () => asset?.description ?? ""
  );
  const [purchaseDate, setPurchaseDate] = useState(() =>
    asset?.purchaseDate
      ? new Date(asset.purchaseDate).toISOString().slice(0, 10)
      : ""
  );
  const [purchasePrice, setPurchasePrice] = useState(
    () => asset?.purchasePrice ?? ""
  );
  const [residualValue, setResidualValue] = useState(
    () => asset?.residualValue ?? "0"
  );
  const [usefulLifeYears, setUsefulLifeYears] = useState(
    () => asset?.usefulLifeYears ?? 5
  );
  const [category, setCategory] = useState(() => asset?.category ?? "");

  const updateAsset = useUpdateAsset();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;

    const price = parseFloat(purchasePrice);
    const residual = parseFloat(residualValue);
    if (isNaN(price) || price < 0) {
      toast.error("Invalid purchase price");
      return;
    }

    updateAsset.mutate(
      {
        id: asset.id,
        name: name.trim(),
        description: description.trim() || null,
        purchaseDate: purchaseDate || new Date().toISOString().slice(0, 10),
        purchasePrice: price,
        residualValue: isNaN(residual) ? 0 : residual,
        usefulLifeYears: Math.max(1, usefulLifeYears),
        category: category.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success("Asset updated");
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to update asset");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Asset</DialogTitle>
          <DialogDescription>Update asset details</DialogDescription>
        </DialogHeader>
        {asset && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-purchaseDate">Purchase date</Label>
              <Input
                id="edit-purchaseDate"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-purchasePrice">Purchase price (EUR)</Label>
              <Input
                id="edit-purchasePrice"
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-residualValue">Residual value (EUR)</Label>
              <Input
                id="edit-residualValue"
                type="number"
                min="0"
                step="0.01"
                value={residualValue}
                onChange={(e) => setResidualValue(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-usefulLifeYears">Useful life (years)</Label>
              <Input
                id="edit-usefulLifeYears"
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
              <Label htmlFor="edit-category">Category</Label>
              <Select
                value={category || "none"}
                onValueChange={(v) => setCategory(v === "none" ? "" : v)}
              >
                <SelectTrigger id="edit-category">
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateAsset.isPending}>
                {updateAsset.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
