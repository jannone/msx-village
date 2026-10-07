#include "msxgl.h"
#include "keyboard.h"
#include "memory.h"
#include "font/font_mgl_sample8.h"

#define MAP_SIZE 768
#define DATA_SIZE 1744
#define GRID 9
#define MAP_EXT 16
#define MAP_INT 784
#define OBJ_EXT 1552
#define OBJ_INT 1648

// Stable protocol addresses shared with the browser and regression fixtures.
volatile __at(0xD000) u8 ownerData[DATA_SIZE];
volatile __at(0xE000) u8 bridge[32];
u8 visitData[DATA_SIZE];
u8 screen[MAP_SIZE];
u8 collision[MAP_SIZE], collisionDirty, redraw;
u8 ownSlot, currentSlot, inside, px, py, editing, palette, objectMode, selection;
u8 facing, walkFrame, walkDistance, moving, refresh, speedFraction;
i16 targetX, targetY;
u8 targetSize, targetValid;
u8 currentKeys[10], previousKeys[10], moveDelay, noticeFrames;
const char* notice;

const u8 patterns[24][8] = {
 {0x00,0x10,0x00,0x01,0x00,0x40,0x00,0x04}, // grass
 {0x44,0x00,0x10,0x00,0x01,0x00,0x20,0x00}, // path
 {0x00,0x66,0x00,0x00,0x00,0x33,0x00,0x00}, // water
 {0xff,0x80,0x80,0x80,0xff,0x08,0x08,0x08}, // wall
 {0x55,0xaa,0x55,0xaa,0x55,0xaa,0x55,0xaa}, // roof
 {0x10,0x10,0xff,0x02,0x02,0xff,0x20,0x20}, // timber
 {0xff,0x80,0x80,0x80,0x80,0x80,0x80,0x80}, // floor
 {0x00,0x01,0x00,0x40,0x00,0x04,0x00,0x10}, // sand
 {0x00,0x24,0x5a,0x24,0x18,0x18,0x00,0x00}, // flowers
 {0x3c,0x7e,0xe7,0xc3,0xc3,0xe7,0x7e,0x3c}, // stone
 {0x55,0xff,0xaa,0xff,0x55,0xff,0xaa,0xff}, // hedge
 {0xff,0x88,0xff,0x22,0xff,0x88,0xff,0x22}, // brick
 {0xff,0x81,0xbd,0xa5,0xa5,0xbd,0x81,0xff}, // rug
 {0x3c,0x7e,0x66,0x66,0x6e,0x66,0x66,0x7e}, // entrance
 {0xff,0x81,0x99,0x99,0x81,0xff,0x18,0x18}, // window
 {0xff,0x18,0x18,0xff,0x18,0x18,0xff,0x00}, // fence
 {0x18,0x3c,0x7e,0xff,0x7e,0x3c,0x18,0x18}, // tree
 {0x00,0x7e,0xff,0xff,0x42,0x42,0x42,0x00}, // table
 {0x42,0x42,0x7e,0x7e,0x42,0x42,0x00,0x00}, // chair
 {0x7e,0x66,0x7e,0x7e,0x7e,0x7e,0x42,0x00}, // bed
 {0x18,0x3c,0x7e,0x18,0x18,0x18,0x3c,0x00}, // lamp
 {0x18,0x3c,0x18,0x7e,0x3c,0x3c,0x18,0x00}, // plant pot
 {0xff,0xb5,0xb5,0xff,0xb5,0xb5,0xff,0x00}, // bookcase
 {0x00,0x7e,0xff,0x99,0xff,0x7e,0x7e,0x00}  // chest
};
const u8 colors[24] = {0x32,0x6a,0x75,0xe1,0x86,0x6a,0xab,0xab,0x92,0xef,0x32,0x86,0x95,0xa6,0x75,0x6a,0x32,0x6a,0x6a,0xfe,0xae,0x32,0x6a,0xa6};
#include "assets.generated.h"
const char* tileNames[] = {"GRASS","PATH","WATER","WALL","ROOF","TIMBER","FLOOR","SAND","FLOWERS","STONE","HEDGE","BRICK","RUG","HOUSE DOOR","WINDOW","FENCE"};


