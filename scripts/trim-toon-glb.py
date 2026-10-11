"""Keep only the color texture and mesh data used by the game's toon shader."""

import copy
import json
import struct
import sys
from pathlib import Path


def chunk(kind, data, pad):
    data += pad * (-len(data) % 4)
    return struct.pack('<II', len(data), kind) + data


def trim(path):
    raw = path.read_bytes()
    magic, version, _ = struct.unpack_from('<III', raw)
    if magic != 0x46546C67 or version != 2:
        raise ValueError(f'{path}: expected glTF 2.0 binary')
    json_length, json_type = struct.unpack_from('<II', raw, 12)
    if json_type != 0x4E4F534A:
        raise ValueError(f'{path}: missing JSON chunk')
    gltf = json.loads(raw[20:20 + json_length])
    bin_offset = 20 + json_length
    bin_length, bin_type = struct.unpack_from('<II', raw, bin_offset)
    if bin_type != 0x004E4942:
        raise ValueError(f'{path}: missing binary chunk')
    binary = raw[bin_offset + 8:bin_offset + 8 + bin_length]

    material = gltf['materials'][0]
    color_texture = material['pbrMetallicRoughness']['baseColorTexture']['index']
    color_image = gltf['textures'][color_texture]['source']
    color_view = gltf['images'][color_image]['bufferView']
    used_views = {color_view, *(accessor['bufferView'] for accessor in gltf['accessors'])}
    view_indices = {old: new for new, old in enumerate(sorted(used_views))}
    new_binary = bytearray()
    new_views = []
    for old in sorted(used_views):
        view = copy.deepcopy(gltf['bufferViews'][old])
        source = binary[view['byteOffset']:view['byteOffset'] + view['byteLength']]
        new_binary.extend(b'\0' * (-len(new_binary) % 4))
        view['byteOffset'] = len(new_binary)
        new_binary.extend(source)
        new_views.append(view)
    gltf['bufferViews'] = new_views
    for accessor in gltf['accessors']:
        accessor['bufferView'] = view_indices[accessor['bufferView']]
    gltf['images'] = [{**gltf['images'][color_image], 'bufferView': view_indices[color_view]}]
    gltf['textures'] = [{**gltf['textures'][color_texture], 'source': 0}]
    material.pop('normalTexture', None)
    material['pbrMetallicRoughness'].pop('metallicRoughnessTexture', None)
    material['pbrMetallicRoughness']['baseColorTexture']['index'] = 0
    gltf['buffers'][0]['byteLength'] = len(new_binary)
    output = chunk(0x4E4F534A, json.dumps(gltf, separators=(',', ':')).encode(), b' ')
    output += chunk(0x004E4942, bytes(new_binary), b'\0')
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, len(output) + 12) + output)


for filename in sys.argv[1:]:
    trim(Path(filename))
