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
u8 ownSlot, currentSlot, inside, px, py, editing, palette, objectMode, selection;
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
const u8 avatarPattern[4][8] = {
 {0x18,0x3c,0x3c,0x18,0x7e,0x5a,0x24,0x66},
 {0x18,0x7e,0x3c,0x18,0x3c,0x7e,0x24,0x66},
 {0x3c,0x7e,0x5a,0x18,0x7e,0x3c,0x24,0x66},
 {0x18,0x3c,0x7e,0x18,0x3c,0x5a,0x24,0x24}
};
const char* tileNames[] = {"GRASS","PATH","WATER","WALL","ROOF","TIMBER","FLOOR","SAND","FLOWERS","STONE","HEDGE","BRICK","RUG","HOUSE DOOR","WINDOW","FENCE"};
const char* objectNames[] = {"TREE","TABLE","CHAIR","BED","LAMP","PLANT POT","BOOKCASE","CHEST"};

void bank(u8 n) { *((volatile u8*)0x7800) = n; }
volatile u8* data(void) { return currentSlot == ownSlot ? ownerData : visitData; }
u16 mapOffset(void) { return inside ? MAP_INT : MAP_EXT; }
u16 objectOffset(void) { return inside ? OBJ_INT : OBJ_EXT; }
bool pressed(u8 key) { return !(currentKeys[KEY_ROW(key)] & (1 << KEY_IDX(key))); }
bool pushed(u8 key) { return pressed(key) && (previousKeys[KEY_ROW(key)] & (1 << KEY_IDX(key))); }
void text(u8 x, u8 y, const char* s) { while (*s && x < 32) screen[(u16)y*32+x++] = (u8)*s++ + 64; }
void message(const char* s) { notice=s; noticeFrames=120; }

void loadPlot(u8 slot) {
 currentSlot=slot;
 // Select the snapshot bank before comparing ownership. SDCC can otherwise
 // reuse the comparison result in A instead of the original slot argument.
 bank(5+slot);
 if (currentSlot != ownSlot) {
  Mem_Copy((const void*)0xA000,visitData,DATA_SIZE);
 }
 inside=0; editing=0; palette=0;
}

void draw(void) {
 volatile u8* d=data();
 u16 i, base=mapOffset(), obj=objectOffset();
 Mem_Copy((const void*)(d+base),screen,MAP_SIZE);
 for(i=0;i<32;++i) {
  u16 p=obj+i*3;
  if(d[p]<8 && d[p+1]<32 && d[p+2]<24) screen[(u16)d[p+2]*32+d[p+1]]=16+d[p];
 }
 if(!inside && d[4]<32 && d[5]<24) screen[(u16)d[5]*32+d[4]]=13;
 if(palette) {
  Mem_Set(96,screen,MAP_SIZE);
  text(1,1,objectMode?"OBJECT CATALOG":"TILE CATALOG");
  text(1,3,"ARROWS CHOOSE  SPACE CONFIRMS");
  text(1,4,"F3 SWITCHES TILES / OBJECTS");
  for(i=0;i<(objectMode?8:16);++i) screen[(u16)(7+(i/8)*3)*32+2+(i%8)*3]=(objectMode?16:0)+i;
  text(1,15,objectMode?objectNames[selection]:tileNames[selection]);
  text(1,18,"F1 BUILD   F4 ERASE   F5 SAVE");
  text(1,20,"ENTER DOOR  ESC EXIT  H HOME");
  VDP_SetSpriteSM1(0,(2+(selection%8)*3)*8,(7+(selection/8)*3)*8-1,0,15);
 } else {
  u8 avatar=ownerData[1];
  VDP_SetSpriteSM1(0,px*8,py*8-1,avatar<4?avatar:0,editing?15:(avatar==0?15:avatar==1?10:avatar==2?9:7));
 }
 if(noticeFrames && !palette) {
  Mem_Set(96,screen+704,64);
  text(1,22,notice);
 }
 VDP_WriteVRAM_16K(screen,0x1800,MAP_SIZE);
 bridge[7]=inside;bridge[13]=currentSlot;bridge[14]=px;bridge[15]=py;
 bridge[16]=selection;bridge[17]=objectMode;bridge[18]=editing;
}

void eraseObject(void) {
 volatile u8* d=data();u16 i,off=objectOffset();
 for(i=0;i<32;++i) {u16 p=off+i*3;if(d[p+1]==px && d[p+2]==py) d[p]=255;}
}
void place(void) {
 volatile u8* d=data();u16 off=mapOffset();
 if(currentSlot!=ownSlot || bridge[5]==1 || bridge[5]==2) return;
 if(!objectMode) {
  if(selection==13 && !inside) {d[4]=px;d[5]=py;}
  else if(selection==13) {message("DOOR BELONGS OUTSIDE");return;}
  else d[off+(u16)py*32+px]=selection;
 } else {
  u16 i,p,o=objectOffset();eraseObject();
  for(i=0;i<32;++i) {p=o+i*3;if(d[p]==255){d[p]=selection;d[p+1]=px;d[p+2]=py;break;}}
  if(i==32){message("OBJECT LIMIT REACHED");return;}
 }
 bridge[6]=1;
}
void erase(void) {
 volatile u8* d=data();
 if(currentSlot!=ownSlot || bridge[5]==1 || bridge[5]==2) return;
 if(objectMode) eraseObject();
 else {d[mapOffset()+(u16)py*32+px]=inside?6:0;if(!inside && d[4]==px && d[5]==py)d[4]=d[5]=255;}
 bridge[6]=1;
}

