"""
スクレイパーAPI サーバー

ConoHaサーバーで稼働し、よやくらく（Vercel）からの
リアルタイムチェックリクエストを受け付ける。

エンドポイント:
  GET  /health              - ヘルスチェック
  POST /sync                - 手動同期トリガー
  POST /realtime-check      - 予約確定直前の空き確認
  POST /resume/{source}     - 一時停止中のスクレイパーを再開
  GET  /status              - スケジューラー状態

起動:
  uvicorn scrapers.api_server:app --host 0.0.0.0 --port 8000
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

from scrapers.scheduler import ReservationScheduler

logger = logging.getLogger(__name__)

JST = timezone(timedelta(hours=9))

# --- 認証 ---
API_SECRET = os.getenv("SCRAPER_API_SECRET", "")

# --- グローバル変数 ---
scheduler: Optional[ReservationScheduler] = None
scheduler_task: Optional[asyncio.Task] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """起動時にスケジューラーをバックグラウンドで開始"""
    global scheduler, scheduler_task

    site_id = os.getenv("SITE_ID", "")
    if not site_id:
        logger.error("SITE_ID 環境変数が未設定")
    else:
        scheduler = ReservationScheduler(site_id)
        scheduler_task = asyncio.create_task(scheduler.start())
        logger.info("スケジューラー開始（バックグラウンド）")

    yield

    # シャットダウン
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
    version="1.0.0",
    lifespan=lifespan,
)


# --- 認証ヘルパー ---
def verify_api_key(authorization: str = Header(default="")):
    """APIキーの検証"""
    if not API_SECRET:
        return  # 開発時はスキップ
    if authorization != f"Bearer {API_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")


# --- リクエスト/レスポンスモデル ---
class SyncRequest(BaseModel):
    date: Optional[str] = None  # YYYY-MM-DD


class RealtimeCheckRequest(BaseModel):
    date: str           # YYYY-MM-DD
    staff_name: str
    start_time: str     # HH:MM


class RealtimeCheckResponse(BaseModel):
    available: bool
    conflicts: list
    checked_at: str


# --- エンドポイント ---

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now(JST).isoformat(),
        "scheduler_running": scheduler is not None and scheduler._running,
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
    """
    予約確定直前のリアルタイムチェック

    よやくらくの予約確定APIから呼び出される。
    サロンボード・ミニモの最新データを取得して
    指定枠が空いているか確認する。
    """
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
    else:
        raise HTTPException(status_code=500, detail=f"{source} 再開失敗")
