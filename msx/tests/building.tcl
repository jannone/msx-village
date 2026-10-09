namespace eval building {
set renderer none
set throttle off
set save_settings_on_exit false
set pause_on_lost_focus off
set violations 0
set worst 0
set VDP.too_fast_vram_access_callback {incr ::building::violations}
proc finish {result} {set f [open $::env(VILLAGE_REPORT) w];puts $f $result;close $f;exit}
proc pause {{duration 0.05}} {after time $duration ::building::step;yield}
proc check {condition message} {if {![uplevel 1 [list expr $condition]]} {error $message}}
proc var {name value} {debug write memory $::env(VILLAGE_VAR_$name) $value}
proc read {offset} {debug read memory [expr {0xe000+$offset}]}
proc settle {} {for {set i 0} {$i<100} {incr i} {pause;if {[debug read memory $::env(VILLAGE_VAR_redraw)]==0} {return}};error "redraw timeout"}
proc key {row mask} {keymatrixdown $row $mask;pause 0.1;keymatrixup $row $mask;settle}
proc setup {x y facing mode selection} {
 var px $x;var py $y;var facing $facing;var editing 1
 var objectMode $mode;var selection $selection;pause
}
proc edit {row mask} {
 set patterns [debug read_block VRAM 0 6144]
 set colors [debug read_block VRAM 0x2000 6144]
 set start [machine_info time]
 keymatrixdown $row $mask
 for {set i 0} {$i<500} {incr i} {
  pause 0.001
  check {([debug read {VDP regs} 1]&64)!=0} "edit blanked display"
  check {[debug read VRAM 0x1b00]!=212 && [debug read VRAM 0x1b04]!=212} "edit hid avatar"
  if {([debug read memory [expr {$::env(VILLAGE_VAR_previousKeys)+$row}]]&$mask)==0 && [debug read memory $::env(VILLAGE_VAR_redraw)]==0} {break}
 }
 set elapsed [expr {[machine_info time]-$start}]
 set ::building::worst [expr {max($::building::worst,$elapsed)}]
 check {$elapsed<0.2} "edit took $elapsed seconds"
 keymatrixup $row $mask;pause
 check {[debug read_block VRAM 0 6144] eq $patterns && [debug read_block VRAM 0x2000 6144] eq $colors} "edit reloaded pattern/color tables"
 # Compare every cell, catching old object quadrants and entrance leftovers
 # outside the placement footprint, including edits crossing SCREEN 2 sections.
 check {[debug read_block VRAM 0x1800 768] eq [debug read_block memory $::env(VILLAGE_VAR_screen) 768]} "incomplete scene update"
 check {[read 31]==0} "edit opened a panel"
}
proc run {} {
 settle
 check {[read 30]==$::env(VILLAGE_EXPECTED_REFRESH)} "refresh"
 if {$::env(VILLAGE_OWN_SLOT)==255} {finish "PASS visitor startup; refresh=[read 30]"}
 debug write memory 0xd004 255;debug write memory 0xd005 255
 var collisionDirty 1;var redraw 1;settle
 # Large placements cross row 8 and row 16. Replacement and erase must clear
 # the complete previous footprint, even when only one quadrant is targeted.
 foreach y {48 112} {
  setup 128 $y 1 1 0;edit 8 1
  check {[debug read memory 0xd610]==0} "oak placement"
  setup 128 $y 1 1 3;edit 8 1
  check {[debug read memory 0xd610]==3} "whole oak replacement"
  setup 128 $y 1 0 22;edit 8 1
  edit 7 1
  check {[debug read memory 0xd610]==255} "whole object erase"
 }
 setup 128 48 1 1 16;edit 8 1
 setup 128 48 1 0 13;edit 8 1
 check {[debug read memory 0xd610]==255} "entrance did not remove intersecting roof"
 setup 32 112 1 0 13;edit 8 1
 check {[debug read memory 0xd004]==4} "entrance relocation"
 # Erasing a bottom-right entrance cell clears all four cells at the old anchor.
 setup 32 128 0 0 0;edit 7 1
 check {[debug read memory 0xd004]==255} "whole entrance erase"
 key 6 64;check {[read 31]==2} "catalog missing"
 key 7 4;check {[read 31]==0} "catalog restoration"
 setup 128 112 1 1 18;edit 8 1
 edit 7 1
 check {$::building::violations==0} "unsafe VRAM access"
 finish "PASS visible edits, unchanged art tables, complete replacement/erase, section crossings, entrance relocation, catalog restoration; refresh=[read 30]; worst edit=$::building::worst seconds; VDP violations=0"
}
proc step {} {if {[catch {if {[info commands ::building::flow] eq ""} {coroutine ::building::flow ::building::run} else {::building::flow}} result]} {finish "FAIL $result\n$::errorInfo"}}
after time 8 ::building::step
after time 90 {::building::finish "FAIL timeout"}
}
