import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const geometries = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  cylinder: () => new THREE.CylinderGeometry(.5, .5, 1, 64),
  cone: () => new THREE.ConeGeometry(.5, 1, 64),
  sphere: () => new THREE.SphereGeometry(.5, 48, 32),
  torus: () => new THREE.TorusGeometry(.38, .12, 24, 72).scale(1, 1, 1 / .24)
};
const directions = { front:[0,0,1], side:[1,0,0], top:[0,1,.0001], iso:[1,.65,1.45], apparel:[.33,.16,1] };
const deg = THREE.MathUtils.radToDeg, rad = THREE.MathUtils.degToRad;
const rounded = v => v.map(n => Math.round(n * 100000) / 100000);
const encode = data => {
  const bytes = new Uint8Array(data);
  let str = '';
  for(let i=0;i<bytes.length;i+=16384) str += String.fromCharCode(...bytes.subarray(i,i+16384));
  return 'data:model/gltf-binary;base64,' + btoa(str);
};
const decode = uri => Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)), c=>c.charCodeAt(0)).buffer;
function inspectBinary(buffer) {
  const view = new DataView(buffer);
  if(buffer.byteLength<20 || view.getUint32(0,true)!==0x46546c67 || view.getUint32(4,true)!==2 ||
     view.getUint32(8,true)!==buffer.byteLength || view.getUint32(16,true)!==0x4e4f534a)
    throw new Error('Choose a complete GLB 2.0 file.');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,view.getUint32(12,true))));
  if ([...(json.buffers||[]),...(json.images||[])].some(a=>a.uri && !a.uri.startsWith('data:')))
    throw new Error('The model refers to external assets. Embed them in the GLB first.');
}
function release(group) {
  group.traverse(o=>{
    o.geometry?.dispose();
    for(const m of [].concat(o.material || [])) {
      for(const value of Object.values(m)) if(value?.isTexture) value.dispose();
      m.dispose();
    }
  });
}
function environment() {
  // Softboxes give metallic surfaces broad, readable reflections.
  const cvs=document.createElement('canvas'); cvs.width=512; cvs.height=256;
  const c=cvs.getContext('2d'), grad=c.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,'#9da5b2'); grad.addColorStop(.5,'#c7cbd1'); grad.addColorStop(.53,'#5d626a'); grad.addColorStop(1,'#949ca8');
  c.fillStyle=grad; c.fillRect(0,0,512,256);
  c.fillStyle='#ffffff'; c.fillRect(50,30,62,89); c.fillRect(310,30,112,44);
  const texture = new THREE.CanvasTexture(cvs);
  texture.mapping=THREE.EquirectangularReflectionMapping; texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
