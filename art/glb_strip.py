# Drops animation channels for bones the clips never move from a GLB, and repacks its buffer without their data.
#
#   python3 art/glb_strip.py public/models/lou-gnar.glb
#
# The exporter samples every bone in every action. The Spring bones (hair, scarf: src/render/springs.ts) are swung by
# the game, never keyed, so their samples are just the rest pose repeated in every clip.
import json
import struct
import sys

PREFIX = 'Spring'


def strip(path, prefix=PREFIX):
    data = open(path, 'rb').read()
    magic, version, _ = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, 'not a GLB'
    jlen, _ = struct.unpack_from('<II', data, 12)
    gltf = json.loads(data[20:20 + jlen])
    blen, _ = struct.unpack_from('<II', data, 20 + jlen)
    bin_ = data[28 + jlen:28 + jlen + blen]
    nodes = gltf['nodes']
    dropped = 0
    for anim in gltf.get('animations', []):
        keep = [c for c in anim['channels'] if not nodes[c['target']['node']].get('name', '').startswith(prefix)]
        dropped += len(anim['channels']) - len(keep)
        used = sorted({c['sampler'] for c in keep})
        remap = {old: new for new, old in enumerate(used)}
        anim['samplers'] = [anim['samplers'][i] for i in used]
        for c in keep:
            c['sampler'] = remap[c['sampler']]
        anim['channels'] = keep
    # the accessors still in use, and the buffer views under them
    acc_used = set()

    def walk(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('indices', 'inverseBindMatrices', 'input', 'output') and isinstance(v, int):
                    acc_used.add(v)
                elif k == 'attributes':
                    acc_used.update(v.values())
                else:
                    walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)

    for key in ('meshes', 'skins', 'animations'):
        walk(gltf.get(key, []))
    acc_order = sorted(acc_used)
    acc_map = {old: new for new, old in enumerate(acc_order)}
    views_used = sorted({gltf['accessors'][a]['bufferView'] for a in acc_order if 'bufferView' in gltf['accessors'][a]})
    for img in gltf.get('images', []):
        if 'bufferView' in img:
            views_used.append(img['bufferView'])
    views_used = sorted(set(views_used))
    view_map = {}
    out = bytearray()
    views = []
    for old in views_used:
        v = dict(gltf['bufferViews'][old])
        chunk = bin_[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
        out += b'\0' * (-len(out) % 4)
        v['byteOffset'] = len(out)
        out += chunk
        view_map[old] = len(views)
        views.append(v)
    out += b'\0' * (-len(out) % 4)
    accessors = []
    for old in acc_order:
        a = dict(gltf['accessors'][old])
        if 'bufferView' in a:
            a['bufferView'] = view_map[a['bufferView']]
        accessors.append(a)

    def remap_acc(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k in ('indices', 'inverseBindMatrices', 'input', 'output') and isinstance(v, int):
                    o[k] = acc_map[v]
                elif k == 'attributes':
                    o[k] = {n: acc_map[i] for n, i in v.items()}
                else:
                    remap_acc(v)
        elif isinstance(o, list):
            for v in o:
                remap_acc(v)

    for key in ('meshes', 'skins', 'animations'):
        remap_acc(gltf.get(key, []))
    for img in gltf.get('images', []):
        if 'bufferView' in img:
            img['bufferView'] = view_map[img['bufferView']]
    gltf['accessors'] = accessors
    gltf['bufferViews'] = views
    gltf['buffers'] = [{'byteLength': len(out)}]
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out))
    glb += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
    open(path, 'wb').write(glb)
    return dropped, len(data), len(glb)


if __name__ == '__main__':
    for p in sys.argv[1:]:
        dropped, before, after = strip(p)
        print(f'{p}: dropped {dropped} channels, {before} -> {after} bytes')
