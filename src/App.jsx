import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

export default function App() {
  const webcamRef = useRef(null);
  const faceRef = useRef(null);
  const handRef = useRef(null);

  const [mouthOpen, setMouthOpen] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  
  const [ronaldo, setRonaldo] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [mouse, setMouse] = useState(false);
  const [sonic, setSonic] = useState(false); 

  const runningRef = useRef(false);
  const lastTimestampRef = useRef(0);

  useEffect(() => {
    init();

    return () => {
      runningRef.current = false;
    };
  }, []);

  const init = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    faceRef.current = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });

    handRef.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
      },
      runningMode: "VIDEO",
      numHands: 2,
    });

    runningRef.current = true;
    loop();
  };

  // ---------------- helpers (منطق بدون تغییر) ----------------

  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const isMiddleFinger = (h) => {
    const indexDown = h[8].y > h[6].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;
    const middleUp = h[12].y < h[10].y;
    const isMiddleHighest = h[12].y < h[8].y && h[12].y < h[16].y && h[12].y < h[20].y;

    return middleUp && indexDown && ringDown && pinkyDown && isMiddleHighest;
  };

  const isIndexInMouth = (hand, faceLm) => {
    const indexTip = hand[8];
    const mouthTop = faceLm[13];
    const mouthBottom = faceLm[14];
    const mouthCenter = {
      x: (mouthTop.x + mouthBottom.x) / 2,
      y: (mouthTop.y + mouthBottom.y) / 2,
    };
    return dist(indexTip, mouthCenter) < 0.05;
  };

  const isHandsWideOpen = (hands) => {
    if (!hands?.landmarks || hands.landmarks.length < 2) return false;
    const isOpen = (h) => (
      h[8].y < h[6].y && h[12].y < h[10].y && h[16].y < h[14].y && h[20].y < h[18].y
    );
    return isOpen(hands.landmarks[0]) && isOpen(hands.landmarks[1]);
  };

  const isMouseGesture = (h) => {
    const indexUp = h[8].y < h[6].y;
    const middleUp = h[12].y < h[10].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;
    return indexUp && middleUp && ringDown && pinkyDown;
  };

  const isHandsOnHead = (hands, faceLm) => {
    if (!hands?.landmarks || hands.landmarks.length < 2) return false;
    const headTop = faceLm[10]; 
    const eyesLevel = faceLm[159]; 
    const h1 = hands.landmarks[0][9];
    const h2 = hands.landmarks[1][9];
    const isHighEnough = h1.y < eyesLevel.y && h2.y < eyesLevel.y;
    const isCloseToHead = dist(h1, headTop) < 0.3 && dist(h2, headTop) < 0.3;
    return isHighEnough && isCloseToHead;
  };

  // ---------------- loop (منطق بدون تغییر) ----------------

  const loop = () => {
    if (!runningRef.current) return;
    const video = webcamRef.current?.video;

    if (video && video.readyState === 4) {
      const now = performance.now();
      if (now <= lastTimestampRef.current) {
        requestAnimationFrame(loop);
        return;
      }
      lastTimestampRef.current = now;

      const face = faceRef.current.detectForVideo(video, now);
      const hands = handRef.current.detectForVideo(video, now);

      let showRonaldoNow = false;
      let showEmojiNow = false;
      let showMouseNow = false;
      let showSonicNow = false;

      if (face.faceLandmarks?.length > 0) {
        const lm = face.faceLandmarks[0];
        setMouthOpen(Math.abs(lm[13].y - lm[14].y) > 0.03);

        if (hands.landmarks?.length > 0) {
          const h1 = hands.landmarks[0];

          if (isMiddleFinger(h1)) {
            setCameraOff(true);
            runningRef.current = false; 
            return; 
          }

          if (isHandsOnHead(hands, lm)) showSonicNow = true;      
          else if (isHandsWideOpen(hands)) showEmojiNow = true;      
          else if (isIndexInMouth(h1, lm)) showRonaldoNow = true;    
          else if (isMouseGesture(h1)) showMouseNow = true;      
        }
      }

      setSonic(showSonicNow);
      setEmoji(showEmojiNow);
      setRonaldo(showRonaldoNow);
      setMouse(showMouseNow);
    }
    requestAnimationFrame(loop);
  };

  const turnOnCamera = () => {
    setCameraOff(false);
    runningRef.current = true;
    requestAnimationFrame(loop);
  };

  // تعیین عکسی که باید نمایش داده شود
  const getActiveImage = () => {
    if (sonic) return "/sonic.jpg";
    if (emoji) return "/emoji.jpg";
    if (mouse) return "/mouse.jpg";
    if (ronaldo) return "/ronaldo.jpg";
    if (mouthOpen) return "/cat.jpg";
    return null;
  };

  const activeImage = getActiveImage();

  // ---------------- Render (UI/UX کاملاً ارتقا یافته) ----------------
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 md:p-8 font-sans text-slate-200">
      
      {/* هدر سایت */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-cyan-400 to-indigo-500 bg-clip-text text-transparent drop-shadow-sm mb-2">
          AI Gesture Tracker
        </h1>
        <p className="text-slate-400 text-sm md:text-base font-medium tracking-wide">
          کنترل دوربین با هوش مصنوعی و حرکات بدن
        </p>
      </header>

      {/* بخش اصلی دوربین */}
      <div className="relative w-full max-w-4xl aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(56,189,248,0.1)] border border-slate-800">
        
        {!cameraOff ? (
          <Webcam
            ref={webcamRef}
            mirrored
            audio={false}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md z-20 transition-all duration-500">
            <span className="text-7xl mb-4 drop-shadow-lg">🚫</span>
            <h2 className="text-3xl font-bold text-rose-500 mb-6 drop-shadow-md">دوربین قطع شد</h2>
            <button 
              onClick={turnOnCamera}
              className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold text-lg transition-all duration-300 shadow-[0_0_20px_rgba(225,29,72,0.4)] hover:shadow-[0_0_30px_rgba(225,29,72,0.6)] hover:-translate-y-1 active:scale-95"
            >
              روشن کردن مجدد
            </button>
          </div>
        )}

        {/* عکس ری‌اکشن (Floating Box) */}
        {activeImage && !cameraOff && (
          <div className="absolute bottom-6 right-6 md:bottom-8 md:right-8 w-28 h-28 md:w-36 md:h-36 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-2 shadow-2xl animate-bounce-slow transition-all duration-300">
            <img 
              src={activeImage} 
              alt="Reaction" 
              className="w-full h-full object-cover rounded-xl shadow-inner"
            />
          </div>
        )}
      </div>

      {/* راهنمای ژست‌ها */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3 max-w-4xl w-full text-center">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
          <span className="text-3xl block mb-2">🖕</span>
          <span className="text-slate-400 text-xs md:text-sm font-semibold">خاموش کردن</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
          <span className="text-3xl block mb-2">😮</span>
          <span className="text-slate-400 text-xs md:text-sm font-semibold">دهان باز (گربه)</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
          <span className="text-3xl block mb-2">✌️</span>
          <span className="text-slate-400 text-xs md:text-sm font-semibold">عدد دو (موش)</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:bg-slate-800/50 transition-colors">
          <span className="text-3xl block mb-2">🙌</span>
          <span className="text-slate-400 text-xs md:text-sm font-semibold">دو دست باز</span>
        </div>
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 shadow-sm backdrop-blur-sm hover:bg-slate-800/50 transition-colors col-span-2 md:col-span-1">
          <span className="text-3xl block mb-2">💆‍♂️</span>
          <span className="text-slate-400 text-xs md:text-sm font-semibold">دست روی سر</span>
        </div>
      </div>

    </main>
  );
}