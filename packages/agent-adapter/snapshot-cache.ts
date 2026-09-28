/** Cache is an observation optimization only; mutation paths always revalidate. */
export class SnapshotCache{
 private value?:{revision:number;refs:Record<string,any>;snapshot:string};
 clear(){this.value=undefined;}
 apply(data:any){const s=data.snapshot;if(typeof s==='string')return data;
  if(s?.kind==='full'){this.value={revision:s.revision,refs:s.refs||{},snapshot:s.tree||''};return {...data,...this.value};}
  if(s?.kind==='unchanged'&&this.value&&this.value.revision===s.baseRevision){this.value.revision=s.revision;return {...data,...this.value};}
  // Unknown/missing baselines must be refreshed, never interpreted as unchanged.
  return undefined;
 }
}
