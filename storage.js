import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { zipSync, unzipSync, strToU8 } from 'fflate';

export const HANDOFF_NAME = 'Venture_3D_Confirmed_Handoff.zip';
const DB_NAME = 'venture-3d-studio';
const STORE = 'projects';
const filenames = Object.freeze({
  model: 'model.glb', manifest: 'model-manifest.json', project: 'project.json',
  preview: 'preview.png', instructions: 'README.txt',
});

async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(new Error('Browser storage could not open. Download a project backup and try again.'));
    request.onsuccess = () => resolve(request.result);
  });
}

async function transact(mode, operation) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = operation(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result ?? null);
      tx.onabort = () => reject(new Error('Browser storage could not finish saving. Check available space and download a project backup.'));
      tx.onerror = () => reject(tx.error || new Error('Browser storage failed.'));
    });
  } finally {
    db.close();
  }
}

export function save(project) {
  const snapshot = structuredClone(project);
  return transact('readwrite', store => store.put(snapshot, 'editable'));
}

export function restore() {
  return transact('readonly', store => store.get('editable'));
}

export function restoreConfirmed() {
  return transact('readonly', store => store.get('confirmed'));
}

export function backup(project) {
  return new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Reject external dependencies before GLTFLoader has a chance to fetch them.
function inspectContainer(bytes) {
  if (bytes.length < 20) throw new Error('The exported GLB is empty or truncated.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== bytes.length || view.getUint32(16, true) !== 0x4e4f534a) {
    throw new Error('The exporter produced an invalid GLB 2.0 file.');
  }
  const jsonSize = view.getUint32(12, true);
  if (jsonSize > bytes.length - 20) throw new Error('The model metadata was truncated.');
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonSize)));
  for (const item of [...(json.buffers || []), ...(json.images || [])]) {
    if (item.uri && !item.uri.startsWith('data:')) throw new Error('The model contains an external asset. Reapply its texture and confirm again.');
  }
  return json;
}

function releaseScene(scene) {
  const disposables = new Set();
  scene.traverse(object => {
    if (object.geometry) disposables.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials.filter(Boolean)) {
      disposables.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) disposables.add(value);
    }
  });
  for (const item of disposables) {
    item.source?.data?.close?.();
    item.dispose();
  }
}

async function verifyModel(bytes, project) {
  const json = inspectContainer(bytes);
  if (project.parts.some(part => part.texture) && !json.images?.length) {
    throw new Error('The exported model is missing its applied texture. Reapply the image and try again.');
  }
  const loaded = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  try {
    let meshes = 0;
    let visibleMaterial = false;
    const texturedParts = new Set();
    loaded.scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      const position = mesh.geometry?.attributes?.position;
      const count = mesh.geometry?.index?.count ?? position?.count ?? 0;
      if (!position || position.count < 3 || count < 3 || !mesh.material) {
        throw new Error('An exported component has incomplete geometry or material data.');
      }
      for (let i = 0; i < position.count; i++) {
        if (![position.getX(i), position.getY(i), position.getZ(i)].every(Number.isFinite)) {
          throw new Error('An exported component has invalid vertex positions.');
        }
      }
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      visibleMaterial ||= materials.some(material => material.visible && material.opacity > 0);
      if (materials.some(material => material.map)) {
        for (let node = mesh; node; node = node.parent) {
          if (node.userData.partId) texturedParts.add(node.userData.partId);
        }
      }
      meshes++;
    });
    if (!meshes) throw new Error('Add a 3D component before confirming.');
    if (!visibleMaterial) throw new Error('Every component is transparent. Increase opacity on at least one part.');
    const missingTexture = project.parts.find(part => part.texture && !texturedParts.has(part.id));
    if (missingTexture) throw new Error('The texture on ' + (missingTexture.name || 'a component') + ' did not survive export. Reapply it and try again.');
    const size = new Box3().setFromObject(loaded.scene, true).getSize(new Vector3());
    if (!size.toArray().every(Number.isFinite) || size.length() <= 0) throw new Error('The model has invalid dimensions.');
    return {width: size.x, height: size.y, depth: size.z, units: 'm'};
  } finally {
    releaseScene(loaded.scene);
  }
}

async function digest(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, '0')).join('');
}

const instructions = [
  'Venture 3D Studio | Mission 3 handoff',
  '',
  'Unzip this folder. Keep all five files together as your confirmed design record.',
  'Use model.glb as the 3D product asset on your Mission 3 website. Its materials and textures travel with it.',
  'Use preview.png as a poster while the model loads. Read model-manifest.json for camera, lighting and dimensions.',
  'The model uses glTF 2.0, meters and a Y-up coordinate system. The SHA-256 in the manifest verifies model.glb.',
  'To change editable parts, import project.json in Venture 3D Studio, edit, then confirm and download a new package.',
  'Publishing your Mission 3 website is a separate step.',
].join('\n');

export async function confirm(project, studio) {
  const snapshot = structuredClone(project);
  if (!snapshot.parts?.length) throw new Error('Add a 3D component before confirming your model.');
  const camera = studio.cameraInfo();
  const model = new Uint8Array(await studio.exportGLB());
  const dimensions = await verifyModel(model, snapshot);
  const previewURL = await studio.preview();
  if (!previewURL.startsWith('data:image/png;base64,')) throw new Error('The studio could not capture a PNG preview.');
  const preview = Uint8Array.from(atob(previewURL.split(',')[1]), c => c.charCodeAt(0));
  if (preview.length < 24 || new DataView(preview.buffer).getUint32(0) !== 0x89504e47) {
    throw new Error('The studio produced an invalid preview. Try again after the viewport renders.');
  }
  const manifest = {
    schemaVersion: '1.0.0',
    confirmationId: crypto.randomUUID(),
    confirmedAt: new Date().toISOString(),
    projectName: snapshot.name || 'Venture project',
    modelName: snapshot.modelName || snapshot.name || 'Venture model',
    modelType: snapshot.type || 'Custom',
    description: snapshot.description || '',
    dimensions, camera, background: snapshot.background, lighting: snapshot.lighting,
    hotspots: snapshot.hotspots || [],
    files: filenames,
    integrity: { algorithm: 'SHA-256', file: filenames.model, hex: await digest(model) },
  };
  const files = {
    [filenames.model]: model,
    [filenames.preview]: preview,
    [filenames.project]: strToU8(JSON.stringify(snapshot, null, 2)),
    [filenames.manifest]: strToU8(JSON.stringify(manifest, null, 2)),
    [filenames.instructions]: strToU8(instructions),
  };
  const archive = zipSync(files, { level: 3 });
  const reopened = unzipSync(archive);
  for (const [name, original] of Object.entries(files)) {
    if (!reopened[name] || reopened[name].length !== original.length ||
        !reopened[name].every((byte, index) => byte === original[index])) {
      throw new Error('The handoff archive failed verification. Please try confirming again.');
    }
  }
  const zip = new Blob([archive], { type: 'application/zip' });
  await transact('readwrite', store => store.put({ project: snapshot, manifest, zip }, 'confirmed'));
  return zip;
}
