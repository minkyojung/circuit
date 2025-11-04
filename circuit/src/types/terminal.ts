/**
 * Terminal Block Types
 *
 * Defines data structures for the Warp-style block system
 * where commands and outputs are grouped as discrete units
 */

/**
 * A single terminal block representing a command execution
 */
export interface TerminalBlock {
  // Unique identifier
  id: string;

  // Workspace this block belongs to
  workspaceId: string;

  // Command that was executed
  command: string;

  // Command output
  output: string;

  // Exit code (0 = success, non-zero = error)
  exitCode: number | null;

  // Timestamps
  startTime: number;        // When command started
  endTime: number | null;   // When command finished (null if running)

  // Current state
  status: 'running' | 'completed' | 'failed';

  // Current working directory when command was executed
  cwd: string;
}

/**
 * ANSI escape sequences for block detection
 * These are custom OSC (Operating System Command) sequences
 */
export const BLOCK_MARKERS = {
  // Sent before command prompt is rendered
  PROMPT: '\x1b]1337;BlockBoundary\x07',

  // Sent before command execution
  START: '\x1b]1337;BlockStart\x07',

  // Sent after command completes (includes exit code)
  END: (exitCode: number) => `\x1b]1337;BlockEnd=${exitCode}\x07`,
} as const;

/**
 * Shell hook scripts to inject into user's shell config
 * These hooks send ANSI sequences at key points
 */
export const SHELL_HOOKS = {
  zsh: `
# Circuit Terminal Block Detection
# Added by Circuit - Modern Terminal Mode

__circuit_precmd() {
  local exit_code=$?
  # Send block end with exit code from previous command
  if [ -n "$__circuit_command_running" ]; then
    printf "\\033]1337;BlockEnd=%s\\007" "$exit_code"
    unset __circuit_command_running
  fi
  # Send block boundary before prompt
  printf "\\033]1337;BlockBoundary\\007"
}

__circuit_preexec() {
  # Send block start before command execution
  printf "\\033]1337;BlockStart\\007"
  __circuit_command_running=1
}

# Register hooks
precmd_functions+=(__circuit_precmd)
preexec_functions+=(__circuit_preexec)
`,

  bash: `
# Circuit Terminal Block Detection
# Added by Circuit - Modern Terminal Mode

__circuit_precmd() {
  local exit_code=$?
  # Send block end with exit code from previous command
  if [ -n "$__circuit_command_running" ]; then
    printf "\\033]1337;BlockEnd=%s\\007" "$exit_code"
    unset __circuit_command_running
  fi
  # Send block boundary before prompt
  printf "\\033]1337;BlockBoundary\\007"
}

__circuit_preexec() {
  # Send block start before command execution
  printf "\\033]1337;BlockStart\\007"
  __circuit_command_running=1
}

# Bash doesn't have preexec by default, so we need to emulate it
__circuit_debug_trap() {
  if [ -n "$BASH_COMMAND" ] && [ "$BASH_COMMAND" != "__circuit_precmd" ]; then
    __circuit_preexec
  fi
}

# Register hooks
PROMPT_COMMAND="__circuit_precmd"
trap '__circuit_debug_trap' DEBUG
`,
} as const;

/**
 * Parsed block marker event from ANSI sequence
 */
export type BlockMarkerEvent =
  | { type: 'boundary' }
  | { type: 'start' }
  | { type: 'end'; exitCode: number };

/**
 * Block manager options
 */
export interface BlockManagerOptions {
  // Maximum number of blocks to keep in memory
  maxBlocks?: number;

  // Maximum output size per block (characters)
  maxOutputSize?: number;
}
