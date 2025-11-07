/**
 * Editor Store - Zustand store for file editing state
 *
 * Manages file contents, unsaved changes, and editor operations
 */

import { create } from 'zustand';

// @ts-ignore
const ipcRenderer = window.electron.ipcRenderer;

interface EditorStore {
  // Active file
  activeFile: string | null;

  // File contents (path → content)
  fileContents: Record<string, string>;

  // Unsaved changes tracker (path → hasChanges)
  unsavedChanges: Record<string, boolean>;

  // Loading/saving state
  isLoadingFile: boolean;
  isSaving: boolean;

  // Actions - Active file
  setActiveFile: (filePath: string | null) => void;

  // Actions - File operations
  loadFile: (workspacePath: string, filePath: string) => Promise<void>;
  saveFile: (workspacePath: string, filePath: string) => Promise<void>;
  updateContent: (filePath: string, content: string) => void;
  closeFile: (filePath: string) => void;
  closeAllFiles: () => void;

  // Actions - Unsaved changes
  markUnsaved: (filePath: string) => void;
  markSaved: (filePath: string) => void;
  hasUnsavedChanges: (filePath: string) => boolean;
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  // Initial state
  activeFile: null,
  fileContents: {},
  unsavedChanges: {},
  isLoadingFile: false,
  isSaving: false,

  // Set active file
  setActiveFile: (filePath) => set({ activeFile: filePath }),

  // Load file from workspace
  loadFile: async (workspacePath: string, filePath: string) => {
    // Check if already loaded
    const state = get();
    if (state.fileContents[filePath]) {
      set({ activeFile: filePath });
      return;
    }

    set({ isLoadingFile: true });

    try {
      const result = await ipcRenderer.invoke('workspace:read-file', workspacePath, filePath);

      if (result.success && result.content !== undefined) {
        set((state) => ({
          fileContents: {
            ...state.fileContents,
            [filePath]: result.content
          },
          activeFile: filePath,
          isLoadingFile: false
        }));
      } else {
        console.error('[editorStore] Failed to load file:', result.error);
        set({ isLoadingFile: false });
      }
    } catch (error) {
      console.error('[editorStore] Error loading file:', error);
      set({ isLoadingFile: false });
    }
  },

  // Save file to workspace
  saveFile: async (workspacePath: string, filePath: string) => {
    const state = get();
    const content = state.fileContents[filePath];

    if (content === undefined) {
      console.warn('[editorStore] Cannot save file - not loaded:', filePath);
      return;
    }

    set({ isSaving: true });

    try {
      const result = await ipcRenderer.invoke('workspace:write-file', workspacePath, filePath, content);

      if (result.success) {
        // Mark as saved
        set((state) => ({
          unsavedChanges: {
            ...state.unsavedChanges,
            [filePath]: false
          },
          isSaving: false
        }));
      } else {
        console.error('[editorStore] Failed to save file:', result.error);
        set({ isSaving: false });
      }
    } catch (error) {
      console.error('[editorStore] Error saving file:', error);
      set({ isSaving: false });
    }
  },

  // Update file content
  updateContent: (filePath, content) => set((state) => ({
    fileContents: {
      ...state.fileContents,
      [filePath]: content
    },
    unsavedChanges: {
      ...state.unsavedChanges,
      [filePath]: true
    }
  })),

  // Close file (remove from state)
  closeFile: (filePath) => set((state) => {
    const { [filePath]: _, ...restContents } = state.fileContents;
    const { [filePath]: __, ...restUnsaved } = state.unsavedChanges;

    return {
      fileContents: restContents,
      unsavedChanges: restUnsaved,
      activeFile: state.activeFile === filePath ? null : state.activeFile
    };
  }),

  // Close all files
  closeAllFiles: () => set({
    fileContents: {},
    unsavedChanges: {},
    activeFile: null
  }),

  // Mark file as having unsaved changes
  markUnsaved: (filePath) => set((state) => ({
    unsavedChanges: {
      ...state.unsavedChanges,
      [filePath]: true
    }
  })),

  // Mark file as saved
  markSaved: (filePath) => set((state) => ({
    unsavedChanges: {
      ...state.unsavedChanges,
      [filePath]: false
    }
  })),

  // Check if file has unsaved changes
  hasUnsavedChanges: (filePath) => {
    const state = get();
    return state.unsavedChanges[filePath] || false;
  },
}));
