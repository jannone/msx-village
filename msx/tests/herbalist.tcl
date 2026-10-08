namespace eval herbalist {
set renderer none
set throttle off
set pause_on_lost_focus off
set save_settings_on_exit false
set violations 0
set VDP.too_fast_vram_access_callback {incr ::herbalist::violations}
proc finish {result} {set f [open $::env(VILLAGE_REPORT) w];puts $f $result;close $f;exit}
proc pause {{duration 0.2}} {after time $duration ::herbalist::step;yield}
proc var {name value} {debug write memory $::env(VILLAGE_VAR_$name) $value}
proc check {condition message} {if {![uplevel 1 [list expr $condition]]} {error $message}}
proc settle {} {for {set n 0} {$n<100} {incr n} {pause 0.05;if {[debug read memory $::env(VILLAGE_VAR_redraw)]==0} {return}};error "redraw timeout"}
proc key {row mask} {keymatrixdown $row $mask;pause 0.2;keymatrixup $row $mask;pause 0.3;settle}
proc graphics {room} {
 foreach {name start} {patterns 0 colors 8192} {
  set f [open $::env(VILLAGE_HERBALIST_OUTPUT)/$room-$name.bin rb];set bytes [read $f];close $f
  for {set cell 0} {$cell<768} {incr cell} {
   set slot [debug read VRAM [expr {0x1800+$cell}]]
   set actual [debug read_block VRAM [expr {$start+($cell/256)*2048+$slot*8}] 8]
   check {$actual eq [string range $bytes [expr {$cell*8}] [expr {$cell*8+7}]]} "study/production $name mismatch room=$room cell=$cell"
  }
 }
}
proc capture {room} {
 set renderer SDLGL;set throttle on;pause 0.3
 screenshot -raw $::env(VILLAGE_HERBALIST_OUTPUT)/[file rootname [file tail $::env(VILLAGE_REPORT)]]-$room.png
 set throttle off
}
proc run {} {
 check {[debug read memory 0xe013]==1} "startup"
 var px 120;var py 112;var facing 1;pause
 graphics 0;capture exterior
 # Enter and exit through the production interaction path.
 var px 120;var py 80;var facing 0;pause;key 7 128
 check {[debug read memory 0xe007]==1} "door entry"
 graphics 1;capture interior
 key 6 64;check {[debug read memory 0xe01f]==2} "catalog opening"
 key 7 4;check {[debug read memory 0xe007]==1} "catalog dismissal also exited house"
 graphics 1
 key 7 2;check {[debug read memory 0xe01f]==1} "bottom panel"
 key 7 4;graphics 1
 key 7 4;check {[debug read memory 0xe007]==0} "house exit"
 graphics 0
 # New terrain is available in the production catalog and written as storage IDs.
 var px 96;var py 112;var facing 1;var selection 19
 key 6 64;check {[debug read memory 0xe010]==19} "soil catalog entry"
 key 8 128;check {[debug read memory 0xe010]==20} "eaves catalog entry"
 key 8 1;key 6 32;key 8 1
 set x [debug read memory 0xe017];set y [debug read memory 0xe018]
 check {[debug read memory [expr {0xd010+$y*32+$x}]]==20} "new terrain placement"
 check {$::herbalist::violations==0} "VRAM timing"
 finish "PASS production pixels match both complete study rooms, entrance/exit, text restoration, expanded terrain catalog and placement; VDP violations=0"
}
proc step {} {if {[catch {if {[info commands ::herbalist::flow] eq ""} {coroutine ::herbalist::flow ::herbalist::run} else {::herbalist::flow}} result]} {finish "FAIL $result\n$::errorInfo"}}
after time 8 ::herbalist::step
after time 100 {::herbalist::finish "FAIL timeout"}
}
