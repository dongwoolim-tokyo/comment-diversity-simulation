/* Browser port of CELL 1. Same model equations; JS PRNG differs from Python/NumPy. */
const TEMPLATES={strong_support:['この政策には強く賛成します。','この政策を積極的に推進すべきです。','この政策の実施を強く支持します。','この政策は社会にとって重要だと思います。','この政策を進めるべきだと考えます。'],moderate_support:['この政策には賛成です。','基本的には、この政策を支持しています。','この政策には一定の効果が期待できます。','全体として、この政策は有益だと思います。','この政策を実施する方向でよいと思います。'],weak_support:['どちらかといえば、この政策に賛成です。','懸念もありますが、賛成寄りです。','慎重な実施を前提に賛成します。','現時点では賛成の立場です。','完全に納得しているわけではありませんが、賛成です。'],weak_oppose:['どちらかといえば、この政策には反対です。','この政策には少し懸念があります。','現時点では反対寄りです。','もう少し慎重に検討すべきだと思います。','十分な説明が必要だと思います。'],moderate_oppose:['この政策には反対です。','現状では、この政策を支持できません。','この政策には問題が残っています。','実施を急ぐべきではないと思います。','この政策は再検討する必要があります。'],strong_oppose:['この政策には強く反対します。','この政策は根本的に見直すべきです。','この政策を進めるべきではありません。','現状のまま実施することには断固反対です。','この政策には重大な問題があると思います。']};
function rng(seed){let s=seed>>>0;return ()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function normal(r){return Math.sqrt(-2*Math.log(Math.max(1e-12,r())))*Math.cos(2*Math.PI*r());}
const clip=(v,a,b)=>Math.max(a,Math.min(b,v));
function runWorld(c,algorithm,seed,keepFrames){
 const r=rng(seed), n=c.n_agents, ns=Math.round(n*c.initial_support);let stances=[];
 for(let i=0;i<ns;i++)stances.push(.05+.95*r());for(let i=ns;i<n;i++)stances.push(-(.05+.95*r()));
 for(let i=n-1;i>0;i--){let j=Math.floor(r()*(i+1));[stances[i],stances[j]]=[stances[j],stances[i]];}
 const confidence=stances.map(v=>.25+.75*Math.abs(v)),activity=stances.map(()=>c.activity_min+(c.activity_max-c.activity_min)*r());
 const perceived=stances.map(()=>clip(c.initial_support+c.initial_perception_sd*normal(r),.01,.99));
 const sigma=Math.sqrt(Math.log(1+c.learning_heterogeneity**2)),mu=-.5*sigma*sigma;
 const learning=stances.map(()=>clip(c.learning_rate*Math.exp(mu+sigma*normal(r)),.01,.80));
 const comments=[];function add(author,step){let v=stances[author],cat=v>=.65?'strong_support':v>=.30?'moderate_support':v>0?'weak_support':v>-.30?'weak_oppose':v>-.65?'moderate_oppose':'strong_oppose';let ts=TEMPLATES[cat];comments.push({id:comments.length,author,stance:v,step,likes:Math.floor(r()*9),text:ts[Math.floor(r()*ts.length)]});}
 for(let i=0;i<c.initial_comments;i++)add(Math.floor(r()*n),0);
 const history=[],frames=[];let visible=Array(n).fill(null),participated=Array(n).fill(false),exposures=Array.from({length:n},()=>[]);
 function record(step){let vs=visible.filter(v=>v!==null),maj=0,min=0;for(let i=0;i<n;i++)if(participated[i])stances[i]>0?maj++:min++;
 let actual=ns/n,mean=perceived.reduce((a,b)=>a+b,0)/n;history.push({step,actual_support:actual,visible_support:vs.length?vs.reduce((a,b)=>a+b,0)/vs.length:null,perceived_support:mean,climate_gap:mean-actual,perception_mae:perceived.reduce((a,b)=>a+Math.abs(b-actual),0)/n,majority_participation:step?maj/ns:null,minority_participation:step?min/(n-ns):null,participation_gap:step?maj/ns-min/(n-ns):null,total_comments:comments.length,step_comments:step?maj+min:0});
 if(keepFrames)frames.push({stances,perceived:perceived.slice(),participated:participated.slice(),visible:visible.slice(),exposures:exposures.map(a=>a.slice())});}
 record(0);
 for(let step=1;step<=c.steps;step++){
  const total=comments.length,k=Math.min(c.candidate_pool,total),commonK=Math.min(k,Math.max(0,Math.round(k*c.common_candidate_ratio))),personalK=k-commonK;
  const global=comments.map((v,id)=>({id,score:.65*Math.log1p(v.likes)+.35*Math.exp(-.15*Math.max(0,step-v.step))}));global.sort((a,b)=>b.score-a.score||a.id-b.id);
  const common=global.slice(0,commonK).map(v=>v.id),commonSet=new Set(common),pool=comments.map(v=>v.id).filter(id=>!commonSet.has(id));
  const maxLikes=Math.max(1,...comments.map(v=>v.likes)),denom=Math.log1p(maxLikes),likeIncrements=new Int32Array(total);
  visible=Array(n).fill(null);participated=Array(n).fill(false);exposures=Array(n);
  for(let i=0;i<n;i++){
   // Uniform without-replacement selection, same candidate-generation rule in both worlds.
   let personal=[];if(personalK>0){const swaps=new Map();for(let j=0;j<personalK;j++){const z=j+Math.floor(r()*(pool.length-j));const a=swaps.has(z)?swaps.get(z):z;const b=swaps.has(j)?swaps.get(j):j;swaps.set(z,b);swaps.set(j,a);personal.push(pool[a]);}}
   const ids=common.concat(personal),m=ids.length,top=Math.min(c.top_k,m);
   const candidates=ids.map((id,index)=>{const v=comments[id],sim=1-Math.abs(stances[i]-v.stance)/2;return {id,index,stance:v.stance,sim,base:.60*Math.log1p(v.likes)/denom+.20*Math.exp(-.15*Math.max(0,step-v.step))+.15*sim+.05*r()};});
   let chosen=[];
   if(algorithm==='Popularity')chosen=candidates.slice().sort((a,b)=>b.base-a.base||a.index-b.index).slice(0,top);
   else{let available=candidates.slice();for(let j=0;j<top;j++){let best=0,bestScore=-Infinity;for(let z=0;z<available.length;z++){let x=available[z],div=j?chosen.reduce((sum,y)=>sum+Math.abs(x.stance-y.stance)/2,0)/j:0,score=x.base+c.diversity_bonus*div;if(score>bestScore){bestScore=score;best=z;}}chosen.push(available.splice(best,1)[0]);}}
   exposures[i]=chosen.map(v=>v.id);if(chosen.length)visible[i]=chosen.filter(v=>v.stance>0).length/chosen.length;
   if(visible[i]!==null)perceived[i]=clip((1-learning[i])*perceived[i]+learning[i]*visible[i],0,1);
   const perceivedMajority=stances[i]>0?perceived[i]:1-perceived[i],pressure=Math.max(0,.5-perceivedMajority)*2;
   const prob=clip(activity[i]+.03*confidence[i]-c.silence_pressure*pressure,.005,.50);participated[i]=r()<prob;
   for(const v of chosen)if(r()<.02+.13*v.sim)likeIncrements[v.id]++;
  }
  for(let id=0;id<total;id++)comments[id].likes+=likeIncrements[id];for(let i=0;i<n;i++)if(participated[i])add(i,step);
  record(step);
 }
 return {history,agents:frames,comments:keepFrames?comments:[]};
}
function runExperiment(config,repetitions=1,progress=()=>{}){
 const results={'Popularity':[],'Opinion Diversity':[]},representative={};
 for(let rep=0;rep<repetitions;rep++){for(const algorithm of ['Popularity','Opinion Diversity']){let result=runWorld(config,algorithm,config.seed+rep,rep===0);results[algorithm].push(result.history);if(rep===0)representative[algorithm]=result;}progress(rep+1,repetitions);}
 const worlds={};for(const algorithm of ['Popularity','Opinion Diversity']){let mean=[];for(let step=0;step<=config.steps;step++){let row={};for(const key of Object.keys(results[algorithm][0][step])){const vals=results[algorithm].map(h=>h[step][key]).filter(Number.isFinite);row[key]=vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;}mean.push(row);}worlds[algorithm]={mean,agents:representative[algorithm].agents,comments:representative[algorithm].comments};}
 return {config:{n:config.n_agents,steps:config.steps,initial_support:config.initial_support,initial_comments:config.initial_comments,top_k:config.top_k,learning:config.learning_rate,silence:config.silence_pressure,diversity:config.diversity_bonus,repeats:repetitions},worlds};
}
