"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import SignatureCanvas from "react-signature-canvas";
import { FileText, Download, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ContractData {
  contract: {
    id: string;
    name: string;
    type: string;
    fileUrl: string | null;
    signed: boolean;
    signedAt: string | null;
    signature: string | null;
    createdAt: string;
  };
  project: {
    id: string;
    title: string;
  };
  organization: {
    id: string;
    name: string;
  };
  signedByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

export default function ContractPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.id as string;
  const [contract, setContract] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [canSign, setCanSign] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    fetchContract();
    checkCanSign();
  }, [contractId]);

  const fetchContract = async () => {
    try {
      const response = await fetch(`/api/contracts/${contractId}`);
      if (response.ok) {
        const data = await response.json();
        setContract(data);
      } else {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        toast.error(errorData.error || "Failed to load contract");
        router.push("/dashboard/contracts");
      }
    } catch (error) {
      console.error("Error fetching contract:", error);
      toast.error("Failed to load contract");
      router.push("/dashboard/contracts");
    } finally {
      setLoading(false);
    }
  };

  const checkCanSign = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        // Check if user can sign (they should be able to if they're in the organization)
        setCanSign(true);
      }
    } catch (error) {
      console.error("Error checking sign permission:", error);
    }
  };

  const handleSign = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast.error("Please provide a signature");
      return;
    }

    setSigning(true);
    try {
      const signatureData = signatureRef.current.toDataURL();

      const response = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature: signatureData }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sign contract");
      }

      toast.success("Contract signed successfully!");
      fetchContract(); // Refresh contract data
    } catch (error) {
      console.error("Error signing contract:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to sign contract"
      );
    } finally {
      setSigning(false);
    }
  };

  const handleClear = () => {
    signatureRef.current?.clear();
  };

  const handleDownload = async () => {
    if (!contract) return;

    try {
      const response = await fetch(
        `/api/contracts/${contract.contract.id}/download`
      );
      if (!response.ok) {
        throw new Error("Failed to download contract");
      }

      if (response.redirected) {
        window.open(response.url, "_blank");
        toast.success("Contract opened");
      } else {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${contract.contract.name}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("Contract downloaded successfully");
      }
    } catch (error) {
      console.error("Error downloading contract:", error);
      toast.error("Failed to download contract");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!contract) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">{contract.contract.name}</h1>
            <p className="text-muted-foreground mt-1">
              Project: {contract.project.title} • {contract.organization.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {contract.contract.signed ? (
              <Badge className="bg-green-500">
                <Check className="h-4 w-4 mr-1" />
                Signed
              </Badge>
            ) : (
              <Badge variant="secondary">Pending Signature</Badge>
            )}
            <Button variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6 mb-6">
        {contract.contract.fileUrl ? (
          <iframe
            src={contract.contract.fileUrl}
            className="w-full h-[600px] border rounded"
            title={contract.contract.name}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No contract file available</p>
          </div>
        )}
      </div>

      {contract.contract.signed ? (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Check className="h-6 w-6 text-green-600 dark:text-green-400 mt-1" />
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-100 mb-1">
                Contract Signed
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                This contract was signed on{" "}
                {new Date(contract.contract.signedAt!).toLocaleDateString(
                  "en-US",
                  {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  }
                )}
                {contract.signedByUser && (
                  <>
                    {" "}
                    by{" "}
                    {contract.signedByUser.name || contract.signedByUser.email}
                  </>
                )}
              </p>
              {contract.contract.signature && (
                <div className="mt-4">
                  <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                    Signature:
                  </p>
                  <img
                    src={contract.contract.signature}
                    alt="Signature"
                    className="border border-green-200 dark:border-green-800 rounded bg-white p-2"
                    style={{ maxWidth: "300px" }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        canSign && (
          <div className="bg-card border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Sign Contract</h2>
            <p className="text-muted-foreground mb-4">
              Please sign the contract using the signature pad below.
            </p>

            <div className="border-2 border-dashed rounded-lg p-4 mb-4 bg-white dark:bg-gray-900">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: "w-full h-48 border rounded",
                }}
                backgroundColor="transparent"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSign} disabled={signing}>
                {signing ? "Signing..." : "Sign Contract"}
              </Button>
              <Button variant="outline" onClick={handleClear}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  );
}




