"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Paperclip, ArrowUp, Loader2, FileText, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
  ItemMedia,
} from "@/components/ui/item";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/stores/canvas-store";
import { CanvasLoading } from "@/components/canvas/canvas-loading";
import { AdaptiveConversation } from "@/components/canvas/AdaptiveConversation";
import type { ResearchReport } from "@/lib/validators/canvas-schema";

/**
 * Attempts to repair truncated or malformed JSON
 * Handles cases where the AI output was cut off mid-stream
 */
function repairTruncatedJson(jsonText: string): string {
  let fixed = jsonText.trim();

  // Remove any trailing incomplete content after the last complete field
  // Look for patterns like: "fieldname": { ... } or "fieldname": "..." or "fieldname": [...]

  // First, remove trailing commas
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  fixed = fixed.replace(/,\s*$/, '');

  // Count open/close braces and brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
    }
  }

  // If we're inside an unclosed string, try to close it
  if (inString) {
    // Find the last quote and truncate after a reasonable point
    const lastQuoteIndex = fixed.lastIndexOf('"');
    if (lastQuoteIndex > 0) {
      // Check if there's content after the last quote that looks like it was cut off
      const afterQuote = fixed.substring(lastQuoteIndex + 1);
      if (!afterQuote.match(/^\s*[,}\]]/)) {
        // Likely truncated mid-string, close the string
        fixed = fixed + '"';
        inString = false;
      }
    }
  }

  // Re-count after potential string fix
  braceCount = 0;
  bracketCount = 0;
  inString = false;
  escapeNext = false;

  for (let i = 0; i < fixed.length; i++) {
    const char = fixed[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
    }
  }

  // Close any unclosed brackets first, then braces
  while (bracketCount > 0) {
    fixed += ']';
    bracketCount--;
  }

  while (braceCount > 0) {
    fixed += '}';
    braceCount--;
  }

  // Final cleanup - remove any trailing commas that might have been left
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  return fixed;
}

/**
 * Canvas creation page with problem intake form
 */
