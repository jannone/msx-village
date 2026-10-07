namespace eval interaction {
set renderer none
set throttle off
set pause_on_lost_focus off
set save_settings_on_exit false
set violations 0
set VDP.too_fast_vram_access_callback {incr ::interaction::violations}
proc finish {result} {set f [open $::env(VILLAGE_REPORT) w];puts $f $result;close $f;exit}
proc pause {{duration 0.2}} {after time $duration ::interaction::step;yield}
proc key {row mask {duration 0.2}} {keymatrixdown $row $mask;pause $duration;keymatrixup $row $mask;pause}
proc read {offset} {debug read memory [expr {0xe000+$offset}]}
proc assert {condition message} {if {![uplevel 1 [list expr $condition]]} {error $message}}
proc run {} {
 assert {[read 19]==1} "startup readiness"
 if {$::env(VILLAGE_OWN_SLOT)==255} {
  key 6 0x20
  assert {[read 18]==0} "guest can enter build mode"
  key 8 1
  assert {[read 6]==0} "guest can modify a plot"
 } else {
  key 7 0x80
  assert {[read 7]==1} "house entry"
  key 6 0x20
  assert {[read 18]==1} "interior build mode"
  keymatrixdown 6 0x80
  pause 0.3
  assert {[read 17]==1} "object mode selection"
  keymatrixup 6 0x80
  pause
  key 8 1
  assert {[debug read memory 0xd670]==0} "interior object placement: mode=[read 17] editing=[read 18] inside=[read 7] dirty=[read 6] x=[read 14] y=[read 15] kind=[debug read memory 0xd670]"
  assert {[read 6]==1} "dirty flag"
  key 7 0x80
  assert {[read 7]==0} "interior exit"
  key 6 0x80
  key 7 1
  assert {[debug read memory 0xd004]==255} "entrance removal"
  assert {[debug read memory 0xd670]==0} "entrance removal lost interior"
  key 7 2
  assert {[read 5]==0} "offline save requested persistence"
  assert {[read 6]==1} "offline save cleared dirty edits"
  debug write memory 0xe004 1
  key 7 2
  assert {[read 5]==1} "online save request"
  key 7 1
  assert {[debug read memory 0xd670]==0} "save request corrupted interior"
  debug write memory 0xe005 3
  pause
  assert {[read 6]==0} "save acknowledgement"
  key 8 0x10 6
  assert {[read 13]!=40} "neighbor crossing: slot=[read 13] x=[read 14] y=[read 15]"
  key 6 0x20
  assert {[read 18]==0} "visitor entered build mode"
  key 8 1
  assert {[read 6]==0} "visitor edited owner data"
  key 3 0x20
  assert {[read 13]==40} "home navigation"
  assert {[debug read memory 0xd670]==0} "owner interior lost on visit"
 }
 assert {$::interaction::violations==0} "VDP timing violations"
 finish "PASS house, objects, entrance preservation, offline save, save handshake, neighbor ownership; VDP violations=0"
}
proc step {} {
 if {[catch {
  if {[info commands ::interaction::runner] eq ""} {coroutine ::interaction::runner ::interaction::run} else {::interaction::runner}
 } result]} {finish "FAIL $result\n$::errorInfo"}
}
after time 8 ::interaction::step
after time 45 {::interaction::finish "FAIL timeout"}
}
