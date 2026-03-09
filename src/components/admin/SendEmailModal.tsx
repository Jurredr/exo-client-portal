"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

interface SendEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  offerId?: string;
  title: string;
  description: string;
  onSend: (data: {
    to: string;
    subject: string;
    body: string;
  }) => Promise<void>;
}

export function SendEmailModal({
  open,
  onOpenChange,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  offerId,
  title,
  description,
  onSend,
}: SendEmailModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  useEffect(() => {
    if (open && offerId) {
      setIsLoadingContext(true);
      fetch(`/api/offers/${offerId}/send-context`)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load");
          return res.json();
        })
        .then((data) => {
          setTo(data.defaultTo ?? "");
          setSubject(data.defaultSubject ?? "");
          setBody(data.defaultBody ?? "");
        })
        .catch(() => {
          toast.error("Failed to load email context");
        })
        .finally(() => {
          setIsLoadingContext(false);
        });
    }
  }, [open, offerId]);

  useEffect(() => {
    if (open && !offerId) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
  }, [open, offerId, defaultTo, defaultSubject, defaultBody]);

  const handleSend = async () => {
    if (!to?.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    setIsSending(true);
    try {
      await onSend({
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      toast.success("Email sent");
      onOpenChange(false);
      setTo("");
      setSubject("");
      setBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody(defaultBody);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isLoadingContext ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="send-to">To (email) *</Label>
              <Input
                id="send-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-subject">Subject</Label>
              <Input
                id="send-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-body">Message</Label>
              <Textarea
                id="send-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Optional: edit the message..."
                rows={6}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoadingContext}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending || isLoadingContext}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
