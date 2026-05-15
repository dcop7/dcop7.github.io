const CheatsheetsPage = (function () {
  'use strict';

  const DATA = {
    git: {
      label: 'Git',
      icon: '🌿',
      sections: [
        { title: 'Setup', items: [
          { cmd: 'git config --global user.name "Name"', desc: 'Set global username' },
          { cmd: 'git config --global user.email "email"', desc: 'Set global email' },
          { cmd: 'git init', desc: 'Initialize new repo' },
          { cmd: 'git clone <url>', desc: 'Clone a repository' },
        ]},
        { title: 'Staging', items: [
          { cmd: 'git add <file>', desc: 'Stage a file' },
          { cmd: 'git add .', desc: 'Stage all changes' },
          { cmd: 'git restore --staged <file>', desc: 'Unstage a file' },
          { cmd: 'git diff --staged', desc: 'Show staged changes' },
        ]},
        { title: 'Commits', items: [
          { cmd: 'git commit -m "msg"', desc: 'Commit with message' },
          { cmd: 'git commit --amend --no-edit', desc: 'Amend last commit' },
          { cmd: 'git revert <hash>', desc: 'Revert a commit' },
          { cmd: 'git reset --soft HEAD~1', desc: 'Undo last commit, keep changes' },
        ]},
        { title: 'Branches', items: [
          { cmd: 'git branch <name>', desc: 'Create branch' },
          { cmd: 'git switch <name>', desc: 'Switch to branch' },
          { cmd: 'git switch -c <name>', desc: 'Create and switch' },
          { cmd: 'git branch -d <name>', desc: 'Delete branch' },
          { cmd: 'git merge <branch>', desc: 'Merge branch into current' },
          { cmd: 'git rebase <branch>', desc: 'Rebase onto branch' },
        ]},
        { title: 'Remote', items: [
          { cmd: 'git fetch origin', desc: 'Fetch from remote' },
          { cmd: 'git pull', desc: 'Fetch and merge' },
          { cmd: 'git push origin <branch>', desc: 'Push branch to remote' },
          { cmd: 'git remote -v', desc: 'List remotes' },
        ]},
        { title: 'Inspection', items: [
          { cmd: 'git log --oneline --graph', desc: 'Visual log' },
          { cmd: 'git status', desc: 'Show working tree status' },
          { cmd: 'git stash', desc: 'Stash changes' },
          { cmd: 'git stash pop', desc: 'Apply last stash' },
          { cmd: 'git blame <file>', desc: 'Show who changed each line' },
        ]},
      ]
    },
    linux: {
      label: 'Linux',
      icon: '🐧',
      sections: [
        { title: 'Navigation', items: [
          { cmd: 'ls -la', desc: 'List with hidden files and details' },
          { cmd: 'cd -', desc: 'Go to previous directory' },
          { cmd: 'pwd', desc: 'Print working directory' },
          { cmd: 'find . -name "*.js"', desc: 'Find files by name' },
          { cmd: 'locate <file>', desc: 'Find file in database' },
        ]},
        { title: 'Files', items: [
          { cmd: 'cp -r src/ dest/', desc: 'Copy directory recursively' },
          { cmd: 'mv old new', desc: 'Move or rename' },
          { cmd: 'rm -rf dir/', desc: 'Remove directory recursively' },
          { cmd: 'ln -s target link', desc: 'Create symbolic link' },
          { cmd: 'chmod 755 file', desc: 'Set file permissions' },
          { cmd: 'chown user:group file', desc: 'Change file owner' },
        ]},
        { title: 'Text', items: [
          { cmd: 'grep -rn "pattern" .', desc: 'Recursive search with line numbers' },
          { cmd: 'sed -i "s/old/new/g" file', desc: 'Replace in file' },
          { cmd: "awk '{print $1}' file", desc: 'Print first column' },
          { cmd: 'sort | uniq -c', desc: 'Count unique lines' },
          { cmd: 'tail -f log.txt', desc: 'Follow file output' },
        ]},
        { title: 'Processes', items: [
          { cmd: 'ps aux | grep name', desc: 'Find process by name' },
          { cmd: 'kill -9 <pid>', desc: 'Force kill process' },
          { cmd: 'htop', desc: 'Interactive process viewer' },
          { cmd: 'lsof -i :3000', desc: 'Show what uses port 3000' },
          { cmd: 'nohup cmd &', desc: 'Run in background, ignore hangup' },
        ]},
        { title: 'Networking', items: [
          { cmd: 'curl -X POST -H "Content-Type: application/json" -d \'{"k":"v"}\' url', desc: 'POST JSON with curl' },
          { cmd: 'wget -O out.html url', desc: 'Download file' },
          { cmd: 'ssh user@host', desc: 'SSH into host' },
          { cmd: 'scp file user@host:/path', desc: 'Copy file to remote' },
          { cmd: 'netstat -tlnp', desc: 'Show listening ports' },
        ]},
      ]
    },
    docker: {
      label: 'Docker',
      icon: '🐳',
      sections: [
        { title: 'Images', items: [
          { cmd: 'docker build -t name:tag .', desc: 'Build image from Dockerfile' },
          { cmd: 'docker images', desc: 'List images' },
          { cmd: 'docker rmi <image>', desc: 'Remove image' },
          { cmd: 'docker pull nginx:alpine', desc: 'Pull image from registry' },
          { cmd: 'docker push user/image:tag', desc: 'Push image to registry' },
        ]},
        { title: 'Containers', items: [
          { cmd: 'docker run -d -p 80:80 --name app nginx', desc: 'Run container detached' },
          { cmd: 'docker exec -it app bash', desc: 'Shell into running container' },
          { cmd: 'docker ps -a', desc: 'List all containers' },
          { cmd: 'docker stop app && docker rm app', desc: 'Stop and remove container' },
          { cmd: 'docker logs -f app', desc: 'Follow container logs' },
          { cmd: 'docker cp file app:/path', desc: 'Copy file into container' },
        ]},
        { title: 'Compose', items: [
          { cmd: 'docker compose up -d', desc: 'Start services in background' },
          { cmd: 'docker compose down -v', desc: 'Stop and remove volumes' },
          { cmd: 'docker compose logs -f', desc: 'Follow all service logs' },
          { cmd: 'docker compose build --no-cache', desc: 'Rebuild without cache' },
          { cmd: 'docker compose restart <svc>', desc: 'Restart a service' },
        ]},
        { title: 'Cleanup', items: [
          { cmd: 'docker system prune -a', desc: 'Remove all unused resources' },
          { cmd: 'docker volume prune', desc: 'Remove unused volumes' },
          { cmd: 'docker image prune -f', desc: 'Remove dangling images' },
        ]},
      ]
    },
    vim: {
      label: 'Vim',
      icon: '📝',
      sections: [
        { title: 'Modes', items: [
          { cmd: 'i', desc: 'Insert mode before cursor' },
          { cmd: 'a', desc: 'Insert mode after cursor' },
          { cmd: 'o / O', desc: 'New line below / above' },
          { cmd: 'Esc', desc: 'Return to Normal mode' },
          { cmd: 'v / V / Ctrl+v', desc: 'Visual / Line / Block mode' },
        ]},
        { title: 'Navigation', items: [
          { cmd: 'gg / G', desc: 'Go to first / last line' },
          { cmd: ':42', desc: 'Go to line 42' },
          { cmd: 'w / b / e', desc: 'Next word / prev word / end of word' },
          { cmd: '{ / }', desc: 'Move paragraph up / down' },
          { cmd: 'Ctrl+d / Ctrl+u', desc: 'Half page down / up' },
          { cmd: '%', desc: 'Jump to matching bracket' },
        ]},
        { title: 'Editing', items: [
          { cmd: 'dd / yy / p', desc: 'Delete / yank / paste line' },
          { cmd: 'ciw', desc: 'Change inner word' },
          { cmd: 'u / Ctrl+r', desc: 'Undo / redo' },
          { cmd: '>>', desc: 'Indent line' },
          { cmd: '=G', desc: 'Auto-indent from cursor to end' },
        ]},
        { title: 'Search & Replace', items: [
          { cmd: '/pattern', desc: 'Search forward' },
          { cmd: 'n / N', desc: 'Next / prev match' },
          { cmd: ':%s/old/new/g', desc: 'Replace all in file' },
          { cmd: ':noh', desc: 'Clear search highlight' },
        ]},
        { title: 'File', items: [
          { cmd: ':w', desc: 'Save' },
          { cmd: ':wq / :x', desc: 'Save and quit' },
          { cmd: ':q!', desc: 'Quit without saving' },
          { cmd: ':e file', desc: 'Open file' },
          { cmd: ':vs / :sp', desc: 'Vertical / horizontal split' },
          { cmd: 'Ctrl+w hjkl', desc: 'Navigate splits' },
        ]},
      ]
    },
    bash: {
      label: 'Bash',
      icon: '💻',
      sections: [
        { title: 'Variables', items: [
          { cmd: 'NAME="value"', desc: 'Assign variable' },
          { cmd: 'echo $NAME', desc: 'Print variable' },
          { cmd: 'export NAME="value"', desc: 'Export to child processes' },
          { cmd: 'readonly NAME="value"', desc: 'Read-only variable' },
          { cmd: 'unset NAME', desc: 'Delete variable' },
        ]},
        { title: 'Control Flow', items: [
          { cmd: 'if [ -f file ]; then ... fi', desc: 'If file exists' },
          { cmd: 'for i in {1..5}; do ... done', desc: 'For loop with range' },
          { cmd: 'while read line; do ... done < file', desc: 'Read file line by line' },
          { cmd: 'case "$var" in a) ... ;; b) ... ;; esac', desc: 'Case statement' },
        ]},
        { title: 'Functions', items: [
          { cmd: 'myfunc() { echo "$1"; }', desc: 'Define function' },
          { cmd: 'myfunc arg', desc: 'Call function with argument' },
          { cmd: '$? / $# / $@', desc: 'Last exit code / arg count / all args' },
          { cmd: 'local VAR="val"', desc: 'Local variable inside function' },
        ]},
        { title: 'Operators', items: [
          { cmd: 'cmd1 && cmd2', desc: 'Run cmd2 only if cmd1 succeeds' },
          { cmd: 'cmd1 || cmd2', desc: 'Run cmd2 only if cmd1 fails' },
          { cmd: 'cmd > file', desc: 'Redirect stdout to file' },
          { cmd: 'cmd 2>&1', desc: 'Redirect stderr to stdout' },
          { cmd: '$(cmd)', desc: 'Command substitution' },
          { cmd: '$((2 + 3))', desc: 'Arithmetic expansion' },
        ]},
        { title: 'Strings', items: [
          { cmd: '${#var}', desc: 'String length' },
          { cmd: '${var:2:4}', desc: 'Substring (offset:length)' },
          { cmd: '${var/old/new}', desc: 'Replace first occurrence' },
          { cmd: '${var//old/new}', desc: 'Replace all occurrences' },
          { cmd: '${var^^} / ${var,,}', desc: 'Uppercase / lowercase' },
        ]},
      ]
    },
    regex: {
      label: 'Regex',
      icon: '🔍',
      sections: [
        { title: 'Anchors', items: [
          { cmd: '^', desc: 'Start of line' },
          { cmd: '$', desc: 'End of line' },
          { cmd: '\\b', desc: 'Word boundary' },
          { cmd: '\\B', desc: 'Not word boundary' },
        ]},
        { title: 'Quantifiers', items: [
          { cmd: '*', desc: 'Zero or more' },
          { cmd: '+', desc: 'One or more' },
          { cmd: '?', desc: 'Zero or one' },
          { cmd: '{n,m}', desc: 'Between n and m times' },
          { cmd: '*? / +? / ??', desc: 'Non-greedy (lazy) versions' },
        ]},
        { title: 'Character Classes', items: [
          { cmd: '.', desc: 'Any character except newline' },
          { cmd: '\\d / \\D', desc: 'Digit / Non-digit' },
          { cmd: '\\w / \\W', desc: 'Word char / Non-word' },
          { cmd: '\\s / \\S', desc: 'Whitespace / Non-whitespace' },
          { cmd: '[abc] / [^abc]', desc: 'Character set / negated set' },
          { cmd: '[a-z] / [A-Z]', desc: 'Lowercase / uppercase range' },
        ]},
        { title: 'Groups', items: [
          { cmd: '(abc)', desc: 'Capturing group' },
          { cmd: '(?:abc)', desc: 'Non-capturing group' },
          { cmd: '(?<name>abc)', desc: 'Named capturing group' },
          { cmd: '\\1 / $1', desc: 'Back-reference / replacement ref' },
        ]},
        { title: 'Lookaround', items: [
          { cmd: '(?=abc)', desc: 'Lookahead — followed by abc' },
          { cmd: '(?!abc)', desc: 'Negative lookahead' },
          { cmd: '(?<=abc)', desc: 'Lookbehind — preceded by abc' },
          { cmd: '(?<!abc)', desc: 'Negative lookbehind' },
        ]},
        { title: 'Flags', items: [
          { cmd: 'g', desc: 'Global — all matches' },
          { cmd: 'i', desc: 'Case-insensitive' },
          { cmd: 'm', desc: 'Multiline — ^ and $ match line starts/ends' },
          { cmd: 's', desc: 'Dotall — . matches newlines too' },
        ]},
      ]
    },
    claude: {
      label: 'Claude Code',
      icon: '🤖',
      sections: [
        { title: 'CLI Basics', items: [
          { cmd: 'claude', desc: 'Start interactive session' },
          { cmd: 'claude "task"', desc: 'Run one-shot task' },
          { cmd: 'claude -p "prompt"', desc: 'Print-mode (no interaction)' },
          { cmd: 'claude --resume', desc: 'Resume last conversation' },
          { cmd: 'claude --dangerously-skip-permissions', desc: 'Skip permission prompts' },
        ]},
        { title: 'Slash Commands', items: [
          { cmd: '/help', desc: 'Show help and commands' },
          { cmd: '/clear', desc: 'Clear conversation context' },
          { cmd: '/compact', desc: 'Summarize context to save tokens' },
          { cmd: '/status', desc: 'Show current status' },
          { cmd: '/cost', desc: 'Show token usage and cost' },
          { cmd: '/doctor', desc: 'Check environment and settings' },
        ]},
        { title: 'File Tools', items: [
          { cmd: 'Read', desc: 'Read a file' },
          { cmd: 'Write', desc: 'Write/overwrite a file' },
          { cmd: 'Edit', desc: 'Make targeted edits (prefer over Write)' },
          { cmd: 'Glob', desc: 'Find files by pattern' },
          { cmd: 'Grep', desc: 'Search file contents' },
          { cmd: 'Bash', desc: 'Run shell commands' },
        ]},
        { title: 'Settings', items: [
          { cmd: 'CLAUDE.md', desc: 'Project-level instructions at repo root' },
          { cmd: '~/.claude/CLAUDE.md', desc: 'Global personal instructions' },
          { cmd: 'claude config', desc: 'Manage configuration' },
          { cmd: '.claudeignore', desc: 'Files to exclude from context' },
        ]},
        { title: 'Prompting Tips', items: [
          { cmd: 'Be specific about file paths', desc: 'Reduces hallucinations' },
          { cmd: 'Include error messages verbatim', desc: 'Better diagnosis' },
          { cmd: 'Describe expected vs actual behavior', desc: 'Clearer bugs' },
          { cmd: 'Use /compact before long sessions', desc: 'Saves tokens' },
          { cmd: 'Ask for a plan first on complex tasks', desc: 'Avoids wrong direction' },
        ]},
      ]
    },
  };

  let _activeId = 'git';
  let _query = '';
  let _rendered = false;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function highlight(text, q) {
    if (!q) return esc(text);
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return esc(text).replace(re, '<mark>$1</mark>');
  }

  async function copyToClipboard(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      const orig = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('copied');
      setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1200);
    } catch { btn.textContent = '✗'; setTimeout(() => { btn.textContent = 'Copy'; }, 1200); }
  }

  function renderSections(sheetId, q) {
    const sheet = DATA[sheetId];
    if (!sheet) return '<div class="cs-empty">Not found.</div>';
    const lq = q.toLowerCase();
    const html = sheet.sections.map(sec => {
      const filtered = lq
        ? sec.items.filter(i => i.cmd.toLowerCase().includes(lq) || i.desc.toLowerCase().includes(lq))
        : sec.items;
      if (!filtered.length) return '';
      return `<div class="cs-section">
        <div class="cs-section-hdr">
          <span class="cs-section-title">${sec.title}</span>
          <span class="cs-section-count">${filtered.length}</span>
        </div>
        <div class="cs-items">
          ${filtered.map(item => `
            <div class="cs-item">
              <code class="cs-cmd">${highlight(item.cmd, lq)}</code>
              <span class="cs-desc">${highlight(item.desc, lq)}</span>
              <button class="cs-copy" data-cmd="${esc(item.cmd)}">Copy</button>
            </div>`).join('')}
        </div>
      </div>`;
    }).join('');
    return html || '<div class="cs-empty">No results.</div>';
  }

  function bindCopyBtns(container) {
    container.querySelectorAll('.cs-copy').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.cmd, btn));
    });
  }

  function updateActive(page, id) {
    _activeId = id;
    page.querySelectorAll('.cs-cat-item').forEach(el => {
      el.classList.toggle('active', el.dataset.csId === id);
    });
    const content = page.querySelector('#cs-content');
    if (content) {
      content.innerHTML = renderSections(_activeId, _query);
      bindCopyBtns(content);
    }
  }

  function render() {
    const page = document.getElementById('cheatsheets-page');
    if (!page) return;

    page.innerHTML = `
      <div class="cs-layout">
        <div class="cs-sidebar">
          <div class="cs-search-wrap">
            <input type="search" class="cs-search" id="cs-search" placeholder="Filter commands…" autocomplete="off"/>
          </div>
          <div class="cs-cat-list">
            ${Object.entries(DATA).map(([id, s]) => `
              <div class="cs-cat-item${id === _activeId ? ' active' : ''}" data-cs-id="${id}">
                <span class="cs-cat-icon">${s.icon}</span>${s.label}
              </div>`).join('')}
          </div>
        </div>
        <div class="cs-content" id="cs-content">
          ${renderSections(_activeId, _query)}
        </div>
      </div>`;

    const content = page.querySelector('#cs-content');
    bindCopyBtns(content);

    page.querySelectorAll('.cs-cat-item').forEach(el => {
      el.addEventListener('click', () => updateActive(page, el.dataset.csId));
    });

    const searchInput = page.querySelector('#cs-search');
    if (searchInput) {
      searchInput.value = _query;
      searchInput.addEventListener('input', () => {
        _query = searchInput.value.trim();
        content.innerHTML = renderSections(_activeId, _query);
        bindCopyBtns(content);
      });
    }

    _rendered = true;
  }

  function show() {
    if (!_rendered) render();
  }

  return { show };
})();
