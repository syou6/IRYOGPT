"""
スクレイパーAPI サーバー

ConoHaサーバーで稼働し、よやくらく（Vercel）からの
リアルタイムチェックリクエストを受け付ける。

エンドポイント:
  GET  /health              - ヘルスチェック（詳細版）
  POST /sync                - 手動同期トリガー
  POST /realtime-check      - 予約確定直前の空き確認
  POST /resume/{source}     - 一時停止中のスクレイパーを再開
  GET  /status              - スケジューラー状態

セキュリティ:
  - Bearer token 認証
  - レート制限（スライディングウィンドウ）
  - CORS（Vercelドメインのみ）
  - リクエストログ

起動:
  uvicorn scrapers.api_server:app --host 0.0.0.0 --port 8000
"""

import asyncio
import logging
import os
import shutil
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from scrapers.scheduler import ReservationScheduler
from scrapers.sync_service import SyncService

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# --- 設定 ---
API_SECRET = os.getenv("SCRAPER_API_SECRET", "")
ALLOWED_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    "https://yoyakuraku.com,https://*.vercel.app",
).split(",")

# --- レート制限 ---
RATE_LIMIT_WINDOW = 60  # 秒
RATE_LIMIT_MAX = 30     # 1分あたりの最大リクエスト数
_rate_limit_store: dict[str, list[float]] = defaultdict(list)

# --- グローバル変数 ---
scheduler: Optional[ReservationScheduler] = None
scheduler_task: Optional[asyncio.Task] = None
_start_time: Optional[float] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """起動時にスケジューラーをバックグラウンドで開始"""
    global scheduler, scheduler_task, _start_time

    _start_time = time.time()
    site_id = os.getenv("SITE_ID", "")

    if not site_id:
        logger.error("SITE_ID 環境変数が未設定")
    else:
        scheduler = ReservationScheduler(site_id)
        scheduler_task = asyncio.create_task(scheduler.start())
        logger.info("スケジューラー開始（バックグラウンド）")

    yield

    if scheduler:
        scheduler._running = False
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
    logger.info("APIサーバーシャットダウン完了")


app = FastAPI(
    title="よやくらく スクレイパーAPI",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=None,   # Swagger UI 無効化（本番）
    redoc_url=None,
)


# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- ミドルウェア: リクエストログ + レート制限 ---
@app.middleware("http")
async def request_middleware(request: Request, call_next):
    start = time.time()
    client_ip = request.client.host if request.client else "unknown"

    # レート制限チェック（/health はスキップ）
    if request.url.path != "/health":
        now = time.time()
        window_start = now - RATE_LIMIT_WINDOW
        requests = _rate_limit_store[client_ip]
        # 古いエントリを除去
        _rate_limit_store[client_ip] = [t for t in requests if t > window_start]

        if len(_rate_limit_store[client_ip]) >= RATE_LIMIT_MAX:
            logger.warning(f"レート制限超過: {client_ip} {request.url.path}")
            return Response(
                content='{"detail":"Rate limit exceeded"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
            )

        _rate_limit_store[client_ip].append(now)

    response = await call_next(request)

    duration_ms = (time.time() - start) * 1000
    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} "
        f"({duration_ms:.0f}ms) [{client_ip}]"
    )

    return response


# --- 認証ヘルパー ---
def verify_api_key(authorization: str = Header(default="")):
    if not API_SECRET:
        return
    if authorization != f"Bearer {API_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


# --- リクエスト/レスポンスモデル ---
class SyncRequest(BaseModel):
    date: Optional[str] = None


class RealtimeCheckRequest(BaseModel):
    date: str
    staff_name: str
    start_time: str


class RealtimeCheckResponse(BaseModel):
    available: bool
    conflicts: list
    checked_at: str


# --- エンドポイント ---

