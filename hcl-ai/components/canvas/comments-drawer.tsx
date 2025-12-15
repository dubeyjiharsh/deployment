"use client";

import * as React from "react";
import { MessageCircle, Send, X, Loader2, MoreVertical } from "lucide-react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  canvasId: string;
  fieldKey: string;
  content: string;
  author: string;
  parentId: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CommentsDrawerProps {
  canvasId: string;
  fieldKey: string;
  fieldLabel: string;
  onClose?: () => void;
}

/**
 * Comments drawer for collaborative field refinement
 */
export function CommentsDrawer({
  canvasId,
  fieldKey,
  fieldLabel,
  onClose,
}: CommentsDrawerProps): React.ReactElement {
  const { data: session } = useSession();
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [newComment, setNewComment] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = (): void => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [comments]);

  // Fetch comments
  React.useEffect(() => {
    const fetchComments = async () => {
      try {
        const response = await fetch(`/api/canvas/comments?canvasId=${canvasId}&fieldKey=${fieldKey}`);
        if (response.ok) {
          const data = await response.json();
          setComments(data.comments || []);
        }
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComments();
  }, [canvasId, fieldKey]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!newComment.trim() || isSubmitting || !session?.user) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/canvas/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canvasId,
          fieldKey,
          content: newComment.trim(),
          parentId: replyTo,
        }),
      });

      if (response.ok) {
        const { comment } = await response.json();
        setComments([...comments, comment]);
        setNewComment("");
        setReplyTo(null);
      }
    } catch (error) {
      console.error("Failed to create comment:", error);
      alert("Failed to create comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async (commentId: string, resolved: boolean): Promise<void> => {
    try {
      const response = await fetch("/api/canvas/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: commentId,
          resolved,
        }),
      });

      if (response.ok) {
        setComments(
          comments.map((c) =>
            c.id === commentId ? { ...c, resolved } : c
          )
        );
      }
    } catch (error) {
      console.error("Failed to update comment:", error);
    }
  };

  const handleDelete = async (commentId: string): Promise<void> => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const response = await fetch(`/api/canvas/comments?id=${commentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setComments(comments.filter((c) => c.id !== commentId));
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Build threaded comments
  const threadedComments = React.useMemo(() => {
    const threads: Comment[] = [];
    const childMap = new Map<string, Comment[]>();

    comments.forEach((comment) => {
      if (comment.parentId) {
        const children = childMap.get(comment.parentId) || [];
        children.push(comment);
        childMap.set(comment.parentId, children);
      } else {
        threads.push(comment);
      }
    });

    return { threads, childMap };
  }, [comments]);

  const renderComment = (comment: Comment, isReply: boolean = false): React.ReactNode => {
    const children = threadedComments.childMap.get(comment.id) || [];

    return (
      <div key={comment.id} className={cn("space-y-2", isReply && "ml-8")}>
        <Card className={cn("p-3", comment.resolved && "opacity-60")}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{comment.author}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleDateString()} at{" "}
                  {new Date(comment.createdAt).toLocaleTimeString()}
                </span>
                {comment.resolved && (
                  <Badge variant="secondary" className="text-xs">
                    Resolved
                  </Badge>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm">
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReplyTo(comment.id)}>
                  Reply
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleResolve(comment.id, !comment.resolved)}>
                  {comment.resolved ? "Unresolve" : "Resolve"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDelete(comment.id)} variant="destructive">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>

        {children.length > 0 && (
          <div className="space-y-2">
            {children.map((child) => renderComment(child, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            <p className="text-sm font-medium">
              Comments: <span className="text-primary">{fieldLabel}</span>
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : comments.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-2">
              <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                No comments yet. Start the conversation!
              </p>
            </div>
          </div>
        ) : (
          <>
            {threadedComments.threads.map((comment) => renderComment(comment))}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t">
        {replyTo && (
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Replying to comment...</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setReplyTo(null)}
              className="h-4 w-4 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment..."
            disabled={isSubmitting}
            className="resize-none"
            rows={2}
          />
          <Button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            size="icon"
            className="self-end"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