export default function CreateCanvasPage(): React.ReactElement {
  const router = useRouter();
  const { setCurrentCanvas, setGenerating } = useCanvasStore();
  const [isLoading, setIsLoading] = React.useState(false);
  const [problemStatement, setProblemStatement] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [streamPreview, setStreamPreview] = React.useState("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [contextualInfo, setContextualInfo] = React.useState("");
  const [contextQuestions, setContextQuestions] = React.useState<{
    needsMoreContext: boolean;
    confidence: number;
    missingContext: string[];
    questions: Array<{ question: string; category: string; priority: string }>;
  } | null>(null);
  const [uploadedFileIds, setUploadedFileIds] = React.useState<string[]>([]); // Track uploaded document IDs
  const [useResearch, setUseResearch] = React.useState(false);
  const [researchResult, setResearchResult] = React.useState<ResearchReport | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleDragEnter = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isLoading) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      // Filter for supported file types
      const supportedFiles = droppedFiles.filter((file) => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        return ["txt", "md", "pdf", "doc", "docx"].includes(ext || "");
      });

      // Add all supported files to the list (same as clicking paperclip button)
      if (supportedFiles.length > 0) {
        setFiles((prev) => [...prev, ...supportedFiles]);
      }
    }
  };

  const handleRemoveFile = (index: number): void => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (_file: File): React.ReactNode => {
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleSubmit = async (skipValidation: boolean = false, overrideContext?: string): Promise<void> => {
    if (!problemStatement.trim()) return;

    setIsLoading(true);
    setStreamPreview("");
    let researchToUse: ResearchReport | undefined = useResearch ? researchResult || undefined : undefined;

    try {
      // Upload files and get document IDs
      const fileIds: string[] = [];
      if (files.length > 0) {
        setStreamPreview("Uploading and processing documents...");

        for (const file of files) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("canvasId", ""); // Canvas doesn't exist yet, will be null

            const uploadResponse = await fetch("/api/canvas/documents/upload", {
              method: "POST",
              body: formData,
            });

            if (!uploadResponse.ok) {
              const error = await uploadResponse.json();
              throw new Error(error.error || "Failed to upload document");
            }

            const uploadResult = await uploadResponse.json();
            fileIds.push(uploadResult.documentId);

            console.log(`✅ Uploaded ${file.name}: ${uploadResult.chunksCreated} chunks created`);
          } catch (uploadError) {
            console.error(`Failed to upload ${file.name}:`, uploadError);
            alert(`Failed to upload ${file.name}. Continuing without this document.`);
          }
        }

        console.log(`📎 Processed ${fileIds.length}/${files.length} documents`);

        // Store uploaded file IDs for later use in adaptive conversation
        setUploadedFileIds(fileIds);
      }

      const effectiveContext = overrideContext !== undefined ? overrideContext : contextualInfo;

      // First, validate context sufficiency (unless skipping)
      if (!skipValidation) {
        const contextCheck = await fetch("/api/canvas/validate-context", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            problemStatement,
            contextualInfo: effectiveContext,
            uploadedFiles: fileIds,
          }),
        });

        const contextResult = await contextCheck.json();

        if (contextResult.needsMoreContext) {
          // Show context gathering UI
          setContextQuestions(contextResult);
          setIsLoading(false);
          return;
        }
      }

      // Optionally run research to seed generation and research tab
      if (useResearch) {
        setStreamPreview("Running research on your problem and documents...");
        try {
          const researchResponse = await fetch("/api/canvas/research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              problemStatement,
              industry: "",
              objectives: "",
              targetMarket: "",
              uploadedFiles: fileIds,
            }),
          });

          if (researchResponse.ok) {
            const researchPayload = await researchResponse.json();
            researchToUse = researchPayload.research as ResearchReport;
            setResearchResult(researchToUse);
            console.log("✅ Research ready for generation");
          } else {
            const errorText = await researchResponse.text();
            console.error("Research generation failed:", errorText);
          }
        } catch (researchError) {
          console.error("Research generation error:", researchError);
          // Continue without research if it fails
        }
      }

      // Context is sufficient - proceed with generation
      setGenerating(true);

      // Stream canvas generation
      const response = await fetch("/api/canvas/generate-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          problemStatement,
          contextualInfo: effectiveContext,
          uploadedFiles: fileIds,
          research: researchToUse,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate canvas");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedJson = "";

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.error) {
              throw new Error(data.error);
            }

            if (data.progress) {
              // Handle progress messages from tool calling phase
              setStreamPreview(data.progress);
            }

            if (data.chunk) {
              accumulatedJson += data.chunk;

              // Extract meaningful preview from the stream
              // Try to find the most recent readable content
              let preview = "";

              // Look for the last complete field value in the stream
              // This regex finds all "value":"content" patterns and takes the last one
              const valueMatches = [...accumulatedJson.matchAll(/"value"\s*:\s*"([^"]{10,})"/g)];
              if (valueMatches.length > 0) {
                // Get the last match (most recent content)
                const lastMatch = valueMatches[valueMatches.length - 1];
                preview = lastMatch[1].substring(0, 180);
              }

              // If no value found yet, try to extract any meaningful text
              if (!preview) {
                // Look for field names to show progress
                const fields = [];
                if (accumulatedJson.includes('"title"')) fields.push("Title");
                if (accumulatedJson.includes('"problemStatement"')) fields.push("Problem");
                if (accumulatedJson.includes('"objectives"')) fields.push("Objectives");
                if (accumulatedJson.includes('"kpis"')) fields.push("KPIs");
                if (accumulatedJson.includes('"keyFeatures"')) fields.push("Features");

                if (fields.length > 0) {
                  preview = `Generating ${fields[fields.length - 1]}...`;
                } else {
                  preview = `Analyzing problem statement...`;
                }
              }

              setStreamPreview(preview);
            }

            if (data.done) {
              console.log(`📊 Stream complete. Accumulated ${accumulatedJson.length} characters`);

              // Extract JSON from response (handle markdown code blocks)
              let jsonText = accumulatedJson.trim();

              if (!jsonText) {
                console.error("❌ No JSON accumulated from stream!");
                throw new Error("No data received from stream");
              }

              // Remove markdown code blocks if present
              const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
              if (jsonMatch) {
                jsonText = jsonMatch[1];
              } else if (jsonText.startsWith("```")) {
                jsonText = jsonText.replace(/```(?:json)?\n?/g, "").trim();
              }

              // Find JSON object if wrapped in other text
              const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
              if (jsonObjectMatch) {
                jsonText = jsonObjectMatch[0];
              }

              // Attempt to fix common JSON errors
              try {
                // Try parsing as-is first
                const canvas = JSON.parse(jsonText);

                if (researchToUse && !canvas.research) {
                  canvas.research = {
                    ...researchToUse,
                    generatedAt: researchToUse.generatedAt || new Date().toISOString(),
                  };
                }

                // Add uploaded file IDs to canvas for proper cleanup on deletion
                if (fileIds.length > 0) {
                  canvas.uploadedFiles = fileIds;
                }

                // Save to store and database
                const saveResponse = await fetch("/api/canvas/save", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify(canvas),
                });

                if (!saveResponse.ok) {
                  throw new Error("Failed to save canvas");
                }

                const savedCanvas = await saveResponse.json();
                setCurrentCanvas(savedCanvas);

                // Navigate to canvas view
                router.push(`/canvas/${savedCanvas.id}`);
              } catch (parseError) {
                console.error("❌ JSON Parse Error:", parseError);
                console.error("📄 Attempted JSON (first 500 chars):", jsonText.substring(0, 500));
                console.error("📄 Attempted JSON (last 500 chars):", jsonText.substring(Math.max(0, jsonText.length - 500)));

                // Try to auto-fix truncated/malformed JSON
                const fixedJson = repairTruncatedJson(jsonText);
                console.log("🔧 Attempting JSON repair...");

                // Try parsing the fixed version
                try {
                  const canvas = JSON.parse(fixedJson);
                  console.log("✅ Fixed JSON and parsed successfully");

                  if (researchToUse && !canvas.research) {
                    canvas.research = {
                      ...researchToUse,
                      generatedAt: researchToUse.generatedAt || new Date().toISOString(),
                    };
                  }

                  // Add uploaded file IDs to canvas for proper cleanup on deletion
                  if (fileIds.length > 0) {
                    canvas.uploadedFiles = fileIds;
                  }

                  // Save to store and database
                  const saveResponse = await fetch("/api/canvas/save", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify(canvas),
                  });

                  if (!saveResponse.ok) {
                    throw new Error("Failed to save canvas");
                  }

                  const savedCanvas = await saveResponse.json();
                  setCurrentCanvas(savedCanvas);

                  // Navigate to canvas view
                  router.push(`/canvas/${savedCanvas.id}`);
                } catch (repairError) {
                  console.error("❌ Could not fix JSON automatically");
                  console.error("🔧 Repair attempt failed:", repairError);
                  console.error("📄 Repaired JSON (last 200 chars):", fixedJson.substring(Math.max(0, fixedJson.length - 200)));
                  throw new Error(`Invalid JSON from model: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. The AI response may have been truncated.`);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error generating canvas:", error);
      alert("Failed to generate canvas. Please try again.");
    } finally {
      setIsLoading(false);
      setGenerating(false);
      setStreamPreview("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleContextSkip = (): void => {
    // User wants to proceed anyway - skip validation and generate with current context
    setContextQuestions(null);
    handleSubmit(true);
  };

  return (
    <div className="flex h-full flex-col">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex h-full flex-col"
          >
            <CanvasLoading streamPreview={streamPreview} />
          </motion.div>
        ) : (
          <motion.div
            key="input"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="flex h-full flex-col"
          >
            {/* Centered content */}
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="text-center space-y-2 max-w-2xl">
                <h1 className="text-4xl font-bold tracking-tight">
                  Create Business Canvas
                </h1>
                <p className="text-lg text-muted-foreground">
                  Describe your problem or opportunity, and our AI will help you create a comprehensive business canvas
                </p>
              </div>
            </div>

            {/* Input at bottom */}
            <div
              className="border-t bg-background p-6"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="container mx-auto max-w-4xl space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="use-research"
                      checked={useResearch}
                      onCheckedChange={setUseResearch}
                      disabled={isLoading}
                    />
                    <Label htmlFor="use-research" className="text-sm font-medium">
                      Research
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground text-right">
                    Auto-run Tavily + internal docs to seed your first canvas and prefill the Research tab.
                  </p>
                </div>
                {/* Adaptive conversational context gathering UI */}
                {contextQuestions && (
                  <AdaptiveConversation
                    initialProblem={problemStatement}
                    uploadedFiles={uploadedFileIds}
                    onComplete={(contextInfo) => {
                      // Use the enhanced context
                      setContextualInfo(contextInfo);
                      setContextQuestions(null);
                      // Skip validation and proceed
                      handleSubmit(true, contextInfo);
                    }}
                    onSkip={handleContextSkip}
                  />
                )}
                {!contextQuestions && files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <Item key={index} size="sm">
                        <ItemMedia variant="icon">{getFileIcon(file)}</ItemMedia>
                        <ItemContent>
                          <ItemTitle>{file.name}</ItemTitle>
                          <ItemDescription>
                            {file.type || "Unknown"} • {formatFileSize(file.size)}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleRemoveFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </ItemActions>
                      </Item>
                    ))}
                  </div>
                )}
                {/* Hide input when conversational UI is active */}
                {!contextQuestions && (
                  <InputGroup className={isDragging ? "ring-2 ring-primary ring-offset-2" : ""}>
                    <InputGroupTextarea
                      placeholder="Describe your problem or opportunity..."
                      value={problemStatement}
                      onChange={(e) => setProblemStatement(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onDragEnter={handleDragEnter}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      disabled={isLoading}
                      rows={3}
                    />
                    <InputGroupAddon align="inline-end">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.txt,.md"
                    />
                    <InputGroupButton
                      size="icon-sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                    >
                      <Paperclip className="h-4 w-4" />
                    </InputGroupButton>
                    <InputGroupButton
                      size="icon-sm"
                      onClick={() => handleSubmit()}
                      disabled={isLoading || !problemStatement.trim()}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                  </InputGroup>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
