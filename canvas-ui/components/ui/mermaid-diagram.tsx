"use client";

import * as React from "react";
import mermaid from "mermaid";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AlertCircle, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nanoid } from "nanoid";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

/**
 * Renders a Mermaid diagram from chart definition
 */
export function MermaidDiagram({ chart, className }: MermaidDiagramProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = React.useRef<HTMLDivElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [, setRenderedSvg] = React.useState<string>("");
  const [fullscreenId] = React.useState(() => `mermaid-fullscreen-${nanoid(8)}`);

  React.useEffect(() => {
    if (!isInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: "default",
        securityLevel: "strict", // Changed from "loose" to prevent XSS
        fontFamily: "inherit",
      });
      setIsInitialized(true);
    }
  }, [isInitialized]);

  React.useEffect(() => {
    if (!containerRef.current || !isInitialized) return;

    const renderDiagram = async (): Promise<void> => {
      try {
        setError(null);

        // Basic validation before attempting to render
        if (!chart || chart.trim().length === 0) {
          setError("Empty diagram definition");
          return;
        }

        const id = `mermaid-${nanoid(8)}`;

        // Clear previous content
        if (containerRef.current) {
          containerRef.current.innerHTML = "";
        }

        // Validate chart syntax by attempting to parse
        const { svg } = await mermaid.render(id, chart);

        // Store rendered SVG for fullscreen view
        setRenderedSvg(svg);

        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        console.error("Chart content:", chart);

        // Provide more helpful error messages
        let errorMessage = "Failed to render diagram";

        if (err instanceof Error) {
          if (err.message.includes("Syntax error")) {
            errorMessage = "Invalid diagram syntax. The AI generated an incorrect Mermaid diagram.";
          } else if (err.message.includes("Parse error")) {
            errorMessage = "Diagram parsing error. Please try regenerating the canvas.";
          } else {
            errorMessage = err.message;
          }
        }

        setError(errorMessage);
      }
    };

    renderDiagram();
  }, [chart, isInitialized]);

  // Render diagram in fullscreen when dialog opens
  React.useEffect(() => {
    if (!isFullscreen || !chart) return;

    // Small delay to ensure the dialog DOM is ready
    const timer = setTimeout(async () => {
      if (!fullscreenContainerRef.current) return;

      try {
        // Clear previous content
        fullscreenContainerRef.current.innerHTML = "";

        // Re-render the diagram specifically for fullscreen
        const { svg } = await mermaid.render(fullscreenId, chart);

        if (fullscreenContainerRef.current) {
          fullscreenContainerRef.current.innerHTML = svg;

          // Ensure the SVG is visible and scaled properly
          const svgElement = fullscreenContainerRef.current.querySelector('svg');
          if (svgElement) {
            svgElement.style.maxWidth = '100%';
            svgElement.style.height = 'auto';
          }
        }
      } catch (err) {
        console.error("Error rendering fullscreen diagram:", err);
        if (fullscreenContainerRef.current) {
          // SECURITY: Use textContent instead of innerHTML to prevent XSS from error messages
          while (fullscreenContainerRef.current.firstChild) {
            fullscreenContainerRef.current.removeChild(fullscreenContainerRef.current.firstChild);
          }
          const errorDiv = document.createElement('div');
          errorDiv.className = 'text-destructive p-4';
          errorDiv.textContent = `Failed to render diagram: ${err instanceof Error ? err.message : 'Unknown error'}`;
          fullscreenContainerRef.current.appendChild(errorDiv);
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isFullscreen, chart, fullscreenId]);

  if (error) {
    return (
      <Card className={className}>
        <div className="flex items-center gap-2 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to render diagram: {error}</span>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <div className="relative group">
          <div
            ref={containerRef}
            className="flex items-center justify-center p-4 overflow-x-auto"
          />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
            onClick={() => setIsFullscreen(true)}
            title="Expand to fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-8">
          <VisuallyHidden>
            <DialogTitle>Diagram Fullscreen View</DialogTitle>
            <DialogDescription>
              Expanded view of the Mermaid diagram for better visibility
            </DialogDescription>
          </VisuallyHidden>
          <div
            ref={fullscreenContainerRef}
            className="w-full flex items-center justify-center overflow-auto"
            style={{ minHeight: "60vh", minWidth: "60vw" }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
