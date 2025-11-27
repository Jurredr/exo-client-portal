"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Play, Pause, X, Clock } from "lucide-react";

export function HourRegistrationTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Format time as HH:MM:SS
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Calculate hours from seconds (as decimal)
  const getHours = (totalSeconds: number) => {
    return totalSeconds / 3600;
  };

  // Start timer
  const handleStart = () => {
    setIsRunning(true);
    startTimeRef.current = Date.now() - elapsedSeconds * 1000;
  };

  // Pause timer and show description dialog
  const handlePause = () => {
    setIsRunning(false);
    setShowDescriptionDialog(true);
  };

  // Cancel timer with confirmation
  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  // Confirm cancel
  const handleConfirmCancel = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    startTimeRef.current = null;
    setShowCancelDialog(false);
    setDescription("");
  };

  // Save hour registration
  const handleSave = async () => {
    if (!description.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const hours = getHours(elapsedSeconds);
      const response = await fetch("/api/hour-registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: description.trim(),
          hours,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save hour registration");
      }

      toast.success("Hour registration saved successfully");
      
      // Reset timer
      setIsRunning(false);
      setElapsedSeconds(0);
      startTimeRef.current = null;
      setDescription("");
      setShowDescriptionDialog(false);
      
      // Trigger refresh of hour registrations table
      window.dispatchEvent(new Event("hour-registration-saved"));
      
      // Trigger refresh of hour registrations table
      window.dispatchEvent(new Event("hour-registration-saved"));
    } catch (error) {
      console.error("Error saving hour registration:", error);
      alert("Failed to save hour registration. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Timer effect
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - startTimeRef.current) / 1000
          );
          setElapsedSeconds(elapsed);
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  return (
    <>
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Hour Registration
          </h3>
        </div>

        <div className="mb-6">
          <div className="text-4xl font-mono font-bold text-center mb-2">
            {formatTime(elapsedSeconds)}
          </div>
          <div className="text-sm text-muted-foreground text-center">
            {getHours(elapsedSeconds).toFixed(2)} hours
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          {!isRunning ? (
            <Button onClick={handleStart} size="lg" className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          ) : (
            <>
              <Button
                onClick={handlePause}
                size="lg"
                variant="secondary"
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
              <Button
                onClick={handleCancel}
                size="lg"
                variant="destructive"
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Description Dialog */}
      <Dialog open={showDescriptionDialog} onOpenChange={setShowDescriptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Work Description</DialogTitle>
            <DialogDescription>
              Please describe the work you completed during this session (
              {formatTime(elapsedSeconds)} / {getHours(elapsedSeconds).toFixed(2)}{" "}
              hours).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the work you did..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDescriptionDialog(false);
                setIsRunning(true); // Resume timer
              }}
            >
              Continue Timer
            </Button>
            <Button onClick={handleSave} disabled={!description.trim() || isSaving}>
              {isSaving ? "Saving..." : "Save Entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Timer?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this timer? All progress (
              {formatTime(elapsedSeconds)} / {getHours(elapsedSeconds).toFixed(2)}{" "}
              hours) will be lost and no entry will be saved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Keep Timer
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>
              Cancel Timer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

