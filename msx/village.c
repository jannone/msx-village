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
u8 dirtyLeft, dirtyTop, dirtyRight, dirtyBottom;
u8 ownSlot, currentSlot, inside, px, py, editing, palette, objectMode, selection;
u8 facing, walkFrame, walkDistance, moving, refresh, speedFraction;
i16 targetX, targetY;
u8 targetSize, targetHeight, targetValid;
u8 textMask[96], nativeSlots[352], nativeUsed[44];

u8 currentKeys[10], previousKeys[10], moveDelay, noticeFrames, displayMode;
#define DISPLAY_SCENE 0
#define DISPLAY_PANEL 1
#define DISPLAY_CATALOG 2
const char* notice;

#include "assets.generated.h"
u8 catalogItems[CATALOG_CAPACITY], catalogCount, catalogIndex, catalogCategory;



void bank(u8 n) { *((volatile u8*)0x7800) = n; }
volatile u8* data(void) { return currentSlot == ownSlot ? ownerData : visitData; }
u16 mapOffset(void) { return inside ? MAP_INT : MAP_EXT; }
u16 objectOffset(void) { return inside ? OBJ_INT : OBJ_EXT; }
bool pressed(u8 key) { return !(currentKeys[KEY_ROW(key)] & (1 << KEY_IDX(key))); }
bool pushed(u8 key) { return pressed(key) && (previousKeys[KEY_ROW(key)] & (1 << KEY_IDX(key))); }
void text(u8 x, u8 y, const char* s) {u16 p;while(*s && x<32){p=(u16)y*32+x++;screen[p]=(u8)*s++-32;textMask[p/8]|=1<<(p%8);}}
void message(const char* s) { notice=s; noticeFrames=1;palette=0;moving=walkFrame=speedFraction=0;redraw=1; }

void loadPlot(u8 slot) {
 currentSlot=slot;
 // Select the snapshot bank before comparing ownership. SDCC can otherwise
 // reuse the comparison result in A instead of the original slot argument.
 bank(5+slot);
 if (currentSlot != ownSlot) {
  Mem_Copy((const void*)0xA000,visitData,DATA_SIZE);
 }
 inside=0; editing=0; palette=noticeFrames=0;collisionDirty=redraw=1;
}


