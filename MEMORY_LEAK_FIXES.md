# Memory Leak Fixes Applied

## Problems Found

Your app was experiencing **multiple memory leaks** that would cause it to crash after running for a while:

### 1. ❌ Prisma Disconnect (FIXED in previous commit)
- Calling `prisma.$disconnect()` after every request
- Caused 96% CPU usage from constant reconnections

### 2. ❌ Unbounded Conversation Registry (FIXED NOW)
- `conversationRegistry` stored ALL conversations forever in memory
- No cleanup mechanism → grows indefinitely
- After a few hours: hundreds of conversations × thousands of messages = GBs of RAM

### 3. ❌ Vector Store Reloading (FIXED NOW)
- `loadOrCreateVectorStore()` was called on every API request
- File system reads on every message → inefficient
- Now cached at module level

### 4. ❌ Unbounded Message History (FIXED NOW)
- Each conversation stored unlimited messages in memory
- Long conversations could grow to MBs each
- Now limited to 50 messages per conversation

---

## Fixes Applied

### 1. Automatic Conversation Cleanup
```typescript
// Removes conversations older than 2 hours from memory
const CONVERSATION_TTL = 2 * 60 * 60 * 1000; // 2 hours
setInterval(cleanupOldConversations, 30 * 60 * 1000); // Run every 30 min
```

### 2. Vector Store Caching
```typescript
// Load once, cache forever (instead of loading on every request)
let cachedVectorStore: any = null;
const getVectorStore = async () => { ... }
```

### 3. Message History Limiting
```typescript
// Keep only last 50 messages per conversation
const MAX_MESSAGES_IN_MEMORY = 50;
// Automatically trims old messages when limit exceeded
```

### 4. Active Conversation Refresh
```typescript
// Update timestamp when conversation is used (keeps active ones in memory)
conversationRegistry[conversationKey].createdAt = Date.now();
```

---

## Expected Results

### Before:
- **Memory**: Grows from 300MB → 700MB+ over hours
- **Behavior**: Eventually hits limit → OOM killer → crash → restart loop
- **CPU**: High from constant reconnections

### After:
- **Memory**: Stable at 300-400MB
- **Behavior**: Runs indefinitely without crashes
- **CPU**: Low (~5-10%)

---

## What to Do Now

1. **Commit and push these changes:**
```bash
git add -A
git commit -m "Fix memory leaks: add conversation cleanup, cache vector store, limit message history"
git push
```

2. **Wait for GitHub Actions** to build and push the new image (2-3 minutes)

3. **On your VPS:**
```bash
cd /root
docker-compose pull    # Get the new fixed image
docker-compose up -d   # Restart with fixes
```

4. **Monitor for 24 hours:**
```bash
# Watch memory usage - should stay stable
watch -n 10 'docker stats --no-stream'

# Check that cleanup is running (every 30 min you should see this in logs)
docker logs dadnovin | grep "Cleaned up"
```

5. **If still having issues**, run the troubleshooting commands in `VPS_TROUBLESHOOTING.md` and share the output with me.

---

## Additional VPS Hardening (Optional but Recommended)

Add these to your `/root/docker-compose.yml` to prevent runaway resource usage:

```yaml
  dadnovin:
    # ... existing config ...
    cpus: '0.8'
    mem_limit: 700m
    mem_reservation: 512m
    environment:
      NODE_OPTIONS: "--max-old-space-size=512"
      # ... rest of env vars
```

This caps the app at 80% CPU and 700MB RAM, preventing it from consuming all VPS resources.

---

## Why It Was "Breaking After a While"

Classic symptoms of a memory leak:
1. App starts fine (300MB RAM)
2. Over hours: memory grows as conversations accumulate
3. After 4-6 hours: hits 700MB+ 
4. Linux OOM killer detects high memory → kills the process
5. Docker restarts it → cycle repeats

The fixes above prevent this by:
- Cleaning up old conversations every 30 minutes
- Limiting message history per conversation
- Caching instead of reloading resources

