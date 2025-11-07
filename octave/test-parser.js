/**
 * Quick test for messageParser logic (pure JavaScript version)
 * Run with: node test-parser.js
 */

/**
 * Simplified parser for testing - same logic as messageParser.ts
 */
function parseMessageToBlocks(content, messageId) {
  const blocks = [];
  let order = 0;

  // Regex to match code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let match;

  // Process code blocks and text between them
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const matchStart = match.index;
    const matchEnd = codeBlockRegex.lastIndex;

    // Text before this code block
    if (matchStart > lastIndex) {
      const textContent = content.slice(lastIndex, matchStart).trim();
      if (textContent) {
        blocks.push({
          id: `block-${order}`,
          messageId,
          type: 'text',
          content: textContent,
          metadata: {},
          order: order++,
        });
      }
    }

    // Code block
    const language = match[1] || 'plaintext';
    const codeContent = match[2].trim();

    // Classify: bash/sh/shell → command, others → code
    const isCommand = ['bash', 'sh', 'shell', 'zsh'].includes(language.toLowerCase());

    if (isCommand) {
      blocks.push({
        id: `block-${order}`,
        messageId,
        type: 'command',
        content: codeContent,
        metadata: { language: 'bash', isExecutable: true },
        order: order++,
      });
    } else {
      blocks.push({
        id: `block-${order}`,
        messageId,
        type: 'code',
        content: codeContent,
        metadata: { language, isExecutable: false },
        order: order++,
      });
    }

    lastIndex = matchEnd;
  }

  // Remaining text after last code block
  if (lastIndex < content.length) {
    const textContent = content.slice(lastIndex).trim();
    if (textContent) {
      blocks.push({
        id: `block-${order}`,
        messageId,
        type: 'text',
        content: textContent,
        metadata: {},
        order: order++,
      });
    }
  }

  // Edge case: No code blocks at all
  if (blocks.length === 0 && content.trim()) {
    blocks.push({
      id: `block-0`,
      messageId,
      type: 'text',
      content: content.trim(),
      metadata: {},
      order: 0,
    });
  }

  return blocks;
}

// ===== TEST CASES =====

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Block Parser Test Suite');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test 1: Mixed text and code
console.log('Test 1: Mixed text, code, and command');
console.log('─────────────────────────────────────────\n');

const test1 = `로그인 버그를 고치려면 다음과 같이 bcrypt를 사용하세요:

\`\`\`typescript
// auth.ts
const hash = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(inputPassword, hash);
\`\`\`

먼저 bcrypt를 설치해야 합니다:

\`\`\`bash
npm install bcrypt
npm install --save-dev @types/bcrypt
\`\`\`

이렇게 하면 MD5 대신 안전한 해싱을 사용하게 됩니다.`;

const blocks1 = parseMessageToBlocks(test1, 'msg-1');
console.log(`✅ Found ${blocks1.length} blocks:\n`);
blocks1.forEach((block, i) => {
  console.log(`[${i}] ${block.type.toUpperCase()} (order: ${block.order})`);
  console.log(`    Content preview: ${block.content.slice(0, 60)}...`);
  console.log(`    Metadata:`, JSON.stringify(block.metadata));
  console.log('');
});

// Expected: 5 blocks (text, code, text, command, text)
const expected1 = ['text', 'code', 'text', 'command', 'text'];
const actual1 = blocks1.map(b => b.type);
const pass1 = JSON.stringify(expected1) === JSON.stringify(actual1);
console.log(`Expected: [${expected1.join(', ')}]`);
console.log(`Actual:   [${actual1.join(', ')}]`);
console.log(`Result:   ${pass1 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Only text (no code blocks)
console.log('\nTest 2: Plain text only');
console.log('─────────────────────────────────────────\n');

const test2 = `이것은 일반 텍스트입니다. 코드 블록이 없습니다.`;
const blocks2 = parseMessageToBlocks(test2, 'msg-2');
console.log(`✅ Found ${blocks2.length} blocks:\n`);
blocks2.forEach((block, i) => {
  console.log(`[${i}] ${block.type.toUpperCase()}`);
  console.log(`    Content: ${block.content}\n`);
});

const expected2 = ['text'];
const actual2 = blocks2.map(b => b.type);
const pass2 = JSON.stringify(expected2) === JSON.stringify(actual2);
console.log(`Expected: [${expected2.join(', ')}]`);
console.log(`Actual:   [${actual2.join(', ')}]`);
console.log(`Result:   ${pass2 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Only code block (no surrounding text)
console.log('\nTest 3: Code block only');
console.log('─────────────────────────────────────────\n');

const test3 = `\`\`\`python
def hello():
    print("Hello, World!")
\`\`\``;

const blocks3 = parseMessageToBlocks(test3, 'msg-3');
console.log(`✅ Found ${blocks3.length} blocks:\n`);
blocks3.forEach((block, i) => {
  console.log(`[${i}] ${block.type.toUpperCase()}`);
  console.log(`    Language: ${block.metadata.language || 'N/A'}`);
  console.log(`    Content: ${block.content}\n`);
});

const expected3 = ['code'];
const actual3 = blocks3.map(b => b.type);
const pass3 = JSON.stringify(expected3) === JSON.stringify(actual3);
console.log(`Expected: [${expected3.join(', ')}]`);
console.log(`Actual:   [${actual3.join(', ')}]`);
console.log(`Result:   ${pass3 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: Multiple code blocks back-to-back
console.log('\nTest 4: Back-to-back code blocks');
console.log('─────────────────────────────────────────\n');

const test4 = `\`\`\`javascript
const a = 1;
\`\`\`
\`\`\`bash
echo "test"
\`\`\``;

const blocks4 = parseMessageToBlocks(test4, 'msg-4');
console.log(`✅ Found ${blocks4.length} blocks:\n`);
blocks4.forEach((block, i) => {
  console.log(`[${i}] ${block.type.toUpperCase()} - ${block.metadata.language || 'N/A'}`);
});

const expected4 = ['code', 'command'];
const actual4 = blocks4.map(b => b.type);
const pass4 = JSON.stringify(expected4) === JSON.stringify(actual4);
console.log(`\nExpected: [${expected4.join(', ')}]`);
console.log(`Actual:   [${actual4.join(', ')}]`);
console.log(`Result:   ${pass4 ? '✅ PASS' : '❌ FAIL'}\n`);

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Test Summary');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const allPassed = pass1 && pass2 && pass3 && pass4;
console.log(`Test 1 (Mixed): ${pass1 ? '✅' : '❌'}`);
console.log(`Test 2 (Text only): ${pass2 ? '✅' : '❌'}`);
console.log(`Test 3 (Code only): ${pass3 ? '✅' : '❌'}`);
console.log(`Test 4 (Back-to-back): ${pass4 ? '✅' : '❌'}`);
console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}\n`);

if (allPassed) {
  console.log('🎉 Parser logic is working correctly!\n');
  console.log('Next steps:');
  console.log('  1. Integrate into ConversationStorage');
  console.log('  2. Create blocks database table');
  console.log('  3. Build BlockRenderer components\n');
}
