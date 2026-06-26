#!/usr/bin/env python3
"""
SmartLocker - single slot mockup with a WORKING pin hinge.

Generates separate printable parts:
    locker_body.stl   cabinet (5 walls, open front) + hinge barrels + lock strike
    locker_door.stl   door panel + QR plaque + handle + interleaving hinge barrels
    locker_pin.stl    hinge pin (or skip it and use a Ø3 mm steel rod / filament)
    locker_assembled.stl  all parts, door closed - for previewing only

The hinge barrels on body and door interleave along a vertical axis and share a
through-bore; drop the pin (or a rod) through both and the door swings open.

No external libraries. Binary STL.

Run:
    python locker_slot.py
    python locker_slot.py --scale 1.5
    python locker_slot.py --w 150 --h 150 --d 200
"""

import argparse, struct, math

# ----------------------------------------------------------------------
# tiny mesh builder -> binary STL
# ----------------------------------------------------------------------
class Mesh:
    def __init__(self):
        self.tris = []

    @staticmethod
    def _sub(a, b):  return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
    @staticmethod
    def _cross(a, b): return (a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0])
    @staticmethod
    def _dot(a, b):  return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]

    def tri(self, a, b, c, desired):
        n = self._cross(self._sub(b, a), self._sub(c, a))
        if self._dot(n, desired) < 0:
            b, c = c, b
        self.tris.append((a, b, c))

    def quad(self, v0, v1, v2, v3, desired):
        self.tri(v0, v1, v2, desired)
        self.tri(v0, v2, v3, desired)

    def box(self, x0, y0, z0, x1, y1, z1):
        p000=(x0,y0,z0); p100=(x1,y0,z0); p110=(x1,y1,z0); p010=(x0,y1,z0)
        p001=(x0,y0,z1); p101=(x1,y0,z1); p111=(x1,y1,z1); p011=(x0,y1,z1)
        self.quad(p000,p100,p110,p010, (0,0,-1))
        self.quad(p001,p101,p111,p011, (0,0, 1))
        self.quad(p000,p100,p101,p001, (0,-1,0))
        self.quad(p010,p110,p111,p011, (0, 1,0))
        self.quad(p000,p010,p011,p001, (-1,0,0))
        self.quad(p100,p110,p111,p101, ( 1,0,0))

    def cylinder_z(self, cx, cy, z0, z1, r, seg=32):
        """Solid cylinder, axis along Z."""
        r0 = [(cx+r*math.cos(2*math.pi*i/seg), cy+r*math.sin(2*math.pi*i/seg), z0) for i in range(seg)]
        r1 = [(cx+r*math.cos(2*math.pi*i/seg), cy+r*math.sin(2*math.pi*i/seg), z1) for i in range(seg)]
        c0=(cx,cy,z0); c1=(cx,cy,z1)
        for i in range(seg):
            j=(i+1)%seg
            ang=2*math.pi*(i+0.5)/seg
            self.quad(r0[i],r0[j],r1[j],r1[i], (math.cos(ang),math.sin(ang),0))
            self.tri(c0, r0[i], r0[j], (0,0,-1))
            self.tri(c1, r1[j], r1[i], (0,0, 1))

    def tube_z(self, cx, cy, z0, z1, r_out, r_in, seg=32):
        """Hollow cylinder (barrel with bore), axis along Z."""
        o0=[(cx+r_out*math.cos(2*math.pi*i/seg), cy+r_out*math.sin(2*math.pi*i/seg), z0) for i in range(seg)]
        o1=[(cx+r_out*math.cos(2*math.pi*i/seg), cy+r_out*math.sin(2*math.pi*i/seg), z1) for i in range(seg)]
        i0=[(cx+r_in*math.cos(2*math.pi*i/seg),  cy+r_in*math.sin(2*math.pi*i/seg),  z0) for i in range(seg)]
        i1=[(cx+r_in*math.cos(2*math.pi*i/seg),  cy+r_in*math.sin(2*math.pi*i/seg),  z1) for i in range(seg)]
        for i in range(seg):
            j=(i+1)%seg
            ang=2*math.pi*(i+0.5)/seg
            rad=(math.cos(ang),math.sin(ang),0)
            self.quad(o0[i],o0[j],o1[j],o1[i], rad)                       # outer wall
            self.quad(i0[i],i0[j],i1[j],i1[i], (-rad[0],-rad[1],0))       # inner bore
            self.quad(i1[i],i1[j],o1[j],o1[i], (0,0, 1))                  # top annulus
            self.quad(i0[i],o0[i],o0[j],i0[j], (0,0,-1))                  # bottom annulus

    def extend(self, other):
        self.tris.extend(other.tris)

    def write_stl(self, path, name="part"):
        with open(path, "wb") as f:
            f.write(struct.pack("<80sI", name.encode()[:80].ljust(80, b" "), len(self.tris)))
            for a, b, c in self.tris:
                n=self._cross(self._sub(b,a), self._sub(c,a))
                ln=math.sqrt(sum(k*k for k in n)) or 1.0
                f.write(struct.pack("<3f", n[0]/ln, n[1]/ln, n[2]/ln))
                for v in (a,b,c): f.write(struct.pack("<3f", *v))
                f.write(struct.pack("<H", 0))


