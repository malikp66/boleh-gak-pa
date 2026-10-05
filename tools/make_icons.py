"""Bikin ikon PWA (piring + lampu hijau) tanpa dependensi."""
import struct, zlib, os

def png(path, size, pad):
    bg, plate, rim, dot = (255,210,63), (255,255,255), (17,17,17), (17,17,17)
    cx = cy = size / 2
    r_plate, r_rim = size*(0.36-pad), size*(0.30-pad)
    r_dot, dx, dy = size*0.11, cx + size*(0.20-pad*0.5), cy - size*(0.20-pad*0.5)
    corner = 0 if pad else size*0.22
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            px, py = x+0.5, y+0.5
            # rounded square mask (ikon biasa) / full bleed (maskable)
            qx, qy = max(abs(px-cx)-(cx-corner),0), max(abs(py-cy)-(cy-corner),0)
            if corner and qx*qx+qy*qy > corner*corner:
                raw += bytes((0,0,0,0)); continue
            c = bg
            d = ((px-cx)**2+(py-cy)**2)**0.5
            if d < r_plate: c = plate
            if d < r_rim: c = rim if d > r_rim-size*0.015 else plate
            if ((px-dx)**2+(py-dy)**2)**0.5 < r_dot+size*0.02: c = bg
            if ((px-dx)**2+(py-dy)**2)**0.5 < r_dot: c = dot
            raw += bytes((*c,255))
    def chunk(t, d): return struct.pack(">I",len(d))+t+d+struct.pack(">I",zlib.crc32(t+d)&0xffffffff)
    data = b"\x89PNG\r\n\x1a\n"+chunk(b"IHDR",struct.pack(">IIBBBBB",size,size,8,6,0,0,0))+chunk(b"IDAT",zlib.compress(bytes(raw),9))+chunk(b"IEND",b"")
    open(path,"wb").write(data)

out = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
png(os.path.join(out,"icon-192.png"),192,0)
png(os.path.join(out,"icon-512.png"),512,0)
png(os.path.join(out,"maskable-512.png"),512,0.06)
