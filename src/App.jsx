import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

function App() {
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

  // ---------------- helpers ----------------

  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  // 🖕 ژست فاک (با حساسیت بسیار بالا)
  const isMiddleFinger = (h) => {
    // بقیه انگشت‌ها باید خم باشند (نوک انگشت پایین‌تر از مفصل وسط)
    const indexDown = h[8].y > h[6].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;
    
    // انگشت وسط باید صاف باشد
    const middleUp = h[12].y < h[10].y;

    // شرط حساسیت بالا: نوک انگشت وسط باید بالاترین نقطه کل انگشتان باشد
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

    const h1 = hands.landmarks[0];
    const h2 = hands.landmarks[1];

    const isOpen = (h) => {
      const fingersUp =
        h[8].y < h[6].y &&
        h[12].y < h[10].y &&
        h[16].y < h[14].y &&
        h[20].y < h[18].y;

      return fingersUp;
    };

    return isOpen(h1) && isOpen(h2);
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

  // ---------------- loop ----------------

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

      // ---------------- FACE ----------------
      if (face.faceLandmarks?.length > 0) {
        const lm = face.faceLandmarks[0];

        const mouthOpen = Math.abs(lm[13].y - lm[14].y) > 0.03;
        setMouthOpen(mouthOpen);

        if (hands.landmarks?.length > 0) {
          const h1 = hands.landmarks[0];

          // 👇 دستور خاموش شدن واقعی دوربین
          if (isMiddleFinger(h1)) {
            setCameraOff(true);
            runningRef.current = false; // توقف کامل پردازش هوش مصنوعی
            return; // خروج از لوپ
          }

          if (isHandsOnHead(hands, lm)) {
            showSonicNow = true;      
          } else if (isHandsWideOpen(hands)) {
            showEmojiNow = true;      
          } else if (isIndexInMouth(h1, lm)) {
            showRonaldoNow = true;    
          } else if (isMouseGesture(h1)) {
            showMouseNow = true;      
          }
        }
      }

      setSonic(showSonicNow);
      setEmoji(showEmojiNow);
      setRonaldo(showRonaldoNow);
      setMouse(showMouseNow);
    }

    requestAnimationFrame(loop);
  };

  // تابع روشن کردن دستی دوربین
  const turnOnCamera = () => {
    setCameraOff(false);
    runningRef.current = true;
    requestAnimationFrame(loop);
  };

  return (
    <div className="container" style={{ position: "relative" }}>
      
      {/* ⚠️ وقتی دوربین خاموش شود، تگ وبکم کلاً حذف می‌شود تا دسترسی قطع شود */}
      {!cameraOff && (
        <Webcam
          ref={webcamRef}
          mirrored
          audio={false}
          className="webcam"
        />
      )}

      {/* با کلیک روی این دکمه دوربین دوباره روشن می‌شود */}
      {cameraOff && (
        <div 
          onClick={turnOnCamera}
          style={{ 
            position: "absolute", 
            top: 20, 
            left: 20, 
            fontSize: 30, 
            color: "red", 
            zIndex: 10,
            cursor: "pointer",
            backgroundColor: "rgba(0,0,0,0.5)",
            padding: "10px",
            borderRadius: "8px"
          }}
        >
          Camera OFF 🚫 (Click to Turn ON)
        </div>
      )}

      {sonic && !cameraOff && (
        <img src="/sonic.jpg" alt="sonic" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}

      {emoji && !cameraOff && !sonic && (
        <img src="/emoji.jpg" alt="emoji" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}

      {mouse && !cameraOff && !sonic && !emoji && (
        <img src="/mouse.jpg" alt="mouse" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}

      {ronaldo && !cameraOff && !sonic && !emoji && !mouse && (
        <img src="/ronaldo.jpg" alt="ronaldo" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}

      {mouthOpen && !cameraOff && !sonic && !emoji && !mouse && !ronaldo && (
        <img src="/cat.jpg" alt="cat" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}
    </div>
  );
}

export default App;