import { Plus } from "lucide-react";

interface AddCardProps {
  onClick?: () => void;
  className?: string;
}

export function AddCard({ onClick, className = "" }: AddCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-36 shrink-0 min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-100/50 py-3 transition-colors hover:border-gray-400/50 hover:bg-gray-50/60 focus:outline-none ${className}`}
      aria-label="Add"
    >
      <Plus className="h-8 w-8 text-gray-400" strokeWidth={2} />
    </button>
  );
}
