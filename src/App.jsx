import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import {
  FaceLandmarker,
  HandLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import "./App.css";

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

  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const isMiddleFinger = (h) => {
    const indexDown = h[8].y > h[6].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;
    const middleUp = h[12].y < h[10].y;
    const isMiddleHighest =
      h[12].y < h[8].y && h[12].y < h[16].y && h[12].y < h[20].y;

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

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-1"></div>
      <div className="bg-orb bg-orb-2"></div>

      <div className="container">
        <div className="camera-card">
          {!cameraOff && (
            <Webcam
              ref={webcamRef}
              mirrored
              audio={false}
              className="webcam"
            />
          )}

          {cameraOff && (
            <button
              type="button"
              onClick={turnOnCamera}
              className="camera-off-button"
            >
              <span className="camera-off-icon">🚫</span>
              <span className="camera-off-text">Camera OFF</span>
              <span className="camera-off-subtext">Click to turn on</span>
            </button>
          )}

          {sonic && !cameraOff && (
            <img src="/sonic.jpg" alt="sonic" className="overlay-image" />
          )}

          {emoji && !cameraOff && !sonic && (
            <img src="/emoji.jpg" alt="emoji" className="overlay-image" />
          )}

          {mouse && !cameraOff && !sonic && !emoji && (
            <img src="/mouse.jpg" alt="mouse" className="overlay-image" />
          )}

          {ronaldo && !cameraOff && !sonic && !emoji && !mouse && (
            <img src="/ronaldo.jpg" alt="ronaldo" className="overlay-image" />
          )}

          {mouthOpen && !cameraOff && !sonic && !emoji && !mouse && !ronaldo && (
            <img src="/cat.jpg" alt="cat" className="overlay-image" />
          )}

          <div className="hud">
            <div className="hud-badge">AI Gesture Cam</div>
            <div className={`hud-status ${cameraOff ? "is-off" : "is-live"}`}>
              {cameraOff ? "OFFLINE" : "LIVE"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;