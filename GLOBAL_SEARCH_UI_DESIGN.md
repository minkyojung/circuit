# 전체 파일 검색 UI 설계 문서

## 개요

상단 중앙의 브랜치 이름 영역을 활용하여 VSCode 스타일의 전체 파일 검색 기능을 구현합니다.

## 현재 구조 분석

### 1. 헤더 레이아웃 (App.tsx:87-161)

```
┌─────────────────────────────────────────────────────────┐
│ [☰]          [🔀 duck]           [Split] [Panel] │
│  ↑              ↑                    ↑       ↑      │
│ Sidebar     브랜치명            뷰모드   우측패널   │
└─────────────────────────────────────────────────────────┘
```

**핵심 코드 위치:**
- 파일: `circuit/src/App.tsx`
- 라인: 102-111
- 컴포넌트: `MainHeader`

```tsx
{/* Center - Branch name */}
{selectedWorkspace && (
  <div
    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2 text-muted-foreground text-sm font-normal"
    style={{ WebkitAppRegion: 'no-drag' } as any}
  >
    <GitBranch size={14} strokeWidth={1.5} />
    <span>{selectedWorkspace.branch}</span>
  </div>
)}
```

### 2. 현재 검색 기능

**CommandPalette (Cmd+K)**
- 파일: `circuit/src/components/CommandPalette.tsx`
- 기능: 워크스페이스 전환, 설정 열기
- 검색: Fuse.js로 fuzzy search
- **한계**: 파일 내용 검색 불가, 워크스페이스 전환만 가능

**검색 백엔드 조사:**
- `workspace:grep` IPC 핸들러: 없음
- `workspace:search` IPC 핸들러: 없음
- **결론**: 백엔드 구현 필요

---

## 설계 제안

### UI/UX 플로우

```
1. 기본 상태: [🔀 duck]
   ↓ 클릭
2. 검색 모드: [🔍 ─────────────────────]
   ↓ 입력
3. 결과 표시:
   ┌──────────────────────────────────┐
   │ 🔍 handleClick                   │
   ├──────────────────────────────────┤
   │ 📄 App.tsx:145                   │
   │    onClick={handleClick}         │
   │                                  │
   │ 📄 Button.tsx:23                 │
   │    const handleClick = () => {   │
   │                                  │
   │ 📄 utils.ts:67                   │
   │    function handleClick() {      │
   └──────────────────────────────────┘
```

### 컴포넌트 구조

```
GlobalSearchBar
├── SearchInput (검색 입력)
├── SearchResults (결과 드롭다운)
│   ├── SearchResultItem (각 결과)
│   └── SearchResultPreview (미리보기)
└── BranchDisplay (기본 브랜치 표시)
```

---

## 구현 계획

### Phase 1: 백엔드 구현 (IPC 핸들러)

**파일:** `circuit/electron/main.cjs`

```javascript
// 1. 전체 파일 검색 핸들러
ipcMain.handle('workspace:search-in-files', async (event, workspacePath, query, options = {}) => {
  try {
    const { execSync } = require('child_process');

    // ripgrep (rg) 사용 - 빠르고 강력
    const rgCommand = [
      'rg',
      '--json',                    // JSON 출력
      '--max-count', '100',        // 최대 100개 결과
      '--max-columns', '200',      // 최대 200 컬럼
      '--context', '1',            // 전후 1줄씩 표시
      '--ignore-case',             // 대소문자 무시
      `"${query}"`,                // 검색어
      workspacePath
    ].join(' ');

    const output = execSync(rgCommand, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024  // 10MB 버퍼
    });

    // JSON 파싱
    const lines = output.trim().split('\n');
    const results = [];

    for (const line of lines) {
      const parsed = JSON.parse(line);
      if (parsed.type === 'match') {
        results.push({
          path: parsed.data.path.text,
          lineNumber: parsed.data.line_number,
          lineContent: parsed.data.lines.text.trim(),
          matchStart: parsed.data.submatches[0].start,
          matchEnd: parsed.data.submatches[0].end,
        });
      }
    }

    return {
      success: true,
      results,
      totalMatches: results.length
    };
  } catch (error) {
    console.error('[Search] Error:', error);
    return {
      success: false,
      error: error.message,
      results: []
    };
  }
});
```