# ----------------------------------------------------------------------
# geometry parameters
# ----------------------------------------------------------------------
def geom(W, H, D, t, door_t, gap, hinge_gap):
    g = {}
    g.update(W=W, H=H, D=D, t=t, door_t=door_t, gap=gap)
    # door panel placement (front face stands proud of the frame)
    g['door_x0'] = hinge_gap
    g['door_x1'] = W - gap
    g['door_z0'] = gap
    g['door_z1'] = H - gap
    g['door_y1'] = -2.0
    g['door_y0'] = g['door_y1'] - door_t
    # hinge axis: along the door's left edge, mid-thickness
    g['ax'] = g['door_x0']
    g['ay'] = (g['door_y0'] + g['door_y1']) / 2.0
    g['r_out'] = door_t/2 + 2.5
    g['r_in']  = 1.7          # bore radius -> Ø3.4 hole (3 mm rod + clearance)
    g['pin_r'] = 1.45         # printed pin -> Ø2.9 (slip fit in the bore)
    g['k_z0']  = H*0.15
    g['k_z1']  = H*0.85
    g['knuckles'] = 5
    g['ax_gap'] = 0.6         # axial clearance between knuckles
    g['seg'] = 32

    # --- CyberTice 12V solenoid lock, SIDE DEADBOLT, INVERTED (absolute mm) ---
    # Solenoid mounts on the DOOR (latch side), bolt fires +X into a striker
    # ring on the FRAME's right wall. Body lies along X (its 55 mm length).
    # NOTE: wires run to the moving door -> needs a hinge-side service loop.
    g['lk_len']  = 55.0       # body length, along X (= bolt axis)
    g['lk_w']    = 23.0       # body width,  along Y (sticks into cabinet)
    g['lk_h']    = 30.0       # body height, along Z
    g['lk_proj'] = 10.0       # bolt throw
    g['lk_bolt'] = 10.0       # bolt cross-section (10 x 10)
    g['foot_l']  = 65.0       # L-bracket foot length (along X)
    g['foot_w']  = 38.0       # L-bracket foot width  (along Y)
    g['shelf_z'] = max(t + 2, H/2 - g['lk_h']/2)      # body bottom (pad top)
    g['bolt_cz'] = g['shelf_z'] + g['lk_h']/2          # bolt centred in height
    # foot lies flat starting at the door inner face; body centred in the foot's width
    g['foot_y0'] = g['door_y1']
    g['foot_y1'] = g['door_y1'] + g['foot_w']
    g['lk_y0']   = g['foot_y0'] + (g['foot_w'] - g['lk_w']) / 2.0
    g['lk_y1']   = g['lk_y0'] + g['lk_w']
    g['bolt_cy'] = (g['lk_y0'] + g['lk_y1']) / 2.0
    g['bolt_x1'] = W - t - 1.0                          # bolt tip near right wall
    g['bolt_x0'] = g['bolt_x1'] - g['lk_proj']         # bolt root
    g['lk_x1']   = g['bolt_x0']                         # body right end
    g['lk_x0']   = g['lk_x1'] - g['lk_len']            # body left end
    g['foot_x0'] = g['lk_x0'] - (g['foot_l'] - g['lk_len']) / 2.0
    g['foot_x1'] = g['foot_x0'] + g['foot_l']
    g['strk_x1'] = W - t + 1.0                          # striker ring into wall
    g['strk_x0'] = g['strk_x1'] - 5.0
    return g


