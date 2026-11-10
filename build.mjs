import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { transformAsync } from '@babel/core';
import jsx from '@babel/plugin-transform-react-jsx';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const bundle=await rollup({input:path.join(root,'src/main.jsx'),plugins:[
 {name:'jsx-and-css',async transform(code,id){if(id.endsWith('.css'))return {code:'',map:null};if(id.endsWith('.jsx'))return (await transformAsync(code,{filename:id,plugins:[[jsx,{runtime:'automatic'}]],sourceMaps:true}));}},
 {name:'production-mode',transform(code,id){if(id.includes('node_modules'))return {code:code.replace(/process\.env\.NODE_ENV/g,JSON.stringify('production')),map:null};}},
 nodeResolve({browser:true,extensions:['.mjs','.js','.jsx','.json']}),commonjs()
],onwarn(warning,warn){if(warning.code!=='MODULE_LEVEL_DIRECTIVE')warn(warning);}});
await mkdir(path.join(root,'dist/assets'),{recursive:true});
await bundle.write({file:path.join(root,'dist/assets/app.js'),format:'es',sourcemap:false});await bundle.close();
await copyFile(path.join(root,'src/style.css'),path.join(root,'dist/assets/style.css'));
await writeFile(path.join(root,'dist/index.html'),'<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="theme-color" content="#163e37"><title>Pulse · Leads</title><link rel="stylesheet" href="/assets/style.css"></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>');
console.log('Dashboard compilada com sucesso.');