**대체 방법 (ripgrep 없을 경우):**
- Node.js `fs`와 정규식 사용
- 속도는 느리지만 의존성 없음

### Phase 2: 프론트엔드 컴포넌트

**새 파일 생성:** `circuit/src/components/GlobalSearchBar.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Search, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SearchResult {
  path: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

interface GlobalSearchBarProps {
  workspacePath: string;
  branchName: string;
  onFileSelect: (path: string, line: number) => void;
}

export function GlobalSearchBar({
  workspacePath,
  branchName,
  onFileSelect
}: GlobalSearchBarProps) {
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 검색창 활성화
  const activateSearch = () => {
    setIsSearchMode(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // 검색 실행 (디바운스)
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await window.require('electron').ipcRenderer.invoke(
          'workspace:search-in-files',
          workspacePath,
          query
        );

        if (result.success) {
          setResults(result.results);
        }
      } catch (error) {
        console.error('[GlobalSearch] Error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms 디바운스

    return () => clearTimeout(timeoutId);
  }, [query, workspacePath]);

  // ESC로 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchMode(false);
        setQuery('');
        setResults([]);
      }
    };

    if (isSearchMode) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isSearchMode]);

  // 결과 선택
  const handleResultClick = (result: SearchResult) => {
    onFileSelect(result.path, result.lineNumber);
    setIsSearchMode(false);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="relative">
      {/* 기본 모드: 브랜치 이름 */}
      {!isSearchMode && (
        <button
          onClick={activateSearch}
          className="flex items-center gap-2 px-3 py-1 rounded-md hover:bg-secondary/50 transition-colors text-muted-foreground text-sm"
        >
          <GitBranch size={14} strokeWidth={1.5} />
          <span>{branchName}</span>
        </button>
      )}

      {/* 검색 모드 */}
      <AnimatePresence>
        {isSearchMode && (
          <motion.div
            initial={{ width: 150, opacity: 0 }}
            animate={{ width: 400, opacity: 1 }}
            exit={{ width: 150, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute left-1/2 -translate-x-1/2"
          >
            {/* 검색 입력 */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in files..."
                className={cn(
                  "w-full pl-9 pr-3 py-1.5 text-sm",
                  "bg-secondary/50 backdrop-blur-sm rounded-md",
                  "border border-border",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "placeholder:text-muted-foreground"
                )}
              />
            </div>

            {/* 검색 결과 드롭다운 */}
            {(results.length > 0 || isSearching) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "absolute top-full left-0 right-0 mt-2",
                  "bg-popover border border-border rounded-md shadow-lg",
                  "max-h-[400px] overflow-y-auto",
                  "z-50"
                )}
              >
                {isSearching ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : (
                  <>
                    {/* 결과 개수 */}
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border">
                      {results.length} result{results.length !== 1 ? 's' : ''}
                    </div>

                    {/* 결과 목록 */}
                    {results.map((result, index) => (
                      <button
                        key={`${result.path}-${result.lineNumber}-${index}`}
                        onClick={() => handleResultClick(result)}
                        className={cn(
                          "w-full px-3 py-2 text-left",
                          "hover:bg-secondary/50 transition-colors",
                          "border-b border-border last:border-b-0"
                        )}
                      >
                        {/* 파일 경로와 라인 번호 */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-foreground">
                            {result.path}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            :{result.lineNumber}
                          </span>
                        </div>

                        {/* 매칭된 라인 */}
                        <div className="text-xs text-muted-foreground font-mono">
                          {highlightMatch(
                            result.lineContent,
                            result.matchStart,
                            result.matchEnd
                          )}
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// 검색어 하이라이트 유틸리티
function highlightMatch(text: string, start: number, end: number) {
  return (
    <>
      {text.substring(0, start)}
      <span className="bg-primary/20 text-primary font-semibold">
        {text.substring(start, end)}
      </span>
      {text.substring(end)}
    </>
  );
}
```

### Phase 3: App.tsx 통합

**수정 파일:** `circuit/src/App.tsx`

```tsx
// 기존 코드 (102-111줄) 교체

{/* Center - Global Search / Branch name */}
{selectedWorkspace && (
  <div
    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
    style={{ WebkitAppRegion: 'no-drag' } as any}
  >
    <GlobalSearchBar
      workspacePath={selectedWorkspace.path}
      branchName={selectedWorkspace.branch}
      onFileSelect={(path, line) => {
        // 파일 열기 + 라인으로 점프
        handleFileReferenceClick(path, line, line);
      }}
    />
  </div>
)}
```

