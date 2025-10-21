const fs = require('fs');
const path = require('path');
const os = require('os');

// MCP Server Catalog
const MCP_CATALOG = [
  {
    id: 'github',
    name: 'GitHub',
    icon: '🐙',
    description: 'Search repositories, create issues, manage pull requests, and more.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    envRequired: ['GITHUB_TOKEN'],
    envHints: {
      GITHUB_TOKEN: 'Create at https://github.com/settings/tokens'
    },
    popular: true
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Send messages, read channels, and manage workspace.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-slack'],
    envRequired: ['SLACK_BOT_TOKEN', 'SLACK_TEAM_ID'],
    envHints: {
      SLACK_BOT_TOKEN: 'Get from https://api.slack.com/apps',
      SLACK_TEAM_ID: 'Your Slack workspace ID'
    },
    popular: true
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    icon: '📁',
    description: 'Read and write files, create directories, search filesystem.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    envRequired: [],
    popular: true
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    icon: '🐘',
    description: 'Query PostgreSQL databases, manage schemas and data.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    envRequired: ['POSTGRES_CONNECTION_STRING'],
    envHints: {
      POSTGRES_CONNECTION_STRING: 'postgresql://user:password@localhost:5432/dbname'
    },
    popular: false
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    icon: '🌐',
    description: 'Browser automation, web scraping, screenshot capture.',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    envRequired: [],
    popular: false
  }
];

// Detect Claude Desktop config path
function getClaudeConfigPath() {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
  } else if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json');
  }
  return null;
}

// Detect Cursor config path
function getCursorConfigPath() {
  const platform = os.platform();
  if (platform === 'darwin') {
    return path.join(os.homedir(), '.cursor/mcp_config.json');
  } else if (platform === 'win32') {
    return path.join(os.homedir(), '.cursor/mcp_config.json');
  }
  return null;
}

// State
let installedServers = [];

// Load installed servers
function loadInstalledServers() {
  const configPath = getClaudeConfigPath();
  if (!configPath || !fs.existsSync(configPath)) {
    return [];
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const servers = config.mcpServers || {};
    return Object.keys(servers).map(id => ({
      id,
      ...servers[id],
      active: true
    }));
  } catch (error) {
    console.error('Failed to load config:', error);
    return [];
  }
}

// Save server to config
function saveServerToConfig(server, targetApps) {
  const configs = [];

  if (targetApps.includes('claude')) {
    const claudePath = getClaudeConfigPath();
    if (claudePath) {
      configs.push({ path: claudePath, name: 'Claude Desktop' });
    }
  }

  if (targetApps.includes('cursor')) {
    const cursorPath = getCursorConfigPath();
    if (cursorPath) {
      configs.push({ path: cursorPath, name: 'Cursor' });
    }
  }

  const results = [];

  for (const { path: configPath, name } of configs) {
    try {
      // Create parent directory if it doesn't exist
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Load existing config or create new
      let config = { mcpServers: {} };
      if (fs.existsSync(configPath)) {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (!config.mcpServers) {
          config.mcpServers = {};
        }
      }

      // Add server
      config.mcpServers[server.id] = {
        command: server.command,
        args: server.args
      };

      if (server.env && Object.keys(server.env).length > 0) {
        config.mcpServers[server.id].env = server.env;
      }

      // Save
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      results.push({ app: name, success: true });
    } catch (error) {
      results.push({ app: name, success: false, error: error.message });
    }
  }

  return results;
}

