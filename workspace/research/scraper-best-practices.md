# Research: Production-Grade Web Scraping Best Practices

Date: 2026-03-29
Research budget used: 14 tool calls

---

## Executive Summary

Production web scrapers require layered resilience across seven distinct domains: session lifecycle management, error recovery with circuit breakers, data integrity enforcement, structured observability, evasion-aware request timing, browser resource hygiene, and systemd process supervision. Modern anti-bot systems (Cloudflare, Akamai, DataDome) have moved beyond IP blocking to behavioral ML models that correlate TLS fingerprints, header ordering, request cadence, and DOM interaction patterns. This means production scrapers must treat every layer as a potential detection surface, not just proxies and user-agents.

---

## 1. Session Management

### Cookie Storage Architecture

The canonical pattern is Playwright's `storageState` API, which serializes cookies AND localStorage/sessionStorage into a single JSON file. This is more complete than cookie-only approaches.

**Playwright Python pattern:**
```python
# After login — save everything
await context.storage_state(path="session.json")

# On startup — restore everything
context = await browser.new_context(storage_state="session.json")
```

**Security requirements:**
- Encrypt session files at rest (AES-256); session cookies are equivalent to passwords
- Store in a path readable only by the service user (`chmod 600`)
- Never commit session files to git

### Session Health Monitoring

Do NOT rely on HTTP 200 to confirm a valid session. Servers often return 200 for the login redirect page. The correct pattern is to navigate to a known authenticated endpoint and assert an element that only appears when logged in:

```python
async def is_session_valid(page) -> bool:
    try:
        await page.goto(AUTHENTICATED_CHECK_URL, wait_until="domcontentloaded", timeout=10_000)
        # Check for element that only exists when authenticated
        element = await page.query_selector("#user-menu, [data-testid='logged-in']")
        return element is not None
    except Exception:
        return False
```

### Preemptive Re-Login

Do not wait for a session to fail in the middle of a scrape run. Two complementary strategies:

**Time-based preemption:** Track login timestamp and re-authenticate before the known TTL. For most systems, sessions expire between 30 minutes and 24 hours. Add a 20% safety margin.

```python
SESSION_TTL_SECONDS = 3600  # 1 hour
PREEMPTIVE_MARGIN = 0.8     # Re-login at 80% of TTL = 48 minutes

class SessionManager:
    def __init__(self):
        self.login_time: float = 0

    def needs_refresh(self) -> bool:
        age = time.time() - self.login_time
        return age > (SESSION_TTL_SECONDS * PREEMPTIVE_MARGIN)

    async def ensure_valid(self, page):
        if self.needs_refresh() or not await is_session_valid(page):
            await self.perform_login(page)
            self.login_time = time.time()
```

**Check-before-critical-operations:** Always call `is_session_valid()` before each scrape cycle, not just at startup.

### Cookie Rotation for Multi-Session Architectures

When running multiple parallel sessions (e.g., one per worker), each session must maintain a consistent IP + TLS + cookie tuple. Mixing cookies between different IPs is a strong detection signal. Structure:

- Session pool: `{session_id: {cookies_path, proxy_endpoint, login_time}}`
- Assign session to worker at job start; never reassign mid-job
- Mark sessions as "dirty" if any request returns 401/403/302-to-login; quarantine and re-authenticate

---

## 2. Error Recovery Patterns

### Exponential Backoff with Jitter

Naive `time.sleep(2 ** attempt)` creates synchronized retry storms when many workers fail simultaneously. The correct approach adds random jitter:

```python
from tenacity import retry, stop_after_attempt, wait_random_exponential

@retry(
    wait=wait_random_exponential(min=1, max=60),  # 1s to 60s, random
    stop=stop_after_attempt(5),
    reraise=True
)
def resilient_request(url: str) -> requests.Response:
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    return response
```

**Per-error-code strategy:**
- `429 Too Many Requests`: Respect `Retry-After` header; minimum 60s wait
- `503 Service Unavailable`: Transient; backoff and retry
- `403 Forbidden`: Session/IP block; do NOT retry immediately; rotate proxy + session first
- `401 Unauthorized`: Session expired; re-authenticate, then retry once
- `5xx` server errors: Exponential backoff, max 5 retries
- Connection errors / timeouts: Retry with backoff; suspect proxy health

