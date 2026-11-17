"""Create a small RGBA PNG shield icon using only the Python standard library."""
import struct
import zlib
from pathlib import Path


def chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


size = 128
rows = []
for y in range(size):
    row = bytearray([0])
    for x in range(size):
        # Transparent background with a mint shield silhouette and dark inset.
        px, py = x / size, y / size
        outer = 0.17 <= px <= 0.83 and 0.13 <= py <= 0.76 and (py < 0.56 or abs(px - 0.5) < (0.83 - py) * 0.78)
        inset = 0.28 <= px <= 0.72 and 0.25 <= py <= 0.63 and (py < 0.51 or abs(px - 0.5) < (0.72 - py) * 0.70)
        if outer:
            row.extend((91, 223, 184, 255))
        elif inset:
            row.extend((9, 28, 34, 255))
        else:
            row.extend((0, 0, 0, 0))
    rows.append(bytes(row))
png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">2I5B", size, size, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"".join(rows), 9)) + chunk(b"IEND", b"")
target = Path(__file__).resolve().parents[1] / "extension" / "icons" / "shield-128.png"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(png)
print(target)
