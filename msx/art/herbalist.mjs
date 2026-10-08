// Original Village pixel artwork. Each glyph is an 8x8 SCREEN 2 tile.
// A row uses its foreground/background pair; no image quantization is involved.
// Approximate TMS9918 RGB preview only; emulator/hardware captures take precedence.
export const palette = ['000000','000000','21c842','5edc78','5455ed','7d76fc','d4524d','42ebf5','fc5554','ff7978','d4c154','e6ce80','21b03b','c95bba','cccccc','ffffff'];
export const tiles = [];
const glyph = (name, rows, fg, bg) => {
  if(rows.length!==8 || rows.some(r=>r.length!==8 || /[^.#]/.test(r))) throw Error(`Invalid glyph ${name}`);
  const colors = Array.from({length:8},(_,y)=>[(Array.isArray(fg)?fg[y]:fg),(Array.isArray(bg)?bg[y]:bg)]);
  if(colors.flat().some(c=>!Number.isInteger(c)||c<1||c>15)) throw Error(`Invalid color ${name}`);
  tiles.push({name,rows,colors}); return tiles.length-1;
};
const g=(n,s,f,b)=>glyph(n,s.split('/'),f,b);
const t={};
const add=(n,s,f,b)=>t[n]=g(n,s,f,b);
add('grass','......../......../......../......../......../......../......../........',2,2);
add('tuft','......../......../..#...../.#.#..../..#...../......../......../........',3,2);
add('path','......../...#..../......../......../......#./......../.#....../........',10,11);
add('cobble','.###.###/#...#.../#...#.../.###.###/##.###../..#...#./..#...#./##.###..',14,1);
add('water','......../.###..../......../......../.....##./......../......../........',7,4);
add('bank','########/.#.##.#./......../.##...../......../.....##./......../........',[2,2,7,7,7,7,7,7],[4,4,4,4,4,4,4,4]);
add('floor','......../......../..#...../......../......../......../......../########',6,10);
add('stone','########/#......#/#......#/.######./########/...#..../...#..../#######.',14,1);
add('wall','......../......../......../......../......../......../......../########',10,11);
add('beam','########/########/..#...../..#...../..#...../..#...../..#...../########',6,10);
add('roof','########/......../....#.../....#.../########/......../#......./#.......',6,8);
add('roofEdge','......../########/.######./########/#...#.../#..##..#/########/########',[2,6,8,6,8,8,6,1],[2,2,6,6,6,6,6,6]);
add('window','########/#..##..#/#..##..#/#..##..#/########/#..##..#/#..##..#/########',[6,7,7,7,6,11,11,6],[10,4,4,4,10,4,4,10]);
add('fence','..##..../..##..../########/..##..../..##..../########/..##..../..##....',10,2);
add('hedge','.######./###.####/##.###.#/####.###/#.######/###.##.#/########/.######.',3,12);
add('flower','......../..#..#../.###.##./..#..#../......../..#..#../..#.##../...##...',[3,11,11,11,2,3,3,3],2);
add('herbs','...#..../..###.../.#.#.#../...#..../.#.#.#../..###.../...#..../..###...',3,12);
add('soil','#......./....#.../..#...../......#./.#....../.....#../...#..../.......#',10,6);
add('rug','......../......../......../......../......../......../......../........',6,6);
add('dark','......../......../......../......../......../......../......../........',1,1);
// Leaf blocks reuse a handful of contours for trees at several scales.
add('leaf','..##..../.#####../########/##.###.#/###.####/.#######/###.###./.#####..',3,12);
add('leafL','......##/....####/...#####/..###.##/.#######/###.####/########/.#######',3,2);
add('leafR','##....../####..../#####.../##.###../#######./####.###/########/#######.',3,2);
add('leafBL','########/###.####/.#######/..######/...#####/....####/......##/........',12,2);
add('leafBR','########/####.###/#######./######../#####.../####..../##....../........',12,2);
add('trunkL','......##/.....###/.....#.#/.....###/....##.#/...###.#/..###..#/#####.##',6,2);
add('trunkR','##....../###...../#.#...../###...../#.##..../#.###.../#..###../##.#####',6,2);
add('pineTop','...##.../...##.../..####../..####../.######./.######./########/..####..',12,2);
add('pineL','.......#/......##/.....###/....####/...#####/..######/.#######/...#####',12,2);
add('pineR','#......./##....../###...../####..../#####.../######../#######./#####...',12,2);
add('fruit','..##..../.#####../########/##.##.##/########/.#######/###.###./.#####..',[3,3,3,8,3,3,3,3],12);
// Furniture tiles use colors by row so cloth, timber and metal remain distinct.
add('doorTL','.....###/...#####/..##..##/.##...##/##....##/##....##/##....##/##....##',10,1);
add('doorTR','###...../#####.../##..##../##...##./##....##/##....##/##....##/##....##',10,1);
add('doorBL','##....##/##....##/##....##/##....##/##....##/##....##/########/########',10,1);
add('doorBR','##....##/##....##/##.#..##/##....##/##....##/##....##/########/########',10,1);
add('bedTL','########/#....###/#....###/#....###/########/#......./#......./#.......',[6,15,15,15,6,7,7,7],[10,6,6,6,10,4,4,4]);
add('bedTR','########/###....#/###....#/###....#/########/.......#/.......#/.......#',[6,15,15,15,6,7,7,7],[10,6,6,6,10,4,4,4]);
add('bedBL','#......./#......./#......./#......./########/########/##....../##......',[7,7,7,7,6,10,6,6],[4,4,4,4,10,6,1,1]);
add('bedBR','.......#/.......#/.......#/.......#/########/########/......##/......##',[7,7,7,7,6,10,6,6],[4,4,4,4,10,6,1,1]);
add('tableTL','..######/.#######/##....../##....../##....../##....../##....../##......',10,6);
add('tableTR','######../#######./......##/......##/......##/......##/......##/......##',10,6);
add('tableBL','########/########/##..##../##..##../##....../##....../......../........',[10,6,10,10,6,6,6,6],[6,1,10,10,10,10,10,10]);
add('tableBR','########/########/..##..##/..##..##/......##/......##/......../........',[10,6,10,10,6,6,6,6],[6,1,10,10,10,10,10,10]);
add('shelf','########/#.#.##.#/#.#.##.#/#.#.##.#/########/#.##.#.#/#.##.#.#/########',[10,8,8,8,10,7,7,10],6);
add('bottles','......../..#..#../..#..#../.##.###./.##.###./.##.###./########/########',[6,7,7,7,7,7,10,6],1);
add('chair','##....##/########/##....##/########/########/##....##/##....##/........',10,6);
add('chest','..####../.######./########/########/###..###/###..###/########/.######.',10,6);
add('pot','..#..#../.######./..####../...##.../.######./..####../..####../...##...',[3,3,3,3,8,8,8,6],[2,2,2,2,6,6,6,2]);
add('wellTL','...#####/..######/.#######/########/##....../##....../##....../##......',[8,8,8,6,10,10,10,10],[6,6,6,1,2,2,2,2]);
add('wellTR','#####.../######../#######./########/......##/......##/......##/......##',[8,8,8,6,10,10,10,10],[6,6,6,1,2,2,2,2]);
add('wellBL','########/###...../########/#...#.../########/...#..../########/.#######',14,1);
add('wellBR','########/.....###/########/...#...#/########/....#.../########/#######.',14,1);
add('hearthL','########/#...#.../########/...#..../########/##....../##....../##......',14,1);
add('hearthR','########/...#...#/########/....#.../########/......##/......##/......##',14,1);
add('fireL','##....../##....#./##...##./##..###./##.####./##..###./########/########',[14,11,11,11,11,8,14,14],1);
add('fireR','......##/.#....##/.##...##/.###..##/.####.##/.###..##/########/########',[14,11,11,11,11,8,14,14],1);
add('shrineT','...##.../..####../.######./########/##....##/##.##.##/##.##.##/##....##',14,12);
add('shrineB','##.##.##/##.##.##/##.##.##/##....##/########/.######./########/########',14,12);
add('sign','########/#......#/#.###..#/#......#/########/...##.../...##.../...##...',10,6);

add('sand','......../......../......../...#..../......../......../......../........',10,11);
add('brick','########/....#.../....#.../########/#......./#......./#......./########',6,8);
add('bedML','#......./#......./#......./#......./#......./#......./#......./#.......',7,4);
add('bedMR','.......#/.......#/.......#/.......#/.......#/.......#/.......#/.......#',7,4);
add('tableMT','########/########/......../..##..../......../......../.....##./........',10,6);
add('tableMB','########/########/......../......../......../......../......../........',[10,6,6,6,6,6,6,6],[6,1,10,10,10,10,10,10]);
add('rugEdge','##....../##....../##....../##....../##....../##....../##....../##......',10,6);

// Trees are drawn as complete silhouettes, then split into native cells.
// Edge rows use leaf/grass; interior rows use light/shadow. This deliberately
// authors two-color rows rather than losing colors during export.
function tree(name,w,h,type){
 const lobes=type==='oak'?[[11,12,10,10],[23,10,11,9],[30,18,8,9],[17,21,12,9],[7,21,6,6]]:[[8,8,7,6],[15,8,7,7],[12,13,9,6]];
 const foliage=(x,y)=>{
  if(type==='pine')return [[4,7],[11,10],[18,12]].some(([top,radius])=>y>=top&&y<top+10&&Math.abs(x-(w-1)/2)<Math.min(radius,(y-top+1)*1.4));
  return lobes.some(([cx,cy,rx,ry])=>((x-cx)/rx)**2+((y-cy)/ry)**2<1);
 };
 return Array.from({length:h/8},(_,ty)=>Array.from({length:w/8},(_,tx)=>{
  const rows=[],fg=[],bg=[];
  for(let dy=0;dy<8;dy++){
   const y=ty*8+dy,mask=Array.from({length:8},(_,dx)=>foliage(tx*8+dx,y));
   if(mask.some(Boolean)){
    const full=mask.every(Boolean),fruit=type==='orchard'&&full&&[8,9,14,15].includes(y);
    const shade=(x)=>{if(type==='pine')return y%7>4||x>w/2+2;const [cx,cy,rx,ry]=lobes.reduce((a,b)=>((x-a[0])/a[2])**2+((y-a[1])/a[3])**2<((x-b[0])/b[2])**2+((y-b[1])/b[3])**2?a:b);return y>cy+ry*0.25 || x>cx+rx*0.65;};
    fg.push(fruit?8:full?3:(y<h*0.5?3:12));bg.push(full?12:2);
    rows.push(mask.map((v,dx)=>{const x=tx*8+dx;return v&&(!full||(fruit?([7,8,16,17].includes(x)):!shade(x)))?'#':'.';}).join(''));

   }else{
    fg.push(6);bg.push(2);rows.push(Array.from({length:8},(_,dx)=>{const x=tx*8+dx,spread=y>h-3?4:type==='oak'?3:1;return y>h-12&&Math.abs(x-w/2)<spread?'#':'.';}).join(''));
   }
  }
  const n=`${name}-${tx}-${ty}`;t[n]=glyph(n,rows,fg,bg);return n;
 }));
}
export const objects = [
 {name:'Old oak',category:'Woodland',solid:true,grid:tree('oak',40,40,'oak')},
 {name:'Pine',category:'Woodland',solid:true,grid:tree('pine',24,32,'pine')},
 {name:'Orchard tree',category:'Woodland',solid:true,grid:tree('orchard',24,24,'orchard')},
 {name:'House entrance',category:'Village',solid:false,grid:[['doorTL','doorTR'],['doorBL','doorBR']]},
 {name:'Well',category:'Village',solid:true,grid:[['wellTL','wellTR'],['wellBL','wellBR']]},
 {name:'Bed',category:'Interior',solid:true,grid:[['bedTL','bedTR'],['bedBL','bedBR']]},
 {name:'Table',category:'Interior',solid:true,grid:[['tableTL','tableTR'],['tableBL','tableBR']]},
 {name:'Traveler bed',category:'Interior',solid:true,grid:[['bedTL','bedTR'],['bedML','bedMR'],['bedBL','bedBR']]},
 {name:'Herbalist worktable',category:'Interior',solid:true,grid:[['tableTL','tableMT','tableTR'],['tableBL','tableMB','tableBR']]},
 {name:'Hearth',category:'Interior',solid:true,grid:[['hearthL','hearthR'],['fireL','fireR']]},
 {name:'Shrine',category:'Relics',solid:true,grid:[['shrineT'],['shrineB']]},
 {name:'Cottage roof',category:'Village',solid:true,grid:[Array(6).fill('roof'),Array(6).fill('roofEdge')]},
 {name:'Cottage wall',category:'Village',solid:true,grid:[['wall','wall'],['window','window'],['beam','beam']]},
];
const scene=(name,ground)=>({name,map:Array(768).fill(t[ground]),collision:Array(768).fill(ground==='dark'?1:0),placements:[]});
export const exterior=scene('Herbalist garden','grass');
export const interior=scene('Herbalist cottage','dark');
function put(s,x,y,name,solid=false){if(x<0||y<0||x>=32||y>=24||t[name]===undefined)throw Error(`Placement ${name}`);s.map[y*32+x]=t[name];s.collision[y*32+x]=+solid;}
function fill(s,x,y,w,h,name,solid=false){for(let j=0;j<h;j++)for(let i=0;i<w;i++)put(s,x+i,y+j,name,solid);}
function object(s,name,x,y){const o=objects.find(o=>o.name===name);o.grid.forEach((r,j)=>r.forEach((n,i)=>put(s,x+i,y+j,n,o.solid)));s.placements.push({name,x,y,width:o.grid[0].length,height:o.grid.length,solid:o.solid});}
for(let y=0;y<24;y++)for(let x=0;x<32;x++)if((x*13+y*7)%17===0)put(exterior,x,y,'tuft');
fill(exterior,0,21,32,3,'water',true);fill(exterior,0,20,32,1,'bank',true);
fill(exterior,14,10,3,14,'path');fill(exterior,8,13,18,2,'path');fill(exterior,14,20,3,4,'floor');
// A low, broad roof leaves room for trees and a clear entrance approach.
fill(exterior,10,3,12,4,'roof',true);fill(exterior,9,7,14,1,'roofEdge',true);
fill(exterior,10,8,12,4,'wall',true);fill(exterior,10,11,12,1,'beam',true);fill(exterior,10,8,1,3,'beam',true);fill(exterior,21,8,1,3,'beam',true);
fill(exterior,12,9,2,1,'window',true);fill(exterior,18,9,2,1,'window',true);
object(exterior,'House entrance',15,10);object(exterior,'Old oak',2,2);object(exterior,'Pine',26,2);object(exterior,'Orchard tree',25,9);
object(exterior,'Well',21,15);object(exterior,'Shrine',3,15);
fill(exterior,6,15,6,3,'soil');for(let y=15;y<18;y++)for(let x=6;x<12;x+=2)put(exterior,x,y,y%2?'herbs':'flower');
fill(exterior,5,18,8,1,'fence',true);put(exterior,5,15,'fence',true);put(exterior,12,15,'fence',true);
for(const [x,y] of [[8,10],[23,10],[26,16],[27,16],[4,8],[7,7]])put(exterior,x,y,'flower');
put(exterior,18,15,'sign',true);put(exterior,13,11,'pot',true);put(exterior,20,11,'pot',true);
fill(interior,4,3,24,17,'floor');fill(interior,4,3,24,2,'wall',true);fill(interior,4,5,24,1,'beam',true);
fill(interior,4,3,1,17,'stone',true);fill(interior,27,3,1,17,'stone',true);fill(interior,4,19,24,1,'stone',true);
fill(interior,6,6,5,2,'shelf',true);fill(interior,21,6,4,1,'bottles',true);fill(interior,21,7,4,1,'shelf',true);
object(interior,'Hearth',15,6);object(interior,'Traveler bed',7,13);object(interior,'Herbalist worktable',20,12);
fill(interior,12,11,6,5,'rug');fill(interior,12,11,1,5,'rugEdge');fill(interior,17,11,1,5,'rugEdge');put(interior,20,15,'chair',true);put(interior,23,12,'chair',true);
put(interior,10,15,'chest',true);put(interior,25,17,'pot',true);fill(interior,15,19,2,1,'floor');
export const scenes=[exterior,interior];
export const entrance={x:15,y:10,width:2,height:2};

// 16x16, two overlapping hardware sprites: warm face/trim + blue silhouette.
const front=['................','......BBBB......','.....BBBBBB.....','.....BYYYYB.....','.....YBYYBY.....','......YYYY......','.......YY.......','.....BBBBBB.....','....BBYBBYBB....','....YBBBBBBY....','....YBBBBBBY....','.....BBBBBB.....','.....BBBBBB.....','.....BB..BB.....','.....BB..BB.....','................'];
const back=['................','......BBBB......','.....BBBBBB.....','.....BBBBBB.....','.....BBBBBB.....','......BBBB......','.......YY.......','.....BBBBBB.....','....BBBBBBBB....','....YBBYYBBY....','....YBBYYBBY....','.....BBBBBB.....','.....BBBBBB.....','.....BB..BB.....','.....BB..BB.....','................'];
const left=['................','......BBBB......','.....BBBBBB.....','....YYYYBBB.....','....YBYYBBB.....','.....YYYBB......','......YY........','.....BBBBB......','....BBBBBBB.....','....BBYBBBB.....','....BBYBBBB.....','.....BBBBB......','.....BBBBB......','.....BB.BB......','.....BB.BB......','................'];
export const avatars=[];
for(const base of [back,front,left,left.map(r=>[...r].reverse().join(''))])for(let step=0;step<2;step++){
 const frame=base.slice();if(step){frame[13]='....BBB..BB.....';frame[14]='....BB...BBB....';frame[15]='.........BB.....';}avatars.push(frame);
}
