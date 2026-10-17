import test from 'node:test';
import assert from 'node:assert/strict';
import {installReportTestEnvironment,findReportButton,waitForReportBatch} from './helpers/report-test-environment.js';
import {createInitialState} from '../src/data/schema.js';
import {renderClassesScreen} from '../src/ui/classes-screen.js';
import {createFinalReportPage} from '../src/ui/final-report-page-builder.js';
import {formatAiDiagnosticText} from '../src/services/ai-diagnostic-service.js';
let serial=0;
function fixture(){
 const n=++serial;const classId=`class-test-${n}`;const data=createInitialState();
 data.classes=[{id:classId,name:'1A',grade:1,status:'active'}];
 data.academicYears=[{id:'year-test',name:'2026-2027'}];data.semesters=[{id:'semester-test',name:'1',academicYearId:'year-test'}];data.activeAcademicYearId='year-test';data.activeSemesterId='semester-test';
 data.students=Array.from({length:6},(_,i)=>({id:`student-test-${n}-${i}`,name:`Synthetic Student ${i+1}`,classId,gender:'male',birthDate:'2019-02-01'}));
 data.assessmentDefinitions=[{id:'def-test',method:'rubric'}];
 data.assessmentSessions=['Lisan','Praktik'].map((method,i)=>({id:`assessment-${n}-${i}`,classId,title:`UTS PJOK Kelas 1 - ${method}`,definitionId:'def-test',date:'2026-09-01',itemsSnapshot:[{id:`item-${i}`,prompt:`Gerak uji ${i}`,rubricScale:5,rubricLevels:[{level:3,label:'Berkembang',desc:`Deskripsi terpilih ${i}`},{level:4,label:'Baik',desc:'Deskripsi lain tidak dipilih'}]}]}));
 data.assessmentResults=data.students.flatMap((s,index)=>index===5?[]:data.assessmentSessions.map((a,i)=>({id:`result-${s.id}-${i}`,studentId:s.id,assessmentSessionId:a.id,definitionId:'def-test',numericScore:60,itemResults:[{itemId:`item-${i}`,rubricLevel:3,note:'Perlu waktu menjelaskan konsep.'}],note:'Latihan keseimbangan saat berdiri satu kaki.'})));
 data.growthRecords=data.students.map(s=>({id:`growth-${s.id}`,studentId:s.id,date:'2026-09-01',heightCm:'120',weightKg:'24'}));
 return data;
}
const narrative={strengths:'Capaian gerak yang tercatat.',developing:'Latihan bertahap diperlukan.',teacherAction:'Guru mendampingi latihan.',parentSupport:'Keluarga mendukung latihan.',growth:'Pengukuran tersedia untuk pemantauan.',nutritionAdvice:'Kebiasaan sehat sesuai kebutuhan.',teacherNote:''};
function provider(body=narrative){return new Response(JSON.stringify({candidates:[{content:{parts:[{text:typeof body==='string'?body:JSON.stringify(body)}]}}]}),{status:200});}
function reject400(reason){return new Response(JSON.stringify({error:{code:400,status:'INVALID_ARGUMENT',message:'Request contains an invalid argument.',details:reason?[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason}]:[{'@type':'type.googleapis.com/google.rpc.BadRequest',fieldViolations:[{field:'generationConfig.unknown',description:'not copied to diagnostics'}]}]}}),{status:400});}
async function setup({fetchResponse=()=>provider(),asyncSave=false,onSave,sourceState}={}){
 const source=sourceState || fixture();if(sourceState)serial++;const env=installReportTestEnvironment(source);
 env.storage.setItem('pjok_gemini_api_key','synthetic-key');
 const app=await import(`../src/app.js?batch-test=${serial}`);
 const ui={selectedClassId:source.classes[0].id,mode:'detail',activeTab:'reports',batchReportSelection:{assessmentSessionIds:source.assessmentSessions.map(a=>a.id),includeGrowth:true,includeObservations:false},batchScoringConfig:{enabled:false},batchReportDetails:{enabled:true,descriptions:true}};
 const state={...env.read(),uiState:{classes:ui}};
 const requests=[];let active=0,maxConcurrency=0;const saved=[];
 globalThis.fetch=async(endpoint,options)=>{
  active++;maxConcurrency=Math.max(maxConcurrency,active);
  try{
   const body=JSON.parse(options.body);const text=body.contents[0].parts[0].text;
   const context=JSON.parse(text.split('Data ReportContext siswa:\n')[1].split('\n\nPRINSIP SINTESIS')[0]);
   requests.push(context);return await fetchResponse(context,requests.length,{env,state,ui});
  }finally{active--;}
 };
 const save=report=>{if(onSave){const failure=onSave(report);if(failure)return failure;}const result=app.actions.saveStudentReport(report);if(result.success)saved.push(report);return result;};
 const screen=renderClassesScreen(state,{...app.actions,saveStudentReport:asyncSave?async report=>{await new Promise(resolve=>setTimeout(resolve,1));return save(report);}:save});
 return {source,env,ui,state,screen,requests,saved,get maxConcurrency(){return maxConcurrency;},async click(label){const button=findReportButton(screen,label);assert.ok(button,`Missing test action: ${label}`);await button.click();await waitForReportBatch(ui);}};
}
const originalFetch=globalThis.fetch,originalError=console.error;
test.afterEach(()=>{globalThis.fetch=originalFetch;console.error=originalError;});
test('sequential batch builds exact contexts, awaits storage, and keeps detail evidence in final report',async()=>{
 const h=await setup({asyncSave:true});await h.click('Generate Semua Laporan');
 assert.equal(h.ui.batchState.successCount,6);assert.equal(h.ui.batchState.failedCount,0);assert.equal(h.maxConcurrency,1);
 assert.deepEqual(h.requests.map(c=>c.student.id),h.source.students.map(s=>s.id));assert.equal(h.saved.length,6);
 const stored=h.env.read().studentReports;assert.equal(stored.length,6);
 for(const report of stored){assert.equal(report.academicYearId,'year-test');assert.equal(report.semesterId,'semester-test');const c=report.reportContext;
  assert.ok(c.reportDetails.enabled&&c.reportDetails.descriptions);assert.equal(c.observations.length,0);assert.equal(c.reportScoring.enabled,false);
  assert.ok(c.assessments.every(a=>h.source.assessmentSessions.some(s=>s.id===a.assessmentSessionId)));
  for(const a of c.assessments){assert.equal(a.items[0].rubricLevel,3);assert.ok(a.items[0].rubricDescription.startsWith('Deskripsi terpilih'));}
  const page=createFinalReportPage({student:h.source.students.find(s=>s.id===report.studentId),draft:report.draft,reportContext:c});
  if(c.assessments.length){assert.ok(page.textContent.includes('Detail Nilai Asesmen'));assert.ok(page.textContent.includes('Deskripsi terpilih'));assert.ok(page.textContent.includes('Latihan keseimbangan saat berdiri satu kaki.'));}
  else assert.equal(report.draft.strengths,'');
 }
});
test('three invalid requests halt; resume and retry retain frozen settings and finish all students',async()=>{
 console.error=()=>{};let fail=true;const h=await setup({fetchResponse:()=>fail?reject400():provider()});await h.click('Generate Semua Laporan');
 assert.equal(h.requests.length,3);assert.equal(h.ui.batchState.failedCount,3);assert.equal(h.ui.batchState.unprocessedCount,3);assert.equal(h.ui.batchState.diagnostic.stage,'BATCH_HALTED');
 assert.ok(formatAiDiagnosticText(h.ui.batchState.diagnostic).includes('generationConfig.unknown'));
 h.ui.batchReportSelection={assessmentSessionIds:[],includeGrowth:false,includeObservations:true};h.ui.batchScoringConfig={enabled:true,minScore:80,maxScore:90};h.ui.batchReportDetails={enabled:false,descriptions:false};
 fail=false;await h.click('Lanjutkan Belum Diproses');assert.equal(h.ui.batchState.successCount,3);assert.equal(h.ui.batchState.failedCount,3);assert.equal(h.ui.batchState.unprocessedCount,0);
 await h.click('Coba Lagi yang Gagal');assert.equal(h.ui.batchState.successCount,6);assert.equal(h.ui.batchState.failedCount,0);assert.equal(h.requests.length,9);
 for(const c of h.requests){assert.ok(c.growth.length>0);assert.equal(c.observations.length,0);assert.equal(c.reportScoring.enabled,false);assert.ok(c.reportDetails.enabled&&c.reportDetails.descriptions);}
});
test('API_KEY_INVALID reason halts after one request and is retained in last failure',async()=>{
 console.error=()=>{};const h=await setup({fetchResponse:()=>reject400('API_KEY_INVALID')});await h.click('Generate Semua Laporan');
 assert.equal(h.requests.length,1);assert.equal(h.ui.batchState.failedCount,1);assert.equal(h.ui.batchState.unprocessedCount,5);
 assert.equal(h.ui.batchState.diagnostic.errorCode,'AUTH_ERROR');assert.equal(h.ui.batchState.diagnostic.lastFailure.googleReason,'API_KEY_INVALID');
});
test('invalid narrative is not saved, and failed-only retry saves it once corrected',async()=>{
 console.error=()=>{};let fail=true;const h=await setup({fetchResponse:(c,index)=>fail&&index===2?provider({...narrative,strengths:''}):provider()});await h.click('Generate Semua Laporan');
 assert.equal(h.ui.batchState.failedCount,1);assert.equal(h.saved.length,5);assert.equal(h.ui.batchState.diagnostic.lastFailure.failureStage,'RESPONSE_PARSING');
 fail=false;await h.click('Coba Lagi yang Gagal');assert.equal(h.ui.batchState.successCount,6);assert.equal(h.env.read().studentReports.length,6);assert.equal(h.requests.length,7);
});
test('save failure is reported and retry restores persistence without duplicating reports',async()=>{
 console.error=()=>{};let fail=true,failWrites=false;
 const h=await setup({onSave:report=>{failWrites=fail&&report.studentId.endsWith('-1');}});
 const setItem=h.env.storage.setItem;
 h.env.storage.setItem=(key,value)=>{if(failWrites&&key==='pjokTeacherAssistant.state')throw new Error('Synthetic storage failure');setItem(key,value);};
 await h.click('Generate Semua Laporan');
 assert.equal(h.ui.batchState.failedCount,1);assert.equal(h.env.read().studentReports.length,5);assert.equal(h.ui.batchState.diagnostic.lastFailure.failureStage,'REPORT_SAVING');
 fail=false;await h.click('Coba Lagi yang Gagal');assert.equal(h.ui.batchState.successCount,6);assert.equal(h.env.read().studentReports.length,6);
});
test('period change during API wait cannot relabel reports into the new active period',async()=>{
 const h=await setup({fetchResponse:(c,index,{env})=>{if(index===1){const state=env.read();state.activeAcademicYearId='other-year';state.activeSemesterId='other-semester';env.storage.setItem('pjokTeacherAssistant.state',JSON.stringify(state));}return provider();}});
 await h.click('Generate Semua Laporan');assert.equal(h.ui.batchState.successCount,6);
 assert.ok(h.env.read().studentReports.every(r=>r.academicYearId==='year-test'&&r.semesterId==='semester-test'));
});
test('continuation rejects a changed active period without another API request',async()=>{
 console.error=()=>{};const h=await setup({fetchResponse:()=>reject400()});await h.click('Generate Semua Laporan');
 const state=h.env.read();state.activeSemesterId='different-semester';h.env.storage.setItem('pjokTeacherAssistant.state',JSON.stringify(state));h.state.activeSemesterId='different-semester';
 await h.click('Coba Lagi yang Gagal');assert.equal(h.requests.length,3);assert.ok(h.env.alerts.some(message=>message.includes('periode telah berubah')));
});