### Circuit Breaker Pattern

Prevents cascading failures when a target is persistently unavailable. Use `pybreaker`:

```python
import pybreaker

# Opens after 5 failures; stays open 60 seconds; then half-open for 1 trial
scraper_breaker = pybreaker.CircuitBreaker(
    fail_max=5,
    reset_timeout=60,
    name="target_site_breaker"
)

@scraper_breaker
def fetch_page(url: str) -> str:
    response = requests.get(url, timeout=15)
    response.raise_for_status()
    return response.text

# Usage
try:
    html = fetch_page("https://target.com/page")
except pybreaker.CircuitBreakerError:
    logger.warning("Circuit open: target_site_breaker. Skipping cycle.")
    # Route to dead letter queue instead of failing hard
```

**State machine:**
- CLOSED: Normal operation, tracking failure count
- OPEN: Failing immediately after `fail_max` consecutive failures; no requests sent
- HALF-OPEN: After `reset_timeout`, allows one trial request; success closes, failure re-opens

### Dead Letter Queue

Failed scrape tasks that exhaust retries must not be silently dropped. Use a DLQ:

```python
import json
import redis
from datetime import datetime

redis_client = redis.Redis()
DLQ_KEY = "scraper:dlq"
WORK_QUEUE_KEY = "scraper:queue"

def send_to_dlq(task: dict, error: str, attempts: int):
    dlq_entry = {
        **task,
        "failed_at": datetime.utcnow().isoformat(),
        "error": error,
        "attempts": attempts,
    }
    redis_client.lpush(DLQ_KEY, json.dumps(dlq_entry))
    logger.error("TASK_DLQ", extra={
        "task_id": task["id"],
        "error": error,
        "attempts": attempts
    })
```

DLQ items should be reviewed daily. Many will indicate target site changes (schema changes, anti-bot upgrades) rather than transient failures.

---

## 3. Data Integrity

### Stale Data Detection

Track `scraped_at` timestamp per record. At query time, check age against SLA:

```python
MAX_AGE_SECONDS = 900  # 15 minutes for reservation availability

def is_stale(record: dict) -> bool:
    age = time.time() - record["scraped_at"]
    return age > MAX_AGE_SECONDS

# Alert if >10% of critical records are stale
def check_freshness(records: list[dict]) -> float:
    stale_count = sum(1 for r in records if is_stale(r))
    return stale_count / len(records)  # stale ratio
```

Track "age at query time, not time since last scrape" — a scrape completing does not guarantee users see fresh data if the pipeline has additional processing steps.

### Diff-Based Sync vs Full Sync

| Strategy | When to Use | Mechanism |
|----------|-------------|-----------|
| Full sync | Daily reset, known small dataset, first run | Replace all records; atomic swap |
| Diff-based | High-frequency polling, large datasets, change alerting | Hash or checksum comparison |
| Hybrid | Production default | Full sync nightly + diff polling during day |

**Diff implementation for availability slots:**
```python
import hashlib
import json

def content_hash(data: dict) -> str:
    canonical = json.dumps(data, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()

async def sync_availability(new_slots: list[dict], stored_slots: dict):
    changes = []
    for slot in new_slots:
        slot_id = slot["id"]
        new_hash = content_hash(slot)
        if stored_slots.get(slot_id) != new_hash:
            changes.append(slot)
            stored_slots[slot_id] = new_hash
    return changes  # Only process what changed
```

### Silent Failure / Schema Validation

Use Pydantic to validate scraped data before writing. A "successful" HTTP 200 response containing a CAPTCHA challenge page or a bot-detection interstitial is a silent failure:

