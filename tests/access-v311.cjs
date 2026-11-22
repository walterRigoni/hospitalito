const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const primary = 'https://example.test/hospitalito-login?forceFunctionRegion=eu-central-1';
const fallback = 'https://example.test/hospitalito-auth?forceFunctionRegion=eu-central-1';
const user = {username:'persona-de-prueba',role:'cliente'};
const json = (data,status=200) => Response.json(data,{status});
const accepted = () => json({ok:true,token:'sesión-ficticia',user});
const source = fs.readFileSync(path.join(__dirname,'../ui/v311.js'),'utf8');

function setup(responses) {
  const seen = [], window = {};
  vm.runInNewContext(source,{
    window, URL, AbortSignal, setTimeout: callback => callback(),
    fetch: async (url, request) => {
      seen.push(url);
      assert.equal(request.method,'POST');
      assert.equal(JSON.parse(request.body).action,'authenticateUser');
      return responses.shift()();
    }
  });
  const run = () => window.HC311.signIn(primary,fallback,'clave-pública-ficticia',{username:user.username,password:'prueba'});
  return {seen,run};
}

(async () => {
  const recovery = setup([
    () => new Response('<!doctype html><h1>Error</h1>',{headers:{'Content-Type':'text/html'}}),
    () => json({ok:false,error:'upstream connect error: delayed connect error: 111'},400),
    accepted
  ]);
  assert.equal((await recovery.run()).user.username,user.username);
  assert.deepEqual(recovery.seen,[primary,primary.split('?')[0],fallback]);

  const rejected = setup([() => json({ok:false,error:'Usuario o contraseña incorrectos.'},400)]);
  await assert.rejects(rejected.run(),{message:'Usuario o contraseña incorrectos.'});
  assert.deepEqual(rejected.seen,[primary]);

  const legacy = setup([() => json({ok:false,error:'La cuenta todavía no tiene credenciales Supabase migradas.'},400), accepted]);
  assert.equal((await legacy.run()).user.role,'cliente');
  assert.deepEqual(legacy.seen,[primary,fallback]);

  const downstreamError = () => json({ok:false,error:'<html>respuesta técnica</html>'},500);
  const outage = setup([downstreamError,downstreamError,downstreamError]);
  await assert.rejects(outage.run(),{message:'El servicio de acceso no está disponible por el momento. Volvé a intentar en unos minutos.'});

  const rateLimit = setup([() => json({ok:false,error:'Rate limit exceeded'},429)]);
  await assert.rejects(rateLimit.run(),/demasiados intentos/);
  assert.deepEqual(rateLimit.seen,[primary]);
  console.log('PASS login: HTML inesperado, error 111, cuenta anterior, credenciales inválidas y límite de intentos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
