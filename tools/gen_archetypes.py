#!/usr/bin/env python3
"""从 YGOPro 的 strings.conf 生成字段（系列）映射表 archetypes.json。

用法:
    python tools/gen_archetypes.py                       # 用默认路径
    python tools/gen_archetypes.py <strings.conf> <输出json>

strings.conf 中的字段定义格式：
    !setname 0x1 正义盟军	A・O・J
生成的 JSON 形如：{"1": "正义盟军", "2": "次世代", ...}
（键为 16 进制小写字符串，与 CDB 的 setcode 低/高 16 位对应）
"""
import json
import re
import sys
from pathlib import Path

DEFAULT_STRINGS = Path(r"D:\YGO\5.0.0.2\data\strings.conf")
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "archetypes.json"


def parse_setnames(path: Path) -> dict:
    table = {}
    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            m = re.match(r"^!setname\s+0x([0-9a-fA-F]+)\s+(\S+)", line.strip())
            if m:
                table["%x" % int(m.group(1), 16)] = m.group(2)
    return table


def main() -> int:
    strings = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_STRINGS
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    if not strings.is_file():
        print(f"找不到 {strings}", file=sys.stderr)
        return 1
    table = parse_setnames(strings)
    out.write_text(json.dumps(table, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"已写入 {out}（{len(table)} 条字段）")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
