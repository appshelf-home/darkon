// one-way (14): gzip is unpacked here only - bytes in, bytes out (memory-maps.js reads its packed map data through it too)
async function gunzipBytes(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }
