const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const ctx=vm.createContext({URL,Set,Date,Error,String,Number,Array,R:(body,status=200)=>({body,status})});
const server=fs.readFileSync(require('node:path').join(__dirname,'../supabase/functions/hospitalito-services/index.ts'),'utf8');
vm.runInContext(stripTypeScriptTypes(server.slice(server.indexOf('const HC286_DEFAULT_PORTALS'),server.indexOf('Deno.serve'))),ctx);
const rows=new Map(),clone=v=>v&&JSON.parse(JSON.stringify(v));
const db={from(){let filters={},operation='',row;const q={select(){return q},eq(k,v){filters[k]=v;return q},maybeSingle:async()=>({data:clone(rows.get(filters.institution_id)||null)}),update(v){operation='update';row=v;return q},insert(v){operation='insert';row=v;return q},then(resolve,reject){const id=filters.institution_id||row?.institution_id,old=rows.get(id);let data=[],error=null;if(operation==='insert'){if(old)error={code:'23505'};else{rows.set(id,clone(row));data=[{revision:row.revision}]}}if(operation==='update'&&old&&old.revision===filters.revision){rows.set(id,{...old,...clone(row)});data=[{revision:row.revision}]}return Promise.resolve({data,error}).then(resolve,reject)}};return q}};
(async()=>{
 const doctor={username:'qa-doctor',role:'medico'},observer={username:'qa-observer',role:'observador'},config={portals:[{id:'portal1',name:'Portal ficticio',url:'https://images.example.org/view'}],activeId:'portal1'};
 const initial=await ctx.hc286ImagePortals(db,doctor,'institution-A',{action:'imagePortals'});assert.equal(initial.body.revision,0);assert.equal(initial.body.config.portals[0].name,'Informe Médico');
 const saved=await ctx.hc286ImagePortals(db,doctor,'institution-A',{action:'saveImagePortals',revision:0,config});assert.equal(saved.body.revision,1);assert.equal(saved.body.config.activeId,'portal1');
 const other=await ctx.hc286ImagePortals(db,doctor,'institution-B',{action:'imagePortals'});assert.equal(other.body.revision,0);assert.notEqual(other.body.config.activeId,'portal1');
 assert.equal((await ctx.hc286ImagePortals(db,observer,'institution-A',{action:'imagePortals'})).body.canManage,false);
 await assert.rejects(()=>ctx.hc286ImagePortals(db,observer,'institution-A',{action:'saveImagePortals',revision:1,config}),/puede elegir/);
 await assert.rejects(()=>ctx.hc286ImagePortals(db,{...doctor,role:'contabilidad'},'institution-A',{action:'imagePortals'}),/no accede/);
 const conflict=await ctx.hc286ImagePortals(db,doctor,'institution-A',{action:'saveImagePortals',revision:0,config});assert.equal(conflict.status,409);assert.equal(rows.get('institution-A').revision,1);
 for(const url of ['javascript:alert(1)','data:text/html,hello','https://user:password@example.org/'])assert.throws(()=>ctx.hc286CleanPortals({portals:[{id:'x',name:'x',url}],activeId:'x'}));
 assert.throws(()=>ctx.hc286CleanPortals({portals:[{id:'x',name:'x',url:'https://example.org/'},{id:'y',name:'y',url:'https://example.org/'}],activeId:'x'}));
 console.log('PASS portal configuration: institutional isolation, role restrictions, CAS conflict, remembered default, URL schemes, credentials and duplicate validation.');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
