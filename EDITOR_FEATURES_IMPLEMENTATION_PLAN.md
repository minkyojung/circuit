# 기본 에디터 기능 구현 계획

Circuit의 기본 에디터 기능을 순차적으로 구현하기 위한 상세 계획서입니다.

---

## 현재 코드베이스 분석

### 구조
```
circuit/
├── src/
│   ├── components/
│   │   ├── TodoPanel.tsx           # 우측 사이드바 (현재: 터미널만)
│   │   ├── workspace/
│   │   │   └── WorkspaceChatEditor.tsx  # Monaco Editor 통합
│   │   └── GlobalSearchBar.tsx     # 전체 파일 검색 (완료)
│   ├── App.tsx                     # 메인 레이아웃
│   └── ...
├── electron/
│   └── main.cjs                    # IPC 핸들러들
└── package.json
```

### 현재 상태
- ✅ Monaco Editor 통합됨
- ✅ 우측 사이드바 구조 있음 (Sidebar 컴포넌트)
- ✅ IPC 핸들러 시스템 있음
- ✅ TypeScript 5.9.3 설치됨
- ✅ 전체 파일 검색 완료

---

## 1. Problems 패널 구현

### 목표
프로젝트 전체의 TypeScript 에러, ESLint 경고를 한눈에 보여주는 패널

### UI 디자인
```
┌─────────────────────────────────────────┐
│ ⚠ Problems                        [↻]  │
├─────────────────────────────────────────┤
│ 🔴 12 Errors    ⚠️ 5 Warnings          │
├─────────────────────────────────────────┤
│ 🔴 Type 'string' is not assignable...  │
│    App.tsx:145                          │
│                                         │
│ 🔴 Cannot find name 'handleClick'      │
│    Button.tsx:23                        │
│                                         │
│ ⚠️ Unused variable 'count'             │
│    Counter.tsx:12                       │
└─────────────────────────────────────────┘
```

### 구현 단계

#### Phase 1: 백엔드 - TypeScript Diagnostics (2시간)

**파일**: `circuit/electron/main.cjs`

```javascript
// 1. TypeScript 진단 실행 IPC 핸들러
ipcMain.handle('typescript:get-diagnostics', async (event, workspacePath) => {
  try {
    const ts = require('typescript');
    const path = require('path');

    // tsconfig.json 읽기
    const configPath = path.join(workspacePath, 'tsconfig.json');
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      workspacePath
    );

    // TypeScript 프로그램 생성
    const program = ts.createProgram({
      rootNames: parsedConfig.fileNames,
      options: parsedConfig.options,
    });

    // 진단 정보 수집
    const diagnostics = [];

    // Semantic diagnostics (타입 에러)
    program.getSourceFiles().forEach(sourceFile => {
      if (!sourceFile.fileName.includes('node_modules')) {
        const fileDiagnostics = program.getSemanticDiagnostics(sourceFile);

        fileDiagnostics.forEach(diagnostic => {
          if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
              diagnostic.start
            );

            diagnostics.push({
              severity: 'error',
              message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
              file: path.relative(workspacePath, diagnostic.file.fileName),
              line: line + 1,
              character: character + 1,
              code: diagnostic.code,
            });
          }
        });
      }
    });

    // Syntactic diagnostics (문법 에러)
    program.getSourceFiles().forEach(sourceFile => {
      if (!sourceFile.fileName.includes('node_modules')) {
        const syntacticDiagnostics = program.getSyntacticDiagnostics(sourceFile);

        syntacticDiagnostics.forEach(diagnostic => {
          if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
              diagnostic.start
            );

            diagnostics.push({
              severity: 'error',
              message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
              file: path.relative(workspacePath, diagnostic.file.fileName),
              line: line + 1,
              character: character + 1,
              code: diagnostic.code,
            });
          }
        });
      }
    });

    return {
      success: true,
      diagnostics,
      totalErrors: diagnostics.filter(d => d.severity === 'error').length,
      totalWarnings: diagnostics.filter(d => d.severity === 'warning').length,
    };
  } catch (error) {
    console.error('[TypeScript] Diagnostics error:', error);
    return {
      success: false,
      error: error.message,
      diagnostics: [],
    };
  }
});

// 2. ESLint 진단 실행 (옵션)
ipcMain.handle('eslint:get-diagnostics', async (event, workspacePath) => {
  // ESLint 통합 (나중에 추가 가능)
});
```

