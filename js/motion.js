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

  /* 6. Hero carousel: parallax, slide-change effects, story timer, counter, tilt, drag.
        Hooks into the existing carousel (js/site.js) by watching the dots' .on class. */
  var fig=$('#hero-fig'),track=$('#fig-track');
  if(fig&&track){
    var slides=$$('#fig-track .fig-slide'),dots=$$('#hero-fig .fig-dot'),n=slides.length,PERIOD=4000;
    if(n>1&&dots.length===n){
      var cur=Math.max(0,dots.findIndex(function(d){return d.classList.contains('on')})),
          anchor=performance.now(),paused=false,touchTimer=0;
      var elapsed=function(){return (performance.now()-anchor)%PERIOD};

      /* story timer: restart the active dot's fill, offset so it matches the autoplay's phase */
      var restartFill=function(){
        var d=dots[cur];if(!d)return;
        d.classList.add('nofill');void d.offsetWidth;
        d.style.setProperty('--ym-d',(-elapsed()).toFixed(0)+'ms');
        d.classList.remove('nofill');
      };
      /* site.js announces every autoplay (re)start: that is the phase anchor */
      fig.addEventListener('ym:auto',function(){anchor=performance.now();restartFill()});
      var setPaused=function(p){
        if(p===paused)return;paused=p;fig.classList.toggle('paused',p);
        if(!p)restartFill(); /* resume exactly where the autoplay clock is */
      };
      fig.addEventListener('mouseenter',function(){setPaused(true)});
      fig.addEventListener('mouseleave',function(){setPaused(false)});
      fig.addEventListener('focusin',function(){setPaused(true)});
      fig.addEventListener('focusout',function(){setPaused(false)});
      track.addEventListener('touchstart',function(){clearTimeout(touchTimer);setPaused(true)},{passive:true});
      track.addEventListener('touchend',function(){touchTimer=setTimeout(function(){setPaused(false)},3000)},{passive:true});

      /* slide counter */
      var cnt=document.createElement('div');cnt.className='fig-count';cnt.setAttribute('aria-hidden','true');
      cnt.innerHTML='<span class="cn"><b>01</b></span><i></i><span class="ct">0'+n+'</span>';fig.appendChild(cnt);
      var cb=cnt.querySelector('b');
      var setCount=function(i){cb.textContent='0'+(i+1);cb.classList.remove('roll');void cb.offsetWidth;cb.classList.add('roll')};

      /* what happens whenever the active slide changes */
      var onChange=function(idx){
        var dir=idx>cur?1:-1;cur=idx;
        slides.forEach(function(s,i){
          if(i===idx){s.classList.remove('is-active');void s.offsetWidth;s.classList.add('is-active')}else s.classList.remove('is-active');
        });
        fig.classList.remove('flash');void fig.offsetWidth;fig.classList.add('flash');
        clearTimeout(fig._flashT);fig._flashT=setTimeout(function(){fig.classList.remove('flash')},1000);
        if(fig.animate)fig.animate([{translate:'0 0'},{translate:(dir*9)+'px 0',offset:.35},{translate:'0 0'}],{duration:700,easing:'cubic-bezier(.34,1.56,.64,1)'});
        setCount(idx);
        dots[idx].style.setProperty('--ym-d',(-elapsed()).toFixed(0)+'ms');
      };
      new MutationObserver(function(){
        var idx=dots.findIndex(function(d){return d.classList.contains('on')});
        if(idx>-1&&idx!==cur)onChange(idx);
      }).observe(fig.querySelector('.fig-dots'),{attributes:true,attributeFilter:['class'],subtree:true});
      slides[cur].classList.add('is-active');restartFill();

      /* parallax: each photo drifts slower than its slide (decorative only; +-3.5% inside a 1.08 zoom, so edges never show) */
      var parTick=false;
      var parallax=function(){
        parTick=false;var w=track.clientWidth||1,sl=track.scrollLeft;
        slides.forEach(function(s,i){var o=(sl-i*w)/w;if(o>1.2||o<-1.2)return;if(s.firstElementChild)s.firstElementChild.style.translate=(o*3.5).toFixed(2)+'%'});
      };
      track.addEventListener('scroll',function(){if(!parTick){parTick=true;requestAnimationFrame(parallax)}},{passive:true});parallax();

      /* desktop only: soft 3D tilt + pointer highlight, and mouse drag-to-swipe */
      if(finePointer){
        fig.addEventListener('pointermove',function(e){
          var r=fig.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
          fig.style.setProperty('--hx',((x+.5)*100).toFixed(1)+'%');fig.style.setProperty('--hy',((y+.5)*100).toFixed(1)+'%');
          fig.style.transform='perspective(1100px) rotateX('+(-y*5).toFixed(2)+'deg) rotateY('+(x*6).toFixed(2)+'deg)';
        });
        fig.addEventListener('pointerleave',function(){fig.style.transform=''});

        var dragging=false,sx=0,sl0=0,dx=0;
        track.addEventListener('dragstart',function(e){e.preventDefault()});
        track.addEventListener('pointerdown',function(e){
          if(e.pointerType!=='mouse'||e.button!==0)return;
          dragging=true;sx=e.clientX;sl0=track.scrollLeft;dx=0;
          track.style.scrollSnapType='none';track.style.scrollBehavior='auto';
          try{track.setPointerCapture(e.pointerId)}catch(_){}
          fig.classList.add('drag');
        });
        track.addEventListener('pointermove',function(e){if(!dragging)return;dx=e.clientX-sx;track.scrollLeft=sl0-dx});
        var endDrag=function(){
          if(!dragging)return;dragging=false;fig.classList.remove('drag');
          var w=track.clientWidth||1,idx=Math.round(track.scrollLeft/w);
          if(Math.abs(dx)>w*.12)idx=dx<0?cur+1:cur-1;
          idx=Math.max(0,Math.min(n-1,idx));
          dots[idx].click(); /* reuse the carousel's own goTo(): smooth scroll + autoplay restart */
          track.style.scrollSnapType='';track.style.scrollBehavior='';
        };
        track.addEventListener('pointerup',endDrag);track.addEventListener('pointercancel',endDrag);
      }
    }
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
