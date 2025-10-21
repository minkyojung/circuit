const { spawn } = require('child_process');
const path = require('path');

let mcpProcess = null;
const messages = [];

const messagesContainer = document.getElementById('messages');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const serverTypeSelect = document.getElementById('serverType');
const githubTokenRow = document.getElementById('githubTokenRow');
const githubTokenInput = document.getElementById('githubToken');

// Show/hide GitHub token input based on server type
serverTypeSelect.addEventListener('change', () => {
  if (serverTypeSelect.value === 'github') {
    githubTokenRow.style.display = 'flex';
  } else {
    githubTokenRow.style.display = 'none';
  }
});

// Add message to UI
function addMessage(type, content) {
  const timestamp = new Date().toLocaleTimeString();
  const message = { type, content, timestamp };
  messages.push(message);

  if (messages.length === 1) {
    messagesContainer.innerHTML = '';
  }

  const messageEl = document.createElement('div');
  messageEl.className = 'message';

  const jsonString = JSON.stringify(content, null, 2);
  const lineCount = jsonString.split('\n').length;
  const shouldCollapse = lineCount > 5;

  const messageId = `msg-${Date.now()}-${Math.random()}`;

  messageEl.innerHTML = `
    <div class="message-header">
      <span class="message-type ${type}">${type}</span>
      <div class="message-header-actions">
        ${shouldCollapse ? `<button class="message-expand-btn" data-msg-id="${messageId}">▼ Expand (${lineCount} lines)</button>` : ''}
        <button class="message-copy-btn" data-content="${escapeHtml(jsonString).replace(/"/g, '&quot;')}">📋 Copy</button>
        <span class="message-time">${timestamp}</span>
      </div>
    </div>
    <div class="message-content ${shouldCollapse ? 'collapsed' : ''}" id="${messageId}">${escapeHtml(jsonString)}</div>
  `;

  messagesContainer.appendChild(messageEl);

  // Add event listeners
  if (shouldCollapse) {
    const expandBtn = messageEl.querySelector('.message-expand-btn');
    expandBtn.addEventListener('click', () => {
      const contentEl = document.getElementById(messageId);
      const isCollapsed = contentEl.classList.contains('collapsed');

      if (isCollapsed) {
        contentEl.classList.remove('collapsed');
        expandBtn.textContent = `▲ Collapse`;
      } else {
        contentEl.classList.add('collapsed');
        expandBtn.textContent = `▼ Expand (${lineCount} lines)`;
      }
    });
  }

  const copyBtn = messageEl.querySelector('.message-copy-btn');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(jsonString);
    copyBtn.textContent = '✓ Copied!';
    setTimeout(() => {
      copyBtn.textContent = '📋 Copy';
    }, 2000);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start MCP Server
startBtn.addEventListener('click', () => {
  if (mcpProcess) {
    addMessage('system', { error: 'Server already running' });
    return;
  }

  const serverType = serverTypeSelect.value;
  let command, args, env;

  if (serverType === 'echo') {
    // Echo server
    const serverPath = path.join(__dirname, '../../examples/echo-server.js');
    command = 'node';
    args = [serverPath];
    env = process.env;
    addMessage('system', { status: 'Starting Echo MCP server...', path: serverPath });
  } else if (serverType === 'github') {
    // GitHub server
    const token = githubTokenInput.value.trim();
    if (!token) {
      addMessage('system', { error: 'GitHub token is required' });
      return;
    }

    command = 'npx';
    args = ['-y', '@modelcontextprotocol/server-github'];
    env = { ...process.env, GITHUB_TOKEN: token };
    addMessage('system', { status: 'Starting GitHub MCP server...', token: '***hidden***' });
  }

  mcpProcess = spawn(command, args, { env });

  let buffer = '';

  mcpProcess.stdout.on('data', (data) => {
    buffer += data.toString();

    // Try to parse complete JSON messages
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line in buffer

    lines.forEach(line => {
      if (line.trim()) {
        try {
          const message = JSON.parse(line);
          addMessage('response', message);
        } catch (e) {
          addMessage('response', { raw: line });
        }
      }
    });
  });

  mcpProcess.stderr.on('data', (data) => {
    const stderrText = data.toString();
    // Most MCP servers use stderr for logging, not actual errors
    // Only treat it as error if it contains error keywords
    const isActualError = /error|failed|exception|fatal/i.test(stderrText);
    addMessage(isActualError ? 'error' : 'system', { stderr: stderrText });
  });

  mcpProcess.on('close', (code) => {
    addMessage('system', { status: 'Server stopped', exitCode: code });
    mcpProcess = null;
  });

  // Send a test request
  setTimeout(() => {
    if (mcpProcess) {
      const testRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      };

      addMessage('request', testRequest);
      mcpProcess.stdin.write(JSON.stringify(testRequest) + '\n');
    }
  }, 1000);
});

// Stop server
stopBtn.addEventListener('click', () => {
  if (mcpProcess) {
    mcpProcess.kill();
    mcpProcess = null;
  }
});

// Clear messages
clearBtn.addEventListener('click', () => {
  messages.length = 0;
  messagesContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🔍</div>
      <div>No messages yet. Start an MCP server to see communication.</div>
    </div>
  `;
});