def add_body(m, g):
    W,H,D,t = g['W'],g['H'],g['D'],g['t']
    m.box(0,   D-t, 0,   W, D, H)     # back
    m.box(0,   0,   0,   t, D, H)     # left
    m.box(W-t, 0,   0,   W, D, H)     # right
    m.box(0,   0,   0,   W, D, t)     # bottom
    m.box(0,   0,   H-t, W, D, H)     # top
    add_striker(m, g)                  # striker ring on the frame right wall
    add_hinge_barrels(m, g, owner='body')


def add_lock_mount(m, g):
    """Solid mounting PAD on the door inner face, sized to the full L-bracket
    footprint (foot_l x foot_w). Lay the bracket on it and self-tap M3 screws
    through the bracket's slots wherever they land - the slots give tolerance,
    and the 5 mm solid pad holds the threads. No need for exact slot spacing."""
    px0 = g['foot_x0'] - 1; px1 = g['foot_x1'] + 1
    py0 = g['door_y1'] - 3                 # overlap into the door panel for a solid joint
    py1 = g['foot_y1'] + 1
    pz1 = g['shelf_z']; pz0 = pz1 - 5.0    # 5 mm solid pad (enough for self-tap screws)
    m.box(px0, py0, pz0, px1, py1, pz1)    # the mounting pad
    # two side gussets bracing the cantilevered pad to the door panel
    for x in (px0, px1 - 3):
        m.box(x, g['door_y1'] - 1, g['door_z0'], x + 3, py1, pz0 + 2)


def add_door(m, g):
    dx0,dx1,dz0,dz1 = g['door_x0'],g['door_x1'],g['door_z0'],g['door_z1']
    dy0,dy1 = g['door_y0'],g['door_y1']
    W,H,door_t = g['W'],g['H'],g['door_t']
    m.box(dx0, dy0, dz0, dx1, dy1, dz1)                       # panel
    # raised frame
    fr=max(4.0, W*0.06); bz=2.0; fy1=dy0; fy0=dy0-bz
    m.box(dx0,    fy0, dz0,    dx1,    fy1, dz0+fr)
    m.box(dx0,    fy0, dz1-fr, dx1,    fy1, dz1)
    m.box(dx0,    fy0, dz0,    dx0+fr, fy1, dz1)
    m.box(dx1-fr, fy0, dz0,    dx1,    fy1, dz1)
    # QR plaque
    q=min(W,H)*0.34; qx0=(W-q)/2; qx1=qx0+q
    qz1=dz1-fr-4; qz0=qz1-q
    m.box(qx0, dy0-2.5, qz0, qx1, dy0, qz1)
    # handle bar near latch edge
    hw=max(6.0,W*0.05); hx1=dx1-fr-4; hx0=hx1-hw
    m.box(hx0, dy0-8.0, H*0.30, hx1, dy0, H*0.55)
    # Solenoid mount on the DOOR (latch side): shelf + self-tap posts.
    add_lock_mount(m, g)
    add_hinge_barrels(m, g, owner='door')


def add_striker(m, g):
    """Striker ring (square hole) on the FRAME right wall. The door-mounted
    bolt fires +X into this hole. Built additively as 4 bars (no CSG)."""
    cy, cz = g['bolt_cy'], g['bolt_cz']
    bolt = g['lk_bolt']
    clr = 1.5                       # clearance so the bolt slides in
    hy0, hy1 = cy - bolt/2 - clr, cy + bolt/2 + clr   # hole opening (Y)
    hz0, hz1 = cz - bolt/2 - clr, cz + bolt/2 + clr   # hole opening (Z)
    ry0, ry1 = hy0 - 5, hy1 + 5     # ring outer (Y)
    rz0, rz1 = hz0 - 5, hz1 + 5     # ring outer (Z)
    rx0, rx1 = g['strk_x0'], g['strk_x1']             # ring thickness (X), rx1 into wall
    m.box(rx0, ry0, rz0, rx1, hy0, rz1)   # bottom bar (low Y)
    m.box(rx0, hy1, rz0, rx1, ry1, rz1)   # top bar (high Y)
    m.box(rx0, hy0, rz0, rx1, hy1, hz0)   # near-Z bar
    m.box(rx0, hy0, hz1, rx1, hy1, rz1)   # far-Z bar
    # rx1 sits inside the wall, so the ring is fused to the frame directly.


