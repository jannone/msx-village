namespace eval display {
set renderer none
set throttle off
set save_settings_on_exit false
set pause_on_lost_focus off
set violations 0
set VDP.too_fast_vram_access_callback {incr ::display::violations}
proc finish {result} {set f [open $::env(VILLAGE_REPORT) w];puts $f $result;close $f;exit}
proc pause {{duration 0.2}} {after time $duration ::display::step;yield}
proc settle {} {for {set n 0} {$n<80} {incr n} {if {[debug read memory $::env(VILLAGE_VAR_redraw)]==0} {return};pause 0.05};error "display did not settle"}
proc key {row mask} {
 settle;keymatrixdown $row $mask;pause;keymatrixup $row $mask
 # A redraw can outlast the key pulse. Wait for the game to sample key-up,
 # rather than letting the next action inherit the preceding pressed edge.
 for {set n 0} {$n<80} {incr n} {
  pause 0.05
  if {([debug read memory [expr {$::env(VILLAGE_VAR_previousKeys)+$row}]] & $mask)==$mask} {settle;return}
 }
 error "key release was not sampled"
}
proc read {offset} {debug read memory [expr {0xe000+$offset}]}
proc var {name value} {debug write memory $::env(VILLAGE_VAR_$name) $value}
proc check {condition message} {if {![uplevel 1 [list expr $condition]]} {error $message}}
proc graphics {} {return [list [debug read_block VRAM 0 6144] [debug read_block VRAM 0x2000 6144] [debug read_block VRAM 0x1800 768]]}
proc run {} {
 check {[read 19]==1 && [read 31]==0} "text-free startup"
 check {[read 30] in {50 60}} "refresh"
 for {set b 0} {$b<3} {incr b} {
  binary scan [debug read_block VRAM [expr {$b*2048+96*8}] 768] cu* bytes
  check {[lsort -unique $bytes] eq "0"} "font resident in scene"
 }
 # Different terrain across all sections, with a large object crossing row 16.
 if {$::env(VILLAGE_OWN_SLOT)!=255} {
  for {set i 0} {$i<768} {incr i} {debug write memory [expr {0xd010+$i}] [expr {$i%13}]}
  debug write memory 0xd610 8;debug write memory 0xd611 20;debug write memory 0xd612 15
  var redraw 1;var collisionDirty 1;pause;settle
 }
 set original [graphics];set data [debug read_block memory 0xd000 1744]
 for {set cycle 0} {$cycle<3} {incr cycle} {
  # Offline save opens only the bottom third. Position sprite across its edge.
  var px 120;var py 120;pause
  key 7 2
  check {[read 31]==1} "bottom panel missing"
  check {[debug read_block VRAM 0 4096] eq [string range [lindex $original 0] 0 4095]} "top patterns modified"
  check {[debug read_block VRAM 0x2000 4096] eq [string range [lindex $original 1] 0 4095]} "top colors modified"
  check {[debug read_block VRAM 0x1800 512] eq [string range [lindex $original 2] 0 511]} "top scene modified"
  check {[debug read VRAM 0x1b00]==212 && [debug read VRAM 0x1b04]==212} "sprite leaks over panel"
  set x [read 28];set y [read 29]
  key 8 128;key 6 32;key 7 1
  check {[read 28]==$x && [read 29]==$y} "walking behind panel"
  check {[debug read_block memory 0xd000 1744] eq $data} "panel modified settlement"
  key 8 1
  check {[read 31]==0 && [graphics] eq $original} "bottom section restoration"
  key 6 64
  check {[read 31]==2} "catalog not fullscreen"
  check {[debug read VRAM 0x1b00]==212} "avatar visible over catalog"
  key 8 128;key 6 128;key 8 64
  check {[read 28]==$x && [read 29]==$y} "walking behind catalog"
  key 7 4
  check {[read 31]==0 && [graphics] eq $original} "catalog restoration"
 }
 # A save result interrupts the catalog; dismiss restores all three banks.
 key 6 64
 debug write memory 0xe005 4;pause 0.6;settle
 check {[read 31]==1} "error did not replace catalog"
 key 7 128
 check {[read 31]==0 && [graphics] eq $original} "catalog to panel to scene restoration"
 check {[debug read_block memory 0xd000 1744] eq $data} "dismissal changed data"
 # Interior path uses the same reconstruction, not stale exterior graphics.
 var inside 1;var redraw 1;var collisionDirty 1;pause;settle
 set interior [graphics]
 key 6 64;key 8 1
 check {[read 7]==1} "catalog dismissal exited interior"
 check {[read 31]==0} "interior catalog did not dismiss"
 check {[graphics] eq $interior} "interior restoration"
 key 7 2;key 7 4
 check {[read 7]==1 && [graphics] eq $interior} "panel dismiss also exited house"
 check {$::display::violations==0} "unsafe VRAM access"
 finish "PASS text-free scene, modal bottom/fullscreen UI, bank restoration, sprites, data preservation; refresh=[read 30]; VDP violations=0"
}
proc step {} {if {[catch {if {[info commands ::display::flow] eq ""} {coroutine ::display::flow ::display::run} else {::display::flow}} result]} {finish "FAIL $result\n$::errorInfo"}}
after time 8 ::display::step
after time 150 {::display::finish "FAIL timeout"}
}
