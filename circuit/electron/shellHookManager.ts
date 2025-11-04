/**
 * Shell Hook Manager
 *
 * Manages injection and removal of shell hooks for block detection
 * in user's shell configuration files (.zshrc, .bashrc)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const HOOK_MARKER_START = '# === Circuit Terminal Hooks START ===';
const HOOK_MARKER_END = '# === Circuit Terminal Hooks END ===';

/**
 * Shell hook scripts to inject into user's shell config
 * These hooks send ANSI sequences at key points
 */
const SHELL_HOOKS = {
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

export class ShellHookManager {
  /**
   * Inject hooks into user's shell config
   *
   * @param shellType - 'zsh' or 'bash'
   * @returns Success status and message
   */
  async injectHooks(shellType: 'zsh' | 'bash'): Promise<{ success: boolean; message: string }> {
    try {
      const configPath = this.getShellConfigPath(shellType);
      const hookScript = SHELL_HOOKS[shellType];

      // Read existing config
      let configContent = '';
      try {
        configContent = await fs.readFile(configPath, 'utf-8');
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, create it
          configContent = '';
        } else {
          throw error;
        }
      }

      // Check if hooks already exist
      if (configContent.includes(HOOK_MARKER_START)) {
        return {
          success: true,
          message: 'Hooks already installed',
        };
      }

      // Create backup
      const backupPath = `${configPath}.circuit-backup`;
      if (configContent) {
        await fs.writeFile(backupPath, configContent, 'utf-8');
      }

      // Append hooks
      const hooksSection = `\n${HOOK_MARKER_START}\n${hookScript}\n${HOOK_MARKER_END}\n`;
      const newContent = configContent + hooksSection;

      // Write updated config
      await fs.writeFile(configPath, newContent, 'utf-8');

      return {
        success: true,
        message: `Hooks installed to ${configPath}. Backup saved to ${backupPath}`,
      };
    } catch (error: any) {
      console.error('[ShellHookManager] Failed to inject hooks:', error);
      return {
        success: false,
        message: `Failed to inject hooks: ${error.message}`,
      };
    }
  }

  /**
   * Remove hooks from user's shell config
   *
   * @param shellType - 'zsh' or 'bash'
   * @returns Success status and message
   */
  async removeHooks(shellType: 'zsh' | 'bash'): Promise<{ success: boolean; message: string }> {
    try {
      const configPath = this.getShellConfigPath(shellType);

      // Read config
      let configContent: string;
      try {
        configContent = await fs.readFile(configPath, 'utf-8');
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return {
            success: true,
            message: 'Config file does not exist',
          };
        }
        throw error;
      }

      // Check if hooks exist
      if (!configContent.includes(HOOK_MARKER_START)) {
        return {
          success: true,
          message: 'Hooks not found in config',
        };
      }

      // Remove hooks section
      const startIndex = configContent.indexOf(HOOK_MARKER_START);
      const endIndex = configContent.indexOf(HOOK_MARKER_END);

      if (startIndex === -1 || endIndex === -1) {
        return {
          success: false,
          message: 'Hook markers are malformed',
        };
      }

      const before = configContent.substring(0, startIndex);
      const after = configContent.substring(endIndex + HOOK_MARKER_END.length);
      const newContent = before + after;

      // Write updated config
      await fs.writeFile(configPath, newContent, 'utf-8');

      return {
        success: true,
        message: `Hooks removed from ${configPath}`,
      };
    } catch (error: any) {
      console.error('[ShellHookManager] Failed to remove hooks:', error);
      return {
        success: false,
        message: `Failed to remove hooks: ${error.message}`,
      };
    }
  }

  /**
   * Check if hooks are currently installed
   *
   * @param shellType - 'zsh' or 'bash'
   * @returns Whether hooks are installed
   */
  async areHooksInstalled(shellType: 'zsh' | 'bash'): Promise<boolean> {
    try {
      const configPath = this.getShellConfigPath(shellType);
      const configContent = await fs.readFile(configPath, 'utf-8');
      return configContent.includes(HOOK_MARKER_START);
    } catch (error) {
      return false;
    }
  }

  /**
   * Get path to shell config file
   */
  private getShellConfigPath(shellType: 'zsh' | 'bash'): string {
    const homeDir = os.homedir();

    switch (shellType) {
      case 'zsh':
        return path.join(homeDir, '.zshrc');
      case 'bash':
        // Prefer .bashrc, fall back to .bash_profile
        return path.join(homeDir, '.bashrc');
      default:
        throw new Error(`Unsupported shell type: ${shellType}`);
    }
  }

  /**
   * Detect user's shell
   *
   * @returns Shell type or null if unknown
   */
  detectShell(): 'zsh' | 'bash' | null {
    const shell = process.env.SHELL || '';

    if (shell.includes('zsh')) {
      return 'zsh';
    } else if (shell.includes('bash')) {
      return 'bash';
    }

    return null;
  }
}

// Singleton
let shellHookManager: ShellHookManager | null = null;

export function getShellHookManager(): ShellHookManager {
  if (!shellHookManager) {
    shellHookManager = new ShellHookManager();
  }
  return shellHookManager;
}
