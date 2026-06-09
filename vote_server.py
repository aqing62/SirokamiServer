#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""晓白形象投票后端服务器 — 端口 8092"""

import hashlib
import json
import logging
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote

# ── 配置 ──────────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 8092
ROOT = Path(__file__).resolve().parent
IMG_DIR = ROOT / "xiaobairenshe"
THUMB_DIR = ROOT / "xiaobairenshe_thumb"
DATA_FILE = ROOT / "vote_data.json"
MAX_VOTES = 2
THUMB_WIDTH = 200
THUMB_QUALITY = 72

STATIC_EXTS = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
}

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(message)s",
                    datefmt="%H:%M:%S")
logger = logging.getLogger("vote")

try:
    from PIL import Image

    HAS_PILLOW = True
except ImportError:
    HAS_PILLOW = False

# ── 缩略图生成 ────────────────────────────────────────────
def generate_thumbnails():
    """生成 200px 宽的 JPEG 缩略图 (需要 Pillow)。"""
    if not HAS_PILLOW or not IMG_DIR.is_dir():
        return
    THUMB_DIR.mkdir(exist_ok=True)
    for src_path in sorted(IMG_DIR.iterdir()):
        if not src_path.is_file():
            continue
        if src_path.suffix.lower() not in (".png", ".jpg", ".jpeg", ".gif", ".webp"):
            continue
        dst_path = THUMB_DIR / src_path.name
        if dst_path.exists():
            continue
        try:
            im = Image.open(src_path).convert("RGB")
            w, h = im.size
            new_h = int(h * THUMB_WIDTH / w)
            im = im.resize((THUMB_WIDTH, new_h), Image.LANCZOS)
            im.save(dst_path, "JPEG", quality=THUMB_QUALITY, optimize=True)
            logger.info(f"  缩略图: {src_path.name}  ({w}x{h} -> {THUMB_WIDTH}x{new_h})")
        except Exception as e:
            logger.warning(f"  缩略图失败 {src_path.name}: {e}")


