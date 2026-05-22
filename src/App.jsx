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
  const [mouse, setMouse] = useState(false); // 👈 NEW: اضافه شدن استیت موش

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
    const indexUp = h[8].y < h[6].y;
    const middleUp = h[12].y < h[10].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;

    return middleUp && !indexUp && ringDown && pinkyDown;
  };

  const isOKGesture = (h) => {
    const thumb = h[4];
    const index = h[8];
    return dist(thumb, index) < 0.05;
  };

  // 👇 NEW: تشخیص ژست لایک (Thumbs Up)
  const isLikeGesture = (h) => {
    const thumbUp = h[4].y < h[3].y; // شست بالاست
    const indexDown = h[8].y > h[6].y; // بقیه انگشت‌ها بسته‌اند
    const middleDown = h[12].y > h[10].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;

    return thumbUp && indexDown && middleDown && ringDown && pinkyDown;
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

  // 👇 NEW: تشخیص عدد 2 (V-Sign برای موش)
  const isMouseGesture = (h) => {
    const indexUp = h[8].y < h[6].y;
    const middleUp = h[12].y < h[10].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;

    return indexUp && middleUp && ringDown && pinkyDown;
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
      let showMouseNow = false; // 👈 NEW

      // ---------------- FACE ----------------
      if (face.faceLandmarks?.length > 0) {
        const lm = face.faceLandmarks[0];

        const mouthOpen = Math.abs(lm[13].y - lm[14].y) > 0.03;
        setMouthOpen(mouthOpen);

        if (hands.landmarks?.length > 0) {
          const h = hands.landmarks[0];

          if (isMiddleFinger(h)) {
            setCameraOff(true);
            // ⚠️ اینجا قبلاً return و false میشد که باعث میشد دوربین نتونه دوباره روشن شه. الان حذفش کردم!
          }

          // 👇 NEW: اگر ژست OK یا لایک بود، دوربین روشن شه
          if (isOKGesture(h) || isLikeGesture(h)) {
            setCameraOff(false);
          }

          if (isIndexInMouth(h, lm)) {
            showRonaldoNow = true;
          }

          if (isHandsWideOpen(hands)) {
            showEmojiNow = true;
          }

          // 👇 NEW: بررسی ژست عدد 2 برای موش
          if (isMouseGesture(h)) {
            showMouseNow = true;
          }
        }
      }

      setRonaldo(showRonaldoNow);
      setEmoji(showEmojiNow);
      setMouse(showMouseNow); // 👈 NEW
    }

    requestAnimationFrame(loop);
  };

  return (
    <div className="container" style={{ position: "relative" }}>
      {/* ⚠️ دوربین رو با استایل نامرئی می‌کنیم تا کاملاً حذف نشه و بتونه ژست لایک رو تشخیص بده */}
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

      {/* 👇 NEW: اضافه شدن تصویر موش */}
      {mouse && !cameraOff && (
        <img src="/mouse.jpg" alt="mouse" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}

      {emoji && !cameraOff && (
        <img src="/emoji.jpg" alt="emoji" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}

      {ronaldo && !cameraOff && !emoji && !mouse && (
        <img src="/ronaldo.jpg" alt="ronaldo" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}

      {mouthOpen && !cameraOff && !ronaldo && !emoji && !mouse && (
        <img src="/cat.jpg" alt="cat" className="cat" style={{ position: "absolute", top: 60, left: 20, zIndex: 10 }} />
      )}
    </div>
  );
}

export default App;