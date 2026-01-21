import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  content: string;
};

// Converts literal "\n" into actual newlines, and \" into "
function normalizeMarkdown(input: string): string {
  return input
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\t/g, "\t");
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const normalized = normalizeMarkdown(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      // Tailwind reset removes default bullets/margins -> add them back:
      components={{
        p: ({ children, ...props }) => (
          <p className="my-2 whitespace-pre-wrap" {...props}>
            {children}
          </p>
        ),
        ul: ({ children, ...props }) => (
          <ul className="list-disc pl-6 my-2" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }) => (
          <ol className="list-decimal pl-6 my-2" {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }) => (
          <li className="my-1" {...props}>
            {children}
          </li>
        ),
      }}
    >
      {normalized}
    </ReactMarkdown>
  );
}
 