"use client";

import React, { useEffect, useRef, useState } from "react";
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
  const [showMouse, setShowMouse] = useState(false);
  const [status, setStatus] = useState("در حال بارگذاری مدل‌ها...");

  const requestRef = useRef(null);
  const lastTimestampRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        if (!isMounted) return;

        // بارگذاری مدل تشخیص چهره
        faceRef.current = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
        });

        // بارگذاری مدل تشخیص دست
        handRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });

        setStatus("مدل‌ها آماده‌اند! دوربین را بررسی کنید.");
        loop();
      } catch (error) {
        console.error("خطا در لود مدل‌ها:", error);
        setStatus("خطا در بارگذاری مدل‌ها.");
      }
    };

    init();

    return () => {
      isMounted = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (faceRef.current) faceRef.current.close();
      if (handRef.current) handRef.current.close();
    };
  }, []);

  // ---------------- Helpers (تشخیص ژست‌ها) ----------------

  const dist = (a, b) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);

  const isMiddleFinger = (h) => {
    const indexDown = h[8].y > h[6].y;
    const middleUp = h[12].y < h[10].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;
    return middleUp && indexDown && ringDown && pinkyDown;
  };

  const isOKGesture = (h) => {
    const thumbTip = h[4];
    const indexTip = h[8];
    return dist(thumbTip, indexTip) < 0.05;
  };

  // 🐭 ژست عدد 2 (انگشت اشاره و وسط)
  const isMouseGesture = (h) => {
    const indexUp = h[8].y < h[6].y;
    const middleUp = h[12].y < h[10].y;
    const ringDown = h[16].y > h[14].y;
    const pinkyDown = h[20].y > h[18].y;

    return indexUp && middleUp && ringDown && pinkyDown;
  };

  // ---------------- حلقه اصلی (Loop) ----------------

  const loop = () => {
    const video = webcamRef.current?.video;

    if (video && video.readyState === 4 && faceRef.current && handRef.current) {
      const now = performance.now();

      if (now !== lastTimestampRef.current) {
        lastTimestampRef.current = now;

        // 1. تشخیص چهره
        const faceResult = faceRef.current.detectForVideo(video, now);
        if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
          const lm = faceResult.faceLandmarks[0];
          setMouthOpen(Math.abs(lm[13].y - lm[14].y) > 0.02);
        } else {
          setMouthOpen(false);
        }

        // 2. تشخیص دست
        const handResult = handRef.current.detectForVideo(video, now);
        if (handResult.landmarks && handResult.landmarks.length > 0) {
          const h = handResult.landmarks[0];

          if (isMiddleFinger(h)) {
            setCameraOff(true);
            setShowMouse(false);
          } else if (isOKGesture(h)) {
            setCameraOff(false);
          } else if (isMouseGesture(h)) {
            setShowMouse(true);
          } else {
            setShowMouse(false);
          }
        } else {
          setShowMouse(false);
        }
      }
    }

    requestRef.current = requestAnimationFrame(loop);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-6 overflow-hidden">
      <h1 className="text-2xl font-bold mb-4 text-cyan-400">{status}</h1>

      <div className="relative w-full max-w-2xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-700">
        
        <Webcam
          ref={webcamRef}
          mirrored={true}
          audio={false}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {cameraOff && (
          <div className="absolute inset-0 bg-red-900/90 backdrop-blur-md flex flex-col items-center justify-center z-10 transition-all">
            <span className="text-6xl mb-4">🚫</span>
            <p className="text-3xl font-bold">دوربین خاموش است</p>
            <p className="text-sm mt-2 text-gray-300">برای روشن شدن، ژست OK (👌) نشان دهید</p>
          </div>
        )}

        {mouthOpen && !cameraOff && (
          <div className="absolute top-4 right-4 z-20 animate-bounce">
            <img src="/cat.jpg" alt="Cat" className="w-24 h-24 rounded-full border-4 border-yellow-400 shadow-lg object-cover" />
          </div>
        )}

        {showMouse && !cameraOff && (
          <div className="absolute top-4 left-4 z-20 animate-pulse">
            <img src="/mouse.jpg" alt="Mouse" className="w-24 h-24 rounded-full border-4 border-cyan-400 shadow-lg object-cover" />
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-6 text-center text-sm text-gray-400">
        <p>دهان باز = گربه 🐱</p>
        <p>ژست V (دو انگشت) = موش 🐭</p>
        <p>انگشت وسط = خاموش 🚫</p>
        <p>ژست OK = روشن 👌</p>
      </div>
    </main>
  );
}