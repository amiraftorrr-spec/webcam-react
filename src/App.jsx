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
  
  // استیت‌های عکس‌ها
  const [ronaldo, setRonaldo] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const [mouse, setMouse] = useState(false);
  const [sonic, setSonic] = useState(false); // 👈 NEW

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
      numHands: 2, // قابلیت تشخیص دو دست
    });

    runningRef.current = true;
    loop();
  };

  // ---------------- helpers ----------------

  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  // 🖕 ژست فاک برای خاموش کردن دوربین
  const isMiddleFinger = (h) => {
    const indexUp = h[8].y < h[6].y;
    const middleUp = h[12].y < h[10].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;

    return middleUp && !indexUp && ringDown && pinkyDown;
  };

  // 👌 ژست اوکی برای روشن کردن دوربین
  const isOKGesture = (h) => {
    const thumb = h[4];
    const index = h[8];
    return dist(thumb, index) < 0.05;
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

  // 🐭 ژست عدد 2 (موش)
  const isMouseGesture = (h) => {
    const indexUp = h[8].y < h[6].y;
    const middleUp = h[12].y < h[10].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;

    return indexUp && middleUp && ringDown && pinkyDown;
  };

  // 👇 NEW: ژست دو دست روی سر (سونیک)
  const isHandsOnHead = (hands, faceLm) => {
    if (!hands?.landmarks || hands.landmarks.length < 2) return false;

    const headTop = faceLm[10]; // بالاترین نقطه پیشانی در مدل سه‌بعدی صورت
    const eyesLevel = faceLm[159]; // حدود ارتفاع چشم‌ها

    // نقطه 9 مرکز کف دست است
    const h1 = hands.landmarks[0][9];
    const h2 = hands.landmarks[1][9];

    // شرط ۱: دست‌ها باید در نیمه بالایی صورت یا بالاتر از آن باشند
    const isHighEnough = h1.y < eyesLevel.y && h2.y < eyesLevel.y;
    
    // شرط ۲: دست‌ها باید به سر نزدیک باشند (فاصله منطقی)
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
      let showSonicNow = false; // 👈 NEW

      // ---------------- FACE ----------------
      if (face.faceLandmarks?.length > 0) {
        const lm = face.faceLandmarks[0];

        const mouthOpen = Math.abs(lm[13].y - lm[14].y) > 0.03;
        setMouthOpen(mouthOpen);

        if (hands.landmarks?.length > 0) {
          const h1 = hands.landmarks[0]; // دست اول برای ژست‌های یک دستی

          // دستورات سیستمی (روشن/خاموش)
          if (isMiddleFinger(h1)) {
            setCameraOff(true);
          }
          if (isOKGesture(h1)) {
            setCameraOff(false);
          }

          // 👇 اولویت‌بندی ژست‌ها با else if (برای اینکه دو تا عکس با هم نیان)
          if (isHandsOnHead(hands, lm)) {
            showSonicNow = true;      // اولویت ۱: دست روی سر (سونیک)
          } else if (isHandsWideOpen(hands)) {
            showEmojiNow = true;      // اولویت ۲: دو دست باز (ایموجی)
          } else if (isIndexInMouth(h1, lm)) {
            showRonaldoNow = true;    // اولویت ۳: انگشت تو دهان (رونالدو)
          } else if (isMouseGesture(h1)) {
            showMouseNow = true;      // اولویت ۴: ژست عدد دو (موش)
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

  return (
    <div className="container" style={{ position: "relative" }}>
      <Webcam
        ref={webcamRef}
        mirrored
        audio={false}
        className="webcam"
        style={{ opacity: cameraOff ? 0 : 1, transition: "opacity 0.3s" }}
      />

      {cameraOff && (
        <div style={{ position: "absolute", top: 20, left: 20, fontSize: 30, color: "red", zIndex: 10 }}>
          Camera OFF 🚫
        </div>
      )}

      {/* نمایش عکس‌ها بر اساس اولویت */}
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