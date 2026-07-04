#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""晓白形象投票后端服务器 — 端口 8092"""

import hashlib
import json
import logging
import sqlite3
import ssl
import threading
import time
import urllib.request
import urllib.error
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
CDB_FILE = ROOT / "DIY_Sirokami.cdb"
MAX_VOTES = 2
THUMB_WIDTH = 200
THUMB_QUALITY = 72

# ── 比赛排表代理配置 ──────────────────────────────────────
TOURNAMENT_ID = "151"  # 比赛ID，每次新比赛改这里
TABULATOR_API_URL = "https://api-tabulator.moecube.com:444/api/tournament"
TABULATOR_API_KEY = "MRAUXnLph1YP2sVeC9fQr7MKSK9KvbmoKrPchtED2YjKuVe5Q2x1zv32HrRxjfiC"
TOURNAMENT_CACHE_TTL = 15  # 缓存秒数

# ── CDB 类型常量 (与前端 card-pool-info.js 保持一致) ──────
TYPE_MASKS = {
    0x1: "怪兽", 0x2: "魔法", 0x4: "陷阱", 0x10: "通常", 0x20: "效果",
    0x40: "融合", 0x80: "仪式", 0x200: "灵魂", 0x400: "同盟", 0x800: "二重",
    0x1000: "调整", 0x2000: "同调", 0x4000: "衍生物", 0x200000: "反转",
    0x400000: "卡通", 0x800000: "超量", 0x1000000: "灵摆", 0x2000000: "特殊召唤",
    0x4000000: "连接", 0x10000: "速攻", 0x20000: "永续", 0x40000: "装备",
    0x80000: "场地", 0x100000: "反击",
}
RACE_MAP = {
    0x0: "无", 0x1: "战士族", 0x2: "魔法师族", 0x4: "天使族", 0x8: "恶魔族",
    0x10: "不死族", 0x20: "机械族", 0x40: "水族", 0x80: "炎族", 0x100: "岩石族",
    0x200: "鸟兽族", 0x400: "植物族", 0x800: "昆虫族", 0x1000: "雷族",
    0x2000: "龙族", 0x4000: "兽族", 0x8000: "兽战士族", 0x10000: "恐龙族",
    0x20000: "鱼族", 0x40000: "海龙族", 0x80000: "爬虫类族",
    0x100000: "念动力族", 0x200000: "幻神兽族", 0x400000: "创造神族",
    0x800000: "幻龙族", 0x1000000: "电子界族", 0x2000000: "幻想魔族",
}
ATTR_MAP = {0x0: "无", 0x1: "地", 0x2: "水", 0x4: "炎", 0x8: "风", 0x10: "光", 0x20: "暗", 0x40: "神"}
EXCLUDED_MONSTER_SUBTYPES = {"仪式", "融合", "同调", "超量", "灵摆", "连接"}

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


# ── CDB → JSON 预处理器 ──────────────────────────────────

def _parse_type(type_val: int) -> dict:
    """解析卡牌类型位掩码 (复刻前端 preParseCard 逻辑)。"""
    type_parts = []
    base_type = ""
    for mask_val, name in TYPE_MASKS.items():
        if type_val & mask_val:
            type_parts.append(name)
            if name in ("怪兽", "魔法", "陷阱"):
                base_type = name

    sub_types = [t for t in type_parts if t not in ("怪兽", "魔法", "陷阱")]
    monster_category = "其他怪兽"
    if base_type == "怪兽":
        has_excluded = any(s in EXCLUDED_MONSTER_SUBTYPES for s in sub_types)
        if not has_excluded and "效果" in sub_types:
            monster_category = "纯效果怪兽"
        elif "仪式" in sub_types:
            monster_category = "仪式怪兽"
        elif "融合" in sub_types:
            monster_category = "融合怪兽"
        elif "同调" in sub_types:
            monster_category = "同调怪兽"
        elif "超量" in sub_types:
            monster_category = "超量怪兽"
        elif "灵摆" in sub_types:
            monster_category = "灵摆怪兽"
        elif "连接" in sub_types:
            monster_category = "连接怪兽"

    return {
        "fullType": " ".join(type_parts) or "未知类型",
        "baseType": base_type,
        "subTypes": sub_types,
        "monsterCategory": monster_category,
    }


def _parse_race(race_val: int) -> str:
    """解析种族位掩码 (取第一个匹配的位)。"""
    for mask_val, name in RACE_MAP.items():
        if race_val & mask_val:
            return name
    return "未知种族"


