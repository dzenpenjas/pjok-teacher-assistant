import test from 'node:test';
import assert from 'node:assert/strict';
import { generateStudentReportWithAI } from '../src/services/report-ai-service.js';
const context={student:{id:'synthetic-student'},selectedSections:{learning:true,growth:true},assessments:[],growth:[]};
const narrative={strengths:'Capaian yang tercatat.',developing:'Latihan bertahap.',teacherAction:'Guru membimbing latihan.',parentSupport:'Keluarga mendampingi.',growth:'Data pengukuran tersedia.',nutritionAdvice:'Kebiasaan sehat.',teacherNote:''};
async function withFetch(fetchImpl, action) { const original=globalThis.fetch;globalThis.fetch=fetchImpl;try{return await action();}finally{globalThis.fetch=original;} }
test('400 API_KEY_INVALID is authentication failure even with a generic provider message',async()=>{
 await withFetch(async()=>new Response(JSON.stringify({error:{code:400,status:'INVALID_ARGUMENT',message:'Request contains an invalid argument.',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'API_KEY_INVALID',domain:'googleapis.com'}]}}),{status:400}),async()=>{
  await assert.rejects(generateStudentReportWithAI({apiKey:'synthetic-key',reportContext:context}),error=>{
   assert.equal(error.isApiKeyError,true);assert.equal(error.code,'AUTH_ERROR');assert.equal(error.googleReason,'API_KEY_INVALID');assert.equal(error.googleStatus,'INVALID_ARGUMENT');return true;
  });
 });
});
test('bad request retains structured field paths without raw payload descriptions or the supplied key',async()=>{
 const key='AQ.synthetic-secret-key';
 await withFetch(async()=>new Response(JSON.stringify({error:{code:400,status:'INVALID_ARGUMENT',message:'Invalid parameter '+key,details:[{'@type':'type.googleapis.com/google.rpc.BadRequest',fieldViolations:[{field:'generationConfig.testField',description:'raw student data must not be copied'}]}]}}),{status:400}),async()=>{
  await assert.rejects(generateStudentReportWithAI({apiKey:key,reportContext:context}),error=>{
   assert.equal(error.code,'INVALID_ARGUMENT');assert.deepEqual(error.googleFields,['generationConfig.testField']);
   assert.ok(!error.message.includes(key));assert.ok(!JSON.stringify(error).includes('raw student data'));return true;
  });
 });
});
test('request keeps full educational instructions and diagnostics never include the prompt or key',async()=>{
 const stages=[];
 await withFetch(async(endpoint,options)=>{
  assert.equal(endpoint,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
  assert.equal(options.headers['x-goog-api-key'],'synthetic-key');
  const body=JSON.parse(options.body);assert.equal(body.contents[0].role,'user');
  assert.equal(body.generationConfig.responseMimeType,'application/json');
  const text=body.contents[0].parts[0].text;
  for(const rule of ['EVIDENCE CONFLICT RULE','PSYCHOLOGICAL & TRAIT GUARDRAIL','DILARANG menghitung ulang z-score','JANGAN membuat KKM'])assert.ok(text.includes(rule));
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(narrative)}]}}]}),{status:200});
 },async()=>{
  const draft=await generateStudentReportWithAI({apiKey:'synthetic-key',reportContext:context,onDiagnosticStage:(stage,meta)=>stages.push({stage,...meta})});
  assert.equal(draft.strengths,narrative.strengths);assert.ok(stages[0].requestBytes>1000);
  assert.ok(!JSON.stringify(stages).includes('synthetic-key'));assert.ok(!JSON.stringify(stages).includes('synthetic-student'));
 });
});
test('growth-only reports cannot retain unsupported learning narratives from the model',async()=>{
 await withFetch(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(narrative)}]}}]}),{status:200}),async()=>{
  const draft=await generateStudentReportWithAI({apiKey:'synthetic-key',reportContext:{...context,selectedSections:{learning:false,growth:true}}});
  for(const field of ['strengths','developing','teacherAction','parentSupport','summary','understanding','followUp','homeActivity'])assert.equal(draft[field],'');
  assert.equal(draft.growth,narrative.growth);
 });
});
test('missing learning narrative and invalid JSON remain rejected',async()=>{
 for(const text of [JSON.stringify({...narrative,strengths:''}),'{invalid json}']){
  await withFetch(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text}]}}]}),{status:200}),()=>assert.rejects(generateStudentReportWithAI({apiKey:'synthetic-key',reportContext:context}),{code:'INVALID_AI_RESPONSE'}));
 }
});

test('untrusted Google status cannot leak key or payload into error metadata',async()=>{
 await withFetch(async()=>new Response(JSON.stringify({error:{status:'synthetic-key private payload',message:'Request rejected'}}),{status:400}),()=>assert.rejects(generateStudentReportWithAI({apiKey:'synthetic-key',reportContext:context}),error=>{
  assert.equal(error.googleStatus,null);assert.ok(!error.message.includes('synthetic-key'));return true;
 }));
});
