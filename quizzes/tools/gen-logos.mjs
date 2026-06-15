#!/usr/bin/env node
/* Generate logo-identification quizzes from the LOCALLY DOWNLOADED CC0 icons
   (quizzes/assets/icons). Only slugs that (a) have a downloaded SVG and (b) have
   a curated display name are emitted, so every question shows a real, correctly
   labelled logo. Run: node quizzes/tools/gen-logos.mjs */
import { readdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ICONS = join(ROOT, 'quizzes', 'assets', 'icons');
const manifest = JSON.parse(await readFile(join(ROOT, 'quizzes', 'assets', 'manifest.json'), 'utf8'));
const CARSET = new Set(manifest.icons.carSlugs);

/* slug → display name. Slugs not listed here are skipped (avoids wrong labels). */
const NAMES = {
  github:'GitHub', gitlab:'GitLab', git:'Git', bitbucket:'Bitbucket', gitea:'Gitea',
  docker:'Docker', kubernetes:'Kubernetes', podman:'Podman', linux:'Linux', ubuntu:'Ubuntu',
  debian:'Debian', fedora:'Fedora', redhat:'Red Hat', archlinux:'Arch Linux', linuxmint:'Linux Mint',
  manjaro:'Manjaro', opensuse:'openSUSE', centos:'CentOS', alpinelinux:'Alpine Linux', kalilinux:'Kali Linux',
  python:'Python', rust:'Rust', go:'Go', nodedotjs:'Node.js', deno:'Deno', bun:'Bun',
  react:'React', vuedotjs:'Vue.js', angular:'Angular', svelte:'Svelte', nextdotjs:'Next.js',
  nuxtdotjs:'Nuxt.js', astro:'Astro', solid:'SolidJS', preact:'Preact', jquery:'jQuery', redux:'Redux',
  vite:'Vite', webpack:'Webpack', babel:'Babel', esbuild:'esbuild', npm:'npm', pnpm:'pnpm', yarn:'Yarn',
  mongodb:'MongoDB', postgresql:'PostgreSQL', mysql:'MySQL', mariadb:'MariaDB', sqlite:'SQLite',
  redis:'Redis', elasticsearch:'Elasticsearch', neo4j:'Neo4j', supabase:'Supabase', firebase:'Firebase',
  prisma:'Prisma', graphql:'GraphQL', django:'Django', flask:'Flask', fastapi:'FastAPI',
  laravel:'Laravel', spring:'Spring', rubyonrails:'Ruby on Rails', express:'Express', dotnet:'.NET',
  flutter:'Flutter', ionic:'Ionic', electron:'Electron', qt:'Qt', tauri:'Tauri',
  firefoxbrowser:'Firefox', googlechrome:'Google Chrome', brave:'Brave', opera:'Opera',
  microsoftedge:'Microsoft Edge', vivaldi:'Vivaldi', torbrowser:'Tor Browser',
  discord:'Discord', reddit:'Reddit', stackoverflow:'Stack Overflow', telegram:'Telegram',
  signal:'Signal', slack:'Slack', mastodon:'Mastodon', matrix:'Matrix', android:'Android',
  kotlin:'Kotlin', swift:'Swift', php:'PHP', ruby:'Ruby', cplusplus:'C++', c:'C', csharp:'C#',
  typescript:'TypeScript', javascript:'JavaScript', html5:'HTML5', css3:'CSS3', sass:'Sass',
  less:'Less', tailwindcss:'Tailwind CSS', bootstrap:'Bootstrap', scala:'Scala', perl:'Perl',
  haskell:'Haskell', elixir:'Elixir', clojure:'Clojure', dart:'Dart', lua:'Lua', r:'R',
  julia:'Julia', ocaml:'OCaml', erlang:'Erlang', crystal:'Crystal', nim:'Nim', zig:'Zig', v:'V',
  figma:'Figma', blender:'Blender', gimp:'GIMP', inkscape:'Inkscape', krita:'Krita',
  obsstudio:'OBS Studio', vlcmediaplayer:'VLC', audacity:'Audacity', wikipedia:'Wikipedia',
  spotify:'Spotify', steam:'Steam', raspberrypi:'Raspberry Pi', arduino:'Arduino', nginx:'Nginx',
  apache:'Apache', caddy:'Caddy', cloudflare:'Cloudflare', vercel:'Vercel', netlify:'Netlify',
  heroku:'Heroku', digitalocean:'DigitalOcean', vmware:'VMware', virtualbox:'VirtualBox',
  proxmox:'Proxmox', jenkins:'Jenkins', ansible:'Ansible', terraform:'Terraform', vagrant:'Vagrant',
  prometheus:'Prometheus', grafana:'Grafana', rabbitmq:'RabbitMQ', apachekafka:'Apache Kafka',
  godotengine:'Godot Engine', unity:'Unity', unrealengine:'Unreal Engine', wordpress:'WordPress',
  drupal:'Drupal', joomla:'Joomla', ghost:'Ghost', tensorflow:'TensorFlow', pytorch:'PyTorch',
  pandas:'pandas', numpy:'NumPy', jupyter:'Jupyter', anaconda:'Anaconda', scikitlearn:'scikit-learn',
  keras:'Keras', huggingface:'Hugging Face', openjdk:'Java', gnubash:'Bash', powershell:'PowerShell',
  neovim:'Neovim', vim:'Vim', gnu:'GNU', freebsd:'FreeBSD', qemu:'QEMU', wasmer:'Wasmer',
  webassembly:'WebAssembly', json:'JSON', yaml:'YAML', markdown:'Markdown', latex:'LaTeX',
  notion:'Notion', obsidian:'Obsidian', trello:'Trello', jira:'Jira', postman:'Postman',
  insomnia:'Insomnia', wireshark:'Wireshark', putty:'PuTTY',
  /* cars & motorcycles */
  bmw:'BMW', audi:'Audi', mercedes:'Mercedes-Benz', volkswagen:'Volkswagen', porsche:'Porsche',
  ferrari:'Ferrari', lamborghini:'Lamborghini', maserati:'Maserati', alfaromeo:'Alfa Romeo',
  fiat:'Fiat', abarth:'Abarth', lancia:'Lancia', toyota:'Toyota', honda:'Honda', nissan:'Nissan',
  mazda:'Mazda', subaru:'Subaru', mitsubishi:'Mitsubishi', suzuki:'Suzuki', lexus:'Lexus',
  infiniti:'Infiniti', acura:'Acura', ford:'Ford', chevrolet:'Chevrolet', cadillac:'Cadillac',
  gmc:'GMC', jeep:'Jeep', dodge:'Dodge', chrysler:'Chrysler', tesla:'Tesla', rivian:'Rivian',
  lucid:'Lucid', volvo:'Volvo', polestar:'Polestar', saab:'Saab', renault:'Renault',
  peugeot:'Peugeot', citroen:'Citroën', ds:'DS', dacia:'Dacia', opel:'Opel', vauxhall:'Vauxhall',
  skoda:'Škoda', seat:'SEAT', cupra:'Cupra', jaguar:'Jaguar', landrover:'Land Rover', mini:'MINI',
  rollsroyce:'Rolls-Royce', bentley:'Bentley', astonmartin:'Aston Martin', mclaren:'McLaren',
  lotus:'Lotus', bugatti:'Bugatti', koenigsegg:'Koenigsegg', pagani:'Pagani', hyundai:'Hyundai',
  kia:'Kia', genesis:'Genesis', ducati:'Ducati', ktm:'KTM', kawasaki:'Kawasaki',
  yamahamotorcorporation:'Yamaha', vespa:'Vespa', harley:'Harley-Davidson', triumph:'Triumph',
  bmwmotorrad:'BMW Motorrad', aprilia:'Aprilia',
};

/* Difficulty tiers. Anything named but untiered defaults to medium. */
const EASY = new Set(['python','javascript','openjdk','github','git','linux','ubuntu','android','googlechrome','firefoxbrowser','microsoftedge','discord','reddit','spotify','steam','telegram','slack','wordpress','html5','css3','php','mysql','nginx','wikipedia','notion','trello','arduino','raspberrypi','opera','brave',
  'bmw','audi','mercedes','volkswagen','ferrari','toyota','honda','nissan','ford','tesla','volvo','porsche','fiat','renault','peugeot','jeep','hyundai','kia','mazda','mini']);
const HARD = new Set(['nim','zig','v','ocaml','erlang','crystal','clojure','haskell','julia','caddy','neo4j','qemu','wasmer','webassembly','freebsd','alpinelinux','manjaro','gitea','matrix','mastodon','prisma','esbuild','tauri','solid','preact','godotengine','krita','obsidian','scikitlearn','keras','pnpm','latex','gnu','proxmox','vagrant','ansible','terraform','prometheus','grafana','rabbitmq','apachekafka','supabase','vercel','netlify','heroku','drupal','joomla','ghost','fastapi','ionic','electron','qt','astro','nuxtdotjs','deno','bun','centos','opensuse','kalilinux',
  'bugatti','koenigsegg','acura','infiniti','lucid','polestar','dacia','vauxhall','aprilia','ktm','vespa']);

function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

const files = (await readdir(ICONS)).filter(f => f.endsWith('.svg')).map(f => f.replace('.svg',''));
const tech = [], cars = [];
for (const slug of files) {
  if (!NAMES[slug]) continue;
  (CARSET.has(slug) ? cars : tech).push(slug);
}

function build(slugs, kind) {
  const names = slugs.map(s => NAMES[s]);
  const out = { easy: [], medium: [], hard: [] };
  for (const slug of slugs) {
    const name = NAMES[slug];
    const distractors = shuffle(names.filter(n => n !== name)).slice(0, 3);
    const opts = shuffle([name, ...distractors]);
    const tier = EASY.has(slug) ? 'easy' : HARD.has(slug) ? 'hard' : 'medium';
    const q = kind === 'car' ? 'Que marca de veículos é este logótipo?' : 'Que tecnologia ou marca é este logótipo?';
    out[tier].push({
      q, a: name, opts,
      exp: `Este é o logótipo de ${name}.`,
      imgType: 'logo', img: `quizzes/assets/icons/${slug}.svg`,
    });
  }
  return out;
}

async function emit(base, data) {
  for (const tier of ['easy','medium','hard']) {
    const p = join(ROOT, 'quizzes', base, 'pt', `${tier}.json`);
    await writeFile(p, JSON.stringify(data[tier], null, 2) + '\n', 'utf8');
    console.log(`  wrote ${tier}/${base}.json — ${data[tier].length} entries`);
  }
}

const techData = build(tech, 'tech');
const carData  = build(cars, 'car');
console.log(`Tech logos: ${tech.length} named / car logos: ${cars.length} named`);
await emit('logos-tech', techData);
await emit('logos-car', carData);
console.log('Done.');
