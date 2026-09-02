#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""晓白形象投票后端服务器 — 端口 8092"""

import hashlib
import hmac
import base64
import gzip
import json
import logging
import re
import sqlite3
import ssl
import threading
import time
import urllib.request
import urllib.error
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlencode

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
TOURNAMENT_ID = "159"  # 比赛ID，每次新比赛改这里
TABULATOR_API_URL = "https://api-tabulator.moecube.com:444/api/tournament"
TABULATOR_API_KEY = "MRAUXnLph1YP2sVeC9fQr7MKSK9KvbmoKrPchtED2YjKuVe5Q2x1zv32HrRxjfiC"
TOURNAMENT_CACHE_TTL = 15  # 缓存秒数

# ── Cookie 认证配置 ─────────────────────────────────────────
COOKIE_NAME = "siro_admin"
COOKIE_SECRET = "siro_admin_secret_2026_f1a8c"
COOKIE_MAX_AGE = 86400  # 24 小时

COMMUNITY_COOKIE_NAME = "siro_community"
COMMUNITY_COOKIE_SECRET = "siro_community_secret_2026_g3b2d"
COMMUNITY_COOKIE_MAX_AGE = 604800  # 7 天

AVATAR_DIR = ROOT / "avatars"
AVATAR_SIZE = 64

# ── 腾讯云文本内容安全（TMS）配置 ─────────────────────────
TMS_ENDPOINT = "tms.tencentcloudapi.com"
TMS_ENABLED = True  # 设为 False 可临时关闭检测

def _load_tms_config():
    """从 config.local.json 加载密钥（不提交到 git）。"""
    config_path = ROOT / "config.local.json"
    if config_path.is_file():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            return cfg.get("tms_secret_id", ""), cfg.get("tms_secret_key", "")
        except Exception:
            pass
    return "", ""

TMS_SECRET_ID, TMS_SECRET_KEY = _load_tms_config()

# ── srvpro2 服务器对局监控代理配置 ─────────────────────────
SRVPRO_API_URL = "https://127.0.0.1:50009"
SRVPRO_READ_USER = "readonly"
SRVPRO_READ_PASS = "readonly123"

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
            "datas.level, datas.race, datas.attribute, texts.desc, datas.alias "
            "FROM datas JOIN texts ON datas.id = texts.id"
        ).fetchall()
    finally:
        conn.close()

    cards = []
    for row in rows:
        card_id, name, type_val, atk, def_, level, race, attr, desc, alias = row
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
            "alias": alias or 0,
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

# 比赛数据缓存 (惰性加载，定期刷新)
_tournament_cache: dict | None = None
_tournament_cache_time: float = 0


def refresh_cards_cache():
    """重新从 CDB 加载卡牌数据并更新缓存。"""
    global _cards_cache, _cards_json, _cards_json_gz, _cards_etag
    _cards_cache = load_cards_from_cdb(CDB_FILE)
    _cards_json = json.dumps(_cards_cache, ensure_ascii=False).encode("utf-8")
    _cards_json_gz = gzip.compress(_cards_json, compresslevel=6)
    _cards_etag = f'"{hashlib.md5(_cards_json).hexdigest()}"'
    logger.info(f"卡牌缓存已刷新: {len(_cards_cache)} 张, {len(_cards_json) / 1024:.0f} KB JSON → {len(_cards_json_gz) / 1024:.0f} KB gzip")


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
            try:
                data = _get_tournament_data()
                self._json_response(data)
            except Exception as e:
                logger.error(f"获取比赛数据失败: {e}")
                self._json_response({"error": str(e)}, status=502)
        elif path == "/api/liverooms":
            try:
                data = _srvpro_fetch("/api/getrooms", {
                    "username": SRVPRO_READ_USER,
                    "pass": SRVPRO_READ_PASS,
                })
                rooms = data.get("rooms", [])
                for room in rooms:
                    # 天梯 = M# 前缀 + 双方都已登录
                    isM = room.get("roomname", "").startswith("M#")
                    users = room.get("users", [])
                    p0 = next((u for u in users if u.get("pos") == 0), None)
                    p1 = next((u for u in users if u.get("pos") == 1), None)
                    bothLoggedIn = bool(p0 and p0.get("loggedIn") and p1 and p1.get("loggedIn"))
                    room["isLadder"] = isM and bothLoggedIn
                self._json_response(data)
            except Exception as e:
                logger.error(f"获取服务器对局数据失败: {e}")
                self._json_response({"error": str(e)}, status=502)

        elif path == "/api/admin":
            creds = self._get_admin_cookie()
            if not creds:
                self._json_response({"error": "未登录"}, status=401)
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
            self.send_header("Cache-Control", "public, max-age=3600")
            self.send_header("X-GExt-Limit", str(_scores_limit))
            self.send_header("Content-Length", len(_scores_json))
            self.end_headers()
            self.wfile.write(_scores_json)

        elif path == "/api/admin/status":
            creds = self._get_admin_cookie()
            self._json_response({"loggedIn": creds is not None})

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
    refresh_scores_cache()
    generate_thumbnails()

    server = ThreadingHTTPServer((HOST, PORT), VoteHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("服务已停止")
        server.server_close()