void bank(u8 n) { *((volatile u8*)0x7800) = n; }
volatile u8* data(void) { return currentSlot == ownSlot ? ownerData : visitData; }
u16 mapOffset(void) { return inside ? MAP_INT : MAP_EXT; }
u16 objectOffset(void) { return inside ? OBJ_INT : OBJ_EXT; }
bool pressed(u8 key) { return !(currentKeys[KEY_ROW(key)] & (1 << KEY_IDX(key))); }
bool pushed(u8 key) { return pressed(key) && (previousKeys[KEY_ROW(key)] & (1 << KEY_IDX(key))); }
void text(u8 x, u8 y, const char* s) { while (*s && x < 32) screen[(u16)y*32+x++] = (u8)*s++ + 64; }
void message(const char* s) { notice=s; noticeFrames=120;redraw=1; }

void loadPlot(u8 slot) {
 currentSlot=slot;
 // Select the snapshot bank before comparing ownership. SDCC can otherwise
 // reuse the comparison result in A instead of the original slot argument.
 bank(5+slot);
 if (currentSlot != ownSlot) {
  Mem_Copy((const void*)0xA000,visitData,DATA_SIZE);
 }
 inside=0; editing=0; palette=0;collisionDirty=redraw=1;
}


// Collision footprint is the central 8x8 feet area of the 16x16 avatar.
bool overlaps(i16 x,u8 y,u8 size,i16 ox,u8 oy,u8 other) {
 return x<ox+other && x+size>ox && y<oy+other && y+size>oy;
}
bool doorAt(i16 x,i16 y) {
 volatile u8* d=data();
 return !inside && d[4]<31 && d[5]<23 && x>=d[4] && x<d[4]+2 && y>=d[5] && y<d[5]+2;
}
void updateCollision(void) {
 volatile u8* d=data();u16 i,o=objectOffset(),base=mapOffset();u8 x,y,row,col,kind,size;
 if(!collisionDirty)return;
 for(i=0;i<MAP_SIZE;++i)collision[i]=tileSolid[d[base+i]];
 if(!inside && d[4]<31 && d[5]<23)for(row=0;row<2;++row)for(col=0;col<2;++col)collision[(u16)(d[5]+row)*32+d[4]+col]=0;
 for(i=0;i<32;++i){u16 p=o+i*3;kind=d[p];if(kind<OBJECT_COUNT && objectSolid[kind]) {
  size=objectSize[kind];x=d[p+1];y=d[p+2];
  for(row=0;row<size;++row)for(col=0;col<size;++col)collision[(u16)(y+row)*32+x+col]=1;
 }}
 collisionDirty=0;
}
bool blocked(i16 x,i16 y) {
 u8 left,right,top,bottom;
 if(x<0 || x>240 || y<0 || y>176)return TRUE;
 updateCollision();left=(x+4)/8;right=(x+11)/8;top=(y+8)/8;bottom=(y+15)/8;
 return collision[(u16)top*32+left] || collision[(u16)top*32+right] || collision[(u16)bottom*32+left] || collision[(u16)bottom*32+right];
}
void safePosition(i16 x,i16 y) {
 u8 row,col;
 if(!blocked(x,y)){px=x;py=y;return;}
 for(row=22;row>0;--row)for(col=0;col<31;++col)if(!blocked(col*8,row*8)){px=col*8;py=row*8;return;}
 // If the entire room is blocked, keep the player visible and able to edit or exit.
 px=128;py=168;message("NO WALKABLE ARRIVAL - EDIT/EXIT");
}
void leaveHouse(void) {
 volatile u8* d=data();inside=0;editing=0;collisionDirty=redraw=1;
 safePosition(d[4]<31?d[4]*8:128,d[5]<23?(d[5]+1)*8:104);
}
void buildTarget(void) {
 targetSize=objectMode?objectSize[selection]:(selection==13?2:1);
 targetX=(px+8)/8;targetY=(py+12)/8;
 if(facing==0)targetY=(py+8)/8-targetSize;
 else if(facing==1)targetY=(py+15)/8+1;
 else if(facing==2)targetX=(px+4)/8-targetSize;
 else targetX=(px+11)/8+1;
 if(targetSize==2){if(facing<2)targetX=px/8;else targetY=py/8;}
 targetValid=targetX>=0 && targetY>=0 && targetX+targetSize<=32 && targetY+targetSize<=24;
 if(targetValid && objectMode && !inside && data()[4]<31 && overlaps(targetX,targetY,targetSize,data()[4],data()[5],2))targetValid=0;
 if(targetValid && targetX*8<px+12 && (targetX+targetSize)*8>px+4 && targetY*8<py+16 && (targetY+targetSize)*8>py+8)targetValid=0;
}
void paintObject(u8 kind,u8 x,u8 y) {
 u8 size=objectSize[kind],row,col,pattern=kind<8?16+kind:24+(kind-8)*4;
 for(row=0;row<size;++row)for(col=0;col<size;++col)screen[(u16)(y+row)*32+x+col]=pattern+row*size+col;
}
void draw(void) {
 volatile u8* d=data();u16 i,base=mapOffset(),obj=objectOffset();u8 avatar=ownerData[1];
 updateCollision();buildTarget();
 if(redraw) {
  Mem_Copy((const void*)(d+base),screen,MAP_SIZE);
  for(i=0;i<32;++i){u16 p=obj+i*3;u8 kind=d[p];if(kind<OBJECT_COUNT && d[p+1]+objectSize[kind]<=32 && d[p+2]+objectSize[kind]<=24)paintObject(kind,d[p+1],d[p+2]);}
  if(!inside && d[4]<31 && d[5]<23){for(i=0;i<4;++i)screen[(u16)(d[5]+i/2)*32+d[4]+i%2]=40+i;}
  if(palette) {
   Mem_Set(96,screen,MAP_SIZE);text(1,1,objectMode?"OBJECT CATALOG":"TILE CATALOG");
   text(1,3,"ARROWS CHOOSE  SPACE CONFIRMS");text(1,4,"F3 SWITCHES TILES / OBJECTS");
   for(i=0;i<(objectMode?OBJECT_COUNT:16);++i){u8 x=2+(i%8)*3,y=7+(i/8)*3;if(objectMode)paintObject(i,x,y);else if(i==13){u8 q;for(q=0;q<4;++q)screen[(u16)(y+q/2)*32+x+q%2]=40+q;}else screen[(u16)y*32+x]=i;}
   text(1,15,objectMode?objectNames[selection]:tileNames[selection]);
   text(1,16,objectMode?(objectSize[selection]==2?"2 X 2 TILES":"1 X 1 TILE"):(selection==13?"2 X 2 TILES":"1 X 1 TILE"));
   if(objectMode)text(1,17,objectSolid[selection]?"SOLID - BLOCKS WALKING":"NON-SOLID - WALKABLE");
   text(1,19,"F1 BUILD F4 ERASE F5 SAVE");text(1,20,"ENTER DOOR ESC EXIT H HOME");
  } else if(noticeFrames){Mem_Set(96,screen+704,64);text(1,22,notice);}
  VDP_WriteVRAM_16K(screen,0x1800,MAP_SIZE);redraw=0;
 }
 if(palette){VDP_SetSpriteSM1(0,0,212,0,0);VDP_SetSpriteSM1(1,(2+(selection%8)*3)*8,(7+(selection/8)*3)*8-1,132,15);}
 else {
  if(avatar>=4)avatar=0;
  VDP_SetSpriteSM1(0,px,py-1,(avatar*8+facing*2+walkFrame)*4,avatar==0?15:avatar==1?10:avatar==2?9:7);
  if(editing && targetX>=0 && targetY>=0 && targetX<32 && targetY<24)VDP_SetSpriteSM1(1,targetX*8,targetY*8-1,targetSize==2?132:128,targetValid?15:8);
  else VDP_SetSpriteSM1(1,0,212,128,0);
 }
 bridge[7]=inside;bridge[13]=currentSlot;bridge[14]=(px+8)/8;bridge[15]=(py+12)/8;
 bridge[16]=selection;bridge[17]=objectMode;bridge[18]=editing;
 bridge[20]=facing;bridge[21]=walkFrame;bridge[22]=moving;
 bridge[23]=targetX;bridge[24]=targetY;bridge[25]=targetSize;bridge[26]=targetValid;
 bridge[27]=2;bridge[28]=px;bridge[29]=py;bridge[30]=refresh;
}
void eraseObjectsAt(i16 x,u8 y,u8 size) {
 volatile u8* d=data();u16 i,off=objectOffset();
 for(i=0;i<32;++i){u16 p=off+i*3;u8 kind=d[p];if(kind<OBJECT_COUNT && overlaps(x,y,size,d[p+1],d[p+2],objectSize[kind]))d[p]=255;}
}
void place(void) {
 volatile u8* d=data();u16 off=mapOffset(),o=objectOffset(),i,p;
 if(currentSlot!=ownSlot || bridge[5]==1 || bridge[5]==2)return;
 buildTarget();if(!targetValid){message("CANNOT BUILD HERE");return;}
 if(!objectMode) {
  if(selection==13 && !inside){eraseObjectsAt(targetX,targetY,2);d[4]=targetX;d[5]=targetY;}
  else if(selection==13){message("DOOR BELONGS OUTSIDE");return;}
  else d[off+(u16)targetY*32+targetX]=selection;
 } else {
  if(!inside && d[4]<31 && overlaps(targetX,targetY,targetSize,d[4],d[5],2)){message("KEEP THE DOORWAY CLEAR");return;}
  // Replacement removes whole intersecting objects, never partial quadrants.
  for(i=0;i<32;++i){p=o+i*3;if(d[p]==255 || overlaps(targetX,targetY,targetSize,d[p+1],d[p+2],objectSize[d[p]]))break;}
  if(i==32){message("OBJECT LIMIT REACHED");return;}
  eraseObjectsAt(targetX,targetY,targetSize);
  for(i=0;i<32;++i){p=o+i*3;if(d[p]==255){d[p]=selection;d[p+1]=targetX;d[p+2]=targetY;break;}}
 }
 bridge[6]=1;collisionDirty=redraw=1;
}
void erase(void) {
 volatile u8* d=data();
 if(currentSlot!=ownSlot || bridge[5]==1 || bridge[5]==2)return;
 buildTarget();if(!targetValid)return;
 eraseObjectsAt(targetX,targetY,1);
 if(!objectMode){d[mapOffset()+(u16)targetY*32+targetX]=inside?6:0;if(doorAt(targetX,targetY))d[4]=d[5]=255;}
 bridge[6]=1;collisionDirty=redraw=1;
}
bool movePixel(u8 dir) {
 i16 x=px,y=py;u8 destination=currentSlot,previous=currentSlot;
 if(dir==0)--y;else if(dir==1)++y;else if(dir==2)--x;else ++x;
 if(x<0 || x>240 || y<0 || y>176) {
  if(inside)return FALSE;
  if(x<0 && currentSlot%GRID){destination=currentSlot-1;x=240;}
  else if(x>240 && currentSlot%GRID<8){destination=currentSlot+1;x=0;}
  else if(y<0 && currentSlot>=GRID){destination=currentSlot-GRID;y=176;}
  else if(y>176 && currentSlot<72){destination=currentSlot+GRID;y=0;}
  else {message("EDGE OF THIS SNAPSHOT");return FALSE;}
  loadPlot(destination);
  if(blocked(x,y)){loadPlot(previous);return FALSE;}
  if(currentSlot!=ownSlot)message("VISITING - READ ONLY");
 } else if(blocked(x,y))return FALSE;
 px=x;py=y;return TRUE;
}
void walk(u8 dir) {
 u8 steps;
 moving=0;
 if(dir==255){speedFraction=0;walkFrame=0;return;}
 // NES-style turning: continue the current axis until its 8-pixel alignment.
 if(facing<2 && py%8)dir=facing;
 else if(facing>=2 && px%8)dir=facing;
 facing=dir;
 speedFraction+=90;steps=speedFraction/refresh;speedFraction%=refresh;
 while(steps--){if(!movePixel(dir))break;moving=1;if(++walkDistance>=8){walkDistance=0;walkFrame=!walkFrame;}}
 if(!moving)walkFrame=0;
}
void tick(void) {
 u8 key,r,dir=255;
 __asm di __endasm;
 for(r=0;r<10;++r)currentKeys[r]=Keyboard_Read(r);
 __asm ei __endasm;
 if(noticeFrames && !--noticeFrames)redraw=1;
 if(bridge[5]==3){bridge[5]=0;bridge[6]=0;message("SAVED TO THE VILLAGE");}
 else if(bridge[5]==4){bridge[5]=0;message("SAVE FAILED - F5 TO RETRY");}
 else if(bridge[5]==5){bridge[5]=0;message("SAVE CONFLICT - SEE WEBSITE");}
 if(pushed(KEY_F5) && bridge[5]!=1 && bridge[5]!=2){if(bridge[4] && ownSlot<81){bridge[5]=1;message("SAVING...");}else message("OFFLINE - CHANGES NOT SAVED");}
 if(pushed(KEY_ESC)){if(palette){palette=0;redraw=1;}else if(inside)leaveHouse();else editing=0;}
 if(pushed(KEY_H)){loadPlot(ownSlot<81?ownSlot:40);safePosition(128,104);}
 if(pushed(KEY_RETURN)) {
  if(inside)leaveHouse();
  else {buildTarget();if(doorAt((px+8)/8,(py+12)/8) || doorAt(targetX,targetY)){inside=1;editing=0;collisionDirty=redraw=1;safePosition(128,168);}}
 }
 if(pushed(KEY_F1)){if(currentSlot==ownSlot && bridge[5]!=1 && bridge[5]!=2){editing=!editing;message(editing?"BUILD IN FRONT - F2 CATALOG":"EXPLORING");}else message("THIS EXHIBIT IS READ ONLY");}
 if(pushed(KEY_F2)){palette=!palette;redraw=1;}
 if(pushed(KEY_F3)){objectMode=!objectMode;selection=0;message(objectMode?"OBJECTS - F2 CATALOG":"TILES - F2 CATALOG");}
 if(pressed(KEY_LEFT))dir=2;else if(pressed(KEY_RIGHT))dir=3;else if(pressed(KEY_UP))dir=0;else if(pressed(KEY_DOWN))dir=1;
 if(palette){moving=walkFrame=0;if(moveDelay)--moveDelay;else if(dir!=255){key=objectMode?OBJECT_COUNT:16;selection=(selection+key+(dir==2?-1:dir==3?1:dir==0?-8:8))%key;redraw=1;moveDelay=8;}}
 else walk(dir);
 if(pushed(KEY_SPACE)){if(palette){palette=0;redraw=1;}else if(editing)place();}
 if(pushed(KEY_F4) && editing && !palette)erase();
 for(r=0;r<10;++r)previousKeys[r]=currentKeys[r];
 draw();
}
void main(void) {
 u16 i;u8 b;
 objectMode=selection=moveDelay=inside=editing=palette=walkFrame=walkDistance=moving=speedFraction=0;facing=0;
 refresh=Sys_Is50Hz()?50:60;
 for(i=0;i<32;++i)bridge[i]=0;
 bank(4);ownSlot=*((const u8*)0xA008);if(ownSlot>=81)ownSlot=255;
 for(i=0;i<4;++i)bridge[8+i]=*((const u8*)0xA00C+i);
 bank(5+(ownSlot<81?ownSlot:40));Mem_Copy((const void*)0xA000,(void*)ownerData,DATA_SIZE);
 loadPlot(ownSlot<81?ownSlot:40);safePosition(128,104);
 VDP_SetMode(VDP_MODE_SCREEN2);VDP_EnableVBlank(TRUE);VDP_ClearVRAM();
 for(b=0;b<3;++b){
  VDP_WriteVRAM_16K((const u8*)patterns,b*0x800,192);
  for(i=0;i<24;++i)VDP_FillVRAM_16K(colors[i],0x2000+b*0x800+i*8,8);
  VDP_WriteVRAM_16K((const u8*)largePatterns,b*0x800+192,160);
  for(i=24;i<44;++i)VDP_FillVRAM_16K(i<28?0x32:i<32?0x6a:i<36?0xfe:i<40?0x92:0xa6,0x2000+b*0x800+i*8,8);
  VDP_WriteVRAM_16K(g_Font_MGL_Sample8+4+32*8,b*0x800+96*8,96*8);VDP_FillVRAM_16K(0xf1,0x2000+b*0x800+96*8,96*8);
 }
 VDP_SetSpriteFlag(VDP_SPRITE_SIZE_16);VDP_LoadSpritePattern((const u8*)avatarPatterns,0,136);VDP_DisableSpritesFrom(2);
 for(i=0;i<10;++i)previousKeys[i]=255;
 bridge[0]='M';bridge[1]='S';bridge[2]='X';bridge[3]='V';bridge[12]=ownSlot;bridge[19]=1;
 message("F1 BUILD F2 CATALOG F5 SAVE");while(1){Halt();tick();}
}
