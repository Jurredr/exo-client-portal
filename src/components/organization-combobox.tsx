"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronDown, X } from "lucide-react";

interface Organization {
  id: string;
  name: string;
  image?: string | null;
}

interface OrganizationComboboxProps {
  organizations: Organization[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function OrganizationCombobox({
  organizations,
  selectedIds,
  onSelectionChange,
  placeholder = "Select organizations...",
  disabled = false,
  className,
}: OrganizationComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const toggleSelection = (id: string) => {
    const newSelection = selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id];
    onSelectionChange(newSelection);
  };

  const removeSelection = (id: string) => {
    onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
  };

  const selectedOrganizations = organizations.filter((org) =>
    selectedIds.includes(org.id)
  );

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-start min-h-9 h-auto p-1 relative"
          >
            <div className="flex flex-wrap items-center gap-1 pe-6 flex-1">
              {selectedOrganizations.length > 0 ? (
                selectedOrganizations.map((org) => (
                  <Badge key={org.id} variant="outline" className="gap-1.5">
                    {org.image ? (
                      <Avatar className="size-4">
                        <AvatarImage src={org.image} alt={org.name} />
                        <AvatarFallback className="text-xs">
                          {org.name[0]}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="text-xs">{org.name[0]}</span>
                    )}
                    <span className="font-medium">{org.name}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSelection(org.id);
                      }}
                      className="ml-1 hover:opacity-70 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="px-2.5 text-muted-foreground">
                  {placeholder}
                </span>
              )}
            </div>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search organizations..." />
            <CommandList>
              <CommandEmpty>No organizations found.</CommandEmpty>
              <CommandGroup>
                {organizations.map((org) => {
                  const isSelected = selectedIds.includes(org.id);
                  return (
                    <CommandItem
                      key={org.id}
                      value={org.name}
                      onSelect={() => toggleSelection(org.id)}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {org.image ? (
                          <Avatar className="size-7">
                            <AvatarImage src={org.image} alt={org.name} />
                            <AvatarFallback>{org.name[0]}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="size-7 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                            {org.name[0]}
                          </div>
                        )}
                        <span className="flex flex-col">
                          <span className="font-medium">{org.name}</span>
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

