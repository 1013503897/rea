import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import { ChildProcess } from 'node:child_process';
const log = facts => {
  try { appendFileSync(process.env.REA_HOPPER_PROBE_LOG, JSON.stringify({at:Date.now(),pid:process.pid,...facts})+'\n'); }
  catch { /* Diagnostic failure must not change installer behavior. */ }
};
log({event:'runtime',uid:process.getuid?.(),version:process.version,execPath:process.execPath});
const originalSpawn = ChildProcess.prototype.spawn;
ChildProcess.prototype.spawn = function(options) {
  const started=performance.now();
  const file=typeof options?.file==='string'?basename(options.file):'unknown';
  this.once('exit',(code,signal)=>log({event:'child_exit',childPid:this.pid,file,code,signal,elapsedMs:performance.now()-started}));
  this.once('error',error=>log({event:'child_error',file,name:error?.name,code:error?.code,elapsedMs:performance.now()-started}));
  const result=originalSpawn.call(this,options);
  log({event:'child_spawn',childPid:this.pid,file});
  return result;
};
const originalFetch=globalThis.fetch;
globalThis.fetch=async (input,options)=>{
  const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  if(new URL(url).hostname!=='www.hopperapp.com')return originalFetch(input,options);
  const started=performance.now();
  log({event:'fetch_start',url});
  try {
    const response=await originalFetch(input,options);
    log({event:'fetch_headers',url,status:response.status,contentLength:response.headers.get('content-length'),contentType:response.headers.get('content-type'),retryAfter:response.headers.get('retry-after'),elapsedMs:performance.now()-started});
    return response;
  } catch(error) {
    log({event:'fetch_error',url,name:error?.name,code:error?.code,causeName:error?.cause?.name,causeCode:error?.cause?.code,elapsedMs:performance.now()-started});
    throw error;
  }
};
