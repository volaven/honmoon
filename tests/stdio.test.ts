import test from 'node:test';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {guardBrokenPipe} from '../main/stdio.js';
test('a closed GUI launcher output pipe does not crash the app; unrelated errors remain visible',()=>{const output=new Writable({write(_chunk,_encoding,done){done();}});guardBrokenPipe(output);assert.doesNotThrow(()=>output.emit('error',Object.assign(new Error('broken pipe'),{code:'EPIPE'})));assert.throws(()=>output.emit('error',Object.assign(new Error('other failure'),{code:'EIO'})),/other failure/);output.destroy();});