def add_dummy_lock(m, g):
    """Solid stand-in for the real solenoid - PREVIEW ONLY (not a printed part).
    Body lies along X, bolt fires +X toward the door striker."""
    z0 = g['shelf_z']; z1 = z0 + g['lk_h']
    m.box(g['lk_x0'], g['lk_y0'], z0, g['lk_x1'], g['lk_y1'], z1)   # body
    # bolt projecting +X toward the striker
    bw = g['lk_bolt']; cy = g['bolt_cy']; bz = g['bolt_cz']
    m.box(g['bolt_x0'], cy-bw/2, bz-bw/2, g['bolt_x1'], cy+bw/2, bz+bw/2)


def add_hinge_barrels(m, g, owner):
    """Interleaving knuckles. body owns even index, door owns odd index."""
    n=g['knuckles']; z0=g['k_z0']; z1=g['k_z1']
    seg_h=(z1-z0)/n
    for i in range(n):
        is_body = (i % 2 == 0)
        if (owner=='body') != is_body:
            continue
        kz0=z0+i*seg_h + g['ax_gap']/2
        kz1=z0+(i+1)*seg_h - g['ax_gap']/2
        m.tube_z(g['ax'], g['ay'], kz0, kz1, g['r_out'], g['r_in'], seg=g['seg'])
        # web tying the barrel to its parent
        if owner=='body':
            m.box(0, g['ay']-1.5, kz0, g['t']+1, 0.0, kz1)            # barrel -> left wall
        else:
            m.box(g['door_x0'], g['door_y0'], kz0, g['ax']+3, g['door_y1'], kz1)  # -> door panel


def make_pin(g):
    m=Mesh()
    z0=g['k_z0']-2; z1=g['k_z1']+2
    m.cylinder_z(g['ax'], g['ay'], z0, z1, r=g['pin_r'], seg=24)
    # small top knob so it doesn't fall through
    m.cylinder_z(g['ax'], g['ay'], z1, z1+2, r=g['pin_r']+1.5, seg=24)
    return m


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--w", type=float, default=150.0)  # wide enough for sideways lock body
    ap.add_argument("--h", type=float, default=120.0)
    ap.add_argument("--d", type=float, default=150.0)
    ap.add_argument("--t", type=float, default=3.0)
    ap.add_argument("--door", type=float, default=4.0)
    ap.add_argument("--gap", type=float, default=1.0)
    ap.add_argument("--hinge-gap", type=float, default=1.2)
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--prefix", default="locker")
    a=ap.parse_args()
    s=a.scale
    g=geom(a.w*s, a.h*s, a.d*s, a.t*s, a.door*s, a.gap*s, a.__dict__['hinge_gap']*s)

    body=Mesh(); add_body(body, g);  body.write_stl(f"{a.prefix}_body.stl", "body")
    door=Mesh(); add_door(door, g);  door.write_stl(f"{a.prefix}_door.stl", "door")
    pin =make_pin(g);                pin.write_stl(f"{a.prefix}_pin.stl",  "pin")

    asm=Mesh(); asm.extend(body); asm.extend(door); asm.extend(pin)
    add_dummy_lock(asm, g)
    asm.write_stl(f"{a.prefix}_assembled.stl", "assembled")

    print(f"size: {g['W']:.0f} x {g['H']:.0f} x {g['D']:.0f} mm (W x H x D)")
    print(f"  {a.prefix}_body.stl      {len(body.tris)} tris")
    print(f"  {a.prefix}_door.stl      {len(door.tris)} tris")
    print(f"  {a.prefix}_pin.stl       {len(pin.tris)} tris  (or use a 3 mm rod)")
    print(f"  {a.prefix}_assembled.stl {len(asm.tris)} tris  (preview only)")


if __name__ == "__main__":
    main()
