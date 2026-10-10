const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(require('node:path').join(__dirname,'../supabase/functions/hospitalito-care/index.ts'),'utf8').replace(/^import[^\n]*\n/gm,''));
const clone=x=>JSON.parse(JSON.stringify(x));
const now='2026-10-10T14:00:00';
const old={id:'old',drugId:'old',drugName:'Medicamento anterior',updatedAt:now,pendingNurseAt:now,pendingNurseAlert:true,nurseSeenAt:'',administrationRecords:[]};
const tables={hc_state:[{institution_id:'fixture',bucket:'clinical',record_id:'p_fixture::prescripciones',payload:{value:{infusionesContinuas:[old]}},revision:1,sync_seq:1,deleted:false,sort_index:0}]};
let reads=0,release,barrier=new Promise(r=>release=r),collisionCount=0;
function db(){return {from(name){const q={filters:[],kind:'select',values:null,multiple:false,max:Infinity,
 select(){return this},eq(k,v){this.filters.push(x=>x[k]===v);return this},gt(k,v){this.filters.push(x=>x[k]>v);return this},in(k,v){this.filters.push(x=>v.includes(x[k]));return this},not(k,op,v){const a=v.slice(1,-1).split(',');this.filters.push(x=>!a.includes(x[k]));return this},order(){return this},limit(n){this.max=n;return this},update(v){this.kind='update';this.values=v;return this},insert(v){this.kind='insert';this.values=v;return this},upsert(v){this.kind='upsert';this.values=v;return this},
 async run(one=false){const rows=tables[name]||[],found=rows.filter(x=>this.filters.every(f=>f(x))).slice(0,this.max);let result=clone(found);
 if(this.kind==='select'&&one&&reads<2){reads++;if(reads===2)release();await barrier;}
 if(this.kind==='update'){if(!found.length)collisionCount++;found.forEach(x=>Object.assign(x,this.values,{revision:x.revision+1,sync_seq:x.sync_seq+1}));result=clone(found);}
 if(this.kind==='insert')rows.push({...this.values,revision:1,sync_seq:1});
 return {data:one?(result[0]||null):result,error:null};},maybeSingle(){return this.run(true)},then(a,b){return this.run().then(a,b)}};return q;}};}
const c=vm.createContext({console,crypto:globalThis.crypto,TextEncoder,Uint8Array,Date,Response,Request,Deno:{serve(){},env:{get(){return ''}}},createClient:db});vm.runInContext(source,c);c.client=db();
(async()=>{
 c.med={bucket:'clinical',record_id:'p_fixture::prescripciones',payload:{value:{infusionesContinuas:[old,{id:'amlodipina-test',drugId:'test',drugName:'Amlodipina de prueba',updatedAt:'2026-10-10T14:10:00',pendingNurseAt:'2026-10-10T14:10:00',pendingNurseAlert:true}]}},deleted:false,sort_index:0,writer:'medico'};
 c.nurse={bucket:'clinical',record_id:'p_fixture::prescripciones',payload:{value:{infusionesContinuas:[{...old,updatedAt:'2026-10-10T14:11:00',pendingNurseAlert:false,nurseSeenAt:'2026-10-10T14:11:00',administrationRecords:[{id:'adm1',slotKey:'old|slot1',administeredAt:'2026-10-10T14:11:00'}]}]}},deleted:false,sort_index:0,writer:'enfermero'};
 await Promise.all([vm.runInContext('writeRows(client,"fixture",[med])',c),vm.runInContext('writeRows(client,"fixture",[nurse])',c)]);
 let rx=tables.hc_state[0].payload.value.infusionesContinuas;assert(rx.some(x=>x.id==='amlodipina-test'));assert.equal(rx.find(x=>x.id==='old').pendingNurseAlert,false);assert.equal(rx.find(x=>x.id==='old').administrationRecords.length,1);assert(collisionCount>0,'must actually exercise compare-and-swap collision');
 await vm.runInContext('writeRows(client,"fixture",[med])',c);rx=tables.hc_state[0].payload.value.infusionesContinuas;assert(rx.some(x=>x.id==='amlodipina-test'));assert.equal(rx.find(x=>x.id==='old').pendingNurseAlert,false);assert.equal(rx.find(x=>x.id==='old').administrationRecords.length,1);
 tables.hc_state.push({institution_id:'fixture',bucket:'pharmacyDrugs',record_id:'main',payload:{value:['catalog']},sync_seq:99});
 const care=await vm.runInContext('changes(client,"fixture",0,120,true)',c);assert(!care.rows.some(x=>x.bucket==='pharmacyDrugs'));assert(care.rows.some(x=>x.bucket==='clinical'));
 console.log('PASS concurrent medical+nursing saves, stale replica replay, administration preservation, CAS retry and isolated care reception');
})().catch(e=>{console.error(e);process.exit(1)});
