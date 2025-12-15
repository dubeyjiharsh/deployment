"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "assistant" | "user";
  content: string;
}

interface AdaptiveConversationProps {
  initialProblem: string;
  uploadedFiles?: string[]; // Document IDs for RAG
  onComplete: (contextualInfo: string, extractedAnswers: Record<string, string>) => void;
  onSkip?: () => void;
}

export function AdaptiveConversation({
  initialProblem,
  uploadedFiles,
  onComplete,
  onSkip,
}: AdaptiveConversationProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [confidence, setConfidence] = useState(0.1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Target fields we want to extract
  const targetFields = [
    "problemStatement",
    "objectives",
    "kpis",
    "timelines",
    "urgency",
  ];

  // Initialize conversation
  useEffect(() => {
    startConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (!isThinking) {
      inputRef.current?.focus();
    }
  }, [isThinking, messages]);

  const startConversation = async () => {
    setIsThinking(true);

    try {
      const response = await fetch("/api/canvas/adaptive-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalProblem: initialProblem,
          conversationHistory: [],
          targetFields,
          uploadedFiles,
        }),
      });

      const result = await response.json();

      setMessages([
        {
          role: "assistant",
          content: `I need a bit more information to create a reliable canvas (current confidence: ${Math.round(result.confidence * 100)}%). Let me ask you a few quick questions.`,
        },
        {
          role: "assistant",
          content: result.nextQuestion,
        },
      ]);

      setConfidence(result.confidence);
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setMessages([
        {
          role: "assistant",
          content: "What specific business problem or opportunity are you trying to address?",
        },
      ]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleSendAnswer = async () => {
    if (!userInput.trim() || isThinking) return;

    const answer = userInput.trim();

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content: answer }]);
    setUserInput("");
    setIsThinking(true);

    try {
      // Get next conversation step
      const conversationHistory = [
        ...messages,
        { role: "user" as const, content: answer },
      ];

      const response = await fetch("/api/canvas/adaptive-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalProblem: initialProblem,
          conversationHistory,
          targetFields,
          uploadedFiles,
        }),
      });

      const result = await response.json();

      setConfidence(result.confidence);

      // Typing delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (result.isDone) {
        // Conversation complete!
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              result.reasoning ||
              "Perfect! I have everything I need. Generating your canvas now...",
          },
        ]);

        // Build contextual info from extracted answers
        const contextualInfo = Object.entries(result.extractedAnswers)
          .filter(([_, value]) => typeof value === 'string' && value.trim().length > 0)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");

        // Complete after short delay
        setTimeout(() => {
          onComplete(contextualInfo, result.extractedAnswers);
        }, 1000);
      } else {
        // Ask next question
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: result.nextQuestion || "Can you tell me more?",
          },
        ]);
      }
    } catch (error) {
      console.error("Conversation error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I apologize, but I'm having trouble processing that. Let's try generating your canvas with what we have so far.",
        },
      ]);

      setTimeout(() => {
        const contextualInfo = messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n");
        onComplete(contextualInfo, {});
      }, 1500);
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendAnswer();
    }
  };

  return (
    <div className="flex flex-col h-[500px] border-2 border-blue-300 rounded-lg bg-gradient-to-b from-blue-50 to-white shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-blue-200 bg-blue-100">
        <Sparkles className="w-5 h-5 text-blue-600" />
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900">Intelligent Context Gathering</h3>
          <p className="text-xs text-blue-700">
            Confidence: {Math.round(confidence * 100)}% •{" "}
            {confidence >= 0.7 ? "Almost there!" : "Learning about your needs..."}
          </p>
        </div>
        {onSkip && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-blue-700 hover:bg-blue-200"
          >
            Skip & Generate
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence initial={false}>
          {messages.map((message, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-white border border-blue-200 text-gray-900 shadow-sm"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                  {message.content}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-white border border-blue-200 rounded-lg px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <div
                  className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-blue-200 bg-white">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isThinking ? "Thinking..." : "Type your answer..."}
            className="flex-1 min-h-[44px] max-h-[120px] resize-none focus:ring-blue-500"
            rows={1}
            disabled={isThinking}
          />
          <Button
            onClick={handleSendAnswer}
            disabled={!userInput.trim() || isThinking}
            size="icon"
            className="bg-blue-500 hover:bg-blue-600"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {isThinking ? (
            <span className="text-blue-600">Processing your answer...</span>
          ) : (
            <>
              Press <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-xs">Enter</kbd> to
              send, <kbd className="px-1.5 py-0.5 bg-gray-100 border rounded text-xs">Shift+Enter</kbd> for new line
            </>
          )}
        </p>
      </div>
    </div>
  );
}
