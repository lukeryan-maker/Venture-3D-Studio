"""Build the static Pages artifact with only its required offline dependencies."""
from pathlib import Path
from shutil import copy2, copytree
root = Path(__file__).resolve().parent
dist = root / "dist"
files = ["index.html","app.js","style.css","engine.js","storage.js","jersey.js","templates.js","concept.png","GUIDE.md","HANDOFF.md","vendor/three/LICENSE","vendor/three/build/three.module.min.js","vendor/fflate/LICENSE","vendor/fflate/esm/browser.js"]
files += ["vendor/three/examples/jsm/"+f+".js" for f in ["controls/OrbitControls","controls/TransformControls","loaders/GLTFLoader","exporters/GLTFExporter","utils/BufferGeometryUtils"]]
for file in files:
    dest = dist / file
    dest.parent.mkdir(parents=True, exist_ok=True)
    copy2(root / file, dest)
copytree(root/"confirmed", dist/"confirmed",dirs_exist_ok=True)
(dist/".nojekyll").touch()
