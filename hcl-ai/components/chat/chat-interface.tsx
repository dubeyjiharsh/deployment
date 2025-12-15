"use client";

import * as React from "react";
import { Send, Loader2, Paperclip, X, FileText, Image as ImageIcon, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LearningInsights } from "@/components/canvas/learning-insights";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatAttachment } from "@/lib/validators/canvas-schema";
import { nanoid } from "nanoid";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, attachments?: ChatAttachment[]) => Promise<void>;
  isLoading?: boolean;
  fieldName?: string;
  fieldKey?: string;
  placeholder?: string;
}

/**
 * Chat interface for refining canvas fields
 */
export function ChatInterface({
  messages,
  onSendMessage,
  isLoading = false,
  fieldName,
  fieldKey,
  placeholder = "Ask a question or request refinements...",
}: ChatInterfaceProps): React.ReactElement {
  const [input, setInput] = React.useState("");
  const [attachments, setAttachments] = React.useState<ChatAttachment[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ChatAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      try {
        // Read file content
        const content = await readFileAsBase64(file);

        const attachment: ChatAttachment = {
          id: nanoid(),
          name: file.name,
          type: file.type,
          size: file.size,
          content,
        };

        newAttachments.push(attachment);
      } catch (error) {
        console.error(`Failed to read file ${file.name}:`, error);
        alert(`Failed to read file ${file.name}`);
      }
    }

    setAttachments([...attachments, ...newAttachments]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix to get just the base64 content
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (id: string): void => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const messageText = input.trim() || "Attached files for context";
    const messageAttachments = attachments.length > 0 ? attachments : undefined;

    setInput("");
    setAttachments([]);

    await onSendMessage(messageText, messageAttachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (suggestion: string): void => {
    setInput(suggestion);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.includes('text') || type.includes('pdf')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  /**
   * Renders message content with special handling for JSON blocks
   * JSON blocks are hidden from the user - they're only for system processing
   */
  const renderMessageContent = (content: string) => {
    // Check if the message contains a JSON code block (```json ... ``` or ``` ... ```)
    const jsonBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);

    if (jsonBlockMatch) {
      const beforeJson = content.substring(0, jsonBlockMatch.index).trim();
      const afterJson = content.substring((jsonBlockMatch.index || 0) + jsonBlockMatch[0].length).trim();
      const jsonString = jsonBlockMatch[1];

      try {
        // Parse the JSON to display it nicely
        const parsed = JSON.parse(jsonString);

        // Show a nice UI representation instead of raw JSON
        return (
          <div className="space-y-3">
            {beforeJson && <p className="text-sm whitespace-pre-wrap leading-relaxed">{beforeJson}</p>}

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Badge variant="default" className="text-xs">Applying Changes</Badge>
              </div>

              {parsed.primaryField && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {fieldName ? `Updating: ${fieldName}` : 'Primary Field Update'}
                  </p>
                  <div className="text-sm bg-background/50 rounded p-3 border border-border/50">
                    {typeof parsed.primaryField === 'string'
                      ? parsed.primaryField
                      : Array.isArray(parsed.primaryField)
                        ? <ul className="list-disc list-inside space-y-1">{parsed.primaryField.map((item: unknown, i: number) => (
                            <li key={i}>
                              {typeof item === 'string'
                                ? item
                                : typeof item === 'object' && item !== null && 'title' in item
                                  ? String((item as { title: string }).title)
                                  : JSON.stringify(item)}
                            </li>
                          ))}</ul>
                        : JSON.stringify(parsed.primaryField, null, 2)
                    }
                  </div>
                </div>
              )}

              {parsed.relatedFieldSuggestions && Object.keys(parsed.relatedFieldSuggestions).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Related Field Suggestions</p>
                  {(Object.entries(parsed.relatedFieldSuggestions) as [string, { fieldLabel?: string; reason?: string; suggestedValue: string | string[] | Record<string, unknown> }][]).map(([fieldKey, suggestion]) => (
                    <div key={fieldKey} className="bg-background/50 rounded p-3 border border-border/50 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{suggestion.fieldLabel || fieldKey}</p>
                        {suggestion.reason && (
                          <Badge variant="outline" className="text-xs">Why?</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {typeof suggestion.suggestedValue === 'string'
                          ? suggestion.suggestedValue
                          : Array.isArray(suggestion.suggestedValue)
                            ? <ul className="list-disc list-inside space-y-1">{suggestion.suggestedValue.map((item: unknown, i: number) => (
                                <li key={i}>
                                  {typeof item === 'string'
                                    ? item
                                    : typeof item === 'object' && item !== null && 'title' in item
                                      ? String((item as { title: string }).title)
                                      : JSON.stringify(item)}
                                </li>
                              ))}</ul>
                            : JSON.stringify(suggestion.suggestedValue, null, 2)
                        }
                      </div>
                      {suggestion.reason && (
                        <p className="text-xs text-muted-foreground italic mt-2">→ {suggestion.reason}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {afterJson && <p className="text-sm whitespace-pre-wrap leading-relaxed">{afterJson}</p>}
          </div>
        );
      } catch (e) {
        // If JSON parsing fails, just show the text without the code block
        console.error("Failed to parse JSON in message:", e);
        const textOnly = beforeJson + (afterJson ? '\n\n' + afterJson : '');
        return <p className="text-sm whitespace-pre-wrap leading-relaxed">{textOnly || content}</p>;
      }
    }

    // Default rendering for non-JSON content
    return <p className="text-sm whitespace-pre-wrap leading-relaxed">{content}</p>;
  };

  return (
    <div className="flex flex-col h-full">
      {fieldName && (
        <div className="p-4 border-b bg-muted/50">
          <p className="text-sm font-medium">
            Refining: <span className="text-primary">{fieldName}</span>
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {fieldKey && messages.length === 0 && (
          <LearningInsights fieldKey={fieldKey} onSuggestionClick={handleSuggestionClick} />
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-2">
              <p className="text-muted-foreground">
                No messages yet. Start a conversation to refine this field.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <Card
                className={cn(
                  "max-w-[80%] p-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {renderMessageContent(message.content)}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.attachments.map((attachment) => {
                      const FileIcon = getFileIcon(attachment.type);
                      return (
                        <div
                          key={attachment.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded text-xs",
                            message.role === "user"
                              ? "bg-primary-foreground/10"
                              : "bg-background/50"
                          )}
                        >
                          <FileIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1 truncate">{attachment.name}</span>
                          <span className="text-xs opacity-70">{formatFileSize(attachment.size)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs opacity-70 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </p>
              </Card>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-muted p-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        {attachments.length > 0 && (
          <div className="mb-3 space-y-2">
            {attachments.map((attachment) => {
              const FileIcon = getFileIcon(attachment.type);
              return (
                <div
                  key={attachment.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted text-sm"
                >
                  <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{attachment.name}</span>
                  <Badge variant="secondary" className="text-xs">{formatFileSize(attachment.size)}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeAttachment(attachment.id)}
                    className="h-6 w-6 hover:bg-destructive/10"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className="resize-none"
              rows={2}
            />
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                type="submit"
                disabled={(!input.trim() && attachments.length === 0) || isLoading}
                size="icon"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.pdf,.doc,.docx,.jpg,.jpeg,.png,.csv,.xlsx,.json"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-xs text-muted-foreground">
            Press Enter to send, Shift+Enter for new line. Attach files for additional context.
          </p>
        </form>
      </div>
    </div>
  );
}
