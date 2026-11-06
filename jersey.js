// Hand-authored garment surfaces follow the silhouette of the CLAV concept drawing.
// Dimensions use centimeters. Individual fabric panels and brand details remain editable.
const PI = Math.PI;
const charcoal = '#292e30';
const stitch = '#5a6060';
const lime = '#b5d932';
const cream = '#f3e8cb';
const mesh = () => ({ positions: [], indices: [], uvs: [] });

function patch(g, rows, columns, sample) {
  const offset = g.positions.length / 3;
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= columns; col++) {
      const u = col / columns, v = row / rows;
      g.positions.push(...sample(u, v));
      g.uvs.push(u, v);
      if (row === rows || col === columns) continue;
      const a = offset + row * (columns + 1) + col;
      g.indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
    }
  }
}

function component(name, color, g) {
  const mins = [Infinity, Infinity, Infinity], maxs = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < g.positions.length; i++) {
    const axis = i % 3;
    mins[axis] = Math.min(mins[axis], g.positions[i]);
    maxs[axis] = Math.max(maxs[axis], g.positions[i]);
  }
  const position = mins.map((n, k) => (n + maxs[k]) / 2);
  const scale = mins.map((n, k) => Math.max(.01, maxs[k] - n));
  g.positions = g.positions.map((n,i) => +((n - position[i % 3]) / scale[i % 3]).toFixed(6));
  return { id: name.toLowerCase().replace(/[^a-z0-9]+/g,'-'), name, shape:'custom',
    color, position, rotation:[0,0,0], scale, geometry:g, roughness:.88, metalness:0, opacity:1 };
}

const levels = [[1.2,20,8],[5,19.8,7.7],[25,17.6,7.5],[36,18,7.9],
  [44,19,9.3],[53,21.3,11.3],[61.5,22.5,9.5],[64,21.8,8.8],[66,16,8],[69.2,10.7,7.0]];
