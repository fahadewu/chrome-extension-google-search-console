#!/usr/bin/env python3
"""Generate the extension's PNG icons with no third-party deps.
Draws a rounded blue tile with three ascending bars (a mini chart)."""
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "icons")
BG = (79, 140, 255, 255)      # accent blue
BAR = (255, 255, 255, 255)    # white bars
TRANSPARENT = (0, 0, 0, 0)


def rounded(x, y, w, h, r):
    """True if pixel (x,y) is inside a w*h rounded rectangle with corner radius r."""
    if x < 0 or y < 0 or x >= w or y >= h:
        return False
    cx = min(max(x, r), w - 1 - r)
    cy = min(max(y, r), h - 1 - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def make(size):
    px = [[TRANSPARENT for _ in range(size)] for _ in range(size)]
    r = max(2, size // 6)

    # Tile background.
    for y in range(size):
        for x in range(size):
            if rounded(x, y, size, size, r):
                px[y][x] = BG

    # Three ascending bars centered in the tile.
    pad = max(2, size // 6)
    inner = size - pad * 2
    gap = max(1, inner // 12)
    bar_w = (inner - gap * 2) // 3
    heights = [0.45, 0.7, 1.0]
    base_y = size - pad
    for i, hf in enumerate(heights):
        bx = pad + i * (bar_w + gap)
        bh = int(inner * hf)
        for y in range(base_y - bh, base_y):
            for x in range(bx, bx + bar_w):
                if 0 <= x < size and 0 <= y < size and px[y][x] != TRANSPARENT:
                    px[y][x] = BAR

    return px


def write_png(path, px):
    size = len(px)
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # no filter
        for x in range(size):
            raw.extend(px[y][x])

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(raw), 9)
    with open(path, "wb") as f:
        f.write(sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b""))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for s in (16, 48, 128):
        write_png(os.path.join(OUT, f"icon{s}.png"), make(s))
        print(f"wrote icons/icon{s}.png")