# ── 数据持久化 (内存缓存) ──────────────────────────────────
class VoteStore:
    """线程安全的投票数据存储，内存缓存 + 惰性写入。"""

    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        self._data: dict = {}
        self._load()

    def _load(self):
        if self._path.exists():
            try:
                raw = self._path.read_text(encoding="utf-8-sig")
                self._data = json.loads(raw) if raw.strip() else {}
            except (json.JSONDecodeError, OSError) as e:
                logger.warning(f"读取数据文件失败: {e}，使用空数据")
                self._data = {}
        self._data.setdefault("votes", {})
        self._data.setdefault("ips", {})
        self._data.setdefault("ip_votes", {})

    def _save(self):
        try:
            self._path.write_text(
                json.dumps(self._data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except OSError as e:
            logger.error(f"写入数据文件失败: {e}")

    def get_results(self) -> dict:
        with self._lock:
            return {"votes": dict(self._data.get("votes", {}))}

    def get_remaining(self, ip: str) -> int:
        with self._lock:
            used = len(self._data.get("ip_votes", {}).get(ip, []))
            return max(0, MAX_VOTES - used)

    def vote(self, image: str, ip: str) -> dict:
        """投一票。返回 {"ok": bool, "remaining": int, "error"?: str, "votes"?: dict}"""
        with self._lock:
            voted = self._data.setdefault("ip_votes", {}).setdefault(ip, [])
            if len(voted) >= MAX_VOTES:
                return {"ok": False, "error": f"您的{MAX_VOTES}票已全部投出",
                        "remaining": 0}

            self._data.setdefault("votes", {})
            self._data["votes"][image] = self._data["votes"].get(image, 0) + 1
            voted.append(image)
            self._data["ips"][ip] = self._data.get("ips", {}).get(ip, 0) + 1
            self._save()
            remaining = MAX_VOTES - len(voted)
            return {"ok": True, "remaining": remaining,
                    "votes": dict(self._data["votes"])}

    def dump(self) -> dict:
        """返回完整数据快照 (调试用)。"""
        with self._lock:
            return {
                "votes": dict(self._data.get("votes", {})),
                "ips": dict(self._data.get("ips", {})),
                "ip_votes": dict(self._data.get("ip_votes", {})),
            }


# ── 全局存储实例 ──────────────────────────────────────────
store = VoteStore(DATA_FILE)


# ── HTTP 请求处理器 ───────────────────────────────────────
class VoteHandler(SimpleHTTPRequestHandler):
    """投票 API + 静态文件服务"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def get_client_ip(self) -> str:
        """获取真实客户端 IP，支持反向代理头。"""
        xff = self.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()
        xri = self.headers.get("X-Real-IP", "")
        if xri:
            return xri.strip()
        return self.client_address[0]

    def log_message(self, fmt, *args):
        logger.info(f"[{self.client_address[0]}] {fmt % args}")

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    # ── 路由分发 ───────────────────────────────────────

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/"):
            self._handle_api_get(path)
        elif path.startswith("/thumb/"):
            self._serve_thumb(path)
        elif path.startswith("/img/"):
            self._serve_image(path)
        else:
            super().do_GET()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if not path.startswith("/api/"):
            self.send_error(404)
            return
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len) if content_len else b"{}"
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {}
        self._handle_api_post(path, payload)

    # ── API GET ────────────────────────────────────────

    def _handle_api_get(self, path: str):
        if path == "/api/images":
            imgs = []
            if IMG_DIR.is_dir():
                imgs = sorted(
                    f.name for f in IMG_DIR.iterdir()
                    if f.is_file() and f.suffix.lower() in
                    (".png", ".jpg", ".jpeg", ".gif", ".webp")
                )
            self._json_response(imgs)

        elif path == "/api/my-votes":
            remaining = store.get_remaining(self.get_client_ip())
            self._json_response({"remaining": remaining})

        elif path == "/api/results":
            self._json_response(store.get_results())

        else:
            self.send_error(404)

    # ── API POST ───────────────────────────────────────

    def _handle_api_post(self, path: str, payload: dict):
        if path == "/api/vote":
            image = payload.get("image", "")
            if not image:
                self._json_response({"ok": False, "error": "缺少 image 参数"},
                                    status=400)
                return
            result = store.vote(image, self.get_client_ip())
            status = 200 if result["ok"] else 400
            self._json_response(result, status=status)
        else:
            self.send_error(404)

    # ── 图片服务 ───────────────────────────────────────

    def _serve_thumb(self, path: str):
        """提供缩略图: 优先 Pillow 缓存，回退到原图。"""
        filename = unquote(Path(path).name)
        if HAS_PILLOW and (THUMB_DIR / filename).is_file():
            self._serve_file(filename, THUMB_DIR, 604800)
        else:
            self._serve_file(filename, IMG_DIR, 3600)

    def _serve_image(self, path: str):
        """提供原图。"""
        self._serve_file(unquote(Path(path).name), IMG_DIR, 3600)

    def _serve_file(self, filename: str, directory: Path, cache_sec: int):
        filepath = directory / filename
        if not filepath.is_file():
            self.send_error(404)
            return

        ext = filepath.suffix.lower()
        content_type = STATIC_EXTS.get(ext, "application/octet-stream")

        try:
            data = filepath.read_bytes()
        except OSError:
            self.send_error(500)
            return

        # 稳定的 ETag (基于 MD5)
        etag = f'"{hashlib.md5(data).hexdigest()}"'

        # 检查客户端 If-None-Match
        if self.headers.get("If-None-Match") == etag:
            self.send_response(304)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", len(data))
        self.send_header("Cache-Control", f"public, max-age={cache_sec}")
        self.send_header("ETag", etag)
        self.end_headers()
        self.wfile.write(data)

    # ── 辅助方法 ───────────────────────────────────────

    def _json_response(self, obj, status: int = 200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)


# ── 入口 ──────────────────────────────────────────────────
if __name__ == "__main__":
    logger.info(f"晓白投票服务启动 -> http://{HOST}:{PORT}")
    logger.info(f"图片目录: {IMG_DIR}")
    logger.info(f"数据文件: {DATA_FILE}")
    logger.info(f"每IP票数: {MAX_VOTES}")
    logger.info(f"Pillow: {'YES' if HAS_PILLOW else 'NO (pip install Pillow)'}")
    generate_thumbnails()

    server = ThreadingHTTPServer((HOST, PORT), VoteHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("服务已停止")
        server.server_close()