// UI: Render marketplace
function renderMarketplace(filter = '') {
  const grid = document.getElementById('mcpGrid');
  const filtered = MCP_CATALOG.filter(mcp =>
    mcp.name.toLowerCase().includes(filter.toLowerCase()) ||
    mcp.description.toLowerCase().includes(filter.toLowerCase())
  );

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div>No servers found matching "${filter}"</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(mcp => {
    const isInstalled = installedServers.some(s => s.id === mcp.id);

    return `
      <div class="mcp-card">
        <div class="mcp-header">
          <div class="mcp-icon">${mcp.icon}</div>
          <div class="mcp-title">${mcp.name}</div>
        </div>
        <div class="mcp-description">${mcp.description}</div>
        <div class="mcp-footer">
          <div class="mcp-stats">${mcp.popular ? '⭐ Popular' : ''}</div>
          <button class="${isInstalled ? 'success' : ''}"
                  ${isInstalled ? 'disabled' : ''}
                  onclick="openInstallModal('${mcp.id}')">
            ${isInstalled ? '✓ Installed' : '+ Install'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// UI: Render installed servers
function renderInstalled() {
  const list = document.getElementById('installedList');

  if (installedServers.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div>No MCP servers installed yet.</div>
        <div style="margin-top: 8px; font-size: 12px;">Go to Marketplace to install your first server!</div>
      </div>
    `;
    return;
  }

  list.innerHTML = installedServers.map(server => `
    <div class="installed-item">
      <div class="installed-info">
        <div class="mcp-icon">${MCP_CATALOG.find(m => m.id === server.id)?.icon || '📦'}</div>
        <div>
          <div style="font-weight: 600; margin-bottom: 4px;">${server.id}</div>
          <div class="status-badge ${server.active ? 'active' : 'inactive'}">
            ${server.active ? 'Active' : 'Inactive'}
          </div>
        </div>
      </div>
      <div class="installed-actions">
        <button class="secondary" onclick="removeServer('${server.id}')">Remove</button>
      </div>
    </div>
  `).join('');
}

// Open install modal
window.openInstallModal = function(mcpId) {
  const mcp = MCP_CATALOG.find(m => m.id === mcpId);
  if (!mcp) return;

  const modal = document.getElementById('installModal');
  const title = document.getElementById('modalTitle');
  const subtitle = document.getElementById('modalSubtitle');
  const form = document.getElementById('modalForm');

  title.textContent = `Install ${mcp.name}`;
  subtitle.textContent = mcp.description;

  // Build form
  let formHTML = '';

  // Environment variables
  if (mcp.envRequired && mcp.envRequired.length > 0) {
    mcp.envRequired.forEach(envVar => {
      const hint = mcp.envHints?.[envVar] || '';
      formHTML += `
        <div class="form-group">
          <label class="form-label">${envVar}</label>
          <input type="text" class="form-input" id="env_${envVar}" placeholder="${hint}">
        </div>
      `;
    });
  }

  // Target apps
  formHTML += `
    <div class="form-group">
      <label class="form-label">Install to:</label>
      <div class="checkbox-group">
        <label class="checkbox-label">
          <input type="checkbox" id="target_claude" checked>
          Claude Desktop
        </label>
        <label class="checkbox-label">
          <input type="checkbox" id="target_cursor">
          Cursor
        </label>
      </div>
    </div>
  `;

  form.innerHTML = formHTML;

  // Show modal
  modal.classList.add('active');

  // Store current MCP ID
  modal.dataset.mcpId = mcpId;
};

// Close modal
document.getElementById('modalCancel').addEventListener('click', () => {
  document.getElementById('installModal').classList.remove('active');
});

// Install server
document.getElementById('modalInstall').addEventListener('click', () => {
  const modal = document.getElementById('installModal');
  const mcpId = modal.dataset.mcpId;
  const mcp = MCP_CATALOG.find(m => m.id === mcpId);

  if (!mcp) return;

  // Collect environment variables
  const env = {};
  if (mcp.envRequired) {
    mcp.envRequired.forEach(envVar => {
      const value = document.getElementById(`env_${envVar}`)?.value.trim();
      if (value) {
        env[envVar] = value;
      }
    });
  }

  // Collect target apps
  const targetApps = [];
  if (document.getElementById('target_claude')?.checked) {
    targetApps.push('claude');
  }
  if (document.getElementById('target_cursor')?.checked) {
    targetApps.push('cursor');
  }

  if (targetApps.length === 0) {
    alert('Please select at least one app to install to.');
    return;
  }

  // Install
  const server = {
    id: mcp.id,
    command: mcp.command,
    args: mcp.args,
    env
  };

  const results = saveServerToConfig(server, targetApps);

  // Show results
  const successApps = results.filter(r => r.success).map(r => r.app);
  const failedApps = results.filter(r => !r.success);

  if (successApps.length > 0) {
    alert(`✓ Installed to: ${successApps.join(', ')}\n\nPlease restart the apps for changes to take effect.`);
  }

  if (failedApps.length > 0) {
    alert(`Failed to install to: ${failedApps.map(r => `${r.app} (${r.error})`).join(', ')}`);
  }

  // Reload
  installedServers = loadInstalledServers();
  renderMarketplace();
  renderInstalled();

  // Close modal
  modal.classList.remove('active');
});

// Remove server
window.removeServer = function(serverId) {
  if (!confirm(`Remove ${serverId}?`)) return;

  const configPath = getClaudeConfigPath();
  if (!configPath || !fs.existsSync(configPath)) return;

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.mcpServers && config.mcpServers[serverId]) {
      delete config.mcpServers[serverId];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      installedServers = loadInstalledServers();
      renderMarketplace();
      renderInstalled();

      alert('Server removed. Please restart Claude Desktop.');
    }
  } catch (error) {
    alert(`Failed to remove: ${error.message}`);
  }
};

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.dataset.tab;

    // Update tabs
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(targetTab).classList.add('active');
  });
});

// Search
document.getElementById('searchInput').addEventListener('input', (e) => {
  renderMarketplace(e.target.value);
});

// Initialize
installedServers = loadInstalledServers();
renderMarketplace();
renderInstalled();