```python
from pydantic import BaseModel, ValidationError, field_validator

class AppointmentSlot(BaseModel):
    slot_id: str
    date: str
    time_start: str
    is_available: bool
    clinic_id: str

    @field_validator("slot_id")
    def not_empty(cls, v):
        if not v.strip():
            raise ValueError("slot_id cannot be empty")
        return v

def validate_and_store(raw_data: dict) -> bool:
    try:
        validated = AppointmentSlot(**raw_data)
        store(validated)
        return True
    except ValidationError as e:
        logger.error("VALIDATION_FAILED", extra={"errors": str(e), "raw": raw_data})
        send_to_dlq(raw_data, str(e), attempts=0)
        return False
```

### Race Conditions in Reservation Systems

For a scraper that WRITES to a reservation system (booking on behalf of a user), use optimistic locking:

```sql
-- Add version column to table
ALTER TABLE appointment_slots ADD COLUMN version INTEGER DEFAULT 0;

-- Update only if version matches (optimistic lock)
UPDATE appointment_slots
SET is_available = false,
    booked_by = $user_id,
    version = version + 1
WHERE slot_id = $slot_id
  AND is_available = true
  AND version = $expected_version;
-- If 0 rows updated: conflict detected; re-read and retry
```

For READ-only scrapers populating a local cache, use atomic upsert patterns:
```sql
INSERT INTO scraped_slots (slot_id, is_available, scraped_at, content_hash)
VALUES ($1, $2, NOW(), $3)
ON CONFLICT (slot_id) DO UPDATE
SET is_available = EXCLUDED.is_available,
    scraped_at = EXCLUDED.scraped_at,
    content_hash = EXCLUDED.content_hash
WHERE scraped_slots.content_hash != EXCLUDED.content_hash;
-- WHERE clause prevents unnecessary writes on unchanged data
```

---

## 4. Monitoring and Observability

### Essential Prometheus Metrics for a Scraper

```python
from prometheus_client import Counter, Gauge, Histogram, start_http_server

# Counters (cumulative, only go up)
scrape_requests_total = Counter(
    "scraper_requests_total",
    "Total HTTP requests made",
    ["status_code", "target_host"]
)

scrape_errors_total = Counter(
    "scraper_errors_total",
    "Total scrape errors",
    ["error_type"]  # e.g., "timeout", "auth_failure", "validation_failed", "circuit_open"
)

login_attempts_total = Counter(
    "scraper_login_attempts_total",
    "Total login attempts",
    ["result"]  # "success" | "failure"
)

dlq_size = Counter(
    "scraper_dlq_entries_total",
    "Total items sent to dead letter queue"
)

# Gauges (current value, goes up and down)
active_sessions = Gauge(
    "scraper_active_sessions",
    "Number of active authenticated sessions"
)

queue_depth = Gauge(
    "scraper_queue_depth",
    "Number of pending scrape tasks"
)

stale_record_ratio = Gauge(
    "scraper_stale_records_ratio",
    "Fraction of records exceeding max age SLA"
)

# Histograms (latency distributions)
scrape_duration = Histogram(
    "scraper_request_duration_seconds",
    "Time to complete a single scrape request",
    buckets=[0.5, 1, 2, 5, 10, 30, 60]
)

cycle_duration = Histogram(
    "scraper_cycle_duration_seconds",
    "Time to complete a full scrape cycle",
    buckets=[30, 60, 120, 300, 600]
)
```

### Alerting Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Success rate | < 90% | < 75% | Check target site + proxy |
| Auth failure rate | > 5% in 5 min | > 20% | Force re-login; check IP ban |
| Stale record ratio | > 10% | > 30% | Check scrape cycle health |
| DLQ growth | > 10 new/hr | > 50 new/hr | Alert on-call |
| Circuit breaker open | Any OPEN state | — | Alert immediately |
| Scrape duration p95 | > 15s | > 30s | Target site may be blocking |
| Memory usage | > 70% MemoryMax | > 85% MemoryMax | Check for browser leaks |

### Structured JSON Logging

Use Python's `structlog` or custom JSON formatter. Every log entry must include:

