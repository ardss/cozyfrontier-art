import json, os, urllib.parse

SPECS = [
    ("Fantasy Town Kit（建筑模块）", "assets/Models/GLB format"),
    ("Food Kit（作物与食物）", "assets/food-kit/Models/GLB format"),
    ("Mini Market（温馨市场）", "assets/mini-market/Models/GLB format"),
    ("Mini Forest（迷你森林）", "assets/mini-forest/Models/GLB format"),
    ("Survival Kit（中世纪生存）", "assets/survival-kit/Models/GLB format"),
    ("Modular Buildings（模块建筑）", "assets/modular-buildings/Models/GLB format"),
    ("Animated Characters（动画角色）", "assets/animated-characters-retro/Models/GLB format"),
    ("Blocky Characters（方块角色）", "assets/blocky-characters/Models/GLB format"),
    ("Castle Kit（城堡）", "assets/castle-kit/Models/GLB format"),
    ("Pirate Kit（海盗航海）", "assets/pirate-kit/Models/GLB format"),
    ("Holiday Kit（节日）", "assets/holiday-kit/Models/GLB format"),
    ("Mini Characters（迷你角色）", "assets/mini-characters/Models/GLB format"),
    ("Tower Defense Kit（塔防建筑）", "assets/tower-defense-kit/Models/GLB format"),
    ("Watercraft（船只）", "assets/watercraft-kit/Models/GLB format"),
    ("Quaternius Farm Buildings（农场建筑·更精致）", "assets/quaternius/farmbuildings/OBJ"),
    ("Quaternius Stylized Nature MegaKit（吉卜力风自然·116件）", "assets/quaternius/nature-megakit/glTF"),
]

def find_glb_dir(root):
    for r, d, fs in os.walk(root):
        if any(f.lower().endswith('.glb') for f in fs):
            return r
    return None

packs = []
for name, base in SPECS:
    if not os.path.isdir(base):
        root = base.split('/')[1]
        if not os.path.isdir(root):
            continue
        base = find_glb_dir(root)
        if not base:
            continue
    files = []
    for r, d, fs in os.walk(base):
        for f in fs:
            if f.lower().endswith(('.glb', '.obj', '.gltf')):
                rel = os.path.relpath(os.path.join(r, f), base).replace(os.sep, '/')
                files.append(rel)
    files.sort()
    if files:
        packs.append({"name": f"{name}（{len(files)}件）", "base": urllib.parse.quote(base) + '/', "files": files})
json.dump(packs, open('manifest.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('manifest:', [(p['name'], len(p['files'])) for p in packs])
