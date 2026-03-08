"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Database, Trash2, Search, CheckCircle2 } from "lucide-react";
import { loadDatabase, saveDatabase, clearDatabase, parseDatabase } from "@/lib/database";
import type { PartsDatabase } from "@/types";
import { toast } from "sonner";

type Step = "idle" | "parsing" | "preview";

export default function DatabasePage() {
  const [db, setDb] = useState<PartsDatabase | null>(null);
  const [search, setSearch] = useState("");
  const [showLaborCodes, setShowLaborCodes] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<PartsDatabase | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDb(loadDatabase());
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    setStep("parsing");
    setPreview(null);

    try {
      const parsed = await parseDatabase(file);

      if (parsed.entries.length === 0) {
        throw new Error("No parts could be extracted. Check that the file has a Part Number column.");
      }

      setPreview(parsed);
      setStep("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process file");
      setStep("idle");
    }
  };

  const handleConfirm = () => {
    if (!preview) return;
    saveDatabase(preview);
    setDb(preview);
    setPreview(null);
    setStep("idle");
    toast.success(
      `Database saved — ${preview.entries.length} parts, ${preview.laborCodes.length} labor codes`
    );
  };

  const handleDiscard = () => {
    setPreview(null);
    setStep("idle");
  };

  const handleClear = () => {
    if (!confirm("Clear the parts database? This cannot be undone.")) return;
    clearDatabase();
    setDb(null);
    setStep("idle");
    toast.success("Database cleared");
  };

  const activeDb = preview ?? db;
  const filtered =
    activeDb?.entries.filter(
      (e) =>
        !search ||
        e.partNumber.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.laborCode.toLowerCase().includes(search.toLowerCase())
    ) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
              </Button>
            </Link>
            <div className="h-4 w-px bg-border" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Parts Database</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Master pricing and labor hours reference
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {db && step === "idle" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={handleClear}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
              </Button>
            )}
            {step !== "parsing" && step !== "preview" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-1.5" />
                {db ? "Re-upload" : "Upload Database"}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* ── Parsing state ────────────────────────────────────────── */}
        {step === "parsing" && (
          <div className="border border-border/60 rounded-lg py-16 flex flex-col items-center text-center bg-card/30">
            <Database className="h-6 w-6 text-primary/60 mb-3 animate-pulse" />
            <p className="text-sm font-medium mb-1">Reading file…</p>
            <p className="text-xs text-muted-foreground">
              Parsing parts and labor codes
            </p>
          </div>
        )}

        {/* ── Preview confirm banner ──────────────────────────────── */}
        {step === "preview" && preview && (
          <div className="border border-primary/30 rounded-lg px-4 py-3 bg-primary/5 mb-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-xs">
              <CheckCircle2 className="h-4 w-4 text-primary/70 shrink-0" />
              <div>
                <span className="font-medium text-foreground">
                  {preview.entries.length} parts loaded
                </span>
                <span className="text-muted-foreground ml-2">
                  · {preview.entries.filter((e) => e.equipmentUnitPrice > 0).length} with pricing
                  · {preview.entries.filter((e) => e.laborHoursPerUnit > 0).length} with labor hours
                  · {preview.laborCodes.length} labor codes
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleDiscard}>
                Discard
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleConfirm}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Save Database
              </Button>
            </div>
          </div>
        )}

        {/* ── Saved status bar ────────────────────────────────────── */}
        {step === "idle" && db && (
          <div className="border border-border/60 rounded-lg px-4 py-2.5 bg-card/50 mb-5 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary/60" />
              <span className="font-medium text-foreground">{db.fileName}</span>
            </div>
            <span>{db.entries.length} parts</span>
            <span>{db.laborCodes.length} labor codes</span>
            <span>Saved {new Date(db.uploadedAt).toLocaleDateString()}</span>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────── */}
        {step === "idle" && !db && (
          <div className="border border-dashed border-border/50 rounded-lg py-16 flex flex-col items-center text-center">
            <Database className="h-8 w-8 text-muted-foreground/20 mb-4" />
            <p className="text-sm text-muted-foreground mb-1">No parts database loaded</p>
            <p className="text-xs text-muted-foreground/60 mb-5 max-w-sm">
              Upload your master Excel file. Expected format: BOM sheet (Part Number, Install Codes,
              Material Unit Price) + Labor sheet (CODE, Task, Hours).
            </p>
            <Button size="sm" className="h-8 text-xs" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5 mr-1.5" /> Upload Database (.xlsx)
            </Button>
          </div>
        )}

        {/* ── Parts table (preview or saved) ──────────────────────── */}
        {activeDb && step !== "parsing" && (
          <div className="space-y-5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by part number, description, or labor code…"
                className="h-8 text-sm pl-8"
              />
            </div>

            <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
              <div className="px-3 py-2 border-b border-border/50 bg-muted/30 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Parts — {filtered.length}{search ? ` of ${activeDb.entries.length}` : ""}
                  {step === "preview" && (
                    <span className="ml-2 text-primary/70 normal-case font-normal tracking-normal">
                      · preview only, not yet saved
                    </span>
                  )}
                </span>
              </div>
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-border/60 bg-muted/60 backdrop-blur-sm">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Part Number</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Unit Price</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Install Code(s)</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Labor Hrs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((entry, i) => (
                      <tr
                        key={entry.partNumber + i}
                        className={`border-b border-border/30 last:border-0 ${i % 2 ? "bg-muted/10" : ""}`}
                      >
                        <td className="px-3 py-1.5 font-mono text-primary/80">{entry.partNumber}</td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[240px] truncate">
                          {entry.description || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {entry.equipmentUnitPrice > 0 ? `$${entry.equipmentUnitPrice.toFixed(2)}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground font-mono">
                          {entry.laborCode || "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono">
                          {entry.laborHoursPerUnit > 0 ? entry.laborHoursPerUnit : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No parts match your search.
                  </div>
                )}
              </div>
            </div>

            {/* Labor codes (collapsible) */}
            {activeDb.laborCodes.length > 0 && (
              <div>
                <button
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5 hover:text-foreground transition-colors"
                  onClick={() => setShowLaborCodes((v) => !v)}
                >
                  Labor Codes ({activeDb.laborCodes.length}){" "}
                  <span className="text-muted-foreground/50">{showLaborCodes ? "▲" : "▼"}</span>
                </button>
                {showLaborCodes && (
                  <div className="border border-border/60 rounded-lg overflow-hidden card-elevated bg-card">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/30">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Code</th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">Task</th>
                            <th className="text-right px-3 py-2 font-medium text-muted-foreground">Hours / Unit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeDb.laborCodes.map((lc, i) => (
                            <tr
                              key={lc.code + i}
                              className={`border-b border-border/30 last:border-0 ${i % 2 ? "bg-muted/10" : ""}`}
                            >
                              <td className="px-3 py-1.5 font-mono text-primary/80">{lc.code}</td>
                              <td className="px-3 py-1.5 text-muted-foreground">{lc.description || "—"}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{lc.hoursPerUnit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
