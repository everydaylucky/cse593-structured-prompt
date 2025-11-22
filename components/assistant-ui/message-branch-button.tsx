"use client";

import { GitBranch } from "lucide-react";
import { useMessage, useThread, useAssistantRuntime } from "@assistant-ui/react";
import { TooltipIconButton } from "./tooltip-icon-button";

export const MessageBranchButton: React.FC = () => {
  const message = useMessage();
  const thread = useThread();
  const assistantRuntime = useAssistantRuntime();

  const handleBranch = async () => {
    const allMessages = thread.messages;
    
    const messageIndex = allMessages.findIndex(msg => msg.id === message.id);
    
    if (messageIndex === -1) return;

    const currentThreadRuntime = assistantRuntime.thread;
    const exportedRepository = currentThreadRuntime.export();

    const trimmedMessages =
      exportedRepository.messages.slice(0, messageIndex + 1);
    const newHeadId =
      trimmedMessages.length > 0
        ? trimmedMessages[trimmedMessages.length - 1]?.message.id ?? null
        : null;

    const branchRepository = {
      ...exportedRepository,
      headId: newHeadId,
      messages: trimmedMessages,
    };

    await assistantRuntime.threads.switchToNewThread();
    const newThreadRuntime = assistantRuntime.thread;
    newThreadRuntime.import(branchRepository);
  };

  return (
    <TooltipIconButton
      tooltip="Create branch from here"
      onClick={handleBranch}
      className="aui-message-branch-button"
    >
      <GitBranch className="size-4" />
    </TooltipIconButton>
  );
};

