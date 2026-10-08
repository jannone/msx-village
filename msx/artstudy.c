#include "msxgl.h"
#include "keyboard.h"
#include "art/herbalist.generated.h"

// Native graphics study. Separate from settlement storage and the save bridge.
volatile __at(0xE100) u8 artStatus[8];
u8 room,x,y,face,frame,distance,fraction,refresh;
u8 keys[10],previous[10];
bool down(u8 key){return !(keys[KEY_ROW(key)]&(1<<KEY_IDX(key)));}
bool push(u8 key){return down(key)&&(previous[KEY_ROW(key)]&(1<<KEY_IDX(key)));}
bool blocked(i16 nx,i16 ny){
 u8 l,r,t,b;
 if(nx<0||nx>240||ny<0||ny>176)return TRUE;
 l=(nx+4)/8;r=(nx+11)/8;t=(ny+8)/8;b=(ny+15)/8;
 return artCollision[room][(u16)t*32+l]||artCollision[room][(u16)t*32+r]||artCollision[room][(u16)b*32+l]||artCollision[room][(u16)b*32+r];
}
void showRoom(void){VDP_WriteVRAM_16K(artMaps[room],0x1800,768);}
void main(void){
 u8 b,r,dir,steps;u16 i;i16 nx,ny;
 room=0;x=120;y=112;face=1;frame=distance=fraction=0;refresh=Sys_Is50Hz()?50:60;
 VDP_SetMode(VDP_MODE_SCREEN2);VDP_SetBackdropColor(1);VDP_EnableVBlank(TRUE);VDP_ClearVRAM();
 for(b=0;b<3;++b){
  VDP_WriteVRAM_16K((const u8*)artPatterns,b*0x800,ART_TILE_COUNT*8);
  VDP_WriteVRAM_16K((const u8*)artColors,0x2000+b*0x800,ART_TILE_COUNT*8);
 }
 VDP_SetSpriteFlag(VDP_SPRITE_SIZE_16);VDP_LoadSpritePattern((const u8*)artSprites,0,64);VDP_DisableSpritesFrom(2);
 for(r=0;r<10;++r)previous[r]=255;
 showRoom();artStatus[0]=1;
 while(1){
  Halt();__asm di __endasm;
  for(r=0;r<10;++r)keys[r]=Keyboard_Read(r);
  __asm ei __endasm;
  if((room&&(push(KEY_RETURN)||push(KEY_ESC)))||(!room&&push(KEY_RETURN)&&x>=112&&x<=132&&y>=72&&y<=96)){
   room=!room;x=120;y=room?128:96;frame=fraction=0;showRoom();
  }
  dir=255;if(down(KEY_LEFT))dir=2;else if(down(KEY_RIGHT))dir=3;else if(down(KEY_UP))dir=0;else if(down(KEY_DOWN))dir=1;
  if(dir!=255){
   if(face<2&&y%8)dir=face;else if(face>=2&&x%8)dir=face;face=dir;
   fraction+=90;steps=fraction/refresh;fraction%=refresh;
   while(steps--){nx=x;ny=y;if(dir==0)--ny;else if(dir==1)++ny;else if(dir==2)--nx;else ++nx;
    if(blocked(nx,ny)){frame=0;break;}x=nx;y=ny;if(++distance>=8){distance=0;frame=!frame;}
   }
  }else{frame=0;fraction=0;}
  VDP_SetSpriteSM1(0,x,y-1,(face*2+frame)*8,4);
  VDP_SetSpriteSM1(1,x,y-1,(face*2+frame)*8+4,11);
  artStatus[1]=room;artStatus[2]=x;artStatus[3]=y;artStatus[4]=face;artStatus[5]=frame;artStatus[6]=refresh;
  for(i=0;i<10;++i)previous[i]=keys[i];
 }
}