def _parse_attr(attr_val: int) -> str:
    """解析属性位掩码 (取第一个匹配的位)。"""
    for mask_val, name in ATTR_MAP.items():
        if attr_val & mask_val:
            return name
    return "未知属性"


def _extract_author_and_desc(desc: str) -> tuple:
    """从效果文本中提取 DIY 作者和纯效果描述。"""
    author = ""
    processed_desc = "无效果描述"
    if desc:
        lines = desc.split("\n")
        effect_lines = []
        for line in lines:
            t = line.strip()
            if t.startswith("DIY by"):
                author = t
                break
            effect_lines.append(line)
        processed_desc = "\n".join(effect_lines).strip() or "无效果描述"
    return author, processed_desc


def load_cards_from_cdb(cdb_path: Path) -> list:
    """从 CDB 读取全量卡牌数据，预解析后返回与前端 preParseCard 一致的 dict 列表。"""
    if not cdb_path.is_file():
        logger.warning(f"CDB 文件不存在: {cdb_path}")
        return []

    conn = sqlite3.connect(str(cdb_path))
    try:
        rows = conn.execute(
            "SELECT datas.id, texts.name, datas.type, datas.atk, datas.def, "
            "datas.level, datas.race, datas.attribute, texts.desc "
            "FROM datas JOIN texts ON datas.id = texts.id"
        ).fetchall()
    finally:
        conn.close()

    cards = []
    for row in rows:
        card_id, name, type_val, atk, def_, level, race, attr, desc = row
        type_info = _parse_type(type_val)
        cards.append({
            "id": card_id,
            "name": name,
            "type": type_val,
            "atk": atk,
            "def": def_,
            "level": level or 0,
            "race": race,
            "attribute": attr,
            "desc": desc,
            "typeInfo": type_info,
            "raceName": _parse_race(race),
            "attrName": _parse_attr(attr),
            "author": _extract_author_and_desc(desc)[0],
            "processedDesc": _extract_author_and_desc(desc)[1],
        })

    logger.info(f"CDB 加载完成: {len(cards)} 张卡牌")
    return cards


# 全局卡牌缓存 (启动时加载，内存驻留)
_cards_cache: list = []
_cards_json: bytes = b"[]"
_cards_etag: str = ""

# 比赛数据缓存 (惰性加载，定期刷新)
_tournament_cache: dict | None = None
_tournament_cache_time: float = 0


def refresh_cards_cache():
    """重新从 CDB 加载卡牌数据并更新缓存。"""
    global _cards_cache, _cards_json, _cards_etag
    _cards_cache = load_cards_from_cdb(CDB_FILE)
    _cards_json = json.dumps(_cards_cache, ensure_ascii=False).encode("utf-8")
    _cards_etag = f'"{hashlib.md5(_cards_json).hexdigest()}"'
    logger.info(f"卡牌缓存已刷新: {len(_cards_cache)} 张, {len(_cards_json) / 1024:.0f} KB JSON")


def _get_tournament_data() -> dict:
    """获取比赛数据 (带内存缓存)。"""
    global _tournament_cache, _tournament_cache_time
    now = time.time()
    if (_tournament_cache is not None
            and (now - _tournament_cache_time) < TOURNAMENT_CACHE_TTL):
        return _tournament_cache

    url = f"{TABULATOR_API_URL}/{TOURNAMENT_ID}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", "Bearer " + TABULATOR_API_KEY)

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            raw = resp.read()
            data = json.loads(raw)
            _tournament_cache = data
            _tournament_cache_time = now
            logger.info(f"比赛数据已刷新 (ID={TOURNAMENT_ID})")
            return data
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise Exception(f"上游API返回 {e.code}: {body}")
    except Exception as e:
        raise Exception(f"请求上游API失败: {e}")


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

        elif path == "/api/cards":
            # ETag 缓存: 304 未修改则免传输
            if self.headers.get("If-None-Match") == _cards_etag:
                self.send_response(304)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", len(_cards_json))
            self.send_header("Cache-Control", "public, max-age=3600")
            self.send_header("ETag", _cards_etag)
            self.end_headers()
            self.wfile.write(_cards_json)

        elif path == "/api/tournament":
            try:
                data = _get_tournament_data()
                self._json_response(data)
            except Exception as e:
                logger.error(f"获取比赛数据失败: {e}")
                self._json_response({"error": str(e)}, status=502)

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
    refresh_cards_cache()
    generate_thumbnails()

    server = ThreadingHTTPServer((HOST, PORT), VoteHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("服务已停止")
        server.server_close()
