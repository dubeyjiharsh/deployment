"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { UserPresence } from "@/hooks/use-collaboration";

interface LiveCursorsProps {
  users: UserPresence[];
  containerRef?: React.RefObject<HTMLElement>;
  className?: string;
  /** Only show cursors for users on this tab (if provided) */
  currentTab?: string;
  /** Field keys the current viewer cannot see */
  hiddenFieldKeys?: Set<string>;
}

interface UserCursorProps {
  user: UserPresence;
  /** If the user is editing/refining, lock their cursor to this position */
  lockedPosition?: { x: number; y: number } | null;
}

function UserCursor({ user, lockedPosition }: UserCursorProps) {
  // Use locked position if available, otherwise use actual cursor
  const position = lockedPosition || user.cursor;
  if (!position) return null;

  const isLocked = !!lockedPosition && (user.action === "editing" || user.action === "refining");
  const firstName = user.name.split(" ")[0];
  // Convert page coordinates into viewport coordinates for rendering
  const viewportLeft = position.x - window.scrollX;
  const viewportTop = position.y - window.scrollY;

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-50 transition-all",
        isLocked ? "duration-300" : "duration-75"
      )}
      style={{
        left: viewportLeft,
        top: viewportTop,
      }}
    >
      {/* Figma-style cursor pointer */}
      <svg
        width="18"
        height="24"
        viewBox="0 0 18 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={isLocked ? "animate-pulse" : ""}
      >
        <path
          d="M0.928548 0.67569L16.6014 13.5765C17.1832 14.0362 16.8581 14.9713 16.1155 14.9713H9.4364C9.14148 14.9713 8.86296 15.1087 8.68377 15.3432L4.53361 20.7287C4.06365 21.3424 3.08794 21.0533 3.03888 20.2815L0.0285225 1.51888C-0.0348238 0.634993 0.346552 0.215971 0.928548 0.67569Z"
          fill={user.color}
        />
      </svg>

      {/* Name tag - positioned to the right of cursor */}
      <div
        className="absolute left-3 top-4 flex items-center gap-1 rounded-sm px-2 py-1 text-sm font-medium shadow-sm whitespace-nowrap"
        style={{
          backgroundColor: user.color,
          color: 'white',
        }}
      >
        <span>{firstName}</span>
        {/* Action indicator */}
        {user.action && user.action !== "viewing" && (
          <span className="text-white/80 text-xs">
            • {user.action === "refining" ? "refining" : "editing"}
          </span>
        )}
      </div>
    </div>
  );
}

export function LiveCursors({ users, containerRef: _containerRef, className, currentTab, hiddenFieldKeys }: LiveCursorsProps) {
  const [fieldPositions, setFieldPositions] = React.useState<Map<string, { x: number; y: number }>>(new Map());

  // Update field positions when DOM changes
  React.useEffect(() => {
    const updatePositions = () => {
      const newPositions = new Map<string, { x: number; y: number }>();
      const scrollX = window.scrollX || 0;
      const scrollY = window.scrollY || 0;

      // Find all field items by their data attribute
      document.querySelectorAll('[data-field-key]').forEach((element) => {
        const fieldKey = element.getAttribute('data-field-key');
        if (fieldKey) {
          const rect = element.getBoundingClientRect();
          // Position cursor at the top-right of the field (near the action buttons)
          newPositions.set(fieldKey, {
            // Store page coordinates so they stay consistent across scroll positions
            x: rect.right + scrollX - 100, // Near the right side where buttons are
            y: rect.top + scrollY + 20,    // Near the top
          });
        }
      });

      setFieldPositions(newPositions);
    };

    // Initial update
    updatePositions();

    // Update on scroll and resize
    window.addEventListener('scroll', updatePositions, { passive: true });
    window.addEventListener('resize', updatePositions, { passive: true });

    // Also update periodically for dynamic content
    const interval = setInterval(updatePositions, 1000);

    return () => {
      window.removeEventListener('scroll', updatePositions);
      window.removeEventListener('resize', updatePositions);
      clearInterval(interval);
    };
  }, []);

  // Filter and prepare users with their cursor positions
  const usersToShow = users.filter((user) => {
    // If currentTab is specified, only show users on the same tab
    if (currentTab && user.currentTab !== currentTab) return false;

    // Show users who are editing/refining (they'll have locked positions)
    if ((user.action === "editing" || user.action === "refining") && user.activeField) {
      if (hiddenFieldKeys?.has(user.activeField)) return false;
      return true;
    }

    // Otherwise, must have cursor position
    return user.cursor != null;
  });

  if (usersToShow.length === 0) return null;

  return (
    <div className={cn("pointer-events-none", className)}>
      {usersToShow.map((user) => {
        // If user is editing/refining a field, lock cursor to that field's position
        let lockedPosition: { x: number; y: number } | null = null;
        if ((user.action === "editing" || user.action === "refining") && user.activeField) {
          lockedPosition = fieldPositions.get(user.activeField) || null;
        }

        return (
          <UserCursor
            key={user.clientId || user.id}
            user={user}
            lockedPosition={lockedPosition}
          />
        );
      })}
    </div>
  );
}
