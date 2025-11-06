/**
 * MCPSection - MCP call history and tools
 */

import React from 'react';
import { SettingsGroup } from '../SettingsItem';
import { MCPTimeline } from '@/components/mcp/MCPTimeline';

export const MCPSection: React.FC = () => {
  return (
    <div className="space-y-8">
      <SettingsGroup
        title="MCP Call History"
        description="View recent Model Context Protocol tool calls"
      >
        <div className="mt-4">
          <MCPTimeline />
        </div>
      </SettingsGroup>
    </div>
  );
};