void move(i8 dx,i8 dy) {
 i8 nx=(i8)px+dx,ny=(i8)py+dy;
 if(nx>=0 && nx<32 && ny>=0 && ny<24){px=nx;py=ny;return;}
 if(inside)return;
 if(nx<0 && currentSlot%GRID){loadPlot(currentSlot-1);px=31;}
 else if(nx>=32 && currentSlot%GRID<8){loadPlot(currentSlot+1);px=0;}
 else if(ny<0 && currentSlot>=GRID){loadPlot(currentSlot-GRID);py=23;}
 else if(ny>=24 && currentSlot<72){loadPlot(currentSlot+GRID);py=0;}
 else message("EDGE OF THIS SNAPSHOT");
 if(currentSlot!=ownSlot)message("VISITING - READ ONLY");
}

void tick(void) {
 u8 key,r;
 __asm di __endasm;
 for(r=0;r<10;++r)currentKeys[r]=Keyboard_Read(r);
 __asm ei __endasm;
 if(noticeFrames)--noticeFrames;
 if(bridge[5]==3){bridge[5]=0;bridge[6]=0;message("SAVED TO THE VILLAGE");}
 else if(bridge[5]==4){bridge[5]=0;message("SAVE FAILED - F5 TO RETRY");}
 else if(bridge[5]==5){bridge[5]=0;message("SAVE CONFLICT - SEE WEBSITE");}
 if(pushed(KEY_F5)) {
  if(bridge[5]!=1 && bridge[5]!=2) {
   if(bridge[4] && ownSlot<81) {bridge[5]=1;message("SAVING...");}
   else message("OFFLINE - CHANGES NOT SAVED");
  }
 }
 if(pushed(KEY_ESC)){if(palette)palette=0;else if(inside){inside=0;px=data()[4]<32?data()[4]:16;py=data()[5]<24?data()[5]:12;}else editing=0;}
 if(pushed(KEY_H)){loadPlot(ownSlot<81?ownSlot:40);px=16;py=12;}
 if(pushed(KEY_RETURN)) {
  if(inside){inside=0;px=data()[4]<32?data()[4]:16;py=data()[5]<24?data()[5]:12;}
  else if(data()[4]==px && data()[5]==py){inside=1;px=16;py=22;editing=0;}
 }
 if(pushed(KEY_F1)) {
  if(currentSlot==ownSlot && bridge[5]!=1 && bridge[5]!=2){editing=!editing;message(editing?"BUILD MODE - F2 CATALOG":"EXPLORING");}
  else message("THIS EXHIBIT IS READ ONLY");
 }
 if(pushed(KEY_F2)){palette=!palette;}
 if(pushed(KEY_F3)){objectMode=!objectMode;selection=0;message(objectMode?"OBJECTS - F2 CATALOG":"TILES - F2 CATALOG");}
 if(moveDelay)--moveDelay;
 else {
  i8 dx=0,dy=0;
  if(pressed(KEY_LEFT))dx=-1;
  else if(pressed(KEY_RIGHT))dx=1;
  else if(pressed(KEY_UP))dy=-1;
  else if(pressed(KEY_DOWN))dy=1;
  if(dx || dy){if(palette){key=objectMode?8:16;selection=(selection+key+dx+dy*8)%key;}else move(dx,dy);moveDelay=2;}
 }
 if(pushed(KEY_SPACE)){if(palette)palette=0;else if(editing)place();}
 if(pushed(KEY_F4) && editing && !palette)erase();
 for(r=0;r<10;++r)previousKeys[r]=currentKeys[r];
 draw();
}

void main(void) {
 u16 i;u8 b;
 objectMode=selection=moveDelay=inside=editing=palette=0;
 for(i=0;i<32;++i)bridge[i]=0;
 bank(4);
 ownSlot=*((const u8*)0xA008);
 if(ownSlot>=81)ownSlot=255;
 for(i=0;i<4;++i)bridge[8+i]=*((const u8*)0xA00C+i);
 bank(5+(ownSlot<81?ownSlot:40));
 Mem_Copy((const void*)0xA000,(void*)ownerData,DATA_SIZE);
 px=16;py=12;loadPlot(ownSlot<81?ownSlot:40);
 VDP_SetMode(VDP_MODE_SCREEN2);VDP_EnableVBlank(TRUE);VDP_ClearVRAM();
 for(b=0;b<3;++b){
  VDP_WriteVRAM_16K((const u8*)patterns,b*0x800,192);
  for(i=0;i<24;++i)VDP_FillVRAM_16K(colors[i],0x2000+b*0x800+i*8,8);
  VDP_WriteVRAM_16K(g_Font_MGL_Sample8+4+32*8,b*0x800+96*8,96*8);
  VDP_FillVRAM_16K(0xf1,0x2000+b*0x800+96*8,96*8);
 }
 VDP_SetSpriteFlag(VDP_SPRITE_SIZE_8);VDP_LoadSpritePattern((const u8*)avatarPattern,0,4);VDP_DisableSpritesFrom(1);
 for(i=0;i<10;++i)previousKeys[i]=255;
 bridge[0]='M';bridge[1]='S';bridge[2]='X';bridge[3]='V';bridge[12]=ownSlot;
 bridge[19]=1;
 message("F1 BUILD  F2 CATALOG  F5 SAVE");
 while(1){Halt();tick();}
}
