// IIBC 2023 public mock-test reference ranges, page 3. Form-specific;
// reuse on this bank is an approximation, not official equating.
const TOEIC_REFERENCE_URL='https://www.iibc-global.org/hubfs/library/default/toeic/special/job/u-trial202303/pdf/utrial_score.pdf?hsLang=ja';
const TOEIC_REFERENCE={
 L:[[0,5,35],[5,5,50],[10,5,60],[15,5,70],[20,30,90],[25,60,115],[30,85,145],[35,105,175],[40,130,205],[45,160,230],[50,190,255],[55,215,280],[60,240,310],[65,265,335],[70,290,360],[75,320,390],[80,345,420],[85,370,450],[90,405,470],[95,435,495],[100,475,495]],
 R:[[0,5,15],[5,5,30],[10,10,40],[15,30,55],[20,45,75],[25,60,95],[30,75,120],[35,95,150],[40,115,180],[45,140,215],[50,170,245],[55,200,275],[60,230,310],[65,255,340],[70,285,370],[75,310,390],[80,340,415],[85,375,440],[90,400,465],[95,425,490],[100,460,495]]
};
function toeicSection(raw,type){if(raw===null||raw===undefined||!Number.isFinite(raw))return null;const n=Math.round(Math.max(0,Math.min(100,raw))),r=TOEIC_REFERENCE[type].find(r=>n<=r[0]);return {raw:n,low:r[1],high:r[2],point:Math.round((r[1]+r[2])/10)*5}}
function toeicScore(l,r){const L=toeicSection(l,'L'),R=toeicSection(r,'R');return {L,R,total:L&&R?L.point+R.point:null,low:L&&R?L.low+R.low:null,high:L&&R?L.high+R.high:null}}
function toeicAttempt(r){const qs=r.keys.map(k=>EXAM_BANK.questions.find(q=>q.key===k)).filter(Boolean),l=qs.filter(q=>+q.question_order<=100),read=qs.filter(q=>+q.question_order>100);const score=toeicScore(l.length===100?l.filter(q=>r.answers[q.key]===q.question_answer).length:null,read.length===100?read.filter(q=>r.answers[q.key]===q.question_answer).length:null);return score}
const reportBeforeToeic=examReport;
examReport=function(){const html=reportBeforeToeic(),r=examResult;if(!r||r.mode!=='full')return html;const s=toeicAttempt(r);if(s.total===null)return html;return html.replace('<div class="stats">',`<section class="panel toeic-result"><span class="eyebrow">TOEIC MOCK REFERENCE</span><h2>本次托业模拟参考分 <strong>${s.total}</strong><small> / 990</small></h2><p>Listening ${s.L.point} / 495（答对 ${s.L.raw}/100） · Reading ${s.R.point} / 495（答对 ${s.R.raw}/100）</p><p>参考区间 <strong>${s.low}–${s.high}</strong> 分 · 显示值为分项区间中点按 5 分取整后相加。</p><p class="note-label">参考 IIBC 特定模考换算表；本题库未做官方等值校准，不是正式 TOEIC 成绩。</p></section><div class="stats">`).replace('此处为原始正确率，不是官方托业换算分数。','正确率和模拟参考分分别展示，不是官方考试成绩。')};
