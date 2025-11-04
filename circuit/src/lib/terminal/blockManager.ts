/**
 * Terminal Block Manager
 *
 * Manages terminal blocks for each workspace, tracking command execution
 * and grouping outputs
 */

import { nanoid } from 'nanoid';
import type { TerminalBlock, BlockManagerOptions, BlockMarkerEvent } from '@/types/terminal';
import { parseBlockMarkers, extractCommand } from './blockParser';

/**
 * State machine for tracking block creation
 */
type BlockState =
  | { type: 'idle' }
  | { type: 'command_input'; buffer: string }
  | { type: 'executing'; blockId: string; startTime: number }
  | { type: 'collecting_output'; blockId: string; buffer: string };

export class BlockManager {
  // Blocks stored per workspace
  private blocks = new Map<string, TerminalBlock[]>();

  // Current state per workspace
  private state = new Map<string, BlockState>();

  // Pending command buffer per workspace
  private commandBuffer = new Map<string, string>();

  // Options
  private maxBlocks: number;
  private maxOutputSize: number;

  constructor(options: BlockManagerOptions = {}) {
    this.maxBlocks = options.maxBlocks ?? 1000;
    this.maxOutputSize = options.maxOutputSize ?? 1_000_000; // 1MB
  }

  /**
   * Process terminal data and update blocks
   *
   * @param workspaceId - Workspace identifier
   * @param data - Raw terminal output
   * @param cwd - Current working directory
   * @returns Updated blocks for this workspace
   */
  processData(workspaceId: string, data: string, cwd: string = '~'): TerminalBlock[] {
    // Parse block markers from data
    const { cleanedData, markers } = parseBlockMarkers(data);

    // Get current state
    const currentState = this.state.get(workspaceId) ?? { type: 'idle' };

    // Process markers
    for (const marker of markers) {
      this.handleMarker(workspaceId, marker, cwd);
    }

    // Add cleaned data to current block or command buffer
    if (cleanedData) {
      this.appendData(workspaceId, cleanedData);
    }

    return this.getBlocks(workspaceId);
  }

  /**
   * Handle block marker events
   */
  private handleMarker(workspaceId: string, marker: BlockMarkerEvent, cwd: string): void {
    const currentState = this.state.get(workspaceId) ?? { type: 'idle' };

    switch (marker.type) {
      case 'boundary':
        // Prompt boundary - prepare for command input
        this.state.set(workspaceId, { type: 'command_input', buffer: '' });
        break;

      case 'start': {
        // Command execution started
        const command = this.commandBuffer.get(workspaceId) ?? '';
        const blockId = nanoid();
        const startTime = Date.now();

        // Create new block
        const block: TerminalBlock = {
          id: blockId,
          workspaceId,
          command: extractCommand(command),
          output: '',
          exitCode: null,
          startTime,
          endTime: null,
          status: 'running',
          cwd,
        };

        this.addBlock(workspaceId, block);

        // Update state
        this.state.set(workspaceId, { type: 'executing', blockId, startTime });
        this.commandBuffer.delete(workspaceId);
        break;
      }

      case 'end': {
        // Command execution finished
        if (currentState.type === 'executing' || currentState.type === 'collecting_output') {
          const blockId = currentState.blockId;
          const block = this.findBlock(workspaceId, blockId);

          if (block) {
            block.exitCode = marker.exitCode;
            block.endTime = Date.now();
            block.status = marker.exitCode === 0 ? 'completed' : 'failed';
          }

          this.state.set(workspaceId, { type: 'idle' });
        }
        break;
      }
    }
  }

  /**
   * Append data to current context (command buffer or block output)
   */
  private appendData(workspaceId: string, data: string): void {
    const currentState = this.state.get(workspaceId) ?? { type: 'idle' };

    switch (currentState.type) {
      case 'command_input':
        // Accumulate command input
        const existingCommand = this.commandBuffer.get(workspaceId) ?? '';
        this.commandBuffer.set(workspaceId, existingCommand + data);
        break;

      case 'executing':
      case 'collecting_output': {
        // Append to block output
        const block = this.findBlock(workspaceId, currentState.blockId);
        if (block) {
          // Limit output size
          if (block.output.length < this.maxOutputSize) {
            block.output += data;
          }
        }
        if (currentState.type === 'executing') {
          this.state.set(workspaceId, {
            type: 'collecting_output',
            blockId: currentState.blockId,
            buffer: data,
          });
        }
        break;
      }
    }
  }

  /**
   * Add block to workspace
   */
  private addBlock(workspaceId: string, block: TerminalBlock): void {
    const blocks = this.blocks.get(workspaceId) ?? [];
    blocks.push(block);

    // Limit number of blocks
    if (blocks.length > this.maxBlocks) {
      blocks.shift(); // Remove oldest
    }

    this.blocks.set(workspaceId, blocks);
  }

  /**
   * Find block by ID
   */
  private findBlock(workspaceId: string, blockId: string): TerminalBlock | undefined {
    const blocks = this.blocks.get(workspaceId) ?? [];
    return blocks.find((b) => b.id === blockId);
  }

  /**
   * Get all blocks for workspace
   */
  getBlocks(workspaceId: string): TerminalBlock[] {
    return this.blocks.get(workspaceId) ?? [];
  }

  /**
   * Clear blocks for workspace
   */
  clearBlocks(workspaceId: string): void {
    this.blocks.delete(workspaceId);
    this.state.delete(workspaceId);
    this.commandBuffer.delete(workspaceId);
  }

  /**
   * Get current state for debugging
   */
  getState(workspaceId: string): BlockState {
    return this.state.get(workspaceId) ?? { type: 'idle' };
  }
}

// Singleton instance
let blockManagerInstance: BlockManager | null = null;

export function getBlockManager(): BlockManager {
  if (!blockManagerInstance) {
    blockManagerInstance = new BlockManager();
  }
  return blockManagerInstance;
}
