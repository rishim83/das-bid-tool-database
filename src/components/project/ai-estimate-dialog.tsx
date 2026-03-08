"use client";

import { useState } from "react";
import type { Project, TechnologyConfig, ColoSite } from "@/types";
import { v4 as uuid } from "uuid";
import { getDefaultRFItems, createDefaultTechnology } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIEstimateResponse {
  projectName?: string;
  client?: string;
  coloSites?: Array<{ id: string; name: string }>;
  technologies?: {
    DAS?: TechEstimate;
    PUBLIC_SAFETY?: TechEstimate;
    ROIP?: TechEstimate;
  };
  assumptions?: string[];
  notes?: string;
}

interface TechEstimate {
  rfLineItems?: Array<{ description: string; values: Record<string, number> }>;
  installLaborHours?: Record<string, number>;
  equipmentCost?: Record<string, number>;
  pmTrips?: Record<string, number>;
}

interface Props {
  project: Project;
  onApply: (updates: {
    name?: string;
    client?: string;
    coloSites?: ColoSite[];
    technologies?: TechnologyConfig[];
  }) => void;
}

export function AIEstimateDialog({ project, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIEstimateResponse | null>(null);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/ai/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate estimate");
      }

      const data: AIEstimateResponse = await res.json();
      setResult(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate estimate"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!result) return;

    const updates: {
      name?: string;
      client?: string;
      coloSites?: ColoSite[];
      technologies?: TechnologyConfig[];
    } = {};

    if (result.projectName) updates.name = result.projectName;
    if (result.client) updates.client = result.client;

    // Map COLO sites
    if (result.coloSites && result.coloSites.length > 0) {
      updates.coloSites = result.coloSites.map((s) => ({
        id: s.id,
        name: s.name,
      }));
    }

    // Map technologies
    if (result.technologies) {
      const techTypes = ["DAS", "PUBLIC_SAFETY", "ROIP"] as const;
      updates.technologies = techTypes.map((type) => {
        const existing = project.technologies.find((t) => t.type === type);
        const aiTech = result.technologies?.[type];

        if (!aiTech) {
          return existing || { ...createDefaultTechnology(type), enabled: false };
        }

        // Build RF line items from AI response
        let rfLineItems = getDefaultRFItems(type);
        if (aiTech.rfLineItems && aiTech.rfLineItems.length > 0) {
          rfLineItems = aiTech.rfLineItems.map((item) => ({
            id: uuid(),
            description: item.description,
            values: item.values || {},
          }));
        }

        return {
          ...(existing || createDefaultTechnology(type)),
          enabled: true,
          rfLineItems,
          installLaborHours: aiTech.installLaborHours || {},
          equipmentCost: aiTech.equipmentCost || {},
          pmTrips: aiTech.pmTrips || {},
        };
      });
    }

    onApply(updates);
    toast.success("AI estimate applied to project");
    setOpen(false);
    setResult(null);
    setDescription("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-colors">
          <Sparkles className="h-3 w-3 mr-1" /> AI Estimate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI-Powered Estimate
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Describe the project and AI will generate cost estimates for all
              applicable technologies, COLO sites, and line items.
            </p>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., 12-story hospital in downtown Chicago needs DAS and Public Safety coverage. 3 COLO locations. Building is approximately 450,000 sq ft with 2 basement levels. Carrier requirements: AT&T, Verizon, T-Mobile..."
              rows={4}
              disabled={loading}
              className="text-sm"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={loading || !description.trim()}
            size="sm"
            className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Generating estimate...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3 mr-1.5" />
                Generate Estimate
              </>
            )}
          </Button>

          {/* Results Preview */}
          {result && (
            <div className="border border-primary/20 rounded-lg overflow-hidden card-glow-blue">
              <div className="px-3 py-2 border-b border-primary/15 header-gradient-accent">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-primary/80">Generated Estimate</h3>
              </div>
              <div className="p-3 space-y-2.5">
                {result.projectName && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Project:</span>{" "}
                    <span className="font-medium">{result.projectName}</span>
                  </div>
                )}

                {result.coloSites && result.coloSites.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">COLO Sites:</span>{" "}
                    <span className="font-medium">{result.coloSites.map((s) => s.name).join(", ")}</span>
                  </div>
                )}

                {result.technologies && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Technologies:</span>{" "}
                    <span className="font-medium">
                      {[
                        result.technologies.DAS && "DAS",
                        result.technologies.PUBLIC_SAFETY && "Public Safety",
                        result.technologies.ROIP && "ROIP",
                      ].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}

                {result.assumptions && result.assumptions.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground block mb-1">Assumptions:</span>
                    <ul className="list-disc list-inside ml-1 space-y-0.5 text-muted-foreground">
                      {result.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.notes && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Notes:</span>{" "}
                    {result.notes}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button onClick={handleApply} size="sm" className="flex-1 h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                    Apply to Project
                  </Button>
                  <Button
                    onClick={() => setResult(null)}
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                  >
                    Discard
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
