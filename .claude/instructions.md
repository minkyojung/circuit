# Octave Development Instructions

## Project Overview
Octave is an Electron-based AI coding assistant with workspace management, MCP runtime, and intelligent todo tracking.

## Available Custom Tools

### TodoWrite Tool
Use this tool to create and track your development tasks.

**When to use TodoWrite:**
- **Plan Mode**: MANDATORY - must create todos before any work
- **Normal/Think modes**: Optional but recommended for complex tasks

**Tool Structure:**
```json
{
  "todos": [
    {
      "content": "Task description in imperative form (e.g., 'Add green theme support')",
      "activeForm": "Task in present continuous (e.g., 'Adding green theme support')",
      "status": "pending" | "in_progress" | "completed" | "failed" | "skipped",
      "complexity": "trivial" | "simple" | "moderate" | "complex" | "very_complex",
      "priority": "low" | "medium" | "high" | "critical",
      "estimatedDuration": 30,  // estimated minutes
      "order": 0,               // sequence order
      "depth": 0                // nesting level (0 = top-level)
    }
  ]
}
```

**Example Usage:**

```typescript
// Step 1: Create initial plan
<TodoWrite>
{
  "todos": [
    {
      "content": "Analyze current theme token structure",
      "activeForm": "Analyzing current theme token structure",
      "status": "pending",
      "complexity": "simple",
      "priority": "high",
      "estimatedDuration": 15,
      "order": 0,
      "depth": 0
    },
    {
      "content": "Add OKLCH green color palettes to CSS",
      "activeForm": "Adding OKLCH green color palettes",
      "status": "pending",
      "complexity": "moderate",
      "priority": "high",
      "estimatedDuration": 25,
      "order": 1,
      "depth": 0
    },
    {
      "content": "Update TypeScript theme types",
      "activeForm": "Updating TypeScript theme types",
      "status": "pending",
      "complexity": "trivial",
      "priority": "medium",
      "estimatedDuration": 5,
      "order": 2,
      "depth": 0
    }
  ]
}
</TodoWrite>

// Step 2: Start first task
<TodoWrite>
{
  "todos": [
    { "content": "Analyze...", "status": "in_progress", ... },
    { "content": "Add OKLCH...", "status": "pending", ... },
    { "content": "Update TypeScript...", "status": "pending", ... }
  ]
}
</TodoWrite>

// Step 3: Complete and move to next
<TodoWrite>
{
  "todos": [
    { "content": "Analyze...", "status": "completed", ... },
    { "content": "Add OKLCH...", "status": "in_progress", ... },
    { "content": "Update TypeScript...", "status": "pending", ... }
  ]
}
</TodoWrite>
```

## Core Development Principles

Follow these principles for all development work:

### 1. Define Goal and Approach First
- Understand the "why" before coding
- Plan your technical approach
- Consider alternatives and trade-offs

### 2. Prioritize Readability and Simplicity
- Write clean, self-documenting code
- Use clear, descriptive names
- Avoid premature optimization
- Follow existing code patterns

### 3. Commit with Clarity and Purpose
- Make atomic, logical changes
- Explain both "what" and "why"
- Keep commits focused

### 4. Build Confidence with Tests
- Verify changes work correctly
- Consider edge cases
- Test before marking tasks complete
- Run existing tests to prevent regressions

## Code Style Guidelines

### TypeScript
- Use strict TypeScript types
- Prefer interfaces over types for objects
- Use const assertions where appropriate
- Avoid `any` - use `unknown` if truly needed

### React
- Use functional components with hooks
- Follow existing component patterns
- Keep components focused and composable
- Use proper TypeScript props interfaces

### File Organization
```
octave/
├── src/
│   ├── components/     # React UI components
│   ├── contexts/       # React contexts
│   ├── hooks/          # Custom React hooks
│   ├── lib/            # Utility functions
│   ├── types/          # TypeScript type definitions
│   └── core/           # Core business logic
├── electron/           # Electron main process
│   ├── *Handlers.ts    # IPC handlers
│   ├── *Storage.ts     # Database operations
│   └── main.cjs        # Main entry point
```

## Testing
- Run `npm run build` to verify TypeScript compilation
- Manual testing in the app for UI changes
- Check console for errors

## Working with Database
Octave uses SQLite for storage. Database files are stored in the Application Support directory.

- Conversations: `conversationStorage.ts`
- Todos: `todoHandlers.ts`
- Use transactions for multi-row operations

## Common Patterns

### Adding a new IPC handler
1. Create handler function in appropriate `*Handlers.ts`
2. Register in `main.cjs`
3. Call from renderer via `ipcRenderer.invoke()`

### Adding a new React component
1. Create in appropriate `components/` subdirectory
2. Export from `index.ts` if part of a module
3. Use existing design tokens for styling
4. Follow responsive design patterns

### Updating database schema
1. Increment `schemaVersion` in storage file
2. Add migration in `runMigrations()`
3. Update TypeScript interfaces
4. Update CRUD methods

## Remember

- In **Plan Mode**: TodoWrite is MANDATORY before any work
- In other modes: Use TodoWrite for complex, multi-step tasks
- Always update todo status as you progress
- Follow the 4 core development principles
- Keep code clean, tested, and maintainable