---

## 기술 스택

### 백엔드
- **ripgrep (rg)**: 초고속 파일 검색 도구
  - Rust로 작성, grep보다 10-100배 빠름
  - JSON 출력 지원
  - 설치: `brew install ripgrep` (macOS)

### 프론트엔드
- **Framer Motion**: 애니메이션 (확장/축소)
- **Debounce**: 검색 최적화 (300ms)
- **Absolute Positioning**: 중앙 정렬 유지

---

## 사용자 경험

### 1. 기본 상태
```
[🔀 duck]  ← 호버 시 subtle highlight
```

### 2. 클릭 → 검색 모드
```
[🔍 ───────────────────────]  ← 400px로 확장
     ↑
   자동 포커스
```

### 3. 입력 → 실시간 검색
```
[🔍 handleClick──────────]
  ↓
┌──────────────────────────────┐
│ 3 results                    │
├──────────────────────────────┤
│ App.tsx:145                  │
│   onClick={handleClick}      │  ← 호버 시 하이라이트
└──────────────────────────────┘
```

### 4. 결과 클릭 → 파일 열기
- 해당 파일이 에디터에서 열림
- 자동으로 해당 라인으로 스크롤
- 라인 하이라이트 2초간 표시

### 5. ESC → 검색 종료
```
[🔀 duck]  ← 원래 상태로 복귀
```

---

## 성능 최적화

### 1. 디바운스
- 입력 후 300ms 대기
- 타이핑 중에는 검색 안 함

### 2. 결과 제한
- 최대 100개 결과
- 각 줄 최대 200자

### 3. 버퍼 크기
- 10MB 제한 (대용량 레포지토리 대응)

### 4. 캐싱 (선택)
- 최근 검색어 결과 캐싱
- 5분 TTL

---

## 접근성

- **키보드 네비게이션**:
  - `Tab`: 결과 간 이동
  - `Enter`: 선택
  - `ESC`: 닫기
  - `Cmd+K`: 대체 단축키 (CommandPalette와 다름)

- **스크린 리더**:
  - ARIA labels
  - 결과 개수 안내

---

## 향후 개선 사항

### Phase 2 기능
1. **파일명 검색**: 내용뿐만 아니라 파일명도 검색
2. **정규식 지원**: `/regex/` 패턴
3. **파일 타입 필터**: `*.tsx`, `*.py` 등
4. **제외 패턴**: `node_modules`, `.git` 제외
5. **검색 히스토리**: 최근 검색어 저장

### Phase 3 기능
1. **Replace 기능**: 일괄 치환
2. **대소문자 구분**: Toggle 버튼
3. **Whole Word**: 단어 단위 검색
4. **다중 워크스페이스 검색**: 여러 워크스페이스 동시 검색

---

## 구현 순서

1. **백엔드 IPC 핸들러** (1-2시간)
   - `workspace:search-in-files` 구현
   - ripgrep 통합
   - 테스트 (작은 레포지토리)

2. **GlobalSearchBar 컴포넌트** (3-4시간)
   - 기본 UI 구현
   - 애니메이션 추가
   - 결과 렌더링

3. **App.tsx 통합** (1시간)
   - 기존 브랜치 표시 교체
   - 파일 열기 연결
   - 라인 점프 구현

4. **테스트 및 최적화** (2시간)
   - 큰 레포지토리 테스트
   - 성능 프로파일링
   - 버그 수정

**총 소요 시간: 7-9시간**

---

## ripgrep 설치 가이드

### macOS
```bash
brew install ripgrep
```

### Windows
```bash
choco install ripgrep
```

### Linux (Ubuntu/Debian)
```bash
sudo apt install ripgrep
```

### 확인
```bash
rg --version
# ripgrep 14.1.0 이상
```

---

## 결론

이 설계를 통해:
- ✅ 기존 UI 공간 활용 (새 패널 불필요)
- ✅ VSCode와 유사한 UX
- ✅ 빠른 검색 (ripgrep)
- ✅ 점진적 구현 가능
- ✅ 향후 확장 가능

**다음 단계**: 백엔드 IPC 핸들러부터 시작하여 점진적으로 구현
