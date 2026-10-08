namespace eval interaction {
set renderer none
set throttle off
set pause_on_lost_focus off
set save_settings_on_exit false
set violations 0
set VDP.too_fast_vram_access_callback {incr ::interaction::violations}
proc finish {result} {set f [open $::env(VILLAGE_REPORT) w];puts $f $result;close $f;exit}
proc pause {{duration 0.2}} {after time $duration ::interaction::step;yield}
proc settle {} {for {set n 0} {$n<80} {incr n} {if {[debug read memory $::env(VILLAGE_VAR_redraw)]==0} {return};pause 0.05};error "display did not settle"}
proc key {row mask {duration 0.1}} {settle;if {[read 31]==1} {keymatrixdown 7 4;pause 0.1;keymatrixup 7 4;pause 0.1};keymatrixdown $row $mask;pause $duration;keymatrixup $row $mask;pause 0.05;settle}
proc read {offset} {debug read memory [expr {0xe000+$offset}]}
proc assert {condition message} {if {![uplevel 1 [list expr $condition]]} {error $message}}
proc var {name value} {debug write memory $::env(VILLAGE_VAR_$name) $value}
proc position {x y dir} {var noticeFrames 0;var collisionDirty 1;var redraw 1;var px $x;var py $y;var facing $dir;var speedFraction 0;var walkDistance 0;pause 0.3;settle}
proc select {mode kind} {var objectMode $mode;var selection $kind;var redraw 1;pause 0.1;settle}
proc flat {} {
 for {set i 0} {$i<768} {incr i} {debug write memory [expr {0xd010+$i}] 0}
 for {set i 0} {$i<32} {incr i} {debug write memory [expr {0xd610+$i*3}] 255}
 debug write memory 0xd004 255;debug write memory 0xd005 255
}
proc patternAt {x y expected} {
 set slot [debug read VRAM [expr {0x1800+$y*32+$x}]]
 set bank [expr {($y/8)*2048}]
 return [expr {[debug read_block VRAM [expr {$bank+$slot*8}] 8] eq [debug read_block memory [expr {$::env(VILLAGE_VAR_scenePatterns)+$expected*8}] 8] && [debug read_block VRAM [expr {0x2000+$bank+$slot*8}] 8] eq [debug read_block memory [expr {$::env(VILLAGE_VAR_sceneColors)+$expected*8}] 8]}]
}
proc run {} {
 assert {[read 19]==1 && [read 27]==3} "startup readiness/version"
 assert {([debug read {VDP regs} 1]&2)!=0} "16x16 sprite mode"
 if {$::env(VILLAGE_OWN_SLOT)==255} {
  key 6 0x20;assert {[read 18]==0} "guest entered build mode"
  key 8 1;assert {[read 6]==0} "guest modified a plot"
  finish "PASS guest ownership, 16x16 mode, protocol v3; VDP violations=$::interaction::violations"
 }
 key 7 0x80
 assert {[read 7]==1} "house entry from facing target: x=[read 28] y=[read 29] tx=[read 23] ty=[read 24] room=[read 7] memoryRoom=[debug read memory $::env(VILLAGE_VAR_inside)]"
 key 6 0x20;key 6 0x80;key 8 1
 assert {[debug read memory 0xd670]==0} "interior object placement"
 assert {[debug read memory 0xd671]==17 && [debug read memory 0xd672]==21} "build target must be in front of avatar"
 key 7 0x80;assert {[read 7]==0} "house exit"
 key 6 0x20
 select 0 13
 key 7 1
 assert {[debug read memory 0xd004]==255} "whole entrance removal"
 assert {[debug read memory 0xd670]==0} "entrance removal lost interior"
 flat
 # Isolated RAM scene setup is used for independent collision cases. All tested
 # actions and movement still use real keyboard input against the running ROM.
 for {set avatar 0} {$avatar<4} {incr avatar} {
 debug write memory 0xd001 $avatar
 foreach {direction mask} {0 0x20 1 0x40 2 0x10 3 0x80} {
  position 128 96 $direction
  keymatrixdown 8 $mask;pause 0.12
  set distance [expr {abs([read 28]-128)+abs([read 29]-96)}]
  assert {$distance>0 && $distance<16} "movement must advance pixels, not whole tiles: dir=$direction distance=$distance"
  set frames {};set patterns {};set attribute [expr {[debug read {VDP regs} 5]*128}]
  for {set i 0} {$i<10} {incr i} {pause 0.02;lappend frames [read 21];lappend patterns [debug read VRAM [expr {$attribute+2}]]}
  assert {0 in $frames && 1 in $frames} "two walk frames missing: dir=$direction frames=$frames"
  assert {[expr {$direction*16+8}] in $patterns} "second walk frame was not rendered"
  assert {[read 20]==$direction} "facing direction"
  keymatrixup 8 $mask;pause 0.15
  assert {[read 21]==0 && [read 22]==0 && [read 20]==$direction} "idle animation/facing dir=$direction frame=[read 21] moving=[read 22] facing=[read 20]"
  set attribute [expr {[debug read {VDP regs} 5]*128}]
  assert {[debug read VRAM [expr {$attribute+2}]]==$direction*16} "directional sprite pattern"
  assert {[debug read VRAM [expr {$attribute+6}]]==$direction*16+4} "second color directional pattern"
  assert {[debug read VRAM $attribute]==[debug read VRAM [expr {$attribute+4}]] && [debug read VRAM [expr {$attribute+1}]]==[debug read VRAM [expr {$attribute+5}]]} "avatar layers misaligned"
  assert {[debug read VRAM [expr {$attribute+3}]]==[lindex {15 10 9 7} $avatar] && [debug read VRAM [expr {$attribute+7}]]==[lindex {11 15 11 11} $avatar]} "avatar palette layers"
 }
 }
 debug write memory 0xd001 0
 position 128 96 3
 key 8 0x80 0.5
 set speedDistance [expr {[read 28]-128}]
 assert {$speedDistance>=41 && $speedDistance<=49} "PAL/NTSC movement speed: refresh=[read 30] distance=$speedDistance"
 # A perpendicular turn continues to the next 8-pixel turning point.
 position 129 96 3
 keymatrixdown 8 0x20;pause 0.04
 assert {[read 29]==96 && [read 28]>129} "turn must retain current axis before alignment x=[read 28] y=[read 29] facing=[read 20]"
 pause 0.15;keymatrixup 8 0x20;pause 0.04
 assert {[read 28]%8==0 && [read 29]<96 && [read 20]==0} "aligned turn"
 # Solid and non-solid 2x2 objects, with solid terrain underneath non-solid art.
 debug write memory 0xd610 8;debug write memory 0xd611 18;debug write memory 0xd612 13
 position 128 96 3
 key 8 0x80 0.35
 assert {[read 28]==132} "solid large object collision: x=[read 28]"
 debug write memory 0xd610 11
 position 128 96 3;key 8 0x80 0.35
 assert {[read 28]>144} "non-solid object blocked walking x=[read 28] y=[read 29] facing=[read 20] kind=[debug read memory 0xd610]"
 debug write memory [expr {0xd010+13*32+18}] 3
 position 128 96 3;key 8 0x80 0.35
 assert {[read 28]==132} "non-solid object bypassed solid terrain"
 flat
 # Solid collision from all four approaches, including rectangular trees and cottage pieces.
 foreach kind {0 8 12 13 16 28 29} {
  debug write memory 0xd610 $kind;debug write memory 0xd611 18;debug write memory 0xd612 13
  foreach {direction x y mask} {3 128 96 0x80 2 208 96 0x10 1 144 80 0x40 0 144 160 0x20} {
   position $x $y $direction;keymatrixdown 8 $mask;pause 0.9
   assert {[read 21]==0 && [read 22]==0} "blocked animation while input held"
   keymatrixup 8 $mask;pause 0.15
   set width [debug read memory [expr {$::env(VILLAGE_VAR_objectWidth)+$kind}]]
   set height [debug read memory [expr {$::env(VILLAGE_VAR_objectHeight)+$kind}]]
   set expectedX [expr {$direction==3?132:$direction==2?140+$width*8:$x}]
   set expectedY [expr {$direction==1?88:$direction==0?96+$height*8:$y}]
   assert {[read 28]==$expectedX && [read 29]==$expectedY} "collision approach kind=$kind dir=$direction x=[read 28] y=[read 29] expected=$expectedX,$expectedY"
   assert {[read 21]==0 && [read 22]==0} "blocked walk animation"
  }
 }
 flat
 # A horizontal collision stops at x=132 (not an 8-pixel alignment).
 # Turning away and reversing must work without moving into the obstacle.
 flat
 debug write memory 0xd610 13;debug write memory 0xd611 18;debug write memory 0xd612 13
 position 128 96 3;key 8 0x80 0.4
 assert {[read 28]==132} "escape setup collision"
 key 8 0x20 0.2
 assert {[read 29]<96} "cannot turn away from unaligned collision"
 position 132 96 3;key 8 0x10 0.2
 assert {[read 28]<132} "cannot reverse away from collision"
 flat
 # Every facing direction builds in front, with the whole 2x2 footprint clear.
 foreach direction {0 1 2 3} {
  position 128 96 $direction;select 0 7
  set tileX [read 23];set tileY [read 24]
  key 8 1
  assert {[debug read memory [expr {0xd010+$tileY*32+$tileX}]]==7} "facing tile placement"
  assert {[debug read memory [expr {0xd010+13*32+16}]]==0} "tile placed under feet"
  key 7 1
  assert {[debug read memory [expr {0xd010+$tileY*32+$tileX}]]==0} "facing tile erase"
  select 1 8
  set x [read 23];set y [read 24]
  assert {[read 25]==2 && [read 26]==1} "2x2 preview invalid"
  key 8 1
  assert {[debug read memory 0xd610]==8 && [debug read memory 0xd611]==$x && [debug read memory 0xd612]==$y} "preview differs from placement: dir=$direction"
  assert {!($x*8<140 && ($x+2)*8>132 && $y*8<112 && ($y+2)*8>104)} "placement overlaps player's feet"
  pause 2.1
  assert {[patternAt $x $y 24]} "large object top-left pattern"
  assert {[patternAt [expr {$x+1}] [expr {$y+1}] 27]} "large object bottom-right pattern"
  position [expr {$x*8}] [expr {($y+1)*8}] 0;select 1 4
  assert {[read 23]==$x+1 && [read 24]==$y+1} "target bottom-right quadrant actual=[read 23],[read 24] expected=[expr {$x+1}],[expr {$y+1}] pose=[read 28],[read 29] facing=[read 20] kind=[read 16]"
  key 7 1
  assert {[debug read memory 0xd610]==255} "whole object removal from bottom-right quadrant"
 }
 # Rectangular objects use distinct width/height in targeting and replacement.
 foreach kind {12 13 16 28 29} {
  foreach direction {0 1 2 3} {
   flat;position 128 96 $direction;select 1 $kind
   set tx [read 23];set ty [read 24]
   set w [debug read memory [expr {$::env(VILLAGE_VAR_objectWidth)+$kind}]]
   set h [debug read memory [expr {$::env(VILLAGE_VAR_objectHeight)+$kind}]]
   assert {[read 25]==$w && [read 26]==1} "rectangular preview"
   key 8 1
   assert {[debug read memory 0xd610]==$kind && [debug read memory 0xd611]==$tx && [debug read memory 0xd612]==$ty} "rectangular placement"
   assert {!($tx*8<140 && ($tx+$w)*8>132 && $ty*8<112 && ($ty+$h)*8>104)} "rectangular footprint under feet"
   position [expr {($tx+$w-2)*8}] [expr {($ty+$h-1)*8}] 0;select 1 4
   key 7 1
   assert {[debug read memory 0xd610]==255} "rectangular whole-object erase"
  }
 }
 flat
 position 240 160 3;select 1 8;key 8 1
 assert {[read 26]==0 && [debug read memory 0xd610]==255} "out-of-bounds large placement"
 position 128 96 1;select 0 13;key 8 1
 assert {[debug read memory 0xd004]==16 && [debug read memory 0xd005]==14} "2x2 entrance placement"
 pause 2.1
 assert {[patternAt 16 14 40] && [patternAt 17 15 43]} "2x2 entrance rendering"
 key 7 0x80;assert {[read 7]==1} "new entrance interaction"
 key 7 4;assert {[read 7]==0} "reliable interior escape"
 key 7 2;assert {[read 5]==0 && [read 6]==1} "offline save must preserve edits"
 debug write memory 0xe004 1;key 7 2
 assert {[read 5]==1} "online save request"
 set before [debug read_block memory 0xd000 1744]
 key 8 1;key 7 1
 assert {[debug read_block memory 0xd000 1744] eq $before} "save request permits editing"
 debug write memory 0xe005 3;pause
 assert {[read 6]==0} "save acknowledgement"
 # Cross into an occupied neighbor and verify its furniture plus edit protection.
 position 8 144 2
 key 8 0x10 0.2
 assert {[read 13]==39} "neighbor crossing"
 key 6 0x20;key 8 1;key 7 1
 assert {[read 18]==0 && [read 6]==0} "neighbor exterior ownership"
 position 128 104 0;key 7 0x80
 assert {[read 7]==1} "neighbor house entry"
 pause 2.1
 assert {[patternAt 16 10 19]} "neighbor bank/furniture missing"
 key 6 0x20;key 8 1;key 7 1
 assert {[read 18]==0 && [read 6]==0} "neighbor interior ownership"
 key 7 4;key 3 0x20
 assert {[read 13]==40 && [debug read memory 0xd670]==0} "owner interior lost after visit"
 assert {$::interaction::violations==0} "VDP timing violations"
 finish "PASS pixel walking, aligned turns, four-direction two-frame sprites, solid/non-solid collision, facing build, rectangular trees/cottage pieces, 2x2 door, save freeze, visits; refresh=[read 30]; half-second walk=$speedDistance pixels; VDP violations=0"
}
proc step {} {
 if {[catch {if {[info commands ::interaction::runner] eq ""} {coroutine ::interaction::runner ::interaction::run} else {::interaction::runner}} result]} {finish "FAIL $result\n$::errorInfo"}
}
after time 8 ::interaction::step
after time 240 {::interaction::finish "FAIL timeout"}
}
