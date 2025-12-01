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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Play, Pause, X, Clock, Check } from "lucide-react";

interface Project {
  id: string;
  title: string;
}

export function HourRegistrationTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<
    "client" | "administration" | "brainstorming" | "research" | "labs"
  >("client");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<
    Array<Project & { type?: string }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Round up to full minutes
  const roundUpToMinutes = (totalSeconds: number) => {
    if (totalSeconds === 0) return 0;
    return Math.ceil(totalSeconds / 60) * 60;
  };

  // Format time as "xhrs ymin"
  const formatTime = (totalSeconds: number) => {
    const roundedSeconds = roundUpToMinutes(totalSeconds);
    const hours = Math.floor(roundedSeconds / 3600);
    const minutes = Math.floor((roundedSeconds % 3600) / 60);

    if (hours === 0 && minutes === 0) {
      return "0min";
    }

    const parts: string[] = [];
    if (hours > 0) {
      parts.push(`${hours}hr${hours !== 1 ? "s" : ""}`);
    }
    if (minutes > 0) {
      parts.push(`${minutes}min`);
    }

    return parts.join(" ");
  };

  // Calculate hours from rounded minutes (as decimal)
  const getHours = (totalSeconds: number) => {
    const roundedSeconds = roundUpToMinutes(totalSeconds);
    return roundedSeconds / 3600;
  };

  // Start timer
  const handleStart = () => {
    setIsRunning(true);
    startTimeRef.current = Date.now() - elapsedSeconds * 1000;
  };

  // Pause timer (just pause, don't open dialog)
  const handlePause = () => {
    setIsRunning(false);
  };

  // Submit timer (pause and show description dialog)
  const handleSubmit = () => {
    setIsRunning(false);
    setShowDescriptionDialog(true);
  };

  // Save hour registration
  const handleSave = async () => {
    if (!description.trim()) {
      return;
    }

    // Validate: non-project categories shouldn't have a project
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
    ];
    if (nonProjectCategories.includes(category) && projectId) {
      toast.error(
        `${category.charAt(0).toUpperCase() + category.slice(1)} work should not be associated with a project`
      );
      return;
    }

    setIsSaving(true);
    try {
      // Use rounded minutes for saving
      const roundedSeconds = roundUpToMinutes(elapsedSeconds);
      const hours = roundedSeconds / 3600;
      const response = await fetch("/api/hour-registrations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: description.trim(),
          hours,
          category,
          projectId:
            (category === "client" || category === "labs") &&
            projectId &&
            projectId !== "none"
              ? projectId
              : null,
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
      setCategory("client");
      setProjectId(undefined);
      setShowDescriptionDialog(false);

      // Trigger refresh of hour registrations table
      window.dispatchEvent(new Event("hour-registration-saved"));
    } catch (error) {
      console.error("Error saving hour registration:", error);
      alert("Failed to save hour registration. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel timer with confirmation
  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch("/api/projects");
        if (response.ok) {
          const data = await response.json();
          const projectsData = data.map(
            (item: { project: Project & { type?: string } }) => ({
              id: item.project.id,
              title: item.project.title,
              type: item.project.type || "client",
            })
          );
          setAllProjects(projectsData);
          // Set initial projects (client projects)
          setProjects(
            projectsData
              .filter((p: Project & { type?: string }) => p.type === "client")
              .map((p: Project & { type?: string }) => ({
                id: p.id,
                title: p.title,
              }))
          );
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };
    fetchProjects();
  }, []);

  // Filter projects based on category
  useEffect(() => {
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
    ];
    if (nonProjectCategories.includes(category)) {
      setProjects([]);
      setProjectId(undefined);
    } else if (category === "labs") {
      setProjects(
        allProjects
          .filter((p) => p.type === "labs")
          .map((p) => ({
            id: p.id,
            title: p.title,
          }))
      );
      setProjectId(undefined);
    } else {
      // client
      setProjects(
        allProjects
          .filter((p) => p.type === "client")
          .map((p) => ({
            id: p.id,
            title: p.title,
          }))
      );
      setProjectId(undefined);
    }
  }, [category, allProjects]);

  // Keyboard shortcuts (spacebar for start/pause, enter for submit, escape for cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea or if dialogs are open
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        showDescriptionDialog ||
        showCancelDialog
      ) {
        // Allow Enter in description dialog to submit
        if (e.key === "Enter" && showDescriptionDialog && !e.shiftKey) {
          const descriptionInput = document.getElementById(
            "description"
          ) as HTMLTextAreaElement;
          if (descriptionInput && descriptionInput.value.trim() && !isSaving) {
            e.preventDefault();
            handleSave();
          }
        }
        return;
      }

      // Handle escape key for cancel (when timer has elapsed time, running or paused)
      if (
        e.key === "Escape" &&
        elapsedSeconds > 0 &&
        !showDescriptionDialog &&
        !showCancelDialog
      ) {
        e.preventDefault();
        handleCancel();
        return;
      }

      // Spacebar: start/pause
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!isRunning) {
          handleStart();
        } else {
          handlePause();
        }
      }

      // Enter: submit (open description dialog) - works when running or paused with elapsed time
      if (e.key === "Enter" && elapsedSeconds > 0) {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isRunning,
    elapsedSeconds,
    showDescriptionDialog,
    showCancelDialog,
    isSaving,
    description,
    handleSave,
    handleStart,
    handlePause,
    handleSubmit,
    handleCancel,
  ]);

  // Confirm cancel
  const handleConfirmCancel = () => {
    setIsRunning(false);
    setElapsedSeconds(0);
    startTimeRef.current = null;
    setShowCancelDialog(false);
    setDescription("");
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

  // Prevent page reload/navigation when timer is running
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning) {
        e.preventDefault();
        // Modern browsers ignore custom messages and show their own
        e.returnValue = "";
        return "";
      }
    };

    if (isRunning) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
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
          <div className="text-4xl font-bold text-center mb-2">
            {formatTime(elapsedSeconds)}
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          {!isRunning && elapsedSeconds === 0 ? (
            <Button onClick={handleStart} size="lg" className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          ) : !isRunning ? (
            <>
              <Button
                onClick={handleStart}
                size="lg"
                variant="secondary"
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Continue
              </Button>
              <Button
                onClick={handleSubmit}
                size="lg"
                variant="default"
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Submit
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
                onClick={handleSubmit}
                size="lg"
                variant="default"
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                Submit
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
      <Dialog
        open={showDescriptionDialog}
        onOpenChange={setShowDescriptionDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Work Description</DialogTitle>
            <DialogDescription>
              Please describe the work you completed during this session (
              {formatTime(elapsedSeconds)}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Work Category *</Label>
              <Select
                value={category}
                onValueChange={(value) =>
                  setCategory(
                    value as
                      | "client"
                      | "administration"
                      | "brainstorming"
                      | "research"
                      | "labs"
                  )
                }
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client Work</SelectItem>
                  <SelectItem value="administration">Administration</SelectItem>
                  <SelectItem value="brainstorming">Brainstorming</SelectItem>
                  <SelectItem value="research">Research</SelectItem>
                  <SelectItem value="labs">EXO Labs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(category === "client" || category === "labs") && (
              <div className="space-y-2">
                <Label htmlFor="project">
                  Project {category === "client" ? "(Optional)" : ""}
                </Label>
                <Select
                  value={projectId || "none"}
                  onValueChange={(value) =>
                    setProjectId(value === "none" ? undefined : value)
                  }
                >
                  <SelectTrigger id="project" className="w-full">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder={
                  category === "administration"
                    ? "Describe the administrative work you did..."
                    : category === "brainstorming"
                      ? "Describe your brainstorming session..."
                      : category === "research"
                        ? "Describe the research you conducted..."
                        : "Describe the work you did..."
                }
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="resize-none"
                autoFocus
              />
            </div>
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
            <Button
              onClick={handleSave}
              disabled={!description.trim() || isSaving}
            >
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
              {formatTime(elapsedSeconds)}) will be lost and no entry will be
              saved.
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
