export const LEARNING_STAGES=['foundation','focused','clinical'];
export const STAGE_LABELS={foundation:'Foundations',focused:'Focused topic',clinical:'Clinical application'};
export function learningProgress(rows){
  const ordered=[...rows].sort((a,b)=>a.completedAt.localeCompare(b.completedAt)||a.exposedAt.localeCompare(b.exposedAt));
  const stages=LEARNING_STAGES.map(stage=>{
    const all=ordered.filter(r=>r.learningStage===stage),recent=all.slice(-10);
    const accuracy=recent.length?recent.filter(r=>r.correct).length/recent.length*100:null;
    return {stage,label:STAGE_LABELS[stage],evidenceCount:all.length,recentCount:recent.length,accuracy,ready:recent.length>=5&&accuracy>=80};
  });
  const recommendedStage=!stages[0].ready?'foundation':!stages[1].ready?'focused':'clinical';
  return {stages,recommendedStage,unclassifiedCount:ordered.filter(r=>!LEARNING_STAGES.includes(r.learningStage)).length,rule:'stage-1',explanation:'Suggested progression: at least five fresh first answers and 80% accuracy in the latest ten at each preparatory stage. These are adjustable study heuristics, not validated exam thresholds. You may request a different stage.'};
}
export function upcomingExams(settings,now=new Date()){
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return (settings?.exams??[]).map(e=>({...e,daysUntil:Math.round((Date.parse(e.date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000)})).sort((a,b)=>a.date.localeCompare(b.date));
}
