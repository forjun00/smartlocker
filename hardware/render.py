#!/usr/bin/env python3
"""
Render an STL to a PNG using Blender (headless).

Usage (the '--' separates Blender's args from this script's args):
    blender --background --python render.py -- locker_assembled.stl out.png
    blender --background --python render.py -- locker_assembled.stl out.png 600

Third arg = square render resolution in pixels (default 800).
"""
import bpy, sys, math
from mathutils import Vector

# ---- parse args after '--' ------------------------------------------------
argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
src = argv[0] if len(argv) > 0 else "locker_assembled.stl"
out = argv[1] if len(argv) > 1 else "render.png"
res = int(argv[2]) if len(argv) > 2 else 800

# ---- clean scene ----------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- import the STL -------------------------------------------------------
bpy.ops.wm.stl_import(filepath=src)
objs = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not objs:
    raise SystemExit("no mesh imported from " + src)

# combined bounding box (world space)
mins = Vector((1e9, 1e9, 1e9))
maxs = Vector((-1e9, -1e9, -1e9))
for o in objs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        mins = Vector(map(min, mins, w))
        maxs = Vector(map(max, maxs, w))
center = (mins + maxs) / 2
size = (maxs - mins).length

# ---- a soft clay material so the form reads clearly -----------------------
mat = bpy.data.materials.new("clay")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.55, 0.62, 0.78, 1.0)
bsdf.inputs["Roughness"].default_value = 0.55
for o in objs:
    o.data.materials.clear()
    o.data.materials.append(mat)

# ---- camera: 3/4 view looking at the center -------------------------------
cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
bpy.context.collection.objects.link(cam)
dirv = Vector((1.0, -1.2, 0.7)).normalized()
cam.location = center + dirv * size * 1.4
# point camera at center
look = (center - cam.location).normalized()
cam.rotation_euler = look.to_track_quat("-Z", "Y").to_euler()
bpy.context.scene.camera = cam

# ---- lighting -------------------------------------------------------------
key = bpy.data.objects.new("key", bpy.data.lights.new("key", "SUN"))
key.data.energy = 4.0
key.rotation_euler = (math.radians(50), math.radians(20), math.radians(40))
bpy.context.collection.objects.link(key)
world = bpy.data.worlds.new("w")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0  # ambient
bpy.context.scene.world = world

# ---- render settings ------------------------------------------------------
sc = bpy.context.scene
# pick whichever EEVEE id this Blender version exposes
engines = sc.render.bl_rna.properties["engine"].enum_items.keys()
sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
sc.render.resolution_x = res
sc.render.resolution_y = res
sc.render.film_transparent = True
sc.render.image_settings.file_format = "PNG"
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print("RENDERED", out, f"({res}x{res})  model ~{size:.0f} mm diagonal")