function section(y) {
  let i=1;
  while (i < levels.length-1 && levels[i][0]<y) i++;
  const a=levels[i-1], b=levels[i], t=Math.max(0, Math.min(1,(y-a[0])/(b[0]-a[0])));
  return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t];
}
function front(x,y) {
  // The front neckline dips below the back. Invert that dip to place details on the fabric.
  let ringY=y;
  for(let k=0;k<8;k++) {
    const [w]=section(ringY);
    const cosSquared=Math.max(0,1-(x/w)**2);
    ringY=y + Math.max(0,(ringY-63)/6.2)*5.2*cosSquared;
  }
  const [w,d] = section(ringY);
  return d*Math.sqrt(Math.max(.001,1-(x/w)**2));
}
function hemDrop(x) { return 1.2 * Math.max(0, 1 - (x/20)**2); }
function ringPoint(angle,y,offset=0) {
  const [w,d] = section(y);
  const x=(w+offset)*Math.sin(angle);
  const c=Math.cos(angle);
  const collarDip=Math.max(0,(y-63)/6.2)*5.2*Math.max(c,0)**2;
  const hemDip=Math.max(0,(5-y)/3.8)*hemDrop(x);
  return [x,y-hemDip-collarDip,(d+offset)*c];
}
function torso() {
  const g=mesh();
  patch(g, (levels.length-1)*3, 72, (u,v)=>{
    const at=v*(levels.length-1), i=Math.min(Math.floor(at),levels.length-2);
    const y=levels[i][0]+(levels[i+1][0]-levels[i][0])*(at-i);
    return ringPoint((u*2+1)*PI,y);
  });
  return component('Compression body',charcoal,g);
}
function band(name,y1,y2,offset,color) {
  const g=mesh();
  patch(g,3,64,(u,v)=>ringPoint(u*2*PI,y1+(y2-y1)*v,offset));
  return component(name,color,g);
}
function sleeve(side, name) {
  // The opening plane tilts with the sleeve instead of cutting straight across the arm.
  const sample=(u,v,offset=0)=>{
    const a=u*2*PI, c=Math.cos(a), s=Math.sin(a);
    const width=9.6-.9*v+offset, depth=8.55-.6*v+offset;
    const shoulderLift=1.2*Math.sin(PI*v)*(1-v);
    return [side*(14.8+16.05*v+.75*width*s),
      57.8-14.8*v+.66*width*s+shoulderLift,depth*c];
  };
  const body=mesh(), cuff=mesh(), seam=mesh();
  // Reverse parameter direction to keep the exterior winding consistent for either sleeve.
  const winding = (u) => side===1 ? 1-u : u;
  patch(body,8,40,(u,v)=>sample(winding(u),v));
  patch(cuff,2,40,(u,v)=>sample(winding(u),.925+v*.075,.08));
  patch(seam,1,40,(u,v)=>sample(winding(u),.942+v*.009,.11));
  return [component(name+' sleeve',charcoal,body),component(name+' cuff','#303638',cuff),
    component(name+' cuff stitch',stitch,seam)];
}
function piping(side,name) {
  const g=mesh();
  patch(g,44,1,(u,v)=>{
    const y=2+v*59, x=side*(14.3-.9*Math.sin(PI*v)+7*Math.max(0,(v-.52)/.48)**2)+(u-.5)*.19;
    return [x,y,front(x,y)+.12];
  });
  return component(name+' contour seam',stitch,g);
}
function pad(side,name) {
  const g=mesh(), lines=mesh();
  function point(s,v,offset) {
    const x=side*(4.3+s*12.1);
    const y=60.3+2.05*Math.sin(s*PI*.72)+(v-.5)*(4.45+.45*Math.sin(s*PI));
    return [x,y,front(x,y)+offset+.4*Math.sin(PI*v)*Math.sin(PI*s)];
  }
  patch(g,9,22,(u,v)=>point(side===1?u:1-u,v,.32));
  for (const s of [.22,.46,.69,.88]) {
    patch(lines,9,1,(u,v)=>point(s+(side===1?u:1-u)*.011+.08*(v-.5),v,.39));
  }
  return [component(name+' clavicle pad',lime,g),component(name+' pad channels','#859536',lines)];
}
function wordmark() {
  const g=mesh(), strokes={
    C:[[[.81,.85],[.65,1],[.27,1],[.06,.77],[.03,.28],[.23,.04],[.65,0],[.83,.16]]],
    L:[[[.08,1],[.08,.04],[.81,.04]]],
    A:[[[0,.02],[.37,1],[.49,1],[.86,.02]],[[.17,.36],[.72,.36]]],
    V:[[[0,1],[.38,.02],[.47,.02],[.86,1]]]
  };
  const letterHeight=2.1;
  [...'CLAV'].forEach((ch,i)=>{
    for (const polyline of strokes[ch]) for (let n=1;n<polyline.length;n++) {
      const a=polyline[n-1],b=polyline[n],dx=b[0]-a[0],dy=b[1]-a[1];
      const len=Math.hypot(dx,dy), nx=-dy/len, ny=dx/len;
      patch(g,1,1,(u,v)=>{
        const x=-5.2+2.9*i + letterHeight*(a[0]+dx*u)+nx*(v-.5)*.34;
        const y=45.5+letterHeight*(a[1]+dy*u)+ny*(v-.5)*.34;
        return [x,y,front(x,y)+.17];
      });
    }
  });
  return component('CLAV chest wordmark',cream,g);
}
function vents() {
  const g=mesh();
  for(let row=0;row<23;row++) for(let col=-8;col<=8;col++) {
    const x=col*1.55 + (row%2)*.26, y=3.2+row*1.56;
    if(Math.abs(x)>12.7+.7*Math.cos(row/22*PI)) continue;
    patch(g,1,6,(u,v)=>{
      const angle=u*2*PI, px=x+Math.sin(angle)*.093*v, py=y+Math.cos(angle)*.13*v;
      return [px,py,front(px,py)+.10];
    });
  }
  return component('Ventilation dot panel','#697172',g);
}
export const jersey = {
  name:'CLAV compression jersey', type:'Athletic apparel',
  description:'A charcoal short-sleeve compression jersey with lime segmented clavicle pads, a cream chest wordmark and a ventilated front panel.',
  parts:[torso(), ...sleeve(-1,'Left'),...sleeve(1,'Right'),
    band('Neck binding',68.1,69.2,.15,'#1f2528'),band('Neck stitch',68.11,68.23,.21,stitch),
    band('Bottom binding',1.2,2.7,.10,'#252a2d'),band('Hem stitch',2.38,2.5,.16,stitch),
    piping(-1,'Left'),piping(1,'Right'),...pad(-1,'Left'),...pad(1,'Right'),wordmark(),vents()],
  references:[], background:'#deddd4', lighting:'studio', grid:true, axes:false
};
