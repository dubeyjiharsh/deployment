import { NextRequest, NextResponse } from "next/server";
import { commentsRepository } from "@/services/database/comments-repository";
import { applyApiMiddleware, MIDDLEWARE_PRESETS } from "@/lib/api-middleware";
import { userRepository } from "@/services/database/user-repository";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AUTH
  );
  if (response) return response;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get("canvasId");
    const fieldKey = searchParams.get("fieldKey");
    const counts = searchParams.get("counts") === "true";

    if (!canvasId) {
      return NextResponse.json(
        { error: "Canvas ID is required" },
        { status: 400 }
      );
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await userRepository.canUserAccessCanvas(canvasId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    if (counts) {
      // Get comment counts by field
      const commentCounts = await commentsRepository.getCommentCountByField(canvasId);
      return NextResponse.json({ commentCounts });
    }

    if (fieldKey) {
      // Get comments for a specific field
      const comments = await commentsRepository.getCommentsByField(canvasId, fieldKey);
      return NextResponse.json({ comments });
    }

    // Get all comments for canvas
    const comments = await commentsRepository.getCommentsByCanvas(canvasId);
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("Error fetching comments:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
    const { response, session } = await applyApiMiddleware(
      request,
      MIDDLEWARE_PRESETS.AUTH
    );
    if (response) return response;

  try {
    const body = await request.json();
    const { canvasId, fieldKey, content, parentId } = body;

    if (!canvasId || !fieldKey || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await userRepository.canUserAccessCanvas(canvasId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    if (parentId) {
      const parentComment = await commentsRepository.getCommentById(parentId);
      if (!parentComment || parentComment.canvasId !== canvasId) {
        return NextResponse.json(
          { error: "Invalid parent comment" },
          { status: 400 }
        );
      }
    }

    const comment = await commentsRepository.createComment({
      canvasId,
      fieldKey,
      content,
      userId: session.user.id,
      authorName: session.user.name,
      authorEmail: session.user.email,
      parentId: parentId || null,
      resolved: false,
    });

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Error creating comment:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AUTH
  );
  if (response) return response;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, content, resolved } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Comment ID is required" },
        { status: 400 }
      );
    }

    const existingComment = await commentsRepository.getCommentById(id);
    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await userRepository.canUserAccessCanvas(existingComment.canvasId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    let comment;

    if (content !== undefined) {
      comment = await commentsRepository.updateComment(id, content);
    } else if (resolved !== undefined) {
      comment = await commentsRepository.setCommentResolved(id, resolved);
    } else {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    if (!comment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ comment });
  } catch (error) {
    console.error("Error updating comment:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update comment" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  // Apply authentication and rate limiting
  const { response } = await applyApiMiddleware(
    request,
    MIDDLEWARE_PRESETS.AUTH
  );
  if (response) return response;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Comment ID is required" },
        { status: 400 }
      );
    }

    const existingComment = await commentsRepository.getCommentById(id);
    if (!existingComment) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    const user = await userRepository.getUserById(session.user.id);
    const isAdmin = user?.role === "admin";
    const hasAccess = isAdmin || await userRepository.canUserAccessCanvas(existingComment.canvasId, session.user.id);

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: You don't have access to this canvas" },
        { status: 403 }
      );
    }

    const deleted = await commentsRepository.deleteComment(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Comment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting comment:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete comment" },
      { status: 500 }
    );
  }
}
