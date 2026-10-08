namespace eval avatar {
set renderer none
set throttle off
set pause_on_lost_focus off
set save_settings_on_exit false
set violations 0
set VDP.too_fast_vram_access_callback {incr ::avatar::violations}
proc finish {result} {set f [open $::env(VILLAGE_REPORT) w];puts $f $result;close $f;exit}
proc pause {{duration 0.2}} {after time $duration ::avatar::step;yield}
proc var {name value} {debug write memory $::env(VILLAGE_VAR_$name) $value}
proc check {condition message} {if {![uplevel 1 [list expr $condition]]} {error $message}}
proc budget {} {
 for {set line 0} {$line<192} {incr line} {
  set count 0
  for {set slot 0} {$slot<32} {incr slot} {
   set y [debug read VRAM [expr {0x1b00+$slot*4}]]
   if {$y==208} {break}
   if {$line>$y && $line<=$y+16} {incr count}
  }
  check {$count<=4} "sprite overflow on scanline $line: $count"
 }
}
proc run {} {
 check {[debug read memory 0xe013]==1} "game not ready"
 check {[debug read_block VRAM 0x3800 896] eq [debug read_block memory $::env(VILLAGE_VAR_avatarPatterns) 896]} "sprite patterns differ from artwork"
 # Both masks must contain visible pixels and must not occlude each other.
 for {set frame 0} {$frame<8} {incr frame} {
  binary scan [debug read_block VRAM [expr {0x3800+$frame*64}] 32] cu* body
  binary scan [debug read_block VRAM [expr {0x3820+$frame*64}] 32] cu* detail
  check {[lsearch -not -exact $body 0]>=0 && [lsearch -not -exact $detail 0]>=0} "empty avatar layer"
  foreach b $body d $detail {check {($b & $d)==0} "avatar layers occlude"}
 }
 var px 120;var py 112;var facing 1
 for {set color 0} {$color<4} {incr color} {
  debug write memory 0xd001 $color;pause
  check {[debug read VRAM 0x1b03]==[lindex {15 10 9 7} $color] && [debug read VRAM 0x1b07]==[lindex {11 15 11 11} $color]} "palette mismatch"
  if {[string match *C-BIOS_MSX1-demo-avatar.txt $::env(VILLAGE_REPORT)]} {
   set renderer SDLGL;set throttle on;pause 0.3
   screenshot -raw [file dirname $::env(VILLAGE_REPORT)]/avatar-$color.png
   set throttle off
  }
 }
 # Test every catalog footprint in every facing, including invalid placement.
 var editing 1;var objectMode 1
 for {set object 0} {$object<32} {incr object} {
  var selection $object
  for {set direction 0} {$direction<4} {incr direction} {
   var facing $direction;pause 0.05;budget
   check {[debug read VRAM 0x1b00]==111 && [debug read VRAM 0x1b04]==111} "cursor overwrote avatar"
  }
 }
 check {$::avatar::violations==0} "unsafe VRAM access"
 finish "PASS two non-overlapping avatar layers, four palettes, all cursor footprints/directions <=4 sprites per scanline; VDP violations=0"
}
proc step {} {if {[catch {if {[info commands ::avatar::flow] eq ""} {coroutine ::avatar::flow ::avatar::run} else {::avatar::flow}} result]} {finish "FAIL $result\n$::errorInfo"}}
after time 8 ::avatar::step
after time 80 {::avatar::finish "FAIL timeout"}
}
