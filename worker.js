importScripts('simulation.js');
onmessage=e=>{try{const data=runExperiment(e.data.config,e.data.repetitions,(done,total)=>{if(done===total||done%5===0)postMessage({type:'progress',done,total});});postMessage({type:'result',data});}catch(err){postMessage({type:'error',message:err.message||String(err)});}};
