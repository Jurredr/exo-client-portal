"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, Calendar } from "lucide-react";

const BTW_DEADLINES: { date: Date; quarter: string; label: string }[] = [
  { date: new Date(0, 4, 1), quarter: "Q1", label: "1 mei" },
  { date: new Date(0, 7, 1), quarter: "Q2", label: "1 augustus" },
  { date: new Date(0, 10, 1), quarter: "Q3", label: "1 november" },
  { date: new Date(0, 0, 31), quarter: "Q4", label: "31 januari" },
];

function getUpcomingDeadlines(): {
  deadline: Date;
  key: string;
  label: string;
}[] {
  const now = new Date();
  const results: { deadline: Date; key: string; label: string }[] = [];

  for (const d of BTW_DEADLINES) {
    let deadline: Date;
    if (d.quarter === "Q4") {
      // Q4 (Oct-Dec) deadline is 31 January of the following year
      deadline = new Date(now.getFullYear(), 0, 31);
    } else {
      deadline = new Date(
        now.getFullYear(),
        d.date.getMonth(),
        d.date.getDate()
      );
    }
    const daysUntil = Math.ceil(
      (deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (daysUntil >= 0 && daysUntil <= 14) {
      results.push({
        deadline,
        key: `${deadline.getFullYear()}-${d.quarter}`,
        label: `${d.label} ${deadline.getFullYear()} (${d.quarter})`,
      });
    }
  }

  return results.sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
}

const DISMISSED_KEY = "btw-deadline-dismissed";

function getDismissedKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(DISMISSED_KEY);
    if (!stored) return new Set();
    const parsed = JSON.parse(stored) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function dismissDeadline(key: string) {
  const dismissed = getDismissedKeys();
  dismissed.add(key);
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]));
}

type BannerState = {
  upcoming: { deadline: Date; key: string; label: string }[];
  dismissed: Set<string>;
  now: Date | null;
};

function getInitialBannerState(): BannerState {
  if (typeof window === "undefined") {
    return { upcoming: [], dismissed: new Set(), now: null };
  }
  return {
    upcoming: getUpcomingDeadlines(),
    dismissed: getDismissedKeys(),
    now: new Date(),
  };
}

export function BTWDeadlineBanner() {
  const [state, setState] = useState<BannerState>(getInitialBannerState);

  const visible = state.upcoming.filter((d) => !state.dismissed.has(d.key));
  if (visible.length === 0 || !state.now) return null;

  const handleDismiss = (key: string) => {
    dismissDeadline(key);
    setState((prev) => ({
      ...prev,
      dismissed: new Set([...prev.dismissed, key]),
    }));
  };

  return (
    <div className="space-y-2">
      {visible.map(({ key, label, deadline }) => {
        const daysLeft = Math.ceil(
          (deadline.getTime() - state.now!.getTime()) / (24 * 60 * 60 * 1000)
        );
        return (
          <Alert
            key={key}
            variant="warning"
            appearance="light"
            className="relative pr-12 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          >
            <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">
              BTW aangifte deadline
            </AlertTitle>
            <AlertDescription>
              De aangifte voor {label} moet uiterlijk deze datum ingediend zijn.
              {daysLeft <= 3 && (
                <span className="block mt-1 font-medium text-amber-700 dark:text-amber-300">
                  Nog {daysLeft} dag{daysLeft !== 1 ? "en" : ""}!
                </span>
              )}
            </AlertDescription>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 h-8 w-8"
              onClick={() => handleDismiss(key)}
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          </Alert>
        );
      })}
    </div>
  );
}
