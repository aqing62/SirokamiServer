#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""晓白形象投票后端服务器 — 端口 8092"""

import hashlib
import hmac
import base64
import gzip
import struct
import io
import json
import logging
import os
import re
import secrets
import sqlite3
import ssl
import subprocess
import threading
import time
import http.client
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlencode, quote, parse_qs, urlparse

# ── 配置 ──────────────────────────────────────────────────
HOST = "0.0.0.0"
PORT = 8092
ROOT = Path(__file__).resolve().parent
IMG_DIR = ROOT / "xiaobairenshe"
THUMB_DIR = ROOT / "xiaobairenshe_thumb"
DATA_FILE = ROOT / "vote_data.json"
CDB_FILE = ROOT / "DIY_Sirokami.cdb"
# 先行卡（预发布卡）CDB：**直接读游戏服目录，只调用不迁移**（用户要求）。
# 顺序 = srvpro2 的 ygoproPath 顺序里 cards-pre 内部顺序（release → update），先到先得。
PRE_CDB_FILES = [
    "/root/servers/ygopro/cards-pre/test-release.cdb",
    "/root/servers/ygopro/cards-pre/test-update.cdb",
]
MAX_VOTES = 2
THUMB_WIDTH = 200
THUMB_QUALITY = 72

# ── 决斗页背景音乐（2026-11-20）──────────────────────────────────────────
# 需求：决斗页自动放一首 BGM，并尽量不让人直接扒链接下载。
# 做法：
#   1. 音频放在**站点根目录之外**（默认 /root/servers/bgm），静态路由永远取不到；
#   2. 只能走 /api/bgm/<key>，且必须先领一个短时令牌（HMAC，绑定浏览器 cookie）；
#   3. 响应 no-store，避免被缓存后二次分发。
# 说明：浏览器能播放的东西，技术上一定能被拿到（录屏/开发者工具/内存缓存）；
#   这里只是把「右键另存 / 复制链接转发就能下」这条路堵死，属于防君子不防小人。
BGM_DIR = Path(os.environ.get("SIRO_BGM_DIR", "/root/servers/bgm"))
BGM_FILES = {"duel": "duel-bgm.mp3", "wait": "wait-bgm.mp3"}   # 匹配等待音乐
# 场景 → BGM_DIR 下的子目录；目录里的音频按文件名排序后**轮流播放**
# （首页用：/root/servers/bgm/index/*.mp3，随便加歌，不用改代码）
BGM_SCENES = {"index": "index"}
BGM_AUDIO_EXTS = (".mp3", ".ogg", ".m4a")
BGM_TOKEN_TTL = 1800          # 令牌有效期（秒）
BGM_COOKIE = "siro_bgm"
_BGM_SECRET = None
_BGM_SECRET_LOCK = threading.Lock()


def _bgm_scene_tracks(scene: str):
    """场景目录里的音频：[(key, filename)]，按文件名排序。"""
    sub = BGM_SCENES.get(scene)
    if not sub:
        return []
    d = BGM_DIR / sub
    if not d.is_dir():
        return []
    try:
        files = sorted(d.iterdir(), key=lambda p: p.name.lower())
    except OSError:
        return []
    return [(f.stem, f.name) for f in files if f.is_file() and f.suffix.lower() in BGM_AUDIO_EXTS]


def _bgm_resolve(key: str):
    """key → 音频路径（找不到返回 None）。只允许白名单里的 key。"""
    if key in BGM_FILES:
        return BGM_DIR / BGM_FILES[key]
    for scene in BGM_SCENES:
        for k, fn in _bgm_scene_tracks(scene):
            if k == key:
                return BGM_DIR / BGM_SCENES[scene] / fn
    return None


def _bgm_secret() -> bytes:
    """读取/生成令牌密钥（持久化在 BGM 目录，权限 600）。"""
    global _BGM_SECRET
    if _BGM_SECRET is not None:
        return _BGM_SECRET
    with _BGM_SECRET_LOCK:
        if _BGM_SECRET is not None:
            return _BGM_SECRET
        secret = None
        path = BGM_DIR / ".secret"
        try:
            if path.is_file() and path.stat().st_size >= 16:
                secret = path.read_bytes()
            else:
                BGM_DIR.mkdir(parents=True, exist_ok=True)
                secret = secrets.token_bytes(32)
                path.write_bytes(secret)
                try:
                    os.chmod(path, 0o600)
                except OSError:
                    pass
        except OSError:
            secret = secrets.token_bytes(32)
        _BGM_SECRET = secret
        return _BGM_SECRET


def _bgm_mac(sid: str, key: str, bucket: int) -> str:
    return hmac.new(_bgm_secret(), f"{key}|{sid}|{bucket}".encode(), hashlib.sha256).hexdigest()[:32]


def _cookie_value(header: str, name: str) -> str:
    for part in (header or "").split(";"):
        k, _, v = part.strip().partition("=")
        if k == name:
            return v.strip()
    return ""

# ── 比赛排表代理配置 ──────────────────────────────────────
TOURNAMENT_ID = "198"  # 默认比赛ID（当前赛事）；比赛时改这里（198=白神服新人交流友谊赛·Bo1）
# 「比赛相关」板块展示的两场比赛：左=瑞士轮，右=淘汰赛
# 前端通过 /api/tournament?slot=swiss|elim 取用；新比赛时改这里即可
# 值填 False = 该槽位编号尚未确定（例如淘汰赛要等瑞士轮结束后才知道），
# 前端会显示「待公布」占位效果，不再请求上游接口
TOURNAMENT_SLOTS = {
    "swiss": "198",   # 白神服新人交流友谊赛（Bo1）
    "elim": False,    # 尚未确定
}
# 槽位显示名 & 编号未确定时的提示文案
TOURNAMENT_SLOT_LABELS = {"swiss": "瑞士轮", "elim": "淘汰赛"}
TOURNAMENT_PENDING_MESSAGE = {
    "elim": "淘汰赛对阵将在瑞士轮结束后公布",
    "swiss": "瑞士轮对阵待公布",
}
TABULATOR_API_URL = "https://api-tabulator.moecube.com:444/api/tournament"
_LOCAL_CFG_CACHE = None
def _local_cfg():
    """读取 config.local.json（不入库）；找不到返回空 dict。"""
    global _LOCAL_CFG_CACHE
    if _LOCAL_CFG_CACHE is not None:
        return _LOCAL_CFG_CACHE
    cfg = {}
    try:
        path = ROOT / "config.local.json"
        if path.is_file():
            with open(path, "r", encoding="utf-8") as f:
                cfg = json.load(f) or {}
    except Exception:
        cfg = {}
    _LOCAL_CFG_CACHE = cfg
    return cfg

def _secret(key, env, default=""):
    """优先级：环境变量 > config.local.json > 默认值。"""
    v = os.environ.get(env)
    if v:
        return v
    return (_local_cfg().get(key) or default)

TABULATOR_API_KEY = _secret("tabulatorApiKey", "SIRO_TABULATOR_API_KEY", "")
TOURNAMENT_CACHE_TTL = 15  # 缓存秒数

# ── Cookie 认证配置 ─────────────────────────────────────────
COOKIE_NAME = "siro_admin"
COOKIE_SECRET = _secret("cookieSecret", "SIRO_COOKIE_SECRET", "dev-only-cookie-secret")
COOKIE_MAX_AGE = 86400  # 24 小时

COMMUNITY_COOKIE_NAME = "siro_community"
COMMUNITY_COOKIE_SECRET = _secret("communityCookieSecret", "SIRO_COMMUNITY_COOKIE_SECRET", "dev-only-community-secret")
COMMUNITY_COOKIE_MAX_AGE = 604800  # 7 天

AVATAR_DIR = ROOT / "avatars"
AVATAR_SIZE = 64

# ── 腾讯云文本内容安全（TMS）配置 ─────────────────────────
TMS_ENDPOINT = "tms.tencentcloudapi.com"
TMS_ENABLED = True  # 设为 False 可临时关闭检测

def _load_tms_config():
    """从 config.local.json 加载密钥（不提交到 git）。"""
    cfg = _local_cfg()
    return cfg.get("tms_secret_id", ""), cfg.get("tms_secret_key", "")

TMS_SECRET_ID, TMS_SECRET_KEY = _load_tms_config()

