---
description: Deploy the latest Routiform code to the Local VPS (192.168.0.15)
---

# Deploy to Local VPS Workflow

Deploy Routiform to the Local VPS using `npm pack + scp` + PM2.

**Local VPS:** `192.168.0.15`
**Process manager:** PM2 (`routiform`)
**Port:** `20128`

## Steps

### 1. Build + pack locally

// turbo

```bash
cd /home/linhnguyen-gt/dev/proxys/9router && rm -f routiform-*.tgz && rm -rf .next/cache app/.next/cache && npm run build:cli && rm -rf app/logs app/coverage app/.git app/.app-build-backup* && npm pack --ignore-scripts
```

### 2. Copy to Local VPS and install

// turbo-all

```bash
scp routiform-*.tgz root@192.168.0.15:/tmp/
```

```bash
ssh root@192.168.0.15 "npm install -g /tmp/routiform-*.tgz --ignore-scripts && cd /usr/lib/node_modules/routiform/app && npm rebuild better-sqlite3 && pm2 delete routiform 2>/dev/null; pm2 start /root/.routiform/ecosystem.config.cjs --update-env && pm2 save && echo '✅ Local done'"
```

### 3. Verify the deployment

```bash
curl -s -o /dev/null -w 'LOCAL HTTP %{http_code}\n' http://192.168.0.15:20128/
```
