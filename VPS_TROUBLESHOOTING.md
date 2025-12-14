# VPS Troubleshooting Commands

## 1. Check if OOM Killer is Murdering Your App

```bash
# Check if Linux killed your process due to memory
dmesg -T | grep -i 'killed process'
dmesg -T | grep -i 'out of memory'

# Clear the logs and monitor (run this, wait for it to break, then check again)
sudo dmesg -c > /tmp/old_dmesg.log
# ... wait for site to break ...
dmesg -T | grep -i 'killed'
```

## 2. Real-Time Monitoring Setup

```bash
# Monitor everything every 2 seconds (run in separate SSH session)
watch -n 2 'echo "=== DOCKER STATS ==="; docker stats --no-stream; echo ""; echo "=== MEMORY ==="; free -h; echo ""; echo "=== DISK ==="; df -h /'

# Or monitor just CPU/Memory continuously
docker stats

# System load
watch -n 5 uptime
```

## 3. Check Container Restart Loop

```bash
# See if containers are constantly restarting
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.RestartCount}}'

# Check container uptime (should be hours/days, not minutes)
docker ps --format 'table {{.Names}}\t{{.Status}}'

# See restart events in real-time
watch -n 2 'docker ps --format "table {{.Names}}\t{{.Status}}"'
```

## 4. Deep Dive into Logs

```bash
# Last 200 lines of app logs
docker logs dadnovin --tail 200

# Follow logs in real-time (Ctrl+C to stop)
docker logs dadnovin -f

# Look for errors specifically
docker logs dadnovin --tail 500 | grep -i 'error\|exception\|failed\|timeout\|econnrefused'

# Check nginx logs
docker logs nginx --tail 100

# Look for PostgreSQL connection errors
docker logs dadnovin --tail 500 | grep -i 'postgres\|database\|prisma'
```

## 5. Check Disk Space (Common Killer)

```bash
# Overall disk usage
df -h

# Docker disk usage
docker system df

# If disk is full, clean up
docker system prune -a --volumes -f

# Check if logs are eating disk
du -sh /var/lib/docker/containers/*/*-json.log | sort -h | tail -20
```

## 6. PostgreSQL Health Check

```bash
# Is PostgreSQL actually running? (should be on port 5432)
sudo netstat -tlnp | grep 5432
# OR
sudo ss -tlnp | grep 5432

# Check PostgreSQL logs (if you have them)
sudo journalctl -u postgresql -n 100

# Test direct connection
psql postgresql://postgres:YMCMBpass@localhost:5432/dadnovin_db -c "SELECT 1;"
```

## 7. Network/Cloudflare Issues

```bash
# Check if nginx is responding locally
curl -I http://localhost:80

# Check if app is responding locally
curl http://localhost:3000
# OR test a specific endpoint
curl http://localhost:3000/api/time

# Test from outside (replace with your domain)
curl -I https://dadnovin.ir
```

## 8. Check Docker Daemon

```bash
# Docker daemon status
sudo systemctl status docker

# Docker daemon logs
sudo journalctl -u docker -n 100 --no-pager
```

## 9. Full System Health Snapshot

Run this single command to get everything at once:

```bash
echo "=== SYSTEM INFO ===" && \
uname -a && \
echo -e "\n=== UPTIME ===" && \
uptime && \
echo -e "\n=== MEMORY ===" && \
free -h && \
echo -e "\n=== DISK ===" && \
df -h && \
echo -e "\n=== DOCKER PS ===" && \
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' && \
echo -e "\n=== DOCKER STATS ===" && \
docker stats --no-stream && \
echo -e "\n=== LAST 20 APP LOGS ===" && \
docker logs dadnovin --tail 20 && \
echo -e "\n=== OOM CHECK ===" && \
dmesg -T | grep -i 'killed process' | tail -5 && \
echo -e "\n=== POSTGRES PORT ===" && \
sudo ss -tlnp | grep 5432
```

## 10. Continuous Monitoring Script

Save this as `monitor.sh` and run it in the background:

```bash
cat > /root/monitor.sh << 'EOF'
#!/bin/bash
while true; do
  echo "=== $(date) ===" >> /root/monitor.log
  docker stats --no-stream >> /root/monitor.log 2>&1
  free -h >> /root/monitor.log 2>&1
  echo "" >> /root/monitor.log
  sleep 30
done
EOF

chmod +x /root/monitor.sh

# Run it in background
nohup /root/monitor.sh &

# Later, check the log
tail -f /root/monitor.log
```

## 11. When Site Goes Down, Run This Immediately:

```bash
# Quick diagnosis
docker logs dadnovin --tail 50 && \
docker stats --no-stream && \
dmesg -T | tail -20
```

---

## Common Issues and What to Look For:

### If OOM Killer is active:
- You'll see "Killed process" messages in dmesg
- **Solution**: Increase swap, reduce resource usage, or upgrade VPS

### If containers keep restarting:
- RestartCount will be high
- **Solution**: Check logs for crash reason

### If disk is full:
- `df -h` shows 100% usage
- **Solution**: `docker system prune -a`

### If PostgreSQL connection fails:
- Logs will show "ECONNREFUSED" or "connection refused"
- **Solution**: Check if PostgreSQL is running locally

### If memory grows over time:
- docker stats shows memory increasing continuously
- **Solution**: Memory leak in app code (we need to investigate specific endpoints)

---

## Share These With Me:

After the site breaks, run these and send me the output:

```bash
# 1. The snapshot command (#9 above)
# 2. Last 100 lines of app logs
docker logs dadnovin --tail 100

# 3. OOM check
dmesg -T | grep -i killed | tail -10
```