test('429 stops immediately; three consecutive server failures halt and preserve remaining students',async()=>{
 console.error=()=>{};
 for(const [status,limit] of [[429,1],[503,3]]){
  let fail=true;
  const h=await setup({fetchResponse:()=>fail?new Response(JSON.stringify({error:{code:status,status:status===429?'RESOURCE_EXHAUSTED':'UNAVAILABLE',message:'Synthetic provider limit'}}),{status}):provider()});
  await h.click('Generate Semua Laporan');assert.equal(h.requests.length,limit);assert.equal(h.ui.batchState.failedCount,limit);assert.equal(h.ui.batchState.unprocessedCount,6-limit);assert.equal(h.ui.batchState.diagnostic.stage,'BATCH_HALTED');
  fail=false;await h.click('Lanjutkan Belum Diproses');await h.click('Coba Lagi yang Gagal');
  assert.equal(h.ui.batchState.successCount,6);assert.equal(h.ui.batchState.unprocessedCount,0);
 }
});

test('404 model failure retains Google metadata and never masquerades as authentication',async()=>{
 console.error=()=>{};
 const h=await setup({fetchResponse:()=>new Response(JSON.stringify({error:{status:'NOT_FOUND',message:'Model unavailable',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'MODEL_NOT_FOUND'},{'@type':'type.googleapis.com/google.rpc.BadRequest',fieldViolations:[{field:'model'}]}]}}),{status:404})});
 await h.click('Generate Semua Laporan');
 assert.equal(h.ui.batchState.diagnostic.lastFailure.errorCode,'MODEL_NOT_FOUND');
 assert.equal(h.ui.batchState.diagnostic.lastFailure.googleReason,'MODEL_NOT_FOUND');
 assert.deepEqual(h.ui.batchState.diagnostic.lastFailure.googleFields,['model']);
 assert.equal(h.ui.batchState.failedCount,6);
});

