import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

function App() {
  const webcamRef = useRef(null);
  
  // رفرنس‌های مدل‌ها
  const faceRef = useRef(null);
  const handRef = useRef(null);
  const boxRef = useRef(null); 

  const [mouthOpen, setMouthOpen] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  
  const [ronaldo, setRonaldo] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [mouse, setMouse] = useState(false);
  const [sonic, setSonic] = useState(false); 

  const [boxEnabled, setBoxEnabled] = useState(false);
  const boxEnabledRef = useRef(false);

  const runningRef = useRef(false);
  const processingRef = useRef(false); // جلوگیری از پردازش همزمان چند فریم

  // کانفیگ وبکم برای پرفورمنس بالاتر (رزولوشن کمتر مساوی است با پردازش بسیار سریع‌تر)
  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

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
        delegate: "GPU", // روشن کردن شتاب‌دهنده گرافیکی
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });

    handRef.current = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
        delegate: "GPU", // روشن کردن شتاب‌دهنده گرافیکی
      },
      runningMode: "VIDEO",
      numHands: 2,
    });

    runningRef.current = true;
    loop();
  };

  // ---------------- helpers ----------------
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

  // ---------------- loop ----------------
  const loop = () => {
    if (!runningRef.current) return;
    
    // جلوگیری از گیر کردن در پردازش قبلی
    if (processingRef.current) {
        requestAnimationFrame(loop);
        return;
    }

    const video = webcamRef.current?.video;

    if (video && video.readyState === 4) {
      processingRef.current = true;
      const now = performance.now();

      // پردازش بسیار سریع‌تر بدون صف‌های سنگین
      const face = faceRef.current.detectForVideo(video, now);
      const hands = handRef.current.detectForVideo(video, now);

      let showRonaldoNow = false;
      let showEmojiNow = false;
      let showMouseNow = false;
      let showSonicNow = false;

      // نمایش مربع تشخیص شخص (بدون رندر ریکت برای پرفورمنس بالاتر)
      if (boxEnabledRef.current && boxRef.current) {
        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        let hasDetection = false;

        if (face.faceLandmarks?.length > 0) {
          face.faceLandmarks[0].forEach(p => {
            if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
          });
          hasDetection = true;
        }

        if (hands.landmarks?.length > 0) {
          hands.landmarks.forEach(hand => {
            hand.forEach(p => {
              if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
              if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
            });
          });
          hasDetection = true;
        }

        if (hasDetection) {
          minX = Math.max(0, minX - 0.05);
          maxX = Math.min(1, maxX + 0.05);
          minY = Math.max(0, minY - 0.1); 
          maxY = Math.min(1, maxY + 0.05);

          const left = (1 - maxX) * 100;
          const top = minY * 100;
          const width = (maxX - minX) * 100;
          const height = (maxY - minY) * 100;

          boxRef.current.style.display = "block";
          boxRef.current.style.left = `${left}%`;
          boxRef.current.style.top = `${top}%`;
          boxRef.current.style.width = `${width}%`;
          boxRef.current.style.height = `${height}%`;
        } else {
          boxRef.current.style.display = "none";
        }
      } else if (boxRef.current) {
        boxRef.current.style.display = "none";
      }

      // ---------------- بررسی ژست‌ها ----------------
      if (face.faceLandmarks?.length > 0) {
        const lm = face.faceLandmarks[0];

        const isMouthOpen = Math.abs(lm[13].y - lm[14].y) > 0.03;
        
        // فقط اگر واقعا تغییر کرده آپدیت کن تا رندر الکی نگیریم
        setMouthOpen((prev) => prev !== isMouthOpen ? isMouthOpen : prev);

        if (hands.landmarks?.length > 0) {
          const h1 = hands.landmarks[0];

          if (isMiddleFinger(h1)) {
            setCameraOff(true);
            runningRef.current = false; 
            processingRef.current = false;
            return; 
          }

          if (isHandsOnHead(hands, lm)) showSonicNow = true;      
          else if (isHandsWideOpen(hands)) showEmojiNow = true;      
          else if (isIndexInMouth(h1, lm)) showRonaldoNow = true;    
          else if (isMouseGesture(h1)) showMouseNow = true;      
        }
      }

      setSonic(prev => prev !== showSonicNow ? showSonicNow : prev);
      setEmoji(prev => prev !== showEmojiNow ? showEmojiNow : prev);
      setRonaldo(prev => prev !== showRonaldoNow ? showRonaldoNow : prev);
      setMouse(prev => prev !== showMouseNow ? showMouseNow : prev);
      
      processingRef.current = false;
    }

    requestAnimationFrame(loop);
  };

  const turnOnCamera = () => {
    setCameraOff(false);
    runningRef.current = true;
    requestAnimationFrame(loop);
  };

  const toggleBox = () => {
    const newState = !boxEnabled;
    setBoxEnabled(newState);
    boxEnabledRef.current = newState;
  };

  const imageStyle = {
    position: "absolute", 
    bottom: "5%", 
    right: "5%", 
    zIndex: 50,
    width: "clamp(100px, 15vw, 180px)",
    height: "clamp(100px, 15vw, 180px)",
    objectFit: "cover",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
    background: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    padding: "6px"
  };

  return (
    <div 
      className="container" 
      style={{ 
        width: "100vw",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 0%, #1e1b4b, #020617 80%)",
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        padding: "20px",
        boxSizing: "border-box"
      }}
    >
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: "1000px",
        aspectRatio: "16/9",
        backgroundColor: "#000",
        borderRadius: "24px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
        overflow: "hidden"
      }}>
        
        {!cameraOff && (
          <Webcam
            ref={webcamRef}
            mirrored
            audio={false}
            videoConstraints={videoConstraints} /* کانفیگ افزایش سرعت */
            className="webcam"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}

        <div 
          ref={boxRef}
          style={{
            position: "absolute",
            display: "none",
            border: "3px solid #38bdf8",
            borderRadius: "12px",
            boxShadow: "0 0 15px rgba(56, 189, 248, 0.4), inset 0 0 15px rgba(56, 189, 248, 0.4)",
            zIndex: 30,
            pointerEvents: "none",
            transition: "left 0.05s linear, top 0.05s linear, width 0.05s linear, height 0.05s linear" // حرکت نرم و بهینه کادر
          }}
        />

        {cameraOff && (
          <div 
            onClick={turnOnCamera}
            style={{ 
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(15, 23, 42, 0.7)",
              backdropFilter: "blur(12px)",
              color: "#fca5a5",
              fontSize: "clamp(18px, 4vw, 26px)",
              fontWeight: "bold",
              cursor: "pointer",
              zIndex: 10,
              textAlign: "center"
            }}
          >
            Camera OFF 🚫 (Click to Turn ON)
          </div>
        )}

        {!cameraOff && (
          <button
            onClick={toggleBox}
            style={{
              position: "absolute",
              top: "5%",
              left: "5%",
              zIndex: 60,
              padding: "10px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: boxEnabled ? "rgba(56, 189, 248, 0.2)" : "rgba(0, 0, 0, 0.5)",
              color: boxEnabled ? "#38bdf8" : "#fff",
              backdropFilter: "blur(8px)",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              background: boxEnabled ? "#38bdf8" : "#94a3b8"
            }}/>
            {boxEnabled ? "Hide Box" : "Show Box"}
          </button>
        )}

        {sonic && !cameraOff && <img src="/sonic.jpg" alt="sonic" style={imageStyle} />}
        {emoji && !cameraOff && !sonic && <img src="/emoji.jpg" alt="emoji" style={imageStyle} />}
        {mouse && !cameraOff && !sonic && !emoji && <img src="/mouse.jpg" alt="mouse" style={imageStyle} />}
        {ronaldo && !cameraOff && !sonic && !emoji && !mouse && <img src="/ronaldo.jpg" alt="ronaldo" style={imageStyle} />}
        {mouthOpen && !cameraOff && !sonic && !emoji && !mouse && !ronaldo && <img src="/cat.jpg" alt="cat" style={imageStyle} />}
      </div>
    </div>
  );
}

export default App;