"use client";

import { useState } from "react";
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
  title,
  description,
  onSend,
}: SendEmailModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!to?.trim()) {
      toast.error("Vul een e-mailadres in");
      return;
    }
    setIsSending(true);
    try {
      await onSend({
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
      });
      toast.success("E-mail verzonden");
      onOpenChange(false);
      setTo("");
      setSubject("");
      setBody("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Kon e-mail niet verzenden"
      );
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

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="send-to">Aan (e-mail) *</Label>
            <Input
              id="send-to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="klant@voorbeeld.nl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-subject">Onderwerp</Label>
            <Input
              id="send-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Onderwerp van de e-mail"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="send-body">Bericht</Label>
            <Textarea
              id="send-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Optioneel: pas het bericht aan..."
              rows={6}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verzenden...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Verstuur
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
