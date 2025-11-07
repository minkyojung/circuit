/**
 * Tests for FileChangeDetector Service
 */

import { describe, it, expect, vi } from 'vitest'
import { FileChangeDetector } from '../FileChangeDetector'

describe('FileChangeDetector', () => {
  describe('parseFileChanges', () => {
    it('should detect files in <file_path> tags', () => {
      const response = `I'll update the following files:
<file_path>src/App.tsx</file_path>
<file_path>src/components/Button.tsx</file_path>`

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toContain('src/App.tsx')
      expect(files).toContain('src/components/Button.tsx')
    })

    it('should detect files mentioned with edit verbs (English)', () => {
      const response = `I'll edit src/utils/helper.ts and modify config/settings.json`

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toContain('src/utils/helper.ts')
      expect(files).toContain('config/settings.json')
    })

    it('should detect files mentioned with edit verbs (Korean)', () => {
      const response = `src/App.tsx 파일을 수정했습니다. README.md도 변경했어요.`

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toContain('src/App.tsx')
      expect(files).toContain('README.md')
    })

    it('should detect README files without path', () => {
      const response = `I've updated README.md and LICENSE`

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toContain('README.md')
      // Note: Single word uppercase files without extension are not detected
      // This is intentional to avoid false positives
    })

    it('should detect files in code blocks', () => {
      const response = `Here's the updated code:
\`\`\`typescript
// src/index.ts
console.log('Hello');
\`\`\`

And also:
\`\`\`javascript src/app.js
export default App;
\`\`\``

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toContain('src/index.ts')
      expect(files).toContain('src/app.js')
    })

    it('should detect README files (special case)', () => {
      const response = `Please check README.md and package.json`

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toContain('README.md')
      // package.json is not detected without path as it's not all uppercase
      // This is intentional to avoid false positives
    })

    it('should deduplicate file paths', () => {
      const response = `
<file_path>src/App.tsx</file_path>
I edited src/App.tsx
The file src/App.tsx has been updated
\`\`\`typescript
// src/App.tsx
\`\`\``

      const files = FileChangeDetector.parseFileChanges(response)

      // Should only include once
      const appTsxCount = files.filter((f) => f === 'src/App.tsx').length
      expect(appTsxCount).toBe(1)
    })

    it('should handle empty response', () => {
      const response = ''

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toEqual([])
    })

    it('should handle response with no file paths', () => {
      const response = 'This is just a regular response without any file mentions.'

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toEqual([])
    })

    it('should detect nested file paths', () => {
      const response = `Updated src/components/ui/button/Button.tsx`

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toContain('src/components/ui/button/Button.tsx')
    })

    it('should detect files with dashes and underscores in paths', () => {
      const response = `Modified src/my-component_file.tsx and utils/test_helper-utils.js`

      const files = FileChangeDetector.parseFileChanges(response)

      expect(files).toContain('src/my-component_file.tsx')
      expect(files).toContain('utils/test_helper-utils.js')
    })
  })

  describe('processFileChanges', () => {
    it('should call onFileEdit for each detected file', () => {
      const onFileEdit = vi.fn()
      const response = `
<file_path>src/App.tsx</file_path>
<file_path>src/components/Button.tsx</file_path>`

      const files = FileChangeDetector.processFileChanges(response, onFileEdit)

      expect(files).toHaveLength(2)
      expect(onFileEdit).toHaveBeenCalledTimes(2)
      expect(onFileEdit).toHaveBeenCalledWith('src/App.tsx')
      expect(onFileEdit).toHaveBeenCalledWith('src/components/Button.tsx')
    })

    it('should return array of detected files', () => {
      const onFileEdit = vi.fn()
      const response = `I edited README.md`

      const files = FileChangeDetector.processFileChanges(response, onFileEdit)

      expect(files).toEqual(['README.md'])
    })

    it('should handle no files detected', () => {
      const onFileEdit = vi.fn()
      const response = 'No files here'

      const files = FileChangeDetector.processFileChanges(response, onFileEdit)

      expect(files).toEqual([])
      expect(onFileEdit).not.toHaveBeenCalled()
    })

    it('should call onFileEdit once per unique file', () => {
      const onFileEdit = vi.fn()
      const response = `
Updated src/App.tsx
Modified src/App.tsx again
src/App.tsx is ready`

      FileChangeDetector.processFileChanges(response, onFileEdit)

      // Should be called only once even though file is mentioned multiple times
      expect(onFileEdit).toHaveBeenCalledTimes(1)
      expect(onFileEdit).toHaveBeenCalledWith('src/App.tsx')
    })
  })
})
