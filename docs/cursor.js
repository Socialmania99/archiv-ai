/* Archiv AI custom cursor. No dependencies, nothing leaves the page. */
(function(){
  try{
    if(!window.matchMedia||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
    var d=document,r=d.documentElement,rm=matchMedia('(prefers-reduced-motion:reduce)').matches;
    var mk=function(c,h){var e=d.createElement('div');e.className=c;e.setAttribute('aria-hidden','true');if(h)e.innerHTML=h;return e};
    var cur=mk('ac-cur','<div class="ac-w"><img class="ac-a" src="assets/cursor-arrow.png" alt="" width="25" height="33"><img class="ac-h" src="assets/cursor-hand.png" alt="" width="25" height="35"></div>');
    var halo=mk('ac-halo'),ring=mk('ac-ring');
    var ready=0,px=-100,py=-100,hx=-100,hy=-100,hand=false,nat=false;
    var imgs=cur.querySelectorAll('img'),loaded=0;
    function ok(){if(++loaded<2)return;d.body.appendChild(halo);d.body.appendChild(cur);d.body.appendChild(ring);ready=1;r.classList.add('ac-ready')}
    // preload; if an image fails, keep the native cursor
    ['cursor-arrow.png','cursor-hand.png'].forEach(function(n){var i=new Image();i.onload=ok;i.src='assets/'+n});
    var SEL='a,button,summary,label,select,[role=tab],[role=button],[role=switch],[data-theme-toggle],.btn,.tab,[tabindex]:not([tabindex="-1"])';
    function setHand(v){if(v===hand)return;hand=v;r.classList.toggle('ac-hand',v)}
    function place(){
      // hotspot: arrow tip (3,2); fingertip of hand (10,1). Tilts with mouse speed, floats at rest
      var ox=hand?10:3,oy=hand?1:2;
      var dx=px-lx;lx=px;rot+=(Math.max(-22,Math.min(22,dx*1.4))-rot)*.25;
      cur.style.transformOrigin=ox+'px '+oy+'px';
      cur.style.transform='translate3d('+(px-ox)+'px,'+(py-oy)+'px,0) rotate('+(rm?0:rot)+'deg)';
      hx+=(px-hx)*(rm?1:.22);hy+=(py-hy)*(rm?1:.22);
      halo.style.transform='translate3d('+hx+'px,'+hy+'px,0)';
      if(Math.abs(px-hx)>.3||Math.abs(py-hy)>.3||Math.abs(rot)>.3)raf=requestAnimationFrame(place);else raf=0;
    }
    var raf=0,lx=-100,rot=0;
    function move(e){
      if(e.pointerType&&e.pointerType!=='mouse')return;
      px=e.clientX;py=e.clientY;
      if(!ready)return;
      if(!r.classList.contains('ac-on')){hx=px;hy=py;r.classList.add('ac-on')}
      var t=e.target;
      nat=!!(t&&t.closest&&t.closest('iframe,input,textarea,select'));
      r.classList.toggle('ac-on',!nat);
      setHand(!nat&&!!(t&&t.closest&&t.closest(SEL)));
      if(!raf)raf=requestAnimationFrame(place);
    }
    d.addEventListener('pointermove',move,{passive:true});
    d.addEventListener('pointerdown',function(e){
      if(!ready||nat||(e.button&&e.button!==0))return;
      r.classList.add('ac-down');
      if(!rm){ring.style.setProperty('--t','translate3d('+e.clientX+'px,'+e.clientY+'px,0)');
        ring.style.transform='translate3d('+e.clientX+'px,'+e.clientY+'px,0)';
        ring.classList.remove('go');void ring.offsetWidth;ring.classList.add('go')}
    });
    d.addEventListener('pointerup',function(){r.classList.remove('ac-down')});
    d.addEventListener('mouseleave',function(){r.classList.remove('ac-on')});
    d.addEventListener('mouseenter',function(){if(!nat)r.classList.add('ac-on')});
    window.addEventListener('blur',function(){r.classList.remove('ac-on','ac-down')});
  }catch(_){}
})();