function customGeometry(data) {
  const positions=data?.positions, indices=data?.indices;
  if(!Array.isArray(positions) || positions.length<9 || positions.length%3 || positions.some(n=>!Number.isFinite(n)) ||
    !Array.isArray(indices) || !indices.length || indices.length%3 || indices.some(i=>!Number.isInteger(i) || i<0 || i>=positions.length/3)) {
    throw new Error('The custom mesh contains invalid vertices or faces.');
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.setIndex(indices);
  if(data.uvs) geometry.setAttribute('uv',new THREE.Float32BufferAttribute(data.uvs,2));
  geometry.computeVertexNormals(); return geometry;
}
async function makePart(part) {
  const node = new THREE.Group();
  if(part.shape==='model') {
    const buffer=decode(part.source);
    inspectBinary(buffer);
    const model=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    model.scale.multiplyScalar(100);
    node.add(model);
  } else {
    const make=geometries[part.shape];
    if(!make && part.shape!=='custom') throw new Error('Unsupported shape: '+part.shape);
    const geom=part.shape==='custom'?customGeometry(part.geometry):make();
    node.add(new THREE.Mesh(geom, new THREE.MeshStandardMaterial({side:part.shape==='custom'?THREE.DoubleSide:THREE.FrontSide})));
  }
  let map=null;
  if(part.texture) {
    if(!/^data:image\//.test(part.texture)) throw new Error('Textures must be embedded images.');
    map=await new THREE.TextureLoader().loadAsync(part.texture);
    map.colorSpace=THREE.SRGBColorSpace; map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.repeat.setScalar(part.repeat ?? 1);
    if(part.shape==='model') map.flipY=false;
  }
  node.traverse(o=>{
    if(!o.isMesh) return;
    o.castShadow=o.receiveShadow=true;
    for(const mat of [].concat(o.material)) {
      if(part.color!=null) mat.color?.set(part.color);
      if(part.roughness!=null) mat.roughness=part.roughness;
      if(part.metalness!=null) mat.metalness=part.metalness;
      if(part.opacity!=null) {mat.opacity=part.opacity; mat.transparent=part.opacity<1;}
      if(map) mat.map=map;
    }
  });
  node.name=part.name; node.userData.partId=part.id;
  node.position.fromArray(part.position); node.rotation.set(...part.rotation.map(rad)); node.scale.fromArray(part.scale);
  return node;
}

export class Studio {
  constructor(element,onSelect=()=>{},onTransform=()=>{}) {
    this.element=element; this.onSelect=onSelect; this.onTransform=onTransform;
    this.scene=new THREE.Scene(); this.scene.environment=environment();
    this.model=new THREE.Group(); this.scene.add(this.model);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)); this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const canvas=this.renderer.domElement;
    Object.assign(canvas.style,{width:'100%',height:'100%',display:'block',touchAction:'none'});
    canvas.setAttribute('aria-label','Interactive 3D model. Drag to orbit, right-drag to pan, scroll to zoom.');
    element.append(canvas);
    this.persp=new THREE.PerspectiveCamera(36,1,.01,50000);
    this.ortho=new THREE.OrthographicCamera(-1,1,1,-1,.01,50000);
    this.camera=this.persp; this.camera.position.set(20,14,30);
    this.controls=new OrbitControls(this.camera,canvas); this.controls.enableDamping=true;
    this.controls.maxPolarAngle=Math.PI*.985;
    this.transform=new TransformControls(this.camera,canvas);
    this.gizmo=this.transform.getHelper?.() ?? this.transform; this.scene.add(this.gizmo);
    this.transform.setSize(.76);
    this.transform.addEventListener('dragging-changed',e=>{this.controls.enabled=!e.value; this.dragged=true;});
    this.transform.addEventListener('mouseUp',()=>{
      const n=this.transform.object;
      if(n) this.onTransform(n.userData.partId,{position:rounded(n.position.toArray()),rotation:rounded([n.rotation.x,n.rotation.y,n.rotation.z].map(deg)),scale:rounded(n.scale.toArray())});
    });
    this.hemi=new THREE.HemisphereLight(0xffffff,0x75808c,1.45);
    this.key=new THREE.DirectionalLight(0xfffaf2,3); this.key.castShadow=true;
    this.key.shadow.mapSize.set(2048,2048); this.key.shadow.bias=-.0003;
    this.scene.add(this.hemi,this.key,this.key.target);
    this.floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShadowMaterial({opacity:.14}));
    this.floor.rotation.x=-Math.PI/2; this.floor.receiveShadow=true; this.scene.add(this.floor);
    this.grid=new THREE.GridHelper(1,40,0xa3a6a1,0xb5b9b5);
    this.grid.material.transparent=true; this.grid.material.opacity=.32; this.scene.add(this.grid);
    this.axes=new THREE.AxesHelper(1); this.scene.add(this.axes);
    this.highlight=new THREE.BoxHelper(undefined,0x506eec); this.highlight.visible=false;
    this.highlight.material.depthTest=false; this.highlight.renderOrder=5; this.scene.add(this.highlight);
    const ray=new THREE.Raycaster(); let start;
    canvas.addEventListener('pointerdown',e=>{start=[e.clientX,e.clientY];this.dragged=false;},true);
    canvas.addEventListener('pointerup',e=>{
      if(!start || e.button!==0 || this.dragged || this.transform.axis || Math.hypot(start[0]-e.clientX,start[1]-e.clientY)>4) return;
      const r=canvas.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),this.camera);
      let hit=ray.intersectObjects(this.model.children,true)[0]?.object;
      while(hit && hit.parent!==this.model) hit=hit.parent;
      if(hit) this.onSelect(hit.userData.partId);
    });
    this.nodes=new Map(); this.serial=0; this.span=20; this.editMode='select';
    this.resize=new ResizeObserver(()=>this.layout()); this.resize.observe(element); this.layout();
    this.renderer.setAnimationLoop(()=>{
      this.controls.update();
      if(this.highlight.visible) this.highlight.update();
      this.renderer.render(this.scene,this.camera);
    });
  }
  layout() {
    const w=Math.max(1,this.element.clientWidth),h=Math.max(1,this.element.clientHeight);
    this.renderer.setSize(w,h,false); const aspect=w/h;
    this.persp.aspect=aspect; this.persp.updateProjectionMatrix();
    this.ortho.left=-this.span*aspect/2;this.ortho.right=-this.ortho.left;
    this.ortho.top=this.span/2;this.ortho.bottom=-this.ortho.top;this.ortho.updateProjectionMatrix();
  }
  async setProject(project) {
    const seq=++this.serial;
    // Reuse meshes on camera, light and selection changes.
    const prior=this.nodes;
    const prepared=await Promise.all(project.parts.map(async p=>{
      const signature=JSON.stringify(p), existing=prior.get(p.id);
      return existing?.signature===signature ? existing : {signature,node:await makePart(p)};
    }));
    if(seq!==this.serial) {
      for(const row of prepared) if(![...prior.values()].includes(row)) release(row.node);
      return;
    }
    const fit=!project.parts.some(p=>prior.has(p.id));
    this.transform.detach(); this.model.clear(); this.nodes=new Map();
    for(const row of prepared) {this.model.add(row.node);this.nodes.set(row.node.userData.partId,row);}
    for(const [id,row] of prior) if(this.nodes.get(id)!==row) release(row.node);
    this.scene.background=new THREE.Color(project.background || '#eef1eb');
    this.grid.visible=project.grid!==false; this.axes.visible=!!project.axes;
    const light=(project.lighting||'studio').toLowerCase();
    this.key.color.set(/warm|sun|gold/.test(light)?0xffc789:/cool|night/.test(light)?0xb4ceff:0xfffaf2);
    this.key.intensity=/soft|diffuse/.test(light)?1.5:3;
    this.hemi.intensity=/dramatic|contrast|night/.test(light)?.65:1.5;
    this.updateBounds(); this.select(this.activeId);
    if(fit) this.view(project.type==='Athletic apparel'?'apparel':'iso');
  }
  updateBounds() {
    const bounds=new THREE.Box3().setFromObject(this.model,true);
    if(bounds.isEmpty()) bounds.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2,1));
    this.center=bounds.getCenter(new THREE.Vector3()); this.size=bounds.getSize(new THREE.Vector3());
    const d=Math.max(this.size.length(),.01), y=bounds.min.y-d*.002;
    this.floor.scale.setScalar(d*16); this.floor.position.set(this.center.x,y,this.center.z);
    this.grid.scale.setScalar(d*4); this.grid.position.set(this.center.x,y+d*.0001,this.center.z);
    this.axes.scale.setScalar(d*.6); this.axes.position.set(0,y,0);
    this.key.position.copy(this.center).add(new THREE.Vector3(d,d*1.7,d*1.2));
    this.key.target.position.copy(this.center);
    const sc=this.key.shadow.camera; Object.assign(sc,{left:-d,right:d,top:d,bottom:-d,near:d*.01,far:d*6});sc.updateProjectionMatrix();
    this.controls.minDistance=d*.08;this.controls.maxDistance=d*18;
    for(const c of [this.persp,this.ortho]) {c.near=Math.max(.0001,d*.001);c.far=d*100;c.updateProjectionMatrix();}
  }
  select(id) {
    this.activeId=id; const n=this.nodes.get(id)?.node;
    this.highlight.visible=!!n;
    if(n) this.highlight.setFromObject(n);
    if(n && this.editMode!=='select') this.transform.attach(n); else this.transform.detach();
  }
  mode(mode) {
    this.editMode=['translate','rotate','scale'].includes(mode)?mode:'select';
    if(this.editMode!=='select') this.transform.setMode(this.editMode);
    this.select(this.activeId);
  }
  dimensions() {return rounded(new THREE.Box3().setFromObject(this.model,true).getSize(new THREE.Vector3()).toArray());}
  view(preset='iso') {
    if(!this.center)return;
    const direction=new THREE.Vector3(...(directions[preset] || directions.iso)).normalize();
    const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right);
    const tangent=Math.tan(rad(this.persp.fov/2)), aspect=this.persp.aspect;
    // Fit the projected corners so both tall garments and broad room scenes fill the viewport.
    let height=.01, dist=.01;
    for(const x of [-.5,.5]) for(const y of [-.5,.5]) for(const z of [-.5,.5]) {
      const corner=new THREE.Vector3(this.size.x*x,this.size.y*y,this.size.z*z);
      const extent=Math.max(Math.abs(corner.dot(up)),Math.abs(corner.dot(right))/aspect);
      height=Math.max(height,extent*2*1.22);
      dist=Math.max(dist,corner.dot(direction)+extent*1.22/tangent);
    }
    this.span=height;this.layout();
    this.controls.target.copy(this.center);this.camera.position.copy(this.center).addScaledVector(direction,dist);
    this.camera.zoom=1;this.camera.updateProjectionMatrix();this.controls.update();
  }
  projection(request) {
    const next=(request?request==='orthographic':this.camera===this.persp)?this.ortho:this.persp;
    if(next===this.camera)return;
    next.position.copy(this.camera.position);next.quaternion.copy(this.camera.quaternion);
    const delta=this.camera.position.clone().sub(this.controls.target), tangent=Math.tan(rad(this.persp.fov/2));
    if(next===this.ortho) {this.span=2*delta.length()*tangent;next.zoom=1;this.layout();}
    else next.position.copy(this.controls.target).addScaledVector(delta.normalize(),this.span/(2*this.ortho.zoom*tangent));
    this.camera=next;this.controls.object=next;this.transform.camera=next;this.controls.update();
  }
  cameraInfo() {
    return {projection:this.camera===this.persp?'perspective':'orthographic',position:rounded(this.camera.position.clone().multiplyScalar(.01).toArray()),
      target:rounded(this.controls.target.clone().multiplyScalar(.01).toArray()),zoom:this.camera.zoom,fov:this.persp.fov,orthographicHeight:this.span*.01/this.camera.zoom,units:'m'};
  }
  preview() {
    const helpers=[this.gizmo,this.highlight,this.axes,this.grid], states=helpers.map(o=>o.visible);
    helpers.forEach(o=>o.visible=false);
    try {this.renderer.render(this.scene,this.camera);return this.renderer.domElement.toDataURL('image/png');}
    finally {helpers.forEach((o,i)=>o.visible=states[i]);this.renderer.render(this.scene,this.camera);}
  }
  async exportGLB() {
    if(!this.nodes.size) throw new Error('Add a component before exporting.');
    const root=this.model.clone();root.name='Venture model';root.scale.setScalar(.01);
    for(const child of root.children) {
      const part=JSON.parse(this.nodes.get(child.userData.partId).signature);
      // Only primitive records need reconstruction metadata. Foreign meshes stay embedded.
      if(part.shape!=='model') child.userData.venturePrimitive=part;
    }
    root.updateMatrixWorld(true);
    return await new GLTFExporter().parseAsync(root,{binary:true,onlyVisible:true});
  }
  async importGLB(buffer) {
    inspectBinary(buffer);
    const scene=(await new GLTFLoader().parseAsync(buffer,'')).scene;
    try {
      let meshes=0; scene.traverse(o=>{if(o.isMesh && o.geometry?.attributes.position?.count)meshes++;});
      if(!meshes) throw new Error('The GLB has no mesh geometry.');
      const root=scene.children[0], children=root?.children;
      if(scene.children.length===1 && root.name==='Venture_model' && children?.length &&
        children.every(n=>n.userData.venturePrimitive && (geometries[n.userData.venturePrimitive.shape] || n.userData.venturePrimitive.shape==='custom'))) {
        return children.map(n=>({...n.userData.venturePrimitive,id:crypto.randomUUID()}));
      }
      return [{id:crypto.randomUUID(),name:root?.name || 'Imported model',shape:'model',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],source:encode(buffer)}];
    } finally {release(scene);}
  }
}