// Collision footprint is the central 8x8 feet area of the 16x16 avatar.
bool overlaps(i16 x,u8 y,u8 w,u8 h,i16 ox,u8 oy,u8 ow,u8 oh) {
 return x<ox+ow && x+w>ox && y<oy+oh && y+h>oy;
}
bool doorAt(i16 x,i16 y) {
 volatile u8* d=data();
 return !inside && d[4]<31 && d[5]<23 && x>=d[4] && x<d[4]+2 && y>=d[5] && y<d[5]+2;
}
void updateCollision(void) {
 volatile u8* d=data();u16 i,o=objectOffset(),base=mapOffset();u8 x,y,row,col,kind,w,h;
 if(!collisionDirty)return;
 for(i=0;i<MAP_SIZE;++i)collision[i]=tileSolid[d[base+i]];
 if(!inside && d[4]<31 && d[5]<23)for(row=0;row<2;++row)for(col=0;col<2;++col)collision[(u16)(d[5]+row)*32+d[4]+col]=0;
 for(i=0;i<32;++i){u16 p=o+i*3;kind=d[p];if(kind<OBJECT_COUNT && objectSolid[kind]) {
  w=objectWidth[kind];h=objectHeight[kind];x=d[p+1];y=d[p+2];
  for(row=0;row<h;++row)for(col=0;col<w;++col)collision[(u16)(y+row)*32+x+col]=1;
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
 targetSize=objectMode?objectWidth[selection]:(selection==13?2:1);
 targetHeight=objectMode?objectHeight[selection]:(selection==13?2:1);
 targetX=(px+8)/8;targetY=(py+12)/8;
 if(facing==0)targetY=(py+8)/8-targetHeight;
 else if(facing==1)targetY=(py+15)/8+1;
 else if(facing==2)targetX=(px+4)/8-targetSize;
 else targetX=(px+11)/8+1;
 if(facing<2 && targetSize>1)targetX=px/8;
 if(facing>=2 && targetHeight>1)targetY=py/8;
 targetValid=targetX>=0 && targetY>=0 && targetX+targetSize<=32 && targetY+targetHeight<=24;
 if(targetValid && objectMode && !inside && data()[4]<31 && overlaps(targetX,targetY,targetSize,targetHeight,data()[4],data()[5],2,2))targetValid=0;
 if(targetValid && targetX*8<px+12 && (targetX+targetSize)*8>px+4 && targetY*8<py+16 && (targetY+targetHeight)*8>py+8)targetValid=0;
}
void paintObject(u8 kind,u8 x,u8 y) {
 u8 w=objectWidth[kind],h=objectHeight[kind],row,col;u16 p;
 for(row=0;row<h;++row)for(col=0;col<w;++col){p=(u16)(y+row)*32+x+col;screen[p]=objectCells[objectOffsetTable[kind]+row*w+col];textMask[p/8]&=~(1<<(p%8));}
}
// Scene slots match the deduplicated ROM atlas. Temporary text sections allocate
// art and font IDs separately, leaving all 256 native slots available to either.
void renderSection(u8 section) {
 u16 i,p,key,count=0;u8 id,mask,slot;u16 base=section*0x800;
 // Scene IDs are already a bounded atlas of at most 256 patterns. Keep their
 // native slots stable so an edit only needs name-table writes, with display on.
 if(displayMode==DISPLAY_SCENE || (displayMode==DISPLAY_PANEL && section<2)){
  VDP_WriteVRAM_16K((const u8*)scenePatterns,base,ART_COUNT*8);
  VDP_WriteVRAM_16K((const u8*)sceneColors,0x2000+base,ART_COUNT*8);
  if(ART_COUNT<256){VDP_FillVRAM_16K(0,base+ART_COUNT*8,(256-ART_COUNT)*8);VDP_FillVRAM_16K(0,0x2000+base+ART_COUNT*8,(256-ART_COUNT)*8);}
  VDP_WriteVRAM_16K(screen+section*256,0x1800+section*256,256);
  return;
 }
 Mem_Set(0,nativeUsed,44);
 VDP_FillVRAM_16K(0,base,2048);VDP_FillVRAM_16K(0,0x2000+base,2048);
 for(i=0;i<256;++i){p=section*256+i;key=screen[p];if(textMask[p/8]&(1<<(p%8)))key+=256;
  id=key/8;mask=1<<(key%8);
  if(!(nativeUsed[id]&mask)){
   slot=count++;nativeSlots[key]=slot;nativeUsed[id]|=mask;
   if(key>=256){VDP_WriteVRAM_16K(g_Font_MGL_Sample8+4+(key-256+32)*8,base+slot*8,8);VDP_FillVRAM_16K(0xf1,0x2000+base+slot*8,8);}
   else{VDP_WriteVRAM_16K(scenePatterns[key],base+slot*8,8);VDP_WriteVRAM_16K(sceneColors[key],0x2000+base+slot*8,8);}
  }
  screen[p]=nativeSlots[key];
 }
 VDP_WriteVRAM_16K(screen+section*256,0x1800+section*256,256);
}
void catalogList(void){u8 i;catalogCount=0;for(i=0;i<(objectMode?OBJECT_COUNT:TERRAIN_COUNT);++i)if(!objectMode||objectCategory[i]==catalogCategory)catalogItems[catalogCount++]=i;catalogIndex=0;for(i=0;i<catalogCount;++i)if(catalogItems[i]==selection)catalogIndex=i;selection=catalogItems[catalogIndex];}
void cursor(u8 x,u8 y,u8 w,u8 h,u8 color){
 u8 i,pattern;
 for(i=2;i<6;++i)VDP_SetSpriteSM1(i,0,212,0,0);
 if(h<=2 && w<=2){pattern=w==1?(h==1?64:72):(h==1?76:68);VDP_SetSpriteSM1(2,x,y-1,pattern,color);}
 else if(h<=2){pattern=h==1?96:104;VDP_SetSpriteSM1(2,x,y-1,pattern,color);VDP_SetSpriteSM1(3,x+w*8-8,y-1,pattern+4,color);}
 else{VDP_SetSpriteSM1(2,x,y-1,80,color);VDP_SetSpriteSM1(3,x+w*8-8,y-1,84,color);VDP_SetSpriteSM1(4,x,y+h*8-9,88,color);VDP_SetSpriteSM1(5,x+w*8-8,y+h*8-9,92,color);}
}
void draw(void) {
 volatile u8* d=data();u16 i,base=mapOffset(),obj=objectOffset();u8 avatar=ownerData[1],mode,first=0;
 updateCollision();buildTarget();
 mode=palette?DISPLAY_CATALOG:noticeFrames?DISPLAY_PANEL:DISPLAY_SCENE;
 if(mode!=displayMode){if(mode!=DISPLAY_CATALOG && displayMode!=DISPLAY_CATALOG)first=2;redraw=1;}
 displayMode=mode;
 if(redraw) {
  if(redraw!=2){VDP_EnableDisplay(FALSE);for(i=0;i<6;++i)VDP_SetSpriteSM1(i,0,212,0,0);}
  if(redraw==2){
   u8 x,y;
   for(y=dirtyTop;y<dirtyBottom;++y)for(x=dirtyLeft;x<dirtyRight;++x){u16 p=(u16)y*32+x;screen[p]=terrainPatterns[d[base+p]];}
  }else{
   Mem_Set(0,textMask,96);
   for(i=0;i<MAP_SIZE;++i)screen[i]=terrainPatterns[d[base+i]];
  }
  for(i=0;i<32;++i){u16 p=obj+i*3;u8 kind=d[p];if(kind<OBJECT_COUNT && d[p+1]+objectWidth[kind]<=32 && d[p+2]+objectHeight[kind]<=24)paintObject(kind,d[p+1],d[p+2]);}
  if(!inside && d[4]<31 && d[5]<23){for(i=0;i<4;++i)screen[(u16)(d[5]+i/2)*32+d[4]+i%2]=doorPatterns[i];}
  if(palette) {
   u8 start=(catalogIndex/6)*6;
   Mem_Set(0,screen,MAP_SIZE);Mem_Set(255,textMask,96);
   text(1,0,objectMode?categoryNames[catalogCategory]:"TERRAIN");text(1,1,"Z/X CATEGORY  F3 TILES/OBJECTS");text(1,2,"ARROWS CHOOSE  SPACE CONFIRMS");
   for(i=start;i<catalogCount && i<start+6;++i){u8 id=catalogItems[i],x=1+((i-start)%3)*10,y=5+((i-start)/3)*8;
    if(objectMode)paintObject(id,x,y);else if(id==13){u8 q;for(q=0;q<4;++q){u16 p=(u16)(y+q/2)*32+x+q%2;screen[p]=doorPatterns[q];textMask[p/8]&=~(1<<(p%8));}}else{u16 p=(u16)y*32+x;screen[p]=terrainPatterns[id];textMask[p/8]&=~(1<<(p%8));}
   }
   text(1,21,objectMode?objectNames[selection]:tileNames[selection]);
   {char dimensions[12]="1 X 1 TILES";dimensions[0]='0'+targetSize;dimensions[4]='0'+targetHeight;text(1,22,dimensions);}
   if(objectMode)text(15,22,objectSolid[selection]?"SOLID":"WALKABLE");
   text(1,23,"F1 BUILD F4 ERASE F5 SAVE");
  } else if(noticeFrames){Mem_Set(0,screen+512,256);Mem_Set(255,textMask+64,32);text(1,18,notice);text(1,22,"SPACE / ENTER / ESC TO CLOSE");}
  if(redraw==2){
   for(i=dirtyTop;i<dirtyBottom;++i){u16 p=i*32+dirtyLeft;VDP_WriteVRAM_16K(screen+p,0x1800+p,dirtyRight-dirtyLeft);}
  }else{
   for(i=first;i<3;++i)renderSection(i);
   VDP_EnableDisplay(TRUE);
  }
 }
 if(palette){VDP_SetSpriteSM1(0,0,212,0,0);VDP_SetSpriteSM1(1,0,212,0,0);cursor((1+(catalogIndex%3)*10)*8,(5+((catalogIndex%6)/3)*8)*8,targetSize,targetHeight,15);}
 else {
  if(avatar>=4)avatar=0;
  if(noticeFrames && py+16>128){VDP_SetSpriteSM1(0,0,212,0,0);VDP_SetSpriteSM1(1,0,212,0,0);}
  else {
   VDP_SetSpriteSM1(0,px,py-1,(facing*2+walkFrame)*8,avatar==0?15:avatar==1?10:avatar==2?9:7);
   VDP_SetSpriteSM1(1,px,py-1,(facing*2+walkFrame)*8+4,avatar==1?15:11);
  }
  if(!noticeFrames && editing && targetX>=0 && targetY>=0 && targetX+targetSize<=32 && targetY+targetHeight<=24)cursor(targetX*8,targetY*8,targetSize,targetHeight,targetValid?15:8);
  else {for(i=2;i<6;++i)VDP_SetSpriteSM1(i,0,212,0,0);}
 }
 bridge[7]=inside;bridge[13]=currentSlot;bridge[14]=(px+8)/8;bridge[15]=(py+12)/8;
 bridge[16]=selection;bridge[17]=objectMode;bridge[18]=editing;
 bridge[20]=facing;bridge[21]=walkFrame;bridge[22]=moving;
 bridge[23]=targetX;bridge[24]=targetY;bridge[25]=targetSize;bridge[26]=targetValid;
 bridge[27]=3;bridge[28]=px;bridge[29]=py;bridge[30]=refresh;bridge[31]=displayMode;redraw=0;
}
void dirtyScene(u8 x,u8 y,u8 w,u8 h) {
 if(redraw==1)return;
 if(redraw!=2){dirtyLeft=x;dirtyTop=y;dirtyRight=x+w;dirtyBottom=y+h;redraw=2;}
 else{if(x<dirtyLeft)dirtyLeft=x;if(y<dirtyTop)dirtyTop=y;if(x+w>dirtyRight)dirtyRight=x+w;if(y+h>dirtyBottom)dirtyBottom=y+h;}
}
void eraseObjectsAt(i16 x,u8 y,u8 w,u8 h) {
 volatile u8* d=data();u16 i,off=objectOffset();
 for(i=0;i<32;++i){u16 p=off+i*3;u8 kind=d[p];if(kind<OBJECT_COUNT && overlaps(x,y,w,h,d[p+1],d[p+2],objectWidth[kind],objectHeight[kind])){dirtyScene(d[p+1],d[p+2],objectWidth[kind],objectHeight[kind]);d[p]=255;}}
}
void place(void) {
 volatile u8* d=data();u16 off=mapOffset(),o=objectOffset(),i,p;
 if(currentSlot!=ownSlot || bridge[5]==1 || bridge[5]==2)return;
 buildTarget();if(!targetValid){message("CANNOT BUILD HERE");return;}
 if(!objectMode) {
  if(selection==13 && !inside){if(d[4]<31 && d[5]<23)dirtyScene(d[4],d[5],2,2);eraseObjectsAt(targetX,targetY,2,2);d[4]=targetX;d[5]=targetY;}
  else if(selection==13){message("DOOR BELONGS OUTSIDE");return;}
  else d[off+(u16)targetY*32+targetX]=selection;
 } else {
  if(!inside && d[4]<31 && overlaps(targetX,targetY,targetSize,targetHeight,d[4],d[5],2,2)){message("KEEP THE DOORWAY CLEAR");return;}
  // Replacement removes whole intersecting objects, never partial quadrants.
  for(i=0;i<32;++i){p=o+i*3;if(d[p]==255 || overlaps(targetX,targetY,targetSize,targetHeight,d[p+1],d[p+2],objectWidth[d[p]],objectHeight[d[p]]))break;}
  if(i==32){message("OBJECT LIMIT REACHED");return;}
  eraseObjectsAt(targetX,targetY,targetSize,targetHeight);
  for(i=0;i<32;++i){p=o+i*3;if(d[p]==255){d[p]=selection;d[p+1]=targetX;d[p+2]=targetY;break;}}
 }
 dirtyScene(targetX,targetY,targetSize,targetHeight);
 bridge[6]=1;collisionDirty=1;
}
void erase(void) {
 volatile u8* d=data();
 if(currentSlot!=ownSlot || bridge[5]==1 || bridge[5]==2)return;
 buildTarget();if(!targetValid)return;
 eraseObjectsAt(targetX,targetY,1,1);
 if(!objectMode){d[mapOffset()+(u16)targetY*32+targetX]=inside?6:0;if(doorAt(targetX,targetY)){dirtyScene(d[4],d[5],2,2);d[4]=d[5]=255;}}
 dirtyScene(targetX,targetY,1,1);
 bridge[6]=1;collisionDirty=1;
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

 } else if(blocked(x,y))return FALSE;
 px=x;py=y;return TRUE;
}
void walk(u8 dir) {
 u8 steps;i16 aheadX=px,aheadY=py;
 moving=0;
 if(dir==255){speedFraction=0;walkFrame=0;return;}
 // NES-style turning: continue the current axis until its 8-pixel alignment.
 if((facing<2)!=(dir<2) && ((facing<2 && py%8)||(facing>=2 && px%8))){
  if(facing==0)--aheadY;else if(facing==1)++aheadY;else if(facing==2)--aheadX;else ++aheadX;
  // A collision can stop feet between grid lines. Allow escape and reversal;
  // otherwise an aligned-turn rule can trap the player against a wall.
  if(!blocked(aheadX,aheadY))dir=facing;
 }
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

 if(bridge[5]==3){bridge[5]=0;bridge[6]=0;message("SAVED TO THE VILLAGE");}
 else if(bridge[5]==4){bridge[5]=0;message("SAVE FAILED - F5 TO RETRY");}
 else if(bridge[5]==5){bridge[5]=0;message("SAVE CONFLICT - SEE WEBSITE");}
 if(pushed(KEY_F5) && bridge[5]!=1 && bridge[5]!=2){if(bridge[4] && ownSlot<81){bridge[5]=1;message("SAVING...");}else message("OFFLINE - CHANGES NOT SAVED");}
 if(noticeFrames){
  moving=walkFrame=speedFraction=0;
  if(pushed(KEY_ESC)||pushed(KEY_RETURN)||pushed(KEY_SPACE)){noticeFrames=0;redraw=1;}
  goto endTick;
 }
 if(palette){
  moving=walkFrame=speedFraction=0;
  if(pushed(KEY_ESC)||pushed(KEY_F2)||pushed(KEY_SPACE)||pushed(KEY_RETURN)){palette=0;redraw=1;goto endTick;}
  if(pushed(KEY_F3)){objectMode=!objectMode;selection=0;catalogCategory=0;catalogList();redraw=1;}
  if(objectMode && (pushed(KEY_Z)||pushed(KEY_X))){catalogCategory=(catalogCategory+CATEGORY_COUNT+(pushed(KEY_X)?1:-1))%CATEGORY_COUNT;selection=0;catalogList();redraw=1;}
  if(pressed(KEY_LEFT))dir=2;else if(pressed(KEY_RIGHT))dir=3;else if(pressed(KEY_UP))dir=0;else if(pressed(KEY_DOWN))dir=1;
  if(moveDelay)--moveDelay;else if(dir!=255){key=catalogCount;catalogIndex=(catalogIndex+key+(dir==2?-1:dir==3?1:dir==0?-3:3))%key;selection=catalogItems[catalogIndex];redraw=1;moveDelay=8;}
  goto endTick;
 }
 if(pushed(KEY_ESC)){if(palette){palette=0;redraw=1;}else if(inside)leaveHouse();else editing=0;}
 if(pushed(KEY_H)){loadPlot(ownSlot<81?ownSlot:40);safePosition(128,104);}
 if(pushed(KEY_RETURN)) {
  if(inside)leaveHouse();
  else {buildTarget();if(doorAt((px+8)/8,(py+12)/8) || doorAt(targetX,targetY)){inside=1;editing=0;collisionDirty=redraw=1;safePosition(128,168);}}
 }
 if(pushed(KEY_F1)){if(currentSlot==ownSlot && bridge[5]!=1 && bridge[5]!=2){editing=!editing;}else message("THIS EXHIBIT IS READ ONLY");}
 if(noticeFrames)goto endTick;
 if(pushed(KEY_F2)){palette=1;catalogCategory=objectMode?objectCategory[selection]:0;catalogList();moving=walkFrame=speedFraction=0;redraw=1;goto endTick;}
 if(pushed(KEY_F3)){objectMode=!objectMode;selection=0;}
 if(pressed(KEY_LEFT))dir=2;else if(pressed(KEY_RIGHT))dir=3;else if(pressed(KEY_UP))dir=0;else if(pressed(KEY_DOWN))dir=1;
 if(!noticeFrames)walk(dir);
 if(noticeFrames)goto endTick;
 if(pushed(KEY_SPACE)){if(palette){palette=0;redraw=1;}else if(editing)place();}
 if(pushed(KEY_F4) && editing && !palette)erase();
 endTick:
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
 VDP_SetMode(VDP_MODE_SCREEN2);VDP_SetBackdropColor(1);VDP_EnableVBlank(TRUE);VDP_ClearVRAM();
 VDP_EnableDisplay(FALSE);

 displayMode=DISPLAY_SCENE;noticeFrames=0;
 VDP_SetSpriteFlag(VDP_SPRITE_SIZE_16);VDP_LoadSpritePattern((const u8*)avatarPatterns,0,112);VDP_DisableSpritesFrom(6);
 for(i=0;i<10;++i)previousKeys[i]=255;
 bridge[0]='M';bridge[1]='S';bridge[2]='X';bridge[3]='V';bridge[12]=ownSlot;bridge[19]=1;
 draw();while(1){Halt();tick();}
}