test('external backup: isolated class batch preserves settings, halts, resumes and saves without duplicates', {skip:!process.env.PJOK_REPORT_TEST_BACKUP}, async()=>{
 console.error=()=>{};
 const {readFile}=await import('node:fs/promises');
 const backup=JSON.parse(await readFile(process.env.PJOK_REPORT_TEST_BACKUP,'utf8'));
 const room=backup.classes.find(c=>c.name==='Kelas 1A');assert.ok(room);
 const source=structuredClone(backup);source.classes=[room];source.students=source.students.filter(s=>s.classId===room.id);
 source.assessmentSessions=source.assessmentSessions.filter(s=>s.classId===room.id&&/^UTS PJOK Kelas 1 - (Lisan|Praktik)$/.test(s.title));
 assert.equal(source.assessmentSessions.length,2);assert.ok(source.students.length>3);
 for(const [status,limit] of [[429,1],[503,3]]){
  let fail=true;
  const h=await setup({sourceState:structuredClone(source),fetchResponse:()=>fail?new Response(JSON.stringify({error:{status:status===429?'RESOURCE_EXHAUSTED':'UNAVAILABLE',message:'Synthetic provider failure'}}),{status}):provider()});
  await h.click('Generate Semua Laporan');
  assert.deepEqual([h.ui.batchState.successCount,h.ui.batchState.failedCount,h.ui.batchState.skippedCount,h.ui.batchState.unprocessedCount],[0,limit,0,source.students.length-limit]);
  assert.deepEqual(h.env.read().studentReports,backup.studentReports);
  h.ui.batchReportSelection={assessmentSessionIds:[],includeGrowth:false,includeObservations:true};h.ui.batchReportDetails={enabled:false,descriptions:false};h.ui.batchScoringConfig={enabled:true,minScore:80,maxScore:90};
  fail=false;await h.click('Lanjutkan Belum Diproses');
  const successful=new Set(h.saved.map(r=>r.studentId));const before=h.requests.length;
  await h.click('Coba Lagi yang Gagal');
  assert.ok(h.requests.slice(before).every(c=>!successful.has(c.student.id)));
  assert.deepEqual([h.ui.batchState.successCount,h.ui.batchState.failedCount,h.ui.batchState.skippedCount,h.ui.batchState.unprocessedCount],[source.students.length,0,0,0]);
  for(const r of h.saved){assert.equal(r.academicYearId,backup.activeAcademicYearId);assert.equal(r.semesterId,backup.activeSemesterId);assert.equal(r.reportContext.reportScoring.enabled,false);assert.equal(r.reportContext.observations.length,0);assert.ok(r.reportContext.reportDetails.enabled&&r.reportContext.reportDetails.descriptions);}
  const stored=h.env.read().studentReports;
  for(const student of source.students)assert.equal(stored.filter(r=>r.studentId===student.id&&r.classId===room.id&&r.academicYearId===backup.activeAcademicYearId&&r.semesterId===backup.activeSemesterId).length,1);
  const untouched=r=>r.classId!==room.id||r.academicYearId!==backup.activeAcademicYearId||r.semesterId!==backup.activeSemesterId;
  assert.deepEqual(stored.filter(untouched),backup.studentReports.filter(untouched));
  console.log(`External backup MOCK HTTP ${status}: halted 0/${limit}/0/${source.students.length-limit}; resumed ${h.ui.batchState.successCount}/0/0/0; persisted ${h.saved.length}`);
 }
});

test('a successful response resets the consecutive server failure counter',async()=>{
 console.error=()=>{};
 const h=await setup({fetchResponse:(_,index)=>[1,2,4,5].includes(index)?new Response(JSON.stringify({error:{status:'UNAVAILABLE',message:'Synthetic server error'}}),{status:503}):provider()});
 await h.click('Generate Semua Laporan');
 assert.equal(h.requests.length,6);assert.equal(h.ui.batchState.successCount,2);assert.equal(h.ui.batchState.failedCount,4);assert.equal(h.ui.batchState.unprocessedCount,0);
});
