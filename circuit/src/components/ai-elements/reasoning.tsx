"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { createContext, memo, useContext, useEffect, useState } from "react";
import { Response } from "./response";
import { Shimmer } from "./shimmer";

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: 0,
    });

    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);

    // Auto-open when streaming starts
    useEffect(() => {
      if (isStreaming && defaultOpen) {
        setIsOpen(true);
        setHasAutoClosed(false);
      }
    }, [isStreaming, defaultOpen, setIsOpen]);

    // Auto-close when streaming ends (once only)
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen);
    };

    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration }}
      >
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  }
);

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger> & {
  summary?: string;
};

const getThinkingMessage = (isStreaming: boolean, duration?: number, summary?: string) => {
  // While streaming
  if (isStreaming) {
    return <Shimmer duration={1}>Thinking...</Shimmer>;
  }

  // Completed - show summary
  if (summary) {
    return (
      <span className="text-xs">
        {summary}
        {duration && duration > 0 && <span className="text-muted-foreground/50 ml-1.5">• {duration}s</span>}
      </span>
    );
  }

  // Fallback
  if (duration === undefined || duration === 0) {
    return <p>Thought for a few seconds</p>;
  }
  return <p>Thought for {duration} seconds</p>;
};

export const ReasoningTrigger = memo(
  ({ className, children, summary, ...props }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-muted-foreground text-xs transition-colors hover:text-foreground",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            {getThinkingMessage(isStreaming, duration, summary)}
            <ChevronDownIcon
              className={cn(
                "size-3.5 transition-transform ml-auto",
                isOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children?: React.ReactNode;
};

export const ReasoningContent = ({ className, children, ...props }: ReasoningContentProps) => (
  <CollapsibleContent
    className={cn(
      "mt-4 text-sm",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className
    )}
    {...props}
  >
    {typeof children === 'string' ? (
      <Response className="grid gap-2">{children}</Response>
    ) : (
      children
    )}
  </CollapsibleContent>
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