```python
import logging
import json
import time

class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "service": "appointment-scraper",
        }
        # Merge extra fields (structured context)
        if hasattr(record, "__dict__"):
            for key, value in record.__dict__.items():
                if key not in ("msg", "args", "levelname", "name", "pathname",
                               "filename", "module", "exc_info", "exc_text",
                               "stack_info", "lineno", "funcName", "created",
                               "msecs", "relativeCreated", "thread", "threadName",
                               "processName", "process", "message", "taskName"):
                    log_entry[key] = value
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry, ensure_ascii=False)

# Usage
logger.info("SCRAPE_COMPLETE", extra={
    "slot_id": "abc-123",
    "duration_ms": 1240,
    "is_available": True,
    "session_id": "sess-007"
})
```

For systemd/journald integration:
```python
from systemd.journal import JournalHandler

logger = logging.getLogger("scraper")
logger.addHandler(JournalHandler())

# Custom fields become queryable in journalctl
logger.info("Scrape completed", extra={
    "SCRAPE_STATUS": "success",
    "SLOT_COUNT": 42,
    "SESSION_AGE_SECONDS": 1800,
})
# Query: journalctl SCRAPE_STATUS=success _SYSTEMD_UNIT=scraper.service
```

### Prometheus + Grafana Integration Pattern

Expose metrics endpoint from within the scraper process:

```python
from prometheus_client import start_http_server

# Start metrics server on a separate port
start_http_server(port=9090, addr="127.0.0.1")

# prometheus.yml scrape config
# scrape_configs:
#   - job_name: "appointment_scraper"
#     static_configs:
#       - targets: ["localhost:9090"]
#     scrape_interval: 15s
```

Key Grafana dashboard panels:
- Scrape success rate over time (1 - error_rate)
- Request duration heatmap (p50/p95/p99)
- Circuit breaker state timeline
- DLQ growth rate
- Stale record ratio
- Active sessions count
- Memory usage vs MemoryMax

---

## 5. Request Timing and Anti-Detection Patterns

### Natural Request Timing

Real humans do not make requests at fixed intervals. Production scrapers must add randomized delays:

```python
import random
import asyncio

async def human_delay(min_ms: int = 800, max_ms: int = 3000):
    """Simulate human reading/thinking time between actions."""
    delay = random.uniform(min_ms, max_ms) / 1000
    await asyncio.sleep(delay)

async def between_page_navigation(page):
    """Randomized delay between major navigations."""
    # Short pause first (simulates page load acknowledgment)
    await asyncio.sleep(random.uniform(0.3, 0.8))
    # Simulate scroll/read time
    await page.evaluate("window.scrollBy(0, document.body.scrollHeight * 0.3)")
    await asyncio.sleep(random.uniform(1.5, 4.0))
```

**Timing guidelines:**
- Between individual requests: 1-4 seconds random
- Between login and first action: 2-5 seconds
- Between page navigations in a session: 2-8 seconds
- Between full scrape cycles: proportional to data TTL (not fixed)

### TLS Fingerprint Considerations

For scrapers using real Chromium (via Playwright), TLS fingerprinting is handled automatically — the browser produces authentic JA3/JA4 fingerprints indistinguishable from a real Chrome browser. This is a primary reason to prefer Playwright over raw `requests`/`httpx` for protected targets.

**Key rule:** Never mix TLS libraries. Using `requests` with Chrome headers produces a mismatched fingerprint that is trivially detected. Either use Playwright (real browser TLS) or a TLS-emulating library like `curl_cffi` that impersonates specific browser versions.

```python
# curl_cffi approach — impersonates Chrome 120 TLS stack
from curl_cffi import requests as cffi_requests

response = cffi_requests.get(
    "https://target.com",
    impersonate="chrome120"  # Matches actual Chrome 120 TLS fingerprint
)
```

### Geographic Consistency

When using proxies:
- Use the same geographic proxy for an entire session lifecycle
- Match Accept-Language header to proxy geography
- Do not switch between datacenter and residential proxies mid-session

---

## 6. Browser Resource Management

### Memory Leak Prevention

The most common memory leaks in long-running Playwright/Chrome processes:

