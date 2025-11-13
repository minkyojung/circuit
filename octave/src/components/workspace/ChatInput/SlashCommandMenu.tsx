/**
 * SlashCommandMenu Component
 *
 * Displays a dropdown menu of available slash commands with search/filter capability.
 * Shows when user types "/" in the chat input.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SlashCommand {
  name: string;
  fileName: string;
  description?: string;
}

interface SlashCommandMenuProps {
  showCommandMenu: boolean;
  filteredCommands: SlashCommand[];
  selectedCommandIndex: number;
  onExecuteCommand: (commandName: string) => void;
  commandMenuRef: React.RefObject<HTMLDivElement>;
}

export const SlashCommandMenu: React.FC<SlashCommandMenuProps> = ({
  showCommandMenu,
  filteredCommands,
  selectedCommandIndex,
  onExecuteCommand,
  commandMenuRef,
}) => {
  return (
    <AnimatePresence>
      {showCommandMenu && filteredCommands.length > 0 && (
        <motion.div
          ref={commandMenuRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-full left-0 mb-2 w-1/2 min-w-[400px] bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50"
        >
          <div className="p-1 max-h-64 overflow-y-auto">
            {filteredCommands.map((command, index) => (
              <button
                key={command.name}
                onClick={() => onExecuteCommand(command.name)}
                className={`w-full py-2 px-3 text-left cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 transition-colors rounded-md ${
                  index === selectedCommandIndex ? 'bg-secondary' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-light flex-shrink-0">/{command.name}</span>
                  {command.description && (
                    <span className="text-xs text-muted-foreground/60 flex-1 truncate">
                      {command.description}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
