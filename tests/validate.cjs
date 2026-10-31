const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
for(const file of ['app.js','exam.js','ability.js','toeic-score.js','data.js','exam-data.js'])new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});
const bank=vm.runInNewContext(fs.readFileSync(path.join(root,'exam-data.js'),'utf8')+';EXAM_BANK');
const data=vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8')+';DATA');
assert.equal(bank.tests.length,31);assert.equal(bank.questions.length,6200);assert.equal(new Set(bank.questions.map(q=>q.key)).size,6200);
assert.equal(data.questions.length,0,'No personal history in public seed');
const seen=new Set();
for(const q of bank.questions){
 for(const k of ['personalAnswer','practiceAnswer','note','collect','elapseTime','test_state'])assert.equal(q[k],undefined,'Personal field excluded: '+k);
 for(const f of [q.audio,q.question_image,q.explanation_image])if(f&&!seen.has(f)){const full=path.resolve(root,f);assert(full.startsWith(root+path.sep));assert(fs.statSync(full).size>0,'Missing/empty media: '+f);seen.add(f)}
}
assert.equal(seen.size,4840);
for(const t of bank.tests)assert.equal(bank.questions.filter(q=>q.test_id===t.id).length,200);
const score=vm.runInNewContext(fs.readFileSync(path.join(root,'toeic-score.js'),'utf8')+';({toeicSection,toeicScore})',{examReport:()=>''});
for(const section of ['L','R'])for(let n=0;n<=100;n++){const s=score.toeicSection(n,section);assert(s.point>=5&&s.point<=495);assert.equal(s.point%5,0);assert(s.point>=s.low&&s.point<=s.high)}
assert.equal(score.toeicScore(65,65).low,520);assert.equal(score.toeicScore(65,65).high,675);assert.equal(score.toeicScore(null,50).total,null);
console.log('PASS: syntax, 31 trials / 6200 unique questions, 4840 media files, personal-data exclusion, score conversion.');
