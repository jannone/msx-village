namespace eval village {
set renderer none
set throttle off
set pause_on_lost_focus off
set save_settings_on_exit false
set violations 0
set VDP.too_fast_vram_access_callback {incr ::village::violations}
proc finish {result} {
 set f [open $::env(VILLAGE_REPORT) w];puts $f $result;close $f;exit
}
proc check {} {
 if {[catch {
  if {[debug read memory 0xe013]!=1} {error "game not ready"}
  if {[debug read_block memory 0xe000 4] ne "MSXV"} {error "bridge signature"}
  if {[debug read memory 0xe00c]!=$::env(VILLAGE_OWN_SLOT)} {error "ownership slot"}
  if {[debug read memory 0xe00d]!=40} {error "start slot"}
  if {[debug read memory 0xd000]!=3} {error "owner data format"}
  if {[debug read memory 0xe010]!=0 || [debug read memory 0xe011]!=0} {error "initial catalog state"}
  if {[debug read VRAM 0x1800]!=0} {error "grass tile VRAM"}
  if {([debug read {VDP regs} 1]&2)==0} {error "sprites are not 16x16"}
  if {[debug read memory 0xe01b]!=3} {error "bridge version"}
  if {$::village::violations!=0} {error "VDP timing violations: $::village::violations"}
  finish "PASS MSX1 boot, mapper, snapshot, ownership; VDP violations=0; refresh=[expr {[debug read {VDP regs} 9]&2 ? 50 : 60}] Hz"
 } result]} {finish "FAIL $result"}
}
after time 8 ::village::check
after time 30 {::village::finish "FAIL timeout"}
}
