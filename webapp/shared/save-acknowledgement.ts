import { BRIDGE_ADDRESS } from './settlement.ts';
export interface SaveMemory { write(address:number,value:number):void }

/** A confirmed write stays successful even if refreshing account details fails. */
export function acknowledgeSavedRevision(
  memory:SaveMemory,
  revision:number,
  refresh:()=>Promise<unknown>,
  onRefreshFailure:()=>void,
):void {
  for(let i=0;i<4;i++)memory.write(BRIDGE_ADDRESS+8+i,(revision>>>(i*8))&255);
  memory.write(BRIDGE_ADDRESS+5,3);
  void Promise.resolve().then(refresh).catch(onRefreshFailure);
}
