namespace eval art {
set renderer none
set throttle off
set save_settings_on_exit false
set pause_on_lost_focus off
set violations 0
set VDP.too_fast_vram_access_callback {incr ::art::violations}
proc finish {text} {set f [open $::env(VILLAGE_ART_REPORT) w];puts $f $text;close $f;exit}
proc pause {{seconds 0.2}} {after time $seconds ::art::step;yield}
proc check {condition message} {if {![uplevel 1 [list expr $condition]]} {error $message}}
proc pos {x y facing} {
 foreach {name value} [list x $x y $y face $facing fraction 0] {debug write memory $::env(VILLAGE_ART_VAR_$name) $value}
}
proc capture {name} {
 set renderer SDLGL;set throttle on
 pause 0.3
 screenshot -raw $::env(VILLAGE_ART_OUTPUT)/$::env(VILLAGE_ART_MACHINE)-$name.png
 set throttle off
}
proc run {} {
 check {[debug read memory 0xe100]==1} "study not ready"
 check {[debug read memory 0xe106]==$::env(VILLAGE_ART_REFRESH)} "incorrect BIOS refresh rate"
 check {([debug read {VDP regs} 1]&2)!=0} "sprite size"
 check {[debug read VRAM 0x1b03]==4&&[debug read VRAM 0x1b07]==11} "avatar layers"
 foreach {filename start} {patterns.bin 0 colors.bin 8192} {
  set f [open $::env(VILLAGE_ART_OUTPUT)/$filename rb];set expected [read $f];close $f
  for {set b 0} {$b<3} {incr b} {check {[debug read_block VRAM [expr {$start+$b*2048}] [string length $expected]] eq $expected} "pattern/color upload mismatch"}
 }
 capture exterior
 foreach {direction mask} {0 32 1 64 2 16 3 128} {
  pos 120 104 $direction
  keymatrixdown 8 $mask;pause 0.1
  check {[debug read memory 0xe104]==$direction} "avatar facing"
  set frames {}
  for {set n 0} {$n<12} {incr n} {lappend frames [debug read memory 0xe105];pause 0.02}
  keymatrixup 8 $mask;pause
  check {[llength [lsort -unique $frames]]==2} "two walking frames"
 }
 pos 120 112 1;pause
 set before [debug read memory 0xe103]
 keymatrixdown 8 64;pause 0.4;keymatrixup 8 64;pause
 set delta [expr {[debug read memory 0xe103]-$before}]
 check {$delta>=33&&$delta<=38} "walking speed: $delta"
 pos 120 96 0
 keymatrixdown 8 32;pause 0.15;keymatrixup 8 32;pause
 keymatrixdown 7 128;pause;keymatrixup 7 128;pause
 check {[debug read memory 0xe101]==1} "entrance failed"
 capture interior
 pos 144 88 3
 keymatrixdown 8 128;pause 0.4;keymatrixup 8 128;pause
 check {[debug read memory 0xe102]==148} "solid table collision"
 check {[debug read memory 0xe105]==0} "blocked walk animation"
 keymatrixdown 7 4;pause;keymatrixup 7 4;pause
 check {[debug read memory 0xe101]==0} "interior exit failed"
 check {$::art::violations==0} "unsafe VRAM writes: $::art::violations"
 finish "PASS art study; pattern/color bytes verified; movement, collision, entrance/exit; refresh=$::env(VILLAGE_ART_REFRESH); VDP violations=0"
}
proc step {} {if {[catch {if {[info commands ::art::flow] eq ""} {coroutine ::art::flow ::art::run} else {::art::flow}} message]} {finish "FAIL $message"}}
after time 8 ::art::step
after time 35 {::art::finish "FAIL timeout"}
}