1. **Unclosed pages** — every `browser.new_page()` must be matched with `page.close()`
2. **Unclosed contexts** — every `browser.new_context()` must be matched with `context.close()`
3. **Event listener accumulation** — if using `page.on(...)`, remove listeners when done
4. **Large DOM retention** — avoid holding Python references to page content after navigation

**Page lifecycle pattern (Python context manager):**
```python
from contextlib import asynccontextmanager
from playwright.async_api import Browser

@asynccontextmanager
async def managed_page(browser: Browser, **context_kwargs):
    context = await browser.new_context(**context_kwargs)
    page = await context.new_page()
    try:
        yield page
    finally:
        await page.close()
        await context.close()  # Context close also clears all associated resources

# Usage
async with managed_page(browser, storage_state="session.json") as page:
    await page.goto("https://target.com/availability")
    data = await extract_data(page)
# Context and page are guaranteed closed even on exception
```

### Periodic Browser Restart

Even with proper lifecycle management, Chrome accumulates GPU memory and renderer process memory over long runs. The production pattern is to restart the browser periodically:

```python
PAGES_BEFORE_RESTART = 200  # Restart after N pages scraped
MINUTES_BEFORE_RESTART = 120  # Or after 2 hours, whichever comes first

class BrowserPool:
    def __init__(self):
        self.browser = None
        self.pages_scraped = 0
        self.started_at = 0

    def needs_restart(self) -> bool:
        if self.pages_scraped >= PAGES_BEFORE_RESTART:
            return True
        if time.time() - self.started_at > MINUTES_BEFORE_RESTART * 60:
            return True
        return False

    async def get_browser(self, playwright):
        if self.browser is None or self.needs_restart():
            await self.restart(playwright)
        return self.browser

    async def restart(self, playwright):
        if self.browser:
            try:
                await self.browser.close()
            except Exception:
                pass  # Best effort; process may already be dead
        self.browser = await playwright.chromium.launch(
            args=["--disable-dev-shm-usage", "--disable-cache", "--no-sandbox"]
        )
        self.pages_scraped = 0
        self.started_at = time.time()
        logger.info("BROWSER_RESTARTED")
```

### Chrome Crash Recovery

Chrome can crash, especially under memory pressure. Always wrap the main scrape loop:

```python
async def scrape_with_crash_recovery(url: str) -> Optional[dict]:
    for attempt in range(3):
        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(args=CHROME_ARGS)
                async with managed_page(browser) as page:
                    return await do_scrape(page, url)
        except Exception as e:
            if "Target closed" in str(e) or "Connection refused" in str(e):
                logger.warning("BROWSER_CRASH_DETECTED", extra={"attempt": attempt})
                await asyncio.sleep(2 ** attempt)
                continue
            raise
    return None
```

### Required Chrome Launch Arguments

```python
CHROME_ARGS = [
    "--disable-dev-shm-usage",      # Prevents /dev/shm exhaustion in containers
    "--disable-cache",               # Prevents disk cache accumulation
    "--no-sandbox",                  # Required in non-root container environments
    "--disable-gpu",                 # Reduces memory in headless mode
    "--window-size=1920,1080",       # Consistent viewport; affects fingerprint
    "--disable-blink-features=AutomationControlled",  # Removes navigator.webdriver flag
]
```

---

## 7. Systemd Production Service Configuration

### Complete Production Unit File

```ini
# /etc/systemd/system/appointment-scraper.service

[Unit]
Description=Appointment Availability Scraper
Documentation=https://github.com/yourorg/scraper
After=network-online.target redis.service postgresql.service
Wants=network-online.target
StartLimitIntervalSec=300s
StartLimitBurst=5

[Service]
Type=notify
User=scraper
Group=scraper
WorkingDirectory=/opt/scraper

# Executable
ExecStart=/opt/scraper/.venv/bin/python -m scraper.main
ExecReload=/bin/kill -HUP $MAINPID

# Restart policy
Restart=on-failure
RestartSec=10s
TimeoutStartSec=60s
TimeoutStopSec=30s

# Watchdog: service must send WATCHDOG=1 every 30s or get killed+restarted
WatchdogSec=30s
NotifyAccess=main

# Resource limits
MemoryHigh=512M       # Soft limit: triggers memory reclaim
MemoryMax=768M        # Hard limit: OOM kill above this
CPUQuota=100%         # Maximum of 1 CPU core
LimitNOFILE=65536     # File descriptor limit (needed for Chrome)
LimitNPROC=4096       # Process limit (Chrome forks many processes)

# Environment
EnvironmentFile=/etc/scraper/env
Environment=PYTHONUNBUFFERED=1
Environment=PYTHONFAULTHANDLER=1

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/var/lib/scraper /var/log/scraper

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=appointment-scraper
LogRateLimitIntervalSec=30s
LogRateLimitBurst=1000

[Install]
WantedBy=multi-user.target
```