# ── srvpro2 服务器对局监控代理配置 ─────────────────────────
SRVPRO_API_URL = _secret("srvproApiUrl", "SIRO_SRVPRO_API_URL", "https://127.0.0.1:50009")
SRVPRO_READ_USER = _secret("srvproReadUser", "SIRO_SRVPRO_READ_USER", "readonly")
SRVPRO_READ_PASS = _secret("srvproReadPass", "SIRO_SRVPRO_READ_PASS", "")
# 管理员动作凭据（死三 / 关房 / 广播）：官网账号 sudo 登录后执行动作时用它
SRVPRO_ADMIN_USER = _secret("srvproAdminUser", "SIRO_SRVPRO_ADMIN_USER", "")
SRVPRO_ADMIN_PASS = _secret("srvproAdminPass", "SIRO_SRVPRO_ADMIN_PASS", "")

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
            "datas.level, datas.race, datas.attribute, texts.desc, datas.alias, datas.setcode, "
                    "texts.str1, texts.str2, texts.str3, texts.str4, texts.str5, texts.str6, texts.str7, texts.str8 "
            "FROM datas JOIN texts ON datas.id = texts.id"
        ).fetchall()
    finally:
        conn.close()

    cards = []
    for row in rows:
        (card_id, name, type_val, atk, def_, level, race, attr, desc, alias, setcode,
         h1, h2, h3, h4, h5, h6, h7, h8) = row[:19]
        type_info = _parse_type(type_val)
        cards.append({
            "id": card_id,
            "name": name,
            "type": type_val,
            "atk": atk,
            "def": def_,
            # level 为 CDB 原始值：灵摆/连接卡是位打包的（低8位为等级/链接标记），需取低8位
        "level": (level or 0) & 0xFF,
            "race": race,
            "attribute": attr,
            "desc": desc,
            # CDB 的效果提示文本（每个可选效果一条，如转生炎兽的意志：str1=特殊召唤1只怪兽 / str2=特殊召唤连接标记数量的怪兽）
            "hints": [x for x in (h1, h2, h3, h4, h5, h6, h7, h8) if x],
            "alias": alias or 0,
            "setcode": setcode or 0,   # 字段（系列）编号，配合 /api/archetypes 映射为字段名
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
_cards_json_gz: bytes = b""
_cards_etag: str = ""

# G-Ext 分数缓存 (启动时加载，alias 已解析)
_scores_cache: dict = {}
_scores_json: bytes = b"{}"
_scores_limit: int = 100  # G-Ext 卡组总分上限（lflist.conf $genesys）

# 字段（系列）映射表：setcode → 字段名，由 tools/gen_archetypes.py 从 strings.conf 生成
_archetypes_json: bytes = b"{}"
_archetypes_etag: str = ""


def load_archetypes():
    """读取 archetypes.json（字段表），供前端「相关卡片 → 同字段」使用。"""
    global _archetypes_json, _archetypes_etag
    path = ROOT / "archetypes.json"
    if not path.is_file():
        logger.warning(f"字段表不存在: {path}")
        return
    data = path.read_bytes()
    _archetypes_json = data
    _archetypes_etag = f'"{hashlib.md5(data).hexdigest()}"'
    try:
        count = len(json.loads(data.decode("utf-8")))
    except Exception:
        count = 0
    logger.info(f"字段表已加载: {count} 条, {len(data) / 1024:.0f} KB")

# 比赛数据缓存 (惰性加载，定期刷新)
_tournament_cache: dict | None = None
_tournament_cache_time: float = 0


# ── 决斗客户端数据（嵌官网用） ──────────────────────────────
# 两份大表由 tools/gen-duel-data.mjs 生成（不进 git）：
#   data/duel-cards-text.json  卡文表（约 6.8MB → gzip 约 1MB，客户端懒加载）
#   data/duel-strings.json     提示文本表（system/victory/counter/setname）
DUEL_DATA_DIR = ROOT / "data"
_duel_text: dict = {"raw": None, "gz": None, "etag": ""}
_duel_strings: dict = {"raw": None, "gz": None, "etag": ""}


def _load_duel_json(filename: str, cache: dict, label: str):
    """惰性读取大 JSON（首次请求时读入并 gzip；文件缺失返回 None）"""
    if cache["raw"] is not None:
        return cache
    path = DUEL_DATA_DIR / filename
    if not path.is_file():
        logger.warning(f"{label} 不存在: {path}（跑 tools/gen-duel-data.mjs 生成）")
        return None
    raw = path.read_bytes()
    cache["raw"] = raw
    cache["gz"] = gzip.compress(raw, compresslevel=6)
    cache["etag"] = f'"{hashlib.md5(raw).hexdigest()}"'
    logger.info(f"{label} 已加载: {len(raw) / 1048576:.2f} MB → gzip {len(cache['gz']) / 1024:.0f} KB")
    return cache


def _send_duel_json(handler, cache: dict, max_age: int = 86400):
    """按 ETag/gzip 输出大 JSON 表"""
    if handler.headers.get("If-None-Match") == cache["etag"]:
        handler.send_response(304)
        handler.send_header("ETag", cache["etag"])
        handler.end_headers()
        return
    body = cache["gz"]
    handler.send_response(200)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", f"public, max-age={max_age}")
    handler.send_header("ETag", cache["etag"])
    if "gzip" in (handler.headers.get("Accept-Encoding") or ""):
        handler.send_header("Content-Encoding", "gzip")
    else:
        body = cache["raw"]
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


# ── 客户端错误上报（决斗客户端 window.onerror → POST /api/clientlog） ──
CLIENTLOG_FILE = ROOT / "logs" / "clientlog.jsonl"
CLIENTLOG_DIR = ROOT / "logs"
CLIENTLOG_KEEP_DAYS = 7


def _rotate_clientlog():
    """按天切分，只保留最近 7 天"""
    try:
        CLIENTLOG_DIR.mkdir(exist_ok=True)
        if not CLIENTLOG_FILE.is_file():
            return
        today = time.strftime("%Y-%m-%d")
        mtime_day = time.strftime("%Y-%m-%d", time.localtime(CLIENTLOG_FILE.stat().st_mtime))
        if mtime_day != today:
            CLIENTLOG_FILE.rename(CLIENTLOG_DIR / f"clientlog-{mtime_day}.jsonl")
        cutoff = time.time() - CLIENTLOG_KEEP_DAYS * 86400
        for old in CLIENTLOG_DIR.glob("clientlog-*.jsonl"):
            try:
                if old.stat().st_mtime < cutoff:
                    old.unlink()
            except OSError:
                pass
    except OSError as e:
        logger.warning(f"clientlog 轮转失败: {e}")


def append_clientlog(payload) -> None:
    """追加一条客户端上报（JSONL，一行一条；无上限字段，超长截断）"""
    try:
        CLIENTLOG_DIR.mkdir(exist_ok=True)
        _rotate_clientlog()
        line = json.dumps(payload, ensure_ascii=False)
        if len(line) > 64 * 1024:
            line = line[:64 * 1024] + '…(truncated)"}'
        with CLIENTLOG_FILE.open("a", encoding="utf-8") as f:
            f.write(line.replace("\n", " ") + "\n")
    except Exception as e:
        logger.warning(f"写入 clientlog 失败: {e}")


def _ladder_decks_of(player: str) -> list:
    """取某账号最近打过天梯的卡组（走游戏服的 /api/ladder/decks）。
    返回 [{'name','main','extra','side'}, …]；任何异常都返回 []（前端要能兜底）。"""
    if not player:
        return []
    try:
        resp = urllib.request.urlopen(
            "https://api.ygopro3.cn/api/ladder/decks?player="
            + quote(player) + "&t=" + str(int(time.time() * 1000)),
            timeout=8,
        )
        data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning(f"取卡组列表失败({player}): {e}")
        return []
    items = data.get("decks") if isinstance(data, dict) else data
    if not isinstance(items, list):
        return []
    out = []
    for it in items:
        if isinstance(it, dict) and isinstance(it.get("main"), list) and it["main"]:
            out.append(it)
    return out


def _psql_run(sql: str, variables: dict, extra_args: list, timeout: int = 25):
    """统一跑 psql。
    ⚠ SQL 必须走 **stdin** —— psql 的 :'变量' 只在交互/stdin/文件模式做替换，
      用 -c 时**不替换**，会把 :'名字' 当字面量（踩过一次：SQL 语法错误）。"""
    conf = _srvpro_db_config()
    env = dict(os.environ)
    if conf["password"]:
        env["PGPASSWORD"] = conf["password"]
    args = ["psql", "-h", conf["host"], "-p", str(conf["port"]), "-U", conf["user"],
            "-d", conf["dbname"], "-v", "ON_ERROR_STOP=1"]
    for k, v in (variables or {}).items():
        args += ["-v", f"{k}={v}"]
    args += extra_args
    proc = subprocess.run(args, input=sql, capture_output=True, text=True,
                          timeout=timeout, env=env)
    if proc.returncode != 0:
        err = [l for l in (proc.stderr or "").strip().splitlines() if l.strip()]
        raise RuntimeError(err[0] if err else "psql 执行失败")
    return proc.stdout


def _pg_exec(sql: str, variables: dict) -> None:
    """执行一条写 SQL。变量用 psql 的 :'名字' 绑定（psql 自己做转义，避免注入）。"""
    _psql_run(sql, variables, ["-tA"])


def pg_register_user(account: str, password: str, display_name: str) -> None:
    """在游戏服账号表里建号（与游戏客户端 /register 走同一张表、同一套字段）。
    ⚠ 只负责插库；登录/校验等逻辑仍归游戏服，不在这里重复实现。"""
    _pg_exec(
        'INSERT INTO srv_user ("accountName", password, enabled, permissions, "displayName",\n'
        '                      title, "lastIp", "ladderTitle", titles, "selectedTitle", "selectedTitle2",\n'
        '                      "createTime", "updateTime")\n'
        "VALUES (:'acct', :'pw', true, '', :'dname', '', '', '', '[]', '', '', now(), now());\n",
        {"acct": account, "pw": password, "dname": display_name},
    )


def pg_user_exists(account: str) -> bool:
    """账号是否已被注册（用 psql 变量绑定，避免引号注入）"""
    out = _psql_run(
        'select count(*) from srv_user where "accountName" = :\'acct\';\n',
        {"acct": account}, ["-tA"],
    )
    return out.strip().isdigit() and int(out.strip()) > 0


# ── 账号卡组库（决斗大厅用）────────────────────────────────
# 每个账号一个 JSON：data/duel-decks/<sha1(账号)前16位>.json
#   { "account": "账号", "active": "当前使用卡组名", "decks": { "卡组名": {main,extra,side} } }
# 文件名用哈希：账号允许中文/斜杠（游戏服账号表就是这样），直接当文件名不安全。
DUEL_DECK_DIR = ROOT / "data" / "duel-decks"
DUEL_DECK_MAX = 60            # 单账号卡组上限
DUEL_DECK_MAX_CARDS = 300     # 单个卡组卡数上限（防滥用）


def _duel_deck_path(account: str) -> Path:
    h = hashlib.sha1(account.encode("utf-8")).hexdigest()[:16]
    return DUEL_DECK_DIR / f"{h}.json"


def duel_decks_load(account: str) -> dict:
    """读某账号的卡组库（不存在则返回空结构）"""
    path = _duel_deck_path(account)
    if not path.is_file():
        return {"account": account, "active": "", "decks": {}}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or not isinstance(data.get("decks"), dict):
            raise ValueError("结构不对")
        data.setdefault("active", "")
        data["account"] = account
        return data
    except Exception as e:
        logger.warning(f"卡组库损坏({account}): {e}")
        return {"account": account, "active": "", "decks": {}}


def duel_decks_save(account: str, data: dict) -> None:
    DUEL_DECK_DIR.mkdir(parents=True, exist_ok=True)
    path = _duel_deck_path(account)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)          # 原子替换，避免写一半被读到


def parse_ydk(text: str) -> dict:
    """解析 .ydk 文本 → {main, extra, side}（卡号数组）"""
    main, extra, side = [], [], []
    cur = None
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        low = line.lower()
        if low.startswith("#main"):
            cur = main
            continue
        if low.startswith("#extra"):
            cur = extra
            continue
        if low.startswith("!side"):
            cur = side
            continue
        if line.startswith("#"):
            continue
        if cur is not None and line.isdigit():
            cur.append(int(line))
    return {"main": main, "extra": extra, "side": side}


def refresh_cards_cache():
    """重新从 CDB 加载卡牌数据并更新缓存。

    卡池 = DIY + **先行卡（pre）** + 官方 OCG，按 id 去重、**先到先得**
    —— 顺序刻意与 srvpro2 的 ygoproPath 一致（cards-diy → cards-pre → cards），
    所以"先行卡覆盖官方同号卡"的行为和游戏里完全一样。

    ⚠ 先行包的 CDB 在游戏服目录里，这里**只读不搬**（用户要求：调用即可，不要迁移）。
       路径见 PRE_CDB_FILES；换预发布包时那边换了这里自动跟着变 ✓

    ⚠ 归类修正（玩家反馈：拉之翼神龙 出现在「先行」里，它明明是官方卡）：
       先行包里有一批卡**官方卡表里其实已经有同号卡**（如 10000010：先行包叫「拉之翼神龙」，
       官方库叫「太阳神之翼神龙」）——它们只是先行包对官方卡的改版，不该算「先行卡」。
       所以：先行包里的卡，只要**卡号在官方卡表里存在**，归类就记成 ocg（内容仍用先行包，
       与游戏内一致），这样「先行」视图剩下的才是官方真没出的卡 ✓
    """
    global _cards_cache, _cards_json, _cards_json_gz, _cards_etag
    ocg_path = ROOT / "cards_ocg.cdb"

    # 官方卡表先读出来：既是归类依据，也省一次重复读盘
    ocg_cards = load_cards_from_cdb(ocg_path) if ocg_path.is_file() else []
    ocg_ids = {c["id"] for c in ocg_cards}

    pre_list: list = []
    for p in PRE_CDB_FILES:
        pp = Path(p)
        if pp.is_file():
            pre_list.extend(load_cards_from_cdb(pp))

    batches = [
        ("diy", load_cards_from_cdb(CDB_FILE)),
        ("pre", pre_list),
        ("ocg", ocg_cards),
    ]
    seen: set = set()
    merged: list = []
    counts: dict = {"diy": 0, "pre": 0, "ocg": 0}
    promoted = 0          # 先行包里的卡但官方表已有 → 归到 ocg 的张数
    for source, cards in batches:
        for c in cards:
            if c["id"] in seen:
                continue
            seen.add(c["id"])
            src = source
            if source == "pre" and c["id"] in ocg_ids:
                src = "ocg"
                promoted += 1
            c["source"] = src
            merged.append(c)
            counts[src] = counts.get(src, 0) + 1
    _cards_cache = merged
    _cards_json = json.dumps(_cards_cache, ensure_ascii=False).encode("utf-8")
    _cards_json_gz = gzip.compress(_cards_json, compresslevel=6)
    _cards_etag = f'"{hashlib.md5(_cards_json).hexdigest()}"'
    logger.info(
        "卡牌缓存已刷新: DIY %d + 先行卡 %d + OCG %d = %d 张（其中 %d 张先行包里的卡按官方归类）, %d KB JSON → %d KB gzip"
        % (counts["diy"], counts["pre"], counts["ocg"], len(merged), promoted,
           len(_cards_json) / 1024, len(_cards_json_gz) / 1024)
    )


def refresh_scores_cache():
    """解析 lflist.conf G-Ext 分数，结合 CDB alias + 同名卡补充分数。"""
    global _scores_cache, _scores_json, _scores_limit
    lflist = ROOT / "lflist.conf"
    if not lflist.is_file():
        logger.warning("lflist.conf 不存在，跳过分数缓存")
        return

    text = lflist.read_text(encoding="utf-8")
    sirokami_idx = text.find("!DIY_Sirokami")
    gext = text[:sirokami_idx] if sirokami_idx > -1 else text

    # G-Ext 上限：$genesys <N> 行
    m_limit = re.search(r"(?m)^\s*\$genesys\s+(\d+)", gext)
    if m_limit:
        _scores_limit = int(m_limit.group(1))
        logger.info(f"G-Ext 卡组总分上限: {_scores_limit}")

    scores = {}
    for line in gext.split("\n"):
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("!") or line.startswith("$genesys"):
            continue
        m = re.match(r"^(\d+)\s+0\s+--", line)
        if m:
            scores[int(m.group(1))] = {"score": 0, "forbidden": True}
            continue
        m = re.match(r"^(\d+)\s+\$genesys\s+(\d+)\s+--", line)
        if m:
            scores[int(m.group(1))] = {"score": int(m.group(2)), "forbidden": False}

    # ── 从 CDB (DIY + OCG) 构建 alias 映射 + 卡名索引 ──
    aliases = {}
    name_to_ids = {}  # 卡名 → 所有同名卡 ID
    for cdb_path in [CDB_FILE, ROOT / "cards_ocg.cdb"]:
        if cdb_path.is_file():
            conn = sqlite3.connect(str(cdb_path))
            try:
                for row in conn.execute("SELECT id, alias FROM datas WHERE alias != 0"):
                    aliases[int(row[0])] = int(row[1])
                for row in conn.execute(
                    "SELECT datas.id, texts.name FROM datas JOIN texts ON datas.id = texts.id"
                ):
                    cid, cname = int(row[0]), row[1]
                    name_to_ids.setdefault(cname, []).append(cid)
            finally:
                conn.close()

    # ── Step 1: alias 直接复制分数 ──
    for alt_id, canon_id in aliases.items():
        if alt_id not in scores and canon_id in scores:
            scores[alt_id] = scores[canon_id]

    # ── Step 2: 同名卡补充 (有分直接用分，没分按同名卡的分) ──
    # 对有分数的卡，按卡名建立分数映射
    name_score = {}
    for cid, sc in scores.items():
        # 找这个 cid 对应的卡名
        for cname, id_list in name_to_ids.items():
            if cid in id_list:
                # 如果同名卡有多个分数，保留第一个遇到的 (已有的不覆盖)
                if cname not in name_score:
                    name_score[cname] = sc
                break

    # 为没分数的同名卡补充分数
    filled = 0
    for cname, sc in name_score.items():
        for cid in name_to_ids.get(cname, []):
            if cid not in scores:
                scores[cid] = sc
                filled += 1

    _scores_cache = scores
    _scores_json = json.dumps(scores, ensure_ascii=False).encode("utf-8")
    logger.info(f"分数缓存已刷新: {len(scores)} 张, alias {len(aliases)} 条, 同名补充 {filled} 张")


# PATCH(白神服) 2026-10-31: 取比赛数据时优先绑定这个源地址（.108 被上游屏蔽）
_TOURNAMENT_BIND_IPS = _local_cfg().get("tournamentBindIps", ["191.40.37.199", "191.40.37.108"])
_tournament_bind_ip = None   # 记住上次成功的出口

def _fetch_tournament_upstream(tournament_id: str) -> dict:
    """同步向上游取一次赛事数据（握手类错误重试一次）。

    PATCH(白神服) 2026-10-31: 上游 api-tabulator 会屏蔽本机 191.40.37.108 出口
    （TCP 443/444 全超时，ICMP 却通）→ 定时刷新一直失败、页面卡在旧缓存上（参赛者停在 5 人）。
    实测从 191.40.37.199 出口请求正常（HTTP 200），所以这里显式绑定源地址，
    按候选列表逐个尝试，成功后记住可用的那个。
    """
    global _tournament_cache, _tournament_cache_time, _tournament_bind_ip
    host, port = "api-tabulator.moecube.com", 444
    path = f"/api/tournament/{tournament_id}"
    ctx = ssl._create_unverified_context()

    candidates = []
    if _tournament_bind_ip:
        candidates.append(_tournament_bind_ip)
    for ip in _TOURNAMENT_BIND_IPS:
        if ip not in candidates:
            candidates.append(ip)
    candidates.append(None)          # 兜底：不绑定源地址

    last_err = None
    for _attempt in range(2):
        for bind in candidates:
            try:
                conn = http.client.HTTPSConnection(
                    host, port, context=ctx, timeout=8,
                    source_address=((bind, 0) if bind else None),
                )
                try:
                    conn.request("GET", path, headers={
                        "Authorization": "Bearer " + TABULATOR_API_KEY,
                        "Accept": "application/json",
                    })
                    resp = conn.getresponse()
                    body = resp.read()
                    if resp.status != 200:
                        raise RuntimeError("upstream HTTP %s" % resp.status)
                    data = json.loads(body)
                finally:
                    try:
                        conn.close()
                    except Exception:
                        pass

                if not isinstance(_tournament_cache, dict):
                    _tournament_cache = {}
                if not isinstance(_tournament_cache_time, dict):
                    _tournament_cache_time = {}
                _tournament_cache[tournament_id] = data
                _tournament_cache_time[tournament_id] = time.time()
                if bind != _tournament_bind_ip:
                    logger.info("比赛数据出口 -> %s" % (bind or "默认"))
                _tournament_bind_ip = bind
                n = len((data.get("data") or {}).get("participants") or [])
                logger.info("比赛数据已刷新 (ID=%s, 参赛者 %d 人, 出口 %s)" % (tournament_id, n, bind or "默认"))
                return data
            except Exception as e:
                last_err = Exception("请求上游API失败(出口 %s): %s" % (bind or "默认", e))
                continue
        time.sleep(1)
    raise last_err


_tournament_refreshing: set = set()   # 正在后台刷新的赛事ID（避免重复请求）


def _refresh_tournament_async(tournament_id: str):
    """后台刷新指定赛事，不阻塞请求线程。"""
    if tournament_id in _tournament_refreshing:
        return
    _tournament_refreshing.add(tournament_id)

    def worker():
        try:
            _fetch_tournament_upstream(tournament_id)
        except Exception as e:
            logger.warning(f"后台刷新比赛数据失败 (ID={tournament_id}): {e}")
        finally:
            _tournament_refreshing.discard(tournament_id)

    threading.Thread(target=worker, daemon=True).start()


def _start_tournament_refresher(interval: int = 60):
    """启动后台定时刷新（预热缓存 + 保持数据新鲜）。"""
    slot_ids = sorted({str(v) for v in TOURNAMENT_SLOTS.values() if v})

    def loop():
        while True:
            for tid in slot_ids:
                try:
                    _fetch_tournament_upstream(tid)
                except Exception as e:
                    logger.warning(f"定时刷新比赛数据失败 (ID={tid}): {e}")
            time.sleep(interval)

    threading.Thread(target=loop, daemon=True).start()
    logger.info(f"比赛数据后台刷新已启动（每 {interval}s，ID={slot_ids}）")


def _get_tournament_data(tid: str | None = None) -> dict:
    """获取比赛数据。

    策略：有缓存（哪怕已过期）立即返回，并在后台异步刷新 —— 请求永不阻塞在上游，
    避免反向代理超时导致 502；只有完全没缓存时才同步取一次。
    """
    tournament_id = str(tid or TOURNAMENT_ID)
    now = time.time()
    cached = _tournament_cache.get(tournament_id) if isinstance(_tournament_cache, dict) else None
    cached_at = _tournament_cache_time.get(tournament_id, 0) if isinstance(_tournament_cache_time, dict) else 0

    if cached is not None:
        if (now - cached_at) >= TOURNAMENT_CACHE_TTL:
            _refresh_tournament_async(tournament_id)      # 后台刷新，立即用旧数据响应
        return cached
    return _fetch_tournament_upstream(tournament_id)      # 首次：同步取（8s×2 上限）


# ── srvpro2 API 代理 ───────────────────────────────────────

def _srvpro_fetch(endpoint: str, params: dict) -> dict:
    """代理请求到 srvpro2 API (HTTPS, 自签证书)。"""
    url = f"{SRVPRO_API_URL}{endpoint}"
    qs = urlencode(params)
    full_url = f"{url}?{qs}" if qs else url

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(full_url)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise Exception(f"srvpro2 API 返回 {e.code}: {body}")
    except Exception as e:
        raise Exception(f"请求 srvpro2 API 失败: {e}")


def _srvpro_post(endpoint: str, params: dict, payload: dict) -> dict:
    """代理 POST 请求到 srvpro2 API (HTTPS, 自签证书)。"""
    url = f"{SRVPRO_API_URL}{endpoint}"
    qs = urlencode(params)
    full_url = f"{url}?{qs}" if qs else url

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(full_url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise Exception(f"srvpro2 API 返回 {e.code}: {body_text}")
    except Exception as e:
        raise Exception(f"请求 srvpro2 API 失败: {e}")

def _srvpro_put(endpoint: str, params: dict, payload: dict) -> dict:
    """代理 PUT 请求到 srvpro2 API。"""
    url = f"{SRVPRO_API_URL}{endpoint}"
    qs = urlencode(params)
    full_url = f"{url}?{qs}" if qs else url
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(full_url, data=body, method="PUT")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise Exception(f"srvpro2 API 返回 {e.code}: {body_text}")
    except Exception as e:
        raise Exception(f"请求 srvpro2 API 失败: {e}")

def _srvpro_delete(endpoint: str, params: dict) -> dict:
    """代理 DELETE 请求到 srvpro2 API。"""
    url = f"{SRVPRO_API_URL}{endpoint}"
    qs = urlencode(params)
    full_url = f"{url}?{qs}" if qs else url

    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(full_url, method="DELETE")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            raw = resp.read()
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        raise Exception(f"srvpro2 API 返回 {e.code}: {body_text}")
    except Exception as e:
        raise Exception(f"请求 srvpro2 API 失败: {e}")


def _tms_check(text: str) -> tuple:
    """腾讯云文本内容安全检测。返回 (ok: bool, label: str)。"""
    if not TMS_ENABLED or not text or not text.strip():
        return (True, "")
    try:
        import hashlib as _hashlib
        import datetime as _dt
        import uuid as _uuid

        service = "tms"
        host = TMS_ENDPOINT
        action = "TextModeration"
        version = "2020-12-29"
        region = "ap-guangzhou"
        algorithm = "TC3-HMAC-SHA256"
        timestamp = int(time.time())
        date = _dt.datetime.fromtimestamp(timestamp, _dt.timezone.utc).strftime("%Y-%m-%d")

        # payload — Content 需要 base64 编码
        content_b64 = base64.b64encode(text.strip().encode("utf-8")).decode("utf-8")
        payload = json.dumps({"Content": content_b64})
        # canonical request
        http_method = "POST"
        canonical_uri = "/"
        canonical_querystring = ""
        ct = "application/json; charset=utf-8"
        canonical_headers = f"content-type:{ct}\nhost:{host}\nx-tc-action:{action.lower()}\n"
        signed_headers = "content-type;host;x-tc-action"
        hashed_payload = _hashlib.sha256(payload.encode("utf-8")).hexdigest()
        canonical_request = (
            f"{http_method}\n{canonical_uri}\n{canonical_querystring}\n"
            f"{canonical_headers}\n{signed_headers}\n{hashed_payload}"
        )
        # string to sign
        credential_scope = f"{date}/{service}/tc3_request"
        hashed_cr = _hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
        string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_cr}"
        # signature
        def _hmac_sha256(key, msg):
            return hmac.new(key, msg.encode("utf-8"), _hashlib.sha256).digest()
        secret_date = _hmac_sha256(("TC3" + TMS_SECRET_KEY).encode("utf-8"), date)
        secret_service = _hmac_sha256(secret_date, service)
        secret_signing = _hmac_sha256(secret_service, "tc3_request")
        signature = _hashlib.sha256(secret_signing + string_to_sign.encode("utf-8")).hexdigest()
        if isinstance(signature, bytes):
            signature = signature.decode()
        # authorization
        authorization = (
            f"{algorithm} Credential={TMS_SECRET_ID}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )
        # request
        req = urllib.request.Request(f"https://{host}/", data=payload.encode("utf-8"))
        req.add_header("Content-Type", ct)
        req.add_header("Host", host)
        req.add_header("X-TC-Action", action)
        req.add_header("X-TC-Version", version)
        req.add_header("X-TC-Region", region)
        req.add_header("X-TC-Timestamp", str(timestamp))
        req.add_header("Authorization", authorization)

        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=ctx, timeout=5) as resp:
            result = json.loads(resp.read())
        resp_data = result.get("Response", {})
        if resp_data.get("Error"):
            logger.warning(f"TMS API 错误: {resp_data.get('Error')}")
            return (True, "")  # API 异常放行，避免阻塞用户
        suggestion = resp_data.get("Suggestion", "Pass")
        label = resp_data.get("Label", "")
        if suggestion == "Pass":
            return (True, "")
        return (False, label)
    except Exception as e:
        logger.warning(f"TMS 检测失败 (放行): {e}")
        return (True, "")  # 网络异常放行


def _sign_cookie(username: str, password: str) -> str:
    payload = f"{username}:{password}:{int(time.time())}"
    sig = hmac.new(COOKIE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    return base64.b64encode(f"{payload}:{sig}".encode()).decode()

def _sign_community_cookie(username: str, password: str) -> str:
    payload = f"{username}:{password}:{int(time.time())}"
    sig = hmac.new(COMMUNITY_COOKIE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    return base64.b64encode(f"{payload}:{sig}".encode()).decode()


def _verify_cookie(token: str) -> tuple | None:
    try:
        raw = base64.b64decode(token).decode()
        parts = raw.rsplit(":", 1)
        payload, sig = parts[0], parts[1]
        expected = hmac.new(COOKIE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
        if not hmac.compare_digest(sig, expected):
            return None
        username, password, ts = payload.split(":", 2)
        if int(time.time()) - int(ts) > COOKIE_MAX_AGE:
            return None
        return username, password
    except Exception:
        return None

def _verify_community_cookie(token: str) -> tuple | None:
    try:
        raw = base64.b64decode(token).decode()
        parts = raw.rsplit(":", 1)
        payload, sig = parts[0], parts[1]
        expected = hmac.new(COMMUNITY_COOKIE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
        if not hmac.compare_digest(sig, expected):
            return None
        username, password, ts = payload.split(":", 2)
        if int(time.time()) - int(ts) > COMMUNITY_COOKIE_MAX_AGE:
            return None
        return username, password
    except Exception:
        return None


# ── 先手 / 后手 胜率统计（读游戏服的 Postgres） ──────────────
# 数据来自 duel_record_player.isFirst（每场 2 条记录）
# 赛季信息：换赛季时改这三行即可（页面主要展示当前赛季的天梯先后手胜率）
SEASON_NAME = "S4"
SEASON_START = "2026-11-01"      # S4 开始（S3 于 11/01 结算 + 重置）
SEASON_END = "2026-11-30"
SRVPRO_DIR = Path("/root/servers/ygopro/srvpro-siro")
_FS_CACHE = {"t": 0.0, "data": None}
_FS_CACHE_TTL = 300          # 5 分钟缓存，别每次都打数据库
_DB_CONFIG_CACHE = {"t": 0.0, "conf": None}


def _srvpro_db_config():
    """从游戏服 config.yaml 读数据库连接（读不到就用已知默认值）"""
    now = time.time()
    if _DB_CONFIG_CACHE["conf"] and now - _DB_CONFIG_CACHE["t"] < 600:
        return _DB_CONFIG_CACHE["conf"]
    conf = {"host": "127.0.0.1", "port": 5432, "user": "postgres",
            "password": "", "dbname": "srvpro2_siro"}
    try:
        text = (SRVPRO_DIR / "config.yaml").read_text(encoding="utf-8", errors="ignore")
        for key, field in (("dbHost", "host"), ("dbPort", "port"), ("dbUser", "user"),
                           ("dbPass", "password"), ("dbName", "dbname")):
            m = re.search(r'^\s*' + key + r'\s*:\s*"?([^"\n#]+)"?', text, re.M)
            if m:
                val = m.group(1).strip()
                conf[field] = int(val) if field == "port" else val
    except Exception as e:
        logger.warning(f"读取游戏服数据库配置失败，用默认值: {e}")
    _DB_CONFIG_CACHE["conf"] = conf
    _DB_CONFIG_CACHE["t"] = now
    return conf


# ── 当前赛季段位（按排名百分位；阈值与服务端 ladder-service.js 的 S3 表一致）──
LADDER_TIERS = [("巅峰", 0.0), ("大师", 0.08), ("钻石", 0.18), ("黄金", 0.35), ("白银", 0.60), ("参战者", 1.0)]

def ladder_tier_of(account: str):
    """返回 (段位名, 名次, 总人数)，如 ("S4 钻石", 12, 180)。

    ⚠ 不用 srv_user.ladderTitle：那是**赛季末结算**才写入的头衔，赛季进行中还停留在上一季
      （玩家反馈：S3 期间大厅显示 S2 黄金 ✗；S4 起用 SEASON_NAME）。player_rating 在赛季开始时被重置过，
      所以它的 rating 就是**当前赛季**的积分 ✓
    """
    try:
        rows = _pg_query(
            'with r as (select pr."accountName" as acct, pr.rating as rating, '
            'row_number() over (order by pr.rating desc, pr."accountName") as rn, '
            'count(*) over () as total from player_rating pr '
            'where pr.rating > 0 and pr."accountName" not like \'%$%\') '
            'select acct, rn, total from r where acct = :\'acct\'',
            {"acct": account},
        )
    except Exception as e:
        logger.warning(f"算段位失败({account}): {e}")
        return None, None, None
    if not rows:
        return None, None, None
    rn, total = int(rows[0][1]), int(rows[0][2])
    if total <= 0:
        return None, None, None
    pct = (rn - 1) / float(total)
    name = LADDER_TIERS[-1][0]
    for tier_name, th in LADDER_TIERS:
        if pct <= th:
            name = tier_name
            break
    return SEASON_NAME + " " + name, rn, total


def _pg_query(sql, variables=None):
    """用 psql 执行只读查询（不引入新依赖），返回二维列表。
    variables 里的值由 psql 的 :'名字' 绑定（自动转义，避免注入）。"""
    out = _psql_run(sql, variables or {}, ["-tA", "-F", "\t"])
    rows = []
    for line in out.splitlines():
        if line.strip():
            rows.append(line.split("\t"))
    return rows


# ══════════════════════════════════════════════════════════
# 称号商店（天梯积分 → 称号点 → 买称号） 2026-11-20
#
#   积分从哪来：游戏服赛季重置时（src/feats/ladder/ladder-service.ts 的
#     resetSeason()）在清空 player_rating 之前，把每个人「本赛季最终积分」
#     写进 ygo_ladder_season_result。官网这边只读这张表，不做结算计算，
#     避免两边对不上账。
#
#   称号点余额 = Σ 历次赛季发放积分 + Σ 人工调整(delta) - Σ 已消费
#     —— 全是从流水表算出来的，没有单独的「钱包余额」字段，
#        所以补发/回滚/重复结算都不会算错。
#
#   购买：写 ygo_title_shop_purchase（主键 account+title，天然防重复买），
#         并把称号并进 srv_user.titles（个人中心「称号展示」里就能选，
#         游戏内下次登录生效）。购买失败/写入失败时，下次打开商店会自动补。
# ══════════════════════════════════════════════════════════

TITLE_SHOP_FILE = ROOT / "data" / "title-shop.json"
_TITLE_SHOP_LOCK = threading.Lock()          # 同一进程内串行化购买
_TITLE_SHOP_SCHEMA_LOCK = threading.Lock()
_TITLE_SHOP_SCHEMA_AT = {"t": 0.0, "ok": False}
_TITLE_SHOP_CACHE = {"mtime": None, "items": []}

# 称号稀有度：商店只卖 白/绿/蓝/黄/红；
# 紫色（TITLE_RARITY_TASK）留给任务称号——成就称号、赛季段位称号等，由系统发放、不卖。
TITLE_RARITIES = ("白", "绿", "蓝", "黄", "红")
TITLE_RARITY_TASK = "紫"

# 与游戏服 resetSeason() 里的建表语句保持一致（两边谁先跑都能建出来）
TITLE_SHOP_DDL = """
CREATE TABLE IF NOT EXISTS ygo_ladder_season_result (
    season        varchar(32) NOT NULL,
    "accountName" varchar(64) NOT NULL,
    "displayName" varchar(64) NOT NULL DEFAULT '',
    rating        integer     NOT NULL DEFAULT 0,
    wins          integer     NOT NULL DEFAULT 0,
    losses        integer     NOT NULL DEFAULT 0,
    draws         integer     NOT NULL DEFAULT 0,
    "totalDuels"  integer     NOT NULL DEFAULT 0,
    tier          varchar(64) NOT NULL DEFAULT '',
    "settledAt"   timestamp   NOT NULL DEFAULT now(),
    PRIMARY KEY (season, "accountName")
);
CREATE TABLE IF NOT EXISTS ygo_title_shop_purchase (
    "accountName" varchar(64) NOT NULL,
    title         varchar(64) NOT NULL,
    price         integer     NOT NULL DEFAULT 0,
    season        varchar(32) NOT NULL DEFAULT '',
    "boughtAt"    timestamp   NOT NULL DEFAULT now(),
    PRIMARY KEY ("accountName", title)
);
CREATE TABLE IF NOT EXISTS ygo_title_shop_adjust (
    id            bigserial   PRIMARY KEY,
    "accountName" varchar(64) NOT NULL,
    delta         integer     NOT NULL,
    reason        text        NOT NULL DEFAULT '',
    "createdAt"   timestamp   NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ygo_site_config (
    key   varchar(64) PRIMARY KEY,
    value text        NOT NULL
);
"""


def ensure_title_shop_schema(force: bool = False) -> bool:
    """建表（幂等）。10 分钟内不重复执行，避免每个请求都打一次库。"""
    now = time.time()
    with _TITLE_SHOP_SCHEMA_LOCK:
        if not force and _TITLE_SHOP_SCHEMA_AT["ok"] and now - _TITLE_SHOP_SCHEMA_AT["t"] < 600:
            return True
        try:
            _psql_run(TITLE_SHOP_DDL, {}, ["-tA"], timeout=25)
            _TITLE_SHOP_SCHEMA_AT["ok"] = True
            _TITLE_SHOP_SCHEMA_AT["t"] = now
            return True
        except Exception as e:
            logger.warning(f"称号商店建表失败（会用只读模式继续）: {e}")
            _TITLE_SHOP_SCHEMA_AT["ok"] = False
            _TITLE_SHOP_SCHEMA_AT["t"] = now
            return False


def publish_site_season() -> None:
    """把当前赛季标识写到 ygo_site_config，游戏服赛季重置时读它给结果表打标签。
    这样赛季名只有官网这一处需要改（SEASON_NAME）。"""
    try:
        ensure_title_shop_schema()
        _pg_exec(
            "INSERT INTO ygo_site_config(key, value) VALUES ('ladderSeason', :'season')\n"
            "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;\n",
            {"season": SEASON_NAME},
        )
        logger.info(f"当前赛季标识已写入 ygo_site_config: {SEASON_NAME}")
    except Exception as e:
        logger.warning(f"写入当前赛季标识失败: {e}")


def load_title_shop_catalog() -> list:
    """读 data/title-shop.json（按 mtime 自动重载，改完存盘即生效）"""
    try:
        mtime = TITLE_SHOP_FILE.stat().st_mtime
    except OSError:
        logger.warning(f"称号目录不存在: {TITLE_SHOP_FILE}")
        return []
    if _TITLE_SHOP_CACHE["items"] and _TITLE_SHOP_CACHE["mtime"] == mtime:
        return _TITLE_SHOP_CACHE["items"]
    try:
        raw = json.loads(TITLE_SHOP_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"称号目录解析失败（继续用旧目录）: {e}")
        return _TITLE_SHOP_CACHE["items"]
    items, seen = [], set()
    for it in (raw.get("items") or []):
        if not isinstance(it, dict) or it.get("enabled") is False:
            continue
        title = str(it.get("title") or "").strip()
        if not title or len(title) > 64 or title in seen:
            continue
        try:
            price = int(it.get("price"))
        except (TypeError, ValueError):
            continue
        if price <= 0:
            continue
        rarity = str(it.get("rarity") or it.get("tier") or "白").strip()
        if rarity not in TITLE_RARITIES:
            rarity = "白"
        seen.add(title)
        items.append({
            "title": title,
            "price": price,
            "rarity": rarity,
            "desc": str(it.get("desc") or "").strip()[:160],
        })
    _TITLE_SHOP_CACHE["mtime"] = mtime
    _TITLE_SHOP_CACHE["items"] = items
    logger.info(f"称号商店目录已加载: {len(items)} 个称号")
    return items


def _titles_list(raw) -> list:
    """srv_user.titles 的容错解析（非法 JSON / 非数组一律当空）"""
    try:
        arr = json.loads(raw or "[]")
    except Exception:
        return []
    if not isinstance(arr, list):
        return []
    out = []
    for x in arr:
        if isinstance(x, str) and x and x not in out:
            out.append(x)
    return out


# ── 玩家排名用：称号 + 稀有度（30 秒缓存；换称号/改显示名会立刻失效）──
_LADDER_TITLES_CACHE = {"t": 0.0, "data": None}
LADDER_TITLES_TTL = 30


def ladder_titles_map(force: bool = False) -> dict:
    """显示名 / 账号名 / 天梯榜显示名 → [{"title", "rarity"}]

    展示口径与**游戏内一致**：主称号 = selectedTitle（没设就退回 ladderTitle 赛季称号），
    副称号 = selectedTitle2。两个都没设就不显示（不会把成就/购买记录里没装备的称号顶上来）。
    稀有度：商店目录里的称号按目录的值；其余（成就称号、赛季段位称号…）
    都是任务称号 → 紫。玩家在个人中心保存称号/显示名时会立刻让缓存失效，
    再进排名页就能看到新称号（最坏情况也只是 30 秒的被动过期）。

    ⚠ 天梯榜的名字来自 player_rating.displayName（玩家打天梯时的名字，可能改名后还是旧的），
      和 srv_user.displayName（个人中心当前显示名）不一定一致 —— 例：炎兽Lv999 vs 烟火一刹。
      所以这里把两个名字都作为键，避免“榜单有名字、称号对不上”。
    """
    now = time.time()
    if (not force and _LADDER_TITLES_CACHE["data"] is not None
            and now - _LADDER_TITLES_CACHE["t"] < LADDER_TITLES_TTL):
        return _LADDER_TITLES_CACHE["data"]
    rarity_of = {it["title"]: it["rarity"] for it in load_title_shop_catalog()}
    rows = _pg_query(
        'select u."accountName",\n'
        '       coalesce(nullif(u."displayName", \'\'), u."accountName"),\n'
        '       coalesce(u."selectedTitle", \'\'), coalesce(u."selectedTitle2", \'\'),\n'
        '       coalesce(u."ladderTitle", \'\'),\n'
        '       coalesce(pr."displayName", \'\')\n'
        'from srv_user u\n'
        'left join player_rating pr on pr."accountName" = u."accountName"',
    )
    out = {}
    for row in rows:
        if len(row) < 6:
            continue
        acct = (row[0] or "").strip()
        disp = (row[1] or acct).strip()
        main = (row[2] or "").strip() or (row[4] or "").strip()
        sub = (row[3] or "").strip()
        rating_name = (row[5] or "").strip()
        names = []
        if main:
            names.append(main)
        if sub and sub not in names:
            names.append(sub)
        if not names:
            continue
        info = [{"title": t, "rarity": rarity_of.get(t, TITLE_RARITY_TASK)} for t in names]
        for key in (disp, acct, rating_name):
            if key:
                out[key] = info
    _LADDER_TITLES_CACHE["t"] = now
    _LADDER_TITLES_CACHE["data"] = out
    return out


def _title_shop_owned(account: str) -> list:
    """已购买的称号（按购买时间）"""
    rows = _pg_query(
        'select title, price, "boughtAt"::date::text from ygo_title_shop_purchase '
        'where "accountName" = :\'acct\' order by "boughtAt" asc, title asc',
        {"acct": account},
    )
    out = []
    for r in rows:
        try:
            price = int(r[1] or 0)
        except (ValueError, IndexError):
            price = 0
        out.append({"title": r[0], "price": price, "date": (r[2] if len(r) > 2 else "")})
    return out


def title_shop_wallet(account: str) -> dict:
    """称号点账本：全部由流水表实时算出（没有可变余额字段，重复结算也不会多给）"""
    earned = adjusted = spent = 0
    try:
        rows = _pg_query(
            'select\n'
            '  coalesce((select sum(rating) from ygo_ladder_season_result where "accountName" = :\'acct\'), 0),\n'
            '  coalesce((select sum(delta)  from ygo_title_shop_adjust    where "accountName" = :\'acct\'), 0),\n'
            '  coalesce((select sum(price)  from ygo_title_shop_purchase  where "accountName" = :\'acct\'), 0)',
            {"acct": account},
        )
        if rows and rows[0]:
            earned = int(rows[0][0] or 0)
            adjusted = int(rows[0][1] or 0) if len(rows[0]) > 1 else 0
            spent = int(rows[0][2] or 0) if len(rows[0]) > 2 else 0
    except Exception as e:
        logger.warning(f"读称号点余额失败({account}): {e}")
    return {"earned": earned, "adjusted": adjusted, "spent": spent,
            "balance": max(0, earned + adjusted - spent)}


def title_shop_season_info(account: str = "") -> dict:
    """当前赛季信息 + 本人赛季进行中的积分（用于「结算预计 +N」提示）"""
    rating = 0
    if account:
        try:
            rows = _pg_query(
                'select coalesce(rating, 0) from player_rating where "accountName" = :\'acct\'',
                {"acct": account},
            )
            if rows:
                rating = int(rows[0][0] or 0)
        except Exception as e:
            logger.warning(f"读天梯积分失败({account}): {e}")
    rating = max(0, rating)
    return {
        "name": SEASON_NAME,
        "start": SEASON_START,
        "end": SEASON_END,
        "settleAt": SEASON_END + " 23:59",
        "currentRating": rating,
        "projected": rating,
    }


def _title_shop_add_user_title(account: str, title: str) -> bool:
    """把称号并入 srv_user.titles。

    读-改-写 + CAS（只有 titles 没被别人改动时才写回），失败重试几次。
    这样即使和游戏服（赛季称号发放）同时改同一个人的 titles，也不会把对方覆盖掉。
    """
    for _ in range(4):
        rows = _pg_query(
            'select coalesce(titles, \'[]\') from srv_user where "accountName" = :\'acct\'',
            {"acct": account},
        )
        if not rows:
            return False
        old_raw = rows[0][0] if rows[0] else "[]"
        current = _titles_list(old_raw)
        if title in current:
            return True
        current.append(title)
        new_raw = json.dumps(current, ensure_ascii=False)
        try:
            out = _psql_run(
                'UPDATE srv_user SET titles = :\'new\', "updateTime" = now()\n'
                'WHERE "accountName" = :\'acct\' AND coalesce(titles, \'[]\') = :\'old\'\n'
                'RETURNING 1;\n',
                {"new": new_raw, "acct": account, "old": old_raw},
                ["-tA"],
            )
        except Exception as e:
            logger.warning(f"写称号库失败({account} / {title}): {e}")
            return False
        if out.strip():
            return True
        # 被别人改过 → 重新读一遍再合并
    return False


def title_shop_sync_owned(account: str) -> None:
    """补写：已购买但 srv_user.titles 里还没有的称号（幂等，失败只记日志）"""
    try:
        owned = [x["title"] for x in _title_shop_owned(account)]
        if not owned:
            return
        rows = _pg_query(
            'select coalesce(titles, \'[]\') from srv_user where "accountName" = :\'acct\'',
            {"acct": account},
        )
        if not rows:
            return
        current = _titles_list(rows[0][0] if rows[0] else "[]")
        for title in owned:
            if title not in current:
                if _title_shop_add_user_title(account, title):
                    current.append(title)
    except Exception as e:
        logger.warning(f"称号库补写失败({account}): {e}")


def title_shop_payload(account: str = "") -> dict:
    """商店整页数据：目录 + 余额 + 已拥有 + 赛季/积分 + 历史发放"""
    ensure_title_shop_schema()
    out = {
        "ok": True,
        "loggedIn": bool(account),
        "account": account or "",
        "displayName": "",
        "currency": "称号点",
        "season": title_shop_season_info(account),
        "balance": 0,
        "earned": 0,
        "spent": 0,
        "adjusted": 0,
        "purchasable": 0,
        "items": [],
        "owned": [],
        "history": [],
    }
    if account:
        try:
            rows = _pg_query(
                'select coalesce(nullif("displayName", \'\'), "accountName") from srv_user '
                'where "accountName" = :\'acct\'',
                {"acct": account},
            )
            if rows and rows[0][0].strip():
                out["displayName"] = rows[0][0].strip()
        except Exception as e:
            logger.warning(f"取显示名失败({account}): {e}")
        title_shop_sync_owned(account)
        wallet = title_shop_wallet(account)
        out.update(wallet)
        out["owned"] = _title_shop_owned(account)
        try:
            rows = _pg_query(
                'select season, rating, "settledAt"::date::text from ygo_ladder_season_result '
                'where "accountName" = :\'acct\' order by "settledAt" desc limit 12',
                {"acct": account},
            )
            out["history"] = [
                {"season": r[0], "rating": int(r[1] or 0), "date": (r[2] if len(r) > 2 else "")}
                for r in rows
            ]
        except Exception as e:
            logger.warning(f"读赛季发放记录失败({account}): {e}")

    owned_set = {x["title"] for x in out["owned"]}
    balance = out["balance"]
    for it in load_title_shop_catalog():
        out["items"].append({
            **it,
            "owned": it["title"] in owned_set,
            "affordable": balance >= it["price"],
        })
    out["purchasable"] = sum(1 for x in out["items"] if not x["owned"] and x["affordable"])
    return out


def title_shop_buy(account: str, title: str):
    """购买称号。返回 (payload, http_status)；余额校验和扣费在同一条 SQL 里完成。"""
    ensure_title_shop_schema()
    item = {x["title"]: x for x in load_title_shop_catalog()}.get(title)
    if not item:
        return {"ok": False, "error": "商店里没有这个称号"}, 404
    with _TITLE_SHOP_LOCK:
        if title in {x["title"] for x in _title_shop_owned(account)}:
            return {"ok": False, "error": "你已经拥有这个称号了"}, 409
        wallet = title_shop_wallet(account)
        if wallet["balance"] < item["price"]:
            return {"ok": False, "error": f"称号点不足，还差 {item['price'] - wallet['balance']} 点"}, 400
        try:
            out = _psql_run(
                'INSERT INTO ygo_title_shop_purchase ("accountName", title, price, season)\n'
                'SELECT :\'acct\', :\'title\', :\'price\'::int, :\'season\'\n'
                'WHERE NOT EXISTS (\n'
                '        SELECT 1 FROM ygo_title_shop_purchase\n'
                '        WHERE "accountName" = :\'acct\' AND title = :\'title\')\n'
                '  AND :\'price\'::int <= (\n'
                '        coalesce((select sum(rating) from ygo_ladder_season_result where "accountName" = :\'acct\'), 0)\n'
                '      + coalesce((select sum(delta)  from ygo_title_shop_adjust    where "accountName" = :\'acct\'), 0)\n'
                '      - coalesce((select sum(price)  from ygo_title_shop_purchase  where "accountName" = :\'acct\'), 0))\n'
                'RETURNING 1;\n',
                {"acct": account, "title": title,
                 "price": str(item["price"]), "season": SEASON_NAME},
                ["-tA"],
            )
        except Exception as e:
            logger.error(f"称号购买写库失败({account} / {title}): {e}")
            return {"ok": False, "error": "购买失败，请稍后再试"}, 500
        if not out.strip():
            return {"ok": False, "error": "称号点不足或已拥有该称号"}, 400
        saved = _title_shop_add_user_title(account, title)
        if not saved:
            logger.warning(f"称号已购买，但写入称号库失败（下次打开商店会自动补）: {account} / {title}")
        logger.info(f"[称号商店] {account} 购买 {title}（{item['price']} 点，赛季 {SEASON_NAME}）")
        payload = title_shop_payload(account)
        payload["bought"] = item["title"]
        payload["saved"] = saved
        return payload, 200


def _wr(wins, games):
    return round(100.0 * wins / games, 2) if games else None


def _ladder_identity_map(names, ips=None):
    """把房间里的玩家名解析成天梯身份：返回 {名字或IP: (accountName, displayName, ladderTitle)}

    房间里的名字可能是 displayName，也可能是 accountName；两者都不匹配时再按 IP 兜底
    （游戏内昵称可以随便起，例如 AQ ↔ 账号 aqing / 显示名 啊倾 —— 只按名字永远对不上，
     头像和天梯称号就会丢，用户实测「为什么我不显示头像」）。
    """
    names = [n for n in (names or []) if n]
    # PATCH(白神服) 2026-11-05: IP 统一去掉 IPv6-mapped 前缀（::ffff:1.2.3.4）
    #   库里 srv_user.lastIp 存的是带前缀的形式，而 getrooms 给的是纯 IPv4 → 之前永远匹配不上 ✗
    def _norm_ip(v):
        t = str(v or '').strip()
        if t.lower().startswith('::ffff:'):
            t = t[7:]
        return t
    ips = [_norm_ip(x) for x in (ips or []) if _norm_ip(x)]
    if not names and not ips:
        return {}

    def _q(vals):
        return ",".join("'" + str(v).replace("'", "''") + "'" for v in vals)

    conds = []
    if names:
        conds.append('"accountName" in (' + _q(names) + ')')
        conds.append('"displayName" in (' + _q(names) + ')')
    if ips:
        conds.append("regexp_replace(coalesce(\"lastIp\", ''), '^::ffff:', '') in (" + _q(ips) + ')')
    try:
        sql = (
            'select "accountName", '
            'coalesce(nullif("displayName", \'\'), "accountName") as dn, '
            'coalesce("ladderTitle", \'\') as lt, '
            'coalesce("lastIp", \'\') as ip '
            'from srv_user where ' + ' or '.join(conds) + ' '
            'order by "updateTime" desc'      # 同一 IP 多个账号时，最近活跃的排前面
        )
        rows = _pg_query(sql)
    except Exception:
        return {}
    out = {}
    for row in rows:
        if len(row) < 3:
            continue
        acct, disp, title = row[0], row[1], row[2]
        ip = row[3] if len(row) > 3 else ""
        out[acct] = (acct, disp, title)
        out[disp] = (acct, disp, title)
        if ip:
            nip = ip[7:] if ip.lower().startswith('::ffff:') else ip
            if nip and nip not in out:
                out[nip] = (acct, disp, title)
    return out


def _ydke_sizes(deck_str):
    """getrooms 的 ydke 串 → (主卡组张数, 额外卡组张数)"""
    if not isinstance(deck_str, str) or not deck_str.startswith("ydke://"):
        return (0, 0)
    try:
        parts = deck_str[len("ydke://"):].split("!")
        def cnt(i):
            if i >= len(parts):
                return 0
            b64 = parts[i]
            raw = base64.b64decode(b64 + "=" * (-len(b64) % 4))
            return len(raw) // 4
        return (cnt(0), cnt(1))
    except Exception:
        return (0, 0)


def _ydke_first_main_card(deck_str):
    """getrooms 里的 deck 是 "ydke://主!额外!备牌" 编码串 → 取主卡组第一张卡号"""
    if not isinstance(deck_str, str) or not deck_str.startswith("ydke://"):
        return None
    try:
        body = deck_str[len("ydke://"):]
        main_b64 = body.split("!")[0]
        raw = base64.b64decode(main_b64 + "=" * (-len(main_b64) % 4))
        if len(raw) < 4:
            return None
        return struct.unpack("<I", raw[:4])[0]
    except Exception:
        return None


# ── 天梯主牌系（archetype）统计 ─────────────────────────────
# 数据口径：当赛季天梯房（M# / M,RANDOM#）里的**胜者**卡组，按 cdb setcode 归类主牌系；
#         只展示占比 >= 2% 的牌系。结果缓存 10 分钟（要算 40 张牌 × 上百场，别每次都算）。
_SETNAME_FILE = ROOT / "setnames.tsv"
_CARD_SETS_CACHE = {"t": 0.0, "map": None}
_SETNAMES_CACHE = {"t": 0.0, "map": None}
_ARCH_CACHE = {"t": 0.0, "data": None}
_ARCH_TTL = 60
_ARCH_MIN_PCT = 2.0
_ARCH_MIN_CARDS = 3          # 同一牌系至少 3 张才算“主轴”


def _load_setnames():
    """setcode -> 中文牌系名（setnames.tsv 由本地 strings.conf 的 !setname 生成）"""
    now = time.time()
    if _SETNAMES_CACHE["map"] is not None and now - _SETNAMES_CACHE["t"] < 3600:
        return _SETNAMES_CACHE["map"]
    mp = {}
    try:
        with io.open(str(_SETNAME_FILE), encoding="utf-8", errors="ignore") as f:
            for line in f:
                parts = line.rstrip("\n").split("\t")
                if len(parts) < 2:
                    continue
                try:
                    mp[int(parts[0])] = parts[1].strip()
                except ValueError:
                    continue
    except Exception as e:
        logger.warning(f"读取 setnames.tsv 失败: {e}")
    _SETNAMES_CACHE["map"] = mp
    _SETNAMES_CACHE["t"] = now
    return mp


def _load_card_sets():
    """卡号 -> setcode（合并官方/先行/DIY cdb）"""
    now = time.time()
    if _CARD_SETS_CACHE["map"] is not None and now - _CARD_SETS_CACHE["t"] < 3600:
        return _CARD_SETS_CACHE["map"]
    mp = {}
    paths = [ROOT / "cards_ocg.cdb", ROOT / "DIY_Sirokami.cdb"]
    for extra in PRE_CDB_FILES:
        try:
            paths.append(Path(extra))
        except Exception:
            pass
    for p in paths:
        try:
            if not Path(p).is_file():
                continue
            conn = sqlite3.connect(str(p))
            try:
                for cid, setcode in conn.execute("select id, setcode from datas"):
                    if cid is None:
                        continue
                    if setcode:
                        mp[int(cid)] = int(setcode)
            finally:
                conn.close()
        except Exception as e:
            logger.warning(f"读取 cdb setcode 失败 {p}: {e}")
    _CARD_SETS_CACHE["map"] = mp
    _CARD_SETS_CACHE["t"] = now
    logger.info(f"archetype: 已加载 {len(mp)} 张卡的 setcode")
    return mp


def _setcodes_of(setcode):
    """setcode 是 64 位：最多 4 个 16 位牌系 id"""
    out = []
    v = int(setcode or 0)
    for _ in range(4):
        part = v & 0xFFFF
        if part:
            out.append(part)
        v >>= 16
    return out


_ARCH_MIN_UNIQUE = 4        # 同一牌系至少 4 种**不同卡**才算主轴（防"掺几张就算本家"）
_ARCH_MIN_MENTION = 5       # 「记述有某卡名」：至少 5 种不同卡提及才算主轴
_CARD_MENTION_CACHE = {"map": None, "t": 0.0}


def _load_card_mentions():
    """卡号 -> 卡牌文本里「」引用的卡名列表（用于"记述有某卡"型卡组）"""
    now = time.time()
    if _CARD_MENTION_CACHE["map"] is not None and now - _CARD_MENTION_CACHE["t"] < 3600:
        return _CARD_MENTION_CACHE["map"]
    mp = {}
    paths = [ROOT / "cards_ocg.cdb", ROOT / "DIY_Sirokami.cdb"]
    for extra in PRE_CDB_FILES:
        try:
            paths.append(Path(extra))
        except Exception:
            pass
    pat = re.compile(r"「([^」]{1,16})」")
    for p_ in paths:
        try:
            if not Path(p_).is_file():
                continue
            conn = sqlite3.connect(str(p_))
            try:
                for cid, desc in conn.execute("select id, desc from texts where desc is not null"):
                    if not cid or not desc:
                        continue
                    found = pat.findall(str(desc))
                    if found and cid not in mp:
                        mp[cid] = found
            finally:
                conn.close()
        except Exception as e:
            logger.warning(f"读取卡牌文本失败({p_}): {e}")
    _CARD_MENTION_CACHE["map"] = mp
    _CARD_MENTION_CACHE["t"] = now
    return mp


def _archetype_of_deck(codes):
    """一副主卡组 -> 主轴牌系名

    PATCH(白神服) 2026-11-14:
      · 之前按「同 setcode 的卡张数」取最大 —— 主轴里掺 3 张本家就会被判成本家，
        实战里出现"明明是「记述有破解龙」的卡组，却被归到罪宝"（用户反馈 ✗）
      · 现在按「不同卡名数」判定（≥6 种不同卡），并列时再看张数；
      · 没有任何 setcode 达标时，退一步看卡牌文本：「记述有某卡名」的卡 ≥5 种 → 用那个卡名做牌系名
    """
    sets = _load_card_sets()
    names = _load_setnames()
    uniq = {}
    total = {}
    seen = set()
    for c in codes:
        cid = int(c) if c else 0
        if not cid:
            continue
        st = sets.get(cid)
        if not st:
            continue
        for aid in _setcodes_of(st):
            if (aid, cid) not in seen:
                seen.add((aid, cid))
                uniq[aid] = uniq.get(aid, 0) + 1
            total[aid] = total.get(aid, 0) + 1
    # 「记述有某卡名」统计（主轴没有本家 setcode 时用）
    mentions = _load_card_mentions()
    m_uniq = {}
    for c in set(int(x) for x in codes if x):
        for nm in mentions.get(c, ()):
            m_uniq[nm] = m_uniq.get(nm, 0) + 1

    def _label_of(aid):
        return names.get(aid) or ("#%d" % aid)

    parts = []
    used = set()

    # ① 主轴：setcode 里不同卡名最多的那个
    if uniq:
        aid, n = max(uniq.items(), key=lambda kv: (kv[1], total.get(kv[0], 0)))
        if n >= _ARCH_MIN_UNIQUE and total.get(aid, 0) >= 6:
            parts.append(_label_of(aid))
            used.add(_label_of(aid))

    # ② 主轴没有 setcode 时，用「记述有某卡名」当主轴
    if not parts and m_uniq:
        nm, n = max(m_uniq.items(), key=lambda kv: kv[1])
        if n >= _ARCH_MIN_MENTION and nm not in ("这张卡", "自己", "对方"):
            parts.append(nm)
            used.add(nm)

    if not parts:
        return ""

    # ③ 副轴：再找一个「够多但明显少于主轴」的系列（setcode 至少 2 种不同卡、≥3 张）
    cands = []
    for aid, n in uniq.items():
        if _label_of(aid) in used:
            continue
        if n >= 2 and total.get(aid, 0) >= 3:
            cands.append((n, total.get(aid, 0), _label_of(aid)))
    cands.sort(key=lambda x: (-x[0], -x[1]))
    if cands:
        main_n = max(uniq.values()) if uniq else 99
        n2 = cands[0][0]
        # 副轴不能多到和主轴差不多（否则就是双主轴，取名额最多的那个当主轴即可）
        if n2 <= max(2, main_n * 0.7) and cands[0][2] not in used:
            parts.append(cands[0][2])


    # ④ setcode 查不出副轴时，再看看「记述」里有没有第二多的系列
    if len(parts) == 1 and m_uniq:
        rest = sorted(((v, k) for k, v in m_uniq.items() if k not in used and k not in ("这张卡", "自己", "对方")),
                      reverse=True)
        if rest and rest[0][0] >= 3:
            parts.append(rest[0][1])

    # 统一去重：同族（青眼 / 青眼白龙、金属化 / 金属化·强化反射装甲）只留主轴，通用词不做副轴
    _GENERIC = {"融合", "同调", "超量", "连接", "灵摆", "仪式", "怪兽", "魔法", "陷阱", "效果"}
    final = [parts[0]]
    for p2 in parts[1:]:
        if any((p2 in x) or (x in p2) for x in final) or p2 in _GENERIC:
            continue
        final.append(p2)
        break
    return "/".join(final[:2])


def _decode_deck_buffer(buf_b64, mainc):
    """base64(currentDeckBuffer) -> 主卡组卡号列表；格式 [uint32 main][uint32 extra][ids...]"""
    try:
        raw = base64.b64decode(buf_b64 + "=" * (-len(buf_b64) % 4))
        if len(raw) < 8:
            return []
        ids = struct.unpack("<%dI" % ((len(raw) - 8) // 4), raw[8:8 + ((len(raw) - 8) // 4) * 4])
        n = int(mainc or 0)
        if n <= 0 or n > len(ids):
            n = len(ids)
        return list(ids[:n])
    except Exception:
        return []


def _ladder_archetype_stats():
    """当赛季天梯胜者卡组 -> 主牌系占比"""
    now = time.time()
    if _ARCH_CACHE["data"] and now - _ARCH_CACHE["t"] < _ARCH_TTL:
        return _ARCH_CACHE["data"]

    sql = (
        'select p."currentDeckBuffer", coalesce(p."currentDeckMainc", 0) '
        'from duel_record_player p join duel_record d on d.id = p."duelRecordId" '
        'where p.winner is true '
        '  and (d.name like \'M#%\' or d.name like \'%,RANDOM#%\') '
        '  and p."realName" not like \'%$%\' '
        '  and p."createTime" >= \'' + SEASON_START + '\' '
        '  and length(coalesce(p."currentDeckBuffer", \'\')) > 100'
        # PATCH(白神服) 2026-11-14: 排除"自己和自己打"的记录 ——
        #   有人用同一账号占两个座位刷了大量对局（650 场），把牌系占比整块拉歪（用户反馈饼图变了）
        '  and d.id not in (select q."duelRecordId" from duel_record_player q '
        '       group by q."duelRecordId" having count(distinct q.name) < 2)'
    )
    try:
        rows = _pg_query(sql)
    except Exception as e:
        logger.error(f"archetype 查询失败: {e}")
        return {"ok": False, "error": str(e)}

    counts = {}
    total = 0
    for buf, mainc in rows or []:
        codes = _decode_deck_buffer(buf or "", mainc)
        if not codes:
            continue
        total += 1
        name = _archetype_of_deck(codes) or "其它"
        counts[name] = counts.get(name, 0) + 1

    items = []
    shown = 0
    tail = []      # 占比不足 minPct 的长尾（饼图里的「其它」明细）
    for name, cnt in sorted(counts.items(), key=lambda kv: -kv[1]):
        if name == "其它":
            continue
        pct = (cnt * 100.0 / total) if total else 0.0
        if pct < _ARCH_MIN_PCT:
            tail.append({"name": name, "count": cnt, "pct": round(pct, 1)})
            continue
        items.append({"name": name, "count": cnt, "pct": round(pct, 1)})
        shown += cnt
    # 「其它」= 长尾 + 完全无法归类的卡组
    others = total - shown
    unclassified = counts.get("其它", 0)
    if others > 0 and total:
        items.append({"name": "其它", "count": others, "pct": round(others * 100.0 / total, 1)})

    data = {
        "ok": True,
        "generatedAt": int(now),
        "season": {"name": SEASON_NAME, "start": SEASON_START, "end": SEASON_END},
        "total": total,
        "minPct": _ARCH_MIN_PCT,
        "items": items,
        # 点击饼图「其它」时展开的明细（长尾牌系，按数量排序）
        "tail": tail[:80],
        "tailCount": len(tail),
        "tailTotal": sum(t["count"] for t in tail),
        "unclassified": unclassified,
    }
    _ARCH_CACHE["data"] = data
    _ARCH_CACHE["t"] = now
    return data


def _first_second_stats():
    """先手/后手胜率：当前赛季天梯（主）+ 最近7天 + 全部 + 按月趋势"""
    now = time.time()
    if _FS_CACHE["data"] and now - _FS_CACHE["t"] < _FS_CACHE_TTL:
        return _FS_CACHE["data"]

    # PATCH(白神服) 2026-11-14: 排除"同一账号占两边座位"的自战记录
    # PATCH(白神服) 2026-11-15: 相关子查询（每行一次 count distinct）在 2 万行上要跑 3 分半，
    #   psql 25s 超时 → 前端「统计读取失败」。改成 NOT IN 子查询（一次聚合 + 哈希反连接，0.1s）
    _NO_SELF = (' and d.id not in (select q."duelRecordId" from duel_record_player q '
                'group by q."duelRecordId" having count(distinct q.name) < 2)')
    def scope_rows(where):
        sql = (
            'select count(*) filter (where "isFirst"),\n'
            '       count(*) filter (where "isFirst" and winner),\n'
            '       count(*) filter (where not "isFirst"),\n'
            '       count(*) filter (where not "isFirst" and winner)\n'
            'from duel_record_player p\n'
        )
        if where:
            sql = (
                'select count(*) filter (where p."isFirst"),\n'
                '       count(*) filter (where p."isFirst" and p.winner),\n'
                '       count(*) filter (where not p."isFirst"),\n'
                '       count(*) filter (where not p."isFirst" and p.winner)\n'
                'from duel_record_player p join duel_record d on d.id = p."duelRecordId"\n'
                'where ' + where + _NO_SELF + '\n'
            )
        rows = _pg_query(sql)
        if not rows:
            return None
        fg, fw, sg, sw = [int(x) for x in rows[0][:4]]
        return {"firstGames": fg, "firstWins": fw, "firstWinRate": _wr(fw, fg),
                "secondGames": sg, "secondWins": sw, "secondWinRate": _wr(sw, sg),
                "games": fg + sg}

    # 天梯口径：M# 房 + 双方都已登录（DB 里用 realName 不含 $ 判定，与服务器重算积分一致）
    # PATCH(白神服) 2026-11-03: 随机匹配房名为 "M,RANDOM#xxxx"，M# 也不只是手动约房，
    # 所以天梯口径要同时包含两种房名，否则随机匹配的对局全被漏掉
    ladder_cond = ("(d.name like 'M#%' or d.name like '%,RANDOM#%') and p.\"realName\" not like '%$%'")
    month_cond = 'p."createTime" > now() - interval \'7 days\''
    season_cond = ('(d.name like \'M#%\' or d.name like \'%,RANDOM#%\') '
                   'and p."realName" not like \'%$%\' '
                   'and p."createTime" >= \'' + SEASON_START + '\'')

    monthly = []
    for mon, fg, fw, sg, sw in _pg_query(
        'select to_char("createTime", \'YYYY-MM\') as mon,\n'
        '       count(*) filter (where "isFirst"),\n'
        '       count(*) filter (where "isFirst" and winner),\n'
        '       count(*) filter (where not "isFirst"),\n'
        '       count(*) filter (where not "isFirst" and winner)\n'
        'from duel_record_player group by 1 order by 1'
    ):
        fg, fw, sg, sw = int(fg), int(fw), int(sg), int(sw)
        monthly.append({"month": mon, "firstGames": fg, "firstWinRate": _wr(fw, fg),
                        "secondWinRate": _wr(sw, sg), "games": fg + sg})

    data = {
        "ok": True,
        "generatedAt": int(now),
        "season": {
            "name": SEASON_NAME,
            "start": SEASON_START,
            "end": SEASON_END,
            **(scope_rows(season_cond) or {}),
        },
        "scopes": [
            dict(scope_rows(None) or {}, key="all", label="全部对局"),
            dict(scope_rows(month_cond) or {}, key="week", label="最近 7 天"),
            dict(scope_rows(ladder_cond) or {}, key="ladder", label="天梯房 M#（历史全部）"),
        ],
        "monthly": monthly,
    }
    _FS_CACHE["data"] = data
    _FS_CACHE["t"] = now
    return data


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
        elif path.startswith("/thumbcard/"):
            self._serve_card_thumb(path)
        else:
            # 新版引导把每一步的地址写成 /next.html/天梯 这种形式（history API，不刷新页面）。
            # 直接刷新或收藏这类地址时浏览器会来请求它，这里统一回落到 next.html：
            # 地址栏保持不变，页面加载后会自己把地址规范回 /next.html。
            if path.startswith("/next.html/"):
                self.path = "/next.html"
            # 决斗客户端入口页：要把登录态注入成 window._duelUser（客户端启动时同步读它，
            # 所以必须服务端注入，不能等前端 fetch）——见官方交接文档 §2.1 / §3
            if path in ("/duel.html", "/duel"):
                self._serve_duel_page()
                return
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
        # 决斗页 BGM：令牌 / 音频流（音频在站点根目录之外，静态路由取不到）
        if path.startswith("/api/bgm/"):
            self._handle_bgm(path)
            return

        # 百鸽 ygocdb 代理（避免浏览器直连外部域名的网络/CORS问题）
        if path.startswith("/api/ygocdb/"):
            self._proxy_ygocdb(path)
            return

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
            self.send_header("Cache-Control", "public, max-age=3600")
            self.send_header("ETag", _cards_etag)
            # gzip 压缩传输（浏览器均支持）
            accept = self.headers.get("Accept-Encoding", "")
            if "gzip" in accept and _cards_json_gz:
                self.send_header("Content-Encoding", "gzip")
                self.send_header("Content-Length", len(_cards_json_gz))
                self.end_headers()
                self.wfile.write(_cards_json_gz)
            else:
                self.send_header("Content-Length", len(_cards_json))
                self.end_headers()
                self.wfile.write(_cards_json)

        elif path == "/api/tournament":
            # 支持 ?slot=swiss|elim（配置内映射）或 ?id=NNN（直接指定），不带参数=默认赛事
            qs = self.path.split("?", 1)[1] if "?" in self.path else ""
            qargs = {}
            for pair in qs.split("&"):
                if not pair:
                    continue
                k, _, v = pair.partition("=")
                qargs[unquote(k)] = unquote(v)
            slot = (qargs.get("slot") or "").strip().lower()
            raw_id = (qargs.get("id") or "").strip()
            tid = None
            err = None
            pending = False
            if slot:
                if slot not in TOURNAMENT_SLOTS:
                    err = f"未知赛事槽位: {slot}"
                else:
                    tid = TOURNAMENT_SLOTS[slot]
                    # 编号未确定（值为 false/null/空）：通知前端显示「待公布」占位
                    if not tid:
                        pending = True
            elif raw_id:
                if not raw_id.isdigit() or len(raw_id) > 10:
                    err = "比赛ID格式不正确"
                else:
                    tid = raw_id
            if err:
                self._json_response({"error": err}, status=400)
            elif pending:
                self._json_response({
                    "pending": True,
                    "slot": slot,
                    "label": TOURNAMENT_SLOT_LABELS.get(slot, slot),
                    "message": TOURNAMENT_PENDING_MESSAGE.get(slot, "对阵待公布"),
                })
            else:
                try:
                    data = _get_tournament_data(tid)
                    self._json_response(data)
                except Exception as e:
                    logger.error(f"获取比赛数据失败: {e}")
                    self._json_response({"error": str(e)}, status=502)
        elif path == "/api/lobby/spectate":
            # PATCH(白神服) 2026-11-03: 决斗大厅左栏「在线观战」数据
            #   只列随机匹配房（房名 "M,RANDOM#xxxx"）且必须已经开局（getrooms 里未开局 status 为 null）
            try:
                data = _srvpro_fetch("/api/getrooms", {
                    "username": SRVPRO_READ_USER,
                    "pass": SRVPRO_READ_PASS,
                })
                out = []
                rooms_raw = [r for r in data.get("rooms", [])
                             if (r.get("roomname") or "").startswith("M,")]
                all_names = []
                for r in rooms_raw:
                    for u in (r.get("users") or []):
                        if u.get("pos") in (0, 1) and u.get("name"):
                            all_names.append(u.get("name"))
                identity = _ladder_identity_map(
                    all_names,
                    [u.get("ip") or "" for room in rooms_raw for u in (room.get("users") or [])],
                )
                for room in rooms_raw:
                    name = room.get("roomname") or ""
                    if not name.startswith("M,"):
                        continue
                    users = room.get("users") or []
                    p0 = next((u for u in users if u.get("pos") == 0), None)
                    p1 = next((u for u in users if u.get("pos") == 1), None)
                    if not p0 or not p1:
                        continue
                    st0, st1 = p0.get("status"), p1.get("status")
                    if not st0 and not st1:
                        continue          # 还在准备中 → 不显示
                    def _first_card(u):
                        return _ydke_first_main_card(u.get("deck"))
                    def _player(u, st):
                        raw = u.get("name") or ""
                        # PATCH(白神服) 2026-11-05: 服务端若直接给了 accountName/displayName 就用它
                        #   （IP 会变，按 IP 兜底会失效 → 观战列表显示成游戏昵称 AQ、没头像）
                        _acct0 = (u.get("accountName") or "").strip()
                        _disp0 = (u.get("displayName") or "").strip()
                        if _acct0:
                            acct, disp, title = identity.get(_acct0) or identity.get(_disp0) or (_acct0, _disp0 or _acct0, "")
                        else:
                            acct, disp, title = identity.get(raw) or identity.get(u.get("ip") or "") or ("", raw, "")
                        mainc, extrac = _ydke_sizes(u.get("deck"))
                        return {
                            "pos": u.get("pos"),
                            "rawName": raw,
                            "account": acct,
                            "name": disp or raw,
                            "ladderTitle": title,
                            "lp": (st or {}).get("lp"),
                            "card": _first_card(u),
                            "mainc": mainc,
                            "extrac": extrac,
                            "handc": (st or {}).get("cards"),
                        }

                    out.append({
                        "roomName": name,
                        "roomId": room.get("roomid"),
                        "players": [_player(p0, st0), _player(p1, st1)],
                    })
                self._json_response({"ok": True, "rooms": out, "ts": int(time.time())})
            except Exception as e:
                logger.error(f"获取观战列表失败: {e}")
                self._json_response({"ok": False, "error": str(e), "rooms": []}, status=502)

        elif path == "/api/liverooms":
            # PATCH(白神服) 2026-11-16: 随机匹配房只给管理员看（客户端过滤也能绕过，服务端直接不给）
            _is_admin_lr, _via_lr, _acct_lr, _perms_lr = self._requester_admin()
            try:
                data = _srvpro_fetch("/api/getrooms", {
                    "username": SRVPRO_READ_USER,
                    "pass": SRVPRO_READ_PASS,
                })
                rooms = data.get("rooms", [])
                for room in rooms:
                    # 天梯 = M 模式房（M# 或 M,…#，例如随机匹配房实际叫 "M,RANDOM#xxxx"）+ 双方都已登录
                    # ⚠ 原来只认 startswith("M#")，把随机匹配房（M,RANDOM#…）全判成了非天梯
                    _rname = room.get("roomname", "") or ""
                    isM = _rname.startswith("M#") or _rname.startswith("M,")
                    users = room.get("users", [])
                    p0 = next((u for u in users if u.get("pos") == 0), None)
                    p1 = next((u for u in users if u.get("pos") == 1), None)
                    bothLoggedIn = bool(p0 and p0.get("loggedIn") and p1 and p1.get("loggedIn"))
                    room["isLadder"] = isM and bothLoggedIn
                # PATCH(白神服) 2026-11-16: 非管理员直接拿不到随机匹配房（不是客户端过滤）
                if not _is_admin_lr:
                    data["rooms"] = [r for r in rooms
                                     if 'RANDOM' not in (r.get("roomname") or "").upper()]
                self._json_response(data)
            except Exception as e:
                logger.error(f"获取服务器对局数据失败: {e}")
                self._json_response({"error": str(e)}, status=502)

        elif path == "/api/admin":
            is_admin, via, acct, perms = self._requester_admin()
            if not is_admin:
                self._json_response({"error": "需要管理员权限"}, status=403)
                return
            plist = [x.strip() for x in (perms or "").split(",") if x.strip()]
            try:
                _raw_q0 = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
                _action0 = (_raw_q0.split("=", 1)[0] or "").strip()
            except Exception:
                _action0 = ""
            # 关房 / 死三 的权限：judge 只允许死三，关房要 sudo
            if via == "site":
                if _action0 in ("kick", "close") and not ("sudo" in plist or "judge" in plist):
                    self._json_response({"error": "关房需要管理员权限"}, status=403)
                    return
                if _action0 == "death" and not ("sudo" in plist or "judge" in plist):
                    self._json_response({"error": "死三需要管理员/稽查员权限"}, status=403)
                    return
            creds = self._admin_action_creds(acct or "", via or "")
            if not creds:
                self._json_response({"error": "无法取得执行凭据（账号密码为空？）"}, status=403)
                return
            username, password = creds
            query = {}
            raw_query = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
            for part in raw_query.split("&"):
                if "=" in part:
                    k, v = part.split("=", 1)
                    query[k] = v
            action_keys = [k for k in query if k not in ("username", "pass", "password", "callback")]
            if not action_keys:
                self._json_response({"error": "缺少操作参数"}, status=400)
                return
            query["username"] = username
            query["pass"] = password
            try:
                data = _srvpro_fetch("/api/message", query)
                self._json_response(data)
            except Exception as e:
                logger.error(f"管理员操作失败: {e}")
                self._json_response({"error": str(e)}, status=502)
        elif path == "/api/scores":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            # 禁止缓存：宕机/异常期间的中间缓存可能存坏数据，导致前端拿到空分数表
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
            self.send_header("X-GExt-Limit", str(_scores_limit))
            self.send_header("Content-Length", len(_scores_json))
            self.end_headers()
            self.wfile.write(_scores_json)

        elif path == "/api/ladder/archetypes":
            # 天梯主牌系占比（当赛季、仅胜者、>=2%）
            try:
                self._json_response(_ladder_archetype_stats())
            except Exception as e:
                logger.error(f"archetype 接口失败: {e}")
                self._json_response({"ok": False, "error": str(e)}, status=500)
        elif path == "/api/stats/first-second":
            # 先手 / 后手 胜率（来自游戏服数据库 duel_record_player.isFirst）
            try:
                data = _first_second_stats()
                self._json_response(data)
            except Exception as e:
                logger.error(f"先后手统计失败: {e}")
                self._json_response({"ok": False, "error": str(e)}, status=502)

        elif path == "/api/cardhints":
            # 按卡号批量取「效果提示文本」（CDB texts.str1..str8）。
            # 客户端在一张卡有多个可选效果时，用它把「发动效果①/②」标出来（很轻，按需取）。
            try:
                _q = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
                ids_raw = ""
                for _kv in _q.split("&"):
                    if _kv.startswith("ids="):
                        ids_raw = _kv[4:]
                want = [int(x) for x in ids_raw.split(",") if x.strip().isdigit()][:60]
            except Exception:
                want = []
            _byid = {int(c.get("id")): c for c in (_cards_cache or [])}
            _out = {}
            for _cid in want:
                _c = _byid.get(_cid)
                if _c and _c.get("hints"):
                    _out[str(_cid)] = _c["hints"]
            self._json_response(_out)
        elif path == "/api/cardtext":
            # 决斗客户端的卡文表（约 6.8MB → gzip，客户端懒加载；首次请求才读盘）
            cache = _load_duel_json("duel-cards-text.json", _duel_text, "卡文表")
            if cache is None:
                self._json_response({"error": "卡文表未生成，请先跑 tools/gen-duel-data.mjs"}, status=503)
            else:
                _send_duel_json(self, cache)

        elif path == "/api/strings":
            # 提示文本表（system/victory/counter/setname）：决斗客户端显示效果/阶段名用
            cache = _load_duel_json("duel-strings.json", _duel_strings, "提示文本表")
            if cache is None:
                self._json_response({"error": "提示文本表未生成，请先跑 tools/gen-duel-data.mjs"}, status=503)
            else:
                _send_duel_json(self, cache)

        elif path == "/api/duel/whoami":
            # 决斗客户端身份（交接文档 §2.1）：站点自己的 siro_community cookie
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"loggedIn": False})
            else:
                account = creds[0]
                # name 用「显示名」（决斗大厅标题、房间内昵称都用它）；显示名没设就退回账号
                display = account
                try:
                    rows = _pg_query(
                        'select coalesce(nullif("displayName", \'\'), "accountName") from srv_user '
                        'where "accountName" = :\'acct\'',
                        {"acct": account},
                    )
                    if rows and rows[0][0].strip():
                        display = rows[0][0].strip()
                except Exception as e:
                    logger.warning(f"whoami 取显示名失败({account}): {e}")
                out = {
                    "loggedIn": True,
                    "account": account,
                    "name": display,
                    "avatar": f"/api/forum/avatar/{account}",
                }
                # 天梯战绩（积分/胜/负/胜率）——社区资料接口不给胜场，这里直接读 player_rating
                try:
                    rows = _pg_query(
                        'select rating, wins, losses from player_rating where "accountName" = :\'acct\'',
                        {"acct": account},
                    )
                    if rows:
                        rating, wins, losses = int(rows[0][0]), int(rows[0][1]), int(rows[0][2])
                        games = wins + losses
                        _tier, _rank, _tot = ladder_tier_of(account)
                        out["ladder"] = {
                            "rating": rating,
                            "wins": wins,
                            "losses": losses,
                            "winRate": round(100.0 * wins / games, 1) if games else None,
                            "tier": _tier,
                            "rank": _rank,
                            "total": _tot,
                        }
                except Exception as e:
                    logger.warning(f"取天梯战绩失败({account}): {e}")
                self._json_response(out)

        elif path == "/api/duel/deck":
            # 「当前使用卡组」（交接文档 §2.2）：从账号卡组库里取 active 那套
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
            else:
                store = duel_decks_load(creds[0])
                # PATCH(白神服) 2026-11-07: 支持 ?name= 读取**指定**卡组 ——
                #   组卡器的「读取账号卡组」一直在用这个参数，但服务端以前忽略它，
                #   永远返回 active 那套 → 读任何卡组都显示同一套（用户实测 ✗）
                _raw_q = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
                _want = ""
                for _part in _raw_q.split("&"):
                    if _part.startswith("name="):
                        _want = _part[5:]
                if _want:
                    _key = _want[:-4] if _want.lower().endswith(".ydk") else _want
                    _deck = store["decks"].get(_key)
                    if _deck is None:
                        self._json_response({"error": "找不到卡组：" + _want}, status=404)
                        return
                    self._json_response({"name": _key, "main": _deck.get("main", []),
                                         "extra": _deck.get("extra", []), "side": _deck.get("side", [])})
                    return
                active = store.get("active") or ""
                deck = store["decks"].get(active)
                if not deck:
                    # 没设当前卡组就退回卡组库里第一套，方便玩家直接开打
                    first = sorted(store["decks"].keys())
                    if first:
                        active, deck = first[0], store["decks"][first[0]]
                if not deck:
                    self._json_response({"name": None, "main": [], "extra": [], "side": []})
                else:
                    self._json_response({"name": active, "main": deck.get("main", []),
                                         "extra": deck.get("extra", []), "side": deck.get("side", [])})

        elif path in ("/api/duel/decks", "/api/decks"):
            # 账号卡组库（两个路径都给：/api/decks 是**客户端契约**里那个，
            # /api/duel/decks 是决斗大厅自己用的）
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"dir": "未登录", "names": [], "active": ""})
            else:
                acc = creds[0]
                store = duel_decks_load(acc)
                names = [f"{n}.ydk" for n in sorted(store["decks"].keys())]
                active = store.get("active", "") or ""
                items = []
                for n in sorted(store["decks"].keys()):
                    d = store["decks"].get(n) or {}
                    mc = d.get("main") or []
                    ec = d.get("extra") or []
                    sc = d.get("side") or []
                    first = (mc + ec + sc + [0])[0]
                    items.append({"name": n, "main": len(mc), "extra": len(ec), "side": len(sc),
                                  "first": int(first or 0), "active": (n == active)})
                self._json_response({"dir": f"{acc} 的卡组库", "names": names,
                                     "items": items,
                                     "active": active,
                                     "count": len(names)})

        elif path == "/api/deck":
            # 读某个卡组（客户端契约：{name, main, extra, side}）
            creds = self._get_community_cookie()
            raw = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
            want = ""
            for part in raw.split("&"):
                if part.startswith("name="):
                    want = part[5:]
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
                return
            store = duel_decks_load(creds[0])
            key = want[:-4] if want.lower().endswith(".ydk") else want
            deck = store["decks"].get(key)
            if deck is None:
                self._json_response({"error": "找不到卡组：" + want}, status=404)
            else:
                self._json_response({"name": key, "main": deck.get("main", []),
                                     "extra": deck.get("extra", []), "side": deck.get("side", [])})

        elif path == "/api/archetypes":
            # 字段（系列）表：setcode(16进制) → 字段名
            if self.headers.get("If-None-Match") == _archetypes_etag and _archetypes_etag:
                self.send_response(304)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "public, max-age=3600")
            if _archetypes_etag:
                self.send_header("ETag", _archetypes_etag)
            accept = self.headers.get("Accept-Encoding", "")
            if "gzip" in accept:
                body = gzip.compress(_archetypes_json, compresslevel=6)
                self.send_header("Content-Encoding", "gzip")
            else:
                body = _archetypes_json
            self.send_header("Content-Length", len(body))
            self.end_headers()
            self.wfile.write(body)

        elif path == "/api/admin/status":
            is_admin, via, acct, perms = self._requester_admin()
            plist = [x.strip() for x in (perms or "").split(",") if x.strip()]
            can_act = bool(is_admin and (via == "cookie" or plist))
            # PATCH(白神服) 2026-11-16: 稽查员（judge）也给关房权限（用户要求：稽查员等同 sudo）
            can_kick = bool(is_admin and (via == "cookie" or "sudo" in plist or "judge" in plist))
            self._json_response({
                "loggedIn": is_admin,
                "via": via,
                "account": acct or "",
                "perms": perms or "",
                "role": ("管理员" if "sudo" in plist else ("稽查员" if "judge" in plist else ("管理员" if via == "cookie" else ""))),
                "canAct": can_act,
                "canKick": can_kick,
            })

        # ── 论坛社区 API (GET, 代理到 srvpro2) ──

        elif path == "/api/forum/status":
            creds = self._get_community_cookie()
            self._json_response({
                "loggedIn": creds is not None,
                "username": creds[0] if creds else None,
            })

        elif path.startswith("/api/forum/avatar/"):
            account_name = unquote(path.split("/api/forum/avatar/", 1)[1])
            if not account_name:
                self.send_error(404)
                return
            avatar_file = AVATAR_DIR / f"{account_name}.png"
            if avatar_file.is_file():
                with open(avatar_file, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/png")
                self.send_header("Cache-Control", "public, max-age=86400")
                self.send_header("Content-Length", len(data))
                self.end_headers()
                self.wfile.write(data)
            else:
                self.send_error(404)

        elif path == "/api/ladder/card-stats":
            # 卡片使用率/胜率 TOP（站点自算，排除自战）
            try:
                lim = 53
                try:
                    lim = max(1, min(100, int((parse_qs(urlparse(self.path).query).get("limit") or ["53"])[0])))
                except Exception:
                    lim = 53
                payload = json.dumps(self._compute_card_stats(lim), ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(payload)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(payload)
            except Exception as e:
                logger.warning(f"card-stats 计算失败: {e}")
                self.send_error(500)
        elif path == "/api/ladder/titles":
            # 玩家排名用：每个玩家展示的称号 + 稀有度（紫 = 任务称号）
            try:
                self._json_response({"ok": True, "titles": ladder_titles_map()})
            except Exception as e:
                logger.warning(f"取玩家称号失败: {e}")
                self._json_response({"ok": False, "titles": {}}, status=500)

        elif path == "/api/title-shop":
            # 称号商店：目录 + 余额 + 已拥有 + 当前赛季积分（未登录也能看目录）
            try:
                creds = self._get_community_cookie()
                self._json_response(title_shop_payload(creds[0] if creds else ""))
            except Exception as e:
                logger.error(f"称号商店读取失败: {e}")
                self._json_response({"ok": False, "error": "称号商店暂时不可用"}, status=500)

        elif path.startswith("/api/forum/"):
            self._proxy_forum_get(path)

        else:
            self.send_error(404)

    # ── API POST ───────────────────────────────────────

    def _handle_api_post(self, path: str, payload: dict):
        if path == "/api/admin/login":
            username = payload.get("username", "").strip()
            password = payload.get("password", "")
            if not username or not password:
                self._json_response({"ok": False, "error": "缺少用户名或密码"}, status=400)
                return
            try:
                _srvpro_fetch("/api/message", {
                    "username": username, "pass": password, "shout": "test"
                })
            except Exception:
                self._json_response({"ok": False, "error": "账号或密码错误"}, status=401)
                return
            token = _sign_cookie(username, password)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie",
                f"{COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Max-Age={COOKIE_MAX_AGE}; Path=/")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8"))

        elif path == "/api/admin/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie",
                f"{COOKIE_NAME}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8"))

        elif path == "/api/vote":
            image = payload.get("image", "")
            if not image:
                self._json_response({"ok": False, "error": "缺少 image 参数"},
                                    status=400)
                return
            result = store.vote(image, self.get_client_ip())
            status = 200 if result["ok"] else 400
            self._json_response(result, status=status)

        elif path == "/api/clientlog":
            # 决斗客户端错误上报：写 logs/clientlog.jsonl（按天轮转，保留 7 天）
            append_clientlog(payload)
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

        elif path == "/api/duel/enter":
            # 进匹配（交接文档 §2.3）：房号由服务端给。
            # 现阶段 srvpro2 侧的「票据校验 + M# 配对」还没做（GAP A4），
            # 所以先返回天梯固定前缀 M#，客户端用账号昵称自己进随机匹配队列。
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
            else:
                # PATCH(siro): 优先用前端上报的公网 IP ——
                #   本机 nginx 是 stream(L4) → 127.0.0.1:445 → HTTP，真实 IP 在 HTTP 层永远是 127.0.0.1 ✗
                #   （开 PROXY protocol 要改 20+ vhost，动共享 nginx 风险太大 ✗）
                #   → 由大厅页面直连回显服务取自己的公网 IP，随本请求报上来 ✓ 用它写 srv_user.lastIp ✓
                try:
                    import re as _re
                    _posted = str((payload or {}).get("realIp") or "").strip()
                    if _posted and not _re.fullmatch(r"[0-9a-fA-F:.]{3,45}", _posted):
                        _posted = ""
                    _ip2 = _posted or self.get_client_ip()
                    logger.warning(f"[IP诊断] account={creds[0]} posted={_posted!r} 采用={_ip2!r}")
                    if _ip2 and "127.0.0.1" not in _ip2 and "::1" not in _ip2:
                        _psql_run('update srv_user set "lastIp" = :\'ip\' where "accountName" = :\'acct\'',
                                  {"ip": _ip2, "acct": creds[0]}, [])
                        logger.warning(f"[IP诊断] 已写入 lastIp={_ip2!r}")
                except Exception as e:
                    logger.warning(f"[IP诊断] 写 lastIp 失败: {e}")
                self._json_response({
                    "room": "M#",          # 客户端会自动走随机匹配队列
                    "ticket": None,        # 票据待 srvpro2 侧中间件就绪后再签发
                    "expiresIn": 60,
                    "name": creds[0],
                })

        elif path == "/api/forum/register":
            # 自助注册（交接文档 §0/§8.2）：名称 / 账号 / 密码 / 再次输入密码
            # ⚠ 账号与密码**允许中文**（游戏服账号表就是这么存的：如「路基霸」）——
            #    所以这里只挡控制字符和长度，不用只允许 ASCII 的正则。
            account = (payload.get("username") or "").strip()
            password = payload.get("password") or ""
            password2 = payload.get("password2")
            display_name = (payload.get("displayName") or "").strip() or account
            if password2 is not None and password2 != password:
                self._json_response({"ok": False, "error": "两次输入的密码不一致"}, status=400)
                return
            if not (2 <= len(account) <= 24):
                self._json_response({"ok": False, "error": "账号长度需在 2~24 个字符之间"}, status=400)
                return
            if not (6 <= len(password) <= 64):
                self._json_response({"ok": False, "error": "密码长度需在 6~64 个字符之间"}, status=400)
                return
            if len(display_name) > 64:
                self._json_response({"ok": False, "error": "名称太长（最多 64 个字符）"}, status=400)
                return
            for value, label in ((account, "账号"), (display_name, "名称")):
                if any(ord(ch) < 32 for ch in value):
                    self._json_response({"ok": False, "error": f"{label}不能包含控制字符"}, status=400)
                    return
            try:
                if pg_user_exists(account):
                    self._json_response({"ok": False, "error": "该账号已被注册，换一个吧"}, status=400)
                    return
                pg_register_user(account, password, display_name)
                logger.info(f"新账号已注册: {account}（名称 {display_name}）")
            except Exception as e:
                logger.error(f"注册失败 {account}: {e}")
                self._json_response({"ok": False, "error": "注册失败，请稍后再试"}, status=500)
                return
            # 按文档 §0 的流程：注册完成 → 回到登录页（这里只回成功，不自动登录）
            self._json_response({"ok": True, "account": account, "name": display_name})

        elif path == "/api/duel/decks/upload":
            # 上传 .ydk 存进账号卡组库（决斗大厅「编辑 → 选卡组」用）
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"ok": False, "error": "未登录"}, status=401)
                return
            name = (payload.get("name") or "").strip()
            ydk = payload.get("ydk") or ""
            if not name:
                self._json_response({"ok": False, "error": "缺少卡组名"}, status=400)
                return
            if len(name) > 40:
                self._json_response({"ok": False, "error": "卡组名太长（最多 40 字）"}, status=400)
                return
            if any(ch in name for ch in '/\\:*?"<>|') or any(ord(c) < 32 for c in name):
                self._json_response({"ok": False, "error": "卡组名不能包含 / \\ : * ? \" < > | 等字符"}, status=400)
                return
            if len(ydk) > 200 * 1024:
                self._json_response({"ok": False, "error": "文件太大了"}, status=400)
                return
            deck = parse_ydk(ydk)
            total = len(deck["main"]) + len(deck["extra"]) + len(deck["side"])
            if not deck["main"]:
                self._json_response({"ok": False, "error": "这个 .ydk 里没读到主卡组（是不是选错文件了？）"}, status=400)
                return
            if total > DUEL_DECK_MAX_CARDS:
                self._json_response({"ok": False, "error": f"卡数太多（{total} > {DUEL_DECK_MAX_CARDS}）"}, status=400)
                return
            store = duel_decks_load(creds[0])
            if name not in store["decks"] and len(store["decks"]) >= DUEL_DECK_MAX:
                self._json_response({"ok": False, "error": f"卡组太多了（上限 {DUEL_DECK_MAX} 套），先删几套"}, status=400)
                return
            store["decks"][name] = deck
            if not store.get("active"):
                store["active"] = name        # 第一套自动设为当前使用
            duel_decks_save(creds[0], store)
            logger.info(f"卡组已保存: {creds[0]} / {name}（主{len(deck['main'])} 额{len(deck['extra'])} 副{len(deck['side'])}）")
            self._json_response({"ok": True, "name": name, "active": store.get("active"),
                                 "main": len(deck["main"]), "extra": len(deck["extra"]),
                                 "side": len(deck["side"])})

        elif path == "/api/duel/decks/active":
            # 设为「当前使用卡组」（开始匹配时注入给客户端的就是它）
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"ok": False, "error": "未登录"}, status=401)
                return
            name = (payload.get("name") or "").strip()
            store = duel_decks_load(creds[0])
            if name not in store["decks"]:
                self._json_response({"ok": False, "error": "没有这套卡组"}, status=404)
                return
            store["active"] = name
            duel_decks_save(creds[0], store)
            self._json_response({"ok": True, "active": name})

        elif path == "/api/duel/decks/delete":
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"ok": False, "error": "未登录"}, status=401)
                return
            name = (payload.get("name") or "").strip()
            store = duel_decks_load(creds[0])
            if name not in store["decks"]:
                self._json_response({"ok": False, "error": "没有这套卡组"}, status=404)
                return
            del store["decks"][name]
            if store.get("active") == name:
                store["active"] = sorted(store["decks"].keys())[0] if store["decks"] else ""
            duel_decks_save(creds[0], store)
            self._json_response({"ok": True, "active": store.get("active", ""),
                                 "remain": len(store["decks"])})

        # ── 论坛社区 API (POST) ──

        elif path == "/api/forum/login":
            username = payload.get("username", "").strip()
            password = payload.get("password", "")
            if not username or not password:
                self._json_response({"ok": False, "error": "缺少用户名或密码"}, status=400)
                return
            try:
                result = _srvpro_post("/api/forum/verify", {}, {
                    "username": username, "password": password,
                })
                if not result.get("ok"):
                    raise Exception("账号或密码错误")
            except Exception:
                self._json_response({"ok": False, "error": "账号或密码错误"}, status=401)
                return
            token = _sign_community_cookie(username, password)
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie",
                f"{COMMUNITY_COOKIE_NAME}={token}; HttpOnly; SameSite=Strict; Max-Age={COMMUNITY_COOKIE_MAX_AGE}; Path=/")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True, "username": username}, ensure_ascii=False).encode("utf-8"))

        elif path == "/api/forum/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie",
                f"{COMMUNITY_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8"))

        elif path == "/api/title-shop/buy":
            # 购买称号：余额与扣费在一条 SQL 里完成，重复购买由主键兜底
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"ok": False, "error": "请先登录官网账号"}, status=401)
                return
            title = str(payload.get("title") or "").strip()
            if not title:
                self._json_response({"ok": False, "error": "缺少称号名称"}, status=400)
                return
            data, status = title_shop_buy(creds[0], title)
            self._json_response(data, status=status)

        elif path.startswith("/api/forum/"):
            self._proxy_forum_post(path, payload)

        else:
            self.send_error(404)

    # ── API DELETE ─────────────────────────────────────

    def do_DELETE(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/forum/"):
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
                return
            username, password = creds
            try:
                data = _srvpro_delete(path, {"username": username, "pass": password})
                self._json_response(data)
            except Exception as e:
                logger.error(f"论坛 DELETE 失败: {e}")
                self._json_response({"error": str(e)}, status=502)
        else:
            self.send_error(404)

    # ── API PUT ─────────────────────────────────────

    def do_PUT(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/api/forum/"):
            creds = self._get_community_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
                return
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len) if content_len else b"{}"
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {}
            username, password = creds
            payload["username"] = username
            payload["password"] = password
            try:
                data = _srvpro_put(path, {"username": username, "pass": password}, payload)
                self._json_response(data)
            except Exception as e:
                logger.error(f"论坛 PUT 失败: {e}")
                self._json_response({"error": str(e)}, status=502)
        else:
            self.send_error(404)

    # ── 图片服务 ───────────────────────────────────────

        # ── PATCH(白神服) 2026-11-15: 卡图缩略图（组卡器小尺寸卡图别再用 400px 原图缩放）──
    #   原图直接缩到 60px 会因过采样出现锯齿/发锐；这里按目标宽度用 Lanczos 预缩放并落盘缓存
    CARD_THUMB_DIR = ROOT / "card_thumbs"
    CARD_THUMB_MAX_W = 480

    def _card_source_of(self, cid: int) -> str:
        try:
            for c in _cards_cache:
                if int(c.get("id") or 0) == cid:
                    return str(c.get("source") or "")
        except Exception:
            pass
        return ""

    def _card_pic_urls(self, cid: int):
        diy = "https://api.ygopro3.cn/pics/siro/%d.jpg" % cid
        pre = "https://cdn02.moecube.com:444/ygopro-super-pre/data/pics/%d.jpg" % cid
        ocg = "https://cdn.233.momobako.com/ygopro/pics/%d.jpg" % cid
        src = self._card_source_of(cid)
        if src == "diy":
            return [diy, pre, ocg]
        if src == "pre":
            return [pre, ocg, diy]
        if src == "ocg":
            return [ocg, pre, diy]
        return [diy, pre, ocg]

    def _card_thumb_path(self, cid: int, w: int):
        self.CARD_THUMB_DIR.mkdir(exist_ok=True)
        return self.CARD_THUMB_DIR / ("%d_%d.jpg" % (cid, w))

    def _build_card_thumb(self, cid: int, w: int):
        path = self._card_thumb_path(cid, w)
        if path.is_file() and path.stat().st_size > 512:
            return path
        if not HAS_PILLOW:
            return None
        # PATCH(白神服) 2026-11-15: 用 curl 抓图 —— Python urllib 对萌卡 CDN 会
        #   SSL handshake timeout（curl 正常），抓不到图缩略图就永远生成不出来
        import subprocess, tempfile
        def _fetch(url, timeout=12):
            fd, tmp = tempfile.mkstemp(suffix=".jpg")
            os.close(fd)
            try:
                r = subprocess.run(
                    ["curl", "-s", "-L", "--max-time", str(timeout),
                     "-A", "Mozilla/5.0 siro-web-thumb", "-o", tmp, url],
                    capture_output=True)
                if r.returncode == 0 and os.path.getsize(tmp) > 1024:
                    with open(tmp, "rb") as fh:
                        return fh.read()
            except Exception:
                pass
            finally:
                try:
                    os.unlink(tmp)
                except Exception:
                    pass
            return None

        def _looks_like_image(d):
            if not d or len(d) < 2500:
                return False
            return d[:3] == b"\xff\xd8\xff" or d[:8] == b"\x89PNG\r\n\x1a\n" or d[:4] == b"RIFF"

        urls = list(self._card_pic_urls(cid))
        # ② 同名卡兜底：先行卡的「OCG 卡号」常常一个图床都没有（镜像站只放先行号），
        #   但同名的先行卡号有图 → 拿过来用（玩家看到的是同一张卡）
        try:
            name = None
            for c in _cards_cache:
                if int(c.get("id") or 0) == cid:
                    name = c.get("name")
                    break
            if name:
                same = [int(c["id"]) for c in _cards_cache
                        if c.get("name") == name and int(c.get("id") or 0) != cid][:3]
                for sc in same:
                    urls.extend(self._card_pic_urls(sc))
        except Exception:
            pass

        for url in urls:
            try:
                data = _fetch(url)
                if not _looks_like_image(data):
                    continue
                im = Image.open(io.BytesIO(data))
                # 先让 JPEG 解码器直接降采样（draft），比全尺寸解码再缩快很多
                try:
                    im.draft("RGB", (int(w) * 2, int(w) * 3))
                except Exception:
                    pass
                im = im.convert("RGB")
                tw = max(40, min(int(w), im.width, self.CARD_THUMB_MAX_W))
                th = max(1, round(im.height * tw / im.width))
                im = im.resize((tw, th), Image.LANCZOS)
                tmp = path.with_suffix(".tmp")
                im.save(tmp, "JPEG", quality=84, optimize=True)
                tmp.replace(path)
                return path
            except Exception:
                continue
        return None

    def _serve_card_thumb(self, path: str):
        m = re.search(r"/(\d+)\.jpg$", path)
        if not m:
            self.send_error(404)
            return
        cid = int(m.group(1))
        try:
            qs = parse_qs(urlparse(self.path).query)
            w = int((qs.get("w") or ["160"])[0])
        except Exception:
            w = 160
        w = max(40, min(w, self.CARD_THUMB_MAX_W))
        p = self._card_thumb_path(cid, w)

        # PATCH(白神服) 2026-11-15: 冷启动别让浏览器等服务端抓图 ——
        #   缩略图还没生成时先 302 到原始图床（和以前一样快），
        #   同时后台线程生成缩略图，下一次请求就命中缓存（既快又清晰）
        if not (p.is_file() and p.stat().st_size > 512):
            try:
                import threading
                threading.Thread(target=self._build_card_thumb, args=(cid, w), daemon=True).start()
            except Exception:
                pass
            target = self._card_pic_urls(cid)[0]
            self.send_response(302)
            self.send_header("Location", target)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        self._serve_file(p.name, self.CARD_THUMB_DIR, 604800)

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

    # ── 决斗页 BGM（私有目录 + 短时令牌）────────────────────────

    def _handle_bgm(self, path: str):
        """GET /api/bgm/list?scene=index  列歌；GET /api/bgm/token?key=... 领令牌；
        GET /api/bgm/<key>?t=... 取音频。"""
        key = unquote(path[len("/api/bgm/"):]).strip("/")
        qs = parse_qs(urlparse(self.path).query)

        if key == "list":
            scene = (qs.get("scene") or ["index"])[0]
            tracks = [
                {"k": k, "name": fn.rsplit(".", 1)[0]}
                for k, fn in _bgm_scene_tracks(scene)
            ]
            self._json_response({"scene": scene, "tracks": tracks})
            return

        if key == "token":
            k = (qs.get("key") or ["duel"])[0]
            if _bgm_resolve(k) is None:
                self.send_error(404)
                return
            sid = _cookie_value(self.headers.get("Cookie", ""), BGM_COOKIE)
            extra = {}
            if not re.fullmatch(r"[0-9a-f]{32}", sid or ""):
                sid = secrets.token_hex(16)
                extra["Set-Cookie"] = (
                    f"{BGM_COOKIE}={sid}; Path=/api/bgm; Max-Age=86400; "
                    "HttpOnly; Secure; SameSite=Lax"
                )
            bucket = int(time.time()) // BGM_TOKEN_TTL
            self._json_response(
                {"t": _bgm_mac(sid, k, bucket), "ttl": BGM_TOKEN_TTL},
                headers=extra,
            )
            return

        if _bgm_resolve(key) is None:
            self.send_error(404)
            return

        sid = _cookie_value(self.headers.get("Cookie", ""), BGM_COOKIE)
        tok = (qs.get("t") or [""])[0]
        ok = False
        if sid and tok:
            now_bucket = int(time.time()) // BGM_TOKEN_TTL
            for b in (now_bucket, now_bucket - 1):     # 容忍跨 30 分钟边界
                if hmac.compare_digest(tok, _bgm_mac(sid, key, b)):
                    ok = True
                    break
        if not ok:
            body = b"forbidden"
            self.send_response(403)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return

        self._stream_bgm(key)

    def _stream_bgm(self, key: str):
        fp = _bgm_resolve(key)
        if fp is None or not fp.is_file():
            self.send_error(404)
            return
        try:
            total = fp.stat().st_size
        except OSError:
            self.send_error(500)
            return
        start, end, partial = 0, total - 1, False
        rng = (self.headers.get("Range") or "").strip()
        m = re.match(r"bytes=(\d*)-(\d*)$", rng)
        if m and (m.group(1) or m.group(2)):
            try:
                if m.group(1):
                    start = int(m.group(1))
                    end = int(m.group(2)) if m.group(2) else total - 1
                else:
                    start = max(0, total - int(m.group(2)))
                    end = total - 1
            except ValueError:
                start, end = 0, total - 1
            else:
                if start >= total or start > end:
                    self.send_response(416)
                    self.send_header("Content-Range", f"bytes */{total}")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                end = min(end, total - 1)
                partial = True
        length = end - start + 1
        self.send_response(206 if partial else 200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(length))
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{end}/{total}")
        # 不缓存：链接即使被测出来，也不能直接从共享缓存/代理里再拿
        self.send_header("Cache-Control", "no-store, private")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        try:
            with fp.open("rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except OSError:
            pass

    # ── 辅助方法 ───────────────────────────────────────

    def _serve_duel_page(self):
        """输出 duel.html，并把登录态注入为 window._duelUser（客户端启动时同步读它）"""
        path = ROOT / "duel.html"
        if not path.is_file():
            self.send_error(404, "duel.html not found")
            return
        html = path.read_text(encoding="utf-8")
        creds = self._get_community_cookie()
        if creds:
            # name   = **显示名**（房间/对局里显示的就是它，客户端拿它当昵称发出去）
            # account/pass = 账号与密码，客户端进房后用聊天命令 `/login 账号 密码` 登录游戏服，
            #                这样网页对战才算登录态、才计入天梯（用户定的方案：客户端直连登录）。
            # ⚠ 本页 no-store 不缓存；只有在官网已登录时才会注入。
            account = creds[0]
            display = account
            try:
                rows = _pg_query(
                    'select coalesce(nullif("displayName", \'\'), "accountName") from srv_user '
                    'where "accountName" = :\'acct\'',
                    {"acct": account},
                )
                if rows and rows[0][0].strip():
                    display = rows[0][0].strip()
            except Exception as e:
                logger.warning(f"取显示名失败({account}): {e}")
            user = {"name": display, "account": account, "pass": creds[1]}
            # 把「当前使用卡组」一起注入：客户端 ?auto=1 时直接用它上传+准备，
            # 不再用内置默认卡组（玩家在决斗大厅 lobby.html 里选好再进来）
            try:
                store = duel_decks_load(account)
                active = store.get("active") or (sorted(store["decks"].keys())[0] if store["decks"] else "")
                dk = store["decks"].get(active) if active else None
                if dk and dk.get("main"):
                    user["deck"] = {"main": dk.get("main", []), "extra": dk.get("extra", []),
                                    "side": dk.get("side", [])}
                    user["deckName"] = active
            except Exception as e:
                logger.warning(f"注入当前卡组失败({account}): {e}")
            inject = (
                "<script>window._duelUser="
                + json.dumps(user, ensure_ascii=False)
                + ";window._communityUsername=" + json.dumps(account, ensure_ascii=False) + ";</script>"
            )
        else:
            inject = "<script>window._duelUser=null;</script>"
        html = html.replace("<body>", "<body>\n" + inject, 1) if "<body>" in html else inject + html
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── PATCH(白神服) 2026-11-16: 管理员身份与官网账号打通 ──
    #   以前「服务器实时对局」的管理员只有单独输入账号密码（siro_admin cookie）才算；
    #   现在：官网账号在 srv_user.permissions 里带 sudo 也算管理员（与游戏内权限一致）。
    def _site_permissions(self, account: str) -> str:
        try:
            rows = _pg_query(
                'select coalesce(permissions, \'\') from srv_user where "accountName" = \'%s\'' % account.replace("'", "''"))
            return (rows[0][0] or "") if rows else ""
        except Exception as e:
            logger.warning(f"查站点账号权限失败({account}): {e}")
            return ""

    def _requester_admin(self):
        """返回 (is_admin, via, account, perms)
        via = 'cookie'（管理员账号密码）或 'site'（官网账号，srv_user.permissions 带 sudo/judge）
        权限：sudo=超级管理员（可关房），judge=稽查员（可死三）"""
        try:
            creds = self._get_admin_cookie()
            if creds:
                return True, "cookie", creds[0], "sudo"
        except Exception:
            pass
        try:
            creds2 = self._get_community_cookie()
            if creds2:
                acct = creds2[0]
                perms = self._site_permissions(acct)
                plist = [x.strip() for x in perms.split(",") if x.strip()]
                if "sudo" in plist or "judge" in plist:
                    return True, "site", acct, perms
                return False, "site", acct, perms
        except Exception:
            pass
        return False, None, None, ""

    def _site_password(self, account: str) -> str:
        """取官网账号在游戏服的密码（srv_user.password，明文）——用于以**本人身份**执行管理动作"""
        try:
            rows = _pg_query(
                'select coalesce(password, \'\') from srv_user where "accountName" = \'%s\' and coalesce(enabled, true)' % account.replace("'", "''"))
            return (rows[0][0] or "") if rows else ""
        except Exception as e:
            logger.warning(f"取账号密码失败({account}): {e}")
            return ""

    def _admin_action_creds(self, account: str = "", via: str = ""):
        """执行管理动作（死三/关房/广播）用的凭据：
        1) 管理员 cookie（自己登录的管理员账号）
        2) 官网账号 → 用它自己的密码（身份与权限都与游戏内一致）
        3) 兜底：config.local.json 里的 srvproAdminUser / srvproAdminPass"""
        creds = self._get_admin_cookie()
        if creds:
            return creds
        if account:
            pw = self._site_password(account)
            if pw:
                return (account, pw)
        if SRVPRO_ADMIN_USER and SRVPRO_ADMIN_PASS:
            return (SRVPRO_ADMIN_USER, SRVPRO_ADMIN_PASS)
        return None

    def _get_admin_cookie(self) -> tuple | None:
        return self._get_cookie(COOKIE_NAME, _verify_cookie)

    def _get_community_cookie(self) -> tuple | None:
        return self._get_cookie(COMMUNITY_COOKIE_NAME, _verify_community_cookie)

    def _get_cookie(self, name: str, verifier) -> tuple | None:
        cookie_header = self.headers.get("Cookie", "")
        for part in cookie_header.split(";"):
            part = part.strip()
            if part.startswith(f"{name}="):
                token = part[len(name) + 1:]
                return verifier(token)
        return None

    # ── 论坛代理方法 ───────────────────────────────────

    def _proxy_forum_get(self, path: str):
        # PATCH(白神服) 2026-11-15: 回放数据补 isFirst ——
        #   录像里只有"牌局座位"，DB 里才知道"房间座位谁先手"；
        #   两者比对即可判断这局有没有换边（观战没有这个信息，只能靠张数）
        m_replay = re.match(r"^/api/forum/replay/(\d+)$", path)
        if m_replay:
            self._proxy_forum_replay_with_first(int(m_replay.group(1)))
            return
        """将 GET 请求代理到 srvpro2 论坛 API。"""
        query = {}
        raw_query = unquote(self.path.split("?", 1)[1]) if "?" in self.path else ""
        for part in raw_query.split("&"):
            if "=" in part:
                k, v = part.split("=", 1)
                query[k] = v

        # 需要登录的操作自动附上 cookie 凭证
        creds = self._get_community_cookie()
        if creds:
            query["username"] = creds[0]
            query["pass"] = creds[1]

        try:
            data = _srvpro_fetch(path, query)
            self._json_response(data)
        except Exception as e:
            logger.error(f"论坛 GET 代理失败 {path}: {e}")
            self._json_response({"error": str(e)}, status=502)

    # ── PATCH(白神服) 2026-11-15: 卡片使用率/胜率 TOP（站点自己算，排除自战）──
    #   srvpro 的 /api/ladder/card-stats 会把「同一账号占两边座位」的自战也统计进去，
    #   刷分时同一套卡能刷出离谱的使用率/胜率（用户要求排除）。
    #   这里用同样的口径重算：最近 500 场 M/,RANDOM# 有效对局，排除自战，
    #   卡号按 card_merge_map 合并异画，使用率 = 出现卡组数 / 总卡组数。
    _CARD_STATS_TTL = 600
    _card_stats_cache = {"t": 0, "data": None}

    def _card_merge_map(self):
        path = "/root/servers/ygopro/srvpro-siro/card_merge_map.json"
        try:
            with open(path, encoding="utf-8") as f:
                raw = json.load(f)
            out = {}
            for k, v in (raw or {}).items():
                try:
                    out[int(k)] = int(v)
                except Exception:
                    pass
            return out
        except Exception:
            return {}

    @staticmethod
    def _decode_deck(buf_b64, mainc):
        """UpdateDeck payload: u32 mainc, u32 sidec, mainc×u32 codes, sidec×u32 codes"""
        import base64 as _b64
        import struct as _struct
        try:
            raw = _b64.b64decode(buf_b64 or "")
        except Exception:
            return [], []
        if len(raw) < 8:
            return [], []
        try:
            n = _struct.unpack_from("<I", raw, 0)[0]
            sidec = _struct.unpack_from("<I", raw, 4)[0]
        except Exception:
            return [], []
        if n <= 0 or n > 200 or sidec < 0 or sidec > 40:
            return [], []
        off = 8
        codes = []
        for _ in range(n):
            if off + 4 > len(raw):
                break
            codes.append(_struct.unpack_from("<I", raw, off)[0])
            off += 4
        side = []
        for _ in range(sidec):
            if off + 4 > len(raw):
                break
            side.append(_struct.unpack_from("<I", raw, off)[0])
            off += 4
        # mainc 是主卡组张数（DB 列），后面到 n 之间的都是额外
        mc = mainc if isinstance(mainc, int) and 0 < mainc <= len(codes) else len(codes)
        return codes[:mc], codes[mc:] + side

    def _compute_card_stats(self, limit=53):
        """当赛季卡片使用率/胜率（排除自战，异画合并，去重计卡组数）"""
        import time as _time
        now = _time.time()
        if self._card_stats_cache["data"] and now - self._card_stats_cache["t"] < self._CARD_STATS_TTL:
            return self._card_stats_cache["data"]
        merge = self._card_merge_map()
        # 当赛季：天梯房 + 有效对局 + 双方都登录 + 排除自战（同一账号占两边座位）
        sql = (
            'select p."duelRecordId", p.winner, p."currentDeckBuffer", coalesce(p."currentDeckMainc", 0), '
            '       p."ingameDeckBuffer", coalesce(p."ingameDeckMainc", 0) '
            'from duel_record_player p join duel_record d on d.id = p."duelRecordId" '
            "where (d.name like 'M#%' or d.name like '%,RANDOM#%') "
            '  and d."winReason" is not null '
            '  and coalesce(d.valid, true) = true '
            '  and d."startTime" >= \'' + SEASON_START + '\' '
            '  and d.id not in (select q."duelRecordId" from duel_record_player q '
            '                    group by q."duelRecordId" having count(distinct q.name) < 2) '
            '  and not exists (select 1 from duel_record_player q2 '
            '                  where q2."duelRecordId" = d.id and q2."realName" like \'%$%\')'
        )
        try:
            rows = _pg_query(sql) or []
        except Exception as e:
            logger.error(f"card-stats 查询失败: {e}")
            return {"ok": False, "error": str(e)}
        card_total, card_wins = {}, {}
        total_decks = 0
        seen_records = set()
        for rec_id, winner, dbuf, dmainc, ibuf, imainc in rows:
            seen_records.add(rec_id)
            codes_main, codes_other = self._decode_deck(ibuf or dbuf, imainc or dmainc or 0)
            all_codes = [c for c in (codes_main or []) + (codes_other or []) if c]
            if not all_codes:
                continue
            total_decks += 1
            won = str(winner).lower() in ("t", "true", "1")
            seen = set()
            for cid in all_codes:
                canon = merge.get(int(cid), int(cid))
                seen.add(canon)
            for cid in seen:
                card_total[cid] = card_total.get(cid, 0) + 1
                if won:
                    card_wins[cid] = card_wins.get(cid, 0) + 1
        MIN_TOTAL = 50
        items = []
        for cid, total in card_total.items():
            wins = card_wins.get(cid, 0)
            items.append({
                "cardId": cid, "wins": wins, "total": total,
                "usageRate": (total / total_decks * 100) if total_decks else 0,
                "winRate": (wins / total * 100) if total else 0,
            })

        def fmt(c):
            return {
                "cardId": c["cardId"], "wins": c["wins"], "total": c["total"],
                "usageRate": "%.1f%%" % c["usageRate"],
                "winRate": "%.1f%%" % c["winRate"],
            }

        top_used = sorted(items, key=lambda c: (-c["total"], -c["wins"]))[:limit]
        top_win = sorted([c for c in items if c["total"] >= MIN_TOTAL],
                         key=lambda c: (-c["winRate"], -c["wins"]))[:limit]
        data = {
            "season": {"name": SEASON_NAME, "start": SEASON_START, "end": SEASON_END},
            "totalDuels": len(seen_records),
            "totalDecks": total_decks,
            "mergedArt": len(merge),
            "excludeSelf": True,
            "scope": "season",
            "topUsed": [fmt(c) for c in top_used],
            "topWinRate": [fmt(c) for c in top_win],
        }
        self._card_stats_cache = {"t": now, "data": data}
        return data

    def _proxy_forum_replay_with_first(self, record_id: int):
        try:
            # 复用站点现成的 srvpro 代理（自带自签证书处理），不要直接用 urlopen
            data = _srvpro_fetch("/api/forum/replay/%d" % record_id, {})
            if not isinstance(data, dict):
                raise ValueError("unexpected replay payload")
        except Exception as e:
            logger.warning(f"回放代理失败({record_id}): {e}")
            self.send_error(502)
            return
        try:
            rows = _pg_query(
                'select pos, "isFirst" from duel_record_player where "duelRecordId"=%d' % record_id)
            flags = {int(r[0]): str(r[1]).lower() in ("t", "true", "1") for r in (rows or [])}
            for pl in (data.get("players") or []):
                pos = pl.get("pos")
                if pos in flags:
                    pl["isFirst"] = flags[pos]
        except Exception as e:
            logger.warning(f"回放补 isFirst 失败({record_id}): {e}")
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _proxy_forum_post(self, path: str, payload: dict):
        """将 POST 请求代理到 srvpro2 论坛 API。"""
        creds = self._get_community_cookie()
        if not creds:
            self._json_response({"error": "未登录"}, status=401)
            return
        username, password = creds
        query = {"username": username, "pass": password}

        # ── 内容安全检测 ──
        if path == "/api/forum/posts":
            check_text = (payload.get("title", "") + " " + payload.get("content", "")).strip()
            if check_text:
                ok, label = _tms_check(check_text)
                if not ok:
                    self._json_response({"error": "内容包含违规信息，请修改后重试"}, status=400)
                    return
        elif path.startswith("/api/forum/posts/") and path.endswith("/replies"):
            check_text = (payload.get("content", "")).strip()
            if check_text:
                ok, label = _tms_check(check_text)
                if not ok:
                    self._json_response({"error": "内容包含违规信息，请修改后重试"}, status=400)
                    return
        elif path == "/api/forum/profile/display-name":
            check_text = (payload.get("displayName", "")).strip()
            if check_text:
                ok, label = _tms_check(check_text)
                if not ok:
                    self._json_response({"error": "显示名包含违规信息，请修改后重试"}, status=400)
                    return

        # 头像上传特殊处理：base64 → Pillow 64×64 → 存文件
        if path == "/api/forum/profile/avatar":
            try:
                avatar_b64 = payload.get("avatar", "")
                if not avatar_b64:
                    self._json_response({"error": "缺少 avatar 数据"}, status=400)
                    return
                # 去掉 data:image/...;base64, 前缀
                if "," in avatar_b64:
                    avatar_b64 = avatar_b64.split(",", 1)[1]
                import binascii
                try:
                    img_data = base64.b64decode(avatar_b64)
                except binascii.Error:
                    self._json_response({"error": "无效的图片数据"}, status=400)
                    return

                # Pillow 缩放为 64×64
                try:
                    from io import BytesIO
                    img = Image.open(BytesIO(img_data))
                    img = img.convert("RGB")
                    img.thumbnail((AVATAR_SIZE, AVATAR_SIZE), Image.LANCZOS)
                    # 补到 64×64，居中
                    out = Image.new("RGB", (AVATAR_SIZE, AVATAR_SIZE), (30, 30, 30))
                    offset_x = (AVATAR_SIZE - img.width) // 2
                    offset_y = (AVATAR_SIZE - img.height) // 2
                    out.paste(img, (offset_x, offset_y))
                    # 保存
                    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
                    avatar_path = AVATAR_DIR / f"{username}.png"
                    out.save(avatar_path, "PNG")
                except Exception as img_err:
                    self._json_response({"error": f"图片处理失败: {img_err}"}, status=400)
                    return

                # 通知 srvpro2 更新 avatarVersion
                try:
                    data = _srvpro_post(path, query, {"avatar_version_increment": True})
                    self._json_response(data)
                except Exception:
                    # 即使 srvpro2 通知失败，文件已保存，也算成功
                    self._json_response({"ok": True, "avatarSaved": True})
            except Exception as e:
                logger.error(f"头像上传失败: {e}")
                self._json_response({"error": str(e)}, status=500)
            return

        # 普通 POST 代理 — 注入凭证到 body，srvpro2 从 body 读
        payload["username"] = username
        payload["password"] = password
        try:
            data = _srvpro_post(path, query, payload)
            # 玩家改了称号 / 显示名 → 排名页的称号缓存立即失效
            # （否则最多 60 秒内排名还显示旧称号；显示名变了还会按旧名对不上）
            if path in ("/api/forum/profile/title", "/api/forum/profile/display-name"):
                _LADDER_TITLES_CACHE["data"] = None
                _LADDER_TITLES_CACHE["t"] = 0.0
                logger.info(f"[称号缓存] 已失效（{path}）")
            self._json_response(data)
        except Exception as e:
            logger.error(f"论坛 POST 代理失败 {path}: {e}")
            self._json_response({"error": str(e)}, status=502)

    def _proxy_ygocdb(self, path: str):
        """代理百鸽 ygocdb API：/api/ygocdb/<rest> → https://ygocdb.com/api/v0/<rest>"""
        rest = path[len("/api/ygocdb/"):]
        url = "https://ygocdb.com/api/v0/" + rest
        parts = self.path.split("?", 1)
        if len(parts) > 1:
            # 对查询串百分号编码（保留已编码的 % 与 & =），兼容 raw 中文
            url += "?" + urllib.parse.quote(parts[1], safe="=&%")
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=20) as resp:
                body = resp.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            logger.error(f"ygocdb 代理失败 {url}: {e}")
            self._json_response({"error": str(e)}, status=502)

    def _json_response(self, obj, status: int = 200, headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
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
    refresh_scores_cache()
    load_archetypes()
    generate_thumbnails()
    _start_tournament_refresher()
    # 称号商店：建表 + 把当前赛季标识写给游戏服（赛季重置时用来给积分快照打标签）
    ensure_title_shop_schema()
    publish_site_season()

    server = ThreadingHTTPServer((HOST, PORT), VoteHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("服务已停止")
        server.server_close()
