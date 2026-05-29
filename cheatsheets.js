const CheatsheetsPage = (function () {
  'use strict';

  /* UI chrome localisation (command content stays English by convention). */
  const _t = (en, pt) => (typeof I18n !== 'undefined' && I18n.getLang() === 'pt') ? pt : en;

  const DATA = {
    git: {
      label: 'Git', icon: '🌿',
      sections: [
        { title: 'Setup', items: [
          { cmd: 'git config --global user.name "Name"', desc: 'Set global username' },
          { cmd: 'git config --global user.email "email"', desc: 'Set global email' },
          { cmd: 'git config --global core.editor "code --wait"', desc: 'Set VS Code as editor' },
          { cmd: 'git config --list', desc: 'List all config' },
          { cmd: 'git init', desc: 'Initialize new repo' },
          { cmd: 'git clone <url>', desc: 'Clone a repository' },
          { cmd: 'git clone --depth 1 <url>', desc: 'Shallow clone (latest commit only)' },
        ]},
        { title: 'Staging & Status', items: [
          { cmd: 'git status', desc: 'Show working tree status' },
          { cmd: 'git add <file>', desc: 'Stage a file' },
          { cmd: 'git add .', desc: 'Stage all changes' },
          { cmd: 'git add -p', desc: 'Interactively stage hunks' },
          { cmd: 'git restore --staged <file>', desc: 'Unstage a file' },
          { cmd: 'git restore <file>', desc: 'Discard working tree changes' },
          { cmd: 'git diff', desc: 'Show unstaged changes' },
          { cmd: 'git diff --staged', desc: 'Show staged changes' },
        ]},
        { title: 'Commits', items: [
          { cmd: 'git commit -m "msg"', desc: 'Commit with message' },
          { cmd: 'git commit --amend --no-edit', desc: 'Add to last commit (same message)' },
          { cmd: 'git commit --amend -m "new msg"', desc: 'Amend last commit message' },
          { cmd: 'git revert <hash>', desc: 'Revert a commit (new commit)' },
          { cmd: 'git reset --soft HEAD~1', desc: 'Undo last commit, keep changes staged' },
          { cmd: 'git reset --mixed HEAD~1', desc: 'Undo last commit, keep changes unstaged' },
          { cmd: 'git reset --hard HEAD~1', desc: 'Undo last commit, discard changes' },
          { cmd: 'git cherry-pick <hash>', desc: 'Apply a commit from another branch' },
        ]},
        { title: 'Branches', items: [
          { cmd: 'git branch', desc: 'List local branches' },
          { cmd: 'git branch -a', desc: 'List all branches (local + remote)' },
          { cmd: 'git branch <name>', desc: 'Create branch' },
          { cmd: 'git switch <name>', desc: 'Switch to branch' },
          { cmd: 'git switch -c <name>', desc: 'Create and switch' },
          { cmd: 'git branch -d <name>', desc: 'Delete merged branch' },
          { cmd: 'git branch -D <name>', desc: 'Force delete branch' },
          { cmd: 'git branch -m old new', desc: 'Rename branch' },
          { cmd: 'git merge <branch>', desc: 'Merge branch into current' },
          { cmd: 'git merge --no-ff <branch>', desc: 'Merge with a merge commit' },
          { cmd: 'git rebase <branch>', desc: 'Rebase onto branch' },
          { cmd: 'git rebase -i HEAD~3', desc: 'Interactive rebase last 3 commits' },
        ]},
        { title: 'Remote', items: [
          { cmd: 'git remote -v', desc: 'List remotes' },
          { cmd: 'git remote add origin <url>', desc: 'Add remote' },
          { cmd: 'git fetch origin', desc: 'Fetch all from remote' },
          { cmd: 'git pull', desc: 'Fetch and merge current branch' },
          { cmd: 'git pull --rebase', desc: 'Fetch and rebase instead of merge' },
          { cmd: 'git push origin <branch>', desc: 'Push branch to remote' },
          { cmd: 'git push -u origin <branch>', desc: 'Push and set upstream' },
          { cmd: 'git push --force-with-lease', desc: 'Safe force push' },
          { cmd: 'git push origin --delete <branch>', desc: 'Delete remote branch' },
        ]},
        { title: 'Stash', items: [
          { cmd: 'git stash', desc: 'Stash changes' },
          { cmd: 'git stash push -m "desc"', desc: 'Stash with description' },
          { cmd: 'git stash pop', desc: 'Apply and remove last stash' },
          { cmd: 'git stash apply stash@{1}', desc: 'Apply specific stash' },
          { cmd: 'git stash list', desc: 'List all stashes' },
          { cmd: 'git stash drop stash@{0}', desc: 'Delete a stash' },
          { cmd: 'git stash clear', desc: 'Delete all stashes' },
        ]},
        { title: 'Inspection', items: [
          { cmd: 'git log --oneline --graph --all', desc: 'Visual branch log' },
          { cmd: 'git log --author="Name" --since="1 week ago"', desc: 'Filter commits' },
          { cmd: 'git show <hash>', desc: 'Show commit details and diff' },
          { cmd: 'git blame <file>', desc: 'Show who changed each line' },
          { cmd: 'git bisect start', desc: 'Binary search for a bug' },
          { cmd: 'git reflog', desc: 'History of HEAD movements' },
          { cmd: 'git shortlog -sn', desc: 'Commit count by author' },
        ]},
        { title: 'Tags', items: [
          { cmd: 'git tag v1.0.0', desc: 'Create lightweight tag' },
          { cmd: 'git tag -a v1.0.0 -m "msg"', desc: 'Create annotated tag' },
          { cmd: 'git push origin --tags', desc: 'Push all tags to remote' },
          { cmd: 'git tag -d v1.0.0', desc: 'Delete local tag' },
        ]},
      ]
    },

    linux: {
      label: 'Linux', icon: '🐧',
      sections: [
        { title: 'Navigation', items: [
          { cmd: 'ls -lahF', desc: 'List with details, human sizes, type indicators' },
          { cmd: 'ls -lt', desc: 'List sorted by modification time' },
          { cmd: 'cd -', desc: 'Go to previous directory' },
          { cmd: 'pwd', desc: 'Print working directory' },
          { cmd: 'pushd / popd', desc: 'Push/pop directory stack' },
          { cmd: 'tree -L 2', desc: 'Directory tree 2 levels deep' },
          { cmd: 'find . -name "*.js" -not -path "*/node_modules/*"', desc: 'Find files, excluding folder' },
          { cmd: 'find . -type f -mtime -7', desc: 'Files modified in last 7 days' },
          { cmd: 'locate <file>', desc: 'Find file in database (fast)' },
          { cmd: 'which <cmd>', desc: 'Show path to command' },
        ]},
        { title: 'Files & Dirs', items: [
          { cmd: 'cp -r src/ dest/', desc: 'Copy directory recursively' },
          { cmd: 'cp -a src/ dest/', desc: 'Copy preserving attributes' },
          { cmd: 'mv old new', desc: 'Move or rename' },
          { cmd: 'rm -rf dir/', desc: 'Remove directory recursively' },
          { cmd: 'mkdir -p path/to/dir', desc: 'Create nested directories' },
          { cmd: 'ln -s target link', desc: 'Create symbolic link' },
          { cmd: 'chmod 755 file', desc: 'rwx r-x r-x permissions' },
          { cmd: 'chmod +x script.sh', desc: 'Make executable' },
          { cmd: 'chown user:group file', desc: 'Change owner' },
          { cmd: 'chown -R user:group dir/', desc: 'Recursive chown' },
          { cmd: 'stat file', desc: 'File details (size, permissions, timestamps)' },
          { cmd: 'du -sh dir/', desc: 'Disk usage of directory' },
          { cmd: 'df -h', desc: 'Disk free space' },
        ]},
        { title: 'Text Processing', items: [
          { cmd: 'grep -rn "pattern" .', desc: 'Recursive grep with line numbers' },
          { cmd: 'grep -rni "pattern" .', desc: 'Case-insensitive recursive grep' },
          { cmd: 'grep -v "pattern" file', desc: 'Lines NOT matching pattern' },
          { cmd: 'grep -A3 -B3 "pattern" file', desc: '3 lines context around match' },
          { cmd: "awk '{print $1,$3}' file", desc: 'Print columns 1 and 3' },
          { cmd: "awk -F: '{print $1}' /etc/passwd", desc: 'Custom field separator' },
          { cmd: 'sed -i "s/old/new/g" file', desc: 'Replace all in file (in-place)' },
          { cmd: "sed '/^#/d' file", desc: 'Delete comment lines' },
          { cmd: 'sort -k2 -n file', desc: 'Sort by column 2 numerically' },
          { cmd: 'sort | uniq -c | sort -rn', desc: 'Count and sort by frequency' },
          { cmd: 'cut -d, -f2,4 file.csv', desc: 'Extract columns from CSV' },
          { cmd: 'wc -l file', desc: 'Count lines' },
          { cmd: 'head -n 20 / tail -n 20', desc: 'First/last 20 lines' },
          { cmd: 'tail -f log.txt', desc: 'Follow file in real time' },
          { cmd: 'tr a-z A-Z', desc: 'Translate (uppercase)' },
          { cmd: 'jq \'.[] | .name\' data.json', desc: 'Parse JSON with jq' },
        ]},
        { title: 'Processes', items: [
          { cmd: 'ps aux | grep name', desc: 'Find process by name' },
          { cmd: 'pgrep -fl name', desc: 'Find process ID by name' },
          { cmd: 'kill -9 <pid>', desc: 'Force kill process' },
          { cmd: 'pkill -f "node app"', desc: 'Kill by command pattern' },
          { cmd: 'htop', desc: 'Interactive process viewer' },
          { cmd: 'top -o %MEM', desc: 'Sort processes by memory' },
          { cmd: 'lsof -i :3000', desc: 'Show what uses port 3000' },
          { cmd: 'ss -tlnp', desc: 'Show TCP listening sockets + PID' },
          { cmd: 'nohup cmd > out.log 2>&1 &', desc: 'Run detached, log output' },
          { cmd: 'jobs / fg / bg', desc: 'Manage background jobs' },
          { cmd: 'nice -n 10 cmd', desc: 'Run command with lower priority' },
          { cmd: 'time cmd', desc: 'Measure command execution time' },
        ]},
        { title: 'Networking', items: [
          { cmd: 'curl -s url | jq .', desc: 'Fetch and pretty-print JSON' },
          { cmd: 'curl -X POST -H "Content-Type: application/json" -d \'{"k":"v"}\' url', desc: 'POST JSON' },
          { cmd: 'curl -o file.zip url', desc: 'Download file' },
          { cmd: 'curl -I url', desc: 'Show response headers only' },
          { cmd: 'wget -c url', desc: 'Download, resume if interrupted' },
          { cmd: 'ssh -L 8080:localhost:80 user@host', desc: 'SSH local port forward' },
          { cmd: 'ssh -i key.pem user@host', desc: 'SSH with key file' },
          { cmd: 'scp -r dir/ user@host:/path', desc: 'Copy directory to remote' },
          { cmd: 'rsync -avz src/ user@host:/dest/', desc: 'Sync files to remote' },
          { cmd: 'ping -c 4 host', desc: 'Ping 4 times' },
          { cmd: 'traceroute host', desc: 'Trace network route' },
          { cmd: 'nmap -p 22,80,443 host', desc: 'Scan specific ports' },
          { cmd: 'dig domain.com', desc: 'DNS lookup' },
        ]},
        { title: 'Permissions & Users', items: [
          { cmd: 'sudo -u user cmd', desc: 'Run command as another user' },
          { cmd: 'su - user', desc: 'Switch to user (login shell)' },
          { cmd: 'useradd -m -s /bin/bash user', desc: 'Create user with home dir' },
          { cmd: 'usermod -aG sudo user', desc: 'Add user to sudo group' },
          { cmd: 'passwd user', desc: 'Set user password' },
          { cmd: 'groups user', desc: 'List user groups' },
          { cmd: 'visudo', desc: 'Edit sudoers file safely' },
        ]},
        { title: 'Archives', items: [
          { cmd: 'tar -czf out.tar.gz dir/', desc: 'Create gzip tarball' },
          { cmd: 'tar -xzf file.tar.gz', desc: 'Extract gzip tarball' },
          { cmd: 'tar -xzf file.tar.gz -C /target/', desc: 'Extract to specific dir' },
          { cmd: 'zip -r out.zip dir/', desc: 'Create zip archive' },
          { cmd: 'unzip file.zip -d /target/', desc: 'Extract zip to dir' },
        ]},
        { title: 'systemd Services', items: [
          { cmd: 'systemctl status nginx', desc: 'Show service status' },
          { cmd: 'systemctl start / stop / restart nginx', desc: 'Start / stop / restart service' },
          { cmd: 'systemctl enable / disable nginx', desc: 'Enable / disable at boot' },
          { cmd: 'systemctl reload nginx', desc: 'Reload config without downtime' },
          { cmd: 'systemctl list-units --type=service', desc: 'List all services' },
          { cmd: 'systemctl list-units --failed', desc: 'List failed units' },
          { cmd: 'journalctl -u nginx -f', desc: 'Follow service logs' },
          { cmd: 'journalctl -u nginx --since "1 hour ago"', desc: 'Logs from last hour' },
          { cmd: 'journalctl -p err -b', desc: 'Errors since last boot' },
          { cmd: 'systemctl daemon-reload', desc: 'Reload unit file changes' },
          { cmd: 'systemctl mask nginx', desc: 'Prevent service from starting' },
          { cmd: 'systemctl cat nginx', desc: 'Show unit file' },
        ]},
        { title: 'Package Management', items: [
          { cmd: 'apt update && apt upgrade', desc: 'Update and upgrade (Debian/Ubuntu)' },
          { cmd: 'apt install pkg', desc: 'Install package' },
          { cmd: 'apt remove / purge pkg', desc: 'Remove / remove + config files' },
          { cmd: 'apt search keyword', desc: 'Search for package' },
          { cmd: 'apt show pkg', desc: 'Package info' },
          { cmd: 'dpkg -l | grep pkg', desc: 'List installed packages' },
          { cmd: 'dpkg -L pkg', desc: 'Files installed by package' },
          { cmd: 'apt-mark hold pkg', desc: 'Prevent package from upgrading' },
          { cmd: 'dnf install pkg', desc: 'Install package (RHEL/Fedora)' },
          { cmd: 'dnf update / upgrade', desc: 'Update packages (RHEL/Fedora)' },
          { cmd: 'dnf search / info pkg', desc: 'Search / info (RHEL/Fedora)' },
          { cmd: 'rpm -qa | grep pkg', desc: 'List installed RPM packages' },
        ]},
        { title: 'System Info', items: [
          { cmd: 'uname -r', desc: 'Kernel version' },
          { cmd: 'lsb_release -a', desc: 'Distribution info' },
          { cmd: 'cat /etc/os-release', desc: 'OS identification' },
          { cmd: 'uptime', desc: 'System uptime and load average' },
          { cmd: 'free -h', desc: 'RAM usage (human readable)' },
          { cmd: 'vmstat 1 5', desc: 'CPU, memory, I/O stats (5 samples)' },
          { cmd: 'iostat -xz 1', desc: 'Disk I/O statistics' },
          { cmd: 'lsblk', desc: 'List block devices (disks/partitions)' },
          { cmd: 'lscpu', desc: 'CPU info' },
          { cmd: 'lspci', desc: 'PCI devices' },
          { cmd: 'dmesg | tail -20', desc: 'Kernel messages (recent)' },
          { cmd: 'env', desc: 'All environment variables' },
          { cmd: 'printenv PATH', desc: 'Print specific environment variable' },
        ]},
      ]
    },

    docker: {
      label: 'Docker', icon: '🐳',
      sections: [
        { title: 'Images', items: [
          { cmd: 'docker build -t name:tag .', desc: 'Build from Dockerfile in current dir' },
          { cmd: 'docker build --no-cache -t name:tag .', desc: 'Build ignoring cache' },
          { cmd: 'docker build --build-arg KEY=val .', desc: 'Build with ARG' },
          { cmd: 'docker images', desc: 'List local images' },
          { cmd: 'docker rmi <image>', desc: 'Remove image' },
          { cmd: 'docker pull nginx:alpine', desc: 'Pull image from registry' },
          { cmd: 'docker push user/image:tag', desc: 'Push to Docker Hub' },
          { cmd: 'docker tag src:tag dest:tag', desc: 'Tag an image' },
          { cmd: 'docker image inspect <image>', desc: 'Inspect image details' },
          { cmd: 'docker history <image>', desc: 'Show image layers' },
          { cmd: 'docker save -o out.tar <image>', desc: 'Export image to tar' },
          { cmd: 'docker load -i out.tar', desc: 'Import image from tar' },
        ]},
        { title: 'Containers', items: [
          { cmd: 'docker run -d -p 8080:80 --name app nginx', desc: 'Run container detached' },
          { cmd: 'docker run -it --rm ubuntu bash', desc: 'Interactive, auto-remove on exit' },
          { cmd: 'docker run -v $(pwd):/app -w /app node:20 npm start', desc: 'Mount cwd as /app' },
          { cmd: 'docker run --env-file .env name', desc: 'Pass env file' },
          { cmd: 'docker run --memory 512m --cpus 0.5 name', desc: 'Limit resources' },
          { cmd: 'docker exec -it app bash', desc: 'Shell into running container' },
          { cmd: 'docker exec app cat /etc/os-release', desc: 'Run one-off command' },
          { cmd: 'docker ps', desc: 'List running containers' },
          { cmd: 'docker ps -a', desc: 'List all containers (inc. stopped)' },
          { cmd: 'docker stop app', desc: 'Graceful stop' },
          { cmd: 'docker kill app', desc: 'Force stop' },
          { cmd: 'docker rm app', desc: 'Remove stopped container' },
          { cmd: 'docker rm -f app', desc: 'Force remove running container' },
          { cmd: 'docker logs -f --tail 100 app', desc: 'Follow last 100 lines of logs' },
          { cmd: 'docker cp file app:/path', desc: 'Copy file into container' },
          { cmd: 'docker inspect app', desc: 'Full container details (JSON)' },
          { cmd: 'docker stats', desc: 'Live resource usage' },
          { cmd: 'docker top app', desc: 'Processes inside container' },
        ]},
        { title: 'Networks', items: [
          { cmd: 'docker network ls', desc: 'List networks' },
          { cmd: 'docker network create mynet', desc: 'Create custom network' },
          { cmd: 'docker run --network mynet name', desc: 'Connect container to network' },
          { cmd: 'docker network connect mynet app', desc: 'Connect running container' },
          { cmd: 'docker network inspect mynet', desc: 'Network details and connected containers' },
        ]},
        { title: 'Volumes', items: [
          { cmd: 'docker volume create myvol', desc: 'Create named volume' },
          { cmd: 'docker run -v myvol:/data name', desc: 'Mount named volume' },
          { cmd: 'docker volume ls', desc: 'List volumes' },
          { cmd: 'docker volume inspect myvol', desc: 'Volume details' },
          { cmd: 'docker volume rm myvol', desc: 'Remove volume' },
        ]},
        { title: 'Compose', items: [
          { cmd: 'docker compose up -d', desc: 'Start all services detached' },
          { cmd: 'docker compose up -d --build', desc: 'Rebuild and start' },
          { cmd: 'docker compose down', desc: 'Stop and remove containers' },
          { cmd: 'docker compose down -v', desc: 'Also remove volumes' },
          { cmd: 'docker compose restart <svc>', desc: 'Restart a service' },
          { cmd: 'docker compose logs -f <svc>', desc: 'Follow service logs' },
          { cmd: 'docker compose exec <svc> bash', desc: 'Shell into service' },
          { cmd: 'docker compose ps', desc: 'List compose services' },
          { cmd: 'docker compose pull', desc: 'Pull latest images' },
          { cmd: 'docker compose config', desc: 'Validate and view config' },
          { cmd: 'docker compose scale svc=3', desc: 'Scale a service to 3 replicas' },
        ]},
        { title: 'Cleanup', items: [
          { cmd: 'docker system prune -a --volumes', desc: 'Remove all unused resources' },
          { cmd: 'docker container prune', desc: 'Remove stopped containers' },
          { cmd: 'docker image prune -a', desc: 'Remove unused images' },
          { cmd: 'docker volume prune', desc: 'Remove unused volumes' },
          { cmd: 'docker network prune', desc: 'Remove unused networks' },
          { cmd: 'docker system df', desc: 'Disk usage by Docker' },
        ]},
      ]
    },

    vim: {
      label: 'Vim', icon: '📝',
      sections: [
        { title: 'Modes', items: [
          { cmd: 'i / I', desc: 'Insert before cursor / start of line' },
          { cmd: 'a / A', desc: 'Insert after cursor / end of line' },
          { cmd: 'o / O', desc: 'New line below / above' },
          { cmd: 's / S', desc: 'Delete char / line and insert' },
          { cmd: 'R', desc: 'Replace mode (overwrite)' },
          { cmd: 'Esc / Ctrl+[', desc: 'Return to Normal mode' },
          { cmd: 'v / V / Ctrl+v', desc: 'Visual / Line / Block mode' },
        ]},
        { title: 'Motion', items: [
          { cmd: 'h j k l', desc: 'Left / down / up / right' },
          { cmd: 'w / b / e', desc: 'Next word / prev word / end of word' },
          { cmd: 'W / B / E', desc: 'Same but for WORD (space-delimited)' },
          { cmd: '0 / ^ / $', desc: 'Line start / first non-blank / end' },
          { cmd: 'gg / G', desc: 'File start / end' },
          { cmd: ':42', desc: 'Go to line 42' },
          { cmd: 'Ctrl+f / Ctrl+b', desc: 'Page down / up' },
          { cmd: 'Ctrl+d / Ctrl+u', desc: 'Half page down / up' },
          { cmd: '{ / }', desc: 'Move paragraph up / down' },
          { cmd: '% ', desc: 'Jump to matching bracket' },
          { cmd: 'f<c> / F<c>', desc: 'Find char forward / backward on line' },
          { cmd: 't<c> / T<c>', desc: 'Till char forward / backward' },
          { cmd: '; / ,', desc: 'Repeat f/t forward / backward' },
        ]},
        { title: 'Editing', items: [
          { cmd: 'x / X', desc: 'Delete char forward / backward' },
          { cmd: 'dd / D', desc: 'Delete line / to end of line' },
          { cmd: 'yy / Y', desc: 'Yank (copy) line' },
          { cmd: 'p / P', desc: 'Paste after / before cursor' },
          { cmd: 'u / Ctrl+r', desc: 'Undo / redo' },
          { cmd: '.', desc: 'Repeat last change' },
          { cmd: '>G / <G', desc: 'Indent / dedent to end of file' },
          { cmd: '=G', desc: 'Auto-indent to end of file' },
          { cmd: 'J', desc: 'Join current and next line' },
          { cmd: '~', desc: 'Toggle case of character' },
          { cmd: 'gU<motion> / gu<motion>', desc: 'Uppercase / lowercase motion' },
          { cmd: 'Ctrl+a / Ctrl+x', desc: 'Increment / decrement number' },
        ]},
        { title: 'Text Objects', items: [
          { cmd: 'ciw / diw / yiw', desc: 'Change/delete/yank inner word' },
          { cmd: 'ci" / di"', desc: 'Change/delete inside quotes' },
          { cmd: 'ci( / ci[', desc: 'Change inside parens / brackets' },
          { cmd: 'cip / dip', desc: 'Change/delete inner paragraph' },
          { cmd: 'dat / dit', desc: 'Delete around/inside HTML tag' },
          { cmd: 'ca( / da(', desc: 'Change/delete around parens (incl.)' },
        ]},
        { title: 'Search & Replace', items: [
          { cmd: '/pattern', desc: 'Search forward' },
          { cmd: '?pattern', desc: 'Search backward' },
          { cmd: 'n / N', desc: 'Next / prev match' },
          { cmd: '* / #', desc: 'Search word under cursor fwd / bwd' },
          { cmd: ':%s/old/new/g', desc: 'Replace all in file' },
          { cmd: ':%s/old/new/gc', desc: 'Replace all, confirm each' },
          { cmd: ':10,20s/old/new/g', desc: 'Replace in lines 10-20' },
          { cmd: ':%s/\\bword\\b/new/g', desc: 'Replace whole word only' },
          { cmd: ':noh', desc: 'Clear search highlight' },
        ]},
        { title: 'File & Splits', items: [
          { cmd: ':w', desc: 'Save' },
          { cmd: ':wq / :x / ZZ', desc: 'Save and quit' },
          { cmd: ':q!  / ZQ', desc: 'Quit without saving' },
          { cmd: ':e file', desc: 'Open file' },
          { cmd: ':vs file / :sp file', desc: 'Vertical / horizontal split' },
          { cmd: 'Ctrl+w h/j/k/l', desc: 'Navigate splits' },
          { cmd: 'Ctrl+w v / s', desc: 'Create vertical / horizontal split' },
          { cmd: 'Ctrl+w =', desc: 'Equal size splits' },
          { cmd: 'Ctrl+w q', desc: 'Close split' },
          { cmd: ':tabnew / gt / gT', desc: 'New tab / next / prev tab' },
          { cmd: ':ls', desc: 'List open buffers' },
          { cmd: ':bn / :bp / :bd', desc: 'Next / prev / close buffer' },
        ]},
        { title: 'Macros', items: [
          { cmd: 'q<letter>', desc: 'Start recording macro (e.g. qa)' },
          { cmd: 'q', desc: 'Stop recording macro' },
          { cmd: '@<letter>', desc: 'Execute macro (e.g. @a)' },
          { cmd: '@@', desc: 'Re-run last macro' },
          { cmd: '10@a', desc: 'Run macro 10 times' },
        ]},
      ]
    },

    bash: {
      label: 'Bash', icon: '💻',
      sections: [
        { title: 'Variables', items: [
          { cmd: 'NAME="value"', desc: 'Assign variable (no spaces around =)' },
          { cmd: 'echo "$NAME"', desc: 'Print variable (always quote)' },
          { cmd: 'export NAME="value"', desc: 'Export to child processes' },
          { cmd: 'readonly NAME="value"', desc: 'Read-only variable' },
          { cmd: 'unset NAME', desc: 'Delete variable' },
          { cmd: 'NAME="${VAR:-default}"', desc: 'Default value if unset' },
          { cmd: 'NAME="${VAR:?error msg}"', desc: 'Exit with error if unset' },
          { cmd: 'declare -i N=5', desc: 'Integer variable' },
          { cmd: 'declare -a ARR', desc: 'Array variable' },
          { cmd: 'ARR=(a b c); echo "${ARR[1]}"', desc: 'Array access' },
          { cmd: '"${ARR[@]}"', desc: 'All array elements' },
          { cmd: '"${!ARR[@]}"', desc: 'Array indices' },
        ]},
        { title: 'String Operations', items: [
          { cmd: '${#var}', desc: 'String length' },
          { cmd: '${var:2:4}', desc: 'Substring from offset 2, length 4' },
          { cmd: '${var/old/new}', desc: 'Replace first occurrence' },
          { cmd: '${var//old/new}', desc: 'Replace all occurrences' },
          { cmd: '${var#prefix}', desc: 'Remove shortest prefix match' },
          { cmd: '${var##prefix}', desc: 'Remove longest prefix match' },
          { cmd: '${var%suffix}', desc: 'Remove shortest suffix match' },
          { cmd: '${var%%suffix}', desc: 'Remove longest suffix match' },
          { cmd: '${var^^} / ${var,,}', desc: 'Uppercase / lowercase all' },
          { cmd: '${var^} / ${var,}', desc: 'Uppercase / lowercase first char' },
        ]},
        { title: 'Control Flow', items: [
          { cmd: 'if [ -f file ]; then ... elif ...; else ...; fi', desc: 'If/elif/else' },
          { cmd: '[ -f f ] / [ -d d ] / [ -z "$s" ]', desc: 'File / dir / empty string test' },
          { cmd: '[ "$a" -eq "$b" ] / [ "$a" = "$b" ]', desc: 'Numeric / string equality' },
          { cmd: '[[ "$s" =~ ^[0-9]+$ ]]', desc: 'Regex test (double brackets)' },
          { cmd: 'for i in {1..10}; do ... done', desc: 'Loop with brace expansion' },
          { cmd: 'for f in *.txt; do ... done', desc: 'Loop over files' },
          { cmd: 'for ((i=0; i<10; i++)); do ... done', desc: 'C-style for loop' },
          { cmd: 'while IFS= read -r line; do ... done < file', desc: 'Read file line by line (safe)' },
          { cmd: 'until [ condition ]; do ... done', desc: 'Until loop' },
          { cmd: 'case "$var" in a) ... ;; b|c) ... ;; *) ... ;; esac', desc: 'Case statement' },
          { cmd: 'break / continue', desc: 'Exit / skip in loops' },
        ]},
        { title: 'Functions', items: [
          { cmd: 'myfunc() { local x="$1"; echo "$x"; return 0; }', desc: 'Define function with local var' },
          { cmd: '$1 $2 ... $@', desc: 'Positional args / all args' },
          { cmd: '$# / $?', desc: 'Arg count / last exit code' },
          { cmd: '$0 / $$', desc: 'Script name / current PID' },
          { cmd: 'local -r CONST="val"', desc: 'Local read-only constant' },
        ]},
        { title: 'Operators & Redirects', items: [
          { cmd: 'cmd1 && cmd2', desc: 'Run cmd2 only if cmd1 succeeds' },
          { cmd: 'cmd1 || cmd2', desc: 'Run cmd2 only if cmd1 fails' },
          { cmd: 'cmd1; cmd2', desc: 'Run both regardless' },
          { cmd: 'cmd > file', desc: 'Redirect stdout to file (overwrite)' },
          { cmd: 'cmd >> file', desc: 'Redirect stdout to file (append)' },
          { cmd: 'cmd 2> err.log', desc: 'Redirect stderr' },
          { cmd: 'cmd > out.log 2>&1', desc: 'Redirect stdout+stderr' },
          { cmd: 'cmd 2>/dev/null', desc: 'Discard stderr' },
          { cmd: 'cmd < input.txt', desc: 'Stdin from file' },
          { cmd: '$(cmd)', desc: 'Command substitution' },
          { cmd: '$((3 * 5 + 2))', desc: 'Arithmetic expansion' },
          { cmd: 'cmd1 | cmd2', desc: 'Pipe stdout to next command' },
          { cmd: 'cmd |& next', desc: 'Pipe stdout + stderr' },
          { cmd: 'tee file', desc: 'Copy stdin to file AND stdout' },
        ]},
        { title: 'Scripting Patterns', items: [
          { cmd: '#!/usr/bin/env bash', desc: 'Portable shebang' },
          { cmd: 'set -euo pipefail', desc: 'Strict mode: exit on error/unset/pipe fail' },
          { cmd: 'trap \'cleanup\' EXIT ERR', desc: 'Run cleanup on exit or error' },
          { cmd: 'readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"', desc: 'Script directory' },
          { cmd: 'getopts "hf:v" opt', desc: 'Parse options' },
          { cmd: '[[ "${BASH_SOURCE[0]}" == "$0" ]] && main "$@"', desc: 'Run main only if not sourced' },
        ]},
        { title: 'Advanced Bash', items: [
          { cmd: 'declare -A map; map[key]="val"; echo "${map[key]}"', desc: 'Associative array (requires Bash 4+)' },
          { cmd: 'diff <(cmd1) <(cmd2)', desc: 'Process substitution — compare command outputs' },
          { cmd: "cat <<'EOF'\n...\nEOF", desc: "Here-doc (single quotes = no variable expansion)" },
          { cmd: 'cat <<EOF\nHello $NAME\nEOF', desc: "Here-doc with variable expansion" },
          { cmd: 'printf "%-10s %5d\\n" "$name" "$count"', desc: 'Formatted output (prefer over echo)' },
          { cmd: 'mapfile -t lines < file.txt', desc: 'Read file into array' },
          { cmd: 'mapfile -t arr < <(cmd)', desc: 'Read command output into array' },
          { cmd: 'time_start=$SECONDS; ...; echo "$((SECONDS - time_start))s"', desc: 'Measure elapsed time' },
          { cmd: 'wait $pid', desc: 'Wait for background process' },
          { cmd: 'kill %1', desc: 'Kill background job 1' },
          { cmd: 'exec 3>&1; exec >&logfile 2>&1', desc: 'Redirect all output to log, keep fd 3 as stdout' },
        ]},
        { title: 'Debugging', items: [
          { cmd: 'set -x', desc: 'Print each command before executing (trace mode)' },
          { cmd: 'set +x', desc: 'Turn off trace mode' },
          { cmd: 'bash -n script.sh', desc: 'Syntax check without executing' },
          { cmd: 'bash -x script.sh', desc: 'Run with trace mode from the start' },
          { cmd: 'PS4=\'+$LINENO: \' bash -x script.sh', desc: 'Show line numbers in trace' },
          { cmd: 'shellcheck script.sh', desc: 'Static analysis for common bugs' },
          { cmd: 'echo "${PIPESTATUS[@]}"', desc: 'Exit codes of all commands in last pipeline' },
          { cmd: 'echo "cmd at line $LINENO failed with code $?"', desc: 'Error reporting' },
          { cmd: 'strace -e trace=file cmd', desc: 'Trace file-related syscalls' },
        ]},
      ]
    },

    javascript: {
      label: 'JavaScript', icon: '🟨',
      sections: [
        { title: 'Variables & Types', items: [
          { cmd: 'const x = 1; let y = 2;', desc: 'Block-scoped declarations (prefer const)' },
          { cmd: 'typeof x === "string"', desc: 'Type check' },
          { cmd: 'x === null / x == null', desc: 'Strict null / null or undefined' },
          { cmd: 'x ?? "default"', desc: 'Nullish coalescing (null/undefined only)' },
          { cmd: 'x?.prop?.method()', desc: 'Optional chaining' },
          { cmd: 'Number("42") / parseInt("42", 10)', desc: 'String to number' },
          { cmd: 'String(42) / (42).toString()', desc: 'Number to string' },
          { cmd: 'Number.isNaN(x) / Number.isFinite(x)', desc: 'Safe NaN / finite check' },
        ]},
        { title: 'Arrays', items: [
          { cmd: '[...arr1, ...arr2]', desc: 'Spread / merge arrays' },
          { cmd: 'arr.map(x => x * 2)', desc: 'Transform each element' },
          { cmd: 'arr.filter(x => x > 0)', desc: 'Filter elements' },
          { cmd: 'arr.reduce((acc, x) => acc + x, 0)', desc: 'Reduce to single value' },
          { cmd: 'arr.find(x => x.id === id)', desc: 'Find first match' },
          { cmd: 'arr.findIndex(x => x.id === id)', desc: 'Find index of first match' },
          { cmd: 'arr.some(x => x > 0)', desc: 'True if any match' },
          { cmd: 'arr.every(x => x > 0)', desc: 'True if all match' },
          { cmd: 'arr.flat(2)', desc: 'Flatten 2 levels deep' },
          { cmd: 'arr.flatMap(x => [x, x*2])', desc: 'Map then flatten one level' },
          { cmd: '[...new Set(arr)]', desc: 'Remove duplicates' },
          { cmd: 'arr.sort((a,b) => a - b)', desc: 'Numeric sort ascending' },
          { cmd: '[...arr].reverse()', desc: 'Reverse without mutating' },
          { cmd: 'arr.slice(1, 3)', desc: 'Extract elements (non-mutating)' },
          { cmd: 'arr.splice(1, 2, x)', desc: 'Remove 2 at index 1, insert x (mutating)' },
          { cmd: 'arr.includes(x)', desc: 'Check if element exists' },
          { cmd: 'arr.join(", ")', desc: 'Join to string' },
          { cmd: 'Array.from({length:5}, (_,i) => i)', desc: 'Create [0,1,2,3,4]' },
        ]},
        { title: 'Objects', items: [
          { cmd: 'const { a, b = 0 } = obj', desc: 'Destructure with default' },
          { cmd: 'const { a: renamed } = obj', desc: 'Destructure with rename' },
          { cmd: 'const [first, ...rest] = arr', desc: 'Array destructure with rest' },
          { cmd: '{ ...obj, key: val }', desc: 'Spread / override key' },
          { cmd: 'Object.keys(obj)', desc: 'Array of own keys' },
          { cmd: 'Object.values(obj)', desc: 'Array of own values' },
          { cmd: 'Object.entries(obj)', desc: 'Array of [key, value] pairs' },
          { cmd: 'Object.fromEntries(entries)', desc: 'Create object from entries' },
          { cmd: 'Object.assign({}, a, b)', desc: 'Merge objects (shallow)' },
          { cmd: 'structuredClone(obj)', desc: 'Deep clone' },
          { cmd: '"key" in obj', desc: 'Check if key exists' },
          { cmd: 'delete obj.key', desc: 'Remove key' },
        ]},
        { title: 'Async', items: [
          { cmd: 'async function f() { return await g(); }', desc: 'Async function with await' },
          { cmd: 'const res = await fetch(url)', desc: 'Fetch URL' },
          { cmd: 'const data = await res.json()', desc: 'Parse JSON response' },
          { cmd: 'Promise.all([p1, p2])', desc: 'Wait for all promises' },
          { cmd: 'Promise.allSettled([p1, p2])', desc: 'Wait for all, even if some fail' },
          { cmd: 'Promise.race([p1, p2])', desc: 'First to settle wins' },
          { cmd: 'try { await f() } catch(e) { }', desc: 'Async error handling' },
          { cmd: 'new Promise((resolve, reject) => { })', desc: 'Create a promise' },
        ]},
        { title: 'DOM', items: [
          { cmd: 'document.querySelector(".cls")', desc: 'First matching element' },
          { cmd: 'document.querySelectorAll("p")', desc: 'NodeList of all matches' },
          { cmd: 'el.addEventListener("click", handler)', desc: 'Add event listener' },
          { cmd: 'el.removeEventListener("click", handler)', desc: 'Remove listener (needs same reference)' },
          { cmd: 'el.classList.add/remove/toggle("cls")', desc: 'Manipulate classes' },
          { cmd: 'el.dataset.key', desc: 'Access data-key attribute' },
          { cmd: 'el.setAttribute("href", url)', desc: 'Set attribute' },
          { cmd: 'el.textContent = "text"', desc: 'Set text (safe, no XSS)' },
          { cmd: 'el.innerHTML = "<b>text</b>"', desc: 'Set HTML (careful with user input)' },
          { cmd: 'el.closest(".parent")', desc: 'Walk up to matching ancestor' },
          { cmd: 'el.getBoundingClientRect()', desc: 'Element position/size in viewport' },
          { cmd: 'e.preventDefault() / e.stopPropagation()', desc: 'Prevent default / stop bubbling' },
        ]},
        { title: 'Modern Syntax', items: [
          { cmd: 'const fn = (a, b = 0) => a + b', desc: 'Arrow function with default' },
          { cmd: 'const fn = (...args) => args', desc: 'Rest parameter' },
          { cmd: '`Hello ${name}!`', desc: 'Template literal' },
          { cmd: 'class Foo extends Bar { constructor() { super(); } }', desc: 'Class with inheritance' },
          { cmd: '#privateField / #privateMethod()', desc: 'Private class member' },
          { cmd: 'import { x } from "./mod.js"', desc: 'ES module import' },
          { cmd: 'export default / export { x }', desc: 'ES module export' },
          { cmd: 'const mod = await import("./mod.js")', desc: 'Dynamic import' },
          { cmd: 'for (const [k, v] of Object.entries(obj))', desc: 'Loop entries' },
          { cmd: 'for (const x of iterable)', desc: 'Loop iterable (Array, Map, Set...)' },
        ]},
      ]
    },

    python: {
      label: 'Python', icon: '🐍',
      sections: [
        { title: 'Basics', items: [
          { cmd: 'f"Hello {name!r}"', desc: 'f-string with repr conversion' },
          { cmd: 'x: int = 5', desc: 'Type annotation' },
          { cmd: 'x, y = 1, 2', desc: 'Tuple unpacking' },
          { cmd: 'a, *rest = [1,2,3,4]', desc: 'Extended unpacking' },
          { cmd: 'x if condition else y', desc: 'Ternary expression' },
          { cmd: 'x is None / x is not None', desc: 'Identity check for None' },
          { cmd: 'print(*args, sep=", ", end="\n")', desc: 'Print with custom sep/end' },
        ]},
        { title: 'Strings', items: [
          { cmd: '"Hello".lower() / .upper()', desc: 'Case conversion' },
          { cmd: '" hello ".strip()', desc: 'Remove leading/trailing whitespace' },
          { cmd: '"a,b,c".split(",")  ', desc: 'Split string' },
          { cmd: '", ".join(["a","b"])', desc: 'Join list to string' },
          { cmd: '"hello".startswith("he")', desc: 'Check prefix' },
          { cmd: '"hello".replace("l","r")', desc: 'Replace substring' },
          { cmd: '"hello".count("l")', desc: 'Count occurrences' },
          { cmd: '"{:.2f}".format(3.14159)', desc: 'Format float to 2 decimals' },
        ]},
        { title: 'Lists & Comprehensions', items: [
          { cmd: '[x**2 for x in range(10)]', desc: 'List comprehension' },
          { cmd: '[x for x in lst if x > 0]', desc: 'List comprehension with filter' },
          { cmd: '{k: v for k, v in d.items()}', desc: 'Dict comprehension' },
          { cmd: '{x for x in lst}', desc: 'Set comprehension' },
          { cmd: 'sorted(lst, key=lambda x: x.name)', desc: 'Sort by attribute' },
          { cmd: 'max(lst, key=len)', desc: 'Max by key function' },
          { cmd: 'lst.append(x) / lst.extend([a,b])', desc: 'Add element / extend' },
          { cmd: 'lst.pop() / lst.pop(0)', desc: 'Remove last / first' },
          { cmd: 'lst[start:stop:step]', desc: 'Slicing' },
          { cmd: 'lst[::-1]', desc: 'Reverse a list' },
          { cmd: 'zip(a, b)', desc: 'Pair elements from two iterables' },
          { cmd: 'enumerate(lst, start=1)', desc: 'Loop with index starting at 1' },
        ]},
        { title: 'Dicts', items: [
          { cmd: 'd.get("key", default)', desc: 'Get with default' },
          { cmd: 'd.setdefault("key", [])', desc: 'Set if missing, return value' },
          { cmd: 'd.items() / .keys() / .values()', desc: 'View objects' },
          { cmd: '{**a, **b}', desc: 'Merge dicts (b overrides a)' },
          { cmd: 'd.pop("key", None)', desc: 'Remove key, return value or None' },
          { cmd: 'from collections import defaultdict', desc: 'Dict with default factory' },
          { cmd: 'from collections import Counter', desc: 'Count hashable elements' },
        ]},
        { title: 'Functions', items: [
          { cmd: 'def f(a, b=0, *, kw_only=True):', desc: 'Keyword-only param after *' },
          { cmd: 'def f(*args, **kwargs):', desc: 'Variadic args' },
          { cmd: 'lambda x, y: x + y', desc: 'Anonymous function' },
          { cmd: 'from functools import wraps', desc: 'Preserve metadata in decorators' },
          { cmd: '@property / @setter', desc: 'Property descriptor' },
          { cmd: '@staticmethod / @classmethod', desc: 'Static / class method' },
          { cmd: 'yield x', desc: 'Generator function (lazy)' },
          { cmd: 'from functools import lru_cache', desc: 'Memoization decorator' },
        ]},
        { title: 'Files & I/O', items: [
          { cmd: 'with open("file.txt") as f:', desc: 'Open file (auto-close)' },
          { cmd: 'f.read() / f.readlines() / f.readline()', desc: 'Read all / lines / one line' },
          { cmd: 'for line in f:', desc: 'Iterate lines (memory efficient)' },
          { cmd: 'open("file", "w") / "a"', desc: 'Write / append mode' },
          { cmd: 'import json; json.loads(s) / json.dumps(d)', desc: 'Parse / serialize JSON' },
          { cmd: 'import pathlib; Path("dir") / "file.txt"', desc: 'Path manipulation' },
          { cmd: 'import csv; csv.reader(f)', desc: 'Read CSV' },
          { cmd: 'import os; os.environ.get("KEY", "default")', desc: 'Environment variable' },
        ]},
        { title: 'Error Handling', items: [
          { cmd: 'try:\n  ...\nexcept ValueError as e:\n  ...\nelse:\n  ...\nfinally:\n  ...', desc: 'Full try/except/else/finally' },
          { cmd: 'raise ValueError("msg")', desc: 'Raise exception' },
          { cmd: 'raise RuntimeError("msg") from e', desc: 'Chain exceptions' },
          { cmd: 'class MyError(Exception): pass', desc: 'Custom exception' },
          { cmd: 'assert condition, "msg"', desc: 'Assert (disabled with -O flag)' },
        ]},
      ]
    },

    regex: {
      label: 'Regex', icon: '🔍',
      sections: [
        { type: 'tester' },
        { title: 'Anchors', items: [
          { cmd: '^', desc: 'Start of line (or string in single-line)' },
          { cmd: '$', desc: 'End of line (or string)' },
          { cmd: '\\A / \\Z', desc: 'Absolute start / end of string' },
          { cmd: '\\b', desc: 'Word boundary' },
          { cmd: '\\B', desc: 'Not a word boundary' },
        ]},
        { title: 'Quantifiers', items: [
          { cmd: '*', desc: 'Zero or more (greedy)' },
          { cmd: '+', desc: 'One or more (greedy)' },
          { cmd: '?', desc: 'Zero or one (greedy)' },
          { cmd: '{n}', desc: 'Exactly n times' },
          { cmd: '{n,}', desc: 'At least n times' },
          { cmd: '{n,m}', desc: 'Between n and m times' },
          { cmd: '*? / +? / ??', desc: 'Non-greedy (lazy) versions' },
          { cmd: '*+ / ++ / ?+', desc: 'Possessive (no backtrack)' },
        ]},
        { title: 'Character Classes', items: [
          { cmd: '.', desc: 'Any char except newline (add s flag for newline)' },
          { cmd: '\\d / \\D', desc: 'Digit [0-9] / Non-digit' },
          { cmd: '\\w / \\W', desc: 'Word char [a-zA-Z0-9_] / Non-word' },
          { cmd: '\\s / \\S', desc: 'Whitespace / Non-whitespace' },
          { cmd: '[abc]', desc: 'Character set' },
          { cmd: '[^abc]', desc: 'Negated character set' },
          { cmd: '[a-z0-9]', desc: 'Range' },
          { cmd: '[\\u00C0-\\u024F]', desc: 'Unicode range (accented chars)' },
        ]},
        { title: 'Groups & Alternation', items: [
          { cmd: '(abc)', desc: 'Capturing group' },
          { cmd: '(?:abc)', desc: 'Non-capturing group' },
          { cmd: '(?<name>abc)', desc: 'Named capturing group' },
          { cmd: '\\1 / $1 / \\k<name>', desc: 'Backreference to group 1 / named' },
          { cmd: 'a|b', desc: 'Alternation (a OR b)' },
          { cmd: '(?>abc)', desc: 'Atomic group (no backtrack)' },
        ]},
        { title: 'Lookaround', items: [
          { cmd: '(?=abc)', desc: 'Positive lookahead — followed by abc' },
          { cmd: '(?!abc)', desc: 'Negative lookahead — not followed by abc' },
          { cmd: '(?<=abc)', desc: 'Positive lookbehind — preceded by abc' },
          { cmd: '(?<!abc)', desc: 'Negative lookbehind — not preceded by abc' },
        ]},
        { title: 'Flags', items: [
          { cmd: 'g', desc: 'Global — find all matches' },
          { cmd: 'i', desc: 'Case-insensitive' },
          { cmd: 'm', desc: 'Multiline — ^ and $ match each line' },
          { cmd: 's', desc: 'Dotall — . matches newlines too' },
          { cmd: 'x', desc: 'Extended — ignore whitespace, allow comments' },
          { cmd: 'u', desc: 'Unicode — handle Unicode correctly' },
        ]},
        { title: 'Common Patterns', items: [
          { cmd: '^[\\w.-]+@[\\w.-]+\\.[a-zA-Z]{2,}$', desc: 'Email (basic)' },
          { cmd: '^https?:\\/\\/[\\w.-]+(?:\\/[\\w./?%&=-]*)?$', desc: 'URL' },
          { cmd: '^\\+?[\\d\\s\\-().]{7,15}$', desc: 'Phone number (flexible)' },
          { cmd: '^\\d{4}-\\d{2}-\\d{2}$', desc: 'Date YYYY-MM-DD' },
          { cmd: '^(?=.*[A-Z])(?=.*\\d).{8,}$', desc: 'Password: 8+ chars, 1 uppercase, 1 digit' },
          { cmd: '<([a-z]+)[^>]*>.*?<\\/\\1>', desc: 'HTML tag (basic, not for production)' },
          { cmd: '#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})', desc: 'Hex color' },
          { cmd: '^\\d{1,3}(\\.\\d{1,3}){3}$', desc: 'IPv4 address' },
        ]},
      ]
    },

    npm: {
      label: 'npm / Node', icon: '📦',
      sections: [
        { title: 'Package Management', items: [
          { cmd: 'npm init -y', desc: 'Create package.json with defaults' },
          { cmd: 'npm install', desc: 'Install all dependencies from package.json' },
          { cmd: 'npm install <pkg>', desc: 'Install and save to dependencies' },
          { cmd: 'npm install -D <pkg>', desc: 'Install as devDependency' },
          { cmd: 'npm install -g <pkg>', desc: 'Install globally' },
          { cmd: 'npm install <pkg>@1.2.3', desc: 'Install specific version' },
          { cmd: 'npm install <pkg>@latest', desc: 'Install latest version' },
          { cmd: 'npm uninstall <pkg>', desc: 'Remove package' },
          { cmd: 'npm update', desc: 'Update all packages' },
          { cmd: 'npm update <pkg>', desc: 'Update specific package' },
          { cmd: 'npm ci', desc: 'Clean install from package-lock.json (CI)' },
          { cmd: 'npm dedupe', desc: 'Remove duplicate packages' },
        ]},
        { title: 'Info & Audit', items: [
          { cmd: 'npm list --depth=0', desc: 'List top-level packages' },
          { cmd: 'npm list -g --depth=0', desc: 'List global packages' },
          { cmd: 'npm outdated', desc: 'Show outdated packages' },
          { cmd: 'npm audit', desc: 'Check for vulnerabilities' },
          { cmd: 'npm audit fix', desc: 'Fix vulnerabilities automatically' },
          { cmd: 'npm view <pkg> versions', desc: 'List all available versions' },
          { cmd: 'npm info <pkg>', desc: 'Package metadata' },
          { cmd: 'npm root -g', desc: 'Global node_modules path' },
        ]},
        { title: 'Scripts', items: [
          { cmd: 'npm run <script>', desc: 'Run script from package.json' },
          { cmd: 'npm run dev / start / build / test', desc: 'Common scripts' },
          { cmd: 'npm run-script <script> -- --flag', desc: 'Pass args to script' },
          { cmd: '"scripts": { "pre<name>": "..." }', desc: 'Pre/post hooks in package.json' },
          { cmd: 'npx <pkg> [args]', desc: 'Run package without installing' },
          { cmd: 'npx --yes create-vite@latest', desc: 'Run latest version of tool' },
        ]},
        { title: 'Node.js Essentials', items: [
          { cmd: 'node -e "console.log(process.version)"', desc: 'Run inline script' },
          { cmd: 'node --watch server.js', desc: 'Watch mode (Node 18+)' },
          { cmd: 'process.env.NODE_ENV', desc: 'Environment variable' },
          { cmd: 'process.argv.slice(2)', desc: 'CLI arguments' },
          { cmd: 'require.resolve("pkg")', desc: 'Resolve module path' },
          { cmd: '__dirname / __filename', desc: 'Current directory / file (CommonJS)' },
          { cmd: 'import.meta.url', desc: 'Current module URL (ESM)' },
          { cmd: 'new URL("./data.json", import.meta.url)', desc: 'Resolve relative path (ESM)' },
        ]},
        { title: 'pnpm / yarn', items: [
          { cmd: 'pnpm install / add / remove', desc: 'pnpm equivalents of npm commands' },
          { cmd: 'pnpm dlx create-vite', desc: 'pnpm equivalent of npx' },
          { cmd: 'yarn add / remove / upgrade', desc: 'Yarn equivalents' },
          { cmd: 'yarn workspaces info', desc: 'Monorepo workspace info' },
        ]},
      ]
    },

    css: {
      label: 'CSS', icon: '🎨',
      sections: [
        { title: 'Selectors', items: [
          { cmd: '.a > .b', desc: 'Direct child only' },
          { cmd: '.a + .b', desc: 'Adjacent sibling (immediately after)' },
          { cmd: '.a ~ .b', desc: 'General sibling (anywhere after)' },
          { cmd: ':is(h1,h2,h3)', desc: 'Matches any of the list' },
          { cmd: ':where(h1,h2)', desc: 'Like :is but zero specificity' },
          { cmd: ':not(.cls, .other)', desc: 'Excludes matches' },
          { cmd: ':has(> img)', desc: 'Parent has a direct img child' },
          { cmd: '[attr^="val"]', desc: 'Attribute starts with val' },
          { cmd: '[attr$="val"]', desc: 'Attribute ends with val' },
          { cmd: '[attr*="val"]', desc: 'Attribute contains val' },
        ]},
        { title: 'Box Model & Layout', items: [
          { cmd: 'box-sizing: border-box', desc: 'Include padding/border in width' },
          { cmd: 'margin: auto', desc: 'Center block horizontally' },
          { cmd: 'display: flex; align-items: center; justify-content: space-between;', desc: 'Flexbox centering' },
          { cmd: 'flex: 1 1 auto', desc: 'grow shrink basis shorthand' },
          { cmd: 'gap: 1rem', desc: 'Gap between flex/grid children' },
          { cmd: 'display: grid; grid-template-columns: repeat(3, 1fr);', desc: '3-column grid' },
          { cmd: 'grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))', desc: 'Responsive grid' },
          { cmd: 'grid-column: 1 / -1', desc: 'Span full row' },
          { cmd: 'place-items: center', desc: 'Center in grid cell (align + justify)' },
          { cmd: 'position: sticky; top: 0;', desc: 'Sticky element' },
          { cmd: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;', desc: 'Truncate text' },
          { cmd: 'aspect-ratio: 16 / 9', desc: 'Fixed aspect ratio box' },
        ]},
        { title: 'Custom Properties', items: [
          { cmd: ':root { --color: #6366f1; }', desc: 'Declare CSS variable' },
          { cmd: 'color: var(--color, fallback)', desc: 'Use CSS variable with fallback' },
          { cmd: '@property --hue { syntax: "<number>"; inherits: true; initial-value: 0; }', desc: 'Typed custom property' },
          { cmd: 'color-mix(in srgb, red 30%, blue)', desc: 'Mix colors natively' },
        ]},
        { title: 'Typography', items: [
          { cmd: 'font: 700 1.2rem/1.5 "Inter", sans-serif', desc: 'Font shorthand' },
          { cmd: 'font-size: clamp(1rem, 2.5vw, 1.5rem)', desc: 'Responsive font size' },
          { cmd: 'letter-spacing: 0.05em', desc: 'Tracking' },
          { cmd: '-webkit-background-clip: text; -webkit-text-fill-color: transparent', desc: 'Gradient text' },
          { cmd: 'text-wrap: balance', desc: 'Balanced heading wrapping' },
          { cmd: 'line-clamp: 3', desc: 'Truncate to 3 lines (standard)' },
        ]},
        { title: 'Transforms & Animations', items: [
          { cmd: 'transform: translateX(-50%) translateY(-50%)', desc: 'Center with translate' },
          { cmd: 'transition: all 200ms ease', desc: 'Smooth all property changes' },
          { cmd: 'animation: name 1s ease infinite alternate', desc: 'Animation shorthand' },
          { cmd: '@keyframes spin { to { transform: rotate(360deg) } }', desc: 'Rotation keyframe' },
          { cmd: 'will-change: transform', desc: 'Hint for GPU compositing' },
          { cmd: 'transform: scale(1.05); filter: brightness(1.1);', desc: 'Hover effect' },
        ]},
        { title: 'Responsive', items: [
          { cmd: '@media (max-width: 768px) { }', desc: 'Mobile breakpoint' },
          { cmd: '@media (prefers-color-scheme: dark) { }', desc: 'Dark mode preference' },
          { cmd: '@media (prefers-reduced-motion: reduce) { }', desc: 'Respect reduced motion' },
          { cmd: '@container (min-width: 400px) { }', desc: 'Container query' },
          { cmd: 'min(100%, 600px)', desc: 'Never wider than 600px' },
          { cmd: 'padding: clamp(1rem, 5vw, 3rem)', desc: 'Fluid padding' },
        ]},
      ]
    },

    sql: {
      label: 'PostgreSQL', icon: '🐘',
      sections: [
        { title: 'Queries', items: [
          { cmd: 'SELECT col1, col2 FROM table WHERE col = val ORDER BY col DESC LIMIT 10', desc: 'Basic SELECT' },
          { cmd: 'SELECT DISTINCT col FROM table', desc: 'Remove duplicates' },
          { cmd: 'SELECT * FROM t WHERE col LIKE "%pattern%"', desc: 'Pattern matching' },
          { cmd: 'SELECT * FROM t WHERE col BETWEEN 10 AND 20', desc: 'Range filter' },
          { cmd: 'SELECT * FROM t WHERE col IN (1, 2, 3)', desc: 'Value list filter' },
          { cmd: 'SELECT * FROM t WHERE col IS NULL', desc: 'Null check' },
          { cmd: 'SELECT COUNT(*), AVG(col), MAX(col), MIN(col) FROM t', desc: 'Aggregates' },
          { cmd: 'SELECT col, COUNT(*) FROM t GROUP BY col HAVING COUNT(*) > 5', desc: 'Group and filter groups' },
        ]},
        { title: 'Joins', items: [
          { cmd: 'SELECT * FROM a INNER JOIN b ON a.id = b.a_id', desc: 'Inner join (matching only)' },
          { cmd: 'SELECT * FROM a LEFT JOIN b ON a.id = b.a_id', desc: 'Left join (all from a)' },
          { cmd: 'SELECT * FROM a FULL OUTER JOIN b ON a.id = b.a_id', desc: 'Full outer join' },
          { cmd: 'SELECT * FROM a CROSS JOIN b', desc: 'Cartesian product' },
          { cmd: 'SELECT * FROM a JOIN b USING (id)', desc: 'Join on same-named column' },
        ]},
        { title: 'Subqueries & CTEs', items: [
          { cmd: 'SELECT * FROM t WHERE id IN (SELECT id FROM other WHERE ...)', desc: 'Subquery in WHERE' },
          { cmd: 'WITH cte AS (SELECT ...) SELECT * FROM cte', desc: 'Common Table Expression' },
          { cmd: 'WITH RECURSIVE cte AS (SELECT ... UNION ALL SELECT ... FROM cte)', desc: 'Recursive CTE' },
          { cmd: 'SELECT *, ROW_NUMBER() OVER (PARTITION BY col ORDER BY date DESC) rn FROM t', desc: 'Window function' },
          { cmd: 'SELECT *, LAG(col) OVER (ORDER BY date) AS prev FROM t', desc: 'LAG window function' },
        ]},
        { title: 'Modifications', items: [
          { cmd: 'INSERT INTO t (col1, col2) VALUES (v1, v2)', desc: 'Insert row' },
          { cmd: 'INSERT INTO t SELECT * FROM other WHERE ...', desc: 'Insert from SELECT' },
          { cmd: 'UPDATE t SET col = val WHERE condition', desc: 'Update rows' },
          { cmd: 'DELETE FROM t WHERE condition', desc: 'Delete rows' },
          { cmd: 'TRUNCATE TABLE t', desc: 'Delete all rows (fast, no WHERE)' },
          { cmd: 'INSERT INTO t ... ON CONFLICT (col) DO UPDATE SET ...', desc: 'Upsert (PostgreSQL)' },
          { cmd: 'MERGE INTO target USING source ON ... WHEN MATCHED ...', desc: 'Merge/upsert (SQL standard)' },
        ]},
        { title: 'Schema', items: [
          { cmd: 'CREATE TABLE t (id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())', desc: 'Create table' },
          { cmd: 'CREATE TABLE t (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, ...)', desc: 'Identity column (modern)' },
          { cmd: 'ALTER TABLE t ADD COLUMN col TYPE', desc: 'Add column' },
          { cmd: 'ALTER TABLE t DROP COLUMN col', desc: 'Drop column' },
          { cmd: 'ALTER TABLE t RENAME COLUMN old TO new', desc: 'Rename column' },
          { cmd: 'ALTER TABLE t ALTER COLUMN col SET NOT NULL', desc: 'Add NOT NULL constraint' },
          { cmd: 'CREATE INDEX idx ON t (col)', desc: 'Create index' },
          { cmd: 'CREATE UNIQUE INDEX idx ON t (col)', desc: 'Unique index' },
          { cmd: 'CREATE INDEX CONCURRENTLY idx ON t (col)', desc: 'Index without locking (production-safe)' },
          { cmd: 'DROP TABLE IF EXISTS t', desc: 'Drop table if exists' },
          { cmd: 'EXPLAIN ANALYZE SELECT ...', desc: 'Query execution plan + timing' },
          { cmd: 'VACUUM ANALYZE t', desc: 'Reclaim space and update statistics' },
        ]},
        { title: 'JSONB', items: [
          { cmd: "col->'key'", desc: "Get JSON field as JSON" },
          { cmd: "col->>'key'", desc: "Get JSON field as text" },
          { cmd: "col#>>'{a,b}'", desc: "Get nested path as text" },
          { cmd: "col @> '{\"key\":\"val\"}'::jsonb", desc: "JSONB contains (uses GIN index)" },
          { cmd: "col ? 'key'", desc: "JSONB has key" },
          { cmd: "jsonb_set(col, '{key}', '\"new\"')", desc: "Update a JSONB field" },
          { cmd: "col || '{\"extra\":1}'::jsonb", desc: "Merge JSONB objects" },
          { cmd: "jsonb_each(col)", desc: "Expand JSONB object to rows" },
          { cmd: "jsonb_array_elements(col->'arr')", desc: "Expand JSON array to rows" },
          { cmd: "CREATE INDEX idx ON t USING gin(col)", desc: "GIN index for JSONB queries" },
        ]},
        { title: 'Arrays', items: [
          { cmd: "col = ARRAY['a','b']", desc: "Array literal" },
          { cmd: "col[1]", desc: "Array element (1-indexed)" },
          { cmd: "col[1:3]", desc: "Array slice" },
          { cmd: "array_length(col, 1)", desc: "Length of 1st dimension" },
          { cmd: "'val' = ANY(col)", desc: "Value in array" },
          { cmd: "col @> ARRAY['a']", desc: "Array contains element" },
          { cmd: "col && ARRAY['a','b']", desc: "Arrays overlap" },
          { cmd: "array_append(col, 'new')", desc: "Append element" },
          { cmd: "unnest(col)", desc: "Expand array to rows" },
          { cmd: "string_to_array('a,b,c', ',')", desc: "Split string to array" },
          { cmd: "array_to_string(col, ',')", desc: "Array to delimited string" },
        ]},
        { title: 'psql CLI — Connect', items: [
          { cmd: 'psql -h host -U user -d dbname', desc: 'Connect to database' },
          { cmd: 'psql "postgresql://user:pass@host/db"', desc: 'Connect via URL' },
          { cmd: 'psql -h host -U user -d db -p 5433', desc: 'Custom port' },
          { cmd: 'PGPASSWORD=secret psql -h host -U user -d db', desc: 'Pass password via env' },
          { cmd: '\\q', desc: 'Quit psql' },
          { cmd: '\\!', desc: 'Run a shell command from within psql' },
        ]},
        { title: 'psql CLI — Navigation', items: [
          { cmd: '\\l  or  \\list', desc: 'List all databases' },
          { cmd: '\\c dbname', desc: 'Switch/connect to database' },
          { cmd: '\\dt', desc: 'List tables in current schema' },
          { cmd: '\\dt schema.*', desc: 'List tables in specific schema' },
          { cmd: '\\d tablename', desc: 'Describe table (columns, types, constraints)' },
          { cmd: '\\d+ tablename', desc: 'Verbose table description (storage, triggers)' },
          { cmd: '\\di', desc: 'List indexes' },
          { cmd: '\\df', desc: 'List functions' },
          { cmd: '\\dv', desc: 'List views' },
          { cmd: '\\ds', desc: 'List sequences' },
          { cmd: '\\dn', desc: 'List schemas' },
          { cmd: '\\du  or  \\dg', desc: 'List users/roles' },
          { cmd: '\\dp tablename', desc: 'Show table privileges' },
        ]},
        { title: 'psql CLI — Query & Output', items: [
          { cmd: '\\x', desc: 'Toggle expanded (vertical) display for wide rows' },
          { cmd: '\\x auto', desc: 'Auto-switch to expanded when rows are too wide' },
          { cmd: '\\timing', desc: 'Toggle query execution timing' },
          { cmd: '\\a', desc: 'Toggle aligned/unaligned output' },
          { cmd: '\\t', desc: 'Toggle tuple-only output (no headers)' },
          { cmd: '\\H', desc: 'Toggle HTML output mode' },
          { cmd: '\\pset format csv', desc: 'Set output format to CSV' },
          { cmd: '\\pset null NULL', desc: 'Display NULLs as "NULL"' },
          { cmd: '\\i file.sql', desc: 'Execute SQL from file' },
          { cmd: '\\o output.txt', desc: 'Redirect output to file' },
          { cmd: '\\o', desc: 'Stop redirecting output (back to screen)' },
          { cmd: '\\g [file]', desc: 'Execute current query buffer (optionally to file)' },
          { cmd: '\\e', desc: 'Open query in external editor ($EDITOR)' },
        ]},
        { title: 'psql CLI — Import / Export', items: [
          { cmd: "COPY t FROM '/path/file.csv' CSV HEADER", desc: 'Server-side import CSV (superuser)' },
          { cmd: "\\copy t FROM 'file.csv' CSV HEADER", desc: 'Client-side import CSV (no superuser needed)' },
          { cmd: "\\copy t TO 'out.csv' CSV HEADER", desc: 'Export table to CSV (client-side)' },
          { cmd: "\\copy (SELECT ...) TO 'out.csv' CSV HEADER", desc: 'Export query result to CSV' },
          { cmd: 'pg_dump -U user -d db > dump.sql', desc: 'Dump database to SQL file' },
          { cmd: 'pg_dump -U user -Fc -d db > db.dump', desc: 'Custom binary format dump' },
          { cmd: 'pg_restore -U user -d db db.dump', desc: 'Restore from binary dump' },
          { cmd: 'psql -U user -d db < dump.sql', desc: 'Restore from SQL file' },
        ]},
        { title: 'psql CLI — Variables & History', items: [
          { cmd: '\\set VAR value', desc: 'Set a psql variable' },
          { cmd: "SELECT :VAR", desc: 'Use a psql variable in a query' },
          { cmd: '\\unset VAR', desc: 'Unset a variable' },
          { cmd: '\\set', desc: 'Show all current variables' },
          { cmd: '\\s', desc: 'Show command history' },
          { cmd: '\\s file.txt', desc: 'Save command history to file' },
          { cmd: '\\?', desc: 'Help on psql backslash commands' },
          { cmd: '\\h SELECT', desc: 'Help on SQL command syntax' },
        ]},
        { title: 'Performance', items: [
          { cmd: "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10", desc: 'Slowest queries (requires extension)' },
          { cmd: "SELECT * FROM pg_stat_activity WHERE state = 'active'", desc: 'Active connections' },
          { cmd: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE ...", desc: 'Kill a connection' },
          { cmd: "SELECT * FROM pg_indexes WHERE tablename = 't'", desc: 'List table indexes' },
          { cmd: "SELECT * FROM pg_stat_user_tables", desc: 'Table statistics (seq scans, rows, etc.)' },
          { cmd: "SELECT pg_size_pretty(pg_total_relation_size('t'))", desc: 'Table size including indexes' },
          { cmd: "CREATE EXTENSION IF NOT EXISTS pg_stat_statements", desc: 'Enable query statistics extension' },
          { cmd: "SET work_mem = '256MB'", desc: 'Sort/hash memory for this session' },
        ]},
      ]
    },

    claude: {
      label: 'Claude Code', icon: '🤖',
      sections: [
        { title: 'CLI Basics', items: [
          { cmd: 'claude', desc: 'Start interactive session' },
          { cmd: 'claude "task description"', desc: 'Non-interactive one-shot task' },
          { cmd: 'claude -p "prompt"', desc: 'Print mode (outputs to stdout, no interaction)' },
          { cmd: 'claude --resume', desc: 'Resume last conversation' },
          { cmd: 'claude --continue', desc: 'Continue most recent conversation' },
          { cmd: 'claude --model claude-opus-4-7', desc: 'Use specific model' },
          { cmd: 'claude --dangerously-skip-permissions', desc: 'Skip permission prompts' },
          { cmd: '! <command>', desc: 'Run shell command inside Claude Code session' },
        ]},
        { title: 'Slash Commands', items: [
          { cmd: '/help', desc: 'Show available commands and help' },
          { cmd: '/clear', desc: 'Clear conversation context (fresh start)' },
          { cmd: '/compact', desc: 'Summarize context to save tokens' },
          { cmd: '/status', desc: 'Show current model, context usage' },
          { cmd: '/cost', desc: 'Show session token usage and cost' },
          { cmd: '/doctor', desc: 'Check environment and diagnose issues' },
          { cmd: '/fast', desc: 'Toggle fast mode (Opus with faster output)' },
          { cmd: '/loop', desc: 'Start a looping autonomous session' },
          { cmd: '/review', desc: 'Code review mode' },
          { cmd: '/plan', desc: 'Plan mode — generate steps before executing' },
        ]},
        { title: 'Tools Available', items: [
          { cmd: 'Read', desc: 'Read a file (always required before Edit/Write)' },
          { cmd: 'Write', desc: 'Create or overwrite a file completely' },
          { cmd: 'Edit', desc: 'Targeted string replacement in a file (prefer over Write)' },
          { cmd: 'Glob', desc: 'Find files matching a pattern' },
          { cmd: 'Grep', desc: 'Search file contents with regex' },
          { cmd: 'Bash', desc: 'Run shell commands' },
          { cmd: 'Agent (Explore)', desc: 'Spawn read-only search agent' },
          { cmd: 'Agent (Plan)', desc: 'Spawn architect agent for implementation plans' },
          { cmd: 'WebFetch / WebSearch', desc: 'Fetch URL or search the web' },
          { cmd: 'TaskCreate / TaskUpdate', desc: 'Track multi-step work' },
        ]},
        { title: 'CLAUDE.md', items: [
          { cmd: 'CLAUDE.md (repo root)', desc: 'Project-level instructions (in version control)' },
          { cmd: '~/.claude/CLAUDE.md', desc: 'Global personal instructions (all projects)' },
          { cmd: 'dir/CLAUDE.md', desc: 'Subdirectory-scoped instructions' },
          { cmd: 'Keep instructions declarative, not procedural', desc: 'Best practice' },
          { cmd: 'Include: tech stack, conventions, test commands', desc: 'Useful CLAUDE.md content' },
          { cmd: '.claudeignore', desc: 'Files/patterns to exclude from context' },
        ]},
        { title: 'Prompting Tips', items: [
          { cmd: 'Specify exact file paths and line numbers', desc: 'Reduces ambiguity and errors' },
          { cmd: 'Include full error messages verbatim', desc: 'Better diagnosis accuracy' },
          { cmd: 'Describe expected vs actual behavior', desc: 'Clearer bug reports' },
          { cmd: '"Only change X, do not refactor anything else"', desc: 'Constrain scope' },
          { cmd: '"Show me the plan before implementing"', desc: 'Review strategy first' },
          { cmd: '"This is a CTF / authorized pentest"', desc: 'Provide context for security tasks' },
          { cmd: 'Use /compact before long sessions', desc: 'Saves tokens, keeps context' },
          { cmd: '"Do not commit, just stage the changes"', desc: 'Control git operations' },
        ]},
        { title: 'Keyboard Shortcuts', items: [
          { cmd: 'Ctrl+C', desc: 'Cancel current operation' },
          { cmd: 'Ctrl+D', desc: 'End session (EOF)' },
          { cmd: 'Ctrl+L', desc: 'Clear terminal screen' },
          { cmd: 'Shift+Enter', desc: 'Insert newline in input' },
          { cmd: '↑ / ↓', desc: 'Navigate command history' },
          { cmd: 'Tab', desc: 'Autocomplete file paths' },
        ]},
        { title: 'MCP Servers', items: [
          { cmd: 'claude mcp add -- npx -y @modelcontextprotocol/server-filesystem /path', desc: 'Add filesystem MCP server' },
          { cmd: 'claude mcp add -s user -- npx -y @modelcontextprotocol/server-github', desc: 'Add GitHub MCP (user scope, all projects)' },
          { cmd: 'claude mcp add -s local -- python server.py', desc: 'Add local MCP server (project scope)' },
          { cmd: 'claude mcp list', desc: 'List configured MCP servers' },
          { cmd: 'claude mcp get <name>', desc: 'Show MCP server details' },
          { cmd: 'claude mcp remove <name>', desc: 'Remove an MCP server' },
          { cmd: '/mcp', desc: 'List available MCP tools in current session' },
          { cmd: 'Scopes: local (project) → user (~/.claude) → global', desc: 'MCP server scope hierarchy' },
        ]},
        { title: 'Settings & Hooks', items: [
          { cmd: 'ANTHROPIC_API_KEY=sk-ant-...', desc: 'API key (env var or keychain)' },
          { cmd: 'ANTHROPIC_BASE_URL=https://...', desc: 'Custom API endpoint (proxies, etc.)' },
          { cmd: 'CLAUDE_CODE_MAX_OUTPUT_TOKENS', desc: 'Override max output tokens' },
          { cmd: 'claude config set preferredNotifChannel browser', desc: 'Set config value' },
          { cmd: 'claude config list', desc: 'List all config values' },
          { cmd: '~/.claude/settings.json', desc: 'Global settings file (allowedTools, etc.)' },
          { cmd: '.claude/settings.json', desc: 'Project-level settings (version-controlled)' },
          { cmd: 'hooks.PreToolUse / PostToolUse', desc: 'Shell commands that run before/after tool calls' },
          { cmd: 'hooks.UserPromptSubmit', desc: 'Hook that runs when user submits a message' },
          { cmd: 'hooks.Stop', desc: 'Hook that runs when Claude finishes a response' },
        ]},
        { title: 'Automation & CI', items: [
          { cmd: 'claude -p "task" --output-format json', desc: 'Output structured JSON (for pipelines)' },
          { cmd: 'claude -p "$(cat prompt.txt)" < context.txt', desc: 'Pipe file content as stdin context' },
          { cmd: 'git diff | claude -p "review this diff"', desc: 'Review git diff in CI' },
          { cmd: 'claude --max-turns 5 -p "task"', desc: 'Limit agent to 5 turns (safety for CI)' },
          { cmd: 'claude --model claude-haiku-4-5-20251001 -p "task"', desc: 'Use Haiku for fast/cheap tasks' },
          { cmd: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1', desc: 'Disable telemetry (CI/offline)' },
          { cmd: '#!/usr/bin/env -S claude -p', desc: 'Use Claude Code as script interpreter' },
        ]},
      ]
    },

    http: {
      label: 'HTTP / API', icon: '🌐',
      sections: [
        { title: 'HTTP Methods', items: [
          { cmd: 'GET', desc: 'Retrieve resource (idempotent, cacheable)' },
          { cmd: 'POST', desc: 'Create resource / submit data (not idempotent)' },
          { cmd: 'PUT', desc: 'Replace resource entirely (idempotent)' },
          { cmd: 'PATCH', desc: 'Partial update (not necessarily idempotent)' },
          { cmd: 'DELETE', desc: 'Delete resource (idempotent)' },
          { cmd: 'HEAD', desc: 'Like GET but no body (check existence, headers)' },
          { cmd: 'OPTIONS', desc: 'Allowed methods, CORS preflight' },
        ]},
        { title: 'Status Codes', items: [
          { cmd: '200 OK / 201 Created / 204 No Content', desc: 'Success responses' },
          { cmd: '301 Moved Permanently / 302 Found / 307 Temporary Redirect', desc: 'Redirects' },
          { cmd: '400 Bad Request', desc: 'Client sent invalid data' },
          { cmd: '401 Unauthorized', desc: 'Authentication required/failed' },
          { cmd: '403 Forbidden', desc: 'Authenticated but not authorized' },
          { cmd: '404 Not Found', desc: 'Resource does not exist' },
          { cmd: '409 Conflict', desc: 'State conflict (e.g. duplicate)' },
          { cmd: '422 Unprocessable Entity', desc: 'Validation failed' },
          { cmd: '429 Too Many Requests', desc: 'Rate limited' },
          { cmd: '500 Internal Server Error', desc: 'Server-side bug' },
          { cmd: '502 Bad Gateway / 503 Service Unavailable', desc: 'Upstream/downstream issues' },
        ]},
        { title: 'Headers', items: [
          { cmd: 'Content-Type: application/json', desc: 'Request/response body type' },
          { cmd: 'Authorization: Bearer <token>', desc: 'JWT / OAuth token' },
          { cmd: 'Cache-Control: no-cache, no-store', desc: 'Disable caching' },
          { cmd: 'Cache-Control: max-age=3600, public', desc: 'Cache 1 hour, publicly' },
          { cmd: 'ETag: "hash"', desc: 'Version identifier for conditional requests' },
          { cmd: 'If-None-Match: "hash"', desc: 'Conditional GET (304 if unchanged)' },
          { cmd: 'CORS: Access-Control-Allow-Origin: *', desc: 'Allow all origins' },
          { cmd: 'X-Request-ID: uuid', desc: 'Trace requests through system' },
          { cmd: 'Retry-After: 60', desc: 'How long to wait before retry' },
        ]},
        { title: 'REST Conventions', items: [
          { cmd: 'GET /users', desc: 'List all users' },
          { cmd: 'GET /users/:id', desc: 'Get specific user' },
          { cmd: 'POST /users', desc: 'Create user' },
          { cmd: 'PUT /users/:id', desc: 'Replace user' },
          { cmd: 'PATCH /users/:id', desc: 'Update user fields' },
          { cmd: 'DELETE /users/:id', desc: 'Delete user' },
          { cmd: 'GET /users/:id/posts', desc: 'Nested resource' },
          { cmd: 'GET /users?page=2&limit=20&sort=name', desc: 'Pagination + filtering' },
        ]},
        { title: 'curl Examples', items: [
          { cmd: 'curl -s https://api.example.com/data | jq .', desc: 'GET and pretty-print JSON' },
          { cmd: 'curl -X POST -H "Content-Type: application/json" -d \'{"key":"val"}\' url', desc: 'POST JSON' },
          { cmd: 'curl -H "Authorization: Bearer $TOKEN" url', desc: 'Authenticated request' },
          { cmd: 'curl -v url 2>&1 | head -30', desc: 'Verbose: see request + response headers' },
          { cmd: 'curl -o /dev/null -s -w "%{http_code}" url', desc: 'Only print status code' },
          { cmd: 'curl --retry 3 --retry-delay 2 url', desc: 'Auto retry on failure' },
          { cmd: 'curl -L url', desc: 'Follow redirects' },
          { cmd: 'curl -b "session=abc" -c cookies.txt url', desc: 'Send and save cookies' },
        ]},
      ]
    },

    windows: {
      label: 'Windows', icon: '🪟',
      sections: [
        { title: 'System & General', items: [
          { cmd: 'Win', desc: 'Open/close Start menu' },
          { cmd: 'Win + D', desc: 'Show/hide desktop' },
          { cmd: 'Win + E', desc: 'Open File Explorer' },
          { cmd: 'Win + I', desc: 'Open Settings' },
          { cmd: 'Win + L', desc: 'Lock computer' },
          { cmd: 'Win + R', desc: 'Open Run dialog' },
          { cmd: 'Win + S / Win + Q', desc: 'Open Search' },
          { cmd: 'Win + X', desc: 'Open Quick Link menu (Power User menu)' },
          { cmd: 'Win + Pause/Break', desc: 'Open System Properties' },
          { cmd: 'Win + Print Screen', desc: 'Screenshot → Pictures/Screenshots' },
          { cmd: 'Win + Shift + S', desc: 'Screenshot with Snipping Tool (region select)' },
          { cmd: 'Win + G', desc: 'Open Xbox Game Bar (screenshots, recording)' },
          { cmd: 'Win + Alt + R', desc: 'Start/stop screen recording (Game Bar)' },
          { cmd: 'Win + V', desc: 'Clipboard history' },
          { cmd: 'Win + . / Win + ;', desc: 'Emoji & symbols picker' },
          { cmd: 'Win + Space', desc: 'Switch input language/keyboard layout' },
          { cmd: 'Win + Ctrl + D', desc: 'Create new virtual desktop' },
          { cmd: 'Win + Ctrl + F4', desc: 'Close current virtual desktop' },
          { cmd: 'Win + Ctrl + ←/→', desc: 'Switch between virtual desktops' },
        ]},
        { title: 'Window Management', items: [
          { cmd: 'Win + ↑', desc: 'Maximize window' },
          { cmd: 'Win + ↓', desc: 'Minimize / restore window' },
          { cmd: 'Win + ← / Win + →', desc: 'Snap window to left/right half' },
          { cmd: 'Win + Shift + ←/→', desc: 'Move window to another monitor' },
          { cmd: 'Win + Home', desc: 'Minimize all non-active windows' },
          { cmd: 'Win + M', desc: 'Minimize all windows' },
          { cmd: 'Win + Shift + M', desc: 'Restore all minimized windows' },
          { cmd: 'Win + T', desc: 'Cycle through taskbar apps' },
          { cmd: 'Win + [1-9]', desc: 'Open/switch to taskbar app by position' },
          { cmd: 'Win + Shift + [1-9]', desc: 'Open new instance of taskbar app' },
          { cmd: 'Alt + Tab', desc: 'Switch between open windows' },
          { cmd: 'Win + Tab', desc: 'Task View (all windows + virtual desktops)' },
          { cmd: 'Alt + F4', desc: 'Close active window / shut down (on desktop)' },
          { cmd: 'Ctrl + Alt + Tab', desc: 'Persistent Alt+Tab (stays open)' },
        ]},
        { title: 'Text Editing', items: [
          { cmd: 'Ctrl + A', desc: 'Select all' },
          { cmd: 'Ctrl + C / X / V', desc: 'Copy / Cut / Paste' },
          { cmd: 'Ctrl + Z / Y', desc: 'Undo / Redo' },
          { cmd: 'Ctrl + ← / →', desc: 'Move cursor word by word' },
          { cmd: 'Ctrl + Shift + ← / →', desc: 'Select word by word' },
          { cmd: 'Home / End', desc: 'Beginning / end of line' },
          { cmd: 'Ctrl + Home / End', desc: 'Beginning / end of document' },
          { cmd: 'Shift + ←/→/↑/↓', desc: 'Extend selection character/line' },
          { cmd: 'Ctrl + Shift + Home/End', desc: 'Select to beginning/end of document' },
          { cmd: 'Delete', desc: 'Delete character to the right' },
          { cmd: 'Ctrl + Backspace / Delete', desc: 'Delete word left / right' },
          { cmd: 'Insert', desc: 'Toggle insert/overtype mode' },
        ]},
        { title: 'File Explorer', items: [
          { cmd: 'F2', desc: 'Rename selected file/folder' },
          { cmd: 'F3 / Ctrl + F', desc: 'Search in current folder' },
          { cmd: 'F5', desc: 'Refresh' },
          { cmd: 'Alt + D / Ctrl + L', desc: 'Focus address bar' },
          { cmd: 'Alt + ← / →', desc: 'Back / Forward' },
          { cmd: 'Alt + ↑', desc: 'Up one level (parent folder)' },
          { cmd: 'Ctrl + N', desc: 'New Explorer window' },
          { cmd: 'Ctrl + W', desc: 'Close current tab / window' },
          { cmd: 'Ctrl + T', desc: 'New tab (Windows 11)' },
          { cmd: 'Ctrl + Shift + N', desc: 'Create new folder' },
          { cmd: 'Shift + Delete', desc: 'Permanently delete (bypass Recycle Bin)' },
          { cmd: 'Alt + Enter', desc: 'Open Properties for selected item' },
          { cmd: 'Ctrl + click', desc: 'Select multiple individual items' },
          { cmd: 'Shift + click', desc: 'Select range of items' },
          { cmd: '* (numpad)', desc: 'Expand all subfolders in tree view' },
        ]},
        { title: 'Taskbar & Desktop', items: [
          { cmd: 'Ctrl + Shift + Esc', desc: 'Open Task Manager directly' },
          { cmd: 'Ctrl + Alt + Delete', desc: 'Security screen (Task Manager, sign out, lock)' },
          { cmd: 'Win + B', desc: 'Focus system tray (notification area)' },
          { cmd: 'Win + A', desc: 'Open Action Center / Quick Settings' },
          { cmd: 'Win + N', desc: 'Open Notification Center' },
          { cmd: 'Win + K', desc: 'Cast/connect to wireless display' },
          { cmd: 'Win + P', desc: 'Project (duplicate/extend display mode)' },
          { cmd: 'Win + H', desc: 'Start voice typing / dictation' },
          { cmd: 'Win + Ctrl + Shift + B', desc: 'Reset display driver (black screen fix)' },
        ]},
        { title: 'Browser (Chrome / Edge / Firefox)', items: [
          { cmd: 'Ctrl + T', desc: 'New tab' },
          { cmd: 'Ctrl + W', desc: 'Close tab' },
          { cmd: 'Ctrl + Shift + T', desc: 'Reopen closed tab' },
          { cmd: 'Ctrl + Tab / Ctrl + Shift + Tab', desc: 'Next / previous tab' },
          { cmd: 'Ctrl + [1-9]', desc: 'Switch to tab by number' },
          { cmd: 'Ctrl + L / Alt + D / F6', desc: 'Focus address bar' },
          { cmd: 'Ctrl + F / Ctrl + G / Shift + Ctrl + G', desc: 'Find on page / next / previous' },
          { cmd: 'Ctrl + R / F5', desc: 'Reload page' },
          { cmd: 'Ctrl + Shift + R', desc: 'Hard reload (bypass cache)' },
          { cmd: 'Ctrl + D', desc: 'Bookmark current page' },
          { cmd: 'Ctrl + H', desc: 'History' },
          { cmd: 'Ctrl + J', desc: 'Downloads' },
          { cmd: 'Ctrl + Shift + I / F12', desc: 'Developer Tools' },
          { cmd: 'Ctrl + +/- / Ctrl + 0', desc: 'Zoom in / out / reset' },
          { cmd: 'Ctrl + Shift + N', desc: 'Incognito/private window' },
          { cmd: 'Ctrl + Shift + Delete', desc: 'Clear browsing data' },
        ]},
        { title: 'Accessibility', items: [
          { cmd: 'Win + + (plus)', desc: 'Magnifier — zoom in' },
          { cmd: 'Win + - (minus)', desc: 'Magnifier — zoom out' },
          { cmd: 'Win + Esc', desc: 'Close Magnifier' },
          { cmd: 'Win + U', desc: 'Open Accessibility settings' },
          { cmd: 'Alt + Shift + Print Screen', desc: 'Toggle High Contrast' },
          { cmd: 'Win + Ctrl + Enter', desc: 'Toggle Narrator (screen reader)' },
          { cmd: 'Win + Ctrl + N', desc: 'Open Narrator settings' },
          { cmd: 'Ctrl + Alt + I', desc: 'Invert colors (in Magnifier)' },
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
    } catch { btn.textContent = '✗'; setTimeout(() => { btn.textContent = _t('Copy', 'Copiar'); }, 1200); }
  }

  function renderSections(sheetId, q) {
    const sheet = DATA[sheetId];
    if (!sheet) return `<div class="cs-empty">${_t('Not found.', 'Não encontrado.')}</div>`;
    const lq = q.toLowerCase();
    const html = sheet.sections.map(sec => {
      if (sec.type === 'tester') return `<div class="cs-regex-tester">
        <div class="cs-regex-tester-title">🧪 Regex Tester</div>
        <div class="cs-regex-row">
          <input class="cs-regex-pattern" id="cs-rx-pat" type="text" placeholder="^[a-z]+$" spellcheck="false" autocomplete="off">
          <div class="rx-flags">
            <button class="rx-flag-btn" data-flag="i" title="case insensitive">i</button>
            <button class="rx-flag-btn" data-flag="m" title="multiline">m</button>
            <button class="rx-flag-btn" data-flag="s" title="dotAll">s</button>
          </div>
        </div>
        <div class="cs-regex-test"><textarea id="cs-rx-txt" placeholder="${_t('Type or paste test text here…', 'Escreve ou cola o texto de teste aqui…')}" rows="4"></textarea></div>
        <div class="cs-regex-matches" id="cs-rx-out"><span class="cs-regex-match-count">—</span></div>
      </div>`;
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
              <button class="cs-copy" data-cmd="${esc(item.cmd)}">${_t('Copy', 'Copiar')}</button>
            </div>`).join('')}
        </div>
      </div>`;
    }).join('');
    return html || `<div class="cs-empty">${_t('No results for this filter.', 'Sem resultados para este filtro.')}</div>`;
  }

  function bindCopyBtns(container) {
    container.querySelectorAll('.cs-copy').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.cmd, btn));
    });
  }

  function bindTesterEvents(container) {
    const pat = container.querySelector('#cs-rx-pat');
    const txt = container.querySelector('#cs-rx-txt');
    const out = container.querySelector('#cs-rx-out');
    if (!pat || !txt || !out) return;
    function runTest() {
      const p = pat.value.trim();
      const t = txt.value;
      if (!p || !t) { out.innerHTML = '<span class="cs-regex-match-count">—</span>'; return; }
      const extraFlags = ['i','m','s'].filter(f => container.querySelector(`.rx-flag-btn[data-flag="${f}"]`)?.classList.contains('on')).join('');
      let re;
      try { re = new RegExp(p, 'g' + extraFlags); } catch(e) {
        out.innerHTML = `<span class="cs-regex-match-count" style="color:var(--red)">⚠ ${esc(e.message)}</span>`;
        return;
      }
      const ms = [...t.matchAll(re)];
      if (!ms.length) { out.innerHTML = `<span class="cs-regex-match-count">${_t('No matches', 'Sem correspondências')}</span>`; return; }
      const tags = ms.slice(0,40).map(m => `<span class="cs-regex-match-tag">${esc(m[0]||'ε')}</span>`).join('');
      const more = ms.length > 40 ? `<span class="cs-regex-match-tag" style="opacity:.5">+${ms.length-40} ${_t('more','mais')}</span>` : '';
      const lbl = _t(`${ms.length} match${ms.length===1?'':'es'}`, `${ms.length} correspondência${ms.length===1?'':'s'}`);
      out.innerHTML = `<span class="cs-regex-match-count">${lbl}</span><div class="cs-regex-match-list">${tags}${more}</div>`;
    }
    container.querySelectorAll('.rx-flag-btn').forEach(b => b.addEventListener('click', () => { b.classList.toggle('on'); runTest(); }));
    pat.addEventListener('input', runTest);
    txt.addEventListener('input', runTest);
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
      bindTesterEvents(content);
      content.scrollTop = 0;
    }
  }

  function render() {
    const page = document.getElementById('cheatsheets-page');
    if (!page) return;

    page.innerHTML = `
      <div class="cs-layout">
        <div class="cs-sidebar">
          <div class="cs-search-wrap">
            <input type="search" class="cs-search" id="cs-search" placeholder="${_t('Filter commands…', 'Filtrar comandos…')}" autocomplete="off"/>
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
    bindTesterEvents(content);

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
        bindTesterEvents(content);
      });
    }

    _rendered = true;
  }

  function show() {
    if (!_rendered) render();
  }

  /* Re-render chrome in the new language if the sheet is already on screen. */
  document.addEventListener('langchange', () => {
    if (_rendered && document.getElementById('view-cheatsheets')?.classList.contains('active')) render();
  });

  return { show };
})();
