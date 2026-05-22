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

  const [showMouse, setShowMouse] = useState(false);

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

  const dist = (a, b) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

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

  // 🐭 NEW: index + middle up (peace-ish but فقط دو انگشت)
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

      // ---------------- FACE ----------------
      if (face.faceLandmarks?.length > 0) {
        const lm = face.faceLandmarks[0];

        setMouthOpen(Math.abs(lm[13].y - lm[14].y) > 0.03);
      }

      // ---------------- HAND ----------------
      if (hands.landmarks?.length > 0) {
        const h = hands.landmarks[0];

        // 🖕 OFF CAMERA
        if (isMiddleFinger(h)) {
          setCameraOff(true);
          setShowMouse(false);
          runningRef.current = false;
          return;
        }

        // 👍 ON CAMERA
        if (isOKGesture(h)) {
          setCameraOff(false);
          runningRef.current = true;
        }

        // 🐭 MOUSE GESTURE
        if (isMouseGesture(h)) {
          setShowMouse(true);
        } else {
          setShowMouse(false);
        }
      }
    }

    requestAnimationFrame(loop);
  };

  return (
    <div className="container">
      {!cameraOff && (
        <Webcam
          ref={webcamRef}
          mirrored
          audio={false}
          className="webcam"
        />
      )}

      {cameraOff && (
        <div style={{ fontSize: 30, color: "red" }}>
          Camera OFF 🚫
        </div>
      )}

      {mouthOpen && !cameraOff && (
        <img src="/cat.jpg" alt="cat" className="cat" />
      )}

      {showMouse && !cameraOff && (
        <img src="/mouse.jpg" alt="mouse" className="mouse" />
      )}
    </div>
  );
}

export default App;