#### Phase 2: 프론트엔드 - ProblemsPanel 컴포넌트 (2-3시간)

**파일**: `circuit/src/components/problems/ProblemsPanel.tsx`

```tsx
import { useState, useEffect } from 'react';
import { AlertCircle, AlertTriangle, RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// @ts-ignore
const { ipcRenderer } = window.require('electron');

interface Diagnostic {
  severity: 'error' | 'warning';
  message: string;
  file: string;
  line: number;
  character: number;
  code: number;
}

interface ProblemsPanelProps {
  workspacePath: string;
  onFileClick: (path: string, line: number) => void;
}

export function ProblemsPanel({ workspacePath, onFileClick }: ProblemsPanelProps) {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Load diagnostics
  const loadDiagnostics = async () => {
    setIsLoading(true);
    try {
      const result = await ipcRenderer.invoke('typescript:get-diagnostics', workspacePath);

      if (result.success) {
        setDiagnostics(result.diagnostics);
      }
    } catch (error) {
      console.error('[ProblemsPanel] Error loading diagnostics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load on mount
  useEffect(() => {
    loadDiagnostics();
  }, [workspacePath]);

  // Group by file
  const groupedDiagnostics = diagnostics.reduce((acc, diagnostic) => {
    if (!acc[diagnostic.file]) {
      acc[diagnostic.file] = [];
    }
    acc[diagnostic.file].push(diagnostic);
    return acc;
  }, {} as Record<string, Diagnostic[]>);

  const totalErrors = diagnostics.filter(d => d.severity === 'error').length;
  const totalWarnings = diagnostics.filter(d => d.severity === 'warning').length;

  const toggleGroup = (file: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(file)) {
      newExpanded.delete(file);
    } else {
      newExpanded.add(file);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-destructive" />
          <span className="text-sm font-medium">Problems</span>
        </div>
        <button
          onClick={loadDiagnostics}
          disabled={isLoading}
          className={cn(
            "p-1 rounded hover:bg-secondary transition-colors",
            isLoading && "animate-spin"
          )}
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 px-4 py-2 text-xs bg-secondary/30">
        <div className="flex items-center gap-1 text-destructive">
          <AlertCircle size={12} />
          <span>{totalErrors} Errors</span>
        </div>
        <div className="flex items-center gap-1 text-warning">
          <AlertTriangle size={12} />
          <span>{totalWarnings} Warnings</span>
        </div>
      </div>

      {/* Problems List */}
      <ScrollArea className="flex-1">
        {Object.entries(groupedDiagnostics).map(([file, fileDiagnostics]) => (
          <div key={file} className="border-b border-border last:border-b-0">
            {/* File Header */}
            <button
              onClick={() => toggleGroup(file)}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-secondary/50 transition-colors"
            >
              <ChevronRight
                size={14}
                className={cn(
                  "transition-transform",
                  expandedGroups.has(file) && "rotate-90"
                )}
              />
              <span className="text-xs font-medium truncate">{file}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {fileDiagnostics.length}
              </span>
            </button>

            {/* Diagnostics */}
            {expandedGroups.has(file) && (
              <div className="bg-secondary/20">
                {fileDiagnostics.map((diagnostic, index) => (
                  <button
                    key={`${file}-${index}`}
                    onClick={() => onFileClick(diagnostic.file, diagnostic.line)}
                    className="w-full px-8 py-2 text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      {diagnostic.severity === 'error' ? (
                        <AlertCircle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                      ) : (
                        <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground">{diagnostic.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {file}:{diagnostic.line}:{diagnostic.character}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Empty State */}
        {diagnostics.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <AlertCircle size={32} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No problems detected</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

#### Phase 3: 통합 (1시간)

**파일**: `circuit/src/components/TodoPanel.tsx`

```tsx
// 탭 추가로 Problems와 Terminal 분리

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertCircle, Terminal as TerminalIcon } from 'lucide-react';
import { ProblemsPanel } from '@/components/problems/ProblemsPanel';
import { Terminal } from '@/components/Terminal';

export function TodoPanel({ workspace, onCommit, onFileSelect }: TodoPanelProps) {
  const [activeTab, setActiveTab] = useState('terminal');

  return (
    <>
      <SidebarHeader>...</SidebarHeader>

      <SidebarContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="problems" className="gap-2">
              <AlertCircle size={14} />
              Problems
            </TabsTrigger>
            <TabsTrigger value="terminal" className="gap-2">
              <TerminalIcon size={14} />
              Terminal
            </TabsTrigger>
          </TabsList>

          <TabsContent value="problems" className="flex-1 overflow-hidden">
            {workspace && (
              <ProblemsPanel
                workspacePath={workspace.path}
                onFileClick={onFileSelect}
              />
            )}
          </TabsContent>

          <TabsContent value="terminal" className="flex-1 overflow-hidden">
            {workspace && <Terminal workspace={workspace} />}
          </TabsContent>
        </Tabs>
      </SidebarContent>
    </>
  );
}
```

### 예상 시간
- **백엔드**: 2시간
- **프론트엔드**: 2-3시간
- **통합 & 테스트**: 1시간
- **총**: 5-6시간

---

## 2. 아웃라인 뷰 (Outline View)

### 목표
현재 열린 파일의 함수, 클래스, 인터페이스 구조를 트리 형태로 표시

### UI 디자인
```
┌─────────────────────────────────────────┐
│ 📋 Outline                    App.tsx   │
├─────────────────────────────────────────┤
│ 📦 MainHeader                           │
│   ├─ 📦 Props                           │
│   └─ 🔧 render                          │
│                                         │
│ 🔷 App                                  │
│   ├─ 🔧 handleFileSelect                │
│   ├─ 🔧 handleWorkspaceSelect           │
│   └─ 🔧 render                          │
│                                         │
│ 🔷 interface ProjectPathContextValue   │
│   ├─ projectPath: string                │
│   └─ isLoading: boolean                 │
└─────────────────────────────────────────┘
```

### 구현 단계

#### Phase 1: 백엔드 - TypeScript AST 파싱 (2시간)

**파일**: `circuit/electron/main.cjs`

```javascript
ipcMain.handle('typescript:get-outline', async (event, filePath) => {
  try {
    const ts = require('typescript');
    const fs = require('fs');
    const path = require('path');

    // 파일 읽기
    const sourceCode = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(
      path.basename(filePath),
      sourceCode,
      ts.ScriptTarget.Latest,
      true
    );

    const symbols = [];

    // AST 순회
    function visit(node, parent = null) {
      let symbol = null;

      // Function Declaration
      if (ts.isFunctionDeclaration(node) && node.name) {
        symbol = {
          name: node.name.text,
          kind: 'function',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Class Declaration
      else if (ts.isClassDeclaration(node) && node.name) {
        symbol = {
          name: node.name.text,
          kind: 'class',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Interface Declaration
      else if (ts.isInterfaceDeclaration(node)) {
        symbol = {
          name: node.name.text,
          kind: 'interface',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Method Declaration
      else if (ts.isMethodDeclaration(node) && node.name) {
        const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile);
        symbol = {
          name,
          kind: 'method',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Property Declaration
      else if (ts.isPropertyDeclaration(node) && node.name) {
        const name = ts.isIdentifier(node.name) ? node.name.text : node.name.getText(sourceFile);
        symbol = {
          name,
          kind: 'property',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Variable Declaration
      else if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        symbol = {
          name: node.name.text,
          kind: 'variable',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }
      // Type Alias
      else if (ts.isTypeAliasDeclaration(node)) {
        symbol = {
          name: node.name.text,
          kind: 'type',
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          children: [],
        };
      }

      if (symbol) {
        if (parent) {
          parent.children.push(symbol);
        } else {
          symbols.push(symbol);
        }

        // Visit children with this symbol as parent
        ts.forEachChild(node, child => visit(child, symbol));
      } else {
        // Continue visiting children
        ts.forEachChild(node, child => visit(child, parent));
      }
    }

    visit(sourceFile);

    return {
      success: true,
      symbols,
    };
  } catch (error) {
    console.error('[TypeScript] Outline error:', error);
    return {
      success: false,
      error: error.message,
      symbols: [],
    };
  }
});
```

#### Phase 2: 프론트엔드 - OutlinePanel 컴포넌트 (2시간)

**파일**: `circuit/src/components/outline/OutlinePanel.tsx`

```tsx
import { useState, useEffect } from 'react';
import { ChevronRight, FileCode, Box, Braces, Circle, Function } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// @ts-ignore
const { ipcRenderer } = window.require('electron');

interface Symbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'method' | 'property' | 'variable' | 'type';
  line: number;
  children: Symbol[];
}

interface OutlinePanelProps {
  filePath: string | null;
  onSymbolClick: (line: number) => void;
}

const kindIcons = {
  function: Function,
  class: Box,
  interface: Braces,
  method: Function,
  property: Circle,
  variable: Circle,
  type: FileCode,
};

const kindColors = {
  function: 'text-blue-500',
  class: 'text-purple-500',
  interface: 'text-cyan-500',
  method: 'text-green-500',
  property: 'text-yellow-500',
  variable: 'text-orange-500',
  type: 'text-pink-500',
};

export function OutlinePanel({ filePath, onSymbolClick }: OutlinePanelProps) {
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!filePath) {
      setSymbols([]);
      return;
    }

    loadOutline();
  }, [filePath]);

  const loadOutline = async () => {
    if (!filePath) return;

    try {
      const result = await ipcRenderer.invoke('typescript:get-outline', filePath);

      if (result.success) {
        setSymbols(result.symbols);
        // Auto-expand first level
        const firstLevel = result.symbols.map((s: Symbol) => s.name);
        setExpandedNodes(new Set(firstLevel));
      }
    } catch (error) {
      console.error('[OutlinePanel] Error:', error);
    }
  };

  const toggleNode = (name: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedNodes(newExpanded);
  };

  const renderSymbol = (symbol: Symbol, depth = 0) => {
    const Icon = kindIcons[symbol.kind];
    const hasChildren = symbol.children.length > 0;
    const isExpanded = expandedNodes.has(symbol.name);

    return (
      <div key={`${symbol.name}-${depth}`}>
        <button
          onClick={() => {
            if (hasChildren) {
              toggleNode(symbol.name);
            }
            onSymbolClick(symbol.line);
          }}
          className="w-full flex items-center gap-2 px-2 py-1 hover:bg-secondary/50 transition-colors text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {hasChildren && (
            <ChevronRight
              size={12}
              className={cn(
                "transition-transform flex-shrink-0",
                isExpanded && "rotate-90"
              )}
            />
          )}
          {!hasChildren && <div className="w-3" />}

          <Icon size={14} className={cn("flex-shrink-0", kindColors[symbol.kind])} />
          <span className="text-xs truncate">{symbol.name}</span>
        </button>

        {hasChildren && isExpanded && (
          <div>
            {symbol.children.map(child => renderSymbol(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <FileCode size={16} />
          <span className="text-sm font-medium">Outline</span>
        </div>
      </div>

      {/* Symbols Tree */}
      <ScrollArea className="flex-1">
        {symbols.length > 0 ? (
          <div className="py-1">
            {symbols.map(symbol => renderSymbol(symbol))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <FileCode size={32} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {filePath ? 'No symbols found' : 'Open a file to see its outline'}
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
```

#### Phase 3: 통합 (30분)

TodoPanel에 Outline 탭 추가

### 예상 시간
- **백엔드**: 2시간
- **프론트엔드**: 2시간
- **통합 & 테스트**: 30분
- **총**: 4.5시간

---

## 3. 심볼로 이동 (Go to Symbol)

### 목표
Cmd+Shift+O로 현재 파일 내 함수/클래스 빠른 검색

### UI 디자인
```
┌─────────────────────────────────────────┐
│ 🔍 Go to Symbol in File               │
│ ┌───────────────────────────────────┐  │
│ │ handleClick                        │  │
│ └───────────────────────────────────┘  │
├─────────────────────────────────────────┤
│ 🔧 handleClick                    :145 │
│ 🔧 handleFileSelect                :234 │
│ 🔧 handleWorkspaceSelect           :289 │
│ 🔷 MainHeader                      :67  │
└─────────────────────────────────────────┘
```

### 구현 단계

#### Phase 1: SymbolSearch 컴포넌트 (2시간)

**파일**: `circuit/src/components/symbol/SymbolSearchDialog.tsx`

```tsx
import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import Fuse from 'fuse.js';

// @ts-ignore
const { ipcRenderer } = window.require('electron');

interface SymbolSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filePath: string | null;
  onSymbolSelect: (line: number) => void;
}

export function SymbolSearchDialog({
  open,
  onOpenChange,
  filePath,
  onSymbolSelect
}: SymbolSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [symbols, setSymbols] = useState([]);
  const [filteredSymbols, setFilteredSymbols] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load symbols when dialog opens
  useEffect(() => {
    if (open && filePath) {
      loadSymbols();
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setSymbols([]);
      setFilteredSymbols([]);
      setSelectedIndex(0);
    }
  }, [open, filePath]);

  const loadSymbols = async () => {
    if (!filePath) return;

    const result = await ipcRenderer.invoke('typescript:get-outline', filePath);
    if (result.success) {
      // Flatten symbols
      const flatSymbols = [];
      function flatten(syms, parent = '') {
        syms.forEach(s => {
          flatSymbols.push({
            ...s,
            fullName: parent ? `${parent}.${s.name}` : s.name,
          });
          if (s.children.length > 0) {
            flatten(s.children, s.name);
          }
        });
      }
      flatten(result.symbols);

      setSymbols(flatSymbols);
      setFilteredSymbols(flatSymbols);
    }
  };

  // Fuzzy search
  useEffect(() => {
    if (!query.trim()) {
      setFilteredSymbols(symbols);
      setSelectedIndex(0);
      return;
    }

    const fuse = new Fuse(symbols, {
      keys: ['name', 'fullName'],
      threshold: 0.3,
    });

    const results = fuse.search(query);
    setFilteredSymbols(results.map(r => r.item));
    setSelectedIndex(0);
  }, [query, symbols]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredSymbols.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredSymbols[selectedIndex]) {
          onSymbolSelect(filteredSymbols[selectedIndex].line);
          onOpenChange(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20"
        onClick={() => onOpenChange(false)}
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-[600px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
        >
          {/* Search Input */}
          <div className="relative border-b border-border">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Go to Symbol in File"
              className="w-full pl-12 pr-4 py-3 bg-transparent text-sm outline-none"
            />
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto">
            {filteredSymbols.length > 0 ? (
              filteredSymbols.map((symbol, index) => {
                const Icon = kindIcons[symbol.kind];
                return (
                  <button
                    key={`${symbol.name}-${index}`}
                    onClick={() => {
                      onSymbolSelect(symbol.line);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors",
                      selectedIndex === index && "bg-secondary"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={16} className={kindColors[symbol.kind]} />
                      <span className="text-sm">{symbol.fullName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">:{symbol.line}</span>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No symbols found
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
```

#### Phase 2: 키보드 단축키 통합 (30분)

**파일**: `circuit/src/hooks/useKeyboardShortcuts.ts`

```tsx
// Cmd+Shift+O 단축키 추가
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // ... 기존 단축키들

    // Go to Symbol
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'o') {
      e.preventDefault();
      setShowSymbolSearch(true);
    }
  };

  // ...
}, []);
```

### 예상 시간
- **컴포넌트**: 2시간
- **키보드 단축키**: 30분
- **통합 & 테스트**: 30분
- **총**: 3시간

---

## 구현 순서 추천

### Week 1: Problems 패널
1. Day 1: 백엔드 TypeScript 진단 (2시간)
2. Day 2: 프론트엔드 ProblemsPanel (3시간)
3. Day 3: 통합 & 테스트 (1시간)

### Week 2: 아웃라인 뷰 + 심볼 검색
4. Day 4-5: 아웃라인 뷰 (4.5시간)
5. Day 6: 심볼로 이동 (3시간)

### 총 소요 시간: 13.5시간

---

## 다음 단계: LSP 통합

Problems, Outline, Symbol Search가 완료되면, 다음은 **Language Server Protocol (LSP)** 통합입니다.

LSP 통합 시 얻는 것:
- 실시간 자동완성 (IntelliSense)
- 타입 힌트
- 정의로 이동 (F12)
- 모든 참조 찾기
- Quick Fix (전구 아이콘)
- 실시간 에러 밑줄

**예상 시간**: 1주일

---

## 참고 자료

- TypeScript Compiler API: https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API
- Monaco Editor API: https://microsoft.github.io/monaco-editor/docs.html
- LSP Specification: https://microsoft.github.io/language-server-protocol/
