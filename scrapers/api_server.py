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

import re

from fastapi import Depends, FastAPI, HTTPException, Header, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator

from scrapers.config import load_store_configs
from scrapers.scheduler import ReservationScheduler
from scrapers.sync_service import SyncService

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# --- 設定 ---
API_SECRET = os.getenv("SCRAPER_API_SECRET", "")
if not API_SECRET:
    logging.getLogger(__name__).critical(
        "SCRAPER_API_SECRET が未設定です。全エンドポイントが無認証で公開されます。"
        "本番環境では必ず設定してください。"
    )

# CORS: allow_origin_regex を使うためここでは文字列で保持
CORS_ORIGINS_RAW = os.getenv(
    "CORS_ORIGINS",
    "https://yoyakuraku.com",
)
# 固定オリジンリスト（ワイルドカードは allow_origin_regex で処理）
ALLOWED_ORIGINS = [o.strip() for o in CORS_ORIGINS_RAW.split(",") if "*" not in o]
ALLOWED_ORIGIN_REGEX = os.getenv(
    "CORS_ORIGIN_REGEX",
    r"https://yoyakuraku-[a-z0-9\-]+\.vercel\.app",
)

# --- レート制限 ---
RATE_LIMIT_WINDOW = 60  # 秒
RATE_LIMIT_MAX = 30     # 1分あたりの最大リクエスト数
RATE_LIMIT_MAX_KEYS = 10000  # 追跡するIPの上限
_rate_limit_store: dict[str, list[float]] = defaultdict(list)
_rate_limit_last_cleanup = 0.0

# --- グローバル変数 ---
scheduler: Optional[ReservationScheduler] = None
scheduler_task: Optional[asyncio.Task] = None
_start_time: Optional[float] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """起動時にスケジューラーをバックグラウンドで開始"""
    global scheduler, scheduler_task, _start_time

    _start_time = time.time()

    # マルチテナント: StoreConfig から読み込み（後方互換あり）
    stores = load_store_configs()
    if not stores:
        logger.error("ストア設定が見つかりません（SITE_ID または STORES_CONFIG_PATH を設定）")
    else:
        # Phase 1: 最初のストアのみ起動（将来は複数ストア並列対応）
        store = stores[0]
        logger.info(f"ストア設定ロード: {store.label or store.store_id} (site_id={store.site_id})")
        scheduler = ReservationScheduler(store.site_id, store_config=store)
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
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH"],
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

        # 定期的にstaleキーをクリーンアップ（メモリリーク防止）
        global _rate_limit_last_cleanup
        if now - _rate_limit_last_cleanup > 300:
            stale_keys = [
                ip for ip, ts in _rate_limit_store.items()
                if not ts or ts[-1] < window_start
            ]
            for ip in stale_keys:
                del _rate_limit_store[ip]
            _rate_limit_last_cleanup = now

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


# --- 認証ヘルパー（FastAPI Depends で使用）---
def verify_api_key(authorization: str = Header(default="")):
    if not API_SECRET:
        raise HTTPException(
            status_code=503,
            detail="SCRAPER_API_SECRET が未設定のため利用不可",
        )
    if authorization != f"Bearer {API_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


# --- リクエスト/レスポンスモデル ---
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_TIME_RE = re.compile(r"^\d{2}:\d{2}$")


class SyncRequest(BaseModel):
    date: Optional[str] = None

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _DATE_RE.match(v):
            raise ValueError("date は YYYY-MM-DD 形式で指定してください")
        return v


class RealtimeCheckRequest(BaseModel):
    date: str
    staff_name: str
    start_time: str

    @field_validator("date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        if not _DATE_RE.match(v):
            raise ValueError("date は YYYY-MM-DD 形式で指定してください")
        return v

    @field_validator("start_time")
    @classmethod
    def validate_time(cls, v: str) -> str:
        if not _TIME_RE.match(v):
            raise ValueError("start_time は HH:MM 形式で指定してください")
        return v


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
async def status(_=Depends(verify_api_key)):
    if not scheduler:
        raise HTTPException(status_code=503, detail="スケジューラー未起動")
    return scheduler.get_status()


@app.post("/sync")
async def sync(req: SyncRequest, _=Depends(verify_api_key)):
    if not scheduler:
        raise HTTPException(status_code=503, detail="スケジューラー未起動")

    result = await scheduler.force_sync(req.date)
    return {"message": "同期完了", "result": result}


@app.post("/realtime-check", response_model=RealtimeCheckResponse)
async def realtime_check(
    req: RealtimeCheckRequest,
    _=Depends(verify_api_key),
):
    if not scheduler:
        raise HTTPException(status_code=503, detail="スケジューラー未起動")

    result = await scheduler.realtime_check(
        req.date, req.staff_name, req.start_time
    )
    return result


@app.post("/resume/{source}")
async def resume(source: str, _=Depends(verify_api_key)):
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
    date: str = Query(..., description="対象日 (YYYY-MM-DD)", pattern=r"^\d{4}-\d{2}-\d{2}$"),
    source: Optional[str] = Query(None, description="salonboard or minimo"),
    _=Depends(verify_api_key),
):
    """
    指定日の外部予約一覧を返す。

    Vercel側からリアルタイムに予約済みスロットを参照するためのエンドポイント。
    スクレイパーが最後にSupabaseに書き込んだデータをそのまま返す。
    """

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
async def cleanup_screenshots(_=Depends(verify_api_key)):

    from scrapers.config import SCREENSHOTS_DIR
    from scrapers.disk_manager import cleanup_screenshots as do_cleanup

    deleted = do_cleanup(SCREENSHOTS_DIR, max_age_hours=24)
    return {"deleted": deleted}
