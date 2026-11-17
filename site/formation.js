// User-confirmed tie ordering. New units at the same position use unit ID order.
const formationExceptions = [
 ['121701','121801','120401','120501','120601','124301','124401','128101','128201','118301','118401'],
 ['170101'], ['131301','131401','131501'], ['191501','191601','191701']
];
const exceptionOrder = new Map(formationExceptions.flat().map((id,index)=>[id,index]));
function formationCompare(a,b,reverse=false) {
 const ax=exceptionOrder.get(a.id), bx=exceptionOrder.get(b.id);
 // Explicit exceptions remain at the tail in both directions.
 if(ax!==undefined || bx!==undefined) return ax===undefined?-1:bx===undefined?1:ax-bx;
 const ap=Number.isFinite(a.position)?a.position:null, bp=Number.isFinite(b.position)?b.position:null;
 if(ap===null || bp===null) return ap===null?(bp===null?Number(a.id)-Number(b.id):1):-1;
 return (reverse?bp-ap:ap-bp) || Number(a.id)-Number(b.id);
}
if(typeof module!=='undefined') module.exports={formationCompare,formationExceptions};
