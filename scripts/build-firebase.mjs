import {build} from 'esbuild';
await build({entryPoints:['scripts/firebase-entry.js'],bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'vendor/firebase-sdk.js',legalComments:'eof'});
