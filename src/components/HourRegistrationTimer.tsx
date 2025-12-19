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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Play,
  Pause,
  X,
  Clock,
  Check,
  Split,
  Coffee,
  Edit,
  Trash2,
} from "lucide-react";

interface Project {
  id: string;
  title: string;
}

interface SplitEntry {
  id: string;
  description: string;
  category:
    | "client"
    | "administration"
    | "brainstorming"
    | "research"
    | "labs"
    | "client_acquisition";
  projectId?: string;
  duration: number; // in seconds
  isBreak: boolean;
}

export function HourRegistrationTimer() {
  const [isRunning, setIsRunning] = useState(false);
  const [isBreakMode, setIsBreakMode] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [splits, setSplits] = useState<SplitEntry[]>([]);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [editingSplitId, setEditingSplitId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<
    | "client"
    | "administration"
    | "brainstorming"
    | "research"
    | "labs"
    | "client_acquisition"
  >("client");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<
    Array<Project & { type?: string }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const splitStartTimeRef = useRef<number | null>(null);
  const breakStartTimeRef = useRef<number | null>(null);
  const splitPausedTimeRef = useRef<number>(0); // Accumulated split time before break

  // Format time as stopwatch (HH:MM:SS)
  const formatStopwatch = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  };

  // Format time with individual digit containers for stopwatch display
  const formatStopwatchDigits = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n: number) => n.toString().padStart(2, "0");

    if (hours > 0) {
      const hoursStr = pad(hours);
      const minutesStr = pad(minutes);
      const secondsStr = pad(seconds);
      return {
        hours: hoursStr.split(""),
        minutes: minutesStr.split(""),
        seconds: secondsStr.split(""),
        showHours: true,
      };
    }
    const minutesStr = pad(minutes);
    const secondsStr = pad(seconds);
    return {
      hours: [],
      minutes: minutesStr.split(""),
      seconds: secondsStr.split(""),
      showHours: false,
    };
  };

  // Format time as "xhrs ymin" for display in table
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

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

  // Round up to full minutes
  const roundUpToMinutes = (totalSeconds: number) => {
    if (totalSeconds === 0) return 0;
    return Math.ceil(totalSeconds / 60) * 60;
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
    // Initialize split timer if not already set and not in break mode
    if (!splitStartTimeRef.current && !isBreakMode) {
      splitStartTimeRef.current = Date.now();
    }
  };

  // Pause timer
  const handlePause = () => {
    setIsRunning(false);
  };

  // Enter break mode
  const handleBreak = () => {
    if (isBreakMode) {
      // Exit break mode - add break entry
      if (breakStartTimeRef.current) {
        const breakDuration = Math.floor(
          (Date.now() - breakStartTimeRef.current) / 1000
        );
        if (breakDuration > 0) {
          const breakEntry: SplitEntry = {
            id: `break-${Date.now()}`,
            description: "Break",
            category: "administration",
            duration: breakDuration,
            isBreak: true,
          };
          setSplits([...splits, breakEntry]);
        }
      }
      setIsBreakMode(false);
      breakStartTimeRef.current = null;
      // Resume split timer when exiting break (if timer is running)
      // The split timer continues from where it paused, so we adjust the start time
      if (isRunning) {
        if (splitPausedTimeRef.current > 0) {
          // Resume from where we paused
          splitStartTimeRef.current = Date.now() - splitPausedTimeRef.current * 1000;
          splitPausedTimeRef.current = 0;
        } else if (!splitStartTimeRef.current) {
          // Start fresh if no paused time
          splitStartTimeRef.current = Date.now();
        }
      }
    } else {
      // Enter break mode - pause split timer
      if (splitStartTimeRef.current) {
        // Calculate how much split time has elapsed so far
        splitPausedTimeRef.current = Math.floor(
          (Date.now() - splitStartTimeRef.current) / 1000
        );
        splitStartTimeRef.current = null; // Pause split timer
      }
      setIsBreakMode(true);
      breakStartTimeRef.current = Date.now();
    }
  };

  // Add split
  const handleSplit = () => {
    if (isBreakMode) {
      toast.error("Cannot create a split during break mode");
      return;
    }
    if (splitStartTimeRef.current) {
      const splitDuration = Math.floor(
        (Date.now() - splitStartTimeRef.current) / 1000
      );
      if (splitDuration > 0) {
        // Pause timer to capture split
        setIsRunning(false);
        setShowSplitDialog(true);
      } else {
        toast.error("No time elapsed to create a split");
      }
    } else {
      toast.error("Timer hasn't been started yet");
    }
  };

  // Save split
  const handleSaveSplit = () => {
    if (!description.trim() && !editingSplitId) {
      toast.error("Description is required");
      return;
    }

    // Validate: non-project categories shouldn't have a project
    const nonProjectCategories = [
      "administration",
      "brainstorming",
      "research",
      "client_acquisition",
    ];
    if (nonProjectCategories.includes(category) && projectId) {
      toast.error(
        `${category.charAt(0).toUpperCase() + category.slice(1)} work should not be associated with a project`
      );
      return;
    }

    if (editingSplitId) {
      // Update existing split
      setSplits(
        splits.map((split) =>
          split.id === editingSplitId
            ? {
                ...split,
                description: description.trim() || split.description,
                category,
                projectId:
                  (category === "client" || category === "labs") &&
                  projectId &&
                  projectId !== "none"
                    ? projectId
                    : undefined,
              }
            : split
        )
      );
      setEditingSplitId(null);
    } else {
      // Create new split - calculate duration from when split started (excluding break time)
      if (splitStartTimeRef.current) {
        const splitDuration = Math.floor(
          (Date.now() - splitStartTimeRef.current) / 1000
        );
        if (splitDuration > 0) {
          const newSplit: SplitEntry = {
            id: `split-${Date.now()}`,
            description: description.trim(),
            category,
            projectId:
              (category === "client" || category === "labs") &&
              projectId &&
              projectId !== "none"
                ? projectId
                : undefined,
            duration: splitDuration,
            isBreak: false,
          };
          setSplits([...splits, newSplit]);
          // Reset split timer for next split
          splitStartTimeRef.current = Date.now();
          splitPausedTimeRef.current = 0;
        } else {
          toast.error("No time elapsed to create a split");
          return;
        }
      } else if (splitPausedTimeRef.current > 0) {
        // Use paused time if split timer was paused (e.g., during break)
        const newSplit: SplitEntry = {
          id: `split-${Date.now()}`,
          description: description.trim(),
          category,
          projectId:
            (category === "client" || category === "labs") &&
            projectId &&
            projectId !== "none"
              ? projectId
              : undefined,
          duration: splitPausedTimeRef.current,
          isBreak: false,
        };
        setSplits([...splits, newSplit]);
        // Reset for next split
        splitStartTimeRef.current = Date.now();
        splitPausedTimeRef.current = 0;
      } else {
        toast.error("Split timer not initialized");
        return;
      }
    }

    // Reset form
    setDescription("");
    setCategory("client");
    setProjectId(undefined);
    setShowSplitDialog(false);
    setEditingSplitId(null);

    // Resume timer if it was running before split
    if (!isRunning && !isBreakMode) {
      handleStart();
    }
  };

  // Edit split
  const handleEditSplit = (split: SplitEntry) => {
    setEditingSplitId(split.id);
    setDescription(split.description);
    setCategory(split.category);
    setProjectId(split.projectId);
    setShowSplitDialog(true);
  };

  // Delete split
  const handleDeleteSplit = (splitId: string) => {
    setSplits(splits.filter((split) => split.id !== splitId));
  };

  // Submit all splits
  const handleSubmit = async () => {
    // Filter out breaks and get only work splits
    const workSplits = splits.filter((split) => !split.isBreak);

    if (workSplits.length === 0) {
      toast.error("No work splits to submit");
      return;
    }

    setIsSaving(true);
    setIsRunning(false);

    try {
      // Submit each split as a separate hour registration
      const promises = workSplits.map(async (split) => {
        const hours = getHours(split.duration);
        const response = await fetch("/api/hour-registrations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            description: split.description,
            hours,
            category: split.category,
            projectId:
              (split.category === "client" || split.category === "labs") &&
              split.projectId &&
              split.projectId !== "none"
                ? split.projectId
                : null,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to save split: ${split.description}`);
        }

        return response.json();
      });

      await Promise.all(promises);

      toast.success(
        `Successfully saved ${workSplits.length} hour registration${
          workSplits.length > 1 ? "s" : ""
        }`
      );

      // Reset timer and splits
      setIsRunning(false);
      setElapsedSeconds(0);
      startTimeRef.current = null;
      splitStartTimeRef.current = null;
      breakStartTimeRef.current = null;
      setIsBreakMode(false);
      setSplits([]);
      setDescription("");
      setCategory("client");
      setProjectId(undefined);

      // Trigger refresh of hour registrations table
      window.dispatchEvent(new Event("hour-registration-saved"));
    } catch (error) {
      console.error("Error saving hour registrations:", error);
      toast.error("Failed to save hour registrations. Please try again.");
    } finally {
      setIsSaving(false);
    }
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
    splitStartTimeRef.current = null;
    breakStartTimeRef.current = null;
    splitPausedTimeRef.current = 0;
    setIsBreakMode(false);
    setSplits([]);
    setShowCancelDialog(false);
    setDescription("");
    setCategory("client");
    setProjectId(undefined);
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
      "client_acquisition",
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

  // Close split dialog handler
  const handleCloseSplitDialog = (open: boolean) => {
    if (!open) {
      setShowSplitDialog(false);
      setEditingSplitId(null);
      setDescription("");
      setCategory("client");
      setProjectId(undefined);
      // Resume timer if it was running before opening dialog
      if (!isRunning && !isBreakMode && splitStartTimeRef.current) {
        handleStart();
      }
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

  // Prevent page reload/navigation when timer is running
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isRunning) {
        e.preventDefault();
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

  // Calculate total work time (excluding breaks)
  const totalWorkTime = splits
    .filter((split) => !split.isBreak)
    .reduce((sum, split) => sum + split.duration, 0);

  const categoryLabels: Record<string, string> = {
    client: "Client Work",
    administration: "Administration",
    brainstorming: "Brainstorming",
    research: "Research",
    client_acquisition: "Client Acquisition",
    labs: "EXO Labs",
  };

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
          <div className="flex items-center justify-center gap-2 mb-2">
            {(() => {
              const digits = formatStopwatchDigits(elapsedSeconds);
              return (
                <>
                  {digits.showHours && (
                    <>
                      {digits.hours.map((digit, idx) => (
                        <div
                          key={`hour-${idx}`}
                          className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-4xl font-mono font-bold ${
                            isBreakMode
                              ? "border-orange-500 text-orange-500 bg-orange-500/10"
                              : "border-border bg-muted"
                          }`}
                        >
                          {digit}
                        </div>
                      ))}
                      <span
                        className={`text-4xl font-mono font-bold ${
                          isBreakMode ? "text-orange-500" : ""
                        }`}
                      >
                        :
                      </span>
                    </>
                  )}
                  {digits.minutes.map((digit, idx) => (
                    <div
                      key={`minute-${idx}`}
                      className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-4xl font-mono font-bold ${
                        isBreakMode
                          ? "border-orange-500 text-orange-500 bg-orange-500/10"
                          : "border-border bg-muted"
                      }`}
                    >
                      {digit}
                    </div>
                  ))}
                  <span
                    className={`text-4xl font-mono font-bold ${
                      isBreakMode ? "text-orange-500" : ""
                    }`}
                  >
                    :
                  </span>
                  {digits.seconds.map((digit, idx) => (
                    <div
                      key={`second-${idx}`}
                      className={`w-12 h-16 rounded-lg border-2 flex items-center justify-center text-4xl font-mono font-bold ${
                        isBreakMode
                          ? "border-orange-500 text-orange-500 bg-orange-500/10"
                          : "border-border bg-muted"
                      }`}
                    >
                      {digit}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
          {isBreakMode && (
            <div className="text-center text-sm text-muted-foreground">
              Break Mode
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-center mb-4">
          {!isRunning && elapsedSeconds === 0 ? (
            <Button onClick={handleStart} size="lg" className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          ) : (
            <>
              {isRunning ? (
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
                    onClick={handleSplit}
                    size="lg"
                    variant="outline"
                    className="flex-1"
                    disabled={isBreakMode}
                  >
                    <Split className="h-4 w-4 mr-2" />
                    Split
                  </Button>
                  <Button
                    onClick={handleBreak}
                    size="lg"
                    variant={isBreakMode ? "default" : "outline"}
                    className="flex-1"
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    {isBreakMode ? "End Break" : "Break"}
                  </Button>
                </>
              ) : (
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
                    onClick={handleSplit}
                    size="lg"
                    variant="outline"
                    className="flex-1"
                    disabled={isBreakMode}
                  >
                    <Split className="h-4 w-4 mr-2" />
                    Split
                  </Button>
                  <Button
                    onClick={handleBreak}
                    size="lg"
                    variant={isBreakMode ? "default" : "outline"}
                    className="flex-1"
                  >
                    <Coffee className="h-4 w-4 mr-2" />
                    {isBreakMode ? "End Break" : "Break"}
                  </Button>
                </>
              )}
              <Button
                onClick={handleSubmit}
                size="lg"
                variant="default"
                className="flex-1"
                disabled={splits.filter((s) => !s.isBreak).length === 0}
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

        {/* Splits Table */}
        {splits.length > 0 && (
          <div className="mt-6 border rounded-lg">
            <div className="p-4 border-b">
              <h4 className="font-semibold">Splits</h4>
              <p className="text-sm text-muted-foreground">
                Total work time: {formatTime(totalWorkTime)}
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {splits.map((split) => (
                  <TableRow key={split.id}>
                    <TableCell className="max-w-[300px] truncate">
                      {split.isBreak ? (
                        <span className="text-orange-500">{split.description}</span>
                      ) : (
                        split.description
                      )}
                    </TableCell>
                    <TableCell>
                      {split.isBreak
                        ? "-"
                        : categoryLabels[split.category] || split.category}
                    </TableCell>
                    <TableCell>{formatTime(split.duration)}</TableCell>
                    <TableCell>
                      {!split.isBreak && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditSplit(split)}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSplit(split.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Split Dialog */}
      <Dialog
        open={showSplitDialog}
        onOpenChange={(open) => handleCloseSplitDialog(open)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSplitId ? "Edit Split" : "Add Split"}
            </DialogTitle>
            <DialogDescription>
              {editingSplitId
                ? "Update the description and category for this split."
                : "Describe the work you completed in this split."}
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
                      | "client_acquisition"
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
                  <SelectItem value="client_acquisition">
                    Client Acquisition
                  </SelectItem>
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
                        : category === "client_acquisition"
                          ? "Describe the client acquisition activities..."
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
            <Button variant="outline" onClick={handleCloseSplitDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSplit}
              disabled={!description.trim() && !editingSplitId}
            >
              {editingSplitId ? "Update Split" : "Add Split"}
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
              Are you sure you want to cancel this timer? All progress and
              splits will be lost and no entries will be saved.
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
