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

          if (isMiddleFinger(h1)) {
            setCameraOff(true);
            runningRef.current = false; 
            return; 
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

  const turnOnCamera = () => {
    setCameraOff(false);
    runningRef.current = true;
    requestAnimationFrame(loop);
  };

  // آبجکت استایل مشترک برای همه عکس‌ها (برای جلوگیری از تکرار کد)
  const imageStyle = {
    position: "absolute", 
    bottom: "30px", // به جای بالا چپ، آوردمش پایین راست مثل یک پنل مدرن
    right: "30px", 
    zIndex: 50,
    width: "130px",
    height: "130px",
    objectFit: "cover",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.6)",
    background: "rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
    padding: "6px" // یک قاب شیشه‌ای خوشگل دور عکس ایجاد میکنه
  };

  return (
    <div 
      className="container" 
      style={{ 
        position: "relative",
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(circle at 50% 0%, #1e1b4b, #020617 80%)", // بک‌گراند تاریک پریمیوم
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif"
      }}
    >
      
      {!cameraOff && (
        <Webcam
          ref={webcamRef}
          mirrored
          audio={false}
          className="webcam"
          style={{
            width: "90%",
            maxWidth: "1000px",
            aspectRatio: "16/9",
            objectFit: "cover",
            borderRadius: "24px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)",
            backgroundColor: "#000"
          }}
        />
      )}

      {cameraOff && (
        <div 
          onClick={turnOnCamera}
          style={{ 
            width: "90%",
            maxWidth: "1000px",
            aspectRatio: "16/9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "24px",
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(248, 113, 113, 0.3)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            color: "#fca5a5",
            fontSize: "26px",
            fontWeight: "bold",
            cursor: "pointer",
            zIndex: 10,
            textAlign: "center"
          }}
        >
          Camera OFF 🚫 (Click to Turn ON)
        </div>
      )}

      {sonic && !cameraOff && (
        <img src="/sonic.jpg" alt="sonic" className="cat" style={imageStyle} />
      )}

      {emoji && !cameraOff && !sonic && (
        <img src="/emoji.jpg" alt="emoji" className="cat" style={imageStyle} />
      )}

      {mouse && !cameraOff && !sonic && !emoji && (
        <img src="/mouse.jpg" alt="mouse" className="cat" style={imageStyle} />
      )}

      {ronaldo && !cameraOff && !sonic && !emoji && !mouse && (
        <img src="/ronaldo.jpg" alt="ronaldo" className="cat" style={imageStyle} />
      )}

      {mouthOpen && !cameraOff && !sonic && !emoji && !mouse && !ronaldo && (
        <img src="/cat.jpg" alt="cat" className="cat" style={imageStyle} />
      )}
    </div>
  );
}

export default App;