"use client";

import * as React from "react";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { UserPresence } from "@/hooks/use-collaboration";

interface AvatarStackProps {
  users: UserPresence[];
  maxVisible?: number;
  onUserClick?: (user: UserPresence) => void;
  className?: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getActionLabel(action?: string, activeField?: string | null): string {
  if (!action || action === "viewing") return "Viewing";
  if (action === "editing") return activeField ? `Editing ${activeField}` : "Editing";
  if (action === "refining") return activeField ? `Refining ${activeField}` : "Refining";
  return "Viewing";
}

export function AvatarStack({
  users,
  maxVisible = 5,
  onUserClick,
  className,
}: AvatarStackProps) {
  if (users.length === 0) return null;

  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;

  return (
    <TooltipProvider>
      <div className={cn("flex items-center -space-x-2", className)}>
        {visibleUsers.map((user, index) => (
          <Tooltip key={user.clientId || user.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onUserClick?.(user)}
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-xs font-medium text-white transition-transform hover:scale-110 hover:z-10 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                  onUserClick && "cursor-pointer"
                )}
                style={{
                  backgroundColor: user.color,
                  zIndex: users.length - index,
                }}
              >
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={user.name}
                    fill
                    className="rounded-full object-cover"
                  />
                ) : (
                  getInitials(user.name)
                )}
                {/* Activity indicator */}
                {user.action && user.action !== "viewing" && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background"
                    style={{
                      backgroundColor:
                        user.action === "refining" ? "#10B981" : "#F59E0B",
                    }}
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex flex-col gap-0.5">
              <span className="font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">
                {getActionLabel(user.action, user.activeField)}
              </span>
              {user.currentTab && user.currentTab !== "canvas" && (
                <span className="text-xs text-muted-foreground">
                  on {user.currentTab} tab
                </span>
              )}
            </TooltipContent>
          </Tooltip>
        ))}

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium"
                style={{ zIndex: 0 }}
              >
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="flex flex-col gap-1">
                {users.slice(maxVisible).map((user) => (
                  <span key={user.id} className="text-sm">
                    {user.name}
                  </span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
