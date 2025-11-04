/**
 * ANSI Escape Sequence Parser for Terminal Blocks
 *
 * Parses terminal output to detect block boundaries and extract
 * clean text without ANSI sequences
 */

import type { BlockMarkerEvent } from '@/types/terminal';

/**
 * Parse terminal data and extract block markers
 *
 * @param data - Raw terminal output with ANSI sequences
 * @returns Object with cleaned text and any detected block markers
 */
export function parseBlockMarkers(data: string): {
  cleanedData: string;
  markers: BlockMarkerEvent[];
} {
  const markers: BlockMarkerEvent[] = [];
  let cleanedData = data;

  // Regex to match our custom OSC sequences
  // Format: ESC ] 1337 ; BlockXXX BEL
  // ESC = \x1b, BEL = \x07
  const blockMarkerRegex = /\x1b\]1337;Block(Boundary|Start|End(?:=(\d+))?)\x07/g;

  let match: RegExpExecArray | null;
  while ((match = blockMarkerRegex.exec(data)) !== null) {
    const markerType = match[1]; // "Boundary", "Start", or "End=123"

    if (markerType === 'Boundary') {
      markers.push({ type: 'boundary' });
    } else if (markerType === 'Start') {
      markers.push({ type: 'start' });
    } else if (markerType.startsWith('End')) {
      const exitCode = match[2] ? parseInt(match[2], 10) : 0;
      markers.push({ type: 'end', exitCode });
    }
  }

  // Remove block markers from output
  cleanedData = cleanedData.replace(blockMarkerRegex, '');

  return { cleanedData, markers };
}

/**
 * Strip all ANSI escape sequences from text
 *
 * @param text - Text with ANSI sequences
 * @returns Plain text without any ANSI codes
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1b\[[0-9;]*[a-zA-Z]|\x1b\][0-9;]*[^\x07]*\x07/g;
  return text.replace(ansiRegex, '');
}

/**
 * Extract command from terminal line
 *
 * Removes common prompt patterns to extract just the command
 *
 * @param line - Terminal line with prompt
 * @returns Extracted command
 */
export function extractCommand(line: string): string {
  // Remove common prompt patterns
  // Examples:
  // "$ ls -la" -> "ls -la"
  // "user@host:~/path$ git status" -> "git status"
  // "❯ npm install" -> "npm install"

  const promptPatterns = [
    /^[^\s]*[@:][^\s]*[$#>]\s*/,  // user@host:path$ or user@host:path#
    /^[$#>❯]\s*/,                   // $ or # or > or ❯
    /^\[[^\]]+\]\s*/,               // [user@host]
  ];

  let command = stripAnsi(line).trim();

  for (const pattern of promptPatterns) {
    command = command.replace(pattern, '');
  }

  return command;
}
