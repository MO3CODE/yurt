import { GeometricPattern, starPoints } from "@/components/brand/khatam";

/**
 * شاشة الافتتاح: تظهر فقط عند فتح المنصة من اختصار الشاشة الرئيسية (display-mode: standalone)،
 * ومرة واحدة لكل تشغيل. لا تعتمد على React: السكربت المضمّن يعمل أثناء قراءة الصفحة ويضيف
 * أصنافاً على <html> (splash-out ثم splash-off)، فتظهر فوراً قبل تحميل جافاسكربت التطبيق.
 */
const SPLASH_SCRIPT = `(function(){
var d=document.documentElement;
var standalone=window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches;
var seen=false;
try{seen=sessionStorage.getItem("splash")==="1";sessionStorage.setItem("splash","1");}catch(e){}
if(!standalone||seen){d.classList.add("splash-off");return;}
var metas=[].slice.call(document.querySelectorAll('meta[name="theme-color"]'));
var original=metas.map(function(m){return m.getAttribute("content");});
metas.forEach(function(m){m.setAttribute("content","#0b3f3b");});
var start=Date.now(),finished=false;
function finish(){
if(finished)return;finished=true;
setTimeout(function(){
d.classList.add("splash-out");
metas.forEach(function(m,i){m.setAttribute("content",original[i]);});
setTimeout(function(){d.classList.add("splash-off");},650);
},Math.max(0,1700-(Date.now()-start)));
}
if(document.readyState==="complete")finish();else window.addEventListener("load",finish);
setTimeout(finish,4500);
})();`;

export function SplashScreen() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      <div className="splash" aria-hidden>
        <div className="splash-pattern">
          <GeometricPattern size={64} />
        </div>
        <div className="splash-vignette" />

        <div className="relative flex flex-col items-center gap-7">
          <svg viewBox="0 0 200 200" className="size-44">
            {/* حلقتان هندسيتان تدوران باتجاهين متعاكسين */}
            <g className="splash-orbit splash-orbit-a">
              <polygon points={starPoints(100, 100, 94)} fill="none" stroke="currentColor" strokeWidth="0.8" />
            </g>
            <g className="splash-orbit splash-orbit-b">
              <polygon
                points={starPoints(100, 100, 84)}
                transform="rotate(22.5 100 100)"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
              />
            </g>
            {/* الخاتم: يُرسم إطاره ثم يمتلئ بالذهبي */}
            <polygon
              className="splash-star"
              points={starPoints(100, 100, 62)}
              pathLength={1}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <polygon className="splash-cut" points={starPoints(100, 100, 43)} />
            <polygon className="splash-core" points={starPoints(100, 100, 25)} />
          </svg>

          <div className="splash-title flex flex-col items-center gap-1.5 text-center">
            <span className="text-2xl font-semibold text-(--splash-ink)">منصة السكن</span>
            <span className="text-sm text-(--splash-ink)/60">متابعة السكن الطلابي</span>
          </div>

          <div className="splash-bar" />
        </div>
      </div>
    </>
  );
}
