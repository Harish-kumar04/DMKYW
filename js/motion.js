/* DMK YW: motion layer (pairs with css/motion.css). No dependencies.
   Everything here is progressive enhancement: if this file fails to load, the site still works. */
(function(){
  'use strict';
  var mq=function(q){return window.matchMedia&&window.matchMedia(q).matches};
  var reduce=mq('(prefers-reduced-motion: reduce)');
  var finePointer=mq('(hover: hover) and (pointer: fine)');
  var $=function(s){return document.querySelector(s)},$$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};

  /* 1. Scroll progress bar (transform-only, rAF-throttled) */
  var bar=document.createElement('div');bar.className='ym-progress';bar.setAttribute('aria-hidden','true');document.body.appendChild(bar);
  var pTick=false;
  function progress(){pTick=false;var h=document.documentElement.scrollHeight-innerHeight;bar.style.transform='scaleX('+(h>0?Math.min(1,Math.max(0,scrollY/h)):0)+')'}
  addEventListener('scroll',function(){if(!pTick){pTick=true;requestAnimationFrame(progress)}},{passive:true});
  addEventListener('resize',progress,{passive:true});progress();

  if(reduce)return; /* everything below is motion: skip it entirely and leave the final static state */

  /* 2. Mark cards as "revealed" once their entrance transition ends, so hover lifts work
        (the original .rv.in{transform:none} rule otherwise blocks them). */
  document.addEventListener('transitionend',function(e){
    var t=e.target;
    if(e.propertyName==='transform'&&t.classList&&t.classList.contains('rv')&&t.classList.contains('in'))t.classList.add('rvd');
  });

  /* 3. Leader posters: pointer-follow spotlight + subtle inner parallax (mouse/trackpad only) */
  if(finePointer){
    $$('.pc').forEach(function(c){
      c.addEventListener('pointermove',function(e){
        var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
        c.style.setProperty('--x',(x*100).toFixed(1)+'%');c.style.setProperty('--y',(y*100).toFixed(1)+'%');
        c.style.setProperty('--mx',((x-.5)*-12).toFixed(1)+'px');c.style.setProperty('--my',((y-.5)*-12).toFixed(1)+'px');
      });
      c.addEventListener('pointerleave',function(){['--x','--y','--mx','--my'].forEach(function(p){c.style.removeProperty(p)})});
    });
  }

  /* 4. Decorative band: slow parallax on the image layer only, active only while on screen */
  var bandImg=$('.band img');
  if(bandImg&&'IntersectionObserver' in window){
    var box=bandImg.parentElement,live=false,bTick=false;
    var move=function(){
      bTick=false;var r=box.getBoundingClientRect(),p=(r.top+r.height/2-innerHeight/2)/innerHeight;
      p=Math.max(-1,Math.min(1,p));bandImg.style.transform='translate3d(0,'+(p*r.height*.09).toFixed(1)+'px,0)';
    };
    var onScroll=function(){if(live&&!bTick){bTick=true;requestAnimationFrame(move)}};
    new IntersectionObserver(function(es){
      live=es[0].isIntersecting;bandImg.style.willChange=live?'transform':'';if(live)move();
    }).observe(box);
    addEventListener('scroll',onScroll,{passive:true});
  }

  /* 5. Closing CTA: split the quote at its <br> into lines, reveal when it scrolls into view */
  var cta=$('.cta');
  if(cta){
    var sl=cta.querySelector('.sl');
    if(sl&&/<br/i.test(sl.innerHTML)){
      sl.innerHTML=sl.innerHTML.split(/<br\s*\/?>/i).map(function(t,i){return '<span class="ln" style="--i:'+i+'">'+t.trim()+'</span>'}).join('');
    }
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){cta.classList.add('in');io.disconnect()}})},{threshold:.25});
      io.observe(cta);
    }else cta.classList.add('in');
  }
})();