### Watchdog Integration in Python

```python
import os
import socket
import threading
import time
import signal

def send_systemd_notify(state: str) -> None:
    """Send sd_notify message to systemd."""
    notify_socket = os.environ.get("NOTIFY_SOCKET")
    if not notify_socket:
        return  # Not running under systemd; skip silently
    if notify_socket.startswith("@"):
        notify_socket = "\0" + notify_socket[1:]
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM) as sock:
            sock.connect(notify_socket)
            sock.sendall(state.encode())
    except Exception:
        pass  # Never let notification failure crash the service

def start_watchdog_thread(interval_seconds: float = 10.0) -> None:
    """
    Send WATCHDOG=1 every `interval_seconds`.
    Must be < WatchdogSec/2 to avoid false kills.
    With WatchdogSec=30, send every 10-12 seconds.
    """
    def _watchdog_loop():
        while True:
            send_systemd_notify("WATCHDOG=1")
            time.sleep(interval_seconds)

    t = threading.Thread(target=_watchdog_loop, daemon=True, name="systemd-watchdog")
    t.start()

def signal_ready() -> None:
    """Tell systemd the service is ready to accept work."""
    send_systemd_notify("READY=1")

def signal_status(status: str) -> None:
    """Update the service status shown in systemctl status."""
    send_systemd_notify(f"STATUS={status}")

# Service startup sequence
if __name__ == "__main__":
    start_watchdog_thread(interval_seconds=10)  # Send every 10s; WatchdogSec=30s

    # Initialize resources...
    signal_status("Initializing database connection")
    db = connect_database()

    signal_status("Launching browser")
    browser = launch_browser()

    signal_ready()  # Systemd now marks service as "active"
    signal_status("Running: cycle 0, 0 errors")

    # Main loop
    cycle = 0
    while True:
        try:
            run_scrape_cycle()
            cycle += 1
            signal_status(f"Running: cycle {cycle}, last success {datetime.now().strftime('%H:%M:%S')}")
        except Exception as e:
            logger.exception("CYCLE_FAILED")
            signal_status(f"Degraded: last error at {datetime.now().strftime('%H:%M:%S')}")
```

### Structured Logging to journald

```python
from systemd.journal import JournalHandler
import logging

def configure_logging(service_name: str) -> logging.Logger:
    logger = logging.getLogger(service_name)
    logger.setLevel(logging.INFO)

    # Development: human-readable
    if os.environ.get("LOG_FORMAT") == "text":
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    else:
        # Production: journald structured
        handler = JournalHandler(SYSLOG_IDENTIFIER=service_name)

    logger.addHandler(handler)
    return logger

# Structured fields become queryable in journalctl
logger.info("Slot scraped", extra={
    "SLOT_ID": slot_id,
    "IS_AVAILABLE": is_available,
    "SCRAPE_DURATION_MS": duration_ms,
    "CLINIC_ID": clinic_id,
})

# Query in production:
# journalctl -u appointment-scraper CLINIC_ID=hogehoge-dental IS_AVAILABLE=True --since "1 hour ago"
```

### Automatic Restart Strategy

The `StartLimitIntervalSec=300s` and `StartLimitBurst=5` combination allows 5 restarts in 5 minutes before systemd gives up and enters a failed state. This prevents infinite restart loops that mask root causes while still recovering from transient failures.

