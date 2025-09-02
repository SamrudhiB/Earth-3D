// EarthCanvas.jsx
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

gsap.registerPlugin(ScrollTrigger);

export default function EarthCanvas() {
  const mountRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const buttonRef = useRef(null);

  const sceneRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    earthGroup: null,
  });
  const spinningRef = useRef(true);
  const [showButton, setShowButton] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [showVideo, setShowVideo] = useState(false);

  // --HELPER FUNCTIONS--
  function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -(radius * Math.sin(phi) * Math.cos(theta)),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }
  function computeTargetRotation(lat, lon) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Euler(0, theta, 0);
  }
  function computeTargetRotation1(lat, lon) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return { x: phi - Math.PI / 2, y: theta, z: 0 };
  }
  // -- END --

  // --HANDLE CLICK (ZOOMING IN FUNCTION)--
  const handleClick = () => {
    setShowButton(false);
    const { camera, controls, earthGroup } = sceneRef.current;
    spinningRef.current = false;
    controls.enabled = false;

    const puneLat = -19.5204;
    const puneLon = -85.8567;

    const targetRot = computeTargetRotation1(puneLat, puneLon);
    const zoomLevel = camera.position.distanceTo(controls.target);

    const tl = gsap.timeline({
      onComplete: () => {
        controls.target.set(0, 0, 0);
        controls.update();
        controls.enabled = true;
        setShowOverlay(false);
      },
    });

    tl.to(
      earthGroup.position,
      {
        x: 0,
        y: 0,
        z: 0,
        duration: 1,
      },
      0
    );

    tl.to(
      earthGroup.rotation,
      {
        x: targetRot.x,
        y: targetRot.y,
        z: targetRot.z,
        duration: 1,
        ease: "power2.inOut",
      },
      0
    );

    // move camera closer (tweak final dist as needed)
    controls.minDistance = camera.position.z - (zoomLevel - 11.5);
    tl.to(camera.position, {
      z: camera.position.z - (zoomLevel - 40.5),
      duration: 1,
      ease: "power2.inOut",
      onUpdate: () => controls.update(),
    });

    tl.to(canvasRef.current, {
      opacity: 0,
      duration: 0,
      onComplete: () => {
        setShowVideo(true);
        if (videoRef.current) videoRef.current.play();
      },
    });
  };
  // ----HANDLECLICK END---

  // ---- Setup scene ----
  useEffect(() => {
    // Prevent browser auto-restoring scroll position and force top
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 50);

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Stars
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 5000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i++) {
      starPositions[i] = (Math.random() - 0.5) * 2000;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Earth Group
    const earthGroup = new THREE.Group();

    // Earth sphere
    const earthRadius = 35;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load("/Earth-3D/earthbig.png"),
      bumpMap: new THREE.TextureLoader().load("/textures/earth_bump.jpg"),
      bumpScale: 0.5,
      specularMap: new THREE.TextureLoader().load("/textures/earth_specular.jpg"),
      specular: new THREE.Color("grey"),
    });
    const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    earthGroup.add(earthMesh);

    // atmosphere
// Atmosphere (inside earthGroup, same center as Earth)
const atmosphereShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    viewVector: { value: new THREE.Vector3(0, 0, 1) }
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vNormal = normalize(normalMatrix * normal);

      // Camera direction in view space
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewDir = normalize(-mvPosition.xyz);

      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      // Compare surface normal with view direction
      float intensity = pow(0.7 - dot(vNormal, vViewDir), 6.0);
      gl_FragColor = vec4(0.3, 0.6, 1.0, 1.0) * intensity;
    }
  `,
  side: THREE.BackSide,
  blending: THREE.AdditiveBlending,
  transparent: true,
});
const atmosphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(earthRadius * 1.05, 64, 64),
  atmosphereShaderMaterial
);
earthGroup.add(atmosphereMesh);



    // Clouds
    const cloudGeometry = new THREE.SphereGeometry(earthRadius * 1.01, 64, 64);
    const cloudMaterial = new THREE.MeshPhongMaterial({
      map: new THREE.TextureLoader().load("/Earth-3D/clouds.jpg"),
      transparent: true,
      opacity: 0.4,
    });
    const cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    earthGroup.add(cloudMesh);

    // Initial position of Earth
    earthGroup.position.set(0, -30, 0);

    // Set initial rotation so INDIA faces the camera
    const initialLat = -20.6139;
    const initialLon = -90.2090;
    const initialRot = computeTargetRotation(initialLat, initialLon);
    earthGroup.rotation.set(initialRot.x, initialRot.y, initialRot.z);

    scene.add(earthGroup);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const hemiLight = new THREE.HemisphereLight(0x88aaff, 0x444422, 0.6);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 10, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 100;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5, 100);
    pointLight.position.set(-20, -10, 20);
    scene.add(pointLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = true;
    controls.maxDistance = 12 * earthRadius;
    controls.minDistance = earthRadius;

    sceneRef.current = { scene, camera, renderer, controls, earthGroup };

    // Scroll-driven motion
    gsap.to(earthGroup.position, {
      x: 40,
      y: 5,
      scrollTrigger: {
        trigger: mountRef.current,
        start: "top top",
        end: "+=3000",
        scrub: 1,
        markers: false,
      },
    });
    gsap.to(camera.position, {
      z: 120,
      scrollTrigger: {
        trigger: mountRef.current,
        start: "top top",
        end: "+=3000",
        scrub: 1,
      },
    });

    // Resize handler (defined once)
    const handleResize = () => {
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    // Animation loop
    const tmpV = new THREE.Vector3();
    const animate = () => {
      requestAnimationFrame(animate);

      if (spinningRef.current) {
        earthGroup.rotation.y += 0.001;
        cloudMesh.rotation.y += 0.0012;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      ScrollTrigger.getAll().forEach((t) => t.kill());
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ height: "300vh" }}>
    <div
      ref={mountRef}
      style={{ width: "100vw", height: "100vh", position: "fixed", overflow: "hidden", zIndex:-1, top:0, left:0}}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />

      {showVideo && (
        <video
          ref={videoRef}
          src="/Earth-3D/video2.mp4"
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            top: 0,
            left: 0,
            zIndex: 5,
          }}
          muted
          autoPlay
          playsInline
        />
      )}
    </div>
    {showButton && (
      <button
        onClick={handleClick}
        style={{
          position:"fixed",
          padding: "12px 24px",
          fontSize: "18px",
          background: "#1e90ff",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          marginTop: "20px",
      }}>Learn More
      </button>
      )}
    </div>
  );
}