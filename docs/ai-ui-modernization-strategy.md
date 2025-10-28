# AI UI Modernization Strategy

**작성일:** 2025-10-29
**작성자:** Architect Agent
**상태:** 설계 완료 (Design Complete)

---

## 📋 Executive Summary

본 문서는 Conductor 프로젝트의 AI UI 컴포넌트를 [AI SDK Elements](https://ai-sdk.dev/elements)의 모범 사례와 통합하기 위한 전략적 로드맵을 제시합니다.

**핵심 발견:**
- ✅ 현재 Block 기반 아키텍처는 잘 설계되어 있음 (유지)
- ⚠️ 두 개의 중복된 컴포넌트 세트가 존재 (통합 필요)
- 🎯 AI SDK Elements의 고급 기능을 점진적으로 통합 (3단계 로드맵)

**예상 효과:**
- 스트리밍 UI 개선 (Shimmer, Loader 추가)
- AI 추론 과정 시각화 (Reasoning, ChainOfThought)
- 파일 첨부 기능 즉시 사용 가능
- 코드 하이라이팅 품질 향상 (Prism → Shiki)

---

## 📊 현재 상태 분석

### 1.1 현재 아키텍처의 강점

#### Block 기반 설계 철학

Warp Terminal에서 영감을 받은 Block 아키텍처는 메시지를 의미 단위로 분할하여 독립적 상호작용을 가능하게 합니다:

```typescript
// src/types/conversation.ts
export interface Block {
  id: string              // 고유 블록 ID
  messageId: string       // 부모 메시지 ID
  type: BlockType         // 11가지 타입 지원
  content: string         // 원본 콘텐츠
  metadata: BlockMetadata // 타입별 메타데이터
  order: number           // 메시지 내 순서
  createdAt: string       // 생성 시간
}
```

**지원하는 Block 타입:**
- `text` - 일반 텍스트/Markdown
- `code` - 코드 스니펫
- `command` - 실행 가능한 셸 명령어
- `file` - 파일 참조
- `diff` - Git diff
- `error` - 에러 메시지
- `result` - 명령 실행 결과
- `diagram` - 다이어그램 (예정)
- `link`, `quote`, `list`, `table` (예정)

#### 명확한 책임 분리

```
User Input → IPC → Claude API → Markdown
                                    ↓
                        messageParser.ts (파싱)
                                    ↓
                              Block[] 배열
                                    ↓
                         BlockRenderer.tsx (라우팅)
                                    ↓
              ┌───────────┬─────────┴─────────┬──────────┐
              ↓           ↓                   ↓          ↓
          TextBlock   CodeBlock         CommandBlock  DiffBlock
```

### 1.2 현재 구현의 문제점

#### ⚠️ 중복된 컴포넌트 구조

현재 코드베이스에 **두 개의 서로 다른 AI 컴포넌트 세트**가 존재합니다:

| 위치 | 용도 | 특징 | 문제 |
|------|------|------|------|
| `src/components/ai-elements/` | AI SDK Elements 스타일 | • Shiki 사용<br>• shadcn/ui 기반<br>• AI SDK 타입 의존 | **사용되지 않음** |
| `src/components/blocks/` | 실제 사용 중 | • Prism 사용<br>• 자체 스타일<br>• 독자적 Block 타입 | **AI SDK와 단절** |

**구체적 중복 사례:**

1. **CodeBlock 중복**
   - `ai-elements/code-block.tsx` (179줄) - Shiki 기반, AI SDK 통합
   - `blocks/CodeBlock.tsx` (202줄) - Prism 기반, 독자적 구현

2. **입력 컴포넌트 중복**
   - `ai-elements/prompt-input.tsx` (1352줄) - AI SDK의 복잡한 PromptInput
   - `WorkspaceChatEditor.tsx` (L578-656) - 자체 구현 textarea + 버튼

#### ⚠️ 통합되지 않은 상태 관리

```typescript
// WorkspaceChatEditor.tsx - 로컬 상태만 사용
const [messages, setMessages] = useState<Message[]>([])
const [input, setInput] = useState('')
const [isSending, setIsSending] = useState(false)
```

AI SDK의 `useChat`, `useCompletion` 같은 훅을 전혀 사용하지 않습니다.

#### ⚠️ 스타일링 일관성 부족

```typescript
// blocks/CodeBlock.tsx - 하드코딩된 색상
border-[#857850]/30 bg-[#857850]/5

// ai-elements/code-block.tsx - CSS 변수
border-border bg-card text-foreground
```

---

## 🎯 AI SDK Elements 구조 분석

### 2.1 핵심 설계 원칙

#### 1. Composability (조합 가능성)

컴포넌트를 레고 블록처럼 자유롭게 조합:

```tsx
<PromptInput>
  <PromptInput.Textarea />
  <PromptInput.AttachButton />
  <PromptInput.SendButton />
</PromptInput>
```

#### 2. shadcn/ui 일관성

- Radix UI 프리미티브 기반
- CSS 변수로 테마 통합
- `cn()` 유틸리티로 클래스 병합

#### 3. AI SDK 네이티브 통합

```tsx
const { messages, input, handleSubmit } = useChat()

<PromptInput
  value={input}
  onSubmit={handleSubmit}
/>
```

### 2.2 제공되는 컴포넌트 카탈로그

#### Chatbot Components (24개)

**메시지 표시:**
- `<Message>` - 메시지 컨테이너
- `<Response>` - AI 응답 래퍼
- `<Loader>` - 로딩 인디케이터
- `<Shimmer>` - 스켈레톤 UI

**사용자 입력:**
- `<PromptInput>` - 다기능 입력 컴포넌트
- `<Suggestion>` - 제안 버튼
- `<Actions>` - 액션 버튼 그룹

**AI 추론 시각화:**
- `<ChainOfThought>` - 사고 과정 표시
- `<Reasoning>` - 추론 단계 (접기/펼치기)
- `<Plan>` - 실행 계획

**콘텐츠 블록:**
- `<CodeBlock>` - Shiki 기반 코드 하이라이팅
- `<Tool>` - 도구 호출 표시
- `<Sources>` - 출처 인용
- `<InlineCitation>` - 인라인 참조

#### Workflow Components (7개)

React Flow 기반:
- `<Canvas>` - 노드 캔버스
- `<Node>` - 워크플로우 노드
- `<Edge>` - 노드 연결선
- `<Connection>` - 연결 관리
- `<Controls>` - 줌/패닝 컨트롤
- `<Panel>` - 사이드 패널
- `<Toolbar>` - 도구 모음

---

## 📉 Gap Analysis (격차 분석)

### 3.1 기능적 격차

| 기능 | 현재 구현 | AI SDK Elements | 우선순위 |
|------|-----------|------------------|----------|
| **스트리밍 표시** | `"Thinking..."` 텍스트 | `<Loader>`, `<Shimmer>` | ⭐⭐⭐ |
| **추론 과정 표시** | 없음 | `<Reasoning>`, `<ChainOfThought>` | ⭐⭐⭐ |
| **코드 하이라이팅** | Prism (정적) | Shiki (더 정확) | ⭐⭐ |
| **파일 첨부** | 없음 | `<PromptInput.AttachButton>` | ⭐⭐⭐ |
| **제안 버튼** | 없음 | `<Suggestion>` | ⭐⭐ |
| **인용 표시** | 없음 | `<Sources>`, `<InlineCitation>` | ⭐⭐ |
| **도구 호출 표시** | 없음 | `<Tool>` | ⭐⭐⭐ |

### 3.2 아키텍처 격차

**현재 흐름:**
```
User Input → IPC → Claude API → Raw Markdown → MessageParser → Blocks → BlockRenderer
```

**AI SDK Elements 권장 흐름:**
```
User Input → useChat Hook → Streaming Response → React Components → Real-time UI
```

**핵심 차이점:**
1. **상태 관리**: 수동 상태 관리 vs AI SDK 훅
2. **스트리밍**: 전체 응답 대기 vs 실시간 청크 렌더링
3. **타입 안정성**: 독자적 타입 vs AI SDK 표준 타입

### 3.3 UX 격차

| UX 요소 | 현재 | 권장 | 영향도 |
|---------|------|------|--------|
| **로딩 피드백** | "Thinking..." | Shimmer + Progress | ⭐⭐⭐ |
| **에러 처리** | Alert/Console | Toast + 인라인 에러 | ⭐⭐ |
| **컨텍스트 추가** | 비활성 버튼 | 동작하는 @ 멘션 | ⭐⭐⭐ |
| **응답 중단** | 없음 | Stop 버튼 | ⭐⭐ |
| **재시도** | 수동 재입력 | 자동 재시도 버튼 | ⭐⭐ |

---

## 🗺️ 전략적 개선 로드맵

### Phase 1: 기초 통합 (1-2주)

**목표:** AI SDK Elements를 기존 Block 아키텍처와 병합

#### 작업 항목

**1. 중복 제거 전략 수립**

```typescript
// 우선순위 1: CodeBlock 통합
// blocks/CodeBlock.tsx를 ai-elements/code-block.tsx 기반으로 재작성

// Before: Prism 사용
import Prism from 'prismjs'
const html = Prism.highlight(code, Prism.languages[lang], lang)

// After: Shiki 사용
import { highlightCode } from '@/components/ai-elements/code-block'
const [html, darkHtml] = await highlightCode(code, lang, showLineNumbers)
```

**2. 타입 시스템 통합**

```typescript
// src/lib/aiSDKAdapter.ts 생성
import type { Message as AIMessage } from 'ai'
import type { Message, Block } from '@/types/conversation'

/**
 * AI SDK 메시지 → Block 배열 변환
 */
export function aiMessageToBlocks(aiMsg: AIMessage): Block[] {
  const blocks: Block[] = []

  // 텍스트 콘텐츠 파싱
  if (aiMsg.content) {
    const parsed = parseMessageToBlocks(aiMsg.content, aiMsg.id)
    blocks.push(...parsed.blocks)
  }

  // 도구 호출 처리
  if (aiMsg.toolInvocations) {
    for (const tool of aiMsg.toolInvocations) {
      blocks.push({
        id: `block-tool-${tool.toolCallId}`,
        messageId: aiMsg.id,
        type: 'command',
        content: JSON.stringify(tool.args, null, 2),
        metadata: {
          toolName: tool.toolName,
          toolCallId: tool.toolCallId,
          state: tool.state,
          result: tool.result,
        },
        order: blocks.length,
        createdAt: new Date().toISOString(),
      })
    }
  }

  return blocks
}

/**
 * Block 배열 → AI SDK 메시지 변환 (역방향)
 */
export function blocksToAIMessage(
  blocks: Block[],
  role: 'user' | 'assistant'
): AIMessage {
  const content = blocks
    .filter(b => b.type === 'text')
    .map(b => b.content)
    .join('\n\n')

  return {
    id: blocks[0]?.messageId || nanoid(),
    role,
    content,
    createdAt: new Date(blocks[0]?.createdAt || Date.now()),
  }
}
```

**3. 스타일 시스템 통일**

```typescript
// Before: 하드코딩된 색상
<div className="border-[#857850]/30 bg-[#857850]/5">

// After: CSS 변수
<div className="border-border/30 bg-card/5">
```

`design-tokens.css` 확장:

```css
:root {
  /* 기존 변수 유지 */
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;

  /* 추가: 코드 블록 전용 변수 */
  --code-block-border: 43 33% 55% / 0.3;
  --code-block-bg: 43 33% 55% / 0.05;
  --code-block-header: 43 33% 55% / 0.1;
}
```

#### 완료 조건

- [ ] `blocks/CodeBlock.tsx`가 Shiki 사용
- [ ] `aiSDKAdapter.ts` 생성 및 테스트 완료
- [ ] 모든 컴포넌트가 CSS 변수 사용
- [ ] 기존 기능 100% 유지 (회귀 없음)

---

### Phase 2: 고급 기능 추가 (2-3주)

**목표:** AI SDK Elements의 고급 컴포넌트 활용

#### 작업 항목

**1. Reasoning 컴포넌트 통합**

```tsx
// WorkspaceChatEditor.tsx에 추가
import { Reasoning } from '@/components/ai-elements/reasoning'

{isSending && (
  <Reasoning
    isStreaming={true}
    duration={thinkingDuration}
    defaultOpen={true}
  >
    <Reasoning.Title>
      <Brain className="w-4 h-4" />
      Claude is thinking...
    </Reasoning.Title>
    <Reasoning.Content>
      {currentThinkingStep || 'Analyzing your request...'}
    </Reasoning.Content>
    <Reasoning.Footer>
      <span className="text-xs text-muted-foreground">
        {thinkingDuration > 0 ? `${thinkingDuration}s` : 'Processing...'}
      </span>
    </Reasoning.Footer>
  </Reasoning>
)}
```

**2. 도구 호출 시각화**

```tsx
// BlockRenderer.tsx에 Tool 타입 추가
import { Tool } from '@/components/ai-elements/tool'

case 'tool':
  return renderWithBlockId(
    <Tool
      name={block.metadata.toolName}
      state={block.metadata.state}
      result={block.metadata.result}
    >
      <Tool.Header>
        <Tool.Icon />
        <Tool.Name>{block.metadata.toolName}</Tool.Name>
        <Tool.Status state={block.metadata.state} />
      </Tool.Header>
      <Tool.Args>
        {JSON.stringify(block.metadata.args, null, 2)}
      </Tool.Args>
      {block.metadata.result && (
        <Tool.Result>
          {block.metadata.result}
        </Tool.Result>
      )}
    </Tool>
  )
```

**3. 파일 첨부 기능**

```tsx
// WorkspaceChatEditor.tsx - PromptInput 교체
import { PromptInput } from '@/components/ai-elements/prompt-input'

// Before (현재)
<textarea value={input} onChange={...} />
<button onClick={handleSend}>Send</button>

// After
<PromptInput
  value={input}
  onChange={setInput}
  onSubmit={handleSendWithAttachments}
  disabled={isSending}
>
  <PromptInput.Textarea
    placeholder="Ask, search, or make anything..."
  />
  <PromptInput.Actions>
    <PromptInput.AttachButton
      accept="image/*,.pdf,.txt,.md"
      onFilesSelected={handleFilesAttached}
    />
    <PromptInput.SendButton />
  </PromptInput.Actions>
</PromptInput>
```

파일 처리 로직:

```typescript
const handleFilesAttached = async (files: File[]) => {
  const attachments = await Promise.all(
    files.map(async (file) => ({
      id: nanoid(),
      name: file.name,
      contentType: file.type,
      url: await fileToBase64(file),
    }))
  )

  setAttachedFiles(attachments)
}

const handleSendWithAttachments = async () => {
  const message = {
    content: input,
    attachments: attachedFiles,
  }

  await ipcRenderer.invoke('claude:send-message', sessionId, message)
}
```

**4. 스트리밍 개선**

```tsx
// 청크 단위 렌더링 지원
import { Shimmer } from '@/components/ai-elements/shimmer'

{isSending && (
  <div className="flex justify-start">
    <Shimmer className="w-full max-w-[75%]">
      <Shimmer.Line />
      <Shimmer.Line width="80%" />
      <Shimmer.Line width="60%" />
    </Shimmer>
  </div>
)}
```

#### 완료 조건

- [ ] Reasoning 컴포넌트가 AI 추론 과정 표시
- [ ] Tool 컴포넌트가 IPC 호출 시각화
- [ ] 파일 첨부 기능 동작
- [ ] Shimmer 로딩 애니메이션 적용

---

### Phase 3: 워크플로우 통합 (3-4주)

**목표:** React Flow 기반 워크플로우 시각화

#### 작업 항목

**1. 대화 흐름 시각화**

```tsx
// src/components/ConversationFlow.tsx 생성
import { Canvas, Node, Edge } from '@/components/ai-elements/workflow'

export const ConversationFlow = ({ messages }: { messages: Message[] }) => {
  const nodes = messages.map((msg, idx) => ({
    id: msg.id,
    type: msg.role,
    position: { x: 0, y: idx * 100 },
    data: { content: msg.content },
  }))

  const edges = messages.slice(1).map((msg, idx) => ({
    id: `edge-${idx}`,
    source: messages[idx].id,
    target: msg.id,
  }))

  return (
    <Canvas nodes={nodes} edges={edges}>
      <Controls />
      <Panel position="top-right">
        <Toolbar>
          <Toolbar.ZoomIn />
          <Toolbar.ZoomOut />
          <Toolbar.FitView />
        </Toolbar>
      </Panel>
    </Canvas>
  )
}
```

**2. 에이전트 워크플로우**

```tsx
// Multi-agent 시스템 시각화
<Canvas>
  <Node id="planner" type="agent" position={[0, 0]}>
    <Node.Header>Planner Agent</Node.Header>
    <Node.Content>Planning the task...</Node.Content>
  </Node>

  <Node id="coder" type="agent" position={[200, 0]}>
    <Node.Header>Coder Agent</Node.Header>
    <Node.Content>Writing code...</Node.Content>
  </Node>

  <Edge source="planner" target="coder" label="Plan" />
</Canvas>
```

**3. 도구 체인 시각화**

```tsx
// IPC 호출 시퀀스를 노드로 표시
<Canvas>
  <Node id="read-file" type="tool">
    workspace:read-file
  </Node>
  <Node id="parse-code" type="tool">
    code:parse
  </Node>
  <Node id="write-file" type="tool">
    workspace:write-file
  </Node>

  <Edge source="read-file" target="parse-code" />
  <Edge source="parse-code" target="write-file" />
</Canvas>
```

#### 완료 조건

- [ ] ConversationFlow 컴포넌트 작동
- [ ] Multi-agent 워크플로우 시각화
- [ ] 도구 체인 시각화 완료

---

## 🔧 구체적 구현 예시

### 예시 1: PromptInput 통합 (즉시 적용 가능)

#### Before (현재)

```tsx
// WorkspaceChatEditor.tsx (L578-656)
<div className="relative w-full flex flex-col border border-input rounded-xl">
  <div className="px-4 pt-4 pb-2">
    <button className="inline-flex items-center...">
      <span>@</span>
      <span>Add context</span>
    </button>
  </div>

  <textarea
    value={input}
    onChange={(e) => setInput(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        handleSend();
      }
    }}
    placeholder="Ask, search, or make anything..."
    disabled={isSending}
    className="w-full px-4 bg-transparent..."
  />

  <div className="flex items-center justify-between px-4 pb-4">
    <div className="flex gap-2">
      <button><Paperclip /></button>
      <button><MessageSquare /></button>
      <button><Globe /></button>
    </div>
    <button onClick={handleSend}>
      <ArrowUp />
    </button>
  </div>
</div>
```

#### After (권장)

```tsx
import { PromptInput } from '@/components/ai-elements/prompt-input'

<PromptInput
  value={input}
  onChange={setInput}
  onSubmit={handleSend}
  disabled={isSending}
  placeholder="Ask, search, or make anything..."
>
  {/* Context Selector */}
  <PromptInput.Addon position="top">
    <PromptInput.ContextButton />
  </PromptInput.Addon>

  {/* Main Textarea */}
  <PromptInput.Textarea />

  {/* Bottom Actions */}
  <PromptInput.Actions>
    <PromptInput.AttachButton />
    <PromptInput.ModelSelector
      models={['sonnet', 'think', 'agent']}
      value={selectedModel}
      onValueChange={setSelectedModel}
    />
    <PromptInput.SendButton />
  </PromptInput.Actions>
</PromptInput>
```

**장점:**
- 80줄 → 20줄로 감소
- 파일 첨부 기능 즉시 사용 가능
- 키보드 단축키 자동 처리 (Cmd+Enter)
- 접근성 (a11y) 내장
- 반응형 디자인 자동 적용

---

### 예시 2: Reasoning 컴포넌트 추가

```tsx
// WorkspaceChatEditor.tsx에 추가
import { Reasoning } from '@/components/ai-elements/reasoning'

const ChatPanel = ({ ... }) => {
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([])

  // IPC에서 thinking 이벤트 수신
  useEffect(() => {
    const handleThinking = (event: any, step: string) => {
      setThinkingSteps(prev => [...prev, step])
    }

    ipcRenderer.on('claude:thinking', handleThinking)
    return () => {
      ipcRenderer.off('claude:thinking', handleThinking)
    }
  }, [])

  return (
    <div>
      {/* Messages */}
      {messages.map(msg => <Message key={msg.id} {...msg} />)}

      {/* Reasoning Display */}
      {isSending && (
        <Reasoning
          isStreaming={true}
          defaultOpen={true}
          onOpenChange={(open) => console.log('Reasoning', open)}
        >
          <Reasoning.Trigger>
            <Brain className="w-4 h-4" />
            <span>Claude is thinking...</span>
          </Reasoning.Trigger>

          <Reasoning.Content>
            {thinkingSteps.length > 0 ? (
              <ul className="space-y-2">
                {thinkingSteps.map((step, idx) => (
                  <li key={idx} className="text-sm text-muted-foreground">
                    {idx + 1}. {step}
                  </li>
                ))}
              </ul>
            ) : (
              <Shimmer>
                <Shimmer.Line />
                <Shimmer.Line width="80%" />
              </Shimmer>
            )}
          </Reasoning.Content>

          <Reasoning.Footer>
            <span className="text-xs text-muted-foreground">
              Thinking for {Math.floor((Date.now() - startTime) / 1000)}s
            </span>
          </Reasoning.Footer>
        </Reasoning>
      )}
    </div>
  )
}
```

---

### 예시 3: CodeBlock 업그레이드 (Prism → Shiki)

#### 현재 (Prism)

```typescript
// blocks/CodeBlock.tsx
import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/themes/prism-tomorrow.css'

useEffect(() => {
  const html = Prism.highlight(
    block.content,
    Prism.languages[language],
    language
  )
  setHighlighted(html)
}, [block.content, language])
```

**문제점:**
- 클라이언트 사이드만 지원
- 테마 전환 시 재로드 필요
- 일부 언어 지원 부족

#### 개선 (Shiki)

```typescript
// blocks/CodeBlock.tsx
import { highlightCode } from '@/components/ai-elements/code-block'

useEffect(() => {
  highlightCode(
    block.content,
    block.metadata.language as BundledLanguage,
    showLineNumbers
  ).then(([lightHtml, darkHtml]) => {
    setLightHtml(lightHtml)
    setDarkHtml(darkHtml)
  })
}, [block.content, block.metadata.language, showLineNumbers])

return (
  <div className="code-block">
    {/* Light theme */}
    <div
      className="light-theme"
      dangerouslySetInnerHTML={{ __html: lightHtml }}
    />

    {/* Dark theme */}
    <div
      className="dark-theme dark:block hidden"
      dangerouslySetInnerHTML={{ __html: darkHtml }}
    />
  </div>
)
```

**장점:**
- VS Code와 동일한 하이라이팅
- 테마 자동 전환
- 200+ 언어 지원
- 더 정확한 구문 분석

---

## ⚠️ 리스크 및 고려사항

### 기술적 리스크

| 리스크 | 영향도 | 완화 전략 |
|--------|--------|-----------|
| **기존 기능 회귀** | 높음 | • 단계별 마이그레이션<br>• 철저한 테스트<br>• Feature flag 사용 |
| **성능 저하** | 중간 | • Shiki는 SSR 권장 (Electron에서 가능)<br>• 코드 스플리팅<br>• 레이지 로딩 |
| **타입 불일치** | 중간 | • Adapter 레이어로 격리<br>• 점진적 타입 변환 |
| **번들 크기 증가** | 낮음 | • Tree shaking<br>• 필요한 컴포넌트만 import |

### 팀 고려사항

**학습 곡선:**
- AI SDK Elements는 새로운 API 패턴
- 팀원들에게 문서 및 예제 제공 필요
- Pair programming으로 지식 공유

**마이그레이션 시간:**
- Phase 1: 1-2주 (핵심 팀원 2명)
- Phase 2: 2-3주 (핵심 팀원 2명)
- Phase 3: 3-4주 (선택적)

---

## ✅ 최종 권장사항

### 즉시 실행 (High ROI, Low Risk)

1. **`<PromptInput>` 통합** ⭐⭐⭐
   - 소요 시간: 2-3일
   - 효과: 파일 첨부, 개선된 UX
   - 리스크: 낮음 (독립적 교체 가능)

2. **Shiki 마이그레이션** ⭐⭐
   - 소요 시간: 3-4일
   - 효과: 코드 하이라이팅 품질 향상
   - 리스크: 중간 (기존 스타일 유지 필요)

3. **스타일 변수 통일** ⭐⭐
   - 소요 시간: 1-2일
   - 효과: 디자인 시스템 일관성
   - 리스크: 낮음 (점진적 변경 가능)

### 단기 목표 (1개월)

4. **`<Reasoning>` 추가** ⭐⭐⭐
   - AI 사고 과정 시각화로 투명성 향상

5. **`<Tool>` 컴포넌트** ⭐⭐⭐
   - IPC 호출 시각화로 디버깅 용이

6. **타입 어댑터 레이어** ⭐⭐
   - AI SDK ↔ Block 타입 안전한 변환

### 중기 목표 (2-3개월)

7. **스트리밍 개선** ⭐⭐
   - 청크 단위 렌더링으로 반응성 향상

8. **워크플로우 시각화** ⭐
   - React Flow 통합 (선택적)

9. **에러 처리 고도화** ⭐⭐
   - Toast + Retry 패턴

### 하지 말아야 할 것 🚫

- ❌ **기존 Block 아키텍처 폐기** - 너무 잘 설계되어 있음
- ❌ **전면 재작성** - 점진적 마이그레이션이 안전
- ❌ **`ai-elements/` 폴더 삭제** - 재사용 가능한 코드 많음
- ❌ **동시에 모든 것 변경** - 단계별 접근 필요

---

## 📋 실행 체크리스트

### Phase 1 체크리스트

- [ ] `src/lib/aiSDKAdapter.ts` 생성
- [ ] `aiMessageToBlocks()` 함수 구현
- [ ] `blocksToAIMessage()` 함수 구현
- [ ] Adapter 유닛 테스트 작성
- [ ] `blocks/CodeBlock.tsx`에 Shiki 통합
- [ ] 라이트/다크 테마 모두 동작 확인
- [ ] 모든 하드코딩 색상을 CSS 변수로 변경
- [ ] `design-tokens.css` 확장
- [ ] 기존 기능 회귀 테스트
- [ ] Phase 1 완료 PR 생성

### Phase 2 체크리스트

- [ ] `<Reasoning>` 컴포넌트 통합
- [ ] Electron IPC에서 thinking 이벤트 수신
- [ ] `<Tool>` 컴포넌트로 IPC 호출 시각화
- [ ] `<PromptInput>` 통합
- [ ] 파일 첨부 기능 구현
- [ ] Base64 인코딩 처리
- [ ] `<Shimmer>` 로딩 애니메이션 추가
- [ ] 스트리밍 청크 렌더링 (선택적)
- [ ] Phase 2 완료 PR 생성

### Phase 3 체크리스트

- [ ] React Flow 의존성 추가
- [ ] `ConversationFlow` 컴포넌트 생성
- [ ] 대화 트리 시각화
- [ ] Multi-agent 워크플로우 시각화
- [ ] 도구 체인 시각화
- [ ] Phase 3 완료 PR 생성

---

## 📚 참고 자료

### 공식 문서

- [AI SDK Elements](https://ai-sdk.dev/elements)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [Shiki](https://shiki.matsu.io/)

### 내부 문서

- [Block-based Conversation System](./block-based-conversation-system.md)
- [Workspace Chat Sync Architecture](./workspace-chat-sync-architecture.md)

### 코드 위치

```
circuit/src/components/
├── ai-elements/          # AI SDK Elements 컴포넌트 (24개)
│   ├── code-block.tsx    # Shiki 기반 코드 하이라이팅
│   ├── prompt-input.tsx  # 고급 입력 컴포넌트
│   ├── reasoning.tsx     # 추론 과정 표시
│   └── tool.tsx          # 도구 호출 시각화
├── blocks/               # 현재 사용 중인 블록 컴포넌트
│   ├── BlockRenderer.tsx # 라우팅 로직
│   ├── CodeBlock.tsx     # Prism 기반 (→ Shiki로 마이그레이션)
│   ├── CommandBlock.tsx  # 실행 가능 명령어
│   ├── DiffBlock.tsx     # Git diff 표시
│   └── TextBlock.tsx     # 일반 텍스트
└── workspace/
    └── WorkspaceChatEditor.tsx  # 메인 채팅 UI
```

---

## 🔄 변경 이력

| 날짜 | 버전 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 2025-10-29 | 1.0.0 | 초기 문서 작성 | Architect Agent |

---

## 📞 문의 및 피드백

이 문서에 대한 질문이나 피드백은:
- GitHub Issues에 등록
- 팀 Slack #architecture 채널
- 직접 PR로 개선 제안

---

**문서 끝**