**For debugging a failed service:**
```bash
systemctl reset-failed appointment-scraper  # Reset counter after fixing root cause
systemctl start appointment-scraper
journalctl -u appointment-scraper -f         # Follow logs in real time
journalctl -u appointment-scraper -o json-pretty --since "10 minutes ago"  # Structured output
```

---

## Sources

1. [Web Scraping Architecture Patterns: From Prototype to Production (2026)](https://use-apify.com/blog/web-scraping-architecture-patterns) — Architecture levels, queue patterns, retry logic, distributed tracing
2. [Automatic Failover Strategies for Reliable Data Extraction](https://scrapfly.io/blog/posts/automatic-failover-strategies-for-reliable-data-extraction) — Circuit breaker with pybreaker, exponential backoff with tenacity, proxy health tracking, silent failure validation
3. [Prometheus Metrics Setup for Python (Better Stack)](https://betterstack.com/community/guides/monitoring/prometheus-python-metrics/) — Counter/Gauge/Histogram code, label strategies, scraper instrumentation
4. [TLS Fingerprinting Detection and Bypassing in Playwright/Puppeteer](https://www.browserless.io/blog/tls-fingerprinting-explanation-detection-and-bypassing-it-in-playwright-and-puppeteer) — JA3/JA4 mechanics, detection signals, evasion strategies
5. [Memory Leak Prevention for Browser Automation](https://www.browserless.io/blog/memory-leak-how-to-find-fix-prevent-them) — Page lifecycle, context reuse, periodic restart, Chrome flags
6. [Configure systemd RestartSec and WatchdogSec](https://oneuptime.com/blog/post/2026-03-02-configure-systemd-restartsec-watchdogsec-ubuntu/view) — Complete unit file, sd_notify Python implementation, watchdog heartbeat pattern
7. [Structured Logging with Python and systemd Journald](https://denner.co/2025/01/26/logging3.html) — JournalHandler setup, custom fields, queryable metadata
8. [Data Freshness SLAs](https://scrapingant.com/blog/data-freshness-slas-how-often-should-you-really-scrape-that) — SLA definitions, staleness detection, diff-based sync patterns, freshness metrics
9. [Automate Login and Session Handling in Playwright](https://prosperasoft.com/blog/web-scrapping/playwright/playwright-login-session-scraping/) — Cookie storage, session restoration, health validation, preemptive re-login
10. [Minimizing Website Bans in Web Scraping (Zyte)](https://www.zyte.com/blog/minimizing-website-bans-in-web-scraping/) — Session continuity, natural request patterns, behavioral consistency
11. [pybreaker - Python Circuit Breaker](https://github.com/danielfm/pybreaker) — Circuit breaker implementation details
12. [systemd-watchdog PyPI](https://pypi.org/project/systemd-watchdog/) — Python watchdog library alternative

---

## Confidence Assessment

- **High confidence** (3+ sources): Exponential backoff with jitter, circuit breaker with pybreaker, Playwright storageState for sessions, Prometheus counter/gauge/histogram instrumentation, Chrome `--disable-dev-shm-usage` flag, systemd `Type=notify` + `WatchdogSec`, JSON structured logging to journald, optimistic locking with version column
- **Medium confidence** (1-2 sources): Preemptive session refresh at 80% TTL, stale ratio threshold of 10%, `StartLimitBurst=5` within 300s, `curl_cffi` for TLS emulation, pages-per-browser restart threshold
- **Low confidence / Unverified**: Specific memory thresholds for Chrome in production (varies heavily by page complexity), optimal WatchdogSec value for browser-based scrapers (depends on page load times)

## Information Gaps

- Specific guidance on scraping systems that use React/SPA with complex state (most articles target simpler HTML pages)
- Google Calendar API session management specifics (OAuth2 token refresh patterns, not general scraping)
- Redis-based distributed session pool implementation details (DLQ patterns found but not distributed session coordination)
- Quantitative benchmarks for Chrome memory consumption per tab over time (needed to tune `PAGES_BEFORE_RESTART`)