@app.get("/health")
async def health():
    """詳細ヘルスチェック（ブラウザ・ディスク・Xvfb状態も含む）"""
    now = datetime.now(JST)
    uptime = time.time() - _start_time if _start_time else 0

    # ディスク使用量チェック
    disk = shutil.disk_usage("/")
    disk_free_gb = disk.free / (1024 ** 3)
    disk_usage_pct = (disk.used / disk.total) * 100

    # Xvfb チェック
    xvfb_ok = os.path.exists("/tmp/.X99-lock")

    # スクリーンショット数（ディスク圧迫チェック）
    from scrapers.config import SCREENSHOTS_DIR
    screenshot_count = len(list(SCREENSHOTS_DIR.glob("*.png"))) if SCREENSHOTS_DIR.exists() else 0

    healthy = (
        disk_free_gb > 1.0
        and (scheduler is not None and scheduler._running)
    )

    return {
        "status": "healthy" if healthy else "degraded",
        "timestamp": now.isoformat(),
        "uptime_seconds": int(uptime),
        "scheduler_running": scheduler is not None and scheduler._running,
        "xvfb_active": xvfb_ok,
        "disk_free_gb": round(disk_free_gb, 2),
        "disk_usage_pct": round(disk_usage_pct, 1),
        "screenshots": screenshot_count,
    }


@app.get("/status")
async def status(authorization: str = Header(default="")):
    verify_api_key(authorization)
    if not scheduler:
        raise HTTPException(status_code=503, detail="スケジューラー未起動")
    return scheduler.get_status()


@app.post("/sync")
async def sync(req: SyncRequest, authorization: str = Header(default="")):
    verify_api_key(authorization)
    if not scheduler:
        raise HTTPException(status_code=503, detail="スケジューラー未起動")

    result = await scheduler.force_sync(req.date)
    return {"message": "同期完了", "result": result}


@app.post("/realtime-check", response_model=RealtimeCheckResponse)
async def realtime_check(
    req: RealtimeCheckRequest,
    authorization: str = Header(default=""),
):
    verify_api_key(authorization)
    if not scheduler:
        raise HTTPException(status_code=503, detail="スケジューラー未起動")

    result = await scheduler.realtime_check(
        req.date, req.staff_name, req.start_time
    )
    return result


@app.post("/resume/{source}")
async def resume(source: str, authorization: str = Header(default="")):
    verify_api_key(authorization)
    if not scheduler:
        raise HTTPException(status_code=503, detail="スケジューラー未起動")

    if source not in ("salonboard", "minimo"):
        raise HTTPException(status_code=400, detail="source は salonboard or minimo")

    success = await scheduler.resume(source)
    if success:
        return {"message": f"{source} 再開成功"}
    raise HTTPException(status_code=500, detail=f"{source} 再開失敗")


@app.get("/reservations")
async def get_reservations(
    date: str = Query(..., description="対象日 (YYYY-MM-DD)"),
    source: Optional[str] = Query(None, description="salonboard or minimo"),
    authorization: str = Header(default=""),
):
    """
    指定日の外部予約一覧を返す。

    Vercel側からリアルタイムに予約済みスロットを参照するためのエンドポイント。
    スクレイパーが最後にSupabaseに書き込んだデータをそのまま返す。
    """
    verify_api_key(authorization)

    site_id = os.getenv("SITE_ID", "")
    if not site_id:
        raise HTTPException(status_code=503, detail="SITE_ID 未設定")

    if source and source not in ("salonboard", "minimo"):
        raise HTTPException(status_code=400, detail="source は salonboard or minimo")

    sync_service = SyncService(site_id)
    try:
        reservations = await sync_service.get_external_reservations(date, source)
        return {
            "date": date,
            "source": source,
            "count": len(reservations),
            "reservations": reservations,
        }
    except Exception as e:
        logger.error(f"予約取得エラー: {e}")
        raise HTTPException(status_code=500, detail="予約データの取得に失敗しました")


@app.post("/cleanup-screenshots")
async def cleanup_screenshots(authorization: str = Header(default="")):
    """古いスクリーンショットを手動削除"""
    verify_api_key(authorization)

    from scrapers.config import SCREENSHOTS_DIR
    from scrapers.disk_manager import cleanup_screenshots as do_cleanup

    deleted = do_cleanup(SCREENSHOTS_DIR, max_age_hours=24)
    return {"deleted": deleted}